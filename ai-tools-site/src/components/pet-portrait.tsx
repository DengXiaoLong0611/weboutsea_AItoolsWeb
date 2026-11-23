'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { copy, type PortraitLanguage } from '@/lib/pet-portrait/copy';
import { priceInCents, sceneIds, scenes, sceneName, previewQueue, previewLimit, referenceRoles, type PortraitCategory, type PortraitSubjects, type Scene } from '@/lib/pet-portrait/catalog';
import { restorePortraitDraft } from '@/lib/pet-portrait/workflow';
import { portraitUploadLimits, validatePortraitPhoto } from '@/lib/pet-portrait/upload';
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
  if (!validatePortraitPhoto(file).ok) throw new Error('files');
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

type Job = { id: string; scene: Scene; status: 'uploading' | 'queued' | 'processing' | 'completed' | 'failed'; retryCount: number; errorCode?: string; canRetry?: boolean };

export default function PetPortrait({ locale, mode = 'main' }: { locale: 'en' | 'zh'; mode?: 'main' | 'looks' | 'photos' }) {
  const language = useSyncExternalStore(subscribeToNavigation, getExtraLanguage, serverExtraLanguage) || locale;
  const [draftReady, setDraftReady] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [monitoring, setMonitoring] = useState(false);
  const [recoveryLink, setRecoveryLink] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [gallery, setGallery] = useState<Gallery>();
  const [selected, setSelected] = useState<Scene[]>([]);
  const [first, setFirst] = useState<Scene>('studio');
  const [subjects, setSubjects] = useState<PortraitSubjects>('person-pet');
  const [category, setCategory] = useState<PortraitCategory | 'all'>('all');
  const [started, setStarted] = useState<number>();
  const [elapsed, setElapsed] = useState(0);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ scene: Scene; print: boolean }>();
  const [printReady, setPrintReady] = useState(false);
  const [dedication, setDedication] = useState('');
  const [product, setProduct] = useState(0);
  const [personFile, setPersonFile] = useState<File>();
  const [petFile, setPetFile] = useState<File>();
  const [personPreview, setPersonPreview] = useState('');
  const [petPreview, setPetPreview] = useState('');
  const [photoErrors, setPhotoErrors] = useState<{ person: string; pet: string }>({ person: '', pet: '' });
  const [photoWarnings, setPhotoWarnings] = useState<{ person: string; pet: string }>({ person: '', pet: '' });
  const [confirming, setConfirming] = useState(false);
  const [dragTarget, setDragTarget] = useState<'person' | 'pet'>();
  const [failedJobId, setFailedJobId] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const t = copy[language];
  const name = (scene: Scene) => sceneName(scene, language);
  const needsPerson = subjects === 'person-pet';
  const visibleScenes = sceneIds.filter(id => scenes[id].subjects === subjects && (category === 'all' || scenes[id].category === category));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let saved: unknown;
      try { saved = JSON.parse(sessionStorage.getItem('pet-portrait-draft') || '{}'); } catch { saved = {}; }
      const draft = restorePortraitDraft(saved, new URLSearchParams(window.location.search).get('look'));
      setFirst(draft.look); setSubjects(draft.subjects); setCategory(draft.category); setDraftReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try {
      sessionStorage.setItem('pet-portrait-draft', JSON.stringify({ look: first, subjects, category }));
    } catch {
      // Keep the in-memory workflow functional when storage is unavailable.
    }
  }, [first, subjects, category, draftReady]);
  function changeFilters(nextSubjects: PortraitSubjects, nextCategory: PortraitCategory | 'all') {
    setSubjects(nextSubjects);
    setCategory(nextCategory);
    const candidates = sceneIds.filter(id => scenes[id].subjects === nextSubjects && (nextCategory === 'all' || scenes[id].category === nextCategory));
    if (!candidates.includes(first)) setFirst(candidates[0]);
    setPhotoErrors({ person: '', pet: '' });
  }
  const money = (amount: number) => new Intl.NumberFormat(language, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(amount / 100);
  const amount = priceInCents(selected.length);
  const readyToBundle = gallery?.scenes.length === previewLimit && gallery.paid.length === 0;
  const physicalProducts = t.products;
  const canPick = (scene: Scene) => !gallery?.paid.includes(scene);

  const recoveryRequest = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    let alive = true;
    const url = new URL(window.location.href);
    const session = url.searchParams.get('checkout');
    async function load() {
      const recovery = new URLSearchParams(url.hash.slice(1)).get('restore');
      if (recovery) {
        url.hash = '';
        window.history.replaceState(null, '', url);
        recoveryRequest.current ??= request(api + '?action=restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: recovery }) });
      }
      if (recoveryRequest.current) await recoveryRequest.current;
      return request<Gallery>(api + (session ? '?checkout=' + encodeURIComponent(session) : ''));
    }
    load().then(async value => {
      if (!alive) return;
      setGallery(value);
      const existing = await request<{ jobs: Job[] }>(api + '?action=jobs');
      if (!alive) return;
      setJobs(existing.jobs);
      setMonitoring(existing.jobs.some(job => ['uploading', 'queued', 'processing'].includes(job.status)));
      const failed = existing.jobs.find(job => job.canRetry);
      if (failed) setFailedJobId(failed.id);
      setSelected(value.scenes.filter(scene => !value.paid.includes(scene)).slice(0, 1));
      if (session && value.paid.length) {
        url.searchParams.delete('checkout');
        window.history.replaceState(null, '', url);
      }
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!monitoring) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const state = await request<{ jobs: Job[] }>(api + '?action=jobs');
        if (!alive) return;
        setJobs(state.jobs);
        const active = state.jobs.some(job => ['uploading', 'queued', 'processing'].includes(job.status));
        if (!active) {
          setGallery(await request<Gallery>(api));
          if (alive) setMonitoring(false);
        }
        const failed = state.jobs.find(job => job.canRetry);
        if (failed) setFailedJobId(failed.id);
        if (active && alive) timer = setTimeout(refresh, 2000);
      } catch { if (alive) timer = setTimeout(refresh, 5000); }
    }
    void refresh();
    return () => { alive = false; clearTimeout(timer); };
  }, [monitoring]);

  useEffect(() => {
    if (started === undefined) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [started]);

  useEffect(() => {
    if (modal && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [modal]);

  useEffect(() => () => {
    if (personPreview) URL.revokeObjectURL(personPreview);
    if (petPreview) URL.revokeObjectURL(petPreview);
  }, [personPreview, petPreview]);

  async function setPhoto(role: 'person' | 'pet', file?: File) {
    const setFile = role === 'person' ? setPersonFile : setPetFile;
    const setPreview = role === 'person' ? setPersonPreview : setPetPreview;
    const oldPreview = role === 'person' ? personPreview : petPreview;
    setPhotoErrors(current => ({ ...current, [role]: '' }));
    setPhotoWarnings(current => ({ ...current, [role]: '' }));
    if (!file) {
      setFile(undefined);
      setPreview('');
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      return;
    }
    const validation = validatePortraitPhoto(file);
    if (!validation.ok) {
      setFile(undefined);
      setPreview('');
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      setPhotoErrors(current => ({
        ...current,
        [role]: validation.reason === 'size' ? t.fileSize : t.fileType,
      }));
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const small = Math.min(bitmap.width, bitmap.height);
      bitmap.close();
      setFile(file);
      setPreview(URL.createObjectURL(file));
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      if (small < portraitUploadLimits.recommendedPixels) {
        setPhotoWarnings(current => ({ ...current, [role]: t.lowResolution }));
      }
    } catch {
      setFile(undefined);
      setPreview('');
      if (oldPreview) URL.revokeObjectURL(oldPreview);
      setPhotoErrors(current => ({ ...current, [role]: t.readPhoto }));
    }
  }

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

  function continueToConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((needsPerson && !personFile) || !petFile) {
      setPhotoErrors({
        person: !needsPerson || personFile ? '' : t.missingPerson,
        pet: petFile ? '' : t.missingPet,
      });
      return;
    }
    setError('');
    setConfirming(true);
  }

  async function pollJob(jobId: string) {
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
      const { job } = await request<{ job: Job }>(api + '?action=job&job=' + encodeURIComponent(jobId), { cache: 'no-store' });
      if (job.status === 'completed' || job.status === 'failed') return job;
      await new Promise(resolve => window.setTimeout(resolve, 1500));
    }
    throw new Error('stillProcessing');
  }

  async function generate() {
    if (!gallery || monitoring || started !== undefined || (needsPerson && !personFile) || !petFile) return;
    setError('');
    setElapsed(0);
    setStarted(Date.now());
    try {
      const [person, pet] = await Promise.all([needsPerson && personFile ? preparePhoto(personFile) : undefined, preparePhoto(petFile)]);
      const queue = previewQueue(first, gallery.scenes);
      for (const scene of queue) {
        const payload = new FormData();
        if (referenceRoles(scene).includes('person') && person) payload.append('person', person, 'person.jpg');
        payload.append('pet', pet, 'pet.jpg');
        payload.append('scene', scene);
        const idempotencyKey = crypto.randomUUID();
        const { job } = await request<{ job: { id: string; status: string } }>(
          api + '?action=job',
          {
            method: 'POST',
            body: payload,
            headers: { 'Idempotency-Key': idempotencyKey },
            signal: AbortSignal.timeout(30_000),
          },
        );
        setMonitoring(true);
        const completed = await pollJob(job.id);
        if (completed.status === 'failed') {
          if (completed.canRetry) setFailedJobId(completed.id);
          throw new Error(completed.canRetry ? 'generation' : 'reviewRequired');
        }
        setGallery(current => current && {
          ...current,
          scenes: current.scenes.includes(scene) ? current.scenes : [...current.scenes, scene],
        });
        if (scene === first && !gallery.paid.includes(scene)) setSelected([scene]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'generation');
      // Recover completed previews if the client timed out after storage succeeded.
      try { setGallery(await request<Gallery>(api)); } catch { /* Keep the previews already displayed. */ }
    } finally {
      setStarted(undefined);
      setConfirming(false);
    }
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

  async function manageRecovery(revoke = false) {
    if (recoveryBusy) return;
    setRecoveryBusy(true); setError('');
    try {
      if (revoke) {
        await request(api + '?action=revoke-recovery', { method: 'POST' });
        setRecoveryLink('');
      } else {
        const { token } = await request<{ token: string }>(api + '?action=recovery', { method: 'POST' });
        const url = new URL(`/${locale}/tools/pet-portrait`, window.location.origin);
        if (language === 'es' || language === 'fr') url.searchParams.set('lang', language);
        url.hash = 'restore=' + token;
        setRecoveryLink(url.href);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'recovery'); }
    finally { setRecoveryBusy(false); }
  }

  async function deleteGallery() {
    if (!window.confirm(language === 'zh' ? '删除当前访客的全部合照、草稿和任务记录？' : 'Delete all portraits, drafts and job records for this visitor?')) return;
    try {
      await request<{ deleted: boolean }>(api, { method: 'DELETE' });
      setGallery({ scenes: [], paid: [], checkout: false, printEmail: null });
      setSelected([]);
      setPersonFile(undefined);
      setPetFile(undefined);
      setPersonPreview('');
      setPetPreview('');
      setJobs([]); setMonitoring(false); setFailedJobId(''); setRecoveryLink('');
      try { sessionStorage.removeItem('pet-portrait-draft'); } catch { /* Optional storage. */ }
      setGallery(await request<Gallery>(api));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'generation');
    }
  }

  async function retryFailedJob() {
    if (!failedJobId || started !== undefined) return;
    setError('');
    setElapsed(0);
    setStarted(Date.now());
    try {
      const { job } = await request<{ job: { id: string; status: string } }>(api + '?action=retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: failedJobId }),
        signal: AbortSignal.timeout(30_000),
      });
      const completed = await pollJob(job.id);
      if (completed.status === 'failed') {
        if (!completed.canRetry) setFailedJobId('');
        throw new Error(completed.canRetry ? 'generation' : 'reviewRequired');
      }
      setFailedJobId('');
      setGallery(await request<Gallery>(api));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'generation');
    } finally {
      setStarted(undefined);
    }
  }

  const processing = started !== undefined || monitoring;
  const translatedError = Object.hasOwn(t, error) ? t[error as keyof typeof t] : undefined;
  const message = typeof translatedError === 'string' ? translatedError : processing ? '' : t.generation;

  return <main className="portrait-tool" lang={language}>
    <header className="portrait-nav">
      <Link href={`/${locale}`}>{t.back}</Link>
      <span>Beside &amp; Bloom</span>
      <select aria-label="Language" value={language} onChange={event => changeLanguage(event.target.value as PortraitLanguage)}>
        {Object.entries(languages).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </select>
    </header>
    <nav className="portrait-legal" aria-label="Legal">
      <Link href={`/${locale}/privacy`}>{language === 'zh' ? '隐私政策' : 'Privacy Policy'}</Link>
      {gallery && <button type="button" disabled={processing} onClick={() => void deleteGallery()}>{language === 'zh' ? '删除我的数据' : 'Delete my data'}</button>}
    </nav>
    {!!gallery?.paid.length && <section className="portrait-recovery">
      <button type="button" disabled={recoveryBusy} onClick={() => void manageRecovery()}>{t.saveRecovery}</button>
      <button type="button" disabled={recoveryBusy} onClick={() => void manageRecovery(true)}>{t.revokeRecovery}</button>
      {recoveryBusy && <progress aria-label={t.saveRecovery} />}
      {recoveryLink && <label>{t.recoveryNotice}<input readOnly value={recoveryLink} onFocus={event => event.target.select()} /></label>}
    </section>}
    {mode === 'main' && <section className="portrait-hero">
      <div><h1>{t.title}</h1><p>{t.description}</p><a className="portrait-button" href="#studio">{t.start}</a><small>{t.free}</small></div>
      <div className="portrait-example" role="group" aria-label={t.exampleFlow}>
        <div className="portrait-example-inputs">
          <figure>
            <Image src="/tools/pet-portrait/guide-person.webp" alt="" width={720} height={720} sizes="(max-width: 760px) 42vw, 180px" />
            <figcaption>{t.person}</figcaption>
          </figure>
          <span className="portrait-example-plus" aria-hidden="true">+</span>
          <figure>
            <Image src="/tools/pet-portrait/guide-pet.webp" alt="" width={720} height={720} sizes="(max-width: 760px) 42vw, 180px" />
            <figcaption>{t.pet}</figcaption>
          </figure>
        </div>
        <div className="portrait-example-merge">
          <span className="portrait-example-arrow" aria-hidden="true">➜</span>
          <span>{t.merge}</span>
        </div>
        <figure className="portrait-example-result">
          <Image src="/tools/pet-portrait/guide-result.webp" alt="" width={1200} height={1200} sizes="(max-width: 760px) 85vw, 400px" preload />
          <figcaption>{t.sample}</figcaption>
        </figure>
      </div>
    </section>}
    {mode === 'main' && <section className="portrait-how"><h2>{t.how}</h2><ol>{t.steps.map(step => <li key={step}>{step}</li>)}</ol></section>}
    <section className="portrait-studio" id="studio">
      {(!gallery || gallery.scenes.length < previewLimit) && !confirming && <form onSubmit={continueToConfirm}>
        <h2>{t.form}</h2>
        <fieldset disabled={processing || !gallery || !draftReady}>
          <div className="portrait-filters">
            <label>{t.subjectsLabel}<select value={subjects} onChange={event => changeFilters(event.target.value as PortraitSubjects, category)}>
              <option value="person-pet">{t.personPetLabel} · 90</option>
              <option value="pet-only">{t.petOnlyLabel} · 25</option>
            </select></label>
            <label>{t.categoryLabel}<select value={category} onChange={event => changeFilters(subjects, event.target.value as PortraitCategory | 'all')}>
              {(['all', 'studio', 'cozy', 'outdoors', 'playful'] as const).map(id => <option key={id} value={id}>{t.categories[id]}</option>)}
            </select></label>
            <p>{t.catalogNote}</p>
          </div>
          <div className="portrait-upload-grid">
            {referenceRoles(first).map(role => {
              const file = role === 'person' ? personFile : petFile;
              const preview = role === 'person' ? personPreview : petPreview;
              const errors = role === 'person' ? photoErrors.person : photoErrors.pet;
              const warning = role === 'person' ? photoWarnings.person : photoWarnings.pet;
              return <div
                className={`portrait-upload-slot ${dragTarget === role ? 'is-dragging' : ''}`}
                key={role}
                onDragEnter={event => { event.preventDefault(); setDragTarget(role); }}
                onDragOver={event => event.preventDefault()}
                onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTarget(undefined); }}
                onDrop={event => { event.preventDefault(); setDragTarget(undefined); void setPhoto(role, event.dataTransfer.files[0]); }}
              >
                <strong>{role === 'person' ? t.person : t.pet}</strong>
                {preview ? <div className="portrait-upload-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt={role === 'person' ? t.person : t.pet} />
                  <span>{file?.name}</span>
                </div> : <p>{role === 'person' ? t.personTip : t.petTip}</p>}
                <div className="portrait-upload-actions">
                  <label className="portrait-upload-button">
                    {file ? t.replace : t.uploadPhoto}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void setPhoto(role, event.target.files?.[0])} />
                  </label>
                  {file && <button type="button" onClick={() => void setPhoto(role)}>{t.remove}</button>}
                </div>
                {warning && <p className="portrait-upload-warning" role="status">{warning}</p>}
                {errors && <p className="portrait-upload-error" role="alert">{errors}</p>}
              </div>;
            })}
            <label className="portrait-look-select">{t.look}<select value={first} onChange={event => setFirst(event.target.value as Scene)}>
              {visibleScenes.map(scene => <option key={scene} value={scene}>{name(scene)}</option>)}
            </select></label>
          </div>
          <p>{t.consent}</p><button className="portrait-button" disabled={(needsPerson && !personFile) || !petFile}>{t.continue}</button>
        </fieldset>
      </form>}
      {confirming && !processing && <section className="portrait-confirm" aria-labelledby="portrait-confirm-title">
        <h2 id="portrait-confirm-title">{t.checkSetup}</h2>
        <div className="portrait-confirm-grid">
          {[...(needsPerson ? [{ preview: personPreview, label: t.person }] : []), { preview: petPreview, label: t.pet }].map(item =>
            <figure key={item.label}>{/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.preview} alt={item.label} /><figcaption>{item.label}</figcaption>
            </figure>)}
        </div>
        <p><strong>{t.look}:</strong> {name(first)}</p>
        <div className="portrait-confirm-actions">
          <button type="button" className="portrait-button secondary" onClick={() => setConfirming(false)}>{t.backStep}</button>
          <button type="button" className="portrait-button" disabled={processing} onClick={() => void generate()}>{t.startGeneration}</button>
        </div>
      </section>}
      {processing && <div className="portrait-progress"><span role="status">{t.waiting} · {gallery?.scenes.length ?? 0}/3</span>
        <progress aria-label={t.waiting} />{started !== undefined && <span aria-hidden="true">{elapsed}s</span>}{elapsed >= 45 && <p>{t.long}</p>}
      </div>}
      {jobs.some(job => job.status === 'failed' && !job.canRetry) && !processing && <p role="status">{t.reviewRequired}</p>}
      {error && <p role="alert" className="portrait-error">{message}</p>}
      {failedJobId && !processing && <button type="button" className="portrait-button secondary" onClick={() => void retryFailedJob()}>
        {language === 'zh' ? '重试失败任务' : language === 'es' ? 'Reintentar tarea' : language === 'fr' ? 'Réessayer la tâche' : 'Retry failed task'}
      </button>}
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
            {readyToBundle && selected.length !== 3 && <button className="portrait-button secondary" type="button" disabled={checkoutBusy || processing} onClick={() => pay(gallery.scenes)}>
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
