import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PetPortrait from '@/components/pet-portrait';
import { isLocale } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: locale === 'zh' ? '上传合照照片 · Beside & Bloom' : 'Upload portrait photos · Beside & Bloom' };
}

export default async function PhotosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PetPortrait locale={locale} mode="photos" />;
}
