import 'server-only';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { createHash, createHmac, timingSafeEqual, randomUUID, randomBytes } from 'node:crypto';
import { BailianRejectedError, editPetPhoto, getBailianConfig } from '../pet-photo/bailian';
import { createVisitorIdentity } from '../pet-photo/credits';
import { supabaseFetch } from '../supabase/transport';
import { isScene, portraitPrompt, priceInCents, referenceRoles, scenes, type Scene } from './catalog';

export const visitorCookie = 'pet_portrait_gallery';
const imageLimit = 1_800_000;
const maxProviderBytes = 16 * 1024 * 1024;

export class PortraitError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

export type PortraitJob = {
  id: string;
  scene: Scene;
  status: 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  errorCode?: string;
  canRetry?: boolean;
};

export function portraitStore(token?: string) {
  return createPortraitStore(token);
}

function createPortraitStore(token?: string, workerVisitor?: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.PET_PORTRAIT_COOKIE_SECRET || process.env.DRAWING_COOKIE_SECRET;
  const dailyLimit = Number(process.env.PET_PORTRAIT_DAILY_LIMIT ?? 30);
  if (process.env.PET_PORTRAIT_ENABLED !== 'true' || !base || !key || !secret || secret.length < 32 ||
    !Number.isSafeInteger(dailyLimit) || dailyLimit < 1 || new URL(base).protocol !== 'https:') {
    throw new PortraitError('unavailable', 503);
  }
  const config = getBailianConfig();
  const visitor = createVisitorIdentity(secret)(token);
  if (workerVisitor) visitor.id = workerVisitor;
  const db = portraitDatabase(base, key);
  const bucket = db.storage.from('pet-portraits');
  const path = (scene: Scene, kind: 'preview' | 'full') => `${visitor.id}/${scene}-${kind}.jpg`;

  return {
    visitor,
    async gallery() {
      const { data, error } = await bucket.list(visitor.id, { limit: 10 });
      if (error) throw new PortraitError('unavailable', 503);
      return data.flatMap(({ name }) => {
        const scene = name.match(/^([a-z][a-z0-9-]*)-preview\.jpg$/)?.[1];
        return isScene(scene) ? [scene] : [];
      });
    },
    async purchases(sessionId?: string | null) {
      if (sessionId) {
        if (checkoutId(sessionId)) {
          const session = await stripe(`/${sessionId}`);
          const verified = verifyCheckout(visitor.id, session);
          if (verified.length) await recordPurchase(db, session, visitor.id, verified);
        }
      }
      const { data, error } = await db.rpc('paid_pet_portrait_scenes', { p_visitor: visitor.id });
      if (error) throw new PortraitError('paymentUnavailable', 503);
      return [...new Set<Scene>((data ?? []).flatMap((row: { scene: unknown }) => isScene(row.scene) ? [row.scene] : []))];
    },
    async preview(scene: Scene) {
      const { data, error } = await bucket.download(path(scene, 'preview'));
      if (error) throw new PortraitError('missing', 404);
      return data;
    },
    async download(scene: Scene, inline = false) {
      const { data, error } = await bucket.createSignedUrl(path(scene, 'full'), 120,
        inline ? {} : { download: `beside-and-bloom-${scene}.jpg` });
      if (error) throw new PortraitError('missing', 404);
      return data.signedUrl;
    },
    async jobs() {
      const { data, error } = await db.from('pet_portrait_jobs')
        .select('id,scene,status,retry_count,error_code')
        .eq('visitor', visitor.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw new PortraitError('unavailable', 503);
      return data.map(row => ({
        id: row.id,
        scene: row.scene,
        status: row.status,
        retryCount: row.retry_count,
        errorCode: row.error_code ?? undefined,
        canRetry: safeRetry(row),
      })) as PortraitJob[];
    },
    async job(jobId: string) {
      const { data, error } = await db.from('pet_portrait_jobs')
        .select('id,scene,status,retry_count,error_code')
        .eq('visitor', visitor.id)
        .eq('id', jobId)
        .maybeSingle();
      if (error) throw new PortraitError('unavailable', 503);
      if (!data) throw new PortraitError('missing', 404);
      return {
        id: data.id,
        scene: data.scene,
        status: data.status,
        retryCount: data.retry_count,
        errorCode: data.error_code ?? undefined,
        canRetry: safeRetry(data),
      } as PortraitJob;
    },
    async createJob(scene: Scene, files: FormData, idempotencyKey: string) {
      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new PortraitError('selection', 400);
      const images = await Promise.all(referenceRoles(scene).map(name => normalize(files.get(name))));
      const referenceKey = createHash('sha256').update(images.join('\n')).digest('hex');
      const retention = Number(process.env.PET_PORTRAIT_RETENTION_DAYS ?? 30);
      const expires = new Date(Date.now() + (Number.isSafeInteger(retention) && retention > 0 ? retention : 30) * 86400_000).toISOString();
      const id = randomUUID();
      const { data, error } = await db.rpc('create_pet_portrait_job', {
        p_id: id, p_visitor: visitor.id, p_scene: scene, p_key: idempotencyKey, p_reference: referenceKey,
        p_prompt: portraitPrompt(scene), p_version: scenes[scene].version, p_model: config.model,
        p_parameters: { n: 1, prompt_extend: false, watermark: false }, p_expires: expires, p_daily_limit: dailyLimit,
      });
      if (error) throw new PortraitError('unavailable', 503);
      const job = data?.[0];
      if (!job) throw new PortraitError('limit', 429);
      if (job.id !== id) return this.job(job.id);
      // Wait for every upload to settle before cleanup; a late upload must not recreate a deleted draft.
      const uploads = await Promise.allSettled(referenceRoles(scene).map(async (name, index) => {
        const uploaded = await bucket.upload(`drafts/${visitor.id}/${id}-${name}.jpg`,
          Buffer.from(images[index].split(',', 2)[1], 'base64'),
          { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
        if (uploaded.error) throw new PortraitError('storage', 502);
      }));
      if (uploads.some(result => result.status === 'rejected')) {
        const removed = await bucket.remove(referenceRoles(scene).map(name => `drafts/${visitor.id}/${id}-${name}.jpg`));
        if (!removed.error) {
          await db.from('pet_portrait_jobs').delete().eq('id', id).eq('visitor', visitor.id).eq('status', 'uploading');
          await db.from('pet_portrait_attempts').delete().eq('visitor', visitor.id).eq('scene', scene);
        }
        throw new PortraitError('storage', 502);
      }
      const ready = await db.from('pet_portrait_jobs').update({ status: 'queued' })
        .eq('id', id).eq('visitor', visitor.id).eq('status', 'uploading').select('id');
      if (ready.error || !ready.data?.length) {
        await bucket.remove(referenceRoles(scene).map(name => `drafts/${visitor.id}/${id}-${name}.jpg`));
        throw new PortraitError('storage', 502);
      }
      return this.job(id);
    },
    async processJob(jobId: string) {
      const claimed = await db.rpc('claim_pet_portrait_job', { p_id: jobId, p_visitor: visitor.id, p_daily_limit: dailyLimit });
      if (claimed.error) throw new PortraitError('unavailable', 503);
      const job = claimed.data?.[0];
      if (!job) return this.job(jobId);
      let sourceUrl = job.provider_image_url as string | undefined;
      let savedSource = Boolean(sourceUrl);
      try {
        if (!isScene(job.scene)) throw new PortraitError('selection', 400);
        if (!sourceUrl) {
          const downloads = await Promise.all(referenceRoles(job.scene).map(async name => {
            const downloaded = await bucket.download(`drafts/${visitor.id}/${job.id}-${name}.jpg`);
            if (downloaded.error) throw new PortraitError('references', 502);
            return `data:image/jpeg;base64,${Buffer.from(await downloaded.data.arrayBuffer()).toString('base64')}`;
          }));
          const generated = await editPetPhoto({ images: downloads, prompt: job.prompt || portraitPrompt(job.scene) },
            { ...config, model: job.model || config.model });
          sourceUrl = generated.images[0];
          const saved = await db.from('pet_portrait_jobs').update({
            provider_request_id: generated.requestId ?? null, provider_image_url: sourceUrl,
            usage: generated.usage ?? null, model: generated.model,
          }).eq('id', jobId).eq('visitor', visitor.id).eq('status', 'processing').select('id');
          if (saved.error || !saved.data?.length) throw new PortraitError('storage', 502);
          savedSource = true;
        }
        const source = await fetchImage(sourceUrl);
        const image = sharp(source, { limitInputPixels: 25_000_000 }).rotate();
        const small = await image.clone().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg().toBuffer();
        const { width, height } = await sharp(small).metadata();
        const watermark = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="mark" width="215" height="86" patternUnits="userSpaceOnUse" patternTransform="rotate(-26)"><text x="10" y="44" fill="white" stroke="#17222a" stroke-width=".4" opacity=".68" font-family="sans-serif" font-size="14" font-weight="bold">BESIDE &amp; BLOOM · PREVIEW</text></pattern></defs><rect width="100%" height="100%" fill="url(#mark)"/></svg>`);
        const preview = await sharp(small).composite([{ input: watermark }]).jpeg({ quality: 85 }).toBuffer();
        const full = await image.resize({ width: 4096, height: 4096, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
        const scenePath = path(job.scene as Scene, 'full');
        const previewPath = path(job.scene as Scene, 'preview');
        const options = { contentType: 'image/jpeg', cacheControl: '0', upsert: true };
        const uploadedFull = await bucket.upload(scenePath, full, options);
        if (uploadedFull.error) throw new Error('storage');
        const uploadedPreview = await bucket.upload(previewPath, preview, options);
        if (uploadedPreview.error) {
          await bucket.remove([scenePath]);
          throw new PortraitError('storage', 502);
        }
        const completed = await db.from('pet_portrait_jobs').update({
          status: 'completed', completed_at: new Date().toISOString(),
        }).eq('id', jobId).eq('visitor', visitor.id).eq('status', 'processing').select('id');
        if (completed.error || !completed.data?.length) {
          await bucket.remove([scenePath, previewPath]);
          throw new PortraitError('storage', 502);
        }
        await bucket.remove(referenceRoles(job.scene as Scene).map(name => `drafts/${visitor.id}/${job.id}-${name}.jpg`));
        return this.job(jobId);
      } catch (cause) {
        const errorCode = cause instanceof BailianRejectedError ? 'provider_rejected'
          : savedSource ? 'delivery' : cause instanceof PortraitError && cause.code === 'references' ? 'references' : 'generation_unknown';
        await db.from('pet_portrait_jobs').update({
          status: 'failed',
          error_code: errorCode,
          completed_at: new Date().toISOString(),
        }).eq('id', jobId).eq('visitor', visitor.id).eq('status', 'processing');
        return this.job(jobId);
      }
    },
    async retryJob(jobId: string) {
      const job = await this.job(jobId);
      if (!job.canRetry) throw new PortraitError('retryUnavailable', 409);
      const retried = await db.rpc('retry_pet_portrait_job', { p_id: jobId, p_visitor: visitor.id });
      if (retried.error) throw new PortraitError('unavailable', 503);
      if (!retried.data?.length) throw new PortraitError('retryUnavailable', 409);
      return this.job(jobId);
    },
    async createRecoveryLink() {
      if (!(await this.purchases()).length) throw new PortraitError('paymentRequired', 403);
      const token = randomBytes(32).toString('base64url');
      await checked(db.from('pet_portrait_recovery_links').upsert({
        token_hash: createHash('sha256').update(token).digest('hex'), visitor: visitor.id,
        expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      }, { onConflict: 'visitor' }));
      return token;
    },
    async revokeRecoveryLink() {
      await checked(db.from('pet_portrait_recovery_links').delete().eq('visitor', visitor.id));
    },
    async deleteVisitor() {
      // Tombstone first: no new job claims or payment redelivery may restore this visitor's data.
      await checked(db.from('pet_portrait_deleted_visitors').upsert({ visitor: visitor.id }, { onConflict: 'visitor', ignoreDuplicates: true }));
      await checked(db.from('pet_portrait_delete_requests').insert({ visitor: visitor.id, reason: 'visitor_request', status: 'processing' }));
      // Remove job rows first so a running worker's completion compare-and-set fails and removes its output.
      await checked(db.from('pet_portrait_jobs').delete().eq('visitor', visitor.id));
      await this.revokeRecoveryLink();
      for (const prefix of [visitor.id, `drafts/${visitor.id}`]) {
        for (;;) {
          const files = await bucket.list(prefix, { limit: 100 });
          if (files.error) throw new PortraitError('storage', 502);
          if (!files.data.length) break;
          const removed = await bucket.remove(files.data.map(file => `${prefix}/${file.name}`));
          if (removed.error) throw new PortraitError('storage', 502);
        }
      }
      // Retain only pseudonymous usage counters for rate limits; remove the photo fingerprints.
      await checked(db.from('pet_portrait_attempts').update({ reference_key: '[deleted]' }).eq('visitor', visitor.id));
      await checked(db.from('pet_portrait_receipts').delete().eq('visitor', visitor.id));
      await checked(db.from('pet_portrait_order_items').delete().eq('visitor', visitor.id));
      await checked(db.from('pet_portrait_delete_requests').update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('visitor', visitor.id).eq('status', 'processing'));
    },
  };
}

function portraitDatabase(base: string, key: string) {
  return createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch },
  });
}

function safeRetry(row: { status: string; retry_count: number; error_code?: string }) {
  return row.status === 'failed' && row.retry_count < 3 && ['provider_rejected', 'delivery'].includes(row.error_code ?? '');
}
async function checked(query: PromiseLike<{ error: unknown }>) {
  const result = await query;
  if (result.error) throw new PortraitError('storage', 502);
}
async function recordPurchase(db: ReturnType<typeof portraitDatabase>, session: Checkout, visitor: string, ids: Scene[]) {
  const { error } = await db.rpc('settle_pet_portrait_payment', {
    p_checkout: session.id, p_visitor: visitor, p_scenes: ids,
    p_amount: session.amount_total, p_intent: session.payment_intent ?? null,
  });
  if (error) throw new PortraitError('paymentUnavailable', 503);
}

export async function stripeWebhook(body: string, header: string) {
  const secret = process.env.STRIPE_PORTRAIT_WEBHOOK_SECRET;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !base || !key) throw new PortraitError('paymentUnavailable', 503);
  const fields = header.split(',').map(field => field.trim().split('=', 2));
  const timestamp = fields.find(([name]) => name === 't')?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new PortraitError('signature', 400);
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest();
  if (!fields.some(([name, value]) => name === 'v1' && /^[a-f0-9]{64}$/.test(value) &&
    timingSafeEqual(expected, Buffer.from(value, 'hex')))) throw new PortraitError('signature', 400);
  const event = JSON.parse(body);
  if (event.type === 'charge.refunded') {
    const charge = event.data?.object as { payment_intent?: string; amount_refunded?: number } | undefined;
    if (typeof charge?.payment_intent === 'string' && /^pi_[A-Za-z0-9]+$/.test(charge.payment_intent) &&
        Number.isSafeInteger(charge.amount_refunded) && charge.amount_refunded! > 0) {
      // Key by the exact payment, never by visitor + scenes across unrelated orders.
      const db = portraitDatabase(base, key);
      await checked(db.from('pet_portrait_refunds').upsert({ payment_intent: charge.payment_intent,
        amount_refunded: charge.amount_refunded }, { onConflict: 'payment_intent' }));
      await checked(db.from('pet_portrait_order_items').update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('payment_intent', charge.payment_intent));
    }
    return;
  }
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return;
  const session = event.data?.object as Checkout | undefined;
  const visitor = session?.metadata?.visitor;
  if (!session || !visitor || !/^[a-f0-9-]{36}$/.test(visitor) || !checkoutId(session.id)) return;
  const verified = verifyCheckout(visitor, session);
  if (verified.length) await recordPurchase(portraitDatabase(base, key), session, visitor, verified);
}

async function normalize(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size < 1 || file.size > imageLimit ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new PortraitError('files', 400);
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24_000_000 });
    const { format } = await image.metadata();
    if (!format || !['jpeg', 'png', 'webp'].includes(format)) throw new Error();
    const jpg = await image.rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch { throw new PortraitError('files', 400); }
}

async function fetchImage(address: string) {
  const response = await fetch(address, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25_000) });
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > maxProviderBytes) {
    throw new PortraitError('generation', 502);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxProviderBytes) {
      await reader.cancel();
      throw new PortraitError('generation', 502);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

type Checkout = {
  id: string;
  url: string | null;
  mode: string;
  status: string;
  payment_status: string;
  amount_total: number;
  currency: string;
  metadata?: Record<string, string>;
  payment_intent?: string | null;
};

export async function cleanupExpiredPortraits() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new PortraitError('unavailable', 503);
  const db = portraitDatabase(base, key);
  const bucket = db.storage.from('pet-portraits');
  // A dead worker may have incurred a charge. Surface it for reconciliation; never regenerate automatically.
  await checked(db.from('pet_portrait_jobs').update({ status: 'failed', error_code: 'generation_unknown', completed_at: new Date().toISOString() })
    .eq('status', 'processing').lt('started_at', new Date(Date.now() - 10 * 60_000).toISOString()));
  const { data: jobs, error } = await db.from('pet_portrait_jobs')
    .select('id,visitor,scene').lt('expires_at', new Date().toISOString()).in('status', ['completed', 'failed', 'queued', 'uploading']).limit(100);
  if (error) throw new PortraitError('unavailable', 503);
  for (const job of jobs ?? []) {
    const removed = await bucket.remove([
      `${job.visitor}/${job.scene}-preview.jpg`, `${job.visitor}/${job.scene}-full.jpg`,
      `drafts/${job.visitor}/${job.id}-person.jpg`, `drafts/${job.visitor}/${job.id}-pet.jpg`,
    ]);
    if (removed.error) throw new PortraitError('storage', 502);
    await checked(db.from('pet_portrait_jobs').delete().eq('id', job.id));
  }
  return (jobs ?? []).length;
}

// A scheduler may invoke this to drain queued work missed by next/after. One job fits the route timeout.
export async function processQueuedPortrait() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new PortraitError('unavailable', 503);
  const db = portraitDatabase(base, key);
  const { data, error } = await db.from('pet_portrait_jobs').select('id,visitor')
    .eq('status', 'queued').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true }).limit(1);
  if (error) throw new PortraitError('unavailable', 503);
  if (!data?.length) return false;
  await createPortraitStore(undefined, data[0].visitor).processJob(data[0].id);
  return true;
}

export async function restorePortraitGallery(token: unknown) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new PortraitError('recovery', 404);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.PET_PORTRAIT_COOKIE_SECRET || process.env.DRAWING_COOKIE_SECRET;
  if (!base || !key || !secret || secret.length < 32) throw new PortraitError('unavailable', 503);
  const { data, error } = await portraitDatabase(base, key).rpc('restore_pet_portrait_gallery', {
    p_hash: createHash('sha256').update(token).digest('hex'),
  });
  if (error) throw new PortraitError('unavailable', 503);
  const visitor = data?.[0]?.visitor;
  if (typeof visitor !== 'string' || !/^[a-f0-9-]{36}$/.test(visitor)) throw new PortraitError('recovery', 404);
  return `${visitor}.${createHmac('sha256', secret).update(visitor).digest('hex')}`;
}

export function checkoutEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PORTRAIT_WEBHOOK_SECRET && process.env.NEXT_PUBLIC_SITE_URL);
}

async function stripe(path: string, body?: URLSearchParams, idempotencyKey?: string) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new PortraitError('paymentUnavailable', 503);
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body, cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new PortraitError('paymentUnavailable', 502);
  return await response.json() as Checkout;
}

export async function checkout(visitor: string, scenes: Scene[], locale: 'en' | 'zh', lang: string) {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new PortraitError('paymentUnavailable', 503);
  const returnUrl = new URL(`/${locale}/tools/pet-portrait`, site);
  if (lang === 'es' || lang === 'fr') returnUrl.searchParams.set('lang', lang);
  const url = returnUrl.href;
  const join = returnUrl.search ? '&' : '?';
  const amount = priceInCents(scenes.length);
  const session = await stripe('', new URLSearchParams({
    mode: 'payment',
    locale: lang === 'es' || lang === 'fr' ? lang : locale,
    'payment_method_types[0]': 'card',
    success_url: url + join + 'checkout={CHECKOUT_SESSION_ID}#studio',
    cancel_url: url + '#studio',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': `Beside & Bloom · ${scenes.length} digital portrait(s)`,
    'metadata[product]': 'pet-portrait',
    'metadata[visitor]': visitor,
    'metadata[scenes]': scenes.join(','),
    'metadata[amount]': String(amount),
    'payment_intent_data[metadata][product]': 'pet-portrait',
    'payment_intent_data[metadata][visitor]': visitor,
    'payment_intent_data[metadata][scenes]': scenes.join(','),
    'payment_intent_data[metadata][amount]': String(amount),
  }), `portrait-${visitor}-${[...scenes].sort().join('-')}-${Math.floor(Date.now() / 1_800_000)}`);
  if (!session.url || new URL(session.url).origin !== 'https://checkout.stripe.com') throw new PortraitError('paymentUnavailable', 502);
  const db = portraitDatabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const total = amount;
  const items = scenes.map((scene, index) => ({
    checkout_id: session.id,
    visitor,
    scene,
    status: 'pending',
    amount_cents: index === scenes.length - 1
      ? total - scenes.slice(0, index).reduce((sum, _, prior) => sum + (prior === 0 ? 1300 : prior === 1 ? 700 : 300), 0)
      : index === 0 ? 1300 : index === 1 ? 700 : 300,
  }));
  const { error } = await db.from('pet_portrait_order_items').upsert(items, { onConflict: 'checkout_id,scene', ignoreDuplicates: true });
  if (error) throw new PortraitError('paymentUnavailable', 503);
  return session.url;
}

function checkoutId(id: string | null): id is string {
  return !!id && /^cs_(test|live)_[A-Za-z0-9]{1,240}$/.test(id);
}

function verifyCheckout(visitor: string, session: Checkout): Scene[] {
  const ids = session.metadata?.scenes?.split(',') ?? [];
  if (session.metadata?.product !== 'pet-portrait' || session.metadata.visitor !== visitor ||
    session.mode !== 'payment' || session.status !== 'complete' || session.payment_status !== 'paid' ||
    session.currency !== 'usd' || !ids.length || !ids.every(isScene) || new Set(ids).size !== ids.length ||
    !priceInCents(ids.length) || session.amount_total !== priceInCents(ids.length) || String(session.amount_total) !== session.metadata.amount) return [];
  return ids;
}
