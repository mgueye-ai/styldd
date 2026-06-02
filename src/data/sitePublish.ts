export type SitePublishConfig = {
  subdomain: string;
  published: boolean;
  publishedAt?: string;
  publicUrl?: string;
};

export const DEFAULT_SITE_PUBLISH: SitePublishConfig = {
  subdomain: '',
  published: false,
};

export function getSiteRootDomain(): string {
  return process.env.EXPO_PUBLIC_STYLD_ROOT_DOMAIN?.trim() || 'styldd.com';
}

export function normalizeSubdomain(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export function isValidSubdomain(subdomain: string): boolean {
  if (subdomain.length < 2 || subdomain.length > 32) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain);
}

export function buildPublicSiteUrl(subdomain: string): string {
  const slug = normalizeSubdomain(subdomain);
  if (!slug) return '';
  return `https://${slug}.${getSiteRootDomain()}`;
}

export function normalizeSitePublish(value: unknown): SitePublishConfig {
  if (!value || typeof value !== 'object') return DEFAULT_SITE_PUBLISH;
  const source = value as Record<string, unknown>;
  const subdomain =
    typeof source.subdomain === 'string' ? normalizeSubdomain(source.subdomain) : '';
  return {
    subdomain,
    published: source.published === true,
    publishedAt: typeof source.publishedAt === 'string' ? source.publishedAt : undefined,
    publicUrl:
      typeof source.publicUrl === 'string' && source.publicUrl.trim()
        ? source.publicUrl.trim()
        : subdomain
          ? buildPublicSiteUrl(subdomain)
          : undefined,
  };
}

export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'mail',
  'staging',
  'dev',
  'test',
  'support',
  'help',
  'blog',
  'status',
]);
