import {
  buildPublicSiteUrl,
  isValidSubdomain,
  normalizeSitePublish,
  normalizeSubdomain,
  RESERVED_SUBDOMAINS,
  SitePublishConfig,
} from '../data/sitePublish';
import { saveSiteSetting, syncUserSiteRegistry } from './siteRecords';
import { supabase } from './supabase';
import { triggerVercelRedeploy, VercelRedeployResult } from './vercelDeploy';

export type PublishSiteResult = {
  config: SitePublishConfig;
  redeploy: VercelRedeployResult;
};

export async function loadSitePublish(userId: string): Promise<SitePublishConfig> {
  const { data, error } = await supabase
    .from('styld_site_records')
    .select('data')
    .eq('user_id', userId)
    .eq('record_type', 'site_setting')
    .eq('record_key', 'site_publish')
    .maybeSingle();

  if (error) throw new Error(error.message);

  const value =
    data?.data && typeof data.data === 'object' && 'value' in data.data
      ? (data.data as { value?: unknown }).value
      : null;

  const { data: row } = await supabase
    .from('styld_site_subdomains')
    .select('subdomain, published_at')
    .eq('user_id', userId)
    .maybeSingle();

  const fromSetting = normalizeSitePublish(value);
  if (row?.subdomain) {
    return {
      subdomain: row.subdomain,
      published: Boolean(row.published_at) || fromSetting.published,
      publishedAt: row.published_at ?? fromSetting.publishedAt,
      publicUrl: buildPublicSiteUrl(row.subdomain),
    };
  }

  return fromSetting;
}

export async function checkSubdomainAvailability(
  subdomain: string,
  userId: string,
): Promise<{ available: boolean; reason?: string }> {
  const slug = normalizeSubdomain(subdomain);
  if (!isValidSubdomain(slug)) {
    return { available: false, reason: 'Use 2–32 letters, numbers, or hyphens.' };
  }
  if (RESERVED_SUBDOMAINS.has(slug)) {
    return { available: false, reason: 'That subdomain is reserved.' };
  }

  const { data, error } = await supabase
    .from('styld_site_subdomains')
    .select('user_id')
    .eq('subdomain', slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data && data.user_id !== userId) {
    return { available: false, reason: 'That subdomain is already taken.' };
  }

  return { available: true };
}

export async function publishSiteSubdomain(
  userId: string,
  subdomain: string,
): Promise<PublishSiteResult> {
  const slug = normalizeSubdomain(subdomain);
  const availability = await checkSubdomainAvailability(slug, userId);
  if (!availability.available) {
    throw new Error(availability.reason ?? 'Subdomain unavailable.');
  }

  const publishedAt = new Date().toISOString();
  const publicUrl = buildPublicSiteUrl(slug);
  const config: SitePublishConfig = {
    subdomain: slug,
    published: true,
    publishedAt,
    publicUrl,
  };

  const { data: existing } = await supabase
    .from('styld_site_subdomains')
    .select('subdomain')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.subdomain) {
    if (existing.subdomain !== slug) {
      const taken = await checkSubdomainAvailability(slug, userId);
      if (!taken.available) throw new Error(taken.reason ?? 'Subdomain unavailable.');
    }

    const { error } = await supabase
      .from('styld_site_subdomains')
      .update({ subdomain: slug, published_at: publishedAt, updated_at: publishedAt })
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('styld_site_subdomains').insert({
      user_id: userId,
      subdomain: slug,
      published_at: publishedAt,
      updated_at: publishedAt,
    });

    if (error) throw new Error(error.message);
  }

  await saveSiteSetting(userId, 'site_publish', config);
  await syncUserSiteRegistry(userId, undefined, slug, publishedAt);

  const redeploy = await triggerVercelRedeploy();
  return { config, redeploy };
}
