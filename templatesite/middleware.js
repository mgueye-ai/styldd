import { rewrite } from '@vercel/functions';

const ROOT_DOMAIN = process.env.STYLD_ROOT_DOMAIN || 'styldd.com';

function isRootHost(host) {
  return host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}`;
}

export default function middleware(request) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const url = new URL(request.url);

  if (!host || host.endsWith('.vercel.app')) {
    return;
  }

  if (isRootHost(host)) {
    if (url.pathname.startsWith('/marketing/')) {
      return;
    }

    // Styld marketing site on apex + www (from github.com/mgueye-ai/styld)
    if (url.pathname === '/' || !url.pathname.includes('.')) {
      url.pathname = '/marketing/index.html';
      return rewrite(url);
    }

    return;
  }

  if (!host.endsWith(`.${ROOT_DOMAIN}`)) {
    return;
  }

  const subdomain = host.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!subdomain || subdomain.includes('.')) {
    return;
  }

  url.pathname = '/tenant/index.html';
  url.searchParams.set('subdomain', subdomain);
  return rewrite(url);
}

export const config = {
  matcher: ['/((?!_vercel|assets|css|js|tenant|marketing|favicon|.*\\..*).*)'],
};
