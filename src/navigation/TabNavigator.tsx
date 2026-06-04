import { Ionicons } from '@expo/vector-icons';
import {
  BottomTabBar,
  BottomTabBarButtonProps,
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarNavigator from './CalendarNavigator';
import ClientNavigator from './ClientNavigator';
import DashboardNavigator from './DashboardNavigator';
import ProfileNavigator from './ProfileNavigator';
import SiteNavigator from './SiteNavigator';
import { colors } from '../theme';

export type TabParamList = {
  Calendar: undefined;
  Dashboard: undefined;
  Site: undefined;
  Profile: undefined;
  Client: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_BAR_WIDTH = Math.min(Dimensions.get('window').width - 40, 360);

const HIDDEN_TAB_BAR_SCREENS: Record<string, string[] | 'all-but-home'> = {
  Dashboard: ['EarningDetails', 'AppointmentDetail', 'AllUpcoming', 'AllBookings', 'BookingDetail'],
  Profile: 'all-but-home',
  Client: ['ClientDetail'],
  Site: ['SiteEditor', 'SiteSetup', 'SiteDeploy', 'HeroContent'],
};

function shouldHideTabBar(state: BottomTabBarProps['state']): boolean {
  const currentRoute = state.routes[state.index ?? 0];
  const hiddenScreens = HIDDEN_TAB_BAR_SCREENS[currentRoute.name];

  if (!hiddenScreens) return false;

  const nestedState = currentRoute.state;
  if (!nestedState?.routes.length) return false;

  const nestedRoute = nestedState.routes[nestedState.index ?? nestedState.routes.length - 1];

  if (hiddenScreens === 'all-but-home') {
    return nestedRoute?.name !== 'ProfileHome';
  }

  return hiddenScreens.includes(nestedRoute.name);
}

const tabIcons: Record<
  Exclude<keyof TabParamList, 'Site'>,
  keyof typeof Ionicons.glyphMap
> = {
  Dashboard: 'apps-outline',
  Calendar: 'calendar-outline',
  Client: 'people-outline',
  Profile: 'person-circle-outline',
};

function TabIcon({
  name,
  focused,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
}) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons
        name={name}
        size={22}
        color={focused ? colors.navbarActive : color}
        style={focused ? styles.iconGlow : undefined}
      />
    </View>
  );
}

function CenterSiteButton(props: BottomTabBarButtonProps) {
  const focused = props.accessibilityState?.selected;

  return (
    <Pressable
      {...props}
      style={styles.centerButtonWrap}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
    >
      <View style={[styles.centerButton, focused && styles.centerButtonFocused]}>
        <Ionicons
          name={focused ? 'globe' : 'globe-outline'}
          size={20}
          color={focused ? colors.chartBlue : colors.navbarInactive}
          style={focused ? styles.centerIconGlow : undefined}
        />
      </View>
    </Pressable>
  );
}

function FloatingTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  if (shouldHideTabBar(props.state)) {
    return null;
  }

  return (
    <View
      style={[styles.tabBarWrapper, { bottom: Math.max(insets.bottom, 20) }]}
      pointerEvents="box-none"
    >
      <View style={styles.tabBar}>
        <BottomTabBar {...props} />
      </View>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.navbarActive,
        tabBarInactiveTintColor: colors.navbarInactive,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          paddingHorizontal: 0,
        },
        tabBarStyle: {
          width: TAB_BAR_WIDTH,
          height: 72,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          paddingTop: 14,
          paddingBottom: 10,
        },
        tabBarIcon:
          route.name === 'Site'
            ? () => null
            : ({ color, focused }) => (
                <TabIcon
                  name={tabIcons[route.name as Exclude<keyof TabParamList, 'Site'>]}
                  focused={focused}
                  color={color}
                />
              ),
        tabBarButton:
          route.name === 'Site'
            ? (props) => <CenterSiteButton {...props} />
            : undefined,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardNavigator} />
      <Tab.Screen name="Calendar" component={CalendarNavigator} />
      <Tab.Screen name="Site" component={SiteNavigator} />
      <Tab.Screen name="Client" component={ClientNavigator} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tabBar: {
    width: TAB_BAR_WIDTH,
    borderRadius: 32,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: colors.navbarBorder,
    backgroundColor: colors.navbar,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    textShadowColor: colors.activeGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  centerIconGlow: {
    textShadowColor: colors.activeGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  centerButtonWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.navbarBorder,
  },
  centerButtonFocused: {
    backgroundColor: colors.accentPinkSoft,
    borderColor: colors.accentPinkBorder,
  },
});
