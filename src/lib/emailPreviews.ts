import { ClientEmailTemplateId } from '../data/clientEmailTemplates';
import { SiteTheme } from '../data/siteTheme';
import { DEFAULT_CANCELLATION_POLICY } from '../data/cancellationPolicy';
import {
  buildBookingManageUrl,
  buildConfirmationCancellationNote,
  resolveStyldEmailBranding,
  StyldEmailBranding,
  wrapStyldEmail,
} from './styldEmailBrand';

export type EmailPreviewId =
  | 'booking_confirmation_deposit'
  | 'booking_confirmation_paid'
  | 'booking_confirmation_in_person'
  | 'review_request'
  | 'client_book_again'
  | 'client_thank_you'
  | 'client_promo'
  | 'client_check_in'
  | 'client_custom';

export type EmailPreviewMeta = {
  id: EmailPreviewId;
  label: string;
  description: string;
  category: 'Booking' | 'Reviews' | 'Client outreach';
  subject: string;
};

export type EmailPreviewContext = {
  clientName: string;
  clientEmail: string;
  businessName: string;
  businessCity: string;
  siteUrl: string;
  replyEmail: string;
  service: string;
  startsAtIso: string;
  durationMinutes: number;
  location: string;
  priceDollars: number;
  depositDollars: number;
  bookingId: string;
  reviewUrl: string;
  cancellationPolicySummary: string;
  logoUrl?: string | null;
  theme?: SiteTheme;
};

export function buildPreviewBranding(ctx: EmailPreviewContext): StyldEmailBranding {
  return resolveStyldEmailBranding({
    businessName: ctx.businessName,
    businessCity: ctx.businessCity,
    siteUrl: ctx.siteUrl,
    logoUrl: ctx.logoUrl,
    theme: ctx.theme,
  });
}

export const DEFAULT_EMAIL_PREVIEW_CONTEXT: EmailPreviewContext = {
  clientName: 'Moustapha Johnson',
  clientEmail: 'moustapha@example.com',
  businessName: 'Hair Heaven',
  businessCity: 'Atlanta',
  siteUrl: 'https://hairheaven.styldd.com',
  replyEmail: 'hello@hairheaven.com',
  service: 'Fulani Braids',
  startsAtIso: '2026-06-29T08:00:00-04:00',
  durationMinutes: 180,
  location: 'Studio',
  priceDollars: 200,
  depositDollars: 20,
  bookingId: 'f66d23c9-8a1b-4c2d-9e3f-1a2b3c4d5e6f',
  reviewUrl: 'https://hairheaven.styldd.com/review.html?token=preview',
  cancellationPolicySummary: DEFAULT_CANCELLATION_POLICY.policySummary,
};

export const EMAIL_PREVIEW_CATALOG: EmailPreviewMeta[] = [
  {
    id: 'booking_confirmation_deposit',
    label: 'Booking confirmed (deposit paid)',
    description: 'Sent after online payment — receipt with balance due',
    category: 'Booking',
    subject: '✓ Booking confirmed – Hair Heaven',
  },
  {
    id: 'booking_confirmation_paid',
    label: 'Booking confirmed (paid in full)',
    description: 'Client paid the full amount upfront',
    category: 'Booking',
    subject: '✓ Booking confirmed – Hair Heaven',
  },
  {
    id: 'booking_confirmation_in_person',
    label: 'Booking confirmed (pay at service)',
    description: 'No card collected — pay in person',
    category: 'Booking',
    subject: '✓ Booking confirmed – Hair Heaven',
  },
  {
    id: 'review_request',
    label: 'Review request',
    description: 'Sent after you mark an appointment complete',
    category: 'Reviews',
    subject: 'How did we do? — Hair Heaven',
  },
  {
    id: 'client_book_again',
    label: 'Book again',
    description: 'Client outreach — invite them back',
    category: 'Client outreach',
    subject: 'Ready for your next appointment at Hair Heaven?',
  },
  {
    id: 'client_thank_you',
    label: 'Thank you',
    description: 'Client outreach — post-visit appreciation',
    category: 'Client outreach',
    subject: 'Thank you for visiting Hair Heaven!',
  },
  {
    id: 'client_promo',
    label: 'Special offer',
    description: 'Client outreach — promotion or deal',
    category: 'Client outreach',
    subject: 'A special offer from Hair Heaven ✨',
  },
  {
    id: 'client_check_in',
    label: 'Check in',
    description: 'Client outreach — friendly follow-up',
    category: 'Client outreach',
    subject: 'Checking in from Hair Heaven',
  },
  {
    id: 'client_custom',
    label: 'Custom message',
    description: 'Client outreach — your own copy',
    category: 'Client outreach',
    subject: 'A message from your stylist',
  },
];

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moneyDollars(amount: number): string {
  return '$' + amount.toFixed(2);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function firstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0] ?? 'there';
}

