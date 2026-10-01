// @flow

import axios from 'axios';
import parseAxiosError from '../utils/parseAxiosError.js';
import type { GPTMessage } from '../types/GPTMessage.js';
import type { ChatCompletionsResponse } from '../types/ChatCompletion.js';
import type { ModelConfig } from '../types/ModelConfig.js';
import EventSource from '../react-native-sse';

// ordering matters here
// default model is the first one.
export const standardModels = [
  'gpt-3.5-turbo-1106',
  'gpt-4-1106-preview',
  // 'gpt-3.5-turbo',
  // 'gpt-4',
];

export default class InferenceRest {
  static async chatCompletion(
    model: ModelConfig,
    messages: Array<GPTMessage>,
  ): Promise<ChatCompletionsResponse> {
    const apiBase = model.apiBase;
    const apiKey = model.apiKey;

    if (!apiBase) {
      throw new Error('apiBase is required');
    }

    const url = getUrl(apiBase);
    const headers = getHeaders(apiBase, apiKey);
    const data = getBody(apiBase, messages, model.completionOptions, false);

    let res = await send(url, data, headers);

    if (res.error) {
      if (res.error instanceof Error) {
        throw res.error;
      } else {
        throw new Error(res.error);
      }
    }

    if (apiBase === 'https://api.anthropic.com') {
      const content: string = res.content
        .map(
          // @ts-ignore
          block => (block.type === 'text' ? block.text : ''),
        )
        .join('\n\n');
      return {
        choices: [
          {
            message: {
              content,
              role: 'assistant',
            },
            // todo: handle all cases
            finish_reason: res.stop_reason === 'end_turn' ? 'stop' : 'length',
          },
        ],
      };
    } else {
      return res;
    }
  }

  static relayChatCompletionStream(
    model: ModelConfig,
    messages: Array<GPTMessage>,
    onData: (data: ChatCompletionsResponse) => any,
    onError: (err: Error) => any,
  ): void {
    const apiBase = model.apiBase;
    const apiKey = model.apiKey;

    if (!apiBase) {
      throw new Error('apiBase is required');
    }

    const url = getUrl(apiBase);
    const headers = getHeaders(apiBase, apiKey);
    const data = getBody(apiBase, messages, model.completionOptions, true);

    const es = new EventSource(url, {
      headers,
      method: 'POST',
      body: JSON.stringify(data),
      pollingInterval: 25000,
    });

    let buffer = '';
    let dataLog: any = [];
    const listener = (event: any) => {
      const data = event.data;

      if (data === undefined) return;

      dataLog.push(data);

      buffer += data;

      const items = buffer.split('\n\n');

      for (let i = 0; i < items.length; i++) {
        let item = items[i];

        // item might end with 0, 1, or 2 new lines.
        // So the next item might start with 2, 1, or 0 new lines.
        // Remove any newlines at the beginning:
        item = item.replace(/^\n+/, '');

        if (item === '') continue;

        if (/^data: \[DONE\]/.test(item)) {
          buffer = items.slice(i + 1).join('\n\n');
          es.close();
          return;
        }

        let parsedPayload;
        try {
          parsedPayload = JSON.parse(item.replace(/^data: /, ''));
        } catch (err) {
          buffer = items.slice(i).join('\n\n');
          return;
        }

        try {
          onData(parsedPayload);
        } catch (err) {
          console.error(err);
        }
      }
      // All items in the array have been processed, so clear the buffer.
      // Equivalent to items.slice(items.length).join('\n\n')
      buffer = '';
    };

    const anthropicListener = (event: any) => {
      const data = event.data;

      if (data === undefined) return;

      dataLog.push(data);

      buffer += data;

      const items = buffer.split('\n\n');

      for (let i = 0; i < items.length; i++) {
        let item = items[i];

        // item might end with 0, 1, or 2 new lines.
        // So the next item might start with 2, 1, or 0 new lines.
        // Remove any newlines at the beginning:
        item = item.replace(/^\n+/, '');

        if (item === '') continue;

        const eventPart = item.match(/^event: (.*)\n/)?.[1];
        const dataPart = item.match(/\ndata: (.*)$/)?.[1];

        if (!eventPart || !dataPart) continue;

        console.log('eventPart', eventPart);
        if (eventPart === 'message_stop') {
          buffer = items.slice(i + 1).join('\n\n');
          es.close();
          return;
        }

        let parsedPayload;
        try {
          parsedPayload = JSON.parse(dataPart);
          console.log('parsedPayload', parsedPayload);
        } catch (err) {
          buffer = items.slice(i).join('\n\n');
          return;
        }

        try {
          onData(parsedPayload);
        } catch (err) {
          console.error(err);
        }
      }
      // All items in the array have been processed, so clear the buffer.
      // Equivalent to items.slice(items.length).join('\n\n')
      buffer = '';
    };

    const closeListener = (event: any) => {
      if (event.type === 'error') {
        console.error('Connection error:', event.message);
        es.close();
        onError(new Error(event.message));
      } else if (event.type === 'exception') {
        console.error('Error:', event.message, event.error);
        onError(event.error);
        es.close();
      } else if (event.type === 'close') {
        console.log('closed third party');
      }
      if (buffer) {
        console.debug(dataLog);
        console.debug(buffer);
        console.error(new Error('buffer is not empty'));
        onError(new Error('buffer is not empty'));
      }
    };

    // Add listener
    es.addEventListener('open', () => console.log('Open SSE connection.'));
    es.addEventListener(
      // @ts-ignore
      'data',
      apiBase === 'https://api.anthropic.com' ? anthropicListener : listener,
    );
    es.addEventListener('error', closeListener);
    es.addEventListener('close', closeListener);
  }
}

