/** Normalize booking form phone strings to E.164 for SMS APIs (US-focused). */

export function normalizePhoneToE164(phoneRaw: unknown): string | null {
  const s = String(phoneRaw ?? "").trim();
  if (!s) return null;

  const cleaned = s.replace(/^\+/, "").replace(/\D/g, "");
  if (cleaned.length === 10) return `+1${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith("1")) return `+${cleaned}`;

  if (s.startsWith("+")) {
    const rest = s.slice(1).replace(/\D/g, "");
    if (rest.length >= 10 && rest.length <= 14) return `+${rest}`;
  }

  return null;
}
