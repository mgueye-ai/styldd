import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppAccess } from '../context/AppAccessContext';
import SiteDeployScreen from '../screens/SiteDeployScreen';
import SiteEditorScreen from '../screens/SiteEditorScreen';
import SiteScreen from '../screens/SiteScreen';
import SiteSetupScreen from '../screens/onboarding/SiteSetupScreen';
import SiteEditorIntroScreen from '../screens/onboarding/SiteEditorIntroScreen';
import MandatoryPaywallScreen from '../screens/MandatoryPaywallScreen';
import HeroAboutScreen from '../screens/HeroAboutScreen';
import HeroPolicyScreen from '../screens/HeroPolicyScreen';

export type SiteStackParamList = {
  SiteHome: undefined;
  SiteSetup: undefined;
  SiteEditorIntro: undefined;
  SiteEditor: undefined;
  SiteDeploy: undefined;
  MandatoryPaywall: { pendingSubdomain: string };
  HeroAbout: undefined;
  HeroPolicy: undefined;
};

const Stack = createNativeStackNavigator<SiteStackParamList>();

export default function SiteNavigator() {
  const { isBuildSiteOnly } = useAppAccess();

  return (
    <Stack.Navigator
      initialRouteName={isBuildSiteOnly ? 'SiteEditorIntro' : 'SiteHome'}
      screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="SiteHome" component={SiteScreen} />
      <Stack.Screen name="SiteSetup" component={SiteSetupScreen} />
      <Stack.Screen
        name="SiteEditorIntro"
        component={SiteEditorIntroScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="SiteEditor" component={SiteEditorScreen} />
      <Stack.Screen name="SiteDeploy" component={SiteDeployScreen} />
      <Stack.Screen
        name="MandatoryPaywall"
        component={MandatoryPaywallScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="HeroAbout" component={HeroAboutScreen} />
      <Stack.Screen name="HeroPolicy" component={HeroPolicyScreen} />
    </Stack.Navigator>
  );
}
