import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppointmentDetailScreen from '../screens/AppointmentDetailScreen';
import CalendarScreen from '../screens/CalendarScreen';

export type CalendarStackParamList = {
  CalendarHome: undefined;
  AppointmentDetail: { appointmentId: string };
};

const Stack = createNativeStackNavigator<CalendarStackParamList>();

export default function CalendarNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true, animation: 'slide_from_right' }}>
      <Stack.Screen name="CalendarHome" component={CalendarScreen} />
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
    </Stack.Navigator>
  );
}
