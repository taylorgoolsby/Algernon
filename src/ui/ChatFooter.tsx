
import React, { useState } from 'react'
import {View, TextInput, StyleSheet, KeyboardAvoidingView, Dimensions, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {BlurView} from '@react-native-community/blur'
import Colors from './Colors'
import { chatStore } from '../store/ChatStore';

const screenWidth = Dimensions.get('window').width

const ChatFooter = () => {
  const [searchMode, setSearchMode] = useState(false)

  const safeAreaInsets = useSafeAreaInsets();

  const [value, setValue] = useState('')

  return (
    <KeyboardAvoidingView 
      style={[styles.container, {
        height: 50 + safeAreaInsets.bottom
      }]} 
      behavior={'position'}
    >
    <BlurView style={{
      flex: 1,
      alignSelf: 'stretch',
      width: screenWidth,
      flexDirection: 'row'
    }}>
      <TextInput 
        style={styles.input}
        placeholder={searchMode ? 'Search' : 'Message'}
        placeholderTextColor={Colors.sendIconDisabledBg}
        returnKeyType="done"
        value={value}
        onChangeText={setValue}
        onSubmitEditing={({ nativeEvent }) => {
          const text = nativeEvent.text;
          chatStore.onSubmit(text, 'user')
          setValue('')
          
        }}
      />
    </BlurView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    flexDirection: 'row',
    // backgroundColor: 'blue',
    // width: 50,
  },
  input: {
    flex: 1,
    height: 50,
    // alignSelf: 'stretch',
    color: Colors.inputText,
    // backgroundColor: 'pink',
    paddingTop: 0,
    marginLeft: 8,
    marginRight: 8,
    letterSpacing: Colors.letterSpacing,
    fontSize: Colors.fontSize,
    fontFamily: Colors.fontFamily,
    fontWeight: '300',

  }
})

export default ChatFooter