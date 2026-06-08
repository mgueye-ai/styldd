import { createNavigationContainerRef } from '@react-navigation/native';
import { TabParamList } from '../navigation/TabNavigator';

export const navigationRef = createNavigationContainerRef<TabParamList>();

export function navigateFromPushData(data: Record<string, unknown> | undefined) {
  if (!navigationRef.isReady()) return;

  const screen = typeof data?.screen === 'string' ? data.screen : 'Dashboard';
  const recordId = typeof data?.recordId === 'string' ? data.recordId : undefined;

  if (screen === 'AppointmentDetail' && recordId) {
    navigationRef.navigate('Dashboard', {
      screen: 'AppointmentDetail',
      params: { appointmentId: recordId },
    });
    return;
  }

  if (screen === 'ReviewsSettings') {
    navigationRef.navigate('Profile', { screen: 'ReviewsSettings' });
    return;
  }

  navigationRef.navigate('Dashboard');
}
