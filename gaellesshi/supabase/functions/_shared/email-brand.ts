/**
 * Branded HTML shell for transactional emails (matches site: cream, pink/gold accents, logo).
 * Set PUBLIC_SITE_URL or SITE_URL (no trailing slash) so the logo loads from {base}/logo.png.
 */
import { escapeHtml } from "./resend.ts";

export function getPublicSiteBaseUrl(): string {
  return (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
}

/** Absolute URL for nav logo (same as website root `logo.png`). */
export function getBrandedLogoUrl(): string {
  const base = getPublicSiteBaseUrl();
  return base ? `${base}/logo.png` : "";
}

/** Small uppercase label above a section (e.g. "New booking"). */
export function emailEyebrow(text: string): string {
  const t = escapeHtml(text);
  return `<p style="margin:0 0 12px;"><span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#a83d5c;background:linear-gradient(180deg,rgba(253,242,248,0.95) 0%,rgba(252,231,243,0.65) 100%);border:1px solid rgba(219,39,119,0.18);">${t}</span></p>`;
}

/** Short serif headline inside the body. */
export function emailSectionTitle(text: string): string {
  const t = escapeHtml(text);
  return `<p style="margin:0 0 8px;font-family:Georgia,'Cormorant Garamond','Times New Roman',serif;font-size:20px;font-weight:600;color:#2c2416;line-height:1.25;">${t}</p>`;
}

/** Body paragraph; pass safe HTML (escape user bits yourself). */
export function emailP(html: string, opts?: { marginBottom?: number }): string {
  const mb = opts?.marginBottom ?? 14;
  return `<p style="margin:0 0 ${mb}px;line-height:1.6;color:#3d3428;">${html}</p>`;
}

/** Two-column detail sheet (email-safe table). `valueHtml` may include links. */
export function emailDetailRows(rows: Array<{ label: string; valueHtml: string }>): string {
  const rowHtml = rows
    .map((r, i) => {
      const isLast = i === rows.length - 1;
      const border = isLast ? "" : "border-bottom:1px solid rgba(219,39,119,0.1);";
      const bg = i % 2 === 0 ? "#fffcfa" : "#ffffff";
      return `<tr><td style="padding:11px 14px;${border}vertical-align:top;width:36%;font-size:12px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:#8b7355;background:${bg};">${escapeHtml(r.label)}</td><td style="padding:11px 14px;${border}vertical-align:top;font-size:15px;color:#2c2416;line-height:1.5;background:${bg};">${r.valueHtml}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;margin:6px 0 22px;border-radius:14px;overflow:hidden;border:1px solid rgba(219,39,119,0.16);box-shadow:0 4px 20px rgba(44,36,22,0.06);"><tbody>${rowHtml}</tbody></table>`;
}

/** Primary action button (bulletproof table wrapper). */
export function emailButton(href: string, label: string): string {
  const h = escapeHtml(href);
  const lab = escapeHtml(label);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px;"><tr><td align="left" style="border-radius:999px;background:linear-gradient(135deg,#d4728f 0%,#b8456a 48%,#a83d5c 100%);box-shadow:0 6px 20px rgba(168,61,92,0.28);"><a class="hm-btn-inline" href="${h}" style="display:inline-block;padding:14px 28px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:700;color:#ffffff !important;text-decoration:none;border-radius:999px;">${lab}</a></td></tr></table>`;
}

/** Soft callout for policies or tips. */
export function emailCallout(innerHtml: string, variant: "rose" | "amber" = "rose"): string {
  const isAmber = variant === "amber";
  const bg = isAmber ? "#fffbf4" : "#fff8fb";
  const border = isAmber ? "rgba(217,119,6,0.28)" : "rgba(219,39,119,0.22)";
  const accent = isAmber ? "#b45309" : "#c45d7a";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 20px;"><tr><td style="width:4px;padding:0;border-radius:12px 0 0 12px;background:${accent};line-height:0;font-size:0;">&nbsp;</td><td style="padding:0;border-radius:0 12px 12px 0;vertical-align:top;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:0 12px 12px 0;overflow:hidden;"><tr><td style="padding:14px 16px;background:${bg};border:1px solid ${border};border-left:none;font-size:14px;line-height:1.55;color:#4a3f36;">${innerHtml}</td></tr></table></td></tr></table>`;
}

/** Highlights date + time for customer-facing messages. */
export function emailAppointmentHero(dateHtml: string, timeHtml: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 20px;"><tr><td style="padding:18px 20px;border-radius:16px;background:linear-gradient(155deg,#fff5f9 0%,#fffdfb 55%,#faf8f4 100%);border:1px solid rgba(219,39,119,0.2);box-shadow:inset 0 1px 0 rgba(255,255,255,0.85);"><p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#c45d7a;">Your appointment</p><p style="margin:0;font-family:Georgia,'Cormorant Garamond',serif;font-size:19px;font-weight:600;color:#2c2416;line-height:1.3;">${dateHtml}</p><p style="margin:10px 0 0;font-size:15px;font-weight:600;color:#6b5346;">${timeHtml}</p></td></tr></table>`;
}

export function emailSignoff(): string {
  return `<p style="margin:20px 0 0;font-size:14px;line-height:1.5;color:#5c4f3f;">With care,<br/><strong style="color:#2c2416;">Hair by Nadjae</strong></p>`;
}

/**
 * Wraps inner HTML fragments (paragraphs, lists — use escapeHtml on user data before interpolating).
 */
export function wrapBrandedEmail(innerHtml: string): string {
  const base = getPublicSiteBaseUrl();
  const logoUrl = getBrandedLogoUrl();
  const homeHref = base ? escapeHtml(base) : "";
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Hair by Nadjae" width="72" height="72" style="display:block;margin:0 auto 12px;border-radius:14px;border:1px solid rgba(219,39,119,0.2);background:#fff;box-shadow:0 4px 14px rgba(44,36,22,0.08);" />`
    : "";

  const siteLine = homeHref
    ? `<a href="${homeHref}" style="color:#b8860b;text-decoration:none;font-weight:600;">Visit website</a>`
    : "";

  const phoneLink = `<a href="tel:+18608227448" style="color:#b8860b;text-decoration:none;font-weight:600;">(860) 822-7448</a>`;

  const footerBits = [siteLine, phoneLink].filter(Boolean).join(` <span style="color:#d4c4b0;">·</span> `);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="x-ua-compatible" content="ie=edge" />
<title>Hair by Nadjae</title>
<style type="text/css">
  .hm-body a { color: #b8860b !important; font-weight: 600; }
  .hm-body a.hm-btn-inline { color: #ffffff !important; }
  .hm-body p { margin: 0 0 14px; }
  .hm-body p:last-child { margin-bottom: 0; }
  .hm-body ul { margin: 12px 0; padding-left: 20px; }
  .hm-body li { margin: 6px 0; }
  .hm-body code { background: linear-gradient(180deg,#fdf8f4,#faf5f0); padding: 3px 8px; border-radius: 6px; font-size: 13px; border: 1px solid rgba(219,39,119,0.14); color: #5c4f3f; font-family: ui-monospace, monospace; }
  .hm-body table.data-sheet th { background: linear-gradient(180deg,rgba(253,242,248,0.98),rgba(252,231,243,0.75)) !important; color: #4a3728; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .hm-body table.data-sheet td { border-color: rgba(219, 39, 119, 0.12) !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f3efe6;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:linear-gradient(180deg,#ebe4d6 0%,#faf8f4 28%,#faf8f4 100%);">
<tr><td align="center" style="padding:32px 16px 40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="580" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:20px;overflow:hidden;border:1px solid rgba(219,39,119,0.14);box-shadow:0 12px 40px rgba(44,36,22,0.1),0 2px 8px rgba(168,61,92,0.06);">
<tr><td style="height:5px;line-height:5px;font-size:0;background:linear-gradient(90deg,#fbcfe8 0%,#f472b6 25%,#c45d7a 50%,#d4a574 75%,#e8c088 100%);">&nbsp;</td></tr>
<tr>
<td style="padding:26px 24px 20px;text-align:center;background:linear-gradient(175deg,#fffefb 0%,#ffffff 45%,#fffdfb 100%);border-bottom:1px solid rgba(219,39,119,0.1);">
${logoBlock}
<p style="margin:0;font-family:Georgia,'Cormorant Garamond','Times New Roman',serif;font-size:26px;font-weight:600;color:#2c2416;line-height:1.15;letter-spacing:-0.02em;">Hair by Nadjae</p>
<p style="margin:12px 0 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#c45d7a;">Norwich, CT · By appointment</p>
</td>
</tr>
<tr>
<td class="hm-body" style="padding:28px 30px 24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#3d3428;">
${innerHtml}
</td>
</tr>
<tr>
<td style="padding:20px 26px 26px;text-align:center;border-top:1px solid rgba(219,39,119,0.08);background:linear-gradient(180deg,#fffdfb 0%,#faf8f4 100%);">
<p style="margin:0 0 10px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.55;color:#5c4f3f;">${footerBits}</p>
<p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:11px;line-height:1.5;color:#9a8b7a;">Neat, fast &amp; affordable braids · Studio details shared when you book</p>
</td>
</tr>
</table>
<p style="margin:16px 0 0;font-family:system-ui,sans-serif;font-size:11px;color:#9a9084;max-width:580px;">You are receiving this email in connection with a booking, payment, or message for Hair by Nadjae.</p>
</td></tr>
</table>
</body>
</html>`;
}
