import { makeAutoObservable } from 'mobx';
import generateTextResponse from '../agent/generateTextResponse';
// import {NativeModules} from 'react-native'

// const { TextFeatureExtractor } = NativeModules

export type Message = {
  messageId: number;
  content: string;
  role: string;
  name: string;
};

class ChatStore {
  messages: Array<Message> = [];

  constructor() {
    makeAutoObservable(this);

    this.messages.push({
      messageId: this.messages.length,
      content: 'Hi, how can I help you?',
      role: 'assistant',
      name: 'Algernon',
    });
  }

  onSubmit(text: string, role: string) {
    this.messages.push({
      messageId: this.messages.length,
      content: text,
      role,
      name: 'Taylor',
    });
    const aiMessageId = this.messages.length
    this.messages.push({
      messageId: aiMessageId,
      content: '',
      role: 'assistant',
      name: 'Algernon',
    });

    (async () => {
      const completeResponse = await generateTextResponse(
        [
          { role: 'system', content: `Speak with deep process and light output. Do not rush toward the first plausible response. Let initial thoughts remain provisional, and briefly explore whether there is a clearer or better formulation before responding.

Prefer the simplest response that preserves the important insight. Treat brevity as a feature, not a constraint. Use short sentences and keep one idea per sentence. Avoid unnecessary explanations, qualifications, and repetition, but never sacrifice substance merely to be brief.

When deeper reasoning leads to a complex insight, compress it into a simple final expression. Think expansively when necessary, but write minimally when possible.

The response should feel natural and considered, not like a transcript of the reasoning that produced it.

Explore internally. Compress externally.` },
          { role: 'user', content: text },
        ],
        streamingResponse => {
          console.log('streaming response', streamingResponse);
          this.messages[aiMessageId].content = streamingResponse
          // setLastResponse(response);
        },
      );
      console.log('complete response', completeResponse);
      console.log('this.messages[aiMessageId].content', this.messages[aiMessageId].content)
    })();
  }
}

export const chatStore = new ChatStore();
