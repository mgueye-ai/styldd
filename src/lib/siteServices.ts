import { SupabaseClient } from '@supabase/supabase-js';
import { STYLE_COVER_BUCKET } from '../data/serviceCatalog';
import { BookingHours, DEFAULT_BOOKING_HOURS } from '../data/bookingHours';
import { normalizeStyleMeta, StyleCatalogMeta } from '../data/siteStyles';
import {
  createLinkedSiteClient,
  getHostedUserId,
  getLinkedTableName,
  getSiteDataSupabaseUrl,
  LinkedSite,
} from './linkedSites';

export type { BookingHours } from '../data/bookingHours';
export { DEFAULT_BOOKING_HOURS } from '../data/bookingHours';

type UnifiedSettingRow = {
  id: string;
  record_type: string;
  record_key: string | null;
  data: { value?: unknown };
};

export type SiteServicesData = {
  priceOverrides: Record<string, number>;
  coverImages: Record<string, string>;
  styleMeta: StyleCatalogMeta;
};

function getSiteDataSupabaseUrlForLinkedSite(linkedSite: LinkedSite | null): string | null {
  return getSiteDataSupabaseUrl(linkedSite);
}

export function getStyleCoverImageUrl(
  storagePath: string,
  linkedSite?: LinkedSite | null,
): string {
  const base = getSiteDataSupabaseUrlForLinkedSite(linkedSite ?? null)?.replace(/\/$/, '');
  if (!base) return '';
  return `${base}/storage/v1/object/public/${STYLE_COVER_BUCKET}/${storagePath}`;
}

function normalizeOverrides(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};

  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[key] = raw;
    } else if (typeof raw === 'string') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) result[key] = parsed;
    }
  }
  return result;
}

