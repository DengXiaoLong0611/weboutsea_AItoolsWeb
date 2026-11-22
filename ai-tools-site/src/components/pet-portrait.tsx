'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { copy, type PortraitLanguage } from '@/lib/pet-portrait/copy';
import { priceInCents, sceneIds, type Scene } from '@/lib/pet-portrait/catalog';
import './pet-portrait.css';

const api = '/api/pet-portrait';
const languages = { en: 'English', zh: '简体中文', es: 'Español', fr: 'Français' };
function subscribeToNavigation(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}
function getExtraLanguage() {
  const lang = new URLSearchParams(window.location.search).get('lang');
  return lang === 'es' || lang === 'fr' ? lang : null;
}
function serverExtraLanguage() { return null; }
const imageUrl = (action: string, scene: Scene) => `${api}?action=${action}&scene=${scene}`;
type Gallery = { scenes: Scene[]; paid: Scene[]; checkout: boolean; printEmail: string | null };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'unavailable');
  return body;
}

async function preparePhoto(file: File) {
  if (!file.size || file.size > 20_000_000 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('files');
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('files'); });
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('files');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
      if (blob && blob.size <= 1_800_000) resolve(blob);
      else reject(new Error('files'));
    }, 'image/jpeg', .88));
  } finally { bitmap.close(); }
}

