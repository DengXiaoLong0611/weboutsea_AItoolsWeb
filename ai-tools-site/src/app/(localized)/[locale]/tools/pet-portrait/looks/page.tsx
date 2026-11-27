import type { Metadata } from 'next';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { sceneIds, scenes, sceneName } from '@/lib/pet-portrait/catalog';
import LookGallery from './look-gallery';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: locale === 'zh' ? '选择合照风格 · Beside & Bloom' : 'Choose a portrait look · Beside & Bloom' };
}

export default async function LooksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const language = locale === 'zh' ? 'zh' : 'en';
  const looks = sceneIds.map(id => ({
    id,
    name: sceneName(id, language),
    category: scenes[id].category,
    subjects: scenes[id].subjects,
    imageAvailable: existsSync(path.join(process.cwd(), 'public', 'tools', 'pet-portrait', 'scenes', `${id}.webp`)),
  }));
  return <LookGallery locale={locale} looks={looks} />;
}
