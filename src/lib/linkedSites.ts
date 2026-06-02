import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { ensureUserSiteSeeded, HOSTED_SITE_TABLE } from './siteRecords';

export type LinkedSite = {
  id: string;
  user_id: string;
  site_name: string | null;
  site_url: string | null;
  table_name: string | null;
  supabase_url: string | null;
  supabase_anon_key: string | null;
  external_project_ref: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

import { getSiteRootDomain } from '../data/sitePublish';

function formatTableLabel(): string {
  return 'My Site';
}

export function getHostedLinkedSiteForUser(
  userId: string,
  businessName?: string | null,
): LinkedSite {
  const now = new Date().toISOString();
  return {
    id: userId,
    user_id: userId,
    site_name: businessName?.trim() || formatTableLabel(),
    site_url: null,
    table_name: HOSTED_SITE_TABLE,
    supabase_url: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? null,
    supabase_anon_key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? null,
    external_project_ref: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export function resolveLinkedSite(
  linkedSite: LinkedSite | null | undefined,
  userId?: string | null,
  businessName?: string | null,
): LinkedSite | null {
  if (linkedSite) return linkedSite;
  if (!userId) return null;
  return getHostedLinkedSiteForUser(userId, businessName);
}

export async function fetchLinkedSite(userId: string, businessName?: string | null): Promise<LinkedSite> {
  await ensureUserSiteSeeded(userId, businessName);

  const now = new Date().toISOString();

  return {
    id: userId,
    user_id: userId,
    site_name: businessName?.trim() || formatTableLabel(),
    site_url: null,
    table_name: HOSTED_SITE_TABLE,
    supabase_url: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? null,
    supabase_anon_key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? null,
    external_project_ref: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export function getLinkedTableName(linkedSite: LinkedSite | null | undefined): string | null {
  return linkedSite?.table_name?.trim() || HOSTED_SITE_TABLE;
}

export function getLinkedSiteWebUrl(_linkedSite: LinkedSite | null | undefined): string | null {
  return null;
}

export function getLinkedSiteLabel(linkedSite: LinkedSite | null | undefined): string {
  if (!linkedSite) return 'My Site';
  return linkedSite.site_name?.trim() || formatTableLabel();
}

export function createLinkedSiteClient(linkedSite: LinkedSite): SupabaseClient | null {
  if (linkedSite.table_name === HOSTED_SITE_TABLE) {
    return supabase;
  }

  return null;
}

export function getSiteDomain(_siteUrl: string | null | undefined): string {
  return getSiteRootDomain();
}

export function getHostedUserId(linkedSite: LinkedSite | null | undefined): string | null {
  return linkedSite?.user_id ?? null;
}

export function getSiteDataSupabaseUrl(linkedSite?: LinkedSite | null): string | null {
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  if (linkedSite?.table_name === HOSTED_SITE_TABLE) {
    return envUrl?.replace(/\/$/, '') ?? null;
  }
  return envUrl?.replace(/\/$/, '') ?? null;
}
