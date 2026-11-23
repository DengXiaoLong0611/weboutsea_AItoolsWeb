import test from 'node:test';
import assert from 'node:assert/strict';
import { restorePortraitDraft } from '../src/lib/pet-portrait/workflow.ts';

test('a valid direct style link overrides stale saved subjects and filters', () => {
  assert.deepEqual(restorePortraitDraft({ look: 'studio', subjects: 'person-pet', category: 'cozy' }, 'pet-sage'), {
    look: 'pet-sage', subjects: 'pet-only', category: 'all',
  });
});

test('corrupted session data cannot produce an empty incompatible upload mode', () => {
  assert.deepEqual(restorePortraitDraft({ look: 'pet-sage', subjects: 'person-pet', category: 'cozy' }), {
    look: 'pet-sage', subjects: 'pet-only', category: 'all',
  });
  assert.deepEqual(restorePortraitDraft({ look: 'unknown', subjects: 'broken', category: '__proto__' }), {
    look: 'studio', subjects: 'person-pet', category: 'all',
  });
  assert.equal(restorePortraitDraft(null).look, 'studio');
});
