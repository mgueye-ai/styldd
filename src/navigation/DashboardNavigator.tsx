import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppointmentDetailScreen from '../screens/AppointmentDetailScreen';
import DashboardScreen from '../screens/DashboardScreen';
import EarningDetailsScreen from '../screens/EarningDetailsScreen';

export type DashboardStackParamList = {
  DashboardHome: undefined;
  EarningDetails: undefined;
  AppointmentDetail: { appointmentId: string };
};

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export default function DashboardNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="EarningDetails" component={EarningDetailsScreen} />
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
    </Stack.Navigator>
  );
}
