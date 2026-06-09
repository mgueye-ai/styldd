import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  REVENUECAT_ENTITLEMENT_ID,
  fetchRevenueCatSubscriber,
  resolveStyldSubscriptionStatus,
} from './revenuecat.ts';

export type UnpublishSiteResult = {
  wasLive: boolean;
  subdomain: string | null;
};

export function resolveRevenueCatPublicApiKey(platform: 'ios' | 'android' = 'ios'): string | null {
  const iosKey = Deno.env.get('REVENUECAT_IOS_PUBLIC_KEY')?.trim()
    ?? Deno.env.get('EXPO_PUBLIC_REVENUECAT_IOS_KEY')?.trim()
    ?? '';
  const androidKey = Deno.env.get('REVENUECAT_ANDROID_PUBLIC_KEY')?.trim()
    ?? Deno.env.get('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY')?.trim()
    ?? '';
  const key = platform === 'android' ? androidKey : iosKey;
  return key || null;
}

export async function userHasActiveSubscription(
  userId: string,
  platform: 'ios' | 'android' = 'ios',
): Promise<{ configured: boolean; entitled: boolean | null }> {
  const publicApiKey = resolveRevenueCatPublicApiKey(platform);
  if (!publicApiKey) {
    return { configured: false, entitled: null };
  }

  const result = await fetchRevenueCatSubscriber(userId, publicApiKey, platform);
  if (!result.ok) {
    if (result.status === 404) {
      return { configured: true, entitled: false };
    }
    throw new Error(result.error);
  }

  return {
    configured: true,
    entitled: resolveStyldSubscriptionStatus(result.data, REVENUECAT_ENTITLEMENT_ID).entitled,
  };
}

export async function unpublishLiveSite(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  reason = 'subscription_lapsed',
): Promise<UnpublishSiteResult> {
  const { data: row } = await supabase
    .from('styld_site_subdomains')
    .select('subdomain, published_at')
    .eq('user_id', userId)
    .maybeSingle();

  const wasLive = Boolean(row?.published_at);
  const subdomain = row?.subdomain ?? null;
  if (!wasLive) {
    return { wasLive: false, subdomain };
  }

  const now = new Date().toISOString();

  await supabase
    .from('styld_site_subdomains')
    .update({ published_at: null, updated_at: now })
    .eq('user_id', userId);

  await supabase
    .from('styld_user_sites')
    .update({ published_at: null, updated_at: now })
    .eq('user_id', userId);

  const { data: publishRow } = await supabase
    .from('styld_site_records')
    .select('data')
    .eq('user_id', userId)
    .eq('record_type', 'site_setting')
    .eq('record_key', 'site_publish')
    .maybeSingle();

  const existing =
    publishRow?.data && typeof publishRow.data === 'object' && 'value' in publishRow.data
      ? (publishRow.data as { value?: Record<string, unknown> }).value ?? {}
      : {};

  const nextPublish = {
    ...existing,
    subdomain: subdomain ?? existing.subdomain ?? null,
    published: true,
    publishedAt: null,
    publicUrl: subdomain ? `https://${subdomain}.styldd.com` : existing.publicUrl ?? null,
    unpublishedReason: reason,
    unpublishedAt: now,
  };

  const { data: publishRecord } = await supabase
    .from('styld_site_records')
    .select('id')
    .eq('user_id', userId)
    .eq('record_type', 'site_setting')
    .eq('record_key', 'site_publish')
    .maybeSingle();

  const publishPayload = {
    data: { value: nextPublish },
    updated_at: now,
  };

  if (publishRecord?.id) {
    await supabase.from('styld_site_records').update(publishPayload).eq('id', publishRecord.id);
  } else {
    await supabase.from('styld_site_records').insert({
      user_id: userId,
      record_type: 'site_setting',
      record_key: 'site_publish',
      ...publishPayload,
    });
  }

  return { wasLive: true, subdomain };
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSupabaseUserId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}
