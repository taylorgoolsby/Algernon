// AppNavigator.tsx
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import App from './App'
import ChatScreen from './ChatScreen'
import Settings from './Settings'
import DatabaseExplorer from './DatabaseExplorer'
import Memories from './Memories'
import { initializeDatabase } from '../schema/initializeDatabase'
import { chatStore } from '../store/ChatStore'
import preferencesStore from '../store/PreferencesStore'

initializeDatabase()
  .then(async () => {
    await preferencesStore.load()
    await chatStore.load()
  })
  .catch(error => {
    console.error(error)
  })

const Stack = createNativeStackNavigator()

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {/* <Stack.Screen
          name="Home"
          component={App}
          options={{
            headerShown: false,
          }}
        /> */}
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Settings"
          component={Settings}
          options={{
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="Explorer"
          component={DatabaseExplorer}
          options={{
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="Memories"
          component={Memories}
          options={{
            headerShown: true,
            title: 'Memories',
            headerStyle: { backgroundColor: 'black' },
            headerTintColor: 'white', // back button + back arrow color
            headerTitleStyle: { color: 'white' }, // title text color
            headerShadowVisible: false, // removes the thin bottom border/line
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
