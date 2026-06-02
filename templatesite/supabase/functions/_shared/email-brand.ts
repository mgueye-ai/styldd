/**
 * Branded HTML shell for transactional emails (matches site: cream, pink/gold accents, logo).
 * Set PUBLIC_SITE_URL or SITE_URL (no trailing slash) so the logo loads from {base}/assets/placeholders/logo.svg.
 */
import { escapeHtml } from "./resend.ts";

export function getPublicSiteBaseUrl(): string {
  return (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "").trim().replace(/\/$/, "");
}

/** Absolute URL for nav logo (template placeholder until you add a real asset). */
export function getBrandedLogoUrl(): string {
  const base = getPublicSiteBaseUrl();
  return base ? `${base}/assets/placeholders/logo.svg` : "";
}

/**
 * Wraps inner HTML fragments (paragraphs, lists — use escapeHtml on user data before interpolating).
 */
export function wrapBrandedEmail(innerHtml: string): string {
  const base = getPublicSiteBaseUrl();
  const logoUrl = getBrandedLogoUrl();
  const homeHref = base ? escapeHtml(base) : "";
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Your brand name" width="64" height="64" style="display:block;margin:0 auto 14px;border-radius:12px;border:1px solid rgba(219,39,119,0.18);background:#fff;" />`
    : "";

  const siteLine = homeHref
    ? `<a href="${homeHref}" style="color:#b8860b;text-decoration:none;font-weight:600;">Visit website</a>`
    : "";

  const phoneLink = `<a href="tel:+15550100199" style="color:#b8860b;text-decoration:none;font-weight:600;">(555) 010-0199</a>`;

  const footerBits = [siteLine, phoneLink].filter(Boolean).join(` <span style="color:#d4c4b0;">·</span> `);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="x-ua-compatible" content="ie=edge" />
<title>Your brand name</title>
<style type="text/css">
  .hm-body a { color: #b8860b !important; font-weight: 600; }
  .hm-body p { margin: 0 0 14px; }
  .hm-body p:last-child { margin-bottom: 0; }
  .hm-body ul { margin: 12px 0; padding-left: 20px; }
  .hm-body li { margin: 6px 0; }
  .hm-body code { background: #fdf8f4; padding: 2px 7px; border-radius: 6px; font-size: 13px; border: 1px solid rgba(219,39,119,0.12); }
  .hm-body table.data-sheet th { background: rgba(253, 242, 248, 0.95); color: #2c2416; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  .hm-body table.data-sheet td { border-color: rgba(219, 39, 119, 0.18) !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#faf8f4;-webkit-font-smoothing:antialiased;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#faf8f4;">
<tr><td align="center" style="padding:28px 16px 36px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(219,39,119,0.16);box-shadow:0 8px 32px rgba(44,36,22,0.07);">
<tr>
<td style="padding:28px 22px 22px;text-align:center;background:linear-gradient(165deg,#fffefb 0%,#ffffff 50%);border-bottom:1px solid rgba(219,39,119,0.12);">
${logoBlock}
<p style="margin:0;font-family:Georgia,'Cormorant Garamond','Times New Roman',serif;font-size:24px;font-weight:600;color:#2c2416;line-height:1.2;">Your brand name</p>
<p style="margin:10px 0 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#c45d7a;">Your City, ST · By appointment</p>
</td>
</tr>
<tr>
<td class="hm-body" style="padding:26px 28px 20px;font-family:'Source Sans 3',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#3d3428;">
${innerHtml}
</td>
</tr>
<tr>
<td style="padding:18px 24px 24px;text-align:center;border-top:1px solid #f0ebe3;background:linear-gradient(180deg,#fffdfb 0%,#faf8f4 100%);">
<p style="margin:0 0 8px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.55;color:#5c4f3f;">${footerBits}</p>
<p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:11px;line-height:1.45;color:#9a8b7a;">Template footer · Replace with your tagline or confirmation details</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
