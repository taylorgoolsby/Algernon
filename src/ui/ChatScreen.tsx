// @flow

import React from 'react'
import {
  StyleSheet,
  View
} from 'react-native'
import ChatScrollView from './ChatScrollView'
import ChatHeader from './ChatHeader'
import ChatFooter from './ChatFooter'

const ChatScreen: any = () => {
  return (
    <View style={styles.container}>
      <ChatScrollView/>
      <ChatHeader/>
      <ChatFooter/>      
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black'
  }
})

export default ChatScreen
