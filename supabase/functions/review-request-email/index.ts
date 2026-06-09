/**
 * review-request-email
 *
 * Sends a post-appointment review request after the stylist marks a booking complete.
 * Payload: { bookingId: string }
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import {
  loadSiteEmailBranding,
  StyldEmailBranding,
  wrapStyldEmail,
} from '../_shared/styld-email-brand.ts';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmail(
  branding: StyldEmailBranding,
  opts: { clientName: string; reviewUrl: string; service: string },
): string {
  const { clientName, reviewUrl, service } = opts;
  const first = clientName.trim().split(/\s+/)[0] || 'there';
  const body = `<tr><td style="padding:28px 28px 24px;color:${branding.textColor};">
<h2 style="margin:0 0 12px;color:${branding.textColor};font-family:${branding.headingFont};font-size:24px;font-weight:700;">How did we do, ${esc(first)}?</h2>
<p style="margin:0 0 16px;color:${branding.softTextColor};font-size:15px;line-height:1.6;">
  Thanks for visiting us for <strong style="color:${branding.textColor};">${esc(service)}</strong>.
  We'd love a quick review — it helps other clients find us and means a lot to our team.
</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${branding.ctaGradient};">
<a href="${esc(reviewUrl)}" style="display:inline-block;padding:14px 28px;color:${branding.ctaTextColor};font-size:15px;font-weight:700;text-decoration:none;">Leave a review</a>
</td></tr></table>
<p style="margin:18px 0 0;color:${branding.mutedColor};font-size:13px;">Or visit <a href="${esc(branding.siteUrl)}" style="color:${branding.primaryColor};text-decoration:none;">${esc(branding.siteUrl.replace(/^https?:\/\//, ''))}</a></p>
</td></tr>`;

  return wrapStyldEmail(branding, body, `Review request – ${branding.businessName}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const userId = userData.user.id;
    const { bookingId } = await req.json();
    if (!bookingId) return jsonResponse({ error: 'Missing bookingId' }, 400);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const resendFromFallback = Deno.env.get('RESEND_FROM') ?? 'Styld <bookings@styldd.com>';
    const rootDomain = Deno.env.get('STYLD_ROOT_DOMAIN') ?? 'styldd.com';
    if (!resendKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: settingsRow } = await admin
      .from('styld_site_records')
      .select('data')
      .eq('user_id', userId)
      .eq('record_type', 'site_setting')
      .eq('record_key', 'reviews_settings')
      .maybeSingle();

    const reviewsSettings = (settingsRow?.data as { value?: { enabled?: boolean } } | undefined)?.value;
    if (reviewsSettings?.enabled === false) {
      return jsonResponse({ ok: true, skipped: true, reason: 'reviews_disabled' });
    }

    const { data: subdomainRow } = await admin
      .from('styld_site_subdomains')
      .select('subdomain')
      .eq('user_id', userId)
      .maybeSingle();

    const subdomain = String(subdomainRow?.subdomain ?? '').trim();
    if (!subdomain) return jsonResponse({ ok: false, skipped: true, reason: 'no_subdomain' });

    const { data: bookingRow, error: bookingErr } = await admin
      .from('styld_site_records')
      .select('data')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .eq('record_type', 'booking')
      .single();

    if (bookingErr || !bookingRow) return jsonResponse({ error: 'Booking not found' }, 404);

    const b = bookingRow.data as Record<string, unknown>;
    const clientEmail = String(b.email ?? '');
    if (!clientEmail.includes('@')) {
      return jsonResponse({ ok: false, skipped: true, reason: 'no_email' });
    }

    if (b.review_request_email_sent_at) {
      return jsonResponse({ ok: true, skipped: true, reason: 'already_sent' });
    }

    const reviewToken = String(b.review_token ?? crypto.randomUUID());
    const siteUrl = `https://${subdomain}.${rootDomain}`;
    const reviewUrl = `${siteUrl}/review?token=${encodeURIComponent(reviewToken)}`;
    const branding = await loadSiteEmailBranding(admin, userId, siteUrl);
    const fromAddress = subdomain
      ? `${branding.businessName} <${subdomain}@${rootDomain}>`
      : resendFromFallback;

    const { data: settingRow } = await admin
      .from('styld_site_records')
      .select('data')
      .eq('user_id', userId)
      .eq('record_type', 'site_setting')
      .eq('record_key', 'site_content')
      .maybeSingle();
    const siteContent =
      (settingRow?.data as Record<string, unknown> | undefined)?.value as Record<string, unknown> ?? {};
    const replyEmail = String(siteContent.email ?? '').trim();

    const html = buildEmail(branding, {
      clientName: String(b.full_name ?? 'there'),
      reviewUrl,
      service: String(b.style_name ?? b.style_id ?? 'your appointment'),
    });

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [clientEmail],
        subject: `How was your visit at ${branding.businessName}?`,
        html,
        ...(replyEmail ? { reply_to: replyEmail } : {}),
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return jsonResponse({ error: 'Email send failed', detail: errText }, 502);
    }

    const merged = {
      ...b,
      review_token: reviewToken,
      review_request_email_sent_at: new Date().toISOString(),
    };
    await admin
      .from('styld_site_records')
      .update({ data: merged, updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    return jsonResponse({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('review-request-email error:', err);
    return jsonResponse({ error: msg }, 500);
  }
});
