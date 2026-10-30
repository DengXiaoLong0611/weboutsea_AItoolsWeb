import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDrawingRequest, createDrawingGate } from '../src/lib/pet-photo/server.ts';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
function request(style = '1', bytes = png, origin = 'https://site.test') {
  const form = new FormData();
  form.set('image', new Blob([bytes], { type: 'image/png' }), 'photo.png');
  form.set('style', style);
  return new Request('https://site.test/api/hand-drawn-photo', { method: 'POST', headers: { origin }, body: form });
}
const deps = (overrides = {}) => ({ getUser: async () => 'u1', gate: createDrawingGate(), configured: () => true, generate: async () => ({ images: ['https://cdn.test/result.png'], requestId: 'req1' }), ...overrides });

test('rejects unauthenticated and foreign-origin requests before generation', async () => {
  const generate = async () => { assert.fail('must not call paid API'); };
  assert.equal((await handleDrawingRequest(request(), deps({ generate, getUser: async () => null }))).status, 401);
  assert.equal((await handleDrawingRequest(request('1', png, 'https://evil.test'), deps({ generate }))).status, 403);
});
test('rejects unsupported styles, fake image bytes and oversized requests', async () => {
  const d = deps({ generate: async () => assert.fail('must not generate') });
  assert.equal((await handleDrawingRequest(request('bad'), d)).status, 400);
  assert.equal((await handleDrawingRequest(request('1', Buffer.from('not an image')), d)).status, 400);
  const oversized = new Request('https://site.test/api/hand-drawn-photo', { method: 'POST', headers: { origin: 'https://site.test', 'Content-Type': 'multipart/form-data; boundary=test' }, body: Buffer.alloc(4 * 1024 * 1024) });
  assert.equal((await handleDrawingRequest(oversized, d)).status, 413);
});
test('successful generation uses server prompt and returns only result metadata', async () => {
  const result = await handleDrawingRequest(request('2'), deps({ generate: async (input) => {
    assert.match(input.images[0], /^data:image\/png;base64,/);
    assert.equal(input.images.length, 1);
    assert.match(input.prompt, /彩铅/);
    return { images: ['https://cdn.test/result.png'], requestId: 'req1' };
  } }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).image, 'https://cdn.test/result.png');
  assert.match(result.headers.get('cache-control'), /no-store/);
});

test('default style follows example cartoon oil pastel while keeping source identity separate', async () => {
  const response = await handleDrawingRequest(request(), deps({ generate: async input => {
    assert.equal(input.images.length, 1);
    assert.match(input.prompt, /原照.*唯一依据/);
    assert.match(input.prompt, /Q版/);
    assert.match(input.prompt, /粗.*黑色/);
    assert.match(input.prompt, /纯白/);
    assert.match(input.prompt, /只有宠物时不要增加人物/);
    return { images: ['https://cdn.test/cartoon.png'] };
  } }));
  assert.equal(response.status, 200);
});

test('daily attempts and concurrent requests are limited; busy state releases after failure', async () => {
  const gate = createDrawingGate(1);
  const release = gate.acquire('u');
  assert.equal(typeof release, 'function');
  assert.equal(gate.acquire('u'), null);
  release();
  assert.equal(gate.acquire('u'), null);
  const d = deps({ generate: async () => { throw new Error('SECRET_KEY'); } });
  const failed = await handleDrawingRequest(request(), d);
  assert.equal(failed.status, 502);
  assert.doesNotMatch(await failed.text(), /SECRET_KEY/);
  d.generate = async () => ({ images: ['https://cdn.test/result.png'] });
  assert.equal((await handleDrawingRequest(request(), d)).status, 200);
});
test('configuration and auth service failures do not expose internal details', async () => {
  assert.equal((await handleDrawingRequest(request(), deps({ configured: () => false }))).status, 503);
  assert.equal((await handleDrawingRequest(request(), deps({ getUser: async () => { throw new Error('private'); } }))).status, 503);
});

test('guest trials do not require auth; exhaustion prompts login then purchase without calling provider', async () => {
  const d = deps({ getUser: async () => { assert.fail('guest generation must not require auth'); }, trial: async () => ({ release: async () => {} }) });
  assert.equal((await handleDrawingRequest(request(), d)).status, 200);
  d.trial = async () => ({ reason: 'exhausted' });
  d.generate = async () => assert.fail('trial exhausted must not call paid API');
  d.getUser = async () => null;
  assert.equal((await handleDrawingRequest(request(), d)).status, 401);
  d.getUser = async () => 'signed-in';
  assert.equal((await handleDrawingRequest(request(), d)).status, 402);
  d.trial = async () => ({ reason: 'busy' });
  assert.equal((await handleDrawingRequest(request(), d)).status, 429);
});