function buildBookingConfirmationHtml(
  ctx: EmailPreviewContext,
  variant: 'deposit' | 'paid' | 'in_person',
): string {
  const branding = buildPreviewBranding(ctx);
  const priceCents = Math.round(ctx.priceDollars * 100);
  const depositCents = Math.round(ctx.depositDollars * 100);
  const depositPaid = variant !== 'in_person';
  const isInPerson = variant === 'in_person';
  const remainingCents =
    priceCents -
    (depositPaid && variant === 'deposit' ? depositCents : variant === 'paid' ? priceCents : 0);
  const shortId = ctx.bookingId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const manageUrl = buildBookingManageUrl(
    ctx.siteUrl,
    ctx.bookingId,
    ctx.clientEmail,
    ctx.clientName,
  );
  const rowBorder = branding.rowBorderColor;
  const successColor = '#22c55e';

  const depositRow =
    variant === 'deposit' && depositCents > 0 && remainingCents > 0
      ? `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Deposit paid</td>
      <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${successColor};font-size:14px;font-weight:700;text-align:right;">${moneyDollars(depositCents / 100)}</td>
    </tr>
    <tr>
      <td style="padding:10px 0;color:${branding.softTextColor};font-size:14px;">Due at service</td>
      <td style="padding:10px 0;color:${branding.primaryColor};font-size:14px;font-weight:700;text-align:right;">${moneyDollars(remainingCents / 100)}</td>
    </tr>`
      : '';

  const paymentNote = isInPerson
    ? `<p style="margin:0;color:${branding.softTextColor};font-size:13px;">Full payment of <strong style="color:${branding.textColor};">${moneyDollars(priceCents / 100)}</strong> is due at the time of service.</p>`
    : variant === 'deposit' && remainingCents > 0
      ? `<p style="margin:0;color:${branding.softTextColor};font-size:13px;">You have a remaining balance of <strong style="color:${branding.primaryColor};">${moneyDollars(remainingCents / 100)}</strong> due at your appointment.</p>`
      : `<p style="margin:0;color:${successColor};font-size:13px;font-weight:600;">✓ Paid in full</p>`;

  const body = `<tr>
      <td style="padding:20px 28px 16px;text-align:center;">
        <div style="display:inline-block;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);border-radius:999px;padding:6px 18px;margin-bottom:16px;">
          <span style="color:${successColor};font-size:13px;font-weight:700;letter-spacing:0.05em;">✓ BOOKING CONFIRMED</span>
        </div>
        <h2 style="margin:0 0 6px;color:${branding.textColor};font-family:${branding.headingFont};font-size:26px;font-weight:700;letter-spacing:-0.3px;">See you soon, ${esc(firstName(ctx.clientName))}!</h2>
        <p style="margin:0;color:${branding.mutedColor};font-size:14px;">Your appointment has been confirmed. Here's your receipt.</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 28px;">
        <div style="background:${branding.innerCardBg};border-radius:14px;border:1px solid ${branding.borderColor};padding:20px 20px 4px;margin-bottom:20px;">
          <p style="margin:0 0 14px;color:${branding.mutedColor};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Appointment details</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Service</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:700;text-align:right;">${esc(ctx.service)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Date</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:600;text-align:right;">${esc(fmtDate(ctx.startsAtIso))}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Time</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:600;text-align:right;">${esc(fmtTime(ctx.startsAtIso))}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Duration</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:600;text-align:right;">${ctx.durationMinutes} min</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;">Location</td>
              <td style="padding:10px 0;border-bottom:1px solid ${rowBorder};color:${branding.textColor};font-size:14px;font-weight:600;text-align:right;">${esc(ctx.location)}</td>
            </tr>
            <tr>
              <td style="padding:14px 0 10px;border-bottom:1px solid ${rowBorder};color:${branding.softTextColor};font-size:14px;font-weight:700;">Total</td>
              <td style="padding:14px 0 10px;border-bottom:1px solid ${rowBorder};color:${branding.primaryColor};font-size:18px;font-weight:800;text-align:right;">${moneyDollars(priceCents / 100)}</td>
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
          <a href="${esc(ctx.siteUrl)}" style="color:${branding.primaryColor};text-decoration:none;font-weight:600;">${esc(ctx.siteUrl.replace('https://', ''))}</a>
        </p>
        ${buildConfirmationCancellationNote(branding, ctx.cancellationPolicySummary)}
      </td>
    </tr>`;

  return wrapStyldEmail(branding, body, `Booking Confirmed – ${branding.businessName}`);
}

