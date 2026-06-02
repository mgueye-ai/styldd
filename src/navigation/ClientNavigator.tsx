import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ClientDetailScreen from '../screens/ClientDetailScreen';
import ClientListScreen from '../screens/ClientListScreen';

export type ClientStackParamList = {
  ClientList: undefined;
  ClientDetail: { clientId: string };
};

const Stack = createNativeStackNavigator<ClientStackParamList>();

export default function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientList" component={ClientListScreen} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
    </Stack.Navigator>
  );
}
