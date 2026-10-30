import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTrialStore } from '../src/lib/pet-photo/trial.ts';

test('two trials survive restart, reject concurrent use, and cannot be minted from fake cookies', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'drawing-trial-'));
  try {
    const store = createTrialStore(dir);
    const visitor = await store.visitor();
    assert.equal((await store.visitor(visitor.token)).id, visitor.id);
    assert.notEqual((await store.visitor(visitor.token + 'fake')).id, visitor.id);
    const first = await store.acquire(visitor.id);
    assert.equal(first.reason, undefined);
    assert.equal((await store.acquire(visitor.id)).reason, 'busy');
    await first.release();
    const second = await createTrialStore(dir).acquire(visitor.id);
    assert.equal(second.reason, undefined);
    await second.release();
    assert.equal((await createTrialStore(dir).acquire(visitor.id)).reason, 'exhausted');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('global daily cap protects paid upstream even when new guest cookies are created', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'drawing-cap-'));
  try {
    const store = createTrialStore(dir, 1);
    const first = await store.visitor();
    const reserved = await store.acquire(first.id);
    await reserved.release();
    const second = await store.visitor();
    assert.equal((await store.acquire(second.id)).reason, 'unavailable');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