function buildReviewRequestHtml(ctx: EmailPreviewContext): string {
  const branding = buildPreviewBranding(ctx);
  const first = firstName(ctx.clientName);
  const ctaGradient = `linear-gradient(135deg,${branding.primaryColor},${branding.secondaryColor})`;

  const body = `<tr><td style="padding:28px;">
<h2 style="margin:0 0 12px;color:${branding.textColor};font-family:${branding.headingFont};font-size:24px;font-weight:700;">How did we do, ${esc(first)}?</h2>
<p style="margin:0 0 16px;color:${branding.softTextColor};font-size:15px;line-height:1.6;">
  Thanks for visiting us for <strong style="color:${branding.textColor};">${esc(ctx.service)}</strong>.
  We'd love a quick review — it helps other clients find us and means a lot to our team.
</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${ctaGradient};">
<a href="${esc(ctx.reviewUrl)}" style="display:inline-block;padding:14px 28px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">Leave a review</a>
</td></tr></table>
<p style="margin:18px 0 0;color:${branding.mutedColor};font-size:13px;">Or visit <a href="${esc(ctx.siteUrl)}" style="color:${branding.primaryColor};text-decoration:none;">${esc(ctx.siteUrl.replace(/^https?:\/\//, ''))}</a></p>
</td></tr>`;

  return wrapStyldEmail(branding, body, `Review request – ${branding.businessName}`);
}

function clientTemplateCopy(
  templateId: ClientEmailTemplateId,
  ctx: EmailPreviewContext,
): { headline: string; paragraphs: string[]; ctaLabel: string } {
  const greeting = firstName(ctx.clientName);
  const businessName = esc(ctx.businessName);

  switch (templateId) {
    case 'thank_you':
      return {
        headline: `Thanks, ${greeting}!`,
        paragraphs: [
          `We loved having you at <strong>${businessName}</strong>. Hope you're still feeling amazing in your new look.`,
          'If you have a moment, we would appreciate a shout-out or tag on social — it helps us grow and means the world.',
        ],
        ctaLabel: 'Book your next visit',
      };
    case 'promo':
      return {
        headline: `Something special for you, ${greeting}`,
        paragraphs: [
          `We're running a limited-time offer for our favorite clients. Book this week and mention this email at your appointment.`,
          `Tap below to view services and grab a spot on the calendar.`,
        ],
        ctaLabel: 'View services & book',
      };
    case 'check_in':
      return {
        headline: `Hey ${greeting}, just checking in`,
        paragraphs: [
          `Hope your style is still slaying! If you need a touch-up, retwist, or want to try something new, we're here for you.`,
          `Book anytime on our site — we'd love to see you again.`,
        ],
        ctaLabel: 'Book an appointment',
      };
    case 'custom':
      return {
        headline: `Hi ${greeting},`,
        paragraphs: [
          'Thanks for being a valued client. We wanted to reach out and say hello!',
        ],
        ctaLabel: 'Visit our site',
      };
    case 'book_again':
    default:
      return {
        headline: `We'd love to see you again, ${greeting}`,
        paragraphs: [
          `It's been a little while — your chair at <strong>${businessName}</strong> is waiting whenever you're ready.`,
          `Book online in minutes and pick the style and time that works for you.`,
        ],
        ctaLabel: 'Book now',
      };
  }
}

