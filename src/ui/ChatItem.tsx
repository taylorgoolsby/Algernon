import React, { useState } from 'react';

import {
  StyleSheet,
  View,
  Dimensions,
  TouchableOpacity,
  Alert,
  Text as RNText,
} from 'react-native';

import Colors, {
  userChat,
  aiChat,
  userText,
  aiText,
  userText2Active,
  userText2,
  aiText2Active,
  aiText2,
} from '../Colors';

import Text from './Text';
import Markdown from 'react-native-markdown-display';
import ProfilePic from './ProfilePic';
import { Ionicons } from '@react-native-vector-icons/ionicons/static';
import Spinner from './Spinner';

import {
  MessageRole,
  type MessageSQL,
} from '../schema/Message/MessageSchema';

import { chatStore } from '../store/ChatStore';

const screenWidth = Dimensions.get('window').width;

type ChatItemProps = {
  message: MessageSQL | null | undefined;
};

const ChatItem = (props: ChatItemProps) => {
  if (!props.message) return;

  const { role } = props.message;

  return (
    <View
      style={[
        styles.container,
        role === MessageRole.ASSISTANT ? styles.assistant : styles.user,
      ]}
    >
      <ProfileRow {...props} />
      <Message {...props} />
      <Controls {...props} />
    </View>
  );
};

const ProfileRow = (props: ChatItemProps) => {
  if (!props.message) return;

  const { role } = props.message;

  const name =
    role === MessageRole.ASSISTANT ? 'Algernon' : 'Taylor';

  return (
    <View style={styles.profileRow}>
      <ProfilePic message={props.message} />

      <Text
        style={
          role === MessageRole.ASSISTANT
            ? styles.assistantText
            : styles.userText
        }
      >
        {name}
      </Text>
    </View>
  );
};

const Message = (props: ChatItemProps) => {
  if (!props.message) return;

  const { text } = props.message;

  let content = text;

  try {
    // TODO:
    // For some reason the DB returns \\n even though it inserts \n.
    // Here we parse it if possible just in case.
    content = JSON.parse(`"${text}"`);
  } catch (error) {
    // console.error(error)
  }

  const rules = {
    text: (
      node: any,
      children: any,
      parent: any,
      styles: any,
      inheritedStyles = {},
    ) => (
      <RNText
        key={node.key}
        style={[inheritedStyles, styles.text]}
        selectable={true}
      >
        {node.content}
      </RNText>
    ),

    textgroup: (
      node: any,
      children: any,
      parent: any,
      styles: any,
    ) => (
      <RNText
        key={node.key}
        style={styles.textgroup}
        selectable={true}
      >
        {children}
      </RNText>
    ),
  };

  return !!text ? (
    <View
      style={{
        marginTop: -8,
        marginBottom: -8,
        marginLeft: 2,
      }}
    >
      <Markdown
        rules={rules}
        style={{
          body: {
            color: 'white',
            fontFamily: Colors.fontFamily,
            fontWeight: Colors.fontWeight,
          },
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
  // Hooks must run before any early return
  const [isConfirming, setIsConfirming] = useState(false);

  if (!props.message) return null;

  const { role, messageId } = props.message;

  const handleDelete = () => {
    setIsConfirming(true);

    Alert.alert(
      'Delete message?',
      'This message will be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setIsConfirming(false),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setIsConfirming(false);
            chatStore.deleteMessage(messageId);
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => setIsConfirming(false),
      },
    );
  };

  const isLast =
    chatStore.displayedMessageIds[
      chatStore.displayedMessageIds.length - 1
    ] === messageId.toString();

  return (
    <View style={styles.controls}>
      {role === MessageRole.USER && isLast ? (
        <TouchableOpacity
          onPress={() =>
            chatStore.regenerateResponse(messageId.toString())
          }
          style={{
            width: 32,
            height: 32,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: -5,
            marginBottom: -5,
          }}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={role === MessageRole.USER ? userText2 : aiText2}
          />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={handleDelete}
        style={{
          width: 32,
          height: 32,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: -5,
          marginBottom: -5,
        }}
      >
        <Ionicons
          name="close-outline"
          size={18}
          color={
            role === MessageRole.USER
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