async function fetchAllCoverImages(
  client: SupabaseClient,
  tableName: string,
  userId: string | null,
): Promise<Record<string, string>> {
  const coverImages: Record<string, string> = {};
  const pageSize = 200;
  let unifiedFrom = 0;

  while (true) {
    let query = client
      .from(tableName)
      .select('record_key, data')
      .eq('record_type', 'style_cover_image')
      .order('record_key', { ascending: true })
      .range(unifiedFrom, unifiedFrom + pageSize - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    for (const row of rows) {
      const styleId = typeof row.record_key === 'string' ? row.record_key : '';
      const storagePath =
        row.data && typeof row.data === 'object' && 'storage_path' in row.data
          ? String((row.data as { storage_path?: unknown }).storage_path ?? '')
          : '';

      if (styleId && storagePath) {
        coverImages[styleId] = storagePath;
      }
    }

    if (rows.length < pageSize) {
      break;
    }

    unifiedFrom += pageSize;
  }

  return coverImages;
}

export async function loadSiteServices(linkedSite: LinkedSite | null): Promise<SiteServicesData> {
  if (!linkedSite) {
    return { priceOverrides: {}, coverImages: {}, styleMeta: {} };
  }

  const client = createLinkedSiteClient(linkedSite);
  const tableName = getLinkedTableName(linkedSite);

  if (!client || !tableName) {
    return { priceOverrides: {}, coverImages: {}, styleMeta: {} };
  }

  const userId = getHostedUserId(linkedSite);

  const [priceResult, metaResult, coverImages] = await Promise.all([
    client
      .from(tableName)
      .select('id, record_type, record_key, data')
      .eq('record_type', 'site_setting')
      .eq('record_key', 'style_price_overrides')
      .eq('user_id', userId ?? linkedSite.user_id)
      .maybeSingle(),
    client
      .from(tableName)
      .select('id, record_type, record_key, data')
      .eq('record_type', 'site_setting')
      .eq('record_key', 'style_catalog_meta')
      .eq('user_id', userId ?? linkedSite.user_id)
      .maybeSingle(),
    fetchAllCoverImages(client, tableName, userId ?? linkedSite.user_id),
  ]);

  if (priceResult.error) {
    throw new Error(priceResult.error.message);
  }

  if (metaResult.error) {
    throw new Error(metaResult.error.message);
  }

  const priceRow = priceResult.data as UnifiedSettingRow | null;
  const metaRow = metaResult.data as UnifiedSettingRow | null;
  const priceOverrides = normalizeOverrides(priceRow?.data?.value);
  const styleMeta = normalizeStyleMeta(
    metaRow?.data && typeof metaRow.data === 'object' && 'value' in metaRow.data
      ? (metaRow.data as { value?: unknown }).value
      : null,
  );

  return { priceOverrides, coverImages, styleMeta };
}

export async function savePriceOverrides(
  linkedSite: LinkedSite,
  overrides: Record<string, number>,
): Promise<void> {
  const client = createLinkedSiteClient(linkedSite);
  const tableName = getLinkedTableName(linkedSite);

  if (!client || !tableName) {
    throw new Error('Missing site data configuration.');
  }

  const userId = linkedSite.user_id;

  const { data: existing, error: readError } = await client
    .from(tableName)
    .select('id')
    .eq('record_type', 'site_setting')
    .eq('record_key', 'style_price_overrides')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const payload = {
    data: { value: overrides },
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await client.from(tableName).update(payload).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from(tableName).insert({
    user_id: userId,
    record_type: 'site_setting',
    record_key: 'style_price_overrides',
    ...payload,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function saveStyleCatalogMeta(
  linkedSite: LinkedSite,
  meta: StyleCatalogMeta,
): Promise<void> {
  const client = createLinkedSiteClient(linkedSite);
  const tableName = getLinkedTableName(linkedSite);

  if (!client || !tableName) {
    throw new Error('Missing site data configuration.');
  }

  const userId = linkedSite.user_id;

  const { data: existing, error: readError } = await client
    .from(tableName)
    .select('id')
    .eq('record_type', 'site_setting')
    .eq('record_key', 'style_catalog_meta')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const payload = {
    data: { value: meta },
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await client.from(tableName).update(payload).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from(tableName).insert({
    user_id: userId,
    record_type: 'site_setting',
    record_key: 'style_catalog_meta',
    ...payload,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((day) => (typeof day === 'number' ? day : Number(day)))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export function normalizeBookingHours(value: unknown): BookingHours {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    closedWeekdays: normalizeWeekdays(source.closedWeekdays),
    slotDayEndHour: normalizeNumber(source.slotDayEndHour, DEFAULT_BOOKING_HOURS.slotDayEndHour),
    slotDayEndMinute: normalizeNumber(
      source.slotDayEndMinute,
      DEFAULT_BOOKING_HOURS.slotDayEndMinute,
    ),
    slotDayStartHour: normalizeNumber(
      source.slotDayStartHour,
      DEFAULT_BOOKING_HOURS.slotDayStartHour,
    ),
    slotDayStartMinute: normalizeNumber(
      source.slotDayStartMinute,
      DEFAULT_BOOKING_HOURS.slotDayStartMinute,
    ),
    publicHoursText:
      typeof source.publicHoursText === 'string' && source.publicHoursText.trim()
        ? source.publicHoursText.trim()
        : DEFAULT_BOOKING_HOURS.publicHoursText,
    slotStepMinutes: normalizeNumber(source.slotStepMinutes, DEFAULT_BOOKING_HOURS.slotStepMinutes),
    sameDayLeadMinutes: normalizeNumber(
      source.sameDayLeadMinutes,
      DEFAULT_BOOKING_HOURS.sameDayLeadMinutes,
    ),
    saturdayLastStartHour: normalizeNumber(
      source.saturdayLastStartHour,
      DEFAULT_BOOKING_HOURS.saturdayLastStartHour,
    ),
    saturdayLastStartMinute: normalizeNumber(
      source.saturdayLastStartMinute,
      DEFAULT_BOOKING_HOURS.saturdayLastStartMinute,
    ),
    concurrentAppointmentCapacity: normalizeNumber(
      source.concurrentAppointmentCapacity,
      DEFAULT_BOOKING_HOURS.concurrentAppointmentCapacity,
    ),
  };
}

export async function loadBookingHours(linkedSite: LinkedSite | null): Promise<BookingHours> {
  if (!linkedSite) return DEFAULT_BOOKING_HOURS;

  const client = createLinkedSiteClient(linkedSite);
  const tableName = getLinkedTableName(linkedSite);

  if (!client || !tableName) {
    return DEFAULT_BOOKING_HOURS;
  }

  const { data, error } = await client
    .from(tableName)
    .select('data')
    .eq('user_id', linkedSite.user_id)
    .eq('record_type', 'site_setting')
    .eq('record_key', 'booking_hours')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const value =
    data?.data && typeof data.data === 'object' && 'value' in data.data
      ? (data.data as { value?: unknown }).value
      : null;

  return normalizeBookingHours(value);
}

export async function saveBookingHours(
  linkedSite: LinkedSite,
  hours: BookingHours,
): Promise<void> {
  const client = createLinkedSiteClient(linkedSite);
  const tableName = getLinkedTableName(linkedSite);

  if (!client || !tableName) {
    throw new Error('Missing site data configuration.');
  }

  const userId = linkedSite.user_id;

  const { data: existing, error: readError } = await client
    .from(tableName)
    .select('id')
    .eq('user_id', userId)
    .eq('record_type', 'site_setting')
    .eq('record_key', 'booking_hours')
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const payload = {
    data: { value: hours },
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await client.from(tableName).update(payload).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from(tableName).insert({
    user_id: userId,
    record_type: 'site_setting',
    record_key: 'booking_hours',
    ...payload,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function resolveStyleIdFromServiceName(
  serviceName: string,
  styleId: string | undefined,
  coverImages: Record<string, string>,
): string | null {
  if (styleId) return styleId;

  const normalized = serviceName.trim().toLowerCase();
  if (!normalized) return null;

  const styleIds = Object.keys(coverImages);
  const directMatch = styleIds.find((id) => normalized.includes(id.replace(/-/g, ' ')));
  if (directMatch) return directMatch;

  const keywords = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);

  let bestId: string | null = null;
  let bestScore = 0;

  for (const id of styleIds) {
    const slug = id.replace(/^(studio|house|kids)-/, '').replace(/-/g, ' ');
    const score = keywords.reduce(
      (total, word) => (slug.includes(word) ? total + 1 : total),
      0,
    );

    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestScore > 0 ? bestId : null;
}
