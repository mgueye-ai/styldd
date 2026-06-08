/**
 * client-contact-email
 *
 * Sends branded outreach emails from a salon owner to selected clients via Resend.
 * Auth required. From address uses the tenant subdomain on the Styld root domain.
 *
 * Payload: {
 *   templateId: 'book_again' | 'thank_you' | 'promo' | 'check_in' | 'custom',
 *   recipients: [{ email, name }],
 *   subject?: string,
 *   message?: string,
 * }
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import {
  loadSiteEmailBranding,
  StyldEmailBranding,
  wrapStyldEmail,
} from '../_shared/styld-email-brand.ts';

type TemplateId = 'book_again' | 'thank_you' | 'promo' | 'check_in' | 'custom';

type Recipient = {
  email: string;
  name: string;
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0] ?? 'there';
}

function buildFromAddress(businessName: string, subdomain: string, rootDomain: string, fallback: string): string {
  const brand = businessName.trim() || 'Your stylist';
  if (subdomain) {
    return `${brand} <${subdomain}@${rootDomain}>`;
  }
  return fallback;
}

function templateBody(
  templateId: TemplateId,
  opts: {
    clientName: string;
    businessName: string;
    businessCity: string;
    siteUrl: string;
    customMessage?: string;
  },
): { subject: string; headline: string; paragraphs: string[]; ctaLabel: string } {
  const { clientName, businessName, siteUrl, customMessage } = opts;
  const greeting = firstName(clientName);

  switch (templateId) {
    case 'thank_you':
      return {
        subject: `Thank you for visiting ${businessName}!`,
        headline: `Thanks, ${greeting}!`,
        paragraphs: [
          `We loved having you at <strong>${esc(businessName)}</strong>. Hope you're still feeling amazing in your new look.`,
          'If you have a moment, we would appreciate a shout-out or tag on social — it helps us grow and means the world.',
        ],
        ctaLabel: 'Book your next visit',
      };
    case 'promo':
      return {
        subject: `A special offer from ${businessName} ✨`,
        headline: `Something special for you, ${greeting}`,
        paragraphs: [
          customMessage?.trim()
            ? esc(customMessage.trim()).replace(/\n/g, '<br />')
            : `We're running a limited-time offer for our favorite clients. Book this week and mention this email at your appointment.`,
          `Tap below to view services and grab a spot on the calendar.`,
        ],
        ctaLabel: 'View services & book',
      };
    case 'check_in':
      return {
        subject: `Checking in from ${businessName}`,
        headline: `Hey ${greeting}, just checking in`,
        paragraphs: [
          `Hope your style is still slaying! If you need a touch-up, retwist, or want to try something new, we're here for you.`,
          customMessage?.trim()
            ? esc(customMessage.trim()).replace(/\n/g, '<br />')
            : `Book anytime on our site — we'd love to see you again.`,
        ],
        ctaLabel: 'Book an appointment',
      };
    case 'custom':
      return {
        subject: 'A message from your stylist',
        headline: `Hi ${greeting},`,
        paragraphs: [
          customMessage?.trim()
            ? esc(customMessage.trim()).replace(/\n/g, '<br />')
            : 'Thanks for being a valued client. We wanted to reach out and say hello!',
        ],
        ctaLabel: 'Visit our site',
      };
    case 'book_again':
    default:
      return {
        subject: `Ready for your next appointment at ${businessName}?`,
        headline: `We'd love to see you again, ${greeting}`,
        paragraphs: [
          `It's been a little while — your chair at <strong>${esc(businessName)}</strong> is waiting whenever you're ready.`,
          `Book online in minutes and pick the style and time that works for you.`,
        ],
        ctaLabel: 'Book now',
      };
  }
}

function buildEmailHtml(
  branding: StyldEmailBranding,
  opts: {
    headline: string;
    paragraphs: string[];
    ctaLabel: string;
    replyEmail: string;
  },
): string {
  const { headline, paragraphs, ctaLabel, replyEmail } = opts;
  const ctaGradient = `linear-gradient(135deg,${branding.primaryColor},${branding.secondaryColor})`;

  const bodyHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;color:${branding.softTextColor};font-size:15px;line-height:1.6;">${p}</p>`,
    )
    .join('');

  const siteLabel = branding.siteUrl.replace(/^https?:\/\//, '');

  const body = `<tr>
      <td style="padding:28px 28px 8px;">
        <h2 style="margin:0 0 18px;color:${branding.textColor};font-family:${branding.headingFont};font-size:24px;font-weight:700;letter-spacing:-0.3px;">${esc(headline)}</h2>
        ${bodyHtml}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
          <tr>
            <td style="border-radius:999px;background:${ctaGradient};">
              <a href="${esc(branding.siteUrl)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.02em;">${esc(ctaLabel)}</a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 4px;color:${branding.mutedColor};font-size:13px;">
          Or visit
          <a href="${esc(branding.siteUrl)}" style="color:${branding.primaryColor};text-decoration:none;font-weight:600;">${esc(siteLabel)}</a>
        </p>
        ${
          replyEmail
            ? `<p style="margin:12px 0 0;color:${branding.mutedColor};font-size:13px;">Questions? Email us at <a href="mailto:${esc(replyEmail)}" style="color:${branding.primaryColor};text-decoration:none;">${esc(replyEmail)}</a>.</p>`
            : ''
        }
      </td>
    </tr>`;

  return wrapStyldEmail(branding, body, headline);
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
    const body = await req.json();
    const templateId = String(body.templateId ?? 'book_again') as TemplateId;
    const recipients = Array.isArray(body.recipients) ? body.recipients as Recipient[] : [];
    const customSubject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const customMessage = typeof body.message === 'string' ? body.message.trim() : '';

    if (!recipients.length) return jsonResponse({ error: 'No recipients provided' }, 400);
    if (recipients.length > 50) return jsonResponse({ error: 'Maximum 50 recipients per send' }, 400);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const resendFromFallback = Deno.env.get('RESEND_FROM') ?? 'Styld <bookings@styldd.com>';
    const rootDomain = Deno.env.get('STYLD_ROOT_DOMAIN') ?? 'styldd.com';
    if (!resendKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: subdomainRow } = await admin
      .from('styld_site_subdomains')
      .select('subdomain')
      .eq('user_id', userId)
      .maybeSingle();

    const subdomain = String(subdomainRow?.subdomain ?? '').trim();

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
    const siteUrl = subdomain ? `https://${subdomain}.${rootDomain}` : `https://${rootDomain}`;
    const branding = await loadSiteEmailBranding(admin, userId, siteUrl);

    const fromAddress = buildFromAddress(branding.businessName, subdomain, rootDomain, resendFromFallback);

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      const email = String(recipient.email ?? '').trim().toLowerCase();
      const name = String(recipient.name ?? '').trim() || 'there';

      if (!email || !email.includes('@')) {
        skipped += 1;
        continue;
      }

      const template = templateBody(templateId, {
        clientName: name,
        businessName: branding.businessName,
        businessCity: branding.businessCity,
        siteUrl,
        customMessage,
      });

      const subject = customSubject || template.subject;
      const html = buildEmailHtml(branding, {
        headline: template.headline,
        paragraphs: template.paragraphs,
        ctaLabel: template.ctaLabel,
        replyEmail,
      });

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [email],
          subject,
          html,
          ...(replyEmail ? { reply_to: replyEmail } : {}),
        }),
      });

      if (!emailRes.ok) {
        failed += 1;
        const errText = await emailRes.text();
        errors.push(`${email}: ${errText.slice(0, 120)}`);
        continue;
      }

      sent += 1;
    }

    return jsonResponse({
      ok: sent > 0,
      sent,
      skipped,
      failed,
      ...(errors.length ? { errors } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('client-contact-email error:', err);
    return jsonResponse({ error: msg }, 500);
  }
});
