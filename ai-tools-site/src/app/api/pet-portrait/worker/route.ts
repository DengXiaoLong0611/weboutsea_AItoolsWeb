import { NextRequest, NextResponse } from 'next/server';
import { processQueuedPortrait, PortraitError } from '@/lib/pet-portrait/server';

export const maxDuration = 240;
export async function POST(request: NextRequest) {
  const secret = process.env.PET_PORTRAIT_CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response(null, { status: 401 });
  try {
    return NextResponse.json({ processed: await processQueuedPortrait() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof PortraitError ? error.code : 'unavailable' },
      { status: error instanceof PortraitError ? error.status : 503 });
  }
}