function makeRequestWithRetry(
  call: () => Promise<any>,
  retries: number,
): Promise<any> {
  console.log('retries', retries);
  return call().catch(error => {
    console.error(error.message);
    if (retries > 0) {
      console.log(`Retrying... Attempts left: ${retries - 1}`);
      return makeRequestWithRetry(call, retries - 1);
    }
    return Promise.reject(error);
  });
}

function getHeaders(
  apiBase: string,
  apiKey: string | null | undefined,
): { [key: string]: string } {
  let headers: { [key: string]: string } = {};
  if (apiKey) {
    headers = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      if (apiBase === 'https://api.openai.com') {
        // $FlowFixMe
        headers['Authorization'] = `Bearer ${apiKey}`;
      } else if (apiBase === 'https://api.anthropic.com') {
        // $FlowFixMe
        headers['x-api-key'] = apiKey;
        // $FlowFixMe
        headers['anthropic-version'] = '2023-06-01';
      } else if (apiBase === 'https://api.mistral.ai') {
        // $FlowFixMe
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }
  }

  return headers;
}

function getUrl(apiBase: string): string {
  if (apiBase === 'https://api.openai.com') {
    return 'https://api.openai.com/v1/chat/completions';
  } else if (apiBase === 'https://api.anthropic.com') {
    return `https://api.anthropic.com/v1/messages`;
  } else if (apiBase === 'https://api.mistral.ai') {
    return 'https://api.mistral.ai/v1/chat/completions';
  } else {
    return `${apiBase}/v1/chat/completions`;
  }
}

function getBody(
  apiBase: string,
  messages: Array<GPTMessage>,
  completionOptions: { [key: string]: any } | null | undefined,
  stream: boolean,
): any {
  if (apiBase === 'https://api.openai.com') {
    return {
      ...completionOptions,
      messages,
      stream,
    };
  } else if (apiBase === 'https://api.anthropic.com') {
    const systemMessages =
      messages?.filter(message => message.role === 'system') ?? [];
    const nonSystemMessages =
      messages?.filter(message => message.role !== 'system') ?? [];

    const system =
      systemMessages.map(message => message.content)?.join('\n\n') ?? '';

    return {
      ...completionOptions,
      system,
      messages: nonSystemMessages,
      max_tokens: 4000,
      stream,
    };
  } else if (apiBase === 'https://api.mistral.ai') {
    return {
      ...completionOptions,
      messages,
      stream,
    };
  } else {
    return {
      ...completionOptions,
      messages,
      stream,
    };
  }
}

async function send(
  url: string,
  data: { [key: string]: any },
  headers: { [key: string]: any },
): Promise<any> {
  const config: any = {
    method: 'POST',
    url,
    data,
    headers,
    timeout: 10000,
  };

  // if (authToken) {
  //   config.headers = {
  //     Authorization: `Bearer ${authToken}`,
  //   }
  // }
  //
  // if (method === 'GET') {
  //   // $FlowFixMe
  //   config.params = data
  // } else if (method === 'POST') {
  //   // $FlowFixMe
  //   config.data = data
  // }

  // console.debug(
  //   `Sending ${method} request to ${url}`,
  // )

  // $FlowFixMe
  // config.timeout = 10000

  const res = await makeRequestWithRetry(
    () =>
      axios(config)
        .then(response => {
          return response.data;
        })
        .catch(err => {
          // parseAxiosError will throw when a connection cannot be established.
          return parseAxiosError(err);
        })
        .then(response => {
          if (response.error) {
            throw new Error(response.error.message);
          } else {
            return response;
          }
        }),
    3,
  ).catch(err => {
    console.error(err);
    return {
      error: err,
    };
  });
  return res;
}

export function canUseJSON(model: string): boolean {
  return model === 'gpt-4-1106-preview' || model === 'gpt-3.5-turbo-1106';
}

function normalizeAnthropicOutputs(data: any): any {
  /*
  Examples of anthropic outputs:

  {"delta": {"stop_reason": "end_turn", "stop_sequence": null}, "type": "message_delta", "usage": {"output_tokens": "[REDACTED]"}}

  {
    "id": "string",
    "content": [
      {
        "text": "string"
      },
      {
        "id": "string",
        "name": "string",
        "input": {}
      }
    ],
    "model": "string",
    "stop_reason": "end_turn",
    "stop_sequence": "string",
    "usage": {
      "input_tokens": 0,
      "output_tokens": 0
    }
  }
  * */
}
