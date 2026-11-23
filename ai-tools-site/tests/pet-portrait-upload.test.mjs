import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePortraitPhoto, portraitUploadLimits } from '../src/lib/pet-portrait/upload.ts';

test('portrait upload accepts supported image types', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    const file = new File(['photo'], 'photo.img', { type });
    assert.deepEqual(validatePortraitPhoto(file), { ok: true, warning: false });
  }
});

test('portrait upload rejects unsupported or oversized files', () => {
  assert.equal(validatePortraitPhoto(new File(['text'], 'photo.gif', { type: 'image/gif' })).ok, false);
  const oversized = new File([new Uint8Array(portraitUploadLimits.maxBytes + 1)], 'large.jpg', { type: 'image/jpeg' });
  assert.deepEqual(validatePortraitPhoto(oversized), { ok: false, reason: 'size' });
});
