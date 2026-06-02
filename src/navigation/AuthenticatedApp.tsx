import { ServiceCatalogProvider } from '../context/ServiceCatalogContext';
import { OnboardingProvider } from '../context/OnboardingContext';
import { SiteContentProvider } from '../context/SiteContentContext';
import { SiteDataProvider } from '../context/SiteDataContext';
import { SiteThemeProvider } from '../context/SiteThemeContext';
import TabNavigator from '../navigation/TabNavigator';

export default function AuthenticatedApp() {
  return (
    <SiteDataProvider>
      <SiteContentProvider>
        <SiteThemeProvider>
          <OnboardingProvider>
            <ServiceCatalogProvider>
              <TabNavigator />
            </ServiceCatalogProvider>
          </OnboardingProvider>
        </SiteThemeProvider>
      </SiteContentProvider>
    </SiteDataProvider>
  );
}
