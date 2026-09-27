/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import {useEffect, useState} from 'react'
import { NativeEventEmitter, StatusBar, StyleSheet, useColorScheme, View, Button } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import generateTextResponse from '../agent/generateTextResponse';
import Text from './Text'
import {NativeModules} from 'react-native'

const { TextFeatureExtractor } = NativeModules

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  const handlePress = async () => {
    try {
//       const result = await TextFeatureExtractor.chunkText(`I went to the beach yesterday.
// The weather was warm and sunny.
// I swam in the ocean for an hour.

// When I got home, I made dinner.
// I cooked pasta with tomato sauce.
// Then I watched a movie.
// `)
      const features = await TextFeatureExtractor.extractFeatures(
        'Hello, how are you?'
      )

      // console.log('result:')
      // console.log(result.map(item => item.text))
      console.log('Features:', features.length)
      // console.log(TextFeatureExtractor.chunkText)
      // console.log(Object.keys(TextFeatureExtractor))
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const [lastResponse, setLastResponse] = useState('')
  const handleLLMPress = async () => {
    await generateTextResponse([
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', content: 'Hi'}
    ], (response) => {
      setLastResponse(response)
    })
  }

  return (
    <View style={styles.container}>
      <View style={{
        backgroundColor: 'red',
        flex: 1,
        paddingTop: safeAreaInsets.top,
        paddingBottom: safeAreaInsets.bottom,
        paddingLeft: safeAreaInsets.left,
        paddingRight: safeAreaInsets.right,
      }}>
        <Text style={{color: 'black'}}>{'test'}</Text>
        <Button
          title="Extract Features"
          onPress={handlePress}
        />
        <Button
          title="Generate LLM Text"
          onPress={handleLLMPress}
        />
        <Text>
          {lastResponse}
        </Text>
      </View>
      {/* <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      /> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});



export default App;
