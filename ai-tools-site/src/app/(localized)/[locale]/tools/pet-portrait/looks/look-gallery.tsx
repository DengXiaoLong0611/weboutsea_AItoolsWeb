'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { PortraitCategory, PortraitSubjects, Scene } from '@/lib/pet-portrait/catalog';
import './looks.css';

type Look = {
  id: Scene;
  name: string;
  category: PortraitCategory;
  subjects: PortraitSubjects;
  imageAvailable: boolean;
};

const categories = ['all', 'studio', 'cozy', 'outdoors', 'playful'] as const;
type CategoryFilter = (typeof categories)[number];
type SubjectFilter = 'all' | PortraitSubjects;

const labels = {
  zh: {
    all: '全部',
    studio: '影棚',
    cozy: '温馨居家',
    outdoors: '户外',
    playful: '趣味生活',
    personPet: '人宠合照',
    petOnly: '仅宠物',
    previewSoon: '预览图准备中',
    choose: '选这个场景',
    count: (count: number) => `${count} 种风格`,
  },
  en: {
    all: 'All',
    studio: 'Studio',
    cozy: 'Cozy home',
    outdoors: 'Outdoors',
    playful: 'Playful',
    personPet: 'You + pet',
    petOnly: 'Pet only',
    previewSoon: 'Preview coming soon',
    choose: 'Choose this look',
    count: (count: number) => `${count} looks`,
  },
};

export default function LookGallery({ locale, looks }: { locale: 'en' | 'zh'; looks: Look[] }) {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [subjects, setSubjects] = useState<SubjectFilter>('all');
  const copy = labels[locale];
  const filtered = useMemo(() => looks.filter(look =>
    (category === 'all' || look.category === category) &&
    (subjects === 'all' || look.subjects === subjects),
  ), [category, looks, subjects]);

  return (
    <main className="look-gallery" lang={locale}>
      <header className="look-gallery-header">
        <Link href={`/${locale}/tools/pet-portrait`} className="look-gallery-back">
          {locale === 'zh' ? '← 返回合照工作室' : '← Back to studio'}
        </Link>
        <p className="look-gallery-eyebrow">BESIDE &amp; BLOOM · PORTRAIT LOOKS</p>
        <h1>{locale === 'zh' ? '找到你喜欢的那一幕' : 'Find your favorite scene'}</h1>
        <p className="look-gallery-intro">
          {locale === 'zh'
            ? '先浏览场景效果，再选一个开始制作。每次最多生成 3 张预览。'
            : 'Browse the scenes, then choose one to get started. Preview up to 3 portraits.'}
        </p>
      </header>

      <section className="look-gallery-controls" aria-label={locale === 'zh' ? '筛选风格' : 'Filter looks'}>
        <div className="look-gallery-filter-group">
          <span>{locale === 'zh' ? '主角' : 'Subjects'}</span>
          <div className="look-gallery-chips">
            {([
              ['all', copy.all],
              ['person-pet', copy.personPet],
              ['pet-only', copy.petOnly],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={subjects === value}
                onClick={() => setSubjects(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="look-gallery-filter-group">
          <span>{locale === 'zh' ? '场景' : 'Scene'}</span>
          <div className="look-gallery-chips">
            {categories.map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                {copy[value]}
              </button>
            ))}
          </div>
        </div>
        <p className="look-gallery-count" aria-live="polite">{copy.count(filtered.length)}</p>
      </section>

      <div className="look-gallery-grid">
        {filtered.map((look, index) => (
          <Link
            className="look-card"
            href={`/${locale}/tools/pet-portrait/photos?look=${encodeURIComponent(look.id)}`}
            key={look.id}
          >
            <div className="look-card-image">
              {look.imageAvailable
                ? <Image
                    src={`/tools/pet-portrait/scenes/${look.id}.webp`}
                    alt={`${look.name} · ${look.subjects === 'pet-only' ? copy.petOnly : copy.personPet}`}
                    fill
                    preload={index === 0}
                    sizes="(max-width: 540px) 48vw, (max-width: 900px) 32vw, (max-width: 1300px) 24vw, 19vw"
                  />
                : <div className="look-card-placeholder" aria-hidden="true">✦</div>}
              <span className="look-card-subject">
                {look.subjects === 'pet-only' ? copy.petOnly : copy.personPet}
              </span>
            </div>
            <div className="look-card-copy">
              <span className="look-card-category">{copy[look.category]}</span>
              <h2>{look.name}</h2>
              <span className="look-card-action">
                {look.imageAvailable ? copy.choose : copy.previewSoon}
                {look.imageAvailable && <span aria-hidden="true"> ↗</span>}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
