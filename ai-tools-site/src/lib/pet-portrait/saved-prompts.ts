export const savedPortraitPrompts = [
  {
    id: "person",
    title: "制作单独的人像示例",
    prompt: "Create a NEW realistic square photo of the adult woman from the reference, alone. Remove the dog entirely. Woman facing camera, head and shoulders centered in frame, small smile, same dark hair in a bun, hoop earrings and cream cable knit sweater. Natural window light against a soft warm cream wall, casual solo photo. One person only, no animal, no lettering.",
  },
  {
    id: "pet",
    title: "制作单独的宠物示例",
    prompt: "Create a NEW realistic square photograph of the same golden retriever from the reference, alone, sitting outdoors against a softly blurred green garden. Center the dog, head and chest fully visible, facing camera, same warm caramel fur, floppy ears and happy expression. One dog only, no people or human body parts, no lettering.",
  },
  {
    id: "studio",
    title: "用两张独立照片生成影棚合照",
    prompt: "Create one photorealistic vertical editorial portrait in a softly lit sage-green portrait studio, close-up, the person gently holding or leaning cheek-to-cheek with the pet. Reference image 1 is the identity reference for the human; image 2 is the identity reference for their pet. Preserve the human's face shape, eyes, nose, skin tone, hair and apparent age. Preserve the pet's exact species, size, coat color, markings, ears and muzzle. Repose them naturally in one coherent photograph, with shared light and perspective, believable contact, anatomically plausible hands and visible faces. Use the references for likeness, not pose or background. Single continuous frame, realistic texture. No collage, partitions, pasted cutouts, text, borders or logos.",
  },
] as const;
