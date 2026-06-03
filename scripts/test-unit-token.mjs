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

const token = (env.UNIT_API_TOKEN || '').trim().replace(/^["']|["']$/g, '');
const urls = ['https://api.s.unit.sh', 'https://api.unit.co'];

for (const base of urls) {
  const res = await fetch(`${base}/application-forms?page[limit]=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/vnd.api+json',
      'X-Accept-Version': 'V2024_06',
    },
  });
  const text = await res.text();
  console.log(base, res.status, text.slice(0, 300));
}
