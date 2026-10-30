import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDrawingRequest, createDrawingGate } from '../src/lib/pet-photo/server.ts';
import { BailianRejectedError } from '../src/lib/pet-photo/bailian.ts';

function request() {
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const form = new FormData();
  form.set('image', new Blob([image], { type: 'image/png' }), 'photo.png');
  form.set('style', '1');
  return new Request('https://site.test/api/hand-drawn-photo', { method: 'POST', headers: { origin: 'https://site.test' }, body: form });
}
const deps = overrides => ({ getUser: async () => null, gate: createDrawingGate(), configured: () => true, ...overrides });

test('durable credits are confirmed after successful generation and refunded after failure', async () => {
  const events = [];
  const d = deps({ quota: async () => ({ settle: async success => { events.push(success); } }), generate: async () => { events.push('generate'); return { images: ['https://cdn.test/result.png'] }; } });
  assert.equal((await handleDrawingRequest(request(), d)).status, 200);
  assert.deepEqual(events, ['generate', true]);
  events.length = 0;
  d.generate = async () => { throw new BailianRejectedError('private provider rejection'); };
  assert.equal((await handleDrawingRequest(request(), d)).status, 502);
  assert.deepEqual(events, [false]);
});

test('unknown provider outcomes retain the reservation rather than granting a retry', async () => {
  let settlements = 0;
  const d = deps({ quota: async () => ({ settle: async () => { settlements++; } }), generate: async () => { throw new Error('response lost after provider accepted'); } });
  const response = await handleDrawingRequest(request(), d);
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /保留|核实/);
  assert.equal(settlements, 0);
});

test('login, payment and unavailable storage block provider calls', async () => {
  for (const [reason, status] of [['login', 401], ['payment', 402], ['busy', 429], ['unavailable', 503]]) {
    const d = deps({ quota: async () => ({ reason }), generate: async () => assert.fail('must not call provider') });
    assert.equal((await handleDrawingRequest(request(), d)).status, status);
  }
});

test('invalid image requests never reserve credit', async () => {
  const req = request();
  const form = await req.formData();
  form.set('image', new Blob(['invalid'], { type: 'image/png' }), 'bad.png');
  const invalid = new Request(req.url, { method: 'POST', headers: { origin: 'https://site.test' }, body: form });
  assert.equal((await handleDrawingRequest(invalid, deps({ quota: async () => assert.fail('no reservation for bad input'), generate: async () => assert.fail('no generation') }))).status, 400);
});
