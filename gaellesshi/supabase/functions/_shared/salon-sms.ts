/**
 * Salon + customer booking SMS — Blooio API, parallel to salon-emails.ts (Resend).
 */
import { isBlooioSmsEnabled, sendBlooioSms } from "./blooio-sms.ts";
import { normalizePhoneToE164 } from "./phone-e164.ts";

function fmtDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || "—";
  const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** Full UUID for Lookup Booking — SMS stays plain text (no long URLs). */
function bookingReferenceLine(id: string): string {
  const trimmed = String(id ?? "").trim();
  return trimmed ? `\nBooking reference: ${trimmed}` : "";
}

export async function sendSalonBookingNotificationSms(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!isBlooioSmsEnabled()) return { ok: true, skipped: true };
  const to = Deno.env.get("NOTIFY_TO_PHONE")?.trim();
  if (!to) return { ok: true, skipped: true };

  const id = String(record.id ?? "");
  const name = String(record.full_name ?? "—");
  const email = String(record.email ?? "").trim();
  const phone = String(record.phone ?? "—").trim();
  const style = String(record.style_name ?? record.style_id ?? "—");
  const date = fmtDate(String(record.appointment_date ?? ""));
  const slot = String(record.appointment_slot ?? "—").trim();
  const deposit = String(record.deposit_amount ?? "—");
  const total = String(record.estimated_total ?? "—");
  const styleId = String(record.style_id ?? "");
  const addrRaw = String(record.service_address ?? "").trim();
  const addrLine =
    styleId.startsWith("house-") && addrRaw ? `\nAddr: ${addrRaw.replace(/\s+/g, " ").slice(0, 120)}` : "";

  const text =
    `[Hair by Nadjae — New booking]\n` +
    `ID ${id.slice(0, 8)}…\n${name}\n${email}\n${phone}\n${style}\n${date} ${slot}${addrLine}\nEst ${total} | Dep ${deposit}`;

  const e164 = normalizePhoneToE164(to);
  if (!e164) {
    console.warn("NOTIFY_TO_PHONE is not valid E.164; skipping owner booking SMS");
    return { ok: true, skipped: true };
  }

  return sendBlooioSms({
    toE164: e164,
    text,
    idempotencyKey: `hbn-booking-owner-${id}`,
  });
}

export async function sendCustomerBookingConfirmationSms(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!isBlooioSmsEnabled()) return { ok: true, skipped: true };

  const e164 = normalizePhoneToE164(record.phone);
  if (!e164) return { ok: true, skipped: true, error: "no valid phone" };

  const id = String(record.id ?? "");
  const fullName = String(record.full_name ?? "there").trim();
  const first = fullName.split(/\s+/)[0] || fullName;
  const style = String(record.style_name ?? record.style_id ?? "your service");
  const dateShow = fmtDate(String(record.appointment_date ?? ""));
  const slot = String(record.appointment_slot ?? "—");
  const total = String(record.estimated_total ?? "—");
  const deposit = String(record.deposit_amount ?? "—");
  const sid = String(record.style_id ?? "");
  const addrCust = String(record.service_address ?? "").trim();
  const houseNote =
    sid.startsWith("house-") && addrCust
      ? `\nAddress: ${addrCust.replace(/\s+/g, " ").slice(0, 100)}`
      : sid.startsWith("house-")
        ? "\n(Incl. 10% of estimate + $15 house-call dep.)"
        : "";

  const text =
    `Hi ${first} — Hair by Nadjae received your booking request.\n` +
    `${dateShow} at ${slot} · ${style}\nEst ${total}, deposit ${deposit}${houseNote}\nDeposits are non-refundable.` +
    `${bookingReferenceLine(id)}`;

  return sendBlooioSms({
    toE164: e164,
    text,
    idempotencyKey: `hbn-booking-customer-${id}`,
  });
}

