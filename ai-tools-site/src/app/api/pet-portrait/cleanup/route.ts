import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredPortraits, PortraitError } from '@/lib/pet-portrait/server';

export async function POST(request: NextRequest) {
  const secret = process.env.PET_PORTRAIT_CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }
  try {
    const cleaned = await cleanupExpiredPortraits();
    return NextResponse.json({ cleaned }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof PortraitError ? error.code : 'unavailable' },
      { status: error instanceof PortraitError ? error.status : 503 },
    );
  }
}
