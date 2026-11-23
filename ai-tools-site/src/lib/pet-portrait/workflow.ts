import { isScene, scenes, type Scene, type PortraitCategory, type PortraitSubjects } from './catalog.ts';

export function restorePortraitDraft(saved: unknown, requested?: string | null): {
  look: Scene; subjects: PortraitSubjects; category: PortraitCategory | 'all';
} {
  const value = saved && typeof saved === 'object' ? saved as Record<string, unknown> : {};
  const direct = isScene(requested);
  const look = direct ? requested : isScene(value.look) ? value.look : 'studio';
  const category = !direct && value.category === scenes[look].category ? scenes[look].category : 'all';
  return { look, subjects: scenes[look].subjects, category };
}
