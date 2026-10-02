import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from '@react-native-community/blur';
import Colors, { footerActive, footerInactive } from '../Colors';
import { chatStore } from '../store/ChatStore';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import MicButton from './MicButton';

const screenWidth = Dimensions.get('window').width;

const ChatFooter = () => {
  const [searchMode, setSearchMode] = useState(false);

  const safeAreaInsets = useSafeAreaInsets();

  const [value, setValue] = useState('');
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const handleTranscriptionComplete = (text: string) => {
    setValue(text);
    inputRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          height: 50 + safeAreaInsets.bottom,
        },
      ]}
      behavior={'position'}
      keyboardVerticalOffset={-safeAreaInsets.bottom}
    >
      <BlurView
        style={{
          flex: 1,
          alignSelf: 'stretch',
          width: screenWidth,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity>
            <Ionicons
              style={{
                marginTop: 0,
                marginLeft: 23,
              }}
              name={'search-circle'}
              size={28}
              color={footerInactive}
            />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={searchMode ? 'Search' : 'Message'}
            placeholderTextColor={Colors.sendIconDisabledBg}
            returnKeyType="done"
            value={value}
            onChangeText={setValue}
            onSubmitEditing={({ nativeEvent }) => {
              const text = nativeEvent.text;
              chatStore.submitMessage(text);
              setValue('');
            }}
          />
          <MicButton onTranscriptionComplete={handleTranscriptionComplete} />
        </View>
      </BlurView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    flexDirection: 'row',
  },
  input: {
    flex: 1,
    height: 50,
    color: Colors.inputText,
    paddingTop: 0,
    marginLeft: 8,
    marginRight: 8,
    letterSpacing: Colors.letterSpacing,
    fontSize: Colors.fontSize,
    fontFamily: Colors.fontFamily,
    fontWeight: '300',
  },
});

export default ChatFooter;