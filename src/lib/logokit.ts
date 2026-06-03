import { resolveBankDomain } from './institutionDomains';

function logokitToken(): string {
  return process.env.EXPO_PUBLIC_LOGOKIT_TOKEN ?? '';
}

function logokitLogoUri(domain: string, size: 64 | 128 | 256 = 128): string | undefined {
  const token = logokitToken();
  if (!token || !domain) return undefined;
  const normalized = domain.replace(/^www\./i, '').trim().toLowerCase();
  const params = new URLSearchParams({
    token,
    size: String(size),
    fallback: 'monogram-light',
  });
  return `https://img.logokit.com/${normalized}?${params.toString()}`;
}

function clearbitLogoUri(domain: string): string | undefined {
  if (!domain) return undefined;
  return `https://logo.clearbit.com/${domain}`;
}

function googleFaviconUri(domain: string): string | undefined {
  if (!domain) return undefined;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

/**
 * Returns an ordered list of logo URLs to try for a bank.
 * The caller should render <Image source={{ uri: sources[index] }}> and on
 * error increment the index until exhausted, then show initials.
 */
export function resolveBankLogoSources(params: {
  institutionName?: string | null;
  institutionDomain?: string | null;
  institutionLogoUri?: string | null;
}): string[] {
  const { institutionName, institutionDomain, institutionLogoUri } = params;

  const domain =
    institutionDomain?.replace(/^www\./i, '').trim().toLowerCase() ||
    (institutionName ? resolveBankDomain(institutionName) : undefined);

  const sources: string[] = [];

  if (domain) {
    const lk = logokitLogoUri(domain);
    if (lk) sources.push(lk);
    const cb = clearbitLogoUri(domain);
    if (cb) sources.push(cb);
    const gf = googleFaviconUri(domain);
    if (gf) sources.push(gf);
  }

  if (institutionLogoUri?.startsWith('https://')) {
    sources.push(institutionLogoUri);
  }

  return sources;
}
