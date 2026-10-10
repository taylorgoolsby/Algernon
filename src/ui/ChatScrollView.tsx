import React, { useRef } from 'react'
import { FlatList, KeyboardAvoidingView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ChatItem from './ChatItem'
import { extraHeight } from './ChatHeader'
import { observer } from 'mobx-react-lite'
import { chatStore } from '../store/ChatStore'

const ChatScrollView = observer(() => {
  const safeAreaInsets = useSafeAreaInsets()
  const listRef = useRef<FlatList>(null)

  const data = chatStore.searchMode
    ? chatStore.searchResultMessageIds
    : chatStore.displayedMessageIds

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <FlatList
        ref={listRef}
        style={{
          flex: 1,
          paddingTop: safeAreaInsets.top + extraHeight,
          paddingBottom: safeAreaInsets.bottom,
          paddingLeft: safeAreaInsets.left,
          paddingRight: safeAreaInsets.right,
        }}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: 8 + safeAreaInsets.bottom + 50,
          paddingLeft: 16,
          paddingRight: 16,
        }}
        data={data}
        extraData={data.map(id => chatStore.messages[id]?.text)}
        renderItem={({ item }) => (
          <ChatItem message={chatStore.messages[item]} />
        )}
        keyExtractor={item => item}
        onContentSizeChange={() => {
          listRef.current?.scrollToOffset({
            offset: Number.MAX_SAFE_INTEGER,
            animated: true,
          })
        }}
      />
    </KeyboardAvoidingView>
  )
})

export default ChatScrollView
