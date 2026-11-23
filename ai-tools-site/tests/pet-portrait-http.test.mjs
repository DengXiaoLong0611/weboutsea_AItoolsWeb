import test from 'node:test';
import assert from 'node:assert/strict';
import { readLimitedBody } from '../src/lib/pet-portrait/http.ts';

test('chunked bodies are bounded even when content-length is missing or false', async () => {
  for (const declared of [undefined, '1']) {
    let cancelled = false;
    const body = new ReadableStream({
      start(c) { c.enqueue(new Uint8Array(8)); c.enqueue(new Uint8Array(8)); },
      cancel() { cancelled = true; },
    });
    const req = new Request('https://example.test', { method: 'POST', body, duplex: 'half', headers: declared ? { 'content-length': declared } : {} });
    await assert.rejects(readLimitedBody(req, 10));
    assert.ok(cancelled);
  }
});

test('small webhook bodies retain their exact bytes for signature verification', async () => {
  const body = '{"message":"中文"}\n';
  const actual = await readLimitedBody(new Request('https://example.test', { method: 'POST', body }), 100);
  assert.equal(new TextDecoder().decode(actual), body);
});
