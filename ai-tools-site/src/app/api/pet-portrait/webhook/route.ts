import { readLimitedBody, PortraitBodyError } from '@/lib/pet-portrait/http';
import { PortraitError, stripeWebhook } from '@/lib/pet-portrait/server';


export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response(null, { status: 400 });
  try {
    const bytes = await readLimitedBody(request, 1_000_000);
    await stripeWebhook(new TextDecoder('utf-8', { fatal: true }).decode(bytes), signature);
    return new Response(null, { status: 204 });
  } catch (error) {
    return new Response(null, { status: error instanceof PortraitBodyError ? 413 : error instanceof PortraitError ? error.status : 500 });
  }
}
