import { Platform } from 'react-native';
import { supabase } from './supabase';

export type SubscriptionSiteSyncResult = {
  configured: boolean;
  entitled: boolean | null;
  entitlementId?: string;
  canPublish?: boolean;
  unpublished?: boolean;
  subdomain?: string | null;
  error?: string;
};

export async function verifySubscriptionForPublish(): Promise<SubscriptionSiteSyncResult> {
  const { data, error } = await supabase.functions.invoke<SubscriptionSiteSyncResult>(
    'subscription-site-sync',
    { body: { action: 'verify', platform: Platform.OS === 'android' ? 'android' : 'ios' } },
  );

  if (error) {
    return { configured: false, entitled: null, error: error.message };
  }

  return data ?? { configured: false, entitled: null };
}

/** Unpublish live site when subscription is not active (server verifies via RevenueCat). */
export async function syncSubscriptionSiteAccess(): Promise<SubscriptionSiteSyncResult> {
  const { data, error } = await supabase.functions.invoke<SubscriptionSiteSyncResult>(
    'subscription-site-sync',
    { body: { action: 'sync', platform: Platform.OS === 'android' ? 'android' : 'ios' } },
  );

  if (error) {
    return { configured: false, entitled: null, error: error.message };
  }

  return data ?? { configured: false, entitled: null };
}
