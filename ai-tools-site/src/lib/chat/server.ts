import { readSSE, type ChatEvent } from "./protocol.ts";

type Message = { role: "user" | "assistant"; content: string };
type Limiter = (user: string) => boolean;
type Dependencies = {
  apiKey?: string;
  model?: string;
  siteOrigin?: string;
  getUser: () => Promise<string | null>;
  limiter: Limiter;
  fetcher?: typeof fetch;
};

export function createLimiter(limit = 15, windowMs = 60000): Limiter {
  const entries = new Map<string, { count: number; until: number }>();
  return (user) => {
    const now = Date.now();
    for (const [id, entry] of entries) if (entry.until <= now) entries.delete(id);
    const entry = entries.get(user);
    if (entry) {
      if (entry.count >= limit) return false;
      entry.count++;
    } else {
      if (entries.size >= 10000) return false;
      entries.set(user, { count: 1, until: now + windowMs });
    }
    return true;
  };
}

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function error(code: string, status: number) {
  return Response.json({ error: code }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
}

async function input(request: Request): Promise<Message[]> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("invalid_request");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 163840) { await reader.cancel(); throw new Error("too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const body = JSON.parse(new TextDecoder().decode(bytes));
  const messages = body?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 31 || messages.length % 2 !== 1) throw new Error("invalid_request");
  let length = 0;
  return messages.map((m, index) => {
    if (!m || m.role !== (index % 2 === 0 ? "user" : "assistant") || typeof m.content !== "string" || !m.content.trim() || m.content.length > 8000) throw new Error("invalid_request");
    length += m.content.length;
    if (length > 24000) throw new Error("invalid_request");
    return { role: m.role, content: m.content };
  });
}

export async function handleChatRequest(request: Request, deps: Dependencies): Promise<Response> {
  const origin = request.headers.get("origin");
  const ownOrigin = new URL(request.url).origin;
  if (!origin || (origin !== ownOrigin && origin !== deps.siteOrigin)) return error("forbidden", 403);
  let user: string | null;
  try { user = await deps.getUser(); } catch { return error("auth_unavailable", 503); }
  if (!user) return error("sign_in_required", 401);
  if (!deps.apiKey?.trim()) return error("not_configured", 503);
  if (!deps.limiter(user)) return error("rate_limited", 429);
  let messages: Message[];
  try { messages = await input(request); } catch (e) { return error(e instanceof Error && e.message === "too_large" ? "too_large" : "invalid_request", e instanceof Error && e.message === "too_large" ? 413 : 400); }

  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const timer = setTimeout(abort, 90000);
  const cleanup = () => { clearTimeout(timer); request.signal.removeEventListener("abort", abort); };
  let upstream: Response;
  try {
    upstream = await (deps.fetcher ?? fetch)("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.apiKey.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: deps.model?.trim() || "deepseek-flash", thinking: { type: "disabled" }, stream: true, max_tokens: 4096, messages: [{ role: "system", content: "You are a helpful AI assistant. Answer in the user's language. Be clear and honest about uncertainty." }, ...messages] }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    cleanup();
    return error(controller.signal.aborted ? "timeout" : "provider_unavailable", controller.signal.aborted ? 504 : 502);
  }
  if (!upstream.ok || !upstream.body || !upstream.headers.get("content-type")?.includes("text/event-stream")) {
    await upstream.body?.cancel().catch(() => {});
    cleanup();
    const code = upstream.status === 402 ? "provider_balance" : upstream.status === 429 ? "provider_busy" : upstream.status === 401 ? "provider_auth" : "provider_unavailable";
    return error(code, upstream.status === 429 ? 429 : 502);
  }
  const body = upstream.body;
  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      const emit = (event: ChatEvent) => { if (!cancelled) output.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
      let content = "";
      let finish: string | null = null;
      let complete = false;
      try {
        for await (const data of readSSE(body)) {
          if (data === "[DONE]") { complete = true; break; }
          const event = JSON.parse(data);
          if (event.error) throw new Error("provider_error");
          const choice = event.choices?.[0];
          if (typeof choice?.delta?.content === "string" && choice.delta.content) {
            content += choice.delta.content;
            emit({ type: "delta", text: choice.delta.content });
          }
          if (choice?.finish_reason) finish = choice.finish_reason;
        }
        if (!complete || !content.trim() || (finish !== "stop" && finish !== "length")) throw new Error("incomplete_stream");
        emit({ type: "done", truncated: finish === "length" });
      } catch {
        emit({ type: "error", code: controller.signal.aborted ? "timeout" : "stream_failed" });
      } finally {
        cleanup();
        controller.abort();
        if (!cancelled) output.close();
      }
    },
    cancel() { cancelled = true; controller.abort(); cleanup(); },
  });
  return new Response(stream, { headers: { ...headers, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Accel-Buffering": "no" } });
}
