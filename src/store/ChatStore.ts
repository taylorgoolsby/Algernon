import { makeAutoObservable } from 'mobx';
import generateTextResponse from '../agent/generateTextResponse';
// import {NativeModules} from 'react-native'

// const { TextFeatureExtractor } = NativeModules

type Message = {
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
          { role: 'system', content: 'You are a helpful assistant.' },
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
