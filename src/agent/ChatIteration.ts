// @flow

import type { AppendMessageOutput } from "../types/AppendMessageOutput";
import type { UpdateMessageOutput } from "../types/UpdateMessageOutput";
import type { ModelConfig } from "../types/ModelConfig";
import type { MessageSQL } from "../schema/Message/MessageSchema";
import { MessageRole } from "../schema/Message/MessageSchema";
import MessageInterface from "../schema/Message/MessageInterface";
import GeneralResponse from "./GeneralResponse";
// import GeneralResponse from "./GeneralResponse.js";
// import ShortTermSummarization from "./ShortTermSummarization.js";
// import LongTermAnnotation from "./LongTermAnnotation.js";
// import Browser from "./Browser";

export default class ChatIteration {
  static iterationQueue: Array<() => void> = [];
  static isIterationRunning: boolean = false;

  static async queueIteration(
    windowId: number,
    model: ModelConfig,
    userPrompt: string,
    onAppendMessage: (output: AppendMessageOutput) => any,
    onUpdateMessage: (output: UpdateMessageOutput) => any,
    onError: (error: Error) => any,
  ) {
    try {
      // Render message on screen immediately with empty response:
      const userMessage = await MessageInterface.insert(windowId, MessageRole.USER, userPrompt, null, true);
      onAppendMessage({
        windowId,
        message: userMessage,
      })
      const emptyResponse = await MessageInterface.insert(
        windowId,
        MessageRole.ASSISTANT,
        '',
        userMessage.messageId,
        false
      )
      const output: AppendMessageOutput = {
        windowId,
        message: emptyResponse,
      }
      onAppendMessage(output)

      // Create an iteration task (a function) that runs `iterate`
      const iterationTask = () => {
        ChatIteration.iterate(windowId, model, userPrompt, onAppendMessage, onUpdateMessage, onError, userMessage, emptyResponse);
      };

      // Check if an iteration is currently running
      if (!this.isIterationRunning) {
        // If no iteration is running, execute the task immediately
        this.isIterationRunning = true;
        iterationTask();
      } else {
        // If an iteration is already running, queue this task
        this.iterationQueue.push(iterationTask);
      }

    } catch (error) {
      // @ts-ignore
      onError(error);
    }
  }

  static runNextIteration() {
    // Mark the current iteration as done
    this.isIterationRunning = false;

    // If there are more iterations queued, dequeue and run the next one
    if (this.iterationQueue.length > 0) {
      const nextTask = this.iterationQueue.shift();
      if (nextTask) {
        this.isIterationRunning = true;
        nextTask();
      }
    }
  }

  static iterate(
    windowId: number,
    model: ModelConfig,
    userPrompt: string,
    onAppendMessage: (output: AppendMessageOutput) => any,
    onUpdateMessage: (output: UpdateMessageOutput) => any,
    onError: (error: Error) => any,
    userMessage: MessageSQL,
    emptyResponse: MessageSQL,
  ) {
    Promise.resolve().then(async () => {
      try {
        // const userMessage = await MessageInterface.insert(windowId, MessageRole.USER, userPrompt, null, true);
        //
        // onAppendMessage({
        //   windowId,
        //   message: userMessage,
        // })

        // todo only get the last 2:
        const allMessages = await MessageInterface.getAll(windowId);
        const lastAgentMessage = allMessages[allMessages.length - 2]
        const lastUserMessage = allMessages[allMessages.length - 1]

        // Show a blank message in the UI while waiting:
        // const emptyResponse = await MessageInterface.insert(
        //   windowId,
        //   MessageRole.ASSISTANT,
        //   '',
        //   userMessage.messageId,
        //   false
        // )
        // const output: AppendMessageOutput = {
        //   windowId,
        //   message: emptyResponse,
        // }
        // onAppendMessage(output)

        const searchSummary: string = ''
        // const searchSummary: string = (await Browser.checkAndSearch(model, lastUserMessage)) ?? ''

        const shortTermSummary = ''
        // const shortTermSummary = await ShortTermSummarization.performCompletion(
        //   windowId,
        //   model,
        //   allMessages,
        // )

        const longTermSummary = ''
        // const longTermSummary = await LongTermAnnotation.searchAndSummarize(
        //   model,
        //   shortTermSummary,
        //   lastUserMessage,
        // )

        const finalResponse = await GeneralResponse.beginStreaming(
          windowId,
          model,
          emptyResponse,
          shortTermSummary,
          longTermSummary,
          searchSummary,
          allMessages,
          userPrompt,
          onAppendMessage,
          onUpdateMessage,
        );

        // LongTermAnnotation.backgroundAnnotate(model, lastUserMessage)
        // LongTermAnnotation.backgroundAnnotate(model, finalResponse)
      } catch (err) {
        console.error(err);
        // @ts-ignore
        onError(err);
      }
      this.runNextIteration();
    })
  }
}
