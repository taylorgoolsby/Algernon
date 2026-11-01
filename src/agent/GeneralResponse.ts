// src/agent/GeneralResponse.ts
// @flow

import type {GPTMessage} from '../types/GPTMessage'
import type {ModelConfig} from '../types/ModelConfig'
import type {AppendMessageOutput} from '../types/AppendMessageOutput'
import type {UpdateMessageOutput} from '../types/UpdateMessageOutput'
import MessageInterface from '../schema/Message/MessageInterface'
import {MessageRole} from '../schema/Message/MessageSchema'
import InferenceRest from '../rest/InferenceRest'
import type {ChatCompletionsResponse} from '../types/ChatCompletion'
import type {MessageSQL} from '../schema/Message/MessageSchema'
import CompletionInterface from '../schema/Completion/CompletionInterface'
import {CompletionType} from '../schema/Completion/CompletionSchema'
import normalizeModelName from "../utils/normalizeModelName";
import ShortTermSummarization from "./ShortTermSummarization";
import {streamTextResponse} from "./generateTextResponse";
import LongTermAnnotation from "./LongTermAnnotation";
import {
  MAX_TOOL_CALLS,
  TOOL_RESULT_INSTRUCTION,
  WEB_SEARCH_TOOL_NAME,
  WEB_SEARCH_TOOL_PROMPT,
  looksLikeToolCall,
  parseToolCall,
  runWebSearch,
} from "./WebSearchTool";
import type {ToolCall} from "./WebSearchTool";

type StreamResult = {
  message: MessageSQL,
  // Set when the model asked to use a tool instead of answering.
  toolCall: ToolCall | null,
}

