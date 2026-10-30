import { Buffer } from 'node:buffer';
import type { TrialResult } from './trial.ts';
import type { CreditReservation } from './credits.ts';
import { drawingStyles, drawingPrompt } from './styles.ts';
import { BailianRejectedError } from './bailian.ts';

type Generated = { images: string[]; requestId?: string };
type Gate = { acquire: (user: string) => (() => void) | null };
type Dependencies = {
  getUser: () => Promise<string | null>;
  configured: () => boolean;
  gate: Gate;
  generate: (input: { images: string[]; prompt: string }) => Promise<Generated>;
  trial?: () => Promise<TrialResult>;
  quota?: () => Promise<CreditReservation>;
};
const MAX_FILE = 3 * 1024 * 1024;
const MAX_BODY = MAX_FILE + 64 * 1024;

// Per-process protection; use shared durable storage before scaling to multiple instances.
export function createDrawingGate(limit = 3): Gate {
  const entries = new Map<string, { count: number; day: string; busy: boolean }>();
  return { acquire(user) {
    const day = new Date().toISOString().slice(0, 10);
    for (const [id, item] of entries) if (item.day !== day && !item.busy) entries.delete(id);
    const previous = entries.get(user);
    if (previous?.busy) return null;
    const entry = previous?.day === day ? previous : { count: 0, day, busy: false };
    if (entry.count >= limit || (!previous && entries.size >= 10000)) return null;
    entry.count++;
    entry.busy = true;
    entries.set(user, entry);
    return () => { entry.busy = false; };
  } };
}
function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}

async function boundedForm(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new Error('invalid');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new Error('large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData();
}

export async function handleDrawingRequest(request: Request, deps: Dependencies): Promise<Response> {
  if (request.headers.get('origin') !== new URL(request.url).origin) return error('请求来源无效，请从本站操作。', 403);
  let user: string | null = null;
  if (!deps.trial && !deps.quota) {
    try { user = await deps.getUser(); } catch { return error('登录服务暂不可用，请稍后重试。', 503); }
    if (!user) return error('请先登录，再生成手绘图片。', 401);
  }
  if (!deps.configured()) return error('图片生成服务尚未配置，请联系管理员。', 503);
  let image: string;
  let style: string;
  try {
    const form = await boundedForm(request);
    const file = form.get('image');
    style = String(form.get('style') ?? '');
    if (!drawingStyles.some(item => item.id === style) || !(file instanceof File) || !file.size) throw new Error('invalid');
    if (file.size > MAX_FILE) throw new Error('large');
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
      : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' ? 'image/webp' : '';
    if (!mime || mime !== file.type) throw new Error('invalid');
    image = `data:${mime};base64,${bytes.toString('base64')}`;
  } catch (e) {
    return e instanceof Error && e.message === 'large' ? error('照片不能超过 3 MB，请压缩后上传。', 413) : error('请上传有效的 JPG、PNG 或 WebP 照片，并选择画风。', 400);
  }
  let release: (() => void | Promise<void>) | null;
  let reservation: CreditReservation | undefined;
  if (deps.quota) {
    try { reservation = await deps.quota(); } catch { return error('额度服务暂不可用，请稍后重试。', 503); }
    if (reservation.reason === 'login') return error('免登录体验已用完，请登录后查看剩余免费额度。', 401);
    if (reservation.reason === 'payment') return error('免费额度已用完，需要购买生成次数。购买功能尚未开放，目前暂不收款。', 402);
    if (reservation.reason === 'busy') return error('已有图片正在生成，请等待完成。', 429);
    if (reservation.reason === 'unavailable') return error('额度服务暂不可用，或今日免费体验人数已达上限，请稍后重试。', 503);
    release = () => {};
  } else if (deps.trial) {
    const allowance = await deps.trial();
    if (allowance.reason === 'busy') return error('已有图片正在生成，请等待完成。', 429);
    if (allowance.reason === 'unavailable') return error('免费试用暂不可用或本站今日试用额度已用完，请稍后再来。', 503);
    if (allowance.reason === 'exhausted') {
      try { user = await deps.getUser(); } catch { return error('登录服务暂不可用，请稍后重试。', 503); }
      return error(user ? '两次免费试用已用完。购买入口已预留，支付功能即将开放。' : '两次免费试用已用完，请登录后查看购买方式。', user ? 402 : 401);
    }
    release = allowance.release!;
  } else release = deps.gate.acquire(user!);
  if (!release) return error('已有图片正在生成，或今日 3 次生成额度已用完（UTC 零点重置）。', 429);
  let outcome: boolean | undefined;
  try {
    const result = await deps.generate({ images: [image], prompt: drawingPrompt(style) });
    const url = new URL(result.images[0]);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid result');
    outcome = true;
    return Response.json({ image: url.href, requestId: result.requestId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (cause) {
    if (cause instanceof BailianRejectedError) {
      outcome = false;
      return error('模型未接受本次生成，系统会尝试退还额度，请稍后查看剩余次数。', 502);
    }
    return error('生成结果暂时无法确认，本次额度暂时保留，请联系管理员核实，避免重复生成。', 502);
  } finally {
    // Keep an already generated result accessible even if settlement is offline.
    // Unsettled reservations remain consumed for conservative reconciliation.
    if (reservation && !reservation.reason && outcome !== undefined) {
      try { await reservation.settle(outcome); }
      catch { console.error('Drawing credit settlement failed; reconcile pending reservations.'); }
    }
    await release();
  }
}
