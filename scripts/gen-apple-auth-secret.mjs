#!/usr/bin/env node
/**
 * Generate an Apple Sign In client secret (JWT) for Supabase Auth.
 *
 * Supabase CLI does not support: `supabase gen signing-key --auth-provider apple`
 * Use this script instead.
 *
 * Required env vars (or pass as flags):
 *   APPLE_TEAM_ID      Apple Developer Team ID
 *   APPLE_KEY_ID       Key ID from your AuthKey_XXXX.p8
 *   APPLE_CLIENT_ID    Services ID (OAuth) or bundle ID
 *   APPLE_PRIVATE_KEY_PATH  Path to AuthKey_XXXX.p8
 *
 * Example:
 *   node scripts/gen-apple-auth-secret.mjs
 *   npm run gen:apple-secret
 */

import { existsSync, readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appleEnvPath = join(__dirname, '..', 'supabase', '.env.apple');
if (existsSync(appleEnvPath)) {
  const { config } = await import('dotenv');
  config({ path: appleEnvPath });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2).replace(/-/g, '_');
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function usage() {
  console.log(`
Generate Apple client secret for Supabase Auth

Usage:
  npm run gen:apple-secret
  node scripts/gen-apple-auth-secret.mjs [options]

Options:
  --team-id <id>        Apple Team ID
  --key-id <id>         Apple Key ID
  --client-id <id>      Apple Services ID or bundle ID
  --key-path <path>     Path to AuthKey_XXXX.p8

Environment variables:
  APPLE_TEAM_ID
  APPLE_KEY_ID
  APPLE_CLIENT_ID
  APPLE_PRIVATE_KEY_PATH

Paste the generated JWT into:
  Supabase Dashboard -> Authentication -> Providers -> Apple -> Secret Key

Note: Native iOS-only apps using signInWithIdToken usually only need
Client IDs (bundle ID + host.exp.Exponent for Expo Go), not this secret.
`);
}

const args = parseArgs(process.argv);
if (args.help || args.h) {
  usage();
  process.exit(0);
}

const teamId = args.team_id || process.env.APPLE_TEAM_ID;
const keyId = args.key_id || process.env.APPLE_KEY_ID;
const clientId = args.client_id || process.env.APPLE_CLIENT_ID;
const keyPath = resolve(
  args.key_path || process.env.APPLE_PRIVATE_KEY_PATH || './AuthKey.p8',
);

const missing = [];
if (!teamId) missing.push('APPLE_TEAM_ID / --team-id');
if (!keyId) missing.push('APPLE_KEY_ID / --key-id');
if (!clientId) missing.push('APPLE_CLIENT_ID / --client-id');

if (missing.length) {
  console.error('Missing required values:\n  ' + missing.join('\n  '));
  usage();
  process.exit(1);
}

let privateKey;
try {
  privateKey = readFileSync(keyPath, 'utf8');
} catch {
  console.error(`Could not read Apple private key at: ${keyPath}`);
  console.error('Download AuthKey_XXXX.p8 from Apple Developer -> Keys.');
  process.exit(1);
}

const iat = Math.floor(Date.now() / 1000);
const exp = iat + 180 * 24 * 60 * 60; // 180 days (Apple max ~6 months)

const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
const payload = base64Url(
  JSON.stringify({
    iss: teamId,
    iat,
    exp,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  }),
);

const signer = createSign('SHA256');
signer.update(`${header}.${payload}`);
signer.end();
const signature = signer.sign(privateKey);
const jwt = `${header}.${payload}.${base64Url(signature)}`;

console.log('\nApple client secret generated successfully.\n');
console.log(jwt);
console.log('\nExpires:', new Date(exp * 1000).toISOString());
console.log('\nAdd this to Supabase -> Auth -> Providers -> Apple -> Secret Key');
console.log('Set a calendar reminder to regenerate before it expires.\n');