export async function sendDepositReceivedSms(bookingId: string, rowOrNull: Record<string, unknown> | null) {
  if (!isBlooioSmsEnabled()) return { ok: true as const, skipped: true as const };

  const id = String(bookingId ?? "");
  const phone = normalizePhoneToE164(rowOrNull?.phone);
  if (!phone) return { ok: true as const, skipped: true as const };

  const text =
    `Hair by Nadjae: deposit received.${bookingReferenceLine(id)}\nThank you.`;

  return sendBlooioSms({
    toE164: phone,
    text,
    idempotencyKey: `hbn-deposit-${id}`,
  });
}

export async function sendSalonBookingCancelledSms(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!isBlooioSmsEnabled()) return { ok: true, skipped: true };
  const to = Deno.env.get("NOTIFY_TO_PHONE")?.trim();
  if (!to) return { ok: true, skipped: true };

  const e164 = normalizePhoneToE164(to);
  if (!e164) return { ok: true, skipped: true };

  const id = String(record.id ?? "");
  const name = String(record.full_name ?? "Client");
  const custEmail = String(record.email ?? "").trim();
  const style = String(record.style_name ?? record.style_id ?? "—");
  const date = fmtDate(String(record.appointment_date ?? ""));
  const slot = String(record.appointment_slot ?? "—");

  const text =
    `[Hair by Nadjae — Cancelled]\n${name}\nBooking ${id.slice(0, 8)}…\n${style}\nWas: ${date} ${slot}\n${custEmail}`;

  return sendBlooioSms({
    toE164: e164,
    text,
    idempotencyKey: `hbn-cancel-owner-${id}`,
  });
}

export async function sendCustomerBookingCancelledSms(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!isBlooioSmsEnabled()) return { ok: true, skipped: true };

  const phone = normalizePhoneToE164(record.phone);
  if (!phone) return { ok: true, skipped: true };

  const id = String(record.id ?? "");
  const fullName = String(record.full_name ?? "there").trim();
  const first = fullName.split(/\s+/)[0] || fullName;
  const style = String(record.style_name ?? record.style_id ?? "—");
  const date = fmtDate(String(record.appointment_date ?? ""));
  const slot = String(record.appointment_slot ?? "—");
  const text =
    `Hi ${first}: Hair by Nadjae — your booking (${style}) for ${date} ${slot} is cancelled.${bookingReferenceLine(id)}`;

  return sendBlooioSms({
    toE164: phone,
    text,
    idempotencyKey: `hbn-cancel-customer-${id}`,
  });
}

export async function sendSalonBookingRescheduledSms(
  record: Record<string, unknown>,
  prevDate?: string,
  prevSlot?: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!isBlooioSmsEnabled()) return { ok: true, skipped: true };
  const to = Deno.env.get("NOTIFY_TO_PHONE")?.trim();
  if (!to) return { ok: true, skipped: true };

  const e164 = normalizePhoneToE164(to);
  if (!e164) return { ok: true, skipped: true };

  const id = String(record.id ?? "");
  const name = String(record.full_name ?? "Client");
  const pd = prevDate ? fmtDate(prevDate) : "—";
  const ps = prevSlot?.trim() || "—";
  const nd = fmtDate(String(record.appointment_date ?? ""));
  const ns = String(record.appointment_slot ?? "—");

  const text =
    `[Hair by Nadjae — Rescheduled]\n${name}\nBooking ${id.slice(0, 8)}…\nWas: ${pd} ${ps}\nNow: ${nd} ${ns}`;

  return sendBlooioSms({
    toE164: e164,
    text,
    idempotencyKey: `hbn-resched-owner-${id}-${nd}-${ns}`,
  });
}

