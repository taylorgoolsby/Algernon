// @flow

import type { MessageSQL } from '../schema/Message/MessageSchema'
import AnnotationInterface from '../schema/Annotation/AnnotationInterface'
import InferenceRest from '../rest/InferenceRest'
import type {ModelConfig} from "../types/ModelConfig";
import { NativeModules } from 'react-native';
import MessageInterface from "../schema/Message/MessageInterface";
import { syncTextResponse } from "./generateTextResponse";

const { TextFeatureExtractor, FaissBridge } = NativeModules;

// const MODEL = 'Xenova/all-MiniLM-L6-v2'
// const D = 384
// const INDEX_PATH = 'index.faiss'
const DISTANCE_THRESHOLD = 0.25
// let pipe: any
// let index: any

export default class LongTermAnnotation {
  /*
  Long term annotation will take the text of a message and:
  1. Pass it through an agent which will pick out a list annotations.
  2. Store each annotation in a mysql database, Annotation table, producing a unique ID.
  3. Store each annotation in a vector database with this ID.
  4. Later, on retrieval, a vector similarity search is used to find annotations close to a topic. This returns IDs.
  5. The ID is used against mysql to get the annotation.
  6. Annotation rows are related to the Message row, so the original message can be retrieved.
  7. Both the retrieved annotations and the original message can be used generate the long term summary.
  * */
  static backgroundAnnotate(
    model: ModelConfig,
    message: MessageSQL,
    searchSummary: string | null | undefined,
  ): void {
    Promise.resolve().then(async () => {
      try {
        const text = message.text + '\n\n' + (searchSummary ?? '')

        const annotations = await LongTermAnnotation.getAnnotations(
          model,
          text,
        )
        console.log("annotations", annotations);

        for (const annotationText of annotations) {
          await LongTermAnnotation.embedAndInsert(message, annotationText)
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  static async embedAndInsert(message: MessageSQL, annotationText: string): Promise<void> {
    const embedding: Array<number> = await TextFeatureExtractor.extractFeatures(annotationText)
    const annotationId = await LongTermAnnotation.insert(embedding)
    await AnnotationInterface.insert(
      annotationId,
      message.messageId,
      annotationText,
      embedding,
    )
  }

  static async getAnnotations(
    model: ModelConfig,
    text: string,
  ): Promise<Array<string>> {
    // todo: fine-tune the model to produce annotations.
    const context = [
      {
        role: 'system',
        content: `Produce a list of annotations from the given text. Annotations are short summaries of key points or insights that can be used to aid in long-term memory retention and recall. Each annotation should be concise, informative, and relevant to the text provided. Provide your response formatted as a JSON parseable array of strings.

For example, if the text is: "In a groundbreaking discovery, scientists have found evidence of liquid water on Mars, raising hopes of potential life on the Red Planet. The research was conducted by NASA’s Curiosity rover, which has been exploring the Martian surface since 2012.", then the output might be: [
  "liquid water on Mars",
  "potential life",
  "Curiosity rover",
  "NASA",
  "Martian surface exploration",
  "scientific discovery"
]

For example, "Quantum computing has the potential to revolutionize industries by solving problems that are currently unsolvable by classical computers. The technology leverages the principles of superposition and entanglement to perform complex calculations at unprecedented speeds." might produce: ["quantum computing",
  "revolutionize industries",
  "classical computers",
  "superposition",
  "entanglement",
  "complex calculations"
]`,
      },
      {
        role: 'user',
        content: text,
      },
    ]

    // Make a completion call with retry in case the JSON is not parseable:
    let annotations: Array<string> = []
    for (let i = 0; i < 3; i++) {
      // todo: Use prompt formatting to encourage JSON output.
      const res = await syncTextResponse(model, context, { jsonMode: false })
      console.log("res", res);
      const rawJSON = res.choices[0]?.message?.content ?? ''
      console.log("rawJSON", rawJSON);
      try {
        annotations = JSON.parse(rawJSON)
        if (!Array.isArray(annotations)) {
          throw new Error('Annotations are not an array')
        }
        break
      } catch (err) {
        // console.warn('Annotator did not output JSON', rawJSON)
      }
    }

    return annotations
  }

  /*
  Adds an embedding to the vector database.
  Returns the label of the embedding.
  * */
  static async insert(vector: Array<number>): Promise<number> {
    // let k = 1
    //
    // if (!index) {
    //   if (fs.existsSync(INDEX_PATH)) {
    //     index = Index.read(INDEX_PATH)
    //   } else {
    //     // index = Index.fromFactory(D, `"IVF${k},Flat"`, MetricType.METRIC_INNER_PRODUCT);
    //     index = Index.fromFactory(
    //       D,
    //       `IVF${k},Flat`,
    //       MetricType.METRIC_INNER_PRODUCT,
    //     )
    //     index.train(vector)
    //   }
    // }

    const label = await FaissBridge.addVector(vector)
    console.log("label", label);
    return label
  }

  static async search(
    topic: string,
  ): Promise<{ distances: Array<number>, labels: Array<number> }> {
    // if (!pipe) {
    //   pipe = await pipeline('feature-extraction', MODEL)
    // }

    const embedding = await TextFeatureExtractor.extractFeatures(topic)

    // const embedding = await pipe(topic, { pooling: 'mean', normalize: true })
    // const vector = Array.from(embedding.data)

    // if (!index) {
    //   if (fs.existsSync(INDEX_PATH)) {
    //     index = Index.read(INDEX_PATH)
    //   } else {
    //     throw new Error('Index not found')
    //   }
    // }
    const ntotal = await FaissBridge.ntotal()
    const k = Math.min(10, ntotal)
    const res = await FaissBridge.searchVectors(embedding, k)
    return res
  }

  static async detectTopic(
    model: ModelConfig,
    shortTermSummary: string,
    lastMessage: MessageSQL,
  ): Promise<string> {
    return shortTermSummary + '\n\n' + lastMessage.text
  }

  static async searchAndSummarize(
    model: ModelConfig,
    shortTermSummary: string,
    lastMessage: MessageSQL,
  ): Promise<string> {
    const topic = await LongTermAnnotation.detectTopic(
      model,
      shortTermSummary,
      lastMessage,
    )

    const vectorRes = await LongTermAnnotation.search(topic)

    // Filter out labels which are below the distance threshold:
    const annotationIds = vectorRes.labels.filter(
      (label, i) => vectorRes.distances[i] > DISTANCE_THRESHOLD,
    )

    const annotations = await AnnotationInterface.retrieve(annotationIds)

    return JSON.stringify(annotations.map(annotation => annotation.text))

    // todo: timezone

//     const context = [
//       {
//         role: 'system',
//         content: `Your task is to generate a concise summary from a given collection of annotations, focusing on retaining the most important information for long-term memory. The annotations are structured in JSON format, each containing a text field that holds the content of the annotation and a dateCreated field indicating when the annotation was created.
// Instructions:
//
//     Analyze the Annotations: Go through each annotation to understand its content and significance.
//
//     Identify Key Information: Determine the most important information in each annotation that should be retained for long-term memory.
//
//     Handle Time-sensitive Information: Pay close attention to the dateCreated field. For annotations with time-sensitive information, ensure the summary reflects the context of when the annotation was created.
//
//     Generate Summary: Create a summary that encapsulates the key points from the annotations, weaving them into a coherent narrative if possible. The summary should be concise, informative, and tailored to aid in journaling and brainstorming by making connections with past stories and ideas.
//
// Examples:
//
// Input:
//
// [
//   {text: 'Started reading "Atomic Habits" by James Clear, excited to explore habit formation.', dateCreated: '2020-06-15T09:30:00.000Z'},
//   {text: 'Atomic Habits: Small changes can lead to remarkable results by focusing on 1% improvements.', dateCreated: '2020-06-20T10:00:00.000Z'}
// ]
//
// Output:
//
// In June 2020, started exploring "Atomic Habits" by James Clear, focusing on the power of small changes and 1% improvements for remarkable results in habit formation.
//
// Input:
//
// [
//   {text: 'Brainstorming session: Possible to use AI for personalized education?', dateCreated: '2021-03-05T14:00:00.000Z'},
//   {text: 'Idea: Develop an app that adapts learning material based on student performance.', dateCreated: '2021-03-10T16:45:00.000Z'},
//   {text: 'Feedback from mentor: Emphasize interactive elements and real-world applications.', dateCreated: '2021-03-12T13:20:00.000Z'}
// ]
//
// Output:
//
//     In March 2021, brainstormed the potential of AI in personalized education, leading to an idea for an app that customizes learning content according to student performance. Mentor feedback highlighted the importance of interactive elements and real-world applications.
//
// This summary should serve as a reflective, insightful, and concise synthesis of the provided annotations, aiding the user in journaling and brainstorming activities by connecting with past insights and ideas.`,
//       },
//       {
//         role: 'user',
//         content: JSON.stringify(annotations),
//       },
//     ]
//
//     // Make a completion call to get the long term summary:
//     let summary = ''
//     for (let i = 0; i < 3; i++) {
//       const res = await syncTextResponse(model, context)
//       summary = res.choices[0]?.message?.content ?? ''
//       if (summary) {
//         break
//       }
//     }
//
//     return summary
  }

  static searchAndGetMessages(search: string, onResult: (messages: Array<string>) => void) {
    Promise.resolve().then(async () => {
      const vectorRes = await LongTermAnnotation.search(search)

      // Filter out labels which are below the distance threshold:
      const annotationIds = vectorRes.labels.filter(
        (label, i) => vectorRes.distances[i] > DISTANCE_THRESHOLD,
      )

      const messages = await MessageInterface.getFromAnnotations(annotationIds)

      onResult(messages.map(message => message.messageId.toString()))
    })
  }
}
