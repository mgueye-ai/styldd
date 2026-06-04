import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SiteDeployScreen from '../screens/SiteDeployScreen';
import SiteEditorScreen from '../screens/SiteEditorScreen';
import SiteScreen from '../screens/SiteScreen';
import SiteSetupScreen from '../screens/onboarding/SiteSetupScreen';
import HeroContentScreen from '../screens/HeroContentScreen';

export type SiteStackParamList = {
  SiteHome: undefined;
  SiteSetup: undefined;
  SiteEditor: undefined;
  SiteDeploy: undefined;
  HeroContent: undefined;
};

const Stack = createNativeStackNavigator<SiteStackParamList>();

export default function SiteNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SiteHome" component={SiteScreen} />
      <Stack.Screen name="SiteSetup" component={SiteSetupScreen} />
      <Stack.Screen name="SiteEditor" component={SiteEditorScreen} />
      <Stack.Screen name="SiteDeploy" component={SiteDeployScreen} />
      <Stack.Screen name="HeroContent" component={HeroContentScreen} />
    </Stack.Navigator>
  );
}