export default function PetPortrait({ locale }: { locale: 'en' | 'zh' }) {
  const language = useSyncExternalStore(subscribeToNavigation, getExtraLanguage, serverExtraLanguage) || locale;
  const [gallery, setGallery] = useState<Gallery>();
  const [selected, setSelected] = useState<Scene[]>([]);
  const [first, setFirst] = useState<Scene>('studio');
  const [started, setStarted] = useState<number>();
  const [elapsed, setElapsed] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ scene: Scene; print: boolean }>();
  const [printReady, setPrintReady] = useState(false);
  const [dedication, setDedication] = useState('');
  const [product, setProduct] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const t = copy[language];
  const name = (scene: Scene) => t.names[sceneIds.indexOf(scene)];
  const money = (amount: number) => new Intl.NumberFormat(language, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(amount / 100);
  const amount = priceInCents(selected.length);
  const readyToBundle = gallery?.scenes.length === 3 && gallery.paid.length === 0;
  const physicalProducts = t.products;
  const canPick = (scene: Scene) => !gallery?.paid.includes(scene);

  useEffect(() => {
    let alive = true;
    const url = new URL(window.location.href);
    const session = url.searchParams.get('checkout');
    request<Gallery>(api + (session ? '?checkout=' + encodeURIComponent(session) : '')).then(value => {
      if (!alive) return;
      setGallery(value);
      setSelected(value.scenes.filter(scene => !value.paid.includes(scene)).slice(0, 1));
      if (session && value.paid.length) {
        url.searchParams.delete('checkout');
        window.history.replaceState(null, '', url);
      }
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (started === undefined) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [started]);

  useEffect(() => {
    if (modal && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [modal]);

  function changeLanguage(value: PortraitLanguage) {
    if (value === 'en' || value === 'zh') {
      if (value !== locale || window.location.search) {
        const url = new URL(window.location.href);
        url.pathname = `/${value}/tools/pet-portrait`;
        url.searchParams.delete('lang');
        window.location.assign(url);
      }
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', value);
      window.history.replaceState(null, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gallery || started !== undefined) return;
    const form = new FormData(event.currentTarget);
    setError('');
    setElapsed(0);
    setStarted(Date.now());
    try {
      const personFile = form.get('person');
      const petFile = form.get('pet');
      if (!(personFile instanceof File) || !(petFile instanceof File)) throw new Error('files');
      const [person, pet] = await Promise.all([preparePhoto(personFile), preparePhoto(petFile)]);
      const queue = [first, ...sceneIds.filter(scene => scene !== first)].filter(scene => !gallery.scenes.includes(scene));
      for (const scene of queue) {
        const payload = new FormData();
        payload.append('person', person, 'person.jpg');
        payload.append('pet', pet, 'pet.jpg');
        payload.append('scene', scene);
        await request(api, { method: 'POST', body: payload, signal: AbortSignal.timeout(245_000) });
        setGallery(current => current && { ...current, scenes: [...current.scenes, scene] });
        if (scene === first && !gallery.paid.includes(scene)) setSelected([scene]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'generation');
      // Recover completed previews if the client timed out after storage succeeded.
      try { setGallery(await request<Gallery>(api)); } catch { /* Keep the previews already displayed. */ }
    } finally { setStarted(undefined); }
  }

  async function pay(scenes: Scene[]) {
    if (checkoutBusy || !scenes.length) return;
    setCheckoutBusy(true);
    setError('');
    try {
      const { url } = await request<{ url: string }>(api + '?action=checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenes, locale, lang: language }),
      });
      window.location.assign(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'paymentUnavailable');
      setCheckoutBusy(false);
    }
  }

  function toggle(scene: Scene) {
    if (canPick(scene)) setSelected(value => value.includes(scene) ? value.filter(id => id !== scene) : [...value, scene]);
  }
  function open(scene: Scene, print = false) {
    setPrintReady(false);
    setModal({ scene, print });
  }

  const processing = started !== undefined;
  const message = Object.hasOwn(t, error) ? t[error as keyof typeof t] : processing ? '' : t.generation;

  return <main className="portrait-tool" lang={language}>
    <header className="portrait-nav">
      <Link href={`/${locale}`}>{t.back}</Link>
      <span>Beside &amp; Bloom</span>
      <select aria-label="Language" value={language} onChange={event => changeLanguage(event.target.value as PortraitLanguage)}>
        {Object.entries(languages).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
    </header>
    <section className="portrait-hero">
      <div><h1>{t.title}</h1><p>{t.description}</p><a className="portrait-button" href="#studio">{t.start}</a><small>{t.free}</small></div>
      <figure><Image src="/tools/pet-portrait/example.webp" alt={t.sample} width={1536} height={1024} priority /><figcaption>{t.sample}</figcaption></figure>
    </section>
    <section className="portrait-how"><h2>{t.how}</h2><ol>{t.steps.map(step => <li key={step}>{step}</li>)}</ol></section>
    <section className="portrait-studio" id="studio">
      {(!gallery || gallery.scenes.length < 3) && <form onSubmit={generate}>
        <h2>{t.form}</h2>
        <fieldset disabled={processing || !gallery}>
          <div className="portrait-inputs">
            <label>{t.person}<input type="file" name="person" accept="image/jpeg,image/png,image/webp" required /></label>
            <label>{t.pet}<input type="file" name="pet" accept="image/jpeg,image/png,image/webp" required /></label>
            <label>{t.look}<select value={first} onChange={event => setFirst(event.target.value as Scene)}>
              {sceneIds.map(scene => <option key={scene} value={scene}>{name(scene)}</option>)}
            </select></label>
          </div>
          <p>{t.consent}</p><button className="portrait-button">{t.start}</button>
        </fieldset>
      </form>}
      {processing && <div className="portrait-progress"><span role="status">{t.waiting} · {gallery?.scenes.length ?? 0}/3</span>
        <progress aria-label={t.waiting} /><span aria-hidden="true">{elapsed}s</span>{elapsed >= 45 && <p>{t.long}</p>}
      </div>}
      {error && <p role="alert" className="portrait-error">{message}</p>}
      {!!gallery?.scenes.length && <div className="portrait-results">
        <h2>{t.gallery}</h2>
        <div className="portrait-grid">
          {gallery.scenes.map(scene => <article key={scene}>
            <button type="button" className="portrait-image" onClick={() => open(scene)} aria-label={`${t.preview}: ${name(scene)}`}>
              {/* The preview is retrieved by this browser with its private session cookie. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl('preview', scene)} alt={name(scene)} />
            </button>
            <strong>{name(scene)}</strong>
            {canPick(scene) ? <label><input type="checkbox" checked={selected.includes(scene)} onChange={() => toggle(scene)} /> {t.keep}</label>
              : <><span>{t.paid}</span><a href={imageUrl('download', scene)}>{t.download}</a><button type="button" onClick={() => open(scene, true)}>{t.print}</button></>}
          </article>)}
        </div>
        {gallery.scenes.some(canPick) && <div className="portrait-order">
          <div><h3>{t.choose}</h3><p>{t.quality}</p></div>
          {gallery.checkout ? <div className="portrait-order-buttons">
            <button className="portrait-button" type="button" disabled={!amount || checkoutBusy || processing} onClick={() => pay(selected)}>{t.buy}{amount ? ` · ${money(amount)}` : ''}</button>
            {readyToBundle && selected.length !== 3 && <button className="portrait-button secondary" type="button" disabled={checkoutBusy || processing} onClick={() => pay(sceneIds)}>
              {t.bundle} · {money(2300)}{selected.length === 2 ? ` (${money(300)} ${t.more})` : ''}
            </button>}
          </div> : <span>{t.noCheckout}</span>}
        </div>}
      </div>}
    </section>
    <section className="portrait-keepsakes"><h2>{t.keepsakes}</h2><p>{t.keepsakeBody}</p>
      {gallery?.printEmail && gallery.paid.length > 0 && <div className="portrait-orders-inquiry">
        <label>{t.product} <select value={product} onChange={event => setProduct(Number(event.target.value))}>
          {physicalProducts.map((item, index) => <option value={index} key={item}>{item}</option>)}
        </select></label>
        <a href={`mailto:${gallery.printEmail}?subject=${encodeURIComponent('Beside & Bloom · ' + physicalProducts[product])}`}>{t.inquire}</a>
      </div>}
    </section>
    <dialog ref={dialog} className={modal?.print ? 'portrait-dialog portrait-print' : 'portrait-dialog'} onClose={() => setModal(undefined)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      {modal && <div><header><h2>{name(modal.scene)}</h2><button type="button" onClick={() => dialog.current?.close()}>{t.close}</button></header>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl(modal.print ? 'print' : 'preview', modal.scene)} alt={name(modal.scene)} onLoad={() => setPrintReady(true)} />
        {modal.print ? <div className="portrait-print-options"><p className="portrait-dedication">{dedication}</p>
          <label>{t.dedication} <input value={dedication} maxLength={75} onChange={event => setDedication(event.target.value)} /></label>
          <button className="portrait-button" type="button" disabled={!printReady} onClick={() => window.print()}>{t.print}</button></div>
          : canPick(modal.scene) && <label><input type="checkbox" checked={selected.includes(modal.scene)} onChange={() => toggle(modal.scene)} /> {t.keep}</label>}
      </div>}
    </dialog>
  </main>;
}
