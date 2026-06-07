import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AddAppointmentScreen from '../screens/business/AddAppointmentScreen';
import BusinessCalendarScreen from '../screens/business/BusinessCalendarScreen';
import BusinessStatsScreen from '../screens/business/BusinessStatsScreen';
import StylesScreen from '../screens/business/StylesScreen';
import ScheduleScreen from '../screens/business/ScheduleScreen';
import ScheduleManageScreen, { ScheduleTab } from '../screens/business/ScheduleManageScreen';
import PaymentsScreen, { PaymentsTab } from '../screens/business/PaymentsScreen';
import BookingPaymentScreen from '../screens/business/BookingPaymentScreen';
import WalletScreen from '../screens/business/WalletScreen';
import WorkingHoursScreen from '../screens/business/WorkingHoursScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ConnectedAccountsScreen from '../screens/ConnectedAccountsScreen';
import AccountSettingsScreen from '../screens/AccountSettingsScreen';
import PaywallScreen from '../screens/PaywallScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Styles: undefined;
  Schedule: undefined;
  WorkingHours: undefined;
  BookingPayment: undefined;
  Wallet: undefined;
  AddAppointment: undefined;
  ScheduleManage: { tab?: ScheduleTab };
  Payments: { tab?: PaymentsTab };
  BusinessStats: undefined;
  BusinessCalendar: undefined;
  ConnectedAccounts: undefined;
  AccountSettings: undefined;
  Paywall: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true, animation: 'slide_from_right' }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Styles" component={StylesScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="ScheduleManage" component={ScheduleManageScreen} options={{ fullScreenGestureEnabled: false }} />
      <Stack.Screen name="Payments" component={PaymentsScreen} />
      <Stack.Screen name="WorkingHours" component={WorkingHoursScreen} />
      <Stack.Screen name="BookingPayment" component={BookingPaymentScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="AddAppointment" component={AddAppointmentScreen} />
      <Stack.Screen name="BusinessStats" component={BusinessStatsScreen} />
      <Stack.Screen name="BusinessCalendar" component={BusinessCalendarScreen} />
      <Stack.Screen name="ConnectedAccounts" component={ConnectedAccountsScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} />
    </Stack.Navigator>
  );
}
