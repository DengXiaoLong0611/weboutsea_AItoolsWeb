import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve('langgraph-lightning/site');
const map = JSON.parse(fs.readFileSync(path.join(root, 'translation-map.json'), 'utf8'));
test('every translated lesson resolves in both languages without duplicate targets', () => {
  assert.equal(new Set(Object.values(map)).size, Object.keys(map).length);
  for (const [en, zh] of Object.entries(map)) {
    for (const route of [en, zh]) assert.ok(fs.existsSync(path.join(root, `${route.slice(1)}.md`)), route);
  }
});
test('Modules 5 and 6 cover every source notebook with bilingual teaching and original code', () => {
  for (const moduleNumber of [5, 6]) {
    const upstream = path.resolve(`langgraph-lightning/upstream/module-${moduleNumber}`);
    const pages = Object.entries(map).filter(([en]) => en.startsWith(`/module-${moduleNumber}/`));
    const notebooks = fs.readdirSync(upstream).filter(file => file.endsWith('.ipynb'));
    assert.equal(pages.length, notebooks.length);
    for (const notebook of notebooks) {
      const matches = pages.filter(([en]) => fs.readFileSync(path.join(root, `${en.slice(1)}.md`), 'utf8').includes(`/${notebook})`));
      assert.equal(matches.length, 1, notebook);
      const cells = JSON.parse(fs.readFileSync(path.join(upstream, notebook), 'utf8')).cells
        .filter(cell => cell.cell_type === 'code').map(cell => cell.source.join('').trim()).filter(Boolean);
      for (const route of matches[0]) {
        const lesson = fs.readFileSync(path.join(root, `${route.slice(1)}.md`), 'utf8');
        const normalize = value => value.split('\n').map(line => line.trimEnd()).join('\n');
        for (const code of cells) assert.ok(normalize(lesson).includes(normalize(code)), `${route}: missing source cell`);
        assert.ok(!lesson.includes('attachment:'), `${route}: unresolved notebook attachment`);
        assert.ok(lesson.includes('## Practice and checks') || lesson.includes('## 练习与检查'));
      }
    }
  }
});
