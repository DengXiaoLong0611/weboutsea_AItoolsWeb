import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { sceneIds, scenes, sceneName } from '@/lib/pet-portrait/catalog';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return { title: locale === 'zh' ? '选择合照风格 · Beside & Bloom' : 'Choose a portrait look · Beside & Bloom' };
}

export default async function LooksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const zh = locale === 'zh';
  return <main style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
    <Link href={`/${locale}/tools/pet-portrait`}>{zh ? '返回合照工作室' : 'Back to portrait studio'}</Link>
    <h1>{zh ? '选择合照风格' : 'Choose a portrait look'}</h1>
    <p>{zh ? '先选择场景，再上传人物或宠物照片。最多预览三张。' : 'Choose a scene, then upload the person or pet photos. Preview up to three portraits.'}</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem' }}>
      {sceneIds.map(scene => <article key={scene} style={{ border: '1px solid #cbd9d1', borderRadius: 12, padding: '1rem', background: 'white' }}>
        <small>{scenes[scene].category}</small>
        <h2 style={{ fontSize: '1.25rem' }}>{sceneName(scene, zh ? 'zh' : 'en')}</h2>
        <p>{zh ? (scenes[scene].subjects === 'pet-only' ? '仅宠物' : '人物与宠物') : scenes[scene].subjects}</p>
        <Link href={`/${locale}/tools/pet-portrait/photos?look=${encodeURIComponent(scene)}`}>
          {zh ? '选择并上传照片' : 'Choose and upload'}
        </Link>
      </article>)}
    </div>
  </main>;
}
