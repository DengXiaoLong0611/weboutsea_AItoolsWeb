import { styleDefinitions } from './styles/index.ts';

export type PortraitStyle = (typeof styleDefinitions)[number];
export type Scene = PortraitStyle['id'];
export type PortraitCategory = PortraitStyle['category'];
export type PortraitSubjects = PortraitStyle['subjects'];
export const scenes = Object.fromEntries(styleDefinitions.map(style => [style.id, style])) as Record<Scene, PortraitStyle>;
export const sceneIds = styleDefinitions.map(style => style.id);
export const previewLimit = 3;
export function isScene(value: unknown): value is Scene {
  return typeof value === 'string' && Object.hasOwn(scenes, value);
}
export function referenceRoles(scene: Scene): ('person' | 'pet')[] {
  return scenes[scene].subjects === 'pet-only' ? ['pet'] : ['person', 'pet'];
}
export function previewQueue(first: Scene, existing: readonly Scene[]) {
  return [first, ...sceneIds.filter(id => id !== first && scenes[id].subjects === scenes[first].subjects)]
    .filter(id => !existing.includes(id)).slice(0, Math.max(0, previewLimit - existing.length));
}
export function sceneName(scene: Scene, language: string) {
  // Keep the original three translations; new entries currently have English and Chinese names.
  const legacy = { studio: { es: 'Abrazo en estudio', fr: 'Câlin en studio' }, coast: { es: 'Costa dorada', fr: 'Côte dorée' }, home: { es: 'Mañana tranquila', fr: 'Matin paisible' } };
  if ((language === 'es' || language === 'fr') && scene in legacy) return legacy[scene as keyof typeof legacy][language];
  return language === 'zh' ? scenes[scene].zh : scenes[scene].en;
}
export function priceInCents(count: number) {
  return [0, 1300, 2000, 2300][count] ?? 0;
}
export function portraitPrompt(scene: Scene) {
  const style = scenes[scene];
  const identity = style.subjects === 'pet-only'
    ? "Reference image 1 is the identity reference for the pet. Show exactly one pet alone. No people, human faces, hands or other human body parts."
    : "Reference image 1 is the identity reference for the human; image 2 is the identity reference for their pet. Show exactly one person and one pet. Preserve the human's face shape, eyes, nose, skin tone, hair and apparent age. Keep both faces visible. Use anatomically plausible hands and believable contact.";
  return `Create one photorealistic vertical editorial portrait, aspect ratio ${style.aspectRatio}, in ${style.setting}. ${identity} Preserve the pet's exact species, size, coat color, markings, ears and muzzle or beak. Adapt the pose to the referenced animal's anatomy and size; never change its species or force a large animal into a small-animal pose. Keep the animal comfortable, supported and away from hazards. Repose subjects naturally in one coherent photograph with shared light and perspective. Use references for likeness, not pose or background. Single continuous frame with realistic texture. No extra subjects, duplicate limbs, collage, partitions, pasted cutouts, text, borders or logos.`;
}
