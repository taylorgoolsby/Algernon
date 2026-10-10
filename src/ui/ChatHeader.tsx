// ChatHeader.tsx
import React from 'react'
import { StyleSheet, TouchableOpacity, View, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from '@react-native-community/blur'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@react-native-vector-icons/ionicons/static'
import Text from './Text'

const { width } = Dimensions.get('window')

export const extraHeight = 31

const ChatHeader = () => {
  const safeAreaInsets = useSafeAreaInsets()
  const navigation = useNavigation()

  return (
    <BlurView
      style={[
        styles.container,
        {
          height: safeAreaInsets.top + extraHeight,
          // paddingTop: safeAreaInsets.top
        },
      ]}
    >
      <View
        style={{
          paddingTop: safeAreaInsets.top,
          flexDirection: 'row',
          alignItems: 'flex-end',
          alignSelf: 'stretch',
          width: width,
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings' as never)}
          style={{
            paddingLeft: 25,
            paddingRight: 25,
            paddingBottom: extraHeight - 19,
            // backgroundColor: 'red'
          }}
        >
          <View
            style={{
              width: 7,
              height: 19,
              backgroundColor: 'white',
            }}
          />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          onPress={() => navigation.navigate('Memories' as never)}
          style={{
            paddingLeft: 25,
            paddingRight: 25,
            paddingBottom: extraHeight - 22,
          }}
        >
          <Ionicons
            name={'sparkles'}
            size={20}
            color={'white'}
          />
        </TouchableOpacity>
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
  },
})

export default ChatHeader
