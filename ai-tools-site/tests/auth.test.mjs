import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmationDestination, validSiteUrl } from '../src/lib/supabase/policy.ts';
test('confirmation only accepts signup and recovery purposes', () => {
  assert.equal(confirmationDestination('signup'), '/account');
  assert.equal(confirmationDestination('recovery'), '/auth/update-password');
  for (const value of ['invite', 'email_change', '//evil.com', null, '']) assert.equal(confirmationDestination(value), null);
});
test('site origin rejects paths, insecure public hosts and embedded credentials', () => {
  assert.equal(validSiteUrl('https://example.com'), 'https://example.com');
  assert.equal(validSiteUrl('http://localhost:3000'), 'http://localhost:3000');
  for (const value of [undefined, 'http://example.com', 'https://a:b@example.com', 'https://example.com/path', 'https://example.com?x=y']) assert.equal(validSiteUrl(value), null);
});