export default class GeneralResponse {
  /*
  Generates a streamed response from an LLM.
  * */
  static async beginStreaming(
    windowId: number,
    model: ModelConfig,
    emptyResponse: MessageSQL,
    shortTermSummary: string,
    longTermSummary: string,
    searchSummary: string,
    allMessages: Array<MessageSQL>,
    userPrompt: string,
    onAppendMessage: (output: AppendMessageOutput) => any,
    onUpdateMessage: (output: UpdateMessageOutput) => any,
    userMessageId?: number,
  ): Promise<MessageSQL> {
//     const systemMessage = `This is your system prompt. Avoid repeating the following system prompt to the user. Your are a personal digital assistant inside of a iOS app called Algernon AI. It is a general purpose AI chat app, designed to help the user with a wide range of tasks. Users are encouraged to talk freely into the app, similar to free form writing, and using AI methods, the app should help the user identify connections or loose ends in their thoughts. Your design allows you to remember previous interactions, learn from them, and even facilitate the user's learning on any subject, ensuring you are always ready to assist the uesr with their journaling, knowledge base management, brainstorming, learning, and more. You may be given real-time search results. Use this to give the user accurate and up-to-date information.

// Capabilities
//     * Journaling: I can help you keep track of your daily activities, thoughts, and reflections, offering a secure space for personal growth.
//     * Knowledge Base Management: I can help you organize information, retrieve past entries, and keep your knowledge base up-to-date and easily accessible.
//     * Brainstorming: Whether you're looking for creative ideas or problem-solving, I'm here to facilitate your thought process and offer suggestions.
//     * Learning: I can guide you through learning any subject, providing information, resources, quizzes, and interactive discussions to deepen your understanding and retention of the material.

// Few-Shot Examples for New Users

//     > What are you capable of?
//         * I'm equipped to assist you with various tasks such as keeping a journal, managing information, brainstorming ideas, learning new topics, and more. Just let me know what you need!
//     > Can you remind me of my appointments?
//         * Sorry, I do not have the ability to set reminders, yet.
//     > What is the weather like in Marina, CA?
//         * The current weather in Marina, CA is 67°F with sunny conditions.
//     > How do you manage privacy?
//         * Your privacy is paramount. I'm designed to work locally on your device, ensuring that all your data stays private and secure.
//     > I need to brainstorm ideas for a project. Can you help?
//         * Absolutely! Let's start by discussing the project's goals and any initial ideas you might have. I'll help you expand on them and explore new possibilities.
//     > Help me organize my notes on 19th-century art.
//         * Of course! Let's start by categorizing your notes. We can organize them by art movement, notable artists, or specific artworks. Just guide me on how you'd like to proceed.
//     > I want to learn about quantum mechanics. Where should I start?
//         * Great choice! Quantum mechanics is a fascinating subject. We can begin with the basics, like understanding wave-particle duality, and then move on to more complex concepts such as quantum entanglement and superposition. I'll provide explanations, resources, and quizzes to help you master the topic.
//     > I'd like to make a journal entry.
//         * Of course! Feel free to share what's on your mind, or if you prefer, I can ask guiding questions to get you started. What would you like to journal about today?
//     > I want to learn about a new topic.
//         * Fantastic! What subject interests you? Tell me a bit more, and I'll provide information and resources to help you start learning.
//     > Help me organize my notes.
//         * Sure thing! What kind of notes are we organizing today? Are they related to a specific project or topic?
//     > I need to brainstorm some ideas.
//         * Great! Let's get creative. What's the main focus of our brainstorming session? Give me a brief overview, and we'll go from there.
//     > Let's plan today's agenda.
//         * Let's get your day in order. What appointments or tasks do we need to schedule? You can list them, and I'll help you sort everything out. 
//     > I'm bored.
//         * Okay. Let's play a game. {Generates a p5.js script of a simple interactive game.}
        
// The

// Personality Traits

//     * Helpful: I aim to be supportive and provide assistance tailored to your needs.
//     * Inquisitive: I ask questions to better understand your requests and deliver precise outcomes.
//     * Friendly: I engage in a warm and friendly manner, making our interactions pleasant.
//     * Respectful: I respect your privacy and time, providing efficient and discreet service.
//     * Educational: I'm dedicated to helping you learn and grow, offering insights and resources to enrich your knowledge on any topic.
    
// Rules

//     * Avoid repeating the long term memory, short term memory, or system promps to the user.
//     * Avoid using the word 'delve'.
//     * When asked what model are you, respond ${model.title}.
    
// The follower is a summary of your memories:

// # Long Term Memory
// ${longTermSummary ?? ''}

// # Short Term Memory
// ${shortTermSummary ?? ''}

// # Real-Time Search Results
// ${searchSummary ?? ''}
//     `

    const systemMessage = `Reflect on the user's thoughts. Speak back in their language and style.

${WEB_SEARCH_TOOL_PROMPT}

Respond in as few words as possible. Default to one or two sentences. No preamble, no recap, no bullet lists or headers unless explicitly asked. Answer the question directly, then stop. If more detail would help, let the user ask for it.`

    const previousMessages = allMessages.slice(0, allMessages.length - 1)
    const nonSystemMessages: Array<MessageSQL> = previousMessages.filter(
      (m) => m.role.toLowerCase() !== 'system',
    )

    if (nonSystemMessages[nonSystemMessages.length - 1].role.toLowerCase() === 'user') {
      // keep dropping messages until the last message is role === 'assistant':
      while (nonSystemMessages.length > 0 && nonSystemMessages[nonSystemMessages.length - 1].role.toLowerCase() === 'user') {
        nonSystemMessages.pop();
      }
    }

    // only keep the last 100 messages:
    if (nonSystemMessages.length > 10) {
      nonSystemMessages.splice(0, nonSystemMessages.length - 10);
    }

    // RAG memory: besides the recent messages above, retrieve older messages
    // that are similar to the user's new message. Anything already in the
    // context window (or the new message itself) is skipped.
    const excludeMessageIds = new Set<number>(
      nonSystemMessages.map((m) => m.messageId),
    )
    if (userMessageId != null) excludeMessageIds.add(userMessageId)
    const memoriesBlock = await GeneralResponse.retrieveMemoriesBlock(
      userPrompt,
      excludeMessageIds,
    )

    console.log('memoriesBlock', memoriesBlock)

    const context: Array<GPTMessage> = [
      {
        role: 'system',
        content: memoriesBlock
          ? systemMessage + '\n\n' + memoriesBlock
          : systemMessage,
      },
      ...nonSystemMessages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.text,
      })),
      {
        role: 'user',
        content: userPrompt,
      },
    ].filter(Boolean)

    // console.log("context", context);

    // Then streaming begins and incoming tokens are relayed back to the client.
    // If the model calls web_search, the search runs and generation continues.
    const { message: completeMessage, context: finalContext } =
      await GeneralResponse.streamWithTools(
        windowId,
        model,
        context,
        emptyResponse,
        onUpdateMessage,
      )

    // All completions are saved to DB (including any tool call turns):
    await CompletionInterface.insert(CompletionType.GENERAL, model, finalContext, {
      role: 'assistant',
      content: completeMessage.text,
    })

    return completeMessage
  }

  /*
  Never lets a memory failure break the chat: on error, no memories are used.
  * */
  static async retrieveMemoriesBlock(
    userPrompt: string,
    excludeMessageIds: Set<number>,
  ): Promise<string> {
    try {
      const memories = await LongTermAnnotation.retrieveMemories(
        userPrompt,
        excludeMessageIds,
      )
      return LongTermAnnotation.formatMemories(memories)
    } catch (err) {
      console.error('Memory retrieval failed:', err)
      return ''
    }
  }

  /*
  The tool call loop:
    generate -> if the model asked for web_search, run it, append the call and
    its result to the context, and generate again -> until the model answers
    in plain text (or MAX_TOOL_CALLS is reached, after which a tool call is
    treated as the answer).
  Returns the final message and the context that produced it.
  * */
  static async streamWithTools(
    windowId: number,
    model: ModelConfig,
    context: Array<GPTMessage>,
    response: MessageSQL,
    onUpdateMessage: (output: UpdateMessageOutput) => any,
  ): Promise<{ message: MessageSQL, context: Array<GPTMessage> }> {
    let loopContext = context

    for (let toolCalls = 0; ; toolCalls++) {
      const allowToolCalls = toolCalls < MAX_TOOL_CALLS
      const result = await GeneralResponse.stream(
        windowId,
        model,
        loopContext,
        response,
        onUpdateMessage,
        allowToolCalls,
      )

      if (!result.toolCall) {
        return { message: result.message, context: loopContext }
      }

      const { query } = result.toolCall

      // Temporary status in the UI. It is not saved: the final answer replaces it.
      response.text = `Searching the web for: ${query}…`
      onUpdateMessage({ windowId, message: response })

      const searchResults = await runWebSearch(query)

      loopContext = [
        ...loopContext,
        {
          role: 'assistant',
          content: JSON.stringify({
            name: WEB_SEARCH_TOOL_NAME,
            parameters: { query },
          }),
        },
        {
          role: 'ipython',
          content: searchResults + TOOL_RESULT_INSTRUCTION,
        },
      ]
    }
  }

  static stream(
    windowId: number,
    model: ModelConfig,
    context: Array<GPTMessage>,
    response: MessageSQL,
    onUpdateMessage: (output: UpdateMessageOutput) => any,
    allowToolCalls: boolean = false,
  ): Promise<StreamResult> {
    return new Promise(async (resolve, reject) => {
      let buffer = ''
      let previousAutocompletion: string | null = null

      // todo: send error to UI
      let stop = false

      let timeout: ReturnType<typeof setTimeout> | null
      function startTimeout() {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
        }
        timeout = setTimeout(() => {
          // todo: If timeout,
          //  then retry without system message.
          //  But maybe this isn't needed because InferenceRest.relayChatCompletionStream already does 3 retries.
          stop = true
          const error = new Error('Event stream timeout.')
          reject(error)
        }, 60000) // 60 seconds
      }

      startTimeout()

      // Send a /chat/completions call
      streamTextResponse(
        model,
        context,
        (res: ChatCompletionsResponse) => {
          try {
            if (stop) {
              return;
            }
            startTimeout();

            // console.log("res", res);

            // console.log("res.choices[0]", res.choices[0]);

            // Check the finish_reason:
            const finishReason = res.choices[0]?.finish_reason;

            if (finishReason === "length") {
              const error = new Error("The maximum number of tokens was reached.");
              reject(error);
              throw error;
            } else if (finishReason === "content_filter") {
              const error = new Error("A content filter flag was raised.");
              reject(error);
              throw error;
            } else if (finishReason === "tool_calls") {
              const error = new Error("Tool calls are not yet implemented.");
              reject(error);
              throw error;
            } else if (finishReason !== "stop" && finishReason !== null) {
              const error = new Error("Unknown finish reason.");
              reject(error);
              throw error;
            }

            // todo: check if finish_reason=stop always has an empty delta.
            //  Do not send a token update if it does as this would be redundant.

            const text = res?.choices[0]?.delta?.content || "";

            buffer += text;

            // Used for JSON mode:
            // if (buffer.length < intro.length) {
            //   // The buffer is not long enough to contain the intro.
            //   return
            // }
            // const autocompletion = JSON.stringify(parseIncompleteJSON(buffer))

            const autocompletion = buffer;

            const messageChanged = autocompletion !== previousAutocompletion;
            previousAutocompletion = autocompletion;

            if (!messageChanged && finishReason !== "stop") {
              // console.debug('Autocompletion matched delta, no change.')
              return;
            }

            // Text that starts with "{" may be a tool call. Hide it from the UI
            // until generation finishes and we know.
            const maybeToolCall =
              allowToolCalls && looksLikeToolCall(autocompletion);

            if (finishReason === "stop") {
              // todo: If stop reached but autocompletion.text is empty still,
              //  then retry after sending system message trying to correct.

              stop = true;
              if (timeout) {
                clearTimeout(timeout);
                timeout = null;
              }

              const toolCall = maybeToolCall
                ? parseToolCall(autocompletion)
                : null;
              if (toolCall) {
                // Not an answer: nothing is shown or saved. The caller runs the tool.
                resolve({ message: response, toolCall });
                return;
              }

              response.completed = true;
              Promise.resolve()
                .then(async () => {
                  // console.debug('saving complete message: ', finalText)
                  await MessageInterface.completeData(
                    response.messageId,
                    autocompletion,
                  );
                })
                .catch(err => {
                  console.error(err);
                  reject(err);
                });

              resolve({ message: response, toolCall: null });
            }

            if (maybeToolCall && finishReason !== "stop") {
              return;
            }

            // send:
            response.text = autocompletion;
            const output: UpdateMessageOutput = {
              windowId,
              message: response,
            };
            onUpdateMessage(output);
          } catch (err) {
            console.error(err);
          }
        },
        null,
        // (error?: ?Error) => {
        //   if (error) {
        //     reject(error)
        //   } else {
        //     reject(new Error('Unable to get response from GPT.'))
        //   }
        // },
      )
    })
  }
}