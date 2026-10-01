import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import App from './App';
import ChatScreen from './ChatScreen';
import {initializeDatabase} from "../schema/initializeDatabase";
import { chatStore } from '../store/ChatStore';
import preferencesStore from '../store/PreferencesStore'

initializeDatabase()
  .then(async () => {
    await preferencesStore.load()
    await chatStore.load()
  })
  .catch(error => {
    console.error(error)
  })

const Stack = createNativeStackNavigator();

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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
