// @flow

import { NativeEventEmitter, NativeModules } from 'react-native';
import type {ChatCompletionsResponse} from "../types/ChatCompletion";
import type { ModelConfig } from "../types/ModelConfig";
import type { GPTMessage } from "../types/GPTMessage";

// Get the LLMNativeModule from NativeModules
const { LLMNativeModule } = NativeModules;

// Initialize the event emitter for listening to token generation events
const eventEmitter = new NativeEventEmitter(LLMNativeModule);

// Function to set up event listener for token generation
const setupTokenListener = (callback: (output: string) => void) => {
  // Add a listener for the 'onTokenGenerated' event
  const subscription = eventEmitter.addListener('onTokenGenerated', (event) => {
    // @ts-ignore
    const responseSoFar = event.responseSoFar;
    callback(responseSoFar);
  });

  // Return the subscription so it can be removed later if needed
  return subscription;
};

// Function to stream response from on-device generation
let onDeviceStreamingQueue: Array<() => Promise<void>> = [];
let isOnDeviceStreaming = false;
async function streamOnDevice(
  input: Array<GPTMessage>,
  callback: (output: ChatCompletionsResponse) => void,
  options?: {jsonMode: boolean} | null | undefined,
): Promise<void> {
  if (input[input.length - 1].role !== 'user') {
    throw new Error('The last message in the input should be from the user');
  }

  /*
  "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\nYou are a helpful assistant<|eot_id|>\n<|start_header_id|>user<|end_header_id|>\n\(prompt)<|eot_id|>\n<|start_header_id|>assistant<|end_header_id|>"
  * */
  const inputString = '<|begin_of_text|>' + input.map((message) => {
    if (message.role === 'system') {
      return '<|start_header_id|>system<|end_header_id|>\n' + message.content + '<|eot_id|>';
    } else if (message.role === 'user') {
      return '<|start_header_id|>user<|end_header_id|>\n' + message.content + '<|eot_id|>';
    } else if (message.role === 'assistant') {
      return '<|start_header_id|>assistant<|end_header_id|>\n' + message.content + '<|eot_id|>';
    }
  }).join('\n') + '<|start_header_id|>assistant<|end_header_id|>\n\n' //+ (options?.jsonMode ? '[' : '');

  let finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null = null; // Variable to track if we've hit a stop condition

  console.log("inputString", inputString);

  // Set up the listener for token generation
  let lastResponse = ''
  const listener = setupTokenListener((response: string) => {
    // Check if we should stop, e.g., after a certain token limit (adjust this as needed)
    if (response.length > 8000) {  // Just an arbitrary condition for demo purposes
      finishReason = 'length';
      return
    }

    // console.log("response", response);

    const delta = response.slice(lastResponse.length)
    lastResponse = response

    const event: ChatCompletionsResponse = {
      id: 'on-device-response', // Mock ID
      choices: [{
        index: 0,
        delta: {
          content: delta, // The generated text so far
          role: 'assistant', // Assuming this is always from the assistant
        },
        finish_reason: finishReason, // This would be 'stop' or another reason
      }],
      created: Date.now(),
      model: 'llama-3.2-1b', // You can change this to reflect your on-device model name
      usage: {
        completion_tokens: response.length, // Number of tokens in the response
        prompt_tokens: inputString.length, // Number of tokens in the input prompt
        total_tokens: response.length + inputString.length, // Total token usage
      },
    };

    callback(event);
  });

  // await is cleared when generation is done
  await LLMNativeModule.generateResponse(inputString);

  // Clean up listener when the generation is done
  listener.remove();

  // console.log("lastResponse", lastResponse);

  const event: ChatCompletionsResponse = {
    id: 'on-device-response', // Mock ID
    choices: [{
      index: 0,
      delta: {
        content: '', // The generated text so far
        role: 'assistant', // Assuming this is always from the assistant
      },
      finish_reason: finishReason || 'stop', // This would be 'stop' or another reason
    }],
    created: Date.now(),
    model: 'llama-3.2-1b', // You can change this to reflect your on-device model name
    usage: {
      completion_tokens: lastResponse.length, // Number of tokens in the response
      prompt_tokens: inputString.length, // Number of tokens in the input prompt
      total_tokens: lastResponse.length + inputString.length, // Total token usage
    },
  };

  callback(event);
}

