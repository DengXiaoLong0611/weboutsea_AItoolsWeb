import { NextRequest, NextResponse } from 'next/server';
import { isScene } from '@/lib/pet-portrait/catalog';
import { checkout, checkoutEnabled, PortraitError, portraitStore, visitorCookie } from '@/lib/pet-portrait/server';

export const maxDuration = 240;
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
function fail(error: unknown) {
  return error instanceof PortraitError ? json({ error: error.code }, error.status) : json({ error: 'unavailable' }, 503);
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(visitorCookie)?.value;
    const store = portraitStore(token);
    const query = request.nextUrl.searchParams;
    const action = query.get('action');
    const scene = query.get('scene');
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
    const token = request.cookies.get(visitorCookie)?.value;
    const store = portraitStore(token);
    if (token !== store.visitor.token) throw new PortraitError('unavailable', 409);
    const bytes = Number(request.headers.get('content-length'));
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > 3_700_000) throw new PortraitError('files', 413);
    if (request.nextUrl.searchParams.get('action') === 'checkout') {
      const body = await request.json().catch(() => null);
      const scenes: unknown = body?.scenes;
      if (!Array.isArray(scenes) || scenes.length < 1 || scenes.length > 3 || !scenes.every(isScene) ||
          new Set(scenes).size !== scenes.length) throw new PortraitError('selection', 400);
      const [available, owned] = await Promise.all([store.gallery(), store.purchases()]);
      if (scenes.some(scene => !available.includes(scene) || owned.includes(scene))) throw new PortraitError('selection', 400);
      return json({ url: await checkout(store.visitor.id, scenes, body.locale === 'zh' ? 'zh' : 'en', body.lang) });
    }
    const form = await request.formData().catch(() => null);
    const scene = form?.get('scene');
    if (!form || !isScene(scene)) throw new PortraitError('files', 400);
    await store.generate(scene, form);
    return json({ scene });
  } catch (error) { return fail(error); }
}
