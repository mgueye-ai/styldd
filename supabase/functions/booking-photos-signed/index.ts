/**
 * booking-photos-signed
 *
 * Returns signed URLs for a booking's client photos. Verifies the caller owns
 * the booking, then signs paths with the service role (works even if storage
 * RLS for authenticated is missing).
 *
 * Payload: { bookingId: string, photoHairPath?: string, photoRefPath?: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function labelForPath(path: string): string {
  const name = path.split('/').pop() ?? path;
  if (name.startsWith('hair')) return 'Hair photo';
  if (name.startsWith('ref')) return 'Reference';
  return 'Photo';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const { bookingId, photoHairPath, photoRefPath } = await req.json();
    if (!bookingId || typeof bookingId !== 'string') {
      return json({ error: 'Missing bookingId' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: row, error: rowError } = await admin
      .from('styld_site_records')
      .select('id, user_id, data')
      .eq('record_type', 'booking')
      .eq('user_id', userData.user.id)
      .or(`id.eq.${bookingId},data->>id.eq.${bookingId}`)
      .maybeSingle();

    if (rowError) {
      console.error('booking lookup:', rowError);
      return json({ error: 'Could not load booking' }, 500);
    }
    if (!row) return json({ error: 'Booking not found' }, 404);

    const data = (row.data as Record<string, unknown>) ?? {};
    const storageFolder = String(data.id ?? row.id ?? bookingId).trim();

    const pathSet = new Set<string>();
    const hair = String(photoHairPath ?? data.photo_hair_path ?? '').trim();
    const ref = String(photoRefPath ?? data.photo_ref_path ?? '').trim();
    if (hair) pathSet.add(hair);
    if (ref) pathSet.add(ref);

    if (!pathSet.size && storageFolder) {
      const { data: files } = await admin.storage.from('booking-photos').list(storageFolder);
      for (const file of files ?? []) {
        if (file.name) pathSet.add(`${storageFolder}/${file.name}`);
      }
    }

    const photos: { uri: string; label: string }[] = [];
    for (const path of pathSet) {
      const { data: signed, error: signError } = await admin.storage
        .from('booking-photos')
        .createSignedUrl(path, 3600);
      if (signError || !signed?.signedUrl) {
        console.warn('sign failed:', path, signError?.message);
        continue;
      }
      photos.push({ uri: signed.signedUrl, label: labelForPath(path) });
    }

    return json({ photos });
  } catch (e) {
    console.error(e);
    return json({ error: 'Unexpected error' }, 500);
  }
});
