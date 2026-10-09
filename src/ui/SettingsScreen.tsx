import React from 'react';
import { View } from 'react-native';
import Text from './Text';

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: 'white', padding: 25 }}>
      <Text>Settings</Text>
    </View>
  );
}