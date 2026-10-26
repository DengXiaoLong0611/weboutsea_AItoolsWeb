import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseLocale } from '../src/lib/i18n.ts';

test('saved supported preference overrides browser language', () => {
  assert.equal(chooseLocale('en', 'zh-CN'), 'en');
  assert.equal(chooseLocale('zh', 'en-US'), 'zh');
});

test('browser language is weighted and unsupported languages fall back to English', () => {
  assert.equal(chooseLocale(undefined, 'zh-CN,zh;q=0.9,en;q=0.8'), 'zh');
  assert.equal(chooseLocale(undefined, 'en-US,en;q=0.9,zh;q=0.8'), 'en');
  assert.equal(chooseLocale(undefined, 'en;q=0.2,zh-TW;q=0.9'), 'zh');
  assert.equal(chooseLocale(undefined, 'fr-FR,zh;q=0.8'), 'en');
  assert.equal(chooseLocale(undefined, 'zh;q=0,en;q=1'), 'en');
  assert.equal(chooseLocale('invalid', undefined), 'en');
  assert.equal(chooseLocale(undefined, ''), 'en');
  assert.equal(chooseLocale(undefined, 'zh;q=invalid,en'), 'en');
});
