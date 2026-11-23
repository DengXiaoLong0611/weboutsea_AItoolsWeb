export const portraitUploadLimits = {
  maxBytes: 10 * 1024 * 1024,
  recommendedPixels: 512,
} as const;

export type PortraitPhotoValidation =
  | { ok: true; warning: boolean }
  | { ok: false; reason: 'type' | 'size' };

export function validatePortraitPhoto(file: File): PortraitPhotoValidation {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { ok: false, reason: 'type' };
  }
  if (!file.size || file.size > portraitUploadLimits.maxBytes) {
    return { ok: false, reason: 'size' };
  }
  return { ok: true, warning: false };
}
