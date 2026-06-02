import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AddAppointmentScreen from '../screens/business/AddAppointmentScreen';
import BusinessCalendarScreen from '../screens/business/BusinessCalendarScreen';
import BusinessStatsScreen from '../screens/business/BusinessStatsScreen';
import StylesScreen from '../screens/business/StylesScreen';
import ScheduleScreen from '../screens/business/ScheduleScreen';
import WorkingHoursScreen from '../screens/business/WorkingHoursScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Styles: undefined;
  Schedule: undefined;
  WorkingHours: undefined;
  AddAppointment: undefined;
  BusinessStats: undefined;
  BusinessCalendar: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Styles" component={StylesScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="WorkingHours" component={WorkingHoursScreen} />
      <Stack.Screen name="AddAppointment" component={AddAppointmentScreen} />
      <Stack.Screen name="BusinessStats" component={BusinessStatsScreen} />
      <Stack.Screen name="BusinessCalendar" component={BusinessCalendarScreen} />
    </Stack.Navigator>
  );
}
