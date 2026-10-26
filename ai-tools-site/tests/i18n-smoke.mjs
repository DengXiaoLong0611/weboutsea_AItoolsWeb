import assert from 'node:assert/strict';

const origin = process.env.I18N_TEST_URL;
if (!origin) throw new Error('Set I18N_TEST_URL to the local production server');

for (const [headers, expected] of [
  [{}, 'en'],
  [{ 'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8' }, 'zh'],
  [{ 'accept-language': 'en-US,en;q=0.9,zh;q=0.8' }, 'en'],
  [{ 'accept-language': 'zh-CN', cookie: 'site_locale=en' }, 'en'],
  [{ 'accept-language': 'en', cookie: 'site_locale=zh' }, 'zh'],
  [{ 'accept-language': 'fr-FR' }, 'en'],
]) {
  const response = await fetch(`${origin}/?mode=minimal&ref=test`, { headers, redirect: 'manual' });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location'), origin).pathname, `/${expected}`);
  assert.equal(new URL(response.headers.get('location'), origin).search, '?mode=minimal&ref=test');
  assert.match(response.headers.get('cache-control'), /no-store/);
}

for (const [locale, lang] of [['en', 'en'], ['zh', 'zh-CN']]) {
  for (const suffix of ['', '?mode=minimal']) {
    const response = await fetch(`${origin}/${locale}${suffix}`, {
      headers: { cookie: `site_locale=${locale === 'en' ? 'zh' : 'en'}`, 'accept-language': locale === 'en' ? 'zh' : 'en' },
      redirect: 'manual',
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`<html[^>]*lang="${lang}"`));
    assert.match(html, /hrefLang="en"|hreflang="en"/);
    assert.match(html, /hrefLang="zh-CN"|hreflang="zh-CN"/);
    assert.ok(html.includes(`href="/en${suffix}"`));
    assert.ok(html.includes(`href="/zh${suffix}"`));
    if (suffix) assert.ok(html.includes(locale === 'en' ? 'Find a tool. Make something.' : '发现工具，直接开始。'));
    console.log(`/${locale}${suffix}: content, HTML language and language links verified`);
  }
}
assert.equal((await fetch(`${origin}/fr`)).status, 404);
for (const path of ['/tools/pet-photo', '/tools/hand-drawn-photo/']) {
  assert.equal((await fetch(origin + path)).status, 200);
}
console.log('Language negotiation, query retention, URL priority, invalid locale and existing tool URLs verified');
