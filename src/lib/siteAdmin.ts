import { SupabaseClient } from '@supabase/supabase-js';
import { STYLE_COVER_BUCKET } from '../data/serviceCatalog';
import { uploadStyleCoverImage as uploadStyleCoverBlob, uploadUserSiteImage } from './siteMedia';
import { cancelBookingViaEdge } from './bookingCancel';
import { createLinkedSiteClient, getLinkedTableName, LinkedSite } from './linkedSites';
import { supabase } from './supabase';

export type BlockedInterval = {
  id: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
};

export type ManualBookingInput = {
  fullName: string;
  phone: string;
  email: string;
  styleId: string;
  styleName: string;
  serviceAddress?: string;
  notes?: string;
  appointmentStartsAt: Date;
  durationMinutes: number;
  estimatedTotal: number;
  hairLength?: string;
};

function getClient(linkedSite: LinkedSite): {
  client: SupabaseClient;
  tableName: string;
  userId: string;
} {
  const client = createLinkedSiteClient(linkedSite);
  const tableName = getLinkedTableName(linkedSite);
  if (!client || !tableName) {
    throw new Error('Missing site data configuration.');
  }
  return { client, tableName, userId: linkedSite.user_id };
}

export async function loadBlockedIntervals(linkedSite: LinkedSite): Promise<BlockedInterval[]> {
  const { client, tableName, userId } = getClient(linkedSite);

  const { data, error } = await client
    .from(tableName)
    .select('id, data')
    .eq('user_id', userId)
    .eq('record_type', 'blocked_interval')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const payload = (row.data ?? {}) as Record<string, unknown>;
      const startsAt = payload.starts_at ? String(payload.starts_at) : '';
      const endsAt = payload.ends_at ? String(payload.ends_at) : '';
      if (!startsAt || !endsAt) return null;

      return {
        id: String(row.id),
        startsAt,
        endsAt,
        note: payload.note ? String(payload.note) : null,
      };
    })
    .filter((row): row is BlockedInterval => row !== null);
}

export async function addBlockedInterval(
  linkedSite: LinkedSite,
  input: { startsAt: Date; endsAt: Date; note?: string },
): Promise<void> {
  const { client, tableName, userId } = getClient(linkedSite);

  const { error } = await client.from(tableName).insert({
    user_id: userId,
    record_type: 'blocked_interval',
    data: {
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt.toISOString(),
      note: input.note?.trim() || null,
    },
  });

  if (error) throw new Error(error.message);
}

export async function deleteBlockedInterval(
  linkedSite: LinkedSite,
  blockId: string,
): Promise<void> {
  const { client, tableName, userId } = getClient(linkedSite);
  const { error } = await client
    .from(tableName)
    .delete()
    .eq('user_id', userId)
    .eq('id', blockId);
  if (error) throw new Error(error.message);
}

