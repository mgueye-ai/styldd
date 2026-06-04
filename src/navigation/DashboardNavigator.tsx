import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppointmentDetailScreen from '../screens/AppointmentDetailScreen';
import DashboardScreen from '../screens/DashboardScreen';
import EarningDetailsScreen from '../screens/EarningDetailsScreen';
import AllUpcomingScreen from '../screens/AllUpcomingScreen';
import AllBookingsScreen from '../screens/AllBookingsScreen';
import BookingDetailScreen from '../screens/BookingDetailScreen';

export type DashboardStackParamList = {
  DashboardHome: undefined;
  EarningDetails: undefined;
  AppointmentDetail: { appointmentId: string };
  AllUpcoming: undefined;
  AllBookings: undefined;
  BookingDetail: { bookingId: string };
};

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export default function DashboardNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true, animation: 'slide_from_right' }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="EarningDetails" component={EarningDetailsScreen} />
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} />
      <Stack.Screen name="AllUpcoming" component={AllUpcomingScreen} />
      <Stack.Screen name="AllBookings" component={AllBookingsScreen} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
    </Stack.Navigator>
  );
}
