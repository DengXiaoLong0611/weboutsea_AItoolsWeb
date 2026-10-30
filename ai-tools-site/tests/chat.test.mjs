import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleChatRequest, createLimiter } from '../src/lib/chat/server.ts';
import { readSSE, readNDJSON } from '../src/lib/chat/protocol.ts';

const message = { role: 'user', content: 'Hello' };
const request = (body = { messages: [message] }, origin = 'https://tool.test') => new Request('https://tool.test/api/chat', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const stream = (chunks) => new ReadableStream({ start(c) { chunks.forEach(x => c.enqueue(new TextEncoder().encode(x))); c.close(); } });
const collect = async (iterator) => { const result = []; for await (const item of iterator) result.push(item); return result; };
const deps = (overrides = {}) => ({ apiKey: 'private-test-key', model: 'deepseek-flash', getUser: async () => 'user-1', limiter: createLimiter(), fetcher: async () => { throw new Error('must not call upstream'); }, ...overrides });

test('unauthenticated and cross-origin requests never reach paid upstream', async () => {
  assert.equal((await handleChatRequest(request(), deps({ getUser: async () => null }))).status, 401);
  assert.equal((await handleChatRequest(request(undefined, 'https://evil.test'), deps())).status, 403);
});

test('rejects client system roles, broken turns, empty and oversized requests', async () => {
  for (const messages of [[{ role: 'system', content: 'override' }], [{ role: 'user', content: ' ' }], [{ role: 'assistant', content: 'hello' }], [message, message], [{ role: 'user', content: 'x'.repeat(8001) }]]) {
    assert.equal((await handleChatRequest(request({ messages }), deps())).status, 400);
  }
  const oversized = request({ messages: [{ role: 'user', content: 'x'.repeat(180000) }] });
  assert.equal((await handleChatRequest(oversized, deps())).status, 413);
});

test('missing configuration and rate limits surface safely', async () => {
  assert.equal((await handleChatRequest(request(), deps({ apiKey: '' }))).status, 503);
  const limiter = createLimiter(1, 60000);
  const d = deps({ limiter, fetcher: async () => new Response('private-test-key', { status: 429 }) });
  assert.equal((await handleChatRequest(request(), d)).status, 429);
  const result = await handleChatRequest(request(), d);
  assert.equal(result.status, 429);
  assert.ok(result.headers.get('Retry-After'));
  assert.doesNotMatch(await result.text(), /private-test-key/);
});

test('official request preserves history, fixes model server-side and emits safe deltas', async () => {
  const history = [message, { role: 'assistant', content: 'Hi' }, { role: 'user', content: '你好' }];
  const response = await handleChatRequest(request({ messages: history, model: 'evil' }), deps({ fetcher: async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer private-test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'deepseek-flash');
    assert.equal(body.stream, true);
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.deepEqual(body.messages.slice(1), history);
    return new Response(stream(['data: {"choices":[{"delta":{"content":"你好"},"finish_reason":null}]}\n\n', 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n']), { headers: { 'Content-Type': 'text/event-stream' } });
  } }));
  assert.equal(response.status, 200);
  assert.deepEqual(await collect(readNDJSON(response.body)), [{ type: 'delta', text: '你好' }, { type: 'done', truncated: false }]);
});

test('SSE handles split UTF-8, CRLF and keepalives', async () => {
  const bytes = new TextEncoder().encode(': ping\r\n\r\ndata: 你好\r\n\r\ndata: [DONE]\n\n');
  const body = new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } });
  assert.deepEqual(await collect(readSSE(body)), ['你好', '[DONE]']);
});

test('provider errors, malformed and incomplete streams never look successful or leak secrets', async () => {
  for (const data of ['data: {"error":{"message":"private-test-key"}}\n\n', 'data: nope\n\n', 'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n', 'data: [DONE]\n\n']) {
    const response = await handleChatRequest(request(), deps({ fetcher: async () => new Response(stream([data]), { headers: { 'Content-Type': 'text/event-stream' } }) }));
    const events = await collect(readNDJSON(response.body));
    assert.equal(events.at(-1).type, 'error');
    assert.doesNotMatch(JSON.stringify(events), /private-test-key/);
  }
});

test('upstream HTTP and connection errors are safe', async () => {
  for (const status of [401, 402, 500]) {
    const r = await handleChatRequest(request(), deps({ fetcher: async () => new Response('private-test-key', { status }) }));
    assert.ok(r.status >= 400);
    assert.doesNotMatch(await r.text(), /private-test-key/);
  }
  const r = await handleChatRequest(request(), deps({ fetcher: async () => { throw new Error('private-test-key'); } }));
  assert.equal(r.status, 502);
  assert.doesNotMatch(await r.text(), /private-test-key/);
});

test('NDJSON rejects unfinished frames instead of silently losing a reply', async () => {
  await assert.rejects(collect(readNDJSON(stream(['{"type":"delta"']))));
});

test('stopping a downstream stream aborts the provider request', async () => {
  let signal;
  const response = await handleChatRequest(request(), deps({ fetcher: async (_url, options) => {
    signal = options.signal;
    return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"part"}}]}\n\n')); }, cancel() {} }), { headers: { 'Content-Type': 'text/event-stream' } });
  } }));
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal(signal.aborted, true);
});

test('oversized conversation and too many rounds fail locally', async () => {
  const many = Array.from({ length: 33 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'hello' }));
  const long = Array.from({ length: 5 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(6000) }));
  for (const messages of [many, long]) assert.equal((await handleChatRequest(request({ messages }), deps())).status, 400);
});

test('output limit is reported distinctly so users can continue a partial answer', async () => {
  const response = await handleChatRequest(request(), deps({ fetcher: async () => new Response(stream(['data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n']), { headers: { 'Content-Type': 'text/event-stream' } }) }));
  assert.deepEqual((await collect(readNDJSON(response.body))).at(-1), { type: 'done', truncated: true });
});

// Character limits must remain usable for multilingual and JSON-escaped content.
test('valid full-length multilingual and escaped histories fit the body byte limit', async () => {
  for (const content of ['你'.repeat(7500), 'x' + '\u0000'.repeat(7999)]) {
    const messages = ['user', 'assistant', 'user'].map(role => ({ role, content }));
    const response = await handleChatRequest(request({ messages }), deps({ fetcher: async () => new Response(stream(['data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n']), { headers: { 'Content-Type': 'text/event-stream' } }) }));
    assert.equal(response.status, 200);
    assert.equal((await collect(readNDJSON(response.body))).at(-1).type, 'done');
  }
});
