import {makeAutoObservable, observable, action} from 'mobx'
import type { MessageSQL } from "../schema/Message/MessageSchema";
import type { AppendMessageOutput } from "../types/AppendMessageOutput";
import type { UpdateMessageOutput } from "../types/UpdateMessageOutput";
import MessageInterface from "../schema/Message/MessageInterface";
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import debounce from 'lodash.debounce'
import Colors from "../Colors";
// import LongTermAnnotation from "../agent/LongTermAnnotation";
import ChatIteration from "../agent/ChatIteration";
import preferencesStore from "./PreferencesStore";
import { NativeEventEmitter, NativeModules } from 'react-native';

const { LLMNativeModule } = NativeModules

// export type Message = {
//   messageId: number;
//   content: string;
//   role: string;
//   name: string;
// };

const INITIAL_LIMIT = 12
let limit = INITIAL_LIMIT

class ChatStore {
  static isModelLoaded: boolean = false

  loaded: boolean = false
  windowId: number = 0
  offset: number = 0
  completedOffsets: {[key: string]: boolean} = {}
  displayedMessageIds: Array<string> = []
  messages: {[messageId: string]: MessageSQL | null | undefined} = {}

  constructor() {
    makeAutoObservable(this);

    // this.messages.push({
    //   messageId: this.messages.length,
    //   content: 'Hi, how can I help you?',
    //   role: 'assistant',
    //   name: 'Algernon',
    // });

    this.fetchEarlierMessages = debounce(this.fetchEarlierMessages, 250, {leading: true, trailing: false}).bind(this)

    // Wait 2 frames before updating the screen.
    // This allows other events to be handled while a message is updating.
    this.updateMessage = debounce(this.updateMessage, 16).bind(this)
    // The ultimate answer to life everything and the universe is 42,
    // so we debounce the haptic feedback to 42ms.
    // This is the frequency at which cats purr.
    // $FlowFixMe
    this.hapticFeedback = debounce(this.hapticFeedback, 42, {leading: true, trailing: false, maxWait: 42}).bind(this)
  }

