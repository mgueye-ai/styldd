/**
 * booking-client-email
 *
 * Sends a branded booking confirmation + receipt email to the client.
 * Called after payment (stripe-booking-confirm) or for in-person bookings.
 *
 * Payload: { bookingId: string, subdomain: string }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeCancellationPolicy } from '../_shared/cancellation-policy.ts';
import {
  buildBookingManageUrl,
  buildConfirmationCancellationNote,
  loadSiteEmailBranding,
  StyldEmailBranding,
  wrapStyldEmail,
} from '../_shared/styld-email-brand.ts';

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

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(cents: number): string {
  return '$' + (cents / 100).toFixed(2);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      timeZone: 'America/New_York',
    });
  } catch { return iso; }
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    });
  } catch { return ''; }
}

function buildEmail(
  branding: StyldEmailBranding,
  opts: {
    clientName: string;
    coverUrl: string | null;
    service: string;
    startsAt: string | null;
    durationMinutes: number;
    location: string;
    priceCents: number;
    depositCents: number;
    depositPaid: boolean;
    isInPerson: boolean;
    bookingId: string;
    manageUrl: string;
    policySummary: string;
  },
): string {
  const {
    clientName, coverUrl, service, startsAt, durationMinutes, location,
    priceCents, depositCents, depositPaid, isInPerson, bookingId, manageUrl, policySummary,
  } = opts;

  const remaining = priceCents - (depositPaid ? depositCents : 0);
  const shortId = bookingId.slice(0, 8).toUpperCase();
  const rowBorder = branding.rowBorderColor;
  const successColor = '#22c55e';

  const coverBlock = coverUrl
    ? `<img src="${esc(coverUrl)}" alt="${esc(service)}" width="100%" height="180"
         style="display:block;width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:20px;" />`
    : '';

  const depositRow =
    depositPaid && depositCents > 0 && remaining > 0
      ? `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Deposit paid</td>
      <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${successColor};font-size:14px;font-weight:700;text-align:right;">${money(depositCents)}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:${branding.softTextColor};font-size:14px;">Due at service</td>
      <td style="padding:10px 0;color:${branding.primaryColor};font-size:14px;font-weight:700;text-align:right;">${money(remaining)}</td>
    </tr>`
      : '';

  const paymentNote = isInPerson
    ? `<p style="margin:0;color:${branding.softTextColor};font-size:13px;">Full payment of <strong style="color:${branding.textColor};">${money(priceCents)}</strong> is due at the time of service.</p>`
    : depositPaid && remaining > 0
      ? `<p style="margin:0;color:${branding.softTextColor};font-size:13px;">You have a remaining balance of <strong style="color:${branding.primaryColor};">${money(remaining)}</strong> due at your appointment.</p>`
      : `<p style="margin:0;color:${successColor};font-size:13px;font-weight:600;">✓ Paid in full</p>`;

  const body = `<tr>
      <td style="padding:20px 28px 16px;text-align:center;">
        <div style="display:inline-block;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:999px;padding:6px 18px;margin-bottom:16px;">
          <span style="color:${successColor};font-size:13px;font-weight:700;letter-spacing:0.05em;">✓ BOOKING CONFIRMED</span>
        </div>
        <h2 style="margin:0 0 6px;color:${branding.textColor};font-family:${branding.headingFont};font-size:26px;font-weight:700;letter-spacing:-0.3px;">See you soon, ${esc(clientName.split(' ')[0])}!</h2>
        <p style="margin:0;color:${branding.mutedColor};font-size:14px;">Your appointment has been confirmed. Here's your receipt.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 28px;">
        ${coverBlock}
        <div style="background:${branding.innerCardBg};border-radius:14px;border:1px solid ${branding.borderColor};padding:20px 20px 4px;margin-bottom:20px;">
          <p style="margin:0 0 14px;color:${branding.mutedColor};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Appointment details</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Service</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:700;text-align:right;">${esc(service)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Date</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:600;text-align:right;">${esc(fmtDate(startsAt))}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Time</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:600;text-align:right;">${esc(fmtTime(startsAt))}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Duration</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:600;text-align:right;">${durationMinutes} min</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Location</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:600;text-align:right;">${esc(location)}</td>
            </tr>
            <tr>
              <td style="padding:14px 0 10px;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;font-weight:700;">Total</td>
              <td style="padding:14px 0 10px;border-bottom:1px solid ${rowBorder};color:${branding.primaryColor};font-size:18px;font-weight:800;text-align:right;">${money(priceCents)}</td>
            </tr>
            ${depositRow}
          </table>
        </div>
        <div style="background:${branding.innerCardBg};border-radius:12px;border:1px solid ${branding.borderColor};padding:14px 16px;margin-bottom:20px;">
          ${paymentNote}
        </div>
        <div style="text-align:center;margin-bottom:8px;">
          <span style="color:${branding.mutedColor};font-size:12px;">Booking reference: </span>
          <span style="color:${branding.softTextColor};font-size:12px;font-family:'Courier New',monospace;font-weight:700;">#${esc(shortId)}</span>
        </div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr>
            <td align="center">
              <a href="${esc(manageUrl)}" style="display:inline-block;padding:12px 24px;border-radius:999px;border:1px solid ${branding.borderColor};color:${branding.textColor};font-size:14px;font-weight:700;text-decoration:none;background:${branding.innerCardBg};">View or cancel appointment</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;color:${branding.mutedColor};font-size:13px;text-align:center;">
          Questions? Visit
          <a href="${esc(branding.siteUrl)}" style="color:${branding.primaryColor};text-decoration:none;font-weight:600;">${esc(branding.siteUrl.replace('https://', ''))}</a>
        </p>
        ${buildConfirmationCancellationNote(branding, policySummary)}
      </td>
    </tr>`;

  return wrapStyldEmail(branding, body, `Booking Confirmed – ${branding.businessName}`);
}

// ─── main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { bookingId, subdomain } = await req.json();
    if (!bookingId || !subdomain) return json({ error: 'Missing bookingId or subdomain' }, 400);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = Deno.env.get('RESEND_FROM') ?? 'Styld Bookings <bookings@styldd.com>';
    if (!resendKey) return json({ error: 'RESEND_API_KEY not configured' }, 500);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Resolve user_id from subdomain
    const { data: userId, error: resolveErr } = await supabase
      .rpc('styld_resolve_published_user_id', { p_subdomain: subdomain });
    if (resolveErr || !userId) return json({ error: 'Site not found' }, 404);

    // 2. Fetch booking record
    const { data: bookingRow, error: bookingErr } = await supabase
      .from('styld_site_records')
      .select('data')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .eq('record_type', 'booking')
      .single();

    if (bookingErr || !bookingRow) return json({ error: 'Booking not found' }, 404);
    const b = bookingRow.data as Record<string, unknown>;

    const clientEmail = String(b.email ?? '');
    if (!clientEmail || !clientEmail.includes('@')) {
      return json({ ok: false, skipped: true, reason: 'no_email' });
    }

    // Deduplicate: don't send twice
    if (b.client_email_sent_at) return json({ ok: true, skipped: true, reason: 'already_sent' });

    const siteUrl = `https://${subdomain}.styldd.com`;
    const [branding, cancellationPolicyRow] = await Promise.all([
      loadSiteEmailBranding(supabase, userId, siteUrl),
      supabase
        .from('styld_site_records')
        .select('data')
        .eq('user_id', userId)
        .eq('record_type', 'site_setting')
        .eq('record_key', 'cancellation_policy')
        .maybeSingle(),
    ]);
    const cancellationRaw =
      cancellationPolicyRow.data?.data &&
      typeof cancellationPolicyRow.data.data === 'object'
        ? (cancellationPolicyRow.data.data as { value?: unknown }).value ??
          cancellationPolicyRow.data.data
        : null;
    const policySummary = normalizeCancellationPolicy(cancellationRaw).policySummary;

    // 5. Get style cover image signed URL (best-effort)
    const styleId = String(b.style_id ?? '');
    let coverUrl: string | null = null;
    if (styleId) {
      const { data: coverRow } = await supabase
        .from('styld_site_records')
        .select('data')
        .eq('user_id', userId)
        .eq('record_type', 'style_cover_image')
        .eq('record_key', styleId)
        .single();

      const storagePath = (coverRow?.data as Record<string, unknown>)?.storage_path as string;
      if (storagePath) {
        const { data: signed } = await supabase.storage
          .from('style-covers')
          .createSignedUrl(storagePath, 3600);
        coverUrl = signed?.signedUrl ?? null;
      }
    }

    // 6. Build email
    const priceCents = Math.round(Number(b.estimated_total ?? 0) * 100);
    const depositCents = Math.round(Number(b.deposit_amount ?? 0) * 100);
    const paymentStatus = String(b.payment_status ?? '');
    const bookingStatus = String(b.booking_status ?? '');
    const depositPaid = ['deposit_paid', 'paid'].includes(paymentStatus) ||
      ['confirmed', 'completed'].includes(bookingStatus);
    const isInPerson = paymentStatus === 'in_person' || bookingStatus === 'confirmed' && depositCents === 0;

    const clientName = String(b.full_name ?? 'there');
    const manageUrl = buildBookingManageUrl(siteUrl, bookingId, clientEmail, clientName);

    const html = buildEmail(branding, {
      clientName,
      coverUrl,
      service: String(b.style_name ?? b.style_id ?? 'Appointment'),
      startsAt: String(b.appointment_starts_at ?? ''),
      durationMinutes: Number(b.duration_minutes ?? 120),
      location: String(b.service_address ?? 'Studio'),
      priceCents,
      depositCents,
      depositPaid,
      isInPerson,
      bookingId,
      manageUrl,
      policySummary,
    });

    // 7. Send via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [clientEmail],
        subject: `✓ Booking confirmed – ${branding.businessName}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error('Resend error:', emailRes.status, errText);
      return json({ error: 'Email send failed', detail: errText }, 502);
    }

    // 8. Mark as sent so we don't resend
    const merged = { ...b, client_email_sent_at: new Date().toISOString() };
    await supabase
      .from('styld_site_records')
      .update({ data: merged, updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    return json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('booking-client-email error:', err);
    return json({ error: msg }, 500);
  }
});
