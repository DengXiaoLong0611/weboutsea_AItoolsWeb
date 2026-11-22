import { Suspense } from "react";
import Link from "next/link";
import { isLibraryAdmin } from "@/lib/private-library";
import { supabaseServer } from "@/lib/supabase/server";
import { publishNote } from "./actions";

export const metadata = { title: "动态 · AI 工具站" };
type Props = { searchParams: Promise<{ error?: string }> };

async function NotesFeed({ searchParams }: Props) {
  const supabase = await supabaseServer();
  const auth = await supabase?.auth.getUser().catch(() => null);
  const owner = isLibraryAdmin(auth?.data.user?.email);
  const notes = await supabase?.from("public_notes").select("id, body, image_url, created_at")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
  const { error } = await searchParams;
  return <main className="mx-auto min-h-screen max-w-2xl space-y-6 px-5 py-12">
    <Link href="/" className="text-sm text-sky-300">← 返回工具站</Link>
    <h1 className="text-3xl font-semibold">动态</h1>
    {owner && <form action={publishNote} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <label className="block">写一条动态<textarea className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3" name="body" rows={4} maxLength={2000} required /></label>
      <label className="block text-sm">图片链接（可选）<input className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3" name="image" type="url" placeholder="https://" maxLength={1500} /></label>
      {error && <p role="alert" className="text-rose-300">{error === "input" ? "请检查文字和 HTTPS 图片链接。" : error === "config" ? "动态发布服务尚未配置。" : "动态保存失败，请稍后重试。"}</p>}
      <button className="rounded-lg bg-sky-300 px-4 py-2 font-medium text-slate-950">公开发布</button>
    </form>}
    {!notes || notes.error ? <p className="text-slate-400">动态暂时无法加载。</p> : !notes.data.length ? <p className="text-slate-400">还没有发布动态。</p> : notes.data.map(note =>
      <article key={note.id} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <time dateTime={note.created_at} className="text-sm text-slate-400">{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" }).format(new Date(note.created_at))}</time>
        <p className="whitespace-pre-wrap break-words leading-7">{note.body}</p>
        {/* External image URLs are rendered by the browser without proxying them through the app. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {note.image_url && <img src={note.image_url} alt="动态配图" loading="lazy" referrerPolicy="no-referrer" className="max-h-[32rem] max-w-full rounded-xl object-contain" />}
      </article>
    )}
  </main>;
}

export default function Notes(props: Props) {
  return <Suspense fallback={<main className="p-8">正在加载动态…</main>}><NotesFeed {...props} /></Suspense>;
}
