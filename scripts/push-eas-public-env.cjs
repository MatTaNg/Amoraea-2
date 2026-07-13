/**
 * Push safe EXPO_PUBLIC_* values from local .env into EAS project environments.
 * Does NOT push provider API keys (Anthropic / OpenAI / ElevenLabs).
 *
 * Usage: node scripts/push-eas-public-env.mjs
 * Requires: eas-cli logged in, .env present.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

const REQUIRED = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_ANTHROPIC_PROXY_URL',
];

const OPTIONAL = [
  'EXPO_PUBLIC_AUTH_REDIRECT_URL',
  'EXPO_PUBLIC_AUTH_REDIRECT_URL_DEV',
  'EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL',
  'EXPO_PUBLIC_OPENAI_WHISPER_PROXY_URL',
  'EXPO_PUBLIC_AUDOS_API_KEY',
  'EXPO_PUBLIC_AUDOS_AUTO_TRACK',
  'EXPO_PUBLIC_AUDOS_BASE_URL',
  'EXPO_PUBLIC_AUDOS_DEBUG',
];

/** Never push these even if present in .env */
const BLOCKED = new Set([
  'EXPO_PUBLIC_ANTHROPIC_API_KEY',
  'EXPO_PUBLIC_OPENAI_API_KEY',
  'EXPO_PUBLIC_ELEVENLABS_API_KEY',
  'EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
]);

const ENVIRONMENTS = ['production', 'preview', 'development'];

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function easCreate(name, value, visibility) {
  const args = [
    'env:create',
    '--name',
    name,
    '--value',
    value,
    '--type',
    'string',
    '--visibility',
    visibility,
    '--force',
    '--non-interactive',
  ];
  for (const env of ENVIRONMENTS) {
    args.push('--environment', env);
  }
  const result = spawnSync('eas', args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(`eas env:create failed for ${name}: ${err || `exit ${result.status}`}`);
  }
}

function main() {
  const env = parseEnvFile(ENV_PATH);
  if (!fs.existsSync(ENV_PATH)) {
    console.error('Missing .env — create it with EXPO_PUBLIC_SUPABASE_* and proxy URL first.');
    process.exit(1);
  }

  const toPush = [];
  for (const key of [...REQUIRED, ...OPTIONAL]) {
    if (BLOCKED.has(key)) continue;
    const value = env[key]?.trim();
    if (!value) {
      if (REQUIRED.includes(key)) {
        console.error(`Missing required ${key} in .env`);
        process.exit(1);
      }
      continue;
    }
    toPush.push(key);
  }

  console.log(`Pushing ${toPush.length} vars to EAS environments: ${ENVIRONMENTS.join(', ')}`);
  for (const key of toPush) {
    const visibility = key.includes('ANON_KEY') || key.includes('AUDOS_API_KEY') ? 'sensitive' : 'plaintext';
    process.stdout.write(`  ${key} (${visibility})… `);
    easCreate(key, env[key].trim(), visibility);
    console.log('ok');
  }
  console.log('Done. Verify with: eas env:list --environment production');
  console.log('Do NOT add EXPO_PUBLIC_*_API_KEY for Anthropic/OpenAI/ElevenLabs — use Supabase secrets + proxies.');
}

main();
