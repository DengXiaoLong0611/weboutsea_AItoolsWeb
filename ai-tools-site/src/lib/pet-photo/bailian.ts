// Node-only: share between server code and the local test command, never import in a client component.
import { Buffer } from 'node:buffer';

export type BailianConfig = { apiKey: string; baseUrl: string; model: string };
type EditInput = { images: string[]; prompt: string };
type ApiResponse = {
  code?: string;
  request_id?: string;
  output?: { choices?: { message?: { content?: { image?: string }[] } }[] };
  usage?: { image_count?: number; width?: number; height?: number };
};

export function getBailianConfig(env: Record<string, string | undefined> = process.env): BailianConfig {
  if (typeof window !== 'undefined') throw new Error('百炼 API 只能在服务端调用。');
  const apiKey = env.DASHSCOPE_API_KEY?.trim();
  if (!apiKey) throw new Error('请在 .env.local 配置 DASHSCOPE_API_KEY。');
  const rawUrl = env.DASHSCOPE_BASE_URL?.trim();
  if (!rawUrl) throw new Error('请在 .env.local 配置 DASHSCOPE_BASE_URL，复制百炼控制台的 API 地址并保留 /api/v1。');
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error('DASHSCOPE_BASE_URL 不是有效的 URL。'); }
  const officialHost = /^dashscope(?:-intl|-us)?\.aliyuncs\.com$/.test(url.hostname)
    || /^[a-z0-9-]+\.[a-z0-9-]+\.maas\.aliyuncs\.com$/.test(url.hostname);
  if (!officialHost || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || !/^\/api\/v1\/?$/.test(url.pathname)) {
    throw new Error('DASHSCOPE_BASE_URL 必须是百炼官方 HTTPS API 地址，以 /api/v1 结尾，不含认证信息或查询参数。');
  }
  const model = env.DASHSCOPE_IMAGE_MODEL?.trim() || 'qwen-image-2.1-pro';
  if (!/^qwen-image-[a-z0-9.-]+$/.test(model)) throw new Error('DASHSCOPE_IMAGE_MODEL 应填写控制台中的千问图像模型 ID。');
  return { apiKey, baseUrl: rawUrl.replace(/\/$/, ''), model };
}

function validateImage(image: string) {
  const data = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (data) {
    if (Buffer.from(data[2], 'base64').length > 10 * 1024 * 1024) throw new Error('每张输入图片不能超过 10 MB。');
    return;
  }
  try {
    const url = new URL(image);
    if (url.protocol === 'https:' && !url.username && !url.password) return;
  } catch { /* Report one input error below. */ }
  throw new Error('图片必须是 HTTPS 地址或 JPG、PNG、WebP 的 Base64 数据。');
}

export async function editPetPhoto(input: EditInput, config: BailianConfig = getBailianConfig(), fetchImpl: typeof fetch = fetch) {
  // Revalidate even when a caller provides config directly.
  config = getBailianConfig({ DASHSCOPE_API_KEY: config.apiKey, DASHSCOPE_BASE_URL: config.baseUrl, DASHSCOPE_IMAGE_MODEL: config.model });
  // This tool needs only an original and one style reference, across Qwen image model versions.
  if (!input.images.length || input.images.length > 3) throw new Error('请提供 1–3 张图片，第一张为原照，第二张可作风格参考。');
  input.images.forEach(validateImage);
  if (!input.prompt.trim()) throw new Error('手绘指令不能为空。');
  let response: Response;
  let data: ApiResponse;
  try {
    response = await fetchImpl(`${config.baseUrl}/services/aigc/multimodal-generation/generation`, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        input: { messages: [{ role: 'user', content: [...input.images.map(image => ({ image })), { text: input.prompt }] }] },
        parameters: { n: 1, prompt_extend: false, watermark: false },
      }),
      signal: AbortSignal.timeout(180_000),
    });
    data = await response.json();
  } catch (error) {
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) {
      throw new Error('百炼请求超时；未自动重试，请先在控制台查看调用记录再决定是否重试。');
    }
    throw new Error('无法读取百炼响应，请检查网络、API 地址和控制台调用记录；未自动重试。');
  }
  if (!data || typeof data !== 'object') throw new Error('百炼返回了无效响应。');
  if (!response.ok || data.code) {
    const code = typeof data.code === 'string' && /^[\w.:-]{1,100}$/.test(data.code) && !data.code.includes(config.apiKey) ? data.code : 'UnknownError';
    const hint = /balance|quota|arrear/i.test(code) ? '请检查百炼余额或额度。'
      : /apikey|auth|accessdenied/i.test(code) || response.status === 401 || response.status === 403 ? '请检查密钥、地域及模型权限。'
      : response.status === 429 ? '请求受到限流或额度限制，请查看控制台。' : '请查看控制台调用记录。';
    throw new Error(`百炼调用失败（HTTP ${response.status}，${code}）。${hint}未自动重试。`);
  }
  const choices = data.output?.choices;
  const images = Array.isArray(choices) ? choices.flatMap(choice => Array.isArray(choice.message?.content) ? choice.message.content.flatMap(item => typeof item.image === 'string' ? [item.image] : []) : []) : [];
  if (!images.length) throw new Error('百炼响应中没有生成图片，请检查内容审核和模型调用记录。');
  for (const image of images) {
    try {
      const url = new URL(image);
      if (url.protocol === 'https:' && !url.username && !url.password) continue;
    } catch { /* Reject malformed generated URLs. */ }
    throw new Error('百炼返回了无效的图片地址。');
  }
  return { images, requestId: data.request_id, usage: data.usage, model: config.model };
}
