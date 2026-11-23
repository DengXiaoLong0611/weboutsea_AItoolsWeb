import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { scenes, sceneIds, isScene, referenceRoles, portraitPrompt, previewQueue, sceneName } from '../src/lib/pet-portrait/catalog.ts';

test('115 unique editable styles retain legacy IDs and emphasize shared portraits', () => {
  assert.equal(sceneIds.length, 115);
  assert.equal(new Set(sceneIds).size, 115);
  assert.equal(sceneIds.filter(id => scenes[id].subjects === 'person-pet').length, 90);
  assert.equal(sceneIds.filter(id => scenes[id].subjects === 'pet-only').length, 25);
  for (const id of ['studio', 'coast', 'home']) assert.ok(isScene(id));
  assert.equal(isScene('__proto__'), false);
  assert.equal(isScene('invented-style'), false);
  for (const id of sceneIds) {
    assert.ok(readFileSync(new URL(`../src/lib/pet-portrait/styles/${id}.ts`, import.meta.url), 'utf8'));
    assert.equal(scenes[id].status, 'draft');
    assert.ok(sceneName(id, 'zh'));
    assert.ok(sceneName(id, 'fr'));
  }
  assert.equal(new Set(sceneIds.map(portraitPrompt)).size, 115);
});

test('pet-only prompts use one reference and exclude human subjects', () => {
  for (const id of sceneIds) {
    const prompt = portraitPrompt(id);
    if (scenes[id].subjects === 'pet-only') {
      assert.deepEqual(referenceRoles(id), ['pet']);
      assert.match(prompt, /exactly one pet alone/);
      assert.doesNotMatch(prompt, /image 2|exactly one person/);
    } else {
      assert.deepEqual(referenceRoles(id), ['person', 'pet']);
      assert.match(prompt, /image 2/);
      assert.match(prompt, /exactly one person and one pet/);
    }
  }
});

test('catalog expansion never queues 115 paid provider calls or mixes subject modes', () => {
  for (const first of sceneIds) {
    const empty = previewQueue(first, []);
    assert.equal(empty[0], first);
    assert.equal(empty.length, 3);
    assert.ok(empty.every(id => scenes[id].subjects === scenes[first].subjects));
    assert.equal(previewQueue(first, ['studio', 'coast']).length, 1);
    assert.deepEqual(previewQueue(first, ['studio', 'coast', 'home']), []);
    assert.ok(!previewQueue(first, [first]).includes(first));
  }
});

test('SQL migration allowlist matches the application catalog and enforces visitor cap', () => {
  const folder = new URL('../supabase/migrations/', import.meta.url);
  const file = readdirSync(folder).find(name => name.endsWith('_expand_pet_portrait_catalog.sql'));
  const sql = readFileSync(new URL(file, folder), 'utf8');
  const constraints = [...sql.matchAll(/check \(scene in \((.*?)\)\)/gs)];
  assert.equal(constraints.length, 3);
  for (const constraint of constraints) {
    const allowed = [...constraint[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
    assert.deepEqual(allowed.sort(), [...sceneIds].sort());
  }
  assert.match(sql, /where visitor = p_visitor\) >= 3/);
  assert.match(sql, /pg_advisory_xact_lock/);
});
