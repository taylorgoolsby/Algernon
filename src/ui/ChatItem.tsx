import React, { useState } from 'react';
import { StyleSheet, View, Dimensions, TouchableOpacity } from 'react-native';
import Colors, {
  userChat,
  aiChat,
  userText,
  aiText,
  userText2Active,
  userText2,
  aiText2Active,
  aiText2,
} from './Colors';
import Text from './Text';
import Markdown from 'react-native-markdown-display';
import ProfilePic from './ProfilePic';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import Spinner from './Spinner';
import type { Message } from '../store/ChatStore';

const screenWidth = Dimensions.get('window').width;

type ChatItemProps = {
  message: Message
};

const ChatItem = (props: ChatItemProps) => {
  const { name, content, role } = props.message;

  return (
    <View
      style={[
        styles.container,
        role === 'assistant' ? styles.assistant : styles.user,
      ]}
    >
      <ProfileRow {...props} />
      <Message {...props} />
      <Controls {...props} />
    </View>
  );
};

const ProfileRow = (props: ChatItemProps) => {
  const { name, content, role, messageId } = props.message;

  return (
    <View style={styles.profileRow}>
      <ProfilePic message={{ role, messageId }} />
      <Text
        style={role === 'assistant' ? styles.assistantText : styles.userText}
      >
        {name}
      </Text>
    </View>
  );
};

const Message = (props: ChatItemProps) => {
  const { name, content, role } = props.message;

  return !!content ? (
    <View style={{
      marginTop: -8,
      marginBottom: -8,
      marginLeft: 2
    }}>
      <Markdown
        style={{
          body: { color: 'white', fontFamily: Colors.fontFamily, fontWeight: Colors.fontWeight },
        }}
      >
        {content.trim()}
      </Markdown>
    </View>
  ) : (
    <Spinner />
  );
};

const Controls = (props: ChatItemProps) => {
  const { name, content, role } = props.message;

  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <View style={styles.controls}>
      <TouchableOpacity
        style={{
          width: 32,
          height: 32,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: -5,
          marginBottom: -5,
          // backgroundColor: 'red'
        }}
      >
        <Ionicons
          name={'close-outline'}
          size={18}
          color={
            role === 'user'
              ? isConfirming
                ? userText2Active
                : userText2
              : isConfirming
              ? aiText2Active
              : aiText2
          }
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 8,
  },
  assistant: {
    backgroundColor: aiChat,
  },
  user: {
    alignSelf: 'flex-end',
    backgroundColor: userChat,
    borderRadius: 24,
    minWidth: 40,
    maxWidth: screenWidth * 0.74,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  assistantText: {
    color: aiText,
    marginLeft: 2,
  },
  userText: {
    color: userText,
    marginLeft: 2,
    marginRight: 7,
  },
  controls: {
    height: 26,
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
});

export default ChatItem;
