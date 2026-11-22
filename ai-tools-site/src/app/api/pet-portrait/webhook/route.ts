import { PortraitError, stripeWebhook } from '@/lib/pet-portrait/server';


export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const bytes = Number(request.headers.get('content-length'));
  if (!signature || bytes < 1 || bytes > 1_000_000) return new Response(null, { status: 400 });
  try {
    await stripeWebhook(await request.text(), signature);
    return new Response(null, { status: 204 });
  } catch (error) {
    return new Response(null, { status: error instanceof PortraitError ? error.status : 500 });
  }
}
