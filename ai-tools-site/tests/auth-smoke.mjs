// Run against a production build: AUTH_TEST_URL=http://localhost:3102 npm run test:smoke
import assert from 'node:assert/strict';
const origin = process.env.AUTH_TEST_URL;
if (!origin) throw new Error('Set AUTH_TEST_URL to your local production server');
for (const path of ['/auth/login', '/auth/signup', '/auth/forgot-password']) {
  const response = await fetch(origin + path);
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert.ok(html.includes('账户服务暂未开放') || html.includes('name="email"'), path);
  assert.ok(!html.includes('name="password" value='), 'Passwords must not be reflected in HTML');
  console.log(`${path}: rendered`);
}
for (const path of ['/account', '/auth/update-password', '/auth/confirm?type=recovery&next=https://evil.example']) {
  const response = await fetch(origin + path, { redirect: 'manual' });
  const html = await response.text();
  const location = response.headers.get('location');
  // Next.js streams redirects made below Suspense as meta refreshes.
  assert.ok(location?.includes('/auth/') || html.includes('http-equiv="refresh"'), path);
  assert.ok(!location?.includes('evil.example'));
  assert.ok(!html.includes('登录邮箱'));
  console.log(`${path.split('?')[0]}: unauthenticated access denied`);
}
assert.equal((await fetch(origin + '/auth/unknown')).status, 404);
console.log('Unknown authentication route: 404');