export async function upsertStyleCoverImage(
  linkedSite: LinkedSite,
  styleId: string,
  storagePath: string,
): Promise<void> {
  const { client, tableName, userId } = getClient(linkedSite);

  const { data: existing, error: readError } = await client
    .from(tableName)
    .select('id')
    .eq('user_id', userId)
    .eq('record_type', 'style_cover_image')
    .eq('record_key', styleId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const payload = {
    data: { storage_path: storagePath },
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await client.from(tableName).update(payload).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await client.from(tableName).insert({
    user_id: userId,
    record_type: 'style_cover_image',
    record_key: styleId,
    ...payload,
  });

  if (error) throw new Error(error.message);
}

export async function removeStyleCoverImage(
  linkedSite: LinkedSite,
  styleId: string,
): Promise<void> {
  const { client, tableName, userId } = getClient(linkedSite);
  const { error } = await client
    .from(tableName)
    .delete()
    .eq('user_id', userId)
    .eq('record_type', 'style_cover_image')
    .eq('record_key', styleId);

  if (error) throw new Error(error.message);
}

export async function uploadStyleCoverFromUri(
  linkedSite: LinkedSite,
  styleId: string,
  fileUri: string,
  mimeType?: string | null,
): Promise<string> {
  const storagePath = await uploadStyleCoverBlob(linkedSite.user_id, styleId, fileUri, mimeType);
  await upsertStyleCoverImage(linkedSite, styleId, storagePath);
  return storagePath;
}

export async function uploadHeroImageFromUri(
  linkedSite: LinkedSite,
  fileUri: string,
  mimeType?: string | null,
): Promise<string> {
  return uploadUserSiteImage(linkedSite.user_id, fileUri, 'hero', mimeType);
}

export async function uploadLogoImageFromUri(
  linkedSite: LinkedSite,
  fileUri: string,
  mimeType?: string | null,
): Promise<string> {
  return uploadUserSiteImage(linkedSite.user_id, fileUri, 'logo', mimeType);
}

export async function uploadGalleryImageFromUri(
  linkedSite: LinkedSite,
  slot: number,
  fileUri: string,
  mimeType?: string | null,
): Promise<string> {
  return uploadUserSiteImage(linkedSite.user_id, fileUri, `gallery_${slot}`, mimeType);
}

export async function uploadStackImageFromUri(
  linkedSite: LinkedSite,
  slot: number,
  fileUri: string,
  mimeType?: string | null,
): Promise<string> {
  return uploadUserSiteImage(linkedSite.user_id, fileUri, `stack_${slot}`, mimeType);
}

export async function createManualBooking(
  linkedSite: LinkedSite,
  input: ManualBookingInput,
): Promise<void> {
  const { client, tableName, userId } = getClient(linkedSite);
  const startsAt = input.appointmentStartsAt;

  const { error } = await client.from(tableName).insert({
    user_id: userId,
    record_type: 'booking',
    data: {
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      style_id: input.styleId,
      style_name: input.styleName,
      service_address: input.serviceAddress?.trim() || null,
      notes: input.notes?.trim() || null,
      appointment_starts_at: startsAt.toISOString(),
      appointment_date: startsAt.toISOString().slice(0, 10),
      duration_minutes: input.durationMinutes,
      estimated_total: input.estimatedTotal,
      deposit_amount: 0,
      payment_status: 'paid',
      booking_status: 'confirmed',
      source: 'admin_dashboard',
      hair_length: input.hairLength || null,
    },
  });

  if (error) throw new Error(error.message);
}

export async function completeBooking(linkedSite: LinkedSite, bookingId: string): Promise<void> {
  const { client, tableName, userId } = getClient(linkedSite);

  const { data: existing, error: readError } = await client
    .from(tableName)
    .select('id, data')
    .eq('user_id', userId)
    .eq('record_type', 'booking')
    .eq('id', bookingId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error('Booking not found.');

  const data = (existing.data ?? {}) as Record<string, unknown>;
  const reviewToken =
    typeof data.review_token === 'string' && data.review_token.trim()
      ? data.review_token.trim()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const { error } = await client
    .from(tableName)
    .update({
      data: {
        ...data,
        booking_status: 'completed',
        completed_at: new Date().toISOString(),
        review_token: reviewToken,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  if (error) throw new Error(error.message);
}

export async function cancelBooking(linkedSite: LinkedSite, bookingId: string): Promise<void> {
  const { userId } = getClient(linkedSite);

  const { data: subdomainRow, error: subdomainErr } = await supabase
    .from('styld_site_subdomains')
    .select('subdomain')
    .eq('user_id', userId)
    .maybeSingle();

  if (subdomainErr) throw new Error(subdomainErr.message);

  const subdomain = String(subdomainRow?.subdomain ?? '').trim();
  if (!subdomain) {
    throw new Error('Publish your site before cancelling bookings online.');
  }

  const result = await cancelBookingViaEdge(bookingId, subdomain, 'stylist');
  if (!result.ok) {
    throw new Error(result.error || 'Could not cancel booking.');
  }
}

export function formatBlockRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const dateFmt = start.toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFmt = (date: Date) =>
    date.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' });
  return `${dateFmt} · ${timeFmt(start)} – ${timeFmt(end)}`;
}
