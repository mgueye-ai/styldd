import { loadSiteEmailBranding, StyldEmailBranding, wrapStyldEmail } from './styld-email-brand.ts';

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

function fmtWhen(startsAt: string | null): string {
  if (!startsAt) return 'your scheduled time';
  try {
    return new Date(startsAt).toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
    });
  } catch {
    return startsAt;
  }
}

export async function sendClientCancellationEmail(opts: {
  branding: StyldEmailBranding;
  fromAddress: string;
  resendKey: string;
  clientEmail: string;
  clientName: string;
  service: string;
  startsAt: string | null;
  refundAmountCents: number;
  refundStatus: string;
  cancelledBy: 'client' | 'stylist';
  policySummary: string;
}): Promise<{ ok: boolean; error?: string }> {
  const {
    branding,
    fromAddress,
    resendKey,
    clientEmail,
    clientName,
    service,
    startsAt,
    refundAmountCents,
    refundStatus,
    cancelledBy,
    policySummary,
  } = opts;

  const first = clientName.trim().split(/\s+/)[0] || 'there';
  const refundLine =
    refundStatus === 'succeeded' && refundAmountCents > 0
      ? `<p style="margin:0 0 14px;color:${branding.primaryColor};font-size:15px;font-weight:700;">A refund of ${money(refundAmountCents)} has been initiated to your original payment method. It may take 5–10 business days to appear.</p>`
      : refundStatus === 'pending' && refundAmountCents > 0
        ? `<p style="margin:0 0 14px;color:${branding.softTextColor};font-size:14px;">Your refund of ${money(refundAmountCents)} is being processed.</p>`
        : `<p style="margin:0 0 14px;color:${branding.softTextColor};font-size:14px;">No refund applies for this cancellation based on the booking policy.</p>`;

  const intro =
    cancelledBy === 'stylist'
      ? `${esc(branding.businessName)} cancelled your appointment.`
      : 'Your appointment has been cancelled.';

  const body = `<tr><td style="padding:28px;">
<h2 style="margin:0 0 12px;color:${branding.textColor};font-family:${branding.headingFont};font-size:24px;font-weight:700;">Appointment cancelled</h2>
<p style="margin:0 0 14px;color:${branding.softTextColor};font-size:15px;line-height:1.6;">Hi ${esc(first)}, ${intro}</p>
<div style="background:${branding.innerCardBg};border-radius:12px;border:1px solid ${branding.borderColor};padding:16px;margin-bottom:16px;">
  <p style="margin:0 0 8px;color:${branding.mutedColor};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Cancelled appointment</p>
  <p style="margin:0;color:${branding.textColor};font-size:15px;font-weight:700;">${esc(service)}</p>
  <p style="margin:6px 0 0;color:${branding.softTextColor};font-size:14px;">${esc(fmtWhen(startsAt))}</p>
</div>
${refundLine}
<p style="margin:0;color:${branding.mutedColor};font-size:13px;line-height:1.5;">${esc(policySummary)}</p>
</td></tr>`;

  const html = wrapStyldEmail(branding, body, `Appointment cancelled – ${branding.businessName}`);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [clientEmail],
      subject: `Appointment cancelled – ${branding.businessName}`,
      html,
    }),
  });

  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}

export async function sendStylistCancellationEmail(opts: {
  branding: StyldEmailBranding;
  fromAddress: string;
  resendKey: string;
  stylistEmail: string;
  clientName: string;
  service: string;
  startsAt: string | null;
  cancelledBy: 'client' | 'stylist';
  refundAmountCents: number;
  refundStatus: string;
}): Promise<{ ok: boolean; error?: string }> {
  const {
    branding,
    fromAddress,
    resendKey,
    stylistEmail,
    clientName,
    service,
    startsAt,
    cancelledBy,
    refundAmountCents,
    refundStatus,
  } = opts;

  const who =
    cancelledBy === 'client'
      ? `${esc(clientName)} cancelled their appointment`
      : 'You cancelled an appointment';

  const refundNote =
    refundStatus === 'succeeded' && refundAmountCents > 0
      ? ` A refund of ${money(refundAmountCents)} was issued to the client.`
      : '';

  const body = `<tr><td style="padding:28px;">
<h2 style="margin:0 0 12px;color:${branding.textColor};font-family:${branding.headingFont};font-size:24px;font-weight:700;">Booking cancelled</h2>
<p style="margin:0 0 14px;color:${branding.softTextColor};font-size:15px;line-height:1.6;">${who}:</p>
<div style="background:${branding.innerCardBg};border-radius:12px;border:1px solid ${branding.borderColor};padding:16px;">
  <p style="margin:0;color:${branding.textColor};font-size:15px;font-weight:700;">${esc(service)}</p>
  <p style="margin:6px 0 0;color:${branding.softTextColor};font-size:14px;">${esc(clientName)} · ${esc(fmtWhen(startsAt))}</p>
</div>
<p style="margin:16px 0 0;color:${branding.mutedColor};font-size:13px;">${refundNote}</p>
</td></tr>`;

  const html = wrapStyldEmail(branding, body, `Booking cancelled – ${branding.businessName}`);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [stylistEmail],
      subject: `Booking cancelled – ${clientName}`,
      html,
    }),
  });

  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}

export { loadSiteEmailBranding };
