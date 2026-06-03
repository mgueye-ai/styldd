import { DEFAULT_ONBOARDING_STATE } from '../data/onboarding';
import { DEFAULT_BOOKING_HOURS } from '../data/bookingHours';
import { DEFAULT_BOOKING_PAYMENT } from '../data/bookingPayment';
import { DEFAULT_SITE_PUBLISH } from '../data/sitePublish';
import { DEFAULT_SITE_CONTENT } from '../data/siteContent';
import { DEFAULT_SITE_THEME } from '../data/siteTheme';
import { supabase } from './supabase';

export const HOSTED_SITE_TABLE = 'styld_site_records';

export function hostedRecords(userId: string) {
  return supabase.from(HOSTED_SITE_TABLE).select('*').eq('user_id', userId);
}

export async function userHasSiteRecords(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from(HOSTED_SITE_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function ensureUserSiteSeeded(userId: string, businessName?: string | null): Promise<void> {
  if (await userHasSiteRecords(userId)) return;

  const brandName = businessName?.trim() || DEFAULT_SITE_CONTENT.brandName;
  const siteContent = {
    ...DEFAULT_SITE_CONTENT,
    brandName,
  };

  const rows = [
    {
      user_id: userId,
      record_type: 'site_setting',
      record_key: 'site_content',
      data: { value: siteContent },
    },
    {
      user_id: userId,
      record_type: 'site_setting',
      record_key: 'booking_hours',
      data: { value: DEFAULT_BOOKING_HOURS },
    },
    {
      user_id: userId,
      record_type: 'site_setting',
      record_key: 'booking_payment',
      data: { value: DEFAULT_BOOKING_PAYMENT },
    },
    {
      user_id: userId,
      record_type: 'site_setting',
      record_key: 'style_price_overrides',
      data: { value: {} },
    },
    {
      user_id: userId,
      record_type: 'site_setting',
      record_key: 'site_theme',
      data: { value: DEFAULT_SITE_THEME },
    },
    {
      user_id: userId,
      record_type: 'site_setting',
      record_key: 'onboarding_state',
      data: { value: DEFAULT_ONBOARDING_STATE },
    },
    {
      user_id: userId,
      record_type: 'site_setting',
      record_key: 'site_publish',
      data: { value: DEFAULT_SITE_PUBLISH },
    },
  ];

  const { error } = await supabase.from(HOSTED_SITE_TABLE).insert(rows);
  if (error) throw new Error(error.message);

  await syncUserSiteRegistry(userId, brandName);
}

export async function syncUserSiteRegistry(
  userId: string,
  businessName?: string | null,
  subdomain?: string | null,
  publishedAt?: string | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from('styld_user_sites')
    .select('business_name, subdomain, published_at')
    .eq('user_id', userId)
    .maybeSingle();

  const payload = {
    user_id: userId,
    business_name: businessName?.trim() || existing?.business_name || null,
    subdomain: subdomain?.trim() || existing?.subdomain || null,
    published_at: publishedAt ?? existing?.published_at ?? null,
    data_table: HOSTED_SITE_TABLE,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('styld_user_sites').upsert(payload, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

export async function loadSiteSetting<T>(
  userId: string,
  recordKey: string,
  normalize: (value: unknown) => T,
  fallback: T,
): Promise<T> {
  const { data, error } = await supabase
    .from(HOSTED_SITE_TABLE)
    .select('data')
    .eq('user_id', userId)
    .eq('record_type', 'site_setting')
    .eq('record_key', recordKey)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const value =
    data?.data && typeof data.data === 'object' && 'value' in data.data
      ? (data.data as { value?: unknown }).value
      : null;

  return value ? normalize(value) : fallback;
}

export async function saveSiteSetting(
  userId: string,
  recordKey: string,
  value: unknown,
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from(HOSTED_SITE_TABLE)
    .select('id')
    .eq('user_id', userId)
    .eq('record_type', 'site_setting')
    .eq('record_key', recordKey)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const payload = {
    data: { value },
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase
      .from(HOSTED_SITE_TABLE)
      .update(payload)
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from(HOSTED_SITE_TABLE).insert({
    user_id: userId,
    record_type: 'site_setting',
    record_key: recordKey,
    ...payload,
  });

  if (error) throw new Error(error.message);
}
