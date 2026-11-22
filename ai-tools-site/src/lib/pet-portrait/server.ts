import 'server-only';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { BailianRejectedError, editPetPhoto, getBailianConfig } from '../pet-photo/bailian';
import { createVisitorIdentity } from '../pet-photo/credits';
import { supabaseFetch } from '../supabase/transport';
import { isScene, portraitPrompt, priceInCents, type Scene } from './catalog';

export const visitorCookie = 'pet_portrait_gallery';
const imageLimit = 1_800_000;
const maxProviderBytes = 16 * 1024 * 1024;

export class PortraitError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

export function portraitStore(token?: string) {
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
  const db = portraitDatabase(base, key);
  const bucket = db.storage.from('pet-portraits');
  const path = (scene: Scene, kind: 'preview' | 'full') => `${visitor.id}/${scene}-${kind}.jpg`;

  return {
    visitor,
    async gallery() {
      const { data, error } = await bucket.list(visitor.id, { limit: 10 });
      if (error) throw new PortraitError('unavailable', 503);
      return data.flatMap(({ name }) => {
        const scene = name.match(/^([a-z]+)-preview\.jpg$/)?.[1];
        return isScene(scene) ? [scene] : [];
      });
    },
    async purchases(sessionId?: string | null) {
      if (sessionId) {
        const verified = await paidScenes(visitor.id, sessionId);
        if (verified.length) await recordPurchase(db, sessionId, visitor.id, verified);
      }
      const { data, error } = await db.from('pet_portrait_receipts').select('scenes').eq('visitor', visitor.id);
      if (error) throw new PortraitError('paymentUnavailable', 503);
      return [...new Set<Scene>(data.flatMap(({ scenes }) => Array.isArray(scenes) ? scenes.filter(isScene) : []))];
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
    async generate(scene: Scene, files: FormData) {
      const images = await Promise.all(['person', 'pet'].map(name => normalize(files.get(name))));
      const { data: reserved, error } = await db.rpc('reserve_pet_portrait', {
        p_visitor: visitor.id, p_scene: scene, p_daily_limit: dailyLimit,
        p_reference_key: createHash('sha256').update(images.join('\n')).digest('hex'),
      });
      if (error) throw new PortraitError('unavailable', 503);
      if (reserved !== true) throw new PortraitError('limit', 429);
      let generated;
      try {
        generated = await editPetPhoto({ images, prompt: portraitPrompt(scene) }, config);
      } catch (error) {
        if (error instanceof BailianRejectedError) {
          await db.from('pet_portrait_attempts').delete().eq('visitor', visitor.id).eq('scene', scene);
        }
        throw new PortraitError('generation', 502);
      }
      const source = await fetchImage(generated.images[0]);
      const image = sharp(source, { limitInputPixels: 25_000_000 }).rotate();
      const small = await image.clone().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).jpeg().toBuffer();
      const { width, height } = await sharp(small).metadata();
      const watermark = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="mark" width="215" height="86" patternUnits="userSpaceOnUse" patternTransform="rotate(-26)"><text x="10" y="44" fill="white" stroke="#17222a" stroke-width=".4" opacity=".68" font-family="sans-serif" font-size="14" font-weight="bold">BESIDE &amp; BLOOM · PREVIEW</text></pattern></defs><rect width="100%" height="100%" fill="url(#mark)"/></svg>`);
      const preview = await sharp(small).composite([{ input: watermark }]).jpeg({ quality: 85 }).toBuffer();
      const full = await image.resize({ width: 4096, height: 4096, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
      const options = { contentType: 'image/jpeg', cacheControl: '0', upsert: false };
      const original = await bucket.upload(path(scene, 'full'), full, options);
      if (original.error) throw new PortraitError('storage', 502);
      const marked = await bucket.upload(path(scene, 'preview'), preview, options);
      if (marked.error) {
        await bucket.remove([path(scene, 'full')]);
        throw new PortraitError('storage', 502);
      }
    },
  };
}

function portraitDatabase(base: string, key: string) {
  return createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch },
  });
}

async function recordPurchase(db: ReturnType<typeof portraitDatabase>, id: string, visitor: string, scenes: Scene[]) {
  const { error } = await db.from('pet_portrait_receipts').upsert({
    checkout_id: id, visitor, scenes,
  }, { onConflict: 'checkout_id', ignoreDuplicates: true });
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
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return;
  const session = event.data?.object as Checkout | undefined;
  const visitor = session?.metadata?.visitor;
  if (!session || !visitor || !/^[a-f0-9-]{36}$/.test(visitor) || !checkoutId(session.id)) return;
  const verified = verifyCheckout(visitor, session);
  if (verified.length) await recordPurchase(portraitDatabase(base, key), session.id, visitor, verified);
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
};

export function checkoutEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_SITE_URL);
}

async function stripe(path: string, body?: URLSearchParams) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new PortraitError('paymentUnavailable', 503);
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key}` },
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
  }));
  if (!session.url || new URL(session.url).origin !== 'https://checkout.stripe.com') throw new PortraitError('paymentUnavailable', 502);
  return session.url;
}

function checkoutId(id: string | null): id is string {
  return !!id && /^cs_(test|live)_[A-Za-z0-9]{1,240}$/.test(id);
}

async function paidScenes(visitor: string, id: string): Promise<Scene[]> {
  return checkoutId(id) ? verifyCheckout(visitor, await stripe(`/${id}`)) : [];
}

function verifyCheckout(visitor: string, session: Checkout): Scene[] {
  const ids = session.metadata?.scenes?.split(',') ?? [];
  if (session.metadata?.product !== 'pet-portrait' || session.metadata.visitor !== visitor ||
    session.mode !== 'payment' || session.status !== 'complete' || session.payment_status !== 'paid' ||
    session.currency !== 'usd' || !ids.length || !ids.every(isScene) || new Set(ids).size !== ids.length ||
    session.amount_total < 1 || String(session.amount_total) !== session.metadata.amount) return [];
  return ids;
}
