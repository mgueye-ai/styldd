/**
 * booking-client-email
 *
 * Sends a branded booking confirmation + receipt email to the client.
 * Called after payment (stripe-booking-confirm) or for in-person bookings.
 *
 * Payload: { bookingId: string, subdomain: string }
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

function buildEmail(opts: {
  clientName: string;
  businessName: string;
  businessCity: string;
  logoUrl: string | null;
  coverUrl: string | null;
  siteUrl: string;
  service: string;
  startsAt: string | null;
  durationMinutes: number;
  location: string;
  priceCents: number;
  depositCents: number;
  depositPaid: boolean;
  isInPerson: boolean;
  bookingId: string;
}): string {
  const {
    clientName, businessName, businessCity, logoUrl, coverUrl, siteUrl,
    service, startsAt, durationMinutes, location, priceCents, depositCents,
    depositPaid, isInPerson, bookingId,
  } = opts;

  const remaining = priceCents - (depositPaid ? depositCents : 0);
  const shortId = bookingId.slice(0, 8).toUpperCase();

  const logoBlock = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(businessName)}" width="64" height="64"
         style="display:block;border-radius:50%;border:2px solid rgba(252,97,163,0.3);margin:0 auto 12px;object-fit:cover;" />`
    : `<div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#1a1a2e,#fc61a3);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;">
         <span style="color:#fff;font-size:22px;font-weight:800;">${esc(businessName.charAt(0))}</span>
       </div>`;

  const coverBlock = coverUrl
    ? `<img src="${esc(coverUrl)}" alt="${esc(service)}" width="100%" height="180"
         style="display:block;width:100%;height:180px;object-fit:cover;border-radius:12px;margin-bottom:20px;" />`
    : '';

  const depositRow = depositPaid && depositCents > 0 ? `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#a0a0c0;font-size:14px;">Deposit paid</td>
      <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#22c55e;font-size:14px;font-weight:700;text-align:right;">${money(depositCents)}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:#a0a0c0;font-size:14px;">Due at service</td>
      <td style="padding:10px 0;color:#fc61a3;font-size:14px;font-weight:700;text-align:right;">${money(remaining)}</td>
    </tr>` : '';

  const paymentNote = isInPerson
    ? `<p style="margin:0 0 0;color:#a0a0c0;font-size:13px;">Full payment of <strong style="color:#f0f0ff;">${money(priceCents)}</strong> is due at the time of service.</p>`
    : depositPaid && remaining > 0
      ? `<p style="margin:0;color:#a0a0c0;font-size:13px;">You have a remaining balance of <strong style="color:#fc61a3;">${money(remaining)}</strong> due at your appointment.</p>`
      : `<p style="margin:0;color:#22c55e;font-size:13px;font-weight:600;">✓ Paid in full</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Booking Confirmed – ${esc(businessName)}</title>
</head>
<body style="margin:0;padding:0;background:#0e0e1a;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0e0e1a;">
<tr><td align="center" style="padding:32px 16px 40px;">

  <!-- Card -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background:#1a1a2e;border-radius:20px;overflow:hidden;border:1px solid rgba(252,97,163,0.18);box-shadow:0 16px 48px rgba(0,0,0,0.5);">

    <!-- Header -->
    <tr>
      <td style="padding:32px 28px 24px;text-align:center;background:linear-gradient(160deg,#1e1e35 0%,#1a1a2e 100%);border-bottom:1px solid rgba(252,97,163,0.15);">
        ${logoBlock}
        <h1 style="margin:0 0 6px;color:#f0f0ff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">${esc(businessName)}</h1>
        <p style="margin:0;color:#8080a0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">${esc(businessCity)}</p>
      </td>
    </tr>

    <!-- Confirmed banner -->
    <tr>
      <td style="padding:20px 28px 16px;text-align:center;">
        <div style="display:inline-block;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:999px;padding:6px 18px;margin-bottom:16px;">
          <span style="color:#22c55e;font-size:13px;font-weight:700;letter-spacing:0.05em;">✓ BOOKING CONFIRMED</span>
        </div>
        <h2 style="margin:0 0 6px;color:#f0f0ff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">See you soon, ${esc(clientName.split(' ')[0])}!</h2>
        <p style="margin:0;color:#8080a0;font-size:14px;">Your appointment has been confirmed. Here's your receipt.</p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:0 28px 28px;">
        ${coverBlock}

        <!-- Receipt card -->
        <div style="background:#12122a;border-radius:14px;border:1px solid rgba(252,97,163,0.12);padding:20px 20px 4px;margin-bottom:20px;">
          <p style="margin:0 0 14px;color:#8080a0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Appointment details</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#a0a0c0;font-size:14px;">Service</td>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#f0f0ff;font-size:14px;font-weight:700;text-align:right;">${esc(service)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#a0a0c0;font-size:14px;">Date</td>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#f0f0ff;font-size:14px;font-weight:600;text-align:right;">${esc(fmtDate(startsAt))}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#a0a0c0;font-size:14px;">Time</td>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#f0f0ff;font-size:14px;font-weight:600;text-align:right;">${esc(fmtTime(startsAt))}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#a0a0c0;font-size:14px;">Duration</td>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#f0f0ff;font-size:14px;font-weight:600;text-align:right;">${durationMinutes} min</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#a0a0c0;font-size:14px;">Location</td>
              <td style="padding:10px 0;border-bottom:1px solid #2a2a3e;color:#f0f0ff;font-size:14px;font-weight:600;text-align:right;">${esc(location)}</td>
            </tr>
            <tr>
              <td style="padding:14px 0 10px;border-bottom:1px solid #2a2a3e;color:#a0a0c0;font-size:14px;font-weight:700;">Total</td>
              <td style="padding:14px 0 10px;border-bottom:1px solid #2a2a3e;color:#fc61a3;font-size:18px;font-weight:800;text-align:right;">${money(priceCents)}</td>
            </tr>
            ${depositRow}
          </table>
        </div>

        <!-- Payment note -->
        <div style="background:#12122a;border-radius:12px;border:1px solid rgba(252,97,163,0.1);padding:14px 16px;margin-bottom:20px;">
          ${paymentNote}
        </div>

        <!-- Booking ref -->
        <div style="text-align:center;margin-bottom:8px;">
          <span style="color:#4a4a6a;font-size:12px;">Booking reference: </span>
          <span style="color:#8080a0;font-size:12px;font-family:'Courier New',monospace;font-weight:700;">#${esc(shortId)}</span>
        </div>

        <p style="margin:0 0 4px;color:#6060a0;font-size:13px;text-align:center;">
          Questions? Reply to this email or visit
          <a href="${esc(siteUrl)}" style="color:#fc61a3;text-decoration:none;font-weight:600;">${esc(siteUrl.replace('https://', ''))}</a>
        </p>
      </td>
    </tr>

    <!-- Styld footer -->
    <tr>
      <td style="padding:16px 28px 20px;text-align:center;border-top:1px solid rgba(252,97,163,0.1);background:#12122a;">
        <p style="margin:0 0 4px;color:#4a4a6a;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;">Booking powered by</p>
        <p style="margin:0;font-size:16px;font-weight:900;letter-spacing:-0.5px;">
          <span style="color:#f0f0ff;">Styl</span><span style="color:#fc61a3;">d</span>
        </p>
        <p style="margin:6px 0 0;color:#3a3a5a;font-size:11px;">This is an automated confirmation. Please do not reply directly.</p>
      </td>
    </tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
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

    // 3. Fetch site settings for branding
    const { data: settingRow } = await supabase
      .from('styld_site_records')
      .select('data')
      .eq('user_id', userId)
      .eq('record_type', 'site_setting')
      .eq('record_key', 'site_content')
      .single();

    const siteContent = (settingRow?.data as Record<string, unknown>)?.value as Record<string, unknown> ?? {};
    const businessName = String(siteContent.brandName ?? siteContent.business_name ?? 'Your Stylist');
    const businessCity = String(siteContent.city ?? siteContent.location ?? '');

    // 4. Subdomain → site URL
    const siteUrl = `https://${subdomain}.styldd.com`;

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

    const html = buildEmail({
      clientName: String(b.full_name ?? 'there'),
      businessName,
      businessCity,
      logoUrl: null, // future: pull from site settings
      coverUrl,
      siteUrl,
      service: String(b.style_name ?? b.style_id ?? 'Appointment'),
      startsAt: String(b.appointment_starts_at ?? ''),
      durationMinutes: Number(b.duration_minutes ?? 120),
      location: String(b.service_address ?? 'Studio'),
      priceCents,
      depositCents,
      depositPaid,
      isInPerson,
      bookingId,
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
        subject: `✓ Booking confirmed – ${businessName}`,
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
