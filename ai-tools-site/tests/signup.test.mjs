import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { validSiteUrl } from '../src/lib/supabase/policy.ts';

// Run the actual server action, replacing only navigation and the external auth SDK.
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('../src/app/auth/actions.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function loadAction(auth) {
  const exports = {};
  const redirect = destination => { const error = new Error('Redirect'); error.destination = destination; throw error; };
  vm.runInNewContext(source, {
    exports, process: { env: { NEXT_PUBLIC_SITE_URL: 'http://localhost:3100' } },
    require: id => {
      if (id === 'next/navigation') return { redirect, unstable_rethrow: error => { if (error.destination) throw error; } };
      if (id === '@/lib/supabase/server') return { supabaseServer: async () => ({ auth }) };
      if (id === '@/lib/supabase/policy') return { validSiteUrl };
      throw new Error(`Unexpected dependency ${id}`);
    },
  });
  return exports.authenticate;
}
function signupForm() {
  const form = new FormData();
  form.set('email', 'test@example.com');
  form.set('password', 'test-password-123');
  form.set('confirmPassword', 'test-password-123');
  return form;
}
test('auto-confirm signup redirects immediately when Supabase returns a session', async () => {
  const authenticate = loadAction({ signUp: async () => ({ data: { session: { access_token: 'test-session' } }, error: null }) });
  await assert.rejects(authenticate('signup', {}, signupForm()), error => error.destination === '/account');
});

test('signup and login return to the drawing studio but reject external return URLs', async () => {
  const authenticate = loadAction({
    signUp: async () => ({ data: { session: {} }, error: null }),
    signInWithPassword: async () => ({ error: null }),
  });
  for (const mode of ['signup', 'login']) {
    const form = signupForm();
    form.set('next', '/tools/hand-drawn-photo/');
    await assert.rejects(authenticate(mode, {}, form), error => error.destination === '/tools/hand-drawn-photo/');
    form.set('next', '//evil.test');
    await assert.rejects(authenticate(mode, {}, form), error => error.destination === '/account');
  }
});
test('signup requiring email confirmation still shows the verification instruction', async () => {
  const authenticate = loadAction({ signUp: async () => ({ data: { session: null }, error: null }) });
  const result = await authenticate('signup', {}, signupForm());
  assert.match(result.message, /验证邮件/);
});
test('failed signup does not redirect or claim a verification email was sent', async () => {
  const authenticate = loadAction({ signUp: async () => ({ data: { session: null }, error: { code: 'user_already_exists' } }) });
  const result = await authenticate('signup', {}, signupForm());
  assert.ok(result.error);
  assert.equal(result.message, undefined);
});
test('password reset remains an email flow when signup auto-confirm is supported', async () => {
  const authenticate = loadAction({ resetPasswordForEmail: async () => ({ data: {}, error: null }) });
  const result = await authenticate('forgot-password', {}, signupForm());
  assert.match(result.message, /密码重置邮件/);
});

test('signup accepts six characters and rejects five before Supabase call', async () => {
  let calls = 0;
  const authenticate = loadAction({ signUp: async () => { calls++; return { data: { session: null }, error: null }; } });
  const form = signupForm();
  form.set('password', 'abc123'); form.set('confirmPassword', 'abc123');
  assert.ok((await authenticate('signup', {}, form)).message);
  form.set('password', 'abc12'); form.set('confirmPassword', 'abc12');
  assert.match((await authenticate('signup', {}, form)).error, /6/);
  assert.equal(calls, 1);
});

test('signup explains email delivery rate limits without leaking raw errors', async () => {
  const authenticate = loadAction({ signUp: async () => ({ error: { code: 'over_email_send_rate_limit', message: 'private' } }) });
  const result = await authenticate('signup', {}, signupForm());
  assert.match(result.error, /邮件.*频繁/);
  assert.doesNotMatch(result.error, /private/);
});
