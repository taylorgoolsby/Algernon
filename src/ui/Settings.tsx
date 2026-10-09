import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Text from './Text';
import Colors from '../Colors';

export default function Settings() {
  const navigation = useNavigation();

  return (
    <View style={{ flex: 1, backgroundColor: 'white', padding: 25 }}>
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: 'black' }}>Database Explorer</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Explorer' as never)}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              paddingLeft: 8,
              paddingRight: 8,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: 'rgba(0, 0, 0, 0.75)',
            }}
          >
            <Text style={{ color: 'black' }}>View Databases</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
