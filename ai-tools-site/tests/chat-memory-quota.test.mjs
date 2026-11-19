import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryChatQuotaStore } from '../src/lib/chat/memory.ts';

test('development quota persists across calls, exhausts at 20, resets at UTC midnight', async () => {
  let now = Date.parse('2026-11-20T23:59:00Z');
  const store = createMemoryChatQuotaStore(() => now);
  for (let i = 0; i < 20; i++) {
    const reservation = await store.reserve('guest:test', `network:${i}`);
    await reservation.settle(true);
  }
  assert.equal((await store.reserve('guest:test', 'another')).reason, 'exhausted');
  assert.equal((await store.status('guest:test')).remaining, 0);
  now = Date.parse('2026-11-21T00:00:00Z');
  assert.equal((await store.status('guest:test')).remaining, 20);
});

test('development refunds and lease expiry cannot affect a different day or reservation', async () => {
  let now = Date.parse('2026-11-20T23:59:00Z');
  const store = createMemoryChatQuotaStore(() => now);
  const yesterday = await store.reserve('user:test', 'network');
  assert.equal((await store.reserve('user:test', 'other')).reason, 'busy');
  now += 60000;
  const today = await store.reserve('user:test', 'network');
  await yesterday.settle(false);
  await yesterday.settle(false);
  assert.equal((await store.status('user:test')).remaining, 19);
  now += 180001;
  const next = await store.reserve('user:test', 'network');
  await today.settle(false);
  assert.equal((await store.status('user:test')).busy, true);
  await next.settle(true);
  assert.equal((await store.status('user:test')).remaining, 19);
});
