export const scenes = {
  studio: { en: "Studio embrace", zh: "影棚拥抱", setting: "a softly lit sage-green portrait studio, close-up, the person gently holding or leaning cheek-to-cheek with the pet" },
  coast: { en: "Golden coast", zh: "金色海岸", setting: "quiet coastal dunes in warm late-afternoon light, the person sitting beside the pet, both visible" },
  home: { en: "Slow morning", zh: "慵懒清晨", setting: "a cozy living room with soft window light, the person and pet sitting together on a linen sofa" },
} as const;

export type Scene = keyof typeof scenes;
export const sceneIds = Object.keys(scenes) as Scene[];
export function isScene(value: unknown): value is Scene {
  return typeof value === "string" && Object.hasOwn(scenes, value);
}

export function priceInCents(count: number) {
  return [0, 1300, 2000, 2300][count] ?? 0;
}

export function portraitPrompt(scene: Scene) {
  return `Create one photorealistic vertical editorial portrait in ${scenes[scene].setting}. Reference image 1 is the identity reference for the human; image 2 is the identity reference for their pet. Preserve the human's face shape, eyes, nose, skin tone, hair and apparent age. Preserve the pet's exact species, size, coat color, markings, ears and muzzle. Repose them naturally in one coherent photograph, with shared light and perspective, believable contact, anatomically plausible hands and visible faces. Use the references for likeness, not pose or background. Single continuous frame, realistic texture. No collage, partitions, pasted cutouts, text, borders or logos.`;
}
