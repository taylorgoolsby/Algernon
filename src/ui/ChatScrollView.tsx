import React, { useRef, useEffect } from 'react'
import { KeyboardAvoidingView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ChatItem from './ChatItem'
import { extraHeight } from './ChatHeader'
import { observer } from 'mobx-react-lite'
import { chatStore } from '../store/ChatStore'
import VirtualizedList, { VirtualizedListHandle } from './VirtualizedList'
import { MessageRole } from '../schema/Message/MessageSchema'

const ChatScrollView = observer(() => {
  const safeAreaInsets = useSafeAreaInsets()

  const listRef = useRef<VirtualizedListHandle>(null)
  const prevData = useRef<ReadonlyArray<string> | null>(null)

  const data = chatStore.searchMode
    ? chatStore.searchResultMessageIds
    : chatStore.displayedMessageIds

  // Following new content while at the bottom is handled by the list itself.
  // The one case it can't know about: when the user posts a message, always
  // jump to the bottom, even if they had scrolled up.
  useEffect(() => {
    const prev = prevData.current
    prevData.current = data
    if (!prev || prev.length === 0 || chatStore.searchMode) return
    if (data.length <= prev.length) return
    const lastId = data[data.length - 1]
    if (lastId === prev[prev.length - 1]) return
    if (chatStore.messages[lastId]?.role === MessageRole.USER) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [data])

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <VirtualizedList
        ref={listRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: safeAreaInsets.top + extraHeight + 8,
          paddingBottom: 8 + safeAreaInsets.bottom + 50,
          paddingLeft: 16 + safeAreaInsets.left,
          paddingRight: 16 + safeAreaInsets.right,
        }}
        data={data}
        extraData={data.map(id => chatStore.messages[id]?.text)}
        renderItem={({ item }) => (
          <ChatItem message={chatStore.messages[item]} />
        )}
        keyExtractor={item => item}
      />
    </KeyboardAvoidingView>
  )
})

export default ChatScrollView