  // Function to load the model asynchronously
  static async loadModel() {
    if (ChatStore.isModelLoaded) {
      return
    } else {
      ChatStore.isModelLoaded = true
    }

    try {
      // Load the model and wait for the promise to resolve
      await LLMNativeModule.loadModel();
      console.log('Model loaded successfully!');
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  async load() {
    await ChatStore.loadModel();

    limit = INITIAL_LIMIT
    const lastMessage = await MessageInterface.getLast(this.windowId)
    if (!lastMessage) return
    this.offset = lastMessage.messageId // this offset will return nothing.
    this.offset -= limit // now the return from this offset will include the last message.
    if (this.offset < 0) {
      limit = limit + this.offset
      this.offset = 0
    }

    this.completedOffsets = {}
    // $FlowFixMe
    this.completedOffsets[this.offset.toString()] = true

    const messages = await MessageInterface.getOffsetLimit(this.windowId, this.offset, limit)
    this.setDisplayedMessageIds(messages.map(message => message.messageId.toString()))
    this.messages = {}
    for (const message of messages) {
      // $FlowFixMe
      this.messages[message.messageId.toString()] = message
    }
    this.loaded = true
  }

  setDisplayedMessageIds = (displayedMessageIds: Array<string>) => {
    this.displayedMessageIds = displayedMessageIds
  }

  submitMessage: (input: string) => Promise<void> = async (input: string) => {
    await ChatIteration.queueIteration(
      chatStore.windowId,
      preferencesStore.selectedModel,
      input.trim(),
      output => {
        chatStore.appendMessage(output)
      },
      output => {
        chatStore.updateMessage(output)
      },
      error => {
        console.error(error)
      },
    )
  }

  // messageId of the user message to regenerate off of.
  regenerateResponse = async (messageId: string) => {
    const message = this.messages[messageId]
    if (!message) return
    await ChatIteration.queueRegeneration(
      chatStore.windowId,
      preferencesStore.selectedModel,
      message,
      output => {
        chatStore.appendMessage(output)
      },
      output => {
        chatStore.updateMessage(output)
      },
      error => {
        console.error(error)
      },
    )
  }

  appendMessage: (output: AppendMessageOutput) => void = (output: AppendMessageOutput) => {
    this.displayedMessageIds = [...this.displayedMessageIds, output.message.messageId.toString()]
    this.messages[output.message.messageId.toString()] = output.message
    this.hapticFeedback()
  }

  updateMessage: (output: UpdateMessageOutput) => void = (output: UpdateMessageOutput) => {
    this.messages[output.message.messageId.toString()] = output.message
    setTimeout(() => {
      this.hapticFeedback()
    }, 0)
  }

  hapticFeedback() {
    ReactNativeHapticFeedback.trigger("soft", {
      enableVibrateFallback: false,
    });
  }

  fetchEarlierMessages: () => Promise<void> = async (): Promise<void> => {
    this.offset -= limit
    if (this.offset < 0) {
      limit = limit + this.offset
      this.offset = 0
    }

    if (this.completedOffsets[this.offset.toString()]) {
      return
    }
    this.completedOffsets[this.offset.toString()] = true

    const messages = await MessageInterface.getOffsetLimit(this.windowId, this.offset, limit)
    this.displayedMessageIds = [...messages.map(message => message.messageId.toString()), ...this.displayedMessageIds]
    for (const message of messages) {
      // $FlowFixMe
      this.messages[message.messageId.toString()] = message
    }
  }

  // await chatStore.deleteMessage(message.messageId)
  deleteMessage: (messageId: number) => Promise<void> = async (messageId: number): Promise<void> => {
    // todo: delete annotations from faiss
    await MessageInterface.softDelete(messageId)
    const message = await MessageInterface.get(this.windowId, messageId)
    // $FlowFixMe
    this.messages[messageId.toString()] = null
    this.displayedMessageIds = this.displayedMessageIds.filter(id => id !== messageId.toString())
  }

//   onSubmit(text: string, role: string) {
//     (async () => {
//       const sendToLLM = [
//         {
//           role: 'system',
//           content: `Speak with deep process and light output. Do not rush toward the first plausible response. Let initial thoughts remain provisional, and briefly explore whether there is a clearer or better formulation before responding.

// Prefer the simplest response that preserves the important insight. Treat brevity as a feature, not a constraint. Use short sentences and keep one idea per sentence. Avoid unnecessary explanations, qualifications, and repetition, but never sacrifice substance merely to be brief.

// When deeper reasoning leads to a complex insight, compress it into a simple final expression. Think expansively when necessary, but write minimally when possible.

// The response should feel natural and considered, not like a transcript of the reasoning that produced it.

// Explore internally. Compress externally.`,
//         },
//       ];
//       for (
//         let i = Math.max(this.messages.length - 10, 0);
//         i < this.messages.length;
//         i++
//       ) {
//         sendToLLM.push({
//           role: this.messages[i].role,
//           content: this.messages[i].content,
//         });
//       }
//       sendToLLM.push({ role: 'user', content: text });

//       console.log(sendToLLM);

//       this.messages.push({
//         messageId: this.messages.length,
//         content: text,
//         role,
//         name: 'Taylor',
//       });
//       const aiMessageId = this.messages.length;
//       this.messages.push({
//         messageId: aiMessageId,
//         content: '',
//         role: 'assistant',
//         name: 'Algernon',
//       });

//       const completeResponse = await generateTextResponse(
//         sendToLLM,
//         streamingResponse => {
//           console.log('streaming response', streamingResponse);
//           this.messages[aiMessageId].content = streamingResponse;
//           // setLastResponse(response);
//         },
//       );
//       console.log('complete response', completeResponse);
//       console.log(
//         'this.messages[aiMessageId].content',
//         this.messages[aiMessageId].content,
//       );
//     })();
//   }
}

export const chatStore = new ChatStore();
