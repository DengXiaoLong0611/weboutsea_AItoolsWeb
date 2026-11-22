import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PetPortrait from '@/components/pet-portrait';
import { isLocale } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return {
    title: locale === 'zh' ? 'AI 宠物合照 · Beside & Bloom' : 'AI Pet Portraits · Beside & Bloom',
    description: locale === 'zh' ? '上传本人和宠物的独立照片，免登录试看 AI 合照。' : 'Create a shared portrait from two separate photos. Preview your AI pet portraits before buying.',
    alternates: { canonical: `/${locale}/tools/pet-portrait`, languages: { en: '/en/tools/pet-portrait', 'zh-CN': '/zh/tools/pet-portrait', es: '/en/tools/pet-portrait?lang=es', fr: '/en/tools/pet-portrait?lang=fr' } },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <PetPortrait locale={locale} />;
}
