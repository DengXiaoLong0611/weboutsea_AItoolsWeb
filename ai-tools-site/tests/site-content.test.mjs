import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentByLocale } from '../src/data/site-content.ts';

for (const [locale, content] of Object.entries(contentByLocale)) {
  test(`${locale} tool directory provides unique identities for rendered cards`, () => {
    const ids = content.tools.map((tool) => tool.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    assert.deepEqual(duplicates, [], `Duplicate tool identities in ${locale}`);
  });
}
