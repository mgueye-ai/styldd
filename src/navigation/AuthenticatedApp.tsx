import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { PushNotificationsProvider } from '../context/PushNotificationsContext';
import { ServiceCatalogProvider } from '../context/ServiceCatalogContext';
import { AppAccessProvider, useAppAccess } from '../context/AppAccessContext';
import { OnboardingProvider, useOnboarding } from '../context/OnboardingContext';
import { SiteContentProvider } from '../context/SiteContentContext';
import { SiteDataProvider } from '../context/SiteDataContext';
import { SiteThemeProvider } from '../context/SiteThemeContext';
import { usePurchases } from '../context/PurchasesContext';
import TabNavigator from './TabNavigator';
import SiteNavigator from './SiteNavigator';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionSiteSync } from '../hooks/useSubscriptionSiteSync';
import AccountOnboardingFlow from '../screens/onboarding/AccountOnboardingFlow';
import PaywallScreen from '../screens/PaywallScreen';
import { colors } from '../theme';

function AccessLoading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accentPink} />
    </View>
  );
}

function AppGate() {
  const { clearNewSignUp } = useAuth();
  const { phase } = useAppAccess();
  const { sitePublish, refresh: refreshOnboarding, publishSite } = useOnboarding();
  const { refresh: refreshPurchases, waitForEntitlement } = usePurchases();

  useSubscriptionSiteSync();

  if (phase === 'loading') {
    return <AccessLoading />;
  }

  if (phase === 'account_onboarding') {
    return <AccountOnboardingFlow onComplete={clearNewSignUp} />;
  }

  if (phase === 'build_site') {
    return <SiteNavigator />;
  }

  if (phase === 'paywall') {
    return (
      <PaywallScreen
        mandatory
        navigation={
          {
            goBack: () => {},
            navigate: () => {},
          } as never
        }
        route={{ key: 'mandatory-paywall', name: 'Paywall', params: undefined } as never}
        onSubscribed={async () => {
          await refreshPurchases();
          const entitled = await waitForEntitlement();
          if (!entitled) return;
          if (sitePublish.subdomain) {
            try {
              await publishSite(sitePublish.subdomain);
            } catch (err) {
              console.warn('[Paywall] Republish after subscribe failed:', err);
            }
          }
          await refreshOnboarding();
        }}
      />
    );
  }

  return <TabNavigator />;
}

export default function AuthenticatedApp() {
  return (
    <SiteDataProvider>
      <PushNotificationsProvider>
        <SiteContentProvider>
          <SiteThemeProvider>
            <OnboardingProvider>
              <AppAccessProvider>
                <ServiceCatalogProvider>
                  <AppGate />
                </ServiceCatalogProvider>
              </AppAccessProvider>
            </OnboardingProvider>
          </SiteThemeProvider>
        </SiteContentProvider>
      </PushNotificationsProvider>
    </SiteDataProvider>
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
