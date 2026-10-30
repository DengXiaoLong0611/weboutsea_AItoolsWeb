import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/tools/hand-drawn-photo/app.js', import.meta.url), 'utf8');
const allowance = (overrides = {}) => ({ ok: true, json: async () => ({ signedIn: false, freeRemaining: 1, paidRemaining: 0, busy: false, ...overrides }) });
function setup(fetch, clock = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { hidden: false, disabled: false, files: [new Blob(['photo'])], handlers: {}, textContent: '', addEventListener(name, fn) { this.handlers[name] = fn; }, setAttribute() {}, reportValidity: () => true, querySelector: () => element('select') });
    return elements.get(id);
  };
  vm.runInNewContext(source, { document: { querySelector: element }, URL, FormData: class {}, fetch, setTimeout, TypeError,
    Date: clock.Date ?? Date, setInterval: clock.setInterval ?? (() => 1), clearInterval: clock.clearInterval ?? (() => {}) });
  return element;
}
test('client prevents duplicate submit while waiting and shows generated result', async () => {
  let finish;
  let calls = 0;
  const el = setup((url, options) => { if (!options?.method) return Promise.resolve(allowance()); calls++; return new Promise(resolve => { finish = resolve; }); });
  const event = { preventDefault() {} };
  const pending = el('#drawing-form').handlers.submit(event);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(el('#generate').disabled, true);
  await el('#drawing-form').handlers.submit(event);
  assert.equal(calls, 1);
  finish({ ok: true, status: 200, json: async () => ({ image: 'https://cdn.test/image.png' }) });
  await pending;
  assert.equal(el('#drawing-result').src, 'https://cdn.test/image.png');
  assert.equal(el('#download-result').href, 'https://cdn.test/image.png');
  assert.equal(el('#generate').disabled, false);
});

test('loading feedback measures elapsed time and clears after success and retry failure', async () => {
  let now = 1000;
  let tick;
  let finish;
  let cleared = 0;
  let intervals = 0;
  const el = setup((url, options) => !options?.method ? Promise.resolve(allowance()) : new Promise(resolve => { finish = resolve; }), {
    Date: { now: () => now },
    setInterval(fn) { tick = fn; intervals++; return intervals; },
    clearInterval() { cleared++; },
  });
  el('#generate').textContent = '生成手绘';
  const event = { preventDefault() {} };
  const pending = el('#drawing-form').handlers.submit(event);
  assert.equal(el('#drawing-loading').hidden, false);
  assert.equal(el('#drawing-elapsed').textContent, '已等待 0 秒');
  assert.equal(el('#generate').textContent, '正在生成…');
  now += 65000;
  tick();
  assert.equal(el('#drawing-elapsed').textContent, '已等待 65 秒');
  assert.match(el('#drawing-status').textContent, /仍在生成/);
  await el('#drawing-form').handlers.submit(event);
  assert.equal(intervals, 1);
  await new Promise(resolve => setImmediate(resolve));
  finish({ ok: true, status: 200, json: async () => ({ image: 'https://cdn.test/image.png' }) });
  await pending;
  assert.equal(el('#drawing-loading').hidden, true);
  assert.equal(cleared, 1);
  assert.equal(el('#generate').textContent, '生成手绘');
  const retry = el('#drawing-form').handlers.submit(event);
  assert.equal(el('#drawing-elapsed').textContent, '已等待 0 秒');
  await new Promise(resolve => setImmediate(resolve));
  finish({ ok: false, status: 502, json: async () => ({ error: '生成未完成' }) });
  await retry;
  assert.equal(el('#drawing-loading').hidden, true);
  assert.equal(cleared, 2);
  assert.equal(el('#drawing-status').textContent, '生成未完成');
  assert.equal(el('#generate').disabled, false);
});
test('client exposes login link on 401 and restores controls after error', async () => {
  const el = setup(async (url, options) => !options?.method ? allowance() : ({ ok: false, status: 401, json: async () => ({ error: '请先登录' }) }));
  await el('#drawing-form').handlers.submit({ preventDefault() {} });
  assert.equal(el('#drawing-login').hidden, false);
  assert.equal(el('#drawing-status').textContent, '请先登录');
  assert.equal(el('#drawing-image').disabled, false);
});

test('guest exhaustion shows login without submitting a paid generation', async () => {
  const el = setup(async (url, options) => { assert.notEqual(options?.method, 'POST'); return allowance({ freeRemaining: 0 }); });
  await el('#drawing-form').handlers.submit({ preventDefault() {} });
  assert.equal(el('#drawing-login').hidden, false);
  assert.equal(el('#drawing-purchase').hidden, true);
  assert.match(el('#drawing-allowance').textContent, /登录/);
});

test('account exhaustion shows purchase notice before calling provider', async () => {
  const el = setup(async (url, options) => { assert.notEqual(options?.method, 'POST'); return allowance({ signedIn: true, freeRemaining: 0 }); });
  await el('#drawing-form').handlers.submit({ preventDefault() {} });
  assert.equal(el('#drawing-login').hidden, true);
  assert.equal(el('#drawing-purchase').hidden, false);
  assert.match(el('#drawing-allowance').textContent, /购买/);
});
