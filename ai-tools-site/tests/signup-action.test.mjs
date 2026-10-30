import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function action(signupResult) {
  const redirects = [];
  const source = ts.transpileModule(readFileSync(new URL('../src/app/auth/actions.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, process: { env: {} }, require(name) {
    if (name === 'next/navigation') return { redirect(path) { redirects.push(path); throw new Error('NEXT_REDIRECT'); }, unstable_rethrow(error) { if (error.message === 'NEXT_REDIRECT') throw error; } };
    if (name === '@/lib/supabase/server') return { supabaseServer: async () => ({ auth: { signUp: async () => signupResult, resetPasswordForEmail: async () => ({ error: null }) } }) };
    if (name === '@/lib/supabase/policy') return { validSiteUrl: () => 'http://localhost:3000' };
    throw new Error('Unexpected import: ' + name);
  } };
  vm.runInNewContext(source, context);
  const form = new FormData();
  form.set('email', 'test@example.com'); form.set('password', 'abcdef'); form.set('confirmPassword', 'abcdef');
  return { run: (mode = 'signup') => context.exports.authenticate(mode, {}, form), redirects };
}
test('signup with a session redirects immediately to the account', async () => {
  const subject = action({ error: null, data: { session: { access_token: 'test-session' } } });
  await assert.rejects(subject.run(), /NEXT_REDIRECT/);
  assert.deepEqual(subject.redirects, ['/account']);
});
test('signup without a session does not claim the user is logged in', async () => {
  const subject = action({ error: null, data: { session: null } });
  const result = await subject.run();
  assert.match(result.message, /验证邮件/);
  assert.equal(result.error, undefined);
  assert.deepEqual(subject.redirects, []);
});
test('signup errors do not redirect or claim success', async () => {
  const subject = action({ error: { code: 'user_already_exists' }, data: { session: null } });
  assert.ok((await subject.run()).error);
  assert.deepEqual(subject.redirects, []);
});
test('password recovery still sends reset email', async () => {
  const subject = action({});
  assert.match((await subject.run('forgot-password')).message, /密码重置邮件/);
  assert.deepEqual(subject.redirects, []);
});
