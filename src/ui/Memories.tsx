import React from 'react'
import { View, Dimensions } from 'react-native'
import PlotView from './PlotView'

const screenWidth = Dimensions.get('window').width


export default function Memories() {
  return (
    <View
      style={{
        flex: 1,
        alignSelf: 'stretch',
        backgroundColor: 'black',
      }}
    >
      <PlotView
        style={{
          width: screenWidth,
          height: screenWidth,
        }}
      />
    </View>
  )
}
