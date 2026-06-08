import { PushNotificationsProvider } from '../context/PushNotificationsContext';
import { ServiceCatalogProvider } from '../context/ServiceCatalogContext';
import { OnboardingProvider, useOnboarding } from '../context/OnboardingContext';
import { SiteContentProvider } from '../context/SiteContentContext';
import { SiteDataProvider } from '../context/SiteDataContext';
import { SiteThemeProvider } from '../context/SiteThemeContext';
import TabNavigator from '../navigation/TabNavigator';
import { useAuth } from '../context/AuthContext';
import AccountOnboardingFlow from '../screens/onboarding/AccountOnboardingFlow';

function NewUserGate() {
  const { isNewSignUp, clearNewSignUp } = useAuth();
  const { isLoading } = useOnboarding();

  if (!isLoading && isNewSignUp) {
    return <AccountOnboardingFlow onComplete={clearNewSignUp} />;
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
              <ServiceCatalogProvider>
                <NewUserGate />
              </ServiceCatalogProvider>
            </OnboardingProvider>
          </SiteThemeProvider>
        </SiteContentProvider>
      </PushNotificationsProvider>
    </SiteDataProvider>
  );
}
