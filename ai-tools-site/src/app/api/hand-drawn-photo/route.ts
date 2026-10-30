import { handleDrawingRequest, createDrawingGate } from '@/lib/pet-photo/server';
import { editPetPhoto, getBailianConfig } from '@/lib/pet-photo/bailian';
import { supabaseServer } from '@/lib/supabase/server';
import { drawingCredits } from '@/lib/pet-photo/credit-store';

export const maxDuration = 240;
const gate = createDrawingGate();
const cookieName = 'drawing_visitor_v2';

function token(request: Request) {
  return request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}
function setVisitor(response: Response, value: string, request: Request) {
  response.headers.set('Set-Cookie', `${cookieName}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`);
  return response;
}
export async function GET(request: Request) {
  try {
    const credits = drawingCredits();
    const visitor = credits.visitor(token(request));
    const status = await credits.status(visitor.id, await getUser());
    return setVisitor(Response.json(status, { headers: { 'Cache-Control': 'private, no-store' } }), visitor.token, request);
  } catch { return Response.json({ error: '额度服务暂不可用，请稍后重试。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}

async function getUser() {
  const supabase = await supabaseServer();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  // An invalid or missing session is a guest; network failures must fail closed.
  if (error && error.name !== 'AuthSessionMissingError') throw new Error('Authentication unavailable');
  return user?.id ?? null;
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: '请求来源无效。' }, { status: 403 });
  let visitor;
  let credits;
  let user;
  try {
    credits = drawingCredits();
    visitor = credits.visitor(token(request));
    user = await getUser();
  } catch { return Response.json({ error: '账户或额度服务暂不可用，请稍后重试。' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  const response = await handleDrawingRequest(request, {
    gate,
    quota: () => credits.acquire(visitor.id, user),
    configured: () => { try { getBailianConfig(); return true; } catch { return false; } },
    generate: input => editPetPhoto(input),
    getUser: async () => user,
  });
  return setVisitor(response, visitor.token, request);
}