export async function sendCustomerBookingRescheduledSms(
  record: Record<string, unknown>,
  prevDate?: string,
  prevSlot?: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!isBlooioSmsEnabled()) return { ok: true, skipped: true };

  const phone = normalizePhoneToE164(record.phone);
  if (!phone) return { ok: true, skipped: true };

  const id = String(record.id ?? "");
  const fullName = String(record.full_name ?? "there").trim();
  const first = fullName.split(/\s+/)[0] || fullName;
  const style = String(record.style_name ?? record.style_id ?? "—");
  const pd = prevDate ? fmtDate(prevDate) : "—";
  const ps = prevSlot?.trim() || "—";
  const nd = fmtDate(String(record.appointment_date ?? ""));
  const ns = String(record.appointment_slot ?? "—");
  const sid = String(record.style_id ?? "");
  const addrCust = String(record.service_address ?? "").trim();
  const houseLine =
    sid.startsWith("house-") && addrCust ? `\nHouse call: ${addrCust.replace(/\s+/g, " ").slice(0, 90)}` : "";

  const text =
    `Hi ${first}: Hair by Nadjae — your booking was moved.\n` +
    `${style}\nWas: ${pd} ${ps}\nNow: ${nd} ${ns}${houseLine}${bookingReferenceLine(id)}`;

  return sendBlooioSms({
    toE164: phone,
    text,
    idempotencyKey: `hbn-resched-customer-${id}-${nd}-${ns}`,
  });
}

export async function sendCustomerAppointmentReminderSms(
  record: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!isBlooioSmsEnabled()) return { ok: true, skipped: true };

  const phone = normalizePhoneToE164(record.phone);
  if (!phone) return { ok: true, skipped: true };

  const studioAddress =
    (Deno.env.get("REMINDER_STUDIO_ADDRESS") ?? "").trim() || "16 Sullivan Dr, Norwich, CT 06360";

  const fullName = String(record.full_name ?? "there").trim();
  const first = fullName.split(/\s+/)[0] || fullName;
  const style = String(record.style_name ?? record.style_id ?? "your service");
  const dateShow = fmtDate(String(record.appointment_date ?? ""));
  const slot = String(record.appointment_slot ?? "—");
  const sid = String(record.style_id ?? "");
  const addrRem = String(record.service_address ?? "").trim();
  const houseLine =
    sid.startsWith("house-") && addrRem
      ? `\nHouse call: ${addrRem.replace(/\s+/g, " ").slice(0, 100)}`
      : "";

  const id = String(record.id ?? "");
  const text =
    `Hi ${first}: Reminder — Hair by Nadjae tomorrow (~24h from send).\n${dateShow} at ${slot} · ${style}\nStudio: ${studioAddress}${houseLine}${bookingReferenceLine(id)}\nSee you soon.`;

  return sendBlooioSms({
    toE164: phone,
    text,
    idempotencyKey: `hbn-reminder-${id}`,
  });
}

/** Owner digest SMS — omit when zero appointments so hourly cron doesn't spam “empty” texts. */
export async function sendOwnerDailyAppointmentDigestSms(
  rows: Record<string, unknown>[],
  isoDate: string,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  if (!isBlooioSmsEnabled()) return { ok: true, skipped: true };

  const to = Deno.env.get("NOTIFY_TO_PHONE")?.trim();
  if (!to) return { ok: true, skipped: true };

  if (rows.length === 0) return { ok: true, skipped: true };

  const e164 = normalizePhoneToE164(to);
  if (!e164) return { ok: true, skipped: true };

  const titleDate = fmtDate(isoDate);
  const lines = rows.slice(0, 10).map((r) => {
    const slot = String(r.appointment_slot ?? "—").trim();
    const name = String(r.full_name ?? "—").trim();
    const st = String(r.style_name ?? r.style_id ?? "—").trim();
    const sid = String(r.style_id ?? "");
    const addr = String(r.service_address ?? "").trim();
    const loc = sid.startsWith("house-") && addr ? "house" : "studio";
    return `• ${slot} ${name} — ${st} (${loc})`;
  });
  const more = rows.length > 10 ? `\n(+${rows.length - 10} more — check email)` : "";

  const text =
    `Hair by Nadjae — schedule ${titleDate} (${rows.length} appts)\n${lines.join("\n")}${more}`;

  return sendBlooioSms({
    toE164: e164,
    text,
    idempotencyKey: `hbn-digest-${isoDate}`,
  });
}
