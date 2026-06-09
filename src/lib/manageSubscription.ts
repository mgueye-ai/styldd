import { Alert, Linking, Platform } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { STYLD_MONTHLY_PRODUCT_ID, STYLD_YEARLY_PRODUCT_ID } from './paywallPackages';
import { hasActiveEntitlement, REVENUECAT_ENTITLEMENT_ID } from './revenueCatEntitlement';

const ANDROID_PACKAGE = 'com.crmstyld.app';
const IOS_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

type CustomerInfoExt = CustomerInfo & {
  activeSubscriptions?: string[];
};

function planLabelFromProductId(productId: string | null | undefined): string | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id === STYLD_MONTHLY_PRODUCT_ID || id.includes('monthly')) return 'Monthly';
  if (id === STYLD_YEARLY_PRODUCT_ID || id.includes('yearly') || id.includes('annual')) return 'Yearly';
  return null;
}

export function subscriptionPlanLabel(info: CustomerInfo | null | undefined): string | null {
  if (!hasActiveEntitlement(info)) return null;

  const pro = info?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
  const fromEntitlement = planLabelFromProductId(pro?.productIdentifier);
  if (fromEntitlement) return fromEntitlement;

  for (const subId of (info as CustomerInfoExt).activeSubscriptions ?? []) {
    const label = planLabelFromProductId(subId);
    if (label) return label;
  }

  return 'Active';
}

/** Opens the platform subscription management UI (App Store / Play Store). */
export async function openManageSubscription(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch {
      // Fall through to web URL.
    }
  }

  if (Platform.OS === 'android') {
    const playUrl = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`;
    if (await Linking.canOpenURL(playUrl)) {
      await Linking.openURL(playUrl);
      return;
    }
  }

  try {
    const info = await Purchases.getCustomerInfo();
    const managementUrl = (info as CustomerInfo & { managementURL?: string | null }).managementURL;
    if (managementUrl && (await Linking.canOpenURL(managementUrl))) {
      await Linking.openURL(managementUrl);
      return;
    }
  } catch {
    // ignore
  }

  if (Platform.OS === 'ios' && (await Linking.canOpenURL(IOS_SUBSCRIPTIONS_URL))) {
    await Linking.openURL(IOS_SUBSCRIPTIONS_URL);
    return;
  }

  throw new Error('Could not open subscription settings on this device.');
}

export async function handleManageSubscriptionPress(options: {
  isConfigured: boolean;
  hasActiveSubscription: boolean;
  onSubscribe: () => void;
  onAfterManage?: () => void | Promise<void>;
}): Promise<void> {
  const { isConfigured, hasActiveSubscription, onSubscribe, onAfterManage } = options;

  if (!isConfigured) {
    Alert.alert('Subscriptions unavailable', 'RevenueCat is not configured on this build.');
    return;
  }

  if (!hasActiveSubscription) {
    Alert.alert(
      'No active subscription',
      'Subscribe to unlock the full Styld app, then manage your plan here.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'View plans', onPress: onSubscribe },
      ],
    );
    return;
  }

  try {
    await openManageSubscription();
    await onAfterManage?.();
  } catch (err) {
    Alert.alert(
      'Could not open settings',
      err instanceof Error ? err.message : 'Try again from the App Store subscription settings.',
    );
  }
}
