// Read-only readiness check. Never invokes Stripe, email or image generation.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DASHSCOPE_API_KEY', 'DASHSCOPE_BASE_URL'];
let failures = 0;
for (const key of required) {
  const valid = Boolean(process.env[key]?.trim());
  console.log(`${valid ? 'OK' : 'MISSING'} ${key}`);
  if (!valid) failures++;
}
for (const key of ['PET_PORTRAIT_COOKIE_SECRET', 'PET_PORTRAIT_CRON_SECRET']) {
  const value = process.env[key] || (key === 'PET_PORTRAIT_COOKIE_SECRET' ? process.env.DRAWING_COOKIE_SECRET : '');
  const valid = Boolean(value && value.length >= 32);
  console.log(`${valid ? 'OK' : 'MISSING/SHORT'} ${key}`);
  if (!valid) failures++;
}
console.log(`Generation: ${process.env.PET_PORTRAIT_ENABLED === 'true' ? 'enabled' : 'disabled'}`);
const paymentsReady = ['STRIPE_SECRET_KEY', 'STRIPE_PORTRAIT_WEBHOOK_SECRET', 'NEXT_PUBLIC_SITE_URL'].every(k => process.env[k]);
console.log(`Stripe: ${paymentsReady ? 'configured; live verification still required' : 'not configured (optional during development)'}`);
if (process.argv.includes('--remote') && !failures) {
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  for (const table of ['pet_portrait_jobs', 'pet_portrait_order_items', 'pet_portrait_recovery_links', 'pet_portrait_provider_calls']) {
    const { error } = await db.from(table).select('*', { head: true, count: 'exact' });
    console.log(`${error ? 'FAILED' : 'OK'} database ${table}`);
    if (error) failures++;
  }
  const { data, error } = await db.storage.getBucket('pet-portraits');
  const privateBucket = !error && data?.public === false;
  console.log(`${privateBucket ? 'OK' : 'FAILED'} private portrait bucket`);
  if (!privateBucket) failures++;
}
process.exitCode = failures ? 1 : 0;
