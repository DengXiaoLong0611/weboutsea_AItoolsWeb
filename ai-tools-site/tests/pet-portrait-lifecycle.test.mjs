import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPortraitServer, rowsQuery, ProviderRejected } from './helpers/portrait-server.mjs';

const visitor = '11111111-1111-4111-8111-111111111111';
const session = { id: 'cs_test_12345678', mode: 'payment', status: 'complete', payment_status: 'paid', currency: 'usd', amount_total: 1300,
  metadata: { product: 'pet-portrait', visitor, scenes: 'studio', amount: '1300' } };

test('Stripe verification rejects a self-consistent but underpriced checkout', () => {
  const server = loadPortraitServer({});
  assert.equal(server.verifyCheckoutForTest(visitor, session).length, 1);
  assert.equal(server.verifyCheckoutForTest(visitor, { ...session, amount_total: 1, metadata: { ...session.metadata, amount: '1' } }).length, 0);
});

test('refunded line items cannot keep download access through legacy receipts', async () => {
  const db = { storage: { from: () => ({}) }, rpc: async () => ({ data: [], error: null }), from(table) {
    return rowsQuery(table === 'pet_portrait_receipts' ? [{ scenes: ['studio'] }] : []);
  } };
  const store = loadPortraitServer(db).portraitStore('test-token');
  assert.equal((await store.purchases()).length, 0);
});

test('two workers claiming one queued job call the provider only once', async () => {
  const job = { id: 'job-1', visitor, scene: 'studio', status: 'queued', retry_count: 0, prompt: 'saved prompt', model: 'test-model' };
  let calls = 0;
  const db = {
    storage: { from: () => ({ download: async () => ({ data: new Blob(['reference']), error: null }) }) },
    from: () => rowsQuery([{ ...job }], value => Object.assign(job, value)),
    rpc: async name => {
      assert.equal(name, 'claim_pet_portrait_job');
      if (job.status !== 'queued') return { data: [], error: null };
      job.status = 'processing'; return { data: [{ ...job }], error: null };
    },
  };
  const store = loadPortraitServer(db, { generate: async () => { calls++; throw new ProviderRejected('rejected'); } }).portraitStore('test-token');
  await Promise.all([store.processJob('job-1'), store.processJob('job-1')]);
  assert.equal(calls, 1);
});

test('unknown provider outcomes are not retried as if no charge occurred', async () => {
  const row = { id: 'job-1', visitor, scene: 'studio', status: 'failed', retry_count: 0, error_code: 'generation_unknown' };
  const db = { storage: { from: () => ({}) }, from: () => rowsQuery([row]), rpc: async () => ({ data: [], error: null }) };
  await assert.rejects(loadPortraitServer(db).portraitStore('test-token').retryJob('job-1'));
});

test('storage deletion failures are reported instead of claiming the data was removed', async () => {
  const db = { storage: { from: () => ({ list: async () => ({ data: [{ name: 'studio-full.jpg' }], error: null }),
    remove: async () => ({ error: { message: 'storage down' } }) }) }, from: () => rowsQuery([]),
    rpc: async () => ({ data: true, error: null }) };
  await assert.rejects(loadPortraitServer(db).portraitStore('test-token').deleteVisitor());
});

test('invalid recovery tokens never query private orders', async () => {
  const db = { from() { throw new Error('Database must not be queried'); } };
  const server = loadPortraitServer(db);
  assert.equal(typeof server.restorePortraitGallery, 'function');
  await assert.rejects(server.restorePortraitGallery('guessable-order-id'));
});

test('delivery retries reuse the saved provider result without generating again', async () => {
  const row = { id: 'job-cached', visitor, scene: 'studio', status: 'queued', retry_count: 1,
    provider_image_url: 'https://provider.example/result.jpg' };
  let generated = 0;
  let fetched = 0;
  const db = { storage: { from: () => ({}) }, from: () => rowsQuery([row], value => Object.assign(row, value)),
    rpc: async () => ({ data: [{ ...row, status: 'processing' }], error: null }) };
  const store = loadPortraitServer(db, {
    generate: async () => { generated++; throw new Error('Must reuse saved image'); },
    fetch: async () => { fetched++; throw new Error('Temporary delivery outage'); },
  }).portraitStore('test-token');
  const result = await store.processJob(row.id);
  assert.equal(generated, 0);
  assert.equal(fetched, 1);
  assert.equal(result.errorCode, 'delivery');
  assert.equal(result.canRetry, true);
});