function buildClientOutreachHtml(
  templateId: ClientEmailTemplateId,
  ctx: EmailPreviewContext,
): string {
  const branding = buildPreviewBranding(ctx);
  const { headline, paragraphs, ctaLabel } = clientTemplateCopy(templateId, ctx);
  const ctaGradient = `linear-gradient(135deg,${branding.primaryColor},${branding.secondaryColor})`;
  const bodyHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;color:${branding.softTextColor};font-size:15px;line-height:1.6;">${p}</p>`,
    )
    .join('');
  const siteLabel = ctx.siteUrl.replace(/^https?:\/\//, '');

  const body = `<tr>
      <td style="padding:28px 28px 8px;">
        <h2 style="margin:0 0 18px;color:${branding.textColor};font-family:${branding.headingFont};font-size:24px;font-weight:700;letter-spacing:-0.3px;">${esc(headline)}</h2>
        ${bodyHtml}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
          <tr>
            <td style="border-radius:999px;background:${ctaGradient};">
              <a href="${esc(ctx.siteUrl)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.02em;">${esc(ctaLabel)}</a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 4px;color:${branding.mutedColor};font-size:13px;">
          Or visit
          <a href="${esc(ctx.siteUrl)}" style="color:${branding.primaryColor};text-decoration:none;font-weight:600;">${esc(siteLabel)}</a>
        </p>
        <p style="margin:12px 0 0;color:${branding.mutedColor};font-size:13px;">Questions? Email us at <a href="mailto:${esc(ctx.replyEmail)}" style="color:${branding.primaryColor};text-decoration:none;">${esc(ctx.replyEmail)}</a>.</p>
      </td>
    </tr>`;

  return wrapStyldEmail(branding, body, headline);
}

export function getEmailPreviewSubject(id: EmailPreviewId, ctx: EmailPreviewContext): string {
  const businessName = ctx.businessName;
  switch (id) {
    case 'booking_confirmation_deposit':
    case 'booking_confirmation_paid':
    case 'booking_confirmation_in_person':
      return `✓ Booking confirmed – ${businessName}`;
    case 'review_request':
      return `How did we do? — ${businessName}`;
    case 'client_book_again':
      return `Ready for your next appointment at ${businessName}?`;
    case 'client_thank_you':
      return `Thank you for visiting ${businessName}!`;
    case 'client_promo':
      return `A special offer from ${businessName} ✨`;
    case 'client_check_in':
      return `Checking in from ${businessName}`;
    case 'client_custom':
      return 'A message from your stylist';
    default:
      return 'Email preview';
  }
}

export function buildEmailPreviewHtml(id: EmailPreviewId, ctx: EmailPreviewContext): string {
  switch (id) {
    case 'booking_confirmation_deposit':
      return buildBookingConfirmationHtml(ctx, 'deposit');
    case 'booking_confirmation_paid':
      return buildBookingConfirmationHtml(ctx, 'paid');
    case 'booking_confirmation_in_person':
      return buildBookingConfirmationHtml(ctx, 'in_person');
    case 'review_request':
      return buildReviewRequestHtml(ctx);
    case 'client_book_again':
      return buildClientOutreachHtml('book_again', ctx);
    case 'client_thank_you':
      return buildClientOutreachHtml('thank_you', ctx);
    case 'client_promo':
      return buildClientOutreachHtml('promo', ctx);
    case 'client_check_in':
      return buildClientOutreachHtml('check_in', ctx);
    case 'client_custom':
      return buildClientOutreachHtml('custom', ctx);
    default:
      return '<p>Unknown preview</p>';
  }
}

export function getEmailPreviewMeta(id: EmailPreviewId): EmailPreviewMeta | undefined {
  return EMAIL_PREVIEW_CATALOG.find((item) => item.id === id);
}
