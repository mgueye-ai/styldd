/**
 * Salon + customer booking emails (Resend).
 * Optional `PUBLIC_SITE_URL` or `SITE_URL` (no trailing slash) — logo + footer links in branded shell.
 */
import {
  emailAppointmentHero,
  emailButton,
  emailCallout,
  emailDetailRows,
  emailEyebrow,
  emailP,
  emailSectionTitle,
  emailSignoff,
  wrapBrandedEmail,
} from "./email-brand.ts";
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
  const rows: Array<{ label: string; valueHtml: string }> = [
    { label: "Booking ID", valueHtml: `<code>${escapeHtml(id)}</code>` },
    { label: "Name", valueHtml: name },
    { label: "Email", valueHtml: `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` },
    { label: "Phone", valueHtml: phone },
    { label: "Style", valueHtml: style },
    { label: "Date", valueHtml: date },
    { label: "Time", valueHtml: slot },
    { label: "Est. total", valueHtml: total },
    { label: "Deposit", valueHtml: deposit },
  ];
  if (styleId.startsWith("house-") && addrRaw) {
    rows.splice(5, 0, {
      label: "Service address",
      valueHtml: escapeHtml(addrRaw).replace(/\n/g, "<br/>"),
    });
  }

  const inner =
    emailEyebrow("New booking") +
    emailSectionTitle("Someone just booked online") +
    emailP("Here is everything we captured from the form. You can reply directly to the client from your inbox.") +
    emailDetailRows(rows);

  return sendResendEmail({
    to: [notifyTo],
    subject: `New booking — ${String(record.style_name || "Hair by Nadjae").slice(0, 80)}`,
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
    emailEyebrow("Contact form") +
    emailSectionTitle("New website message") +
    emailP("Someone reached out through your contact page.") +
    emailDetailRows([
      { label: "Name", valueHtml: name },
      { label: "Email", valueHtml: `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` },
      { label: "Phone", valueHtml: phone },
    ]) +
    emailP("<strong>Their message</strong>", { marginBottom: 8 }) +
    emailCallout(`<p style="margin:0;font-size:15px;line-height:1.6;color:#3d3428;">${message.replace(/\n/g, "<br/>")}</p>`, "rose");

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
  const detailRows: Array<{ label: string; valueHtml: string }> = [
    { label: "Booking ref", valueHtml: `<code>${escapeHtml(id)}</code>` },
    { label: "Service", valueHtml: style },
  ];
  if (styleId.startsWith("house-") && addrCust) {
    detailRows.push({
      label: "Service address",
      valueHtml: escapeHtml(addrCust).replace(/\n/g, "<br/>"),
    });
  }
  detailRows.push(
    { label: "Estimated total", valueHtml: total },
    { label: "Deposit due", valueHtml: `${deposit}${escapeHtml(houseNote)}` },
  );

  const baseUrl = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
  const detailsLink = baseUrl
    ? `${baseUrl}/booking-details.html?booking_id=${encodeURIComponent(id)}`
    : "";

  const inner =
    emailP(`Hi ${escapeHtml(first)},`, { marginBottom: 12 }) +
    emailP(`Thank you for choosing <strong>Hair by Nadjae</strong>. Your request is in — we will follow up to confirm your appointment.`) +
    emailAppointmentHero(dateShow, `Starting at ${slot}`) +
    emailDetailRows(detailRows) +
    emailCallout(
      `<strong style="color:#8b4513;">Please note:</strong> All deposits are <strong>non-refundable</strong>.`,
      "amber",
    ) +
    (detailsLink
      ? emailButton(detailsLink, "View your booking details") +
        emailP(`Or save this email — you will need your booking ID for <strong>Lookup Booking</strong> or changes.`, { marginBottom: 0 })
      : emailP(`Save this email — you will need your booking ID for any changes.`, { marginBottom: 0 })) +
    emailP(`If you pay your deposit online, you will get a separate message when payment is received.`) +
    emailSignoff();

  const salonCopy = Deno.env.get("NOTIFY_TO_EMAIL")?.trim() || "";
  const custNorm = email.toLowerCase();
  const salonNorm = salonCopy.toLowerCase();
  const bcc = salonCopy && salonNorm !== custNorm ? [salonCopy] : undefined;

  return sendResendEmail({
    to: [email],
    bcc,
    subject: `We received your booking — Hair by Nadjae`,
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
    (Deno.env.get("REMINDER_STUDIO_ADDRESS") ?? "").trim() || "16 Sullivan Dr, Norwich, CT 06360";

  const fullName = String(record.full_name ?? "there").trim();
  const first = fullName.split(/\s+/)[0] || fullName;
  const style = escapeHtml(String(record.style_name ?? record.style_id ?? "your service"));
  const dateShow = escapeHtml(formatAppointmentDate(String(record.appointment_date ?? "")));
  const slot = escapeHtml(String(record.appointment_slot ?? "—"));
  const sid = String(record.style_id ?? "");
  const addrRem = String(record.service_address ?? "").trim();
  const rows: Array<{ label: string; valueHtml: string }> = [
    { label: "Service", valueHtml: style },
    { label: "Studio", valueHtml: escapeHtml(studioAddress) },
  ];
  if (sid.startsWith("house-") && addrRem) {
    rows.push({
      label: "House-call address",
      valueHtml: escapeHtml(addrRem).replace(/\n/g, "<br/>"),
    });
  }

  const inner =
    emailEyebrow("Reminder") +
    emailP(`Hi ${escapeHtml(first)},`, { marginBottom: 10 }) +
    emailP(
      `This is a friendly heads-up: your appointment at <strong>Hair by Nadjae</strong> is coming up <strong>in about 24 hours</strong> (from when this email was sent).`,
    ) +
    emailAppointmentHero(dateShow, `Arrive for ${slot}`) +
    emailDetailRows(rows) +
    emailCallout(`<p style="margin:0;"><strong>Tip:</strong> Running late? Reply to this email or call us as soon as you can.</p>`, "rose") +
    emailP(`We can't wait to see you.`, { marginBottom: 0 }) +
    emailSignoff();

  return sendResendEmail({
    to: [email],
    subject: `Reminder: Your upcoming appointment — Hair by Nadjae`,
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

  const titlePlain = formatAppointmentDate(isoDate);
  const titleDate = escapeHtml(titlePlain);
  const lines =
    rows.length === 0
      ? emailCallout(`<p style="margin:0;">No appointments on the calendar for <strong>${titleDate}</strong>. Enjoy the breathing room.</p>`, "rose")
      : `<table class="data-sheet" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;font-size:14px;border-radius:14px;overflow:hidden;border:1px solid rgba(219,39,119,0.16);box-shadow:0 4px 18px rgba(44,36,22,0.06);">` +
        `<thead><tr>` +
        `<th align="left" style="padding:12px 10px;border-bottom:1px solid rgba(219,39,119,0.15);">Time</th>` +
        `<th align="left" style="padding:12px 10px;border-bottom:1px solid rgba(219,39,119,0.15);">Client</th>` +
        `<th align="left" style="padding:12px 10px;border-bottom:1px solid rgba(219,39,119,0.15);">Phone</th>` +
        `<th align="left" style="padding:12px 10px;border-bottom:1px solid rgba(219,39,119,0.15);">Style</th>` +
        `<th align="left" style="padding:12px 10px;border-bottom:1px solid rgba(219,39,119,0.15);">Location</th>` +
        `</tr></thead><tbody>` +
        rows
          .map((r, i) => {
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
            const bg = i % 2 === 0 ? "#fffcfa" : "#ffffff";
            return `<tr><td style="padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);vertical-align:top;background:${bg};">${slot}</td><td style="padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);vertical-align:top;background:${bg};font-weight:600;color:#2c2416;">${name}</td><td style="padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);vertical-align:top;background:${bg};">${phone}</td><td style="padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);vertical-align:top;background:${bg};">${st}</td><td style="padding:10px;border-bottom:1px solid rgba(219,39,119,0.08);vertical-align:top;background:${bg};">${loc}</td></tr>`;
          })
          .join("") +
        `</tbody></table>`;

  const inner =
    emailEyebrow("Daily digest") +
    emailSectionTitle(`Your day at a glance`) +
    emailP(`Schedule for <strong>${titleDate}</strong> — all times as booked in the system.`) +
    lines +
    emailP(`Sent automatically from your Hair by Nadjae booking tools.`, { marginBottom: 0 });

  return sendResendEmail({
    to: [notifyTo],
    subject: `Today's appointments (${titlePlain}) — Hair by Nadjae`,
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
      ? { label: "Service address" as const, valueHtml: escapeHtml(addrRaw).replace(/\n/g, "<br/>") }
      : null;
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
  const rows: Array<{ label: string; valueHtml: string }> = [
    { label: "Booking ID", valueHtml: `<code>${escapeHtml(b.id)}</code>` },
    { label: "Client", valueHtml: escapeHtml(b.fullName) },
    { label: "Email", valueHtml: `<a href="mailto:${escapeHtml(b.customerEmail)}">${escapeHtml(b.customerEmail)}</a>` },
    { label: "Service", valueHtml: b.style },
    { label: "Was scheduled", valueHtml: `${b.date} · ${b.slot}` },
  ];
  if (b.addrLine) rows.splice(4, 0, b.addrLine);
  rows.push(
    { label: "Est. total", valueHtml: b.total },
    { label: "Deposit", valueHtml: b.deposit },
  );
  const inner =
    emailEyebrow("Cancelled") +
    emailSectionTitle("A booking was cancelled") +
    emailP("The client cancelled through the site or you updated their status. Summary below.") +
    emailDetailRows(rows);
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
    ? emailButton(b.detailsLink, "View booking details")
    : "";
  const inner =
    emailP(`Hi ${escapeHtml(b.first)},`, { marginBottom: 12 }) +
    emailP(`Your appointment with <strong>Hair by Nadjae</strong> has been marked as <strong>cancelled</strong>.`) +
    emailDetailRows([
      { label: "Booking ref", valueHtml: `<code>${escapeHtml(b.id)}</code>` },
      { label: "Service", valueHtml: b.style },
      { label: "Cancelled slot", valueHtml: `${b.date} · ${b.slot}` },
    ]) +
    emailP(`If this was a mistake, reply to this email or call us and we will help you rebook.`) +
    linkBlock +
    emailSignoff();
  const salonCopy = Deno.env.get("NOTIFY_TO_EMAIL")?.trim() || "";
  const bcc = salonCopy && salonCopy.toLowerCase() !== b.customerEmail.toLowerCase() ? [salonCopy] : undefined;
  return sendResendEmail({
    to: [b.customerEmail],
    bcc,
    subject: `Booking cancelled — Hair by Nadjae`,
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
  const rows: Array<{ label: string; valueHtml: string }> = [
    { label: "Booking ID", valueHtml: `<code>${escapeHtml(b.id)}</code>` },
    { label: "Client", valueHtml: escapeHtml(b.fullName) },
    { label: "Email", valueHtml: `<a href="mailto:${escapeHtml(b.customerEmail)}">${escapeHtml(b.customerEmail)}</a>` },
    { label: "Service", valueHtml: b.style },
    { label: "Previous time", valueHtml: `${prevDate} · ${prevSlot}` },
    { label: "New time", valueHtml: `${b.date} · ${b.slot}` },
  ];
  if (b.addrLine) rows.splice(4, 0, b.addrLine);
  const inner =
    emailEyebrow("Rescheduled") +
    emailSectionTitle("Appointment time changed") +
    emailP("A client updated their slot. Here is the before and after.") +
    emailDetailRows(rows);
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
    ? emailButton(b.detailsLink, "View your updated booking")
    : "";
  const detailRows: Array<{ label: string; valueHtml: string }> = [
    { label: "Booking ref", valueHtml: `<code>${escapeHtml(b.id)}</code>` },
    { label: "Service", valueHtml: b.style },
    { label: "Previous", valueHtml: `${prevDate} · ${prevSlot}` },
    { label: "New time", valueHtml: `${b.date} · ${b.slot}` },
  ];
  if (b.addrLine) detailRows.splice(2, 0, b.addrLine);
  const inner =
    emailP(`Hi ${escapeHtml(b.first)},`, { marginBottom: 12 }) +
    emailP(`Good news — your appointment with <strong>Hair by Nadjae</strong> has been <strong>updated</strong>. Here are your new details.`) +
    emailAppointmentHero(`${b.date}`, `Now at ${b.slot}`) +
    emailDetailRows(detailRows) +
    linkBlock +
    emailP(`Questions? Just reply to this email.`) +
    emailSignoff();
  const salonCopy = Deno.env.get("NOTIFY_TO_EMAIL")?.trim() || "";
  const bcc = salonCopy && salonCopy.toLowerCase() !== b.customerEmail.toLowerCase() ? [salonCopy] : undefined;
  return sendResendEmail({
    to: [b.customerEmail],
    bcc,
    subject: `Appointment rescheduled — Hair by Nadjae`,
    html: wrapBrandedEmail(inner),
  });
}
