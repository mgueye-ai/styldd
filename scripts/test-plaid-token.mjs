import fs from 'fs';

const env = Object.fromEntries(
  fs
    .readFileSync('supabase/.env.secrets', 'utf8')
    .split(/\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const res = await fetch('https://sandbox.plaid.com/link/token/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    user: { client_user_id: 'test' },
    client_name: 'Styld',
    products: ['auth'],
    country_codes: ['US'],
    language: 'en',
  }),
});

const text = await res.text();
console.log('plaid', res.status, text.slice(0, 250));
