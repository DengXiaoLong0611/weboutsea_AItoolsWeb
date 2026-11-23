import { after, NextRequest, NextResponse } from 'next/server';
import { readLimitedBody, PortraitBodyError } from '@/lib/pet-portrait/http';
import { isScene } from '@/lib/pet-portrait/catalog';
import { checkout, checkoutEnabled, PortraitError, portraitStore, visitorCookie, restorePortraitGallery } from '@/lib/pet-portrait/server';

export const maxDuration = 240;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
function fail(error: unknown) {
  if (error instanceof PortraitBodyError) return json({ error: 'files' }, 413);
  return error instanceof PortraitError ? json({ error: error.code }, error.status) : json({ error: 'unavailable' }, 503);
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(visitorCookie)?.value;
    const store = portraitStore(token);
    const query = request.nextUrl.searchParams;
    const action = query.get('action');
    const scene = query.get('scene');
    if (action && token !== store.visitor.token) throw new PortraitError('missing', 404);
    if (action === 'jobs') return json({ jobs: await store.jobs() });
    if (action === 'job' && query.get('job')) return json({ job: await store.job(query.get('job')!) });
    if (action) {
      if (token !== store.visitor.token || !isScene(scene)) throw new PortraitError('missing', 404);
      if (action === 'preview') return new Response(await store.preview(scene), {
        headers: { ...headers, 'Content-Type': 'image/jpeg' },
      });
      if (action === 'download' || action === 'print') {
        const paid = await store.purchases();
        if (!paid.includes(scene)) throw new PortraitError('paymentRequired', 403);
        return NextResponse.redirect(await store.download(scene, action === 'print'), { headers });
      }
      throw new PortraitError('missing', 404);
    }
    const [scenes, paid] = await Promise.all([
      store.gallery(),
      store.purchases(query.get('checkout')),
    ]);
    const mailbox = process.env.PET_PORTRAIT_PRINT_EMAIL?.trim();
    const printEmail = mailbox && /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(mailbox) ? mailbox : null;
    const response = json({ scenes, paid, checkout: checkoutEnabled(), printEmail });
    if (token !== store.visitor.token) response.cookies.set(visitorCookie, store.visitor.token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    if (!origin || origin !== request.nextUrl.origin && origin !== process.env.NEXT_PUBLIC_SITE_URL) throw new PortraitError('missing', 403);
    const bytes = await readLimitedBody(request, 3_700_000);
    const bodyRequest = new Request(request.url, { method: 'POST', headers: request.headers, body: Buffer.from(bytes) });
    if (request.nextUrl.searchParams.get('action') === 'restore') {
      const body = await bodyRequest.json().catch(() => null);
      const token = await restorePortraitGallery(body?.token);
      const response = json({ restored: true });
      response.cookies.set(visitorCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
      return response;
    }
    const token = request.cookies.get(visitorCookie)?.value;
    const store = portraitStore(token);
    if (token !== store.visitor.token) throw new PortraitError('unavailable', 409);
    if (request.nextUrl.searchParams.get('action') === 'recovery') return json({ token: await store.createRecoveryLink() });
    if (request.nextUrl.searchParams.get('action') === 'revoke-recovery') {
      await store.revokeRecoveryLink(); return json({ revoked: true });
    }
    if (request.nextUrl.searchParams.get('action') === 'checkout') {
      const body = await bodyRequest.json().catch(() => null);
      const scenes: unknown = body?.scenes;
      if (!Array.isArray(scenes) || scenes.length < 1 || scenes.length > 3 || !scenes.every(isScene) ||
          new Set(scenes).size !== scenes.length) throw new PortraitError('selection', 400);
      const [available, owned] = await Promise.all([store.gallery(), store.purchases()]);
      if (scenes.some(scene => !available.includes(scene) || owned.includes(scene))) throw new PortraitError('selection', 400);
      return json({ url: await checkout(store.visitor.id, scenes, body.locale === 'zh' ? 'zh' : 'en', body.lang) });
    }
    if (request.nextUrl.searchParams.get('action') === 'retry') {
      const body = await bodyRequest.json().catch(() => null);
      if (typeof body?.jobId !== 'string') throw new PortraitError('selection', 400);
      const job = await store.retryJob(body.jobId);
      after(() => store.processJob(job.id));
      return json({ job });
    }
    const form = await bodyRequest.formData().catch(() => null);
    const scene = form?.get('scene');
    if (!form || !isScene(scene)) throw new PortraitError('files', 400);
    if (request.nextUrl.searchParams.get('action') === 'job') {
      const idempotencyKey = request.headers.get('idempotency-key');
      if (!idempotencyKey) throw new PortraitError('selection', 400);
      const job = await store.createJob(scene, form, idempotencyKey);
      if (job.status === 'queued') after(() => store.processJob(job.id));
      return json({ job });
    }
    throw new PortraitError('selection', 400);
  } catch (error) { return fail(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const origin = request.headers.get('origin');
    if (!origin || origin !== request.nextUrl.origin && origin !== process.env.NEXT_PUBLIC_SITE_URL) throw new PortraitError('missing', 403);
    const token = request.cookies.get(visitorCookie)?.value;
    const store = portraitStore(token);
    if (token !== store.visitor.token) throw new PortraitError('unavailable', 409);
    await store.deleteVisitor();
    const response = json({ deleted: true });
    response.cookies.set(visitorCookie, store.visitor.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) { return fail(error); }
}
