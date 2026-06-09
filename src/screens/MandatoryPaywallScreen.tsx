import { useCallback } from 'react';
import { Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PaywallScreen from './PaywallScreen';
import { useSiteContent } from '../context/SiteContentContext';
import { useSiteTheme } from '../context/SiteThemeContext';
import { useOnboarding } from '../context/OnboardingContext';
import { usePurchases } from '../context/PurchasesContext';
import { SiteStackParamList } from '../navigation/SiteNavigator';

type Props = NativeStackScreenProps<SiteStackParamList, 'MandatoryPaywall'>;

/** Paywall before first publish — no dismiss until subscribed. */
export default function MandatoryPaywallScreen({ navigation, route }: Props) {
  const pendingSubdomain = route.params?.pendingSubdomain?.trim() ?? '';
  const { content, saveContentNow } = useSiteContent();
  const { saveThemeNow } = useSiteTheme();
  const { publishSite, refresh } = useOnboarding();
  const { refresh: refreshPurchases, waitForEntitlement } = usePurchases();

  const finalizePendingPublish = useCallback(async () => {
    if (!pendingSubdomain) return;
    await Promise.all([saveContentNow(content), saveThemeNow()]);
    await publishSite(pendingSubdomain);
    await refresh();
  }, [pendingSubdomain, content, saveContentNow, saveThemeNow, publishSite, refresh]);

  return (
    <PaywallScreen
      navigation={navigation as never}
      route={route as never}
      mandatory
      onSubscribed={async () => {
        await refreshPurchases();
        const entitled = await waitForEntitlement();
        if (!entitled) return;

        if (pendingSubdomain) {
          try {
            await finalizePendingPublish();
          } catch (err) {
            Alert.alert(
              'Publish failed',
              err instanceof Error ? err.message : 'Your subscription is active, but we could not publish your site.',
            );
            return;
          }
        }

        await refresh();
        // AppAccessContext switches to full app (TabNavigator) once entitled + published.
      }}
    />
  );
}
