import React from 'react';
import { FlatList, View, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatItem from './ChatItem';
import { extraHeight } from './ChatHeader';
import {observer} from 'mobx-react-lite'
import { chatStore } from '../store/ChatStore';

// const data = [
//   {
//     id: '1',
//     name: 'AI',
//     content: 'Hi, how can I help you?',
//     role: 'assistant',
//   },
//   {
//     id: '2',
//     name: 'Taylor',
//     content: 'Help me organize my thoughts.',
//     role: 'user',
//   },
//   {
//     id: '3',
//     name: 'AI',
//     content: `Sure, what's on your mind?`,
//     role: 'assistant',
//   },
// ];

const ChatScrollView = observer(() => {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView 
      style={{flex: 1}} 
      behavior={'padding'}
    >
      <FlatList
        style={{
          flex: 1,
          paddingTop: safeAreaInsets.top + extraHeight,
          paddingBottom: safeAreaInsets.bottom,
          paddingLeft: safeAreaInsets.left,
          paddingRight: safeAreaInsets.right,
          // backgroundColor: 'red'
        }}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: 8 + safeAreaInsets.bottom + 50,
          paddingLeft: 16,
          paddingRight: 16,
        }}
        data={chatStore.messages}
        extraData={chatStore.messages.map(message => message.content)}
        renderItem={({ item }) => {
          return (
            <ChatItem name={item.name} content={item.content} role={item.role} />
          )
        }}
        keyExtractor={item => item.messageId.toString()}
      />
    </KeyboardAvoidingView>
  );
});

export default ChatScrollView;
