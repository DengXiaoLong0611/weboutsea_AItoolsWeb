import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisitorIdentity, createCreditStore } from '../src/lib/pet-photo/credits.ts';

const visitorId = '12345678-1234-4234-8234-123456789abc';
test('guest identity survives reload, rejects forgery and requires a server secret', () => {
  assert.throws(() => createVisitorIdentity('short'));
  const identity = createVisitorIdentity('a'.repeat(64));
  const visitor = identity();
  assert.equal(identity(visitor.token).id, visitor.id);
  assert.notEqual(identity(visitor.token + 'x').id, visitor.id);
  assert.notEqual(createVisitorIdentity('b'.repeat(64))(visitor.token).id, visitor.id);
});

test('quota adapter uses server identities, reserves before settlement, and settles once', async () => {
  const calls = [];
  const store = createCreditStore(async (name, args) => {
    calls.push({ name, args });
    return name === 'drawing_reserve' ? { reason: null, reservation: visitorId } : {};
  });
  const reservation = await store.acquire(visitorId, 'account-id');
  assert.equal(reservation.reason, undefined);
  await reservation.settle(false);
  await reservation.settle(true);
  assert.deepEqual(calls, [
    { name: 'drawing_reserve', args: { p_visitor: visitorId, p_user: 'account-id' } },
    { name: 'drawing_settle', args: { p_reservation: visitorId, p_success: false } },
  ]);
});

test('quota failures fail closed, and never turn a database error into free generation', async () => {
  const store = createCreditStore(async () => { throw new Error('private key'); });
  assert.equal((await store.acquire(visitorId, null)).reason, 'unavailable');
  const malformed = createCreditStore(async () => ({ reason: null }));
  assert.equal((await malformed.acquire(visitorId, null)).reason, 'unavailable');
  for (const reason of ['login', 'payment', 'busy', 'unavailable']) {
    const limited = createCreditStore(async () => ({ reason }));
    assert.equal((await limited.acquire(visitorId, null)).reason, reason);
  }
});

test('remaining quota is read from durable storage and malformed replies are rejected', async () => {
  const store = createCreditStore(async () => ({ signedIn: true, freeRemaining: 1, paidRemaining: 0, busy: false }));
  assert.deepEqual(await store.status(visitorId, 'u'), { signedIn: true, freeRemaining: 1, paidRemaining: 0, busy: false });
  await assert.rejects(createCreditStore(async () => ({ freeRemaining: -1 })).status(visitorId, null));
});
