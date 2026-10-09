import React from "react";
import { View } from 'react-native';
import Text from './Text';

export default function DatabaseExplorer() {
  return (
    <View style={{ flex: 1, backgroundColor: 'white', padding: 25 }}>
      <Text style={{color: 'black'}}>Database Explorer</Text>
    </View>
  )
}