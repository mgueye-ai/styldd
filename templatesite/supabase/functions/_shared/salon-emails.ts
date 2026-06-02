/**
 * Salon + customer booking emails (Resend).
 * Optional `PUBLIC_SITE_URL` or `SITE_URL` (no trailing slash) — logo + footer links in branded shell.
 */
import { wrapBrandedEmail } from "./email-brand.ts";
import { escapeHtml, sendResendEmail } from "./resend.ts";

function formatAppointmentDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || "—";
  const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export async function sendSalonBookingNotification(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const notifyTo = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  if (!notifyTo) return { ok: false, error: "NOTIFY_TO_EMAIL not set" };

  const id = String(record.id ?? "");
  const name = escapeHtml(String(record.full_name ?? "—"));
  const email = String(record.email ?? "");
  const phoneRaw = String(record.phone ?? "").trim();
  const digits = phoneRaw.replace(/\D/g, "");
  const telHref =
    digits.length === 10 ? `tel:+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `tel:+${digits}` : digits ? `tel:+${digits}` : "";
  const phone =
    telHref && phoneRaw
      ? `<a href="${escapeHtml(telHref)}">${escapeHtml(phoneRaw)}</a>`
      : escapeHtml(phoneRaw || "—");
  const style = escapeHtml(String(record.style_name ?? record.style_id ?? "—"));
  const date = escapeHtml(String(record.appointment_date ?? "—"));
  const slot = escapeHtml(String(record.appointment_slot ?? "—"));
  const deposit = escapeHtml(String(record.deposit_amount ?? "—"));
  const total = escapeHtml(String(record.estimated_total ?? "—"));
  const addrRaw = String(record.service_address ?? "").trim();
  const styleId = String(record.style_id ?? "");
  const addrLine =
    styleId.startsWith("house-") && addrRaw
      ? `<li><strong>Service address:</strong> ${escapeHtml(addrRaw).replace(/\n/g, "<br/>")}</li>`
      : "";

  const inner =
    `<p style="margin-top:0;"><strong style="color:#c45d7a;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">New booking</strong></p>` +
    `<p><strong>New online booking</strong> — details below.</p>` +
    `<ul>` +
    `<li><strong>Booking ID:</strong> <code>${escapeHtml(id)}</code></li>` +
    `<li><strong>Name:</strong> ${name}</li>` +
    `<li><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></li>` +
    `<li><strong>Phone:</strong> ${phone}</li>` +
    `<li><strong>Style:</strong> ${style}</li>` +
    addrLine +
    `<li><strong>Date:</strong> ${date}</li>` +
    `<li><strong>Time:</strong> ${slot}</li>` +
    `<li><strong>Est. total:</strong> ${total}</li>` +
    `<li><strong>Deposit:</strong> ${deposit}</li>` +
    `</ul>`;

  return sendResendEmail({
    to: [notifyTo],
    subject: `New booking — ${String(record.style_name || "Your brand name").slice(0, 80)}`,
    html: wrapBrandedEmail(inner),
  });
}

export async function sendSalonInquiryNotification(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const notifyTo = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  if (!notifyTo) return { ok: false, error: "NOTIFY_TO_EMAIL not set" };

  const name = escapeHtml(String(record.full_name ?? "—"));
  const email = String(record.email ?? "").trim();
  const phone = escapeHtml(String(record.phone ?? "—"));
  const message = escapeHtml(String(record.message ?? "—"));

  const inner =
    `<p style="margin-top:0;"><strong style="color:#c45d7a;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Contact form</strong></p>` +
    `<p><strong>New message</strong> from your website.</p>` +
    `<ul>` +
    `<li><strong>Name:</strong> ${name}</li>` +
    `<li><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></li>` +
    `<li><strong>Phone:</strong> ${phone}</li>` +
    `</ul>` +
    `<p><strong>Message</strong></p><p>${message.replace(/\n/g, "<br/>")}</p>`;

  return sendResendEmail({
    to: [notifyTo],
    subject: `Website inquiry from ${String(record.full_name || "visitor").slice(0, 60)}`,
    html: wrapBrandedEmail(inner),
    replyTo: email || undefined,
  });
}

/** Confirmation to the guest after a booking row is saved (deduped with salon notify). */
export async function sendCustomerBookingConfirmation(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const email = String(record.email ?? "").trim();
  if (!email || !email.includes("@")) return { ok: false, error: "Invalid customer email" };

  const id = String(record.id ?? "");
  const fullName = String(record.full_name ?? "there").trim();
  const first = fullName.split(/\s+/)[0] || fullName;
  const style = escapeHtml(String(record.style_name ?? record.style_id ?? "your service"));
  const dateShow = escapeHtml(formatAppointmentDate(String(record.appointment_date ?? "")));
  const slot = escapeHtml(String(record.appointment_slot ?? "—"));
  const total = escapeHtml(String(record.estimated_total ?? "—"));
  const deposit = escapeHtml(String(record.deposit_amount ?? "—"));
  const styleId = String(record.style_id ?? "");
  const houseNote =
    styleId.startsWith("house-")
      ? " Includes 10% of your estimate plus the $15 house-call deposit."
      : "";
  const addrCust = String(record.service_address ?? "").trim();
  const addrBlock =
    styleId.startsWith("house-") && addrCust
      ? `<li><strong>Service address:</strong> ${escapeHtml(addrCust).replace(/\n/g, "<br/>")}</li>`
      : "";

  const baseUrl = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  const detailsLink = baseUrl
    ? `${baseUrl}/booking-details.html?booking_id=${encodeURIComponent(id)}`
    : "";

  const linkBlock = detailsLink
    ? `<p><a href="${escapeHtml(detailsLink)}">View your booking details</a></p>`
    : `<p>Save this email — you will need your booking ID for any changes.</p>`;

  const inner =
    `<p style="margin-top:0;">Hi ${escapeHtml(first)},</p>` +
    `<p>Thank you for booking with <strong>Your brand name</strong>. We have received your request.</p>` +
    `<p><strong>Booking reference:</strong> <code>${escapeHtml(id)}</code></p>` +
    `<ul>` +
    `<li><strong>Appointment:</strong> ${dateShow} at ${slot}</li>` +
    `<li><strong>Service:</strong> ${style}</li>` +
    addrBlock +
    `<li><strong>Estimated total:</strong> ${total}</li>` +
    `<li><strong>Deposit due:</strong> ${deposit}${houseNote}</li>` +
    `</ul>` +
    `<p><strong>Important:</strong> All deposits are <strong>non-refundable</strong>.</p>` +
    linkBlock +
    `<p>If you pay your deposit online, you will get a separate message when payment is received. We will follow up to confirm your appointment.</p>` +
    `<p style="margin-bottom:0;">— Your brand name</p>`;

  const salonCopy = Deno.env.get("NOTIFY_TO_EMAIL")?.trim() || "";
  const custNorm = email.toLowerCase();
  const salonNorm = salonCopy.toLowerCase();
  const bcc = salonCopy && salonNorm !== custNorm ? [salonCopy] : undefined;

  return sendResendEmail({
    to: [email],
    bcc,
    subject: `We received your booking — Your brand name`,
    html: wrapBrandedEmail(inner),
  });
}

/**
 * ~24 hours before start — includes studio address here only (not published on the marketing site).
 * Optional env REMINDER_STUDIO_ADDRESS overrides the default line below.
 */
export async function sendCustomerAppointmentReminder(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const email = String(record.email ?? "").trim();
  if (!email || !email.includes("@")) return { ok: false, error: "Invalid customer email" };

  const studioAddress =
    (Deno.env.get("REMINDER_STUDIO_ADDRESS") ?? "").trim() || "Set REMINDER_STUDIO_ADDRESS in Supabase secrets";

  const fullName = String(record.full_name ?? "there").trim();
  const first = fullName.split(/\s+/)[0] || fullName;
  const style = escapeHtml(String(record.style_name ?? record.style_id ?? "your service"));
  const dateShow = escapeHtml(formatAppointmentDate(String(record.appointment_date ?? "")));
  const slot = escapeHtml(String(record.appointment_slot ?? "—"));
  const sid = String(record.style_id ?? "");
  const addrRem = String(record.service_address ?? "").trim();
  const houseAddrHtml =
    sid.startsWith("house-") && addrRem
      ? `<li><strong>House-call address:</strong> ${escapeHtml(addrRem).replace(/\n/g, "<br/>")}</li>`
      : "";

  const inner =
    `<p style="margin-top:0;">Hi ${escapeHtml(first)},</p>` +
    `<p>This is a friendly reminder: your appointment at <strong>Your brand name</strong> is coming up <strong>in about 24 hours</strong> (relative to when this message was sent).</p>` +
    `<ul>` +
    `<li><strong>When:</strong> ${dateShow} at ${slot}</li>` +
    `<li><strong>Service:</strong> ${style}</li>` +
    `<li><strong>Studio address:</strong> ${escapeHtml(studioAddress)}</li>` +
    houseAddrHtml +
    `</ul>` +
    `<p style="margin-bottom:0;">See you soon!<br/>— Your brand name</p>`;

  return sendResendEmail({
    to: [email],
    subject: `Reminder: Your upcoming appointment — Your brand name`,
    html: wrapBrandedEmail(inner),
  });
}

/** Owner digest of everything on the calendar for a given calendar day (ET date string YYYY-MM-DD). */
export async function sendOwnerDailyAppointmentDigest(
  rows: Record<string, unknown>[],
  isoDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const notifyTo = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  if (!notifyTo) return { ok: false, error: "NOTIFY_TO_EMAIL not set" };

  const titleDate = escapeHtml(formatAppointmentDate(isoDate));
  const lines =
    rows.length === 0
      ? `<p>No appointments scheduled for ${titleDate}.</p>`
      : `<table class="data-sheet" cellpadding="10" cellspacing="0" border="1" width="100%" style="border-collapse:collapse;font-size:14px;border:1px solid rgba(219,39,119,0.22);border-radius:8px;overflow:hidden;">` +
        `<thead><tr>` +
        `<th align="left" style="padding:10px;border:1px solid rgba(219,39,119,0.2);">Time</th>` +
        `<th align="left" style="padding:10px;border:1px solid rgba(219,39,119,0.2);">Client</th>` +
        `<th align="left" style="padding:10px;border:1px solid rgba(219,39,119,0.2);">Phone</th>` +
        `<th align="left" style="padding:10px;border:1px solid rgba(219,39,119,0.2);">Style</th>` +
        `<th align="left" style="padding:10px;border:1px solid rgba(219,39,119,0.2);">Location</th>` +
        `</tr></thead><tbody>` +
        rows
          .map((r) => {
            const slot = escapeHtml(String(r.appointment_slot ?? "—"));
            const name = escapeHtml(String(r.full_name ?? "—"));
            const phone = escapeHtml(String(r.phone ?? "—"));
            const st = escapeHtml(String(r.style_name ?? r.style_id ?? "—"));
            const sid = String(r.style_id ?? "");
            const addr = String(r.service_address ?? "").trim();
            const loc =
              sid.startsWith("house-") && addr
                ? escapeHtml(addr).replace(/\n/g, "<br/>")
                : sid.startsWith("house-")
                  ? "—"
                  : "Studio";
            return `<tr><td style="padding:8px;border:1px solid rgba(219,39,119,0.15);vertical-align:top;">${slot}</td><td style="padding:8px;border:1px solid rgba(219,39,119,0.15);vertical-align:top;">${name}</td><td style="padding:8px;border:1px solid rgba(219,39,119,0.15);vertical-align:top;">${phone}</td><td style="padding:8px;border:1px solid rgba(219,39,119,0.15);vertical-align:top;">${st}</td><td style="padding:8px;border:1px solid rgba(219,39,119,0.15);vertical-align:top;">${loc}</td></tr>`;
          })
          .join("") +
        `</tbody></table>`;

  const inner =
    `<p style="margin-top:0;"><strong style="color:#c45d7a;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Daily digest</strong></p>` +
    `<p><strong>Schedule — ${titleDate}</strong></p>` +
    lines +
    `<p style="margin-top:16px;margin-bottom:0;font-size:12px;color:#7a6e62;">Sent automatically from this booking system template.</p>`;

  return sendResendEmail({
    to: [notifyTo],
    subject: `Today's appointments (${titleDate}) — Your brand name`,
    html: wrapBrandedEmail(inner),
  });
}

type BookingStatusContext = {
  prevDate?: string;
  prevSlot?: string;
};

function bookingStatusBits(record: Record<string, unknown>) {
  const id = String(record.id ?? "");
  const fullName = String(record.full_name ?? "Client").trim();
  const first = fullName.split(/\s+/)[0] || fullName;
  const customerEmail = String(record.email ?? "").trim();
  const style = escapeHtml(String(record.style_name ?? record.style_id ?? "—"));
  const date = escapeHtml(formatAppointmentDate(String(record.appointment_date ?? "")));
  const slot = escapeHtml(String(record.appointment_slot ?? "—"));
  const deposit = escapeHtml(String(record.deposit_amount ?? "—"));
  const total = escapeHtml(String(record.estimated_total ?? "—"));
  const styleId = String(record.style_id ?? "");
  const addrRaw = String(record.service_address ?? "").trim();
  const addrLine =
    styleId.startsWith("house-") && addrRaw
      ? `<li><strong>Service address:</strong> ${escapeHtml(addrRaw).replace(/\n/g, "<br/>")}</li>`
      : "";
  const baseUrl = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  const detailsLink = baseUrl && id ? `${baseUrl}/booking-details.html?booking_id=${encodeURIComponent(id)}` : "";
  return { id, fullName, first, customerEmail, style, date, slot, deposit, total, addrLine, detailsLink };
}

export async function sendSalonBookingCancelled(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const notifyTo = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  if (!notifyTo) return { ok: false, error: "NOTIFY_TO_EMAIL not set" };
  const b = bookingStatusBits(record);
  const inner =
    `<p style="margin-top:0;"><strong style="color:#c45d7a;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Booking cancelled</strong></p>` +
    `<p>A booking was cancelled by the client.</p>` +
    `<ul>` +
    `<li><strong>Booking ID:</strong> <code>${escapeHtml(b.id)}</code></li>` +
    `<li><strong>Client:</strong> ${escapeHtml(b.fullName)}</li>` +
    `<li><strong>Email:</strong> <a href="mailto:${escapeHtml(b.customerEmail)}">${escapeHtml(b.customerEmail)}</a></li>` +
    `<li><strong>Service:</strong> ${b.style}</li>` +
    `<li><strong>Original appointment:</strong> ${b.date} at ${b.slot}</li>` +
    b.addrLine +
    `<li><strong>Estimated total:</strong> ${b.total}</li>` +
    `<li><strong>Deposit:</strong> ${b.deposit}</li>` +
    `</ul>`;
  return sendResendEmail({
    to: [notifyTo],
    subject: `Booking cancelled — ${String(record.full_name || "Client").slice(0, 80)}`,
    html: wrapBrandedEmail(inner),
  });
}

export async function sendCustomerBookingCancelled(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const b = bookingStatusBits(record);
  if (!b.customerEmail || !b.customerEmail.includes("@")) return { ok: false, error: "Invalid customer email" };
  const linkBlock = b.detailsLink
    ? `<p><a href="${escapeHtml(b.detailsLink)}">View booking details</a></p>`
    : "";
  const inner =
    `<p style="margin-top:0;">Hi ${escapeHtml(b.first)},</p>` +
    `<p>Your appointment with <strong>Your brand name</strong> has been marked as cancelled.</p>` +
    `<ul>` +
    `<li><strong>Booking reference:</strong> <code>${escapeHtml(b.id)}</code></li>` +
    `<li><strong>Service:</strong> ${b.style}</li>` +
    `<li><strong>Cancelled appointment:</strong> ${b.date} at ${b.slot}</li>` +
    `</ul>` +
    `<p>If this was a mistake, reply to this email or call us to rebook.</p>` +
    linkBlock +
    `<p style="margin-bottom:0;">— Your brand name</p>`;
  const salonCopy = Deno.env.get("NOTIFY_TO_EMAIL")?.trim() || "";
  const bcc = salonCopy && salonCopy.toLowerCase() !== b.customerEmail.toLowerCase() ? [salonCopy] : undefined;
  return sendResendEmail({
    to: [b.customerEmail],
    bcc,
    subject: `Booking cancelled — Your brand name`,
    html: wrapBrandedEmail(inner),
  });
}

export async function sendSalonBookingRescheduled(
  record: Record<string, unknown>,
  ctx: BookingStatusContext,
): Promise<{ ok: boolean; error?: string }> {
  const notifyTo = Deno.env.get("NOTIFY_TO_EMAIL")?.trim();
  if (!notifyTo) return { ok: false, error: "NOTIFY_TO_EMAIL not set" };
  const b = bookingStatusBits(record);
  const prevDate = ctx.prevDate ? escapeHtml(formatAppointmentDate(ctx.prevDate)) : "—";
  const prevSlot = ctx.prevSlot ? escapeHtml(ctx.prevSlot) : "—";
  const inner =
    `<p style="margin-top:0;"><strong style="color:#c45d7a;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Booking rescheduled</strong></p>` +
    `<p>A client changed their appointment time.</p>` +
    `<ul>` +
    `<li><strong>Booking ID:</strong> <code>${escapeHtml(b.id)}</code></li>` +
    `<li><strong>Client:</strong> ${escapeHtml(b.fullName)}</li>` +
    `<li><strong>Email:</strong> <a href="mailto:${escapeHtml(b.customerEmail)}">${escapeHtml(b.customerEmail)}</a></li>` +
    `<li><strong>Service:</strong> ${b.style}</li>` +
    `<li><strong>Previous:</strong> ${prevDate} at ${prevSlot}</li>` +
    `<li><strong>New:</strong> ${b.date} at ${b.slot}</li>` +
    b.addrLine +
    `</ul>`;
  return sendResendEmail({
    to: [notifyTo],
    subject: `Booking rescheduled — ${String(record.full_name || "Client").slice(0, 80)}`,
    html: wrapBrandedEmail(inner),
  });
}

export async function sendCustomerBookingRescheduled(
  record: Record<string, unknown>,
  ctx: BookingStatusContext,
): Promise<{ ok: boolean; error?: string }> {
  const b = bookingStatusBits(record);
  if (!b.customerEmail || !b.customerEmail.includes("@")) return { ok: false, error: "Invalid customer email" };
  const prevDate = ctx.prevDate ? escapeHtml(formatAppointmentDate(ctx.prevDate)) : "—";
  const prevSlot = ctx.prevSlot ? escapeHtml(ctx.prevSlot) : "—";
  const linkBlock = b.detailsLink
    ? `<p><a href="${escapeHtml(b.detailsLink)}">View your updated booking details</a></p>`
    : "";
  const inner =
    `<p style="margin-top:0;">Hi ${escapeHtml(b.first)},</p>` +
    `<p>Your appointment with <strong>Your brand name</strong> has been updated.</p>` +
    `<ul>` +
    `<li><strong>Booking reference:</strong> <code>${escapeHtml(b.id)}</code></li>` +
    `<li><strong>Service:</strong> ${b.style}</li>` +
    `<li><strong>Previous appointment:</strong> ${prevDate} at ${prevSlot}</li>` +
    `<li><strong>New appointment:</strong> ${b.date} at ${b.slot}</li>` +
    b.addrLine +
    `</ul>` +
    linkBlock +
    `<p style="margin-bottom:0;">— Your brand name</p>`;
  const salonCopy = Deno.env.get("NOTIFY_TO_EMAIL")?.trim() || "";
  const bcc = salonCopy && salonCopy.toLowerCase() !== b.customerEmail.toLowerCase() ? [salonCopy] : undefined;
  return sendResendEmail({
    to: [b.customerEmail],
    bcc,
    subject: `Appointment rescheduled — Your brand name`,
    html: wrapBrandedEmail(inner),
  });
}