export async function syncTextResponse(
  model: ModelConfig,
  input: Array<GPTMessage>,
  options?: {jsonMode: boolean} | null | undefined,
): Promise<ChatCompletionsResponse> {
  const onDeviceStreamingTask: () => Promise<ChatCompletionsResponse> = () => {
    return new Promise((resolve, reject) => {
      let buffer = ''; // To store the full response

      streamTextResponse(model, input, (output) => {
        const { choices } = output;

        // Accumulate the tokens in buffer
        buffer += choices[0]?.delta?.content || '';

        // Check if the stream has finished
        if (choices[0].finish_reason !== null) {
          // Construct the OpenAI-like API response
          const apiResponse: ChatCompletionsResponse = {
            id: output.id,
            object: 'chat.completion',
            created: output.created || Date.now(),
            model: output.model, // Update to match your on-device model
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: buffer, // Return the accumulated content
                },
                finish_reason: choices[0].finish_reason, // Indicate that the generation has finished
              },
            ],
            usage: {
              prompt_tokens: input.length,
              completion_tokens: buffer.length,
              total_tokens: input.length + buffer.length,
            },
          };

          // Resolve with the OpenAI-like response
          resolve(apiResponse);
          runNextOnDeviceStreamingTask()
        }
      }, options);
    });
  }

  if (!isOnDeviceStreaming) {
    isOnDeviceStreaming = true;
    return await onDeviceStreamingTask()
  } else {
    return new Promise((resolve) => {
      onDeviceStreamingQueue.push(async () => {
        resolve(await onDeviceStreamingTask())
      })
    })
  }
}

function runNextOnDeviceStreamingTask() {
  // Mark the current iteration as done
  isOnDeviceStreaming = false;

  // If there are more iterations queued, dequeue and run the next one
  if (onDeviceStreamingQueue.length > 0) {
    const nextTask = onDeviceStreamingQueue.shift();
    if (nextTask) {
      isOnDeviceStreaming = true;
      nextTask().catch(console.log);
    }
  }
}

// This function will handle branching between on-device and cloud streaming in the future
export function streamTextResponse(
  model: ModelConfig,
  input: Array<GPTMessage>,
  callback: (output: ChatCompletionsResponse) => void,
  options?: {jsonMode: boolean} | null,
): Promise<void> {
  return streamOnDevice(input, callback, options)
}

// Resolves when generation is complete. Use onResponse for streamed updates.
export default async function generateTextResponse(input: Array<GPTMessage>, onResponse: (response: string) => void): Promise<string> {
  try {
    // Load the model and wait for the promise to resolve
    await LLMNativeModule.loadModel();
    console.warn('Model loaded successfully!');
  } catch (error) {
    console.error('Error loading model:', error);
  }

  if (input[input.length - 1].role !== 'user') {
    throw new Error('The last message in the input should be from the user');
  }

  /*
  "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\nYou are a helpful assistant<|eot_id|>\n<|start_header_id|>user<|end_header_id|>\n\(prompt)<|eot_id|>\n<|start_header_id|>assistant<|end_header_id|>"
  * */
  const inputString = '<|begin_of_text|>' + input.map((message) => {
    if (message.role === 'system') {
      return '<|start_header_id|>system<|end_header_id|>\n' + message.content + '<|eot_id|>';
    } else if (message.role === 'user') {
      return '<|start_header_id|>user<|end_header_id|>\n' + message.content + '<|eot_id|>';
    } else if (message.role === 'assistant') {
      return '<|start_header_id|>assistant<|end_header_id|>\n' + message.content + '<|eot_id|>';
    }
  }).join('\n') + '<|start_header_id|>assistant<|end_header_id|>\n\n' //+ (options?.jsonMode ? '[' : '');

  

  // Set up the listener for token generation
  let lastResponse = ''
  const listener = setupTokenListener((response: string) => {
    lastResponse = response
    onResponse(response)
  });

  // await is cleared when generation is done
  await LLMNativeModule.generateResponse(inputString);

  listener.remove();

  console.log("inputString", inputString);
  console.log("lastResponse", lastResponse);

  return lastResponse
}