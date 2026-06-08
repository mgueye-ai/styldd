import { Ionicons } from '@expo/vector-icons';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { NavigatorScreenParams } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarNavigator from './CalendarNavigator';
import ClientNavigator from './ClientNavigator';
import DashboardNavigator, { DashboardStackParamList } from './DashboardNavigator';
import ProfileNavigator, { ProfileStackParamList } from './ProfileNavigator';
import SiteNavigator from './SiteNavigator';
import { colors } from '../theme';

export type TabParamList = {
  Calendar: undefined;
  Dashboard: NavigatorScreenParams<DashboardStackParamList>;
  Site: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
  Client: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

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
  if (hiddenScreens === 'all-but-home') return nestedRoute?.name !== 'ProfileHome';
  return hiddenScreens.includes(nestedRoute.name);
}

const TAB_CONFIG: Record<
  keyof TabParamList,
  { icon: keyof typeof Ionicons.glyphMap; iconFocused: keyof typeof Ionicons.glyphMap; label: string }
> = {
  Dashboard: { icon: 'apps-outline',          iconFocused: 'apps',              label: 'Dashboard' },
  Calendar:  { icon: 'calendar-outline',       iconFocused: 'calendar',          label: 'Calendar' },
  Site:      { icon: 'globe-outline',          iconFocused: 'globe',             label: 'Website' },
  Client:    { icon: 'people-outline',         iconFocused: 'people',            label: 'Clients' },
  Profile:   { icon: 'person-circle-outline',  iconFocused: 'person-circle',     label: 'Profile' },
};

// Max expanded width for each label (pre-measured so animation target is accurate)
// Widths sized for uppercase text (fontSize 11, letterSpacing 0.8) — measure generously
const LABEL_WIDTHS: Record<keyof TabParamList, number> = {
  Dashboard: 96,
  Calendar:  80,
  Site:      76,
  Client:    68,
  Profile:   68,
};

// Inactive tab = icon (22) + horizontal padding (20) ≈ 42px base
// Active tab   = text width + icon slot (22) + expanded padding (28)
// Flex ratio   = active_needed / inactive_base
const ICON_SLOT = 22;
const INACTIVE_PAD = 20;
const ACTIVE_PAD = 28;
const INACTIVE_BASE = ICON_SLOT + INACTIVE_PAD;
const FLEX_EXPANDED: Record<keyof TabParamList, number> = Object.fromEntries(
  Object.entries(LABEL_WIDTHS).map(([k, w]) => [k, (w + ICON_SLOT + ACTIVE_PAD) / INACTIVE_BASE]),
) as Record<keyof TabParamList, number>;

function TabButton({
  routeName,
  focused,
  onPress,
}: {
  routeName: keyof TabParamList;
  focused: boolean;
  onPress: () => void;
}) {
  const cfg = TAB_CONFIG[routeName];

  const expand = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const [typeText, setTypeText] = useState(focused ? cfg.label : '');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Pill spring (background + padding + flex)
    Animated.spring(expand, {
      toValue: focused ? 1 : 0,
      speed: 20,
      bounciness: 5,
      useNativeDriver: false,
    }).start();

    // Typewriter
    if (timerRef.current) clearInterval(timerRef.current);
    if (focused) {
      setTypeText('');
      let i = 0;
      // Small delay so the pill starts opening first
      const startDelay = setTimeout(() => {
        timerRef.current = setInterval(() => {
          i += 1;
          setTypeText(cfg.label.slice(0, i));
          if (i >= cfg.label.length) clearInterval(timerRef.current!);
        }, 28);
      }, 40);
      return () => {
        clearTimeout(startDelay);
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      setTypeText('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const pillBg = expand.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)'] });
  const iconOpacity = expand.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] });
  const pillPaddingH = expand.interpolate({ inputRange: [0, 1], outputRange: [10, 14] });
  const flexValue = expand.interpolate({ inputRange: [0, 1], outputRange: [1, FLEX_EXPANDED[routeName]] });

  return (
    <Animated.View style={[styles.tabButton, { flex: flexValue }]}>
      <Pressable onPress={onPress} style={styles.tabButtonInner}>
        <Animated.View style={[styles.pill, { backgroundColor: pillBg, paddingHorizontal: pillPaddingH }]}>
          {/* Icon — fades out when active */}
          <Animated.View style={[styles.iconAbsolute, { opacity: iconOpacity }]}>
            <Ionicons name={cfg.icon} size={22} color={colors.navbarInactive} />
          </Animated.View>

          {/* Typewriter text */}
          {typeText ? <Text style={styles.pillLabel}>{typeText}</Text> : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  if (shouldHideTabBar(state)) return null;

  return (
    <View style={[styles.wrapper, { bottom: Math.max(insets.bottom, 16) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <TabButton
              key={route.key}
              routeName={route.name as keyof TabParamList}
              focused={focused}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
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
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 10,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabButtonInner: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  iconAbsolute: {
    position: 'absolute',
  },
  pillLabel: {
    color: colors.navbarActive,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
