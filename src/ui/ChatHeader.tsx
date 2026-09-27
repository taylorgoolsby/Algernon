
import React from 'react'
import {StyleSheet, View} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {BlurView} from '@react-native-community/blur'
import Text from './Text'

export const extraHeight = 31

const ChatHeader = () => {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <BlurView style={[styles.container, 
      {
        height: safeAreaInsets.top + extraHeight,
        // paddingTop: safeAreaInsets.top
      }
    ]}>
      <View style={{
        paddingTop: safeAreaInsets.top
      }}>
        {/* <Text>{safeAreaInsets.top}</Text> */}
      </View>
    </BlurView>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 1,
    flexDirection: 'row',
    // backgroundColor: 'blue',
    // width: 50,
    // height: 90
  }
})

export default ChatHeader