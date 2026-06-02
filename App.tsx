import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PrivacyProvider } from './src/context/PrivacyContext';
import AuthenticatedApp from './src/navigation/AuthenticatedApp';
import LoginScreen from './src/screens/LoginScreen';
import { colors } from './src/theme';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: '#2a2a2a',
    primary: colors.text,
  },
};

function AppRoutes() {
  const { session, isReady } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accentPink} />
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PrivacyProvider>
          <NavigationContainer theme={theme}>
            <AppRoutes />
            <StatusBar style="light" />
          </NavigationContainer>
        </PrivacyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
