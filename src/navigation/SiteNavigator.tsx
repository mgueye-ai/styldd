import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SiteDeployScreen from '../screens/SiteDeployScreen';
import SiteEditorScreen from '../screens/SiteEditorScreen';
import SiteScreen from '../screens/SiteScreen';
import SiteSetupScreen from '../screens/onboarding/SiteSetupScreen';
import HeroAboutScreen from '../screens/HeroAboutScreen';
import HeroPolicyScreen from '../screens/HeroPolicyScreen';

export type SiteStackParamList = {
  SiteHome: undefined;
  SiteSetup: undefined;
  SiteEditor: undefined;
  SiteDeploy: undefined;
  HeroAbout: undefined;
  HeroPolicy: undefined;
};

const Stack = createNativeStackNavigator<SiteStackParamList>();

export default function SiteNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true, animation: 'slide_from_right' }}>
      <Stack.Screen name="SiteHome" component={SiteScreen} />
      <Stack.Screen name="SiteSetup" component={SiteSetupScreen} />
      <Stack.Screen name="SiteEditor" component={SiteEditorScreen} />
      <Stack.Screen name="SiteDeploy" component={SiteDeployScreen} />
      <Stack.Screen name="HeroAbout" component={HeroAboutScreen} />
      <Stack.Screen name="HeroPolicy" component={HeroPolicyScreen} />
    </Stack.Navigator>
  );
}
