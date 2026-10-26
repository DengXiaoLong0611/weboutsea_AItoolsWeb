import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { getBailianConfig, editPetPhoto } from '../src/lib/pet-photo/bailian.ts';

const env = { DASHSCOPE_API_KEY: 'test-secret', DASHSCOPE_BASE_URL: 'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1' };
const input = { images: ['data:image/png;base64,aGVsbG8='], prompt: '保留毛色，改为蜡笔手绘' };

test('missing configuration and non-Alibaba hosts are rejected before transmission', () => {
  assert.throws(() => getBailianConfig({}), /DASHSCOPE_API_KEY/);
  assert.throws(() => getBailianConfig({ DASHSCOPE_API_KEY: 'x' }), /DASHSCOPE_BASE_URL/);
  for (const url of ['http://dashscope.aliyuncs.com/api/v1', 'https://evil.com/api/v1', 'https://a:b@dashscope.aliyuncs.com/api/v1', 'https://dashscope.aliyuncs.com/api/v1?key=x']) {
    assert.throws(() => getBailianConfig({ ...env, DASHSCOPE_BASE_URL: url }));
  }
});

test('edits transmit original and reference in order and return generated image URLs', async () => {
  const images = [...input.images, 'https://example.com/style.png'];
  const result = await editPetPhoto({ ...input, images }, getBailianConfig(env), async (url, options) => {
    assert.equal(url, 'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'qwen-image-2.1-pro');
    assert.deepEqual(body.input.messages[0].content, [{ image: images[0] }, { image: images[1] }, { text: input.prompt }]);
    assert.equal(body.parameters.n, 1);
    assert.equal(body.parameters.prompt_extend, false);
    return Response.json({ request_id: 'request-1', output: { choices: [{ message: { content: [{ image: 'https://result.aliyuncs.com/a.png' }] } }] }, usage: { image_count: 1 } });
  });
  assert.deepEqual(result.images, ['https://result.aliyuncs.com/a.png']);
  assert.equal(result.requestId, 'request-1');
});

test('quota errors stop without retries or including upstream secrets', async () => {
  let calls = 0;
  await assert.rejects(editPetPhoto(input, getBailianConfig(env), async () => {
    calls++;
    return Response.json({ code: 'InsufficientBalance', message: 'test-secret' }, { status: 429 });
  }), (error) => /余额|额度/.test(error.message) && !error.message.includes('test-secret'));
  assert.equal(calls, 1);
});

test('business errors, invalid JSON and empty outputs do not masquerade as success', async () => {
  for (const response of [Response.json({ code: 'InvalidApiKey', message: 'test-secret' }), new Response('<html>gateway failed</html>', { status: 502 }), Response.json({ output: { choices: [] } })]) {
    await assert.rejects(editPetPhoto(input, getBailianConfig(env), async () => response));
  }
});

test('invalid image input and empty prompts fail locally', async () => {
  const neverFetch = async () => { assert.fail('must not send a request'); };
  for (const value of [{ images: [], prompt: 'draw' }, { images: ['file:///private.png'], prompt: 'draw' }, { images: input.images, prompt: ' ' }]) {
    await assert.rejects(editPetPhoto(value, getBailianConfig(env), neverFetch));
  }
});

test('timeouts surface clearly without exposing request data', async () => {
  await assert.rejects(editPetPhoto(input, getBailianConfig(env), async () => {
    throw new DOMException('request test-secret timed out', 'TimeoutError');
  }), /超时/);
});

test('local command previews three jobs without needing credentials or sending requests', () => {
  const output = execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/test-pet-photo.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DASHSCOPE_API_KEY: '', DASHSCOPE_BASE_URL: '' },
    encoding: 'utf8',
  });
  assert.match(output, /仅预览/);
  assert.match(output, /蜡笔原景/);
  assert.match(output, /细腻彩铅/);
  assert.match(output, /蜡笔留白/);
  assert.doesNotMatch(output, /data:image\/|Bearer /);
});
