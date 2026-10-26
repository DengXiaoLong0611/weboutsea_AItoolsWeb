import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect, notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { cleanupPrompt, isLibraryAdmin } from "@/lib/private-library";
export const metadata = { title: "私人 API 与提示词收藏库", robots: { index: false, follow: false } };
async function Library() {
  await connection();
  const supabase = await supabaseServer();
  if (!supabase) redirect("/auth/login");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/login");
  if (!isLibraryAdmin(user.email)) notFound();
  return <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-12">
    <Link href="/account" className="text-sky-300">← 我的账户</Link>
    <header><p className="text-sm text-slate-400">私人管理区</p><h1 className="mt-2 text-3xl font-semibold">API 与提示词收藏库</h1><p className="mt-3 text-slate-300">收集模型供应商与可复用提示词，辅助选型和素材制作。</p></header>
    <section className="rounded-2xl border border-slate-700 p-6"><h2 className="text-xl font-semibold">净图助手｜短视频截图清理</h2><p className="mt-3 text-slate-300">提示词 · 图片编辑 · imagegen · 2026-10-25</p><p className="my-4 text-sm text-slate-400">上传原图后复制下方提示词。清理播放按钮、平台 UI 和叠加水印，保留主体及右上角照片对照。AI 补画可能改变细节；作者签名和版权标记应保留。</p><label htmlFor="cleanup-prompt" className="text-sm">完整提示词（选中即可复制）</label><textarea id="cleanup-prompt" readOnly value={cleanupPrompt} rows={22} className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-950 p-4 text-sm leading-7"/><p className="mt-3 text-sm text-slate-400">通用复用版，不是某一次调用的逐字记录。普通照片可删除手绘及右上角对照要求。内置 imagegen 无法导出 API Key。</p></section>
    <section><h2 className="text-xl font-semibold">图片 API 选型收藏</h2><div className="mt-4 grid gap-4 sm:grid-cols-3">{[{ name: "fal.ai", href: "https://fal.ai/", note: "图像模型与编辑接口" }, { name: "Black Forest Labs", href: "https://bfl.ai/", note: "FLUX 系列图片编辑" }, { name: "OpenAI API", href: "https://platform.openai.com/", note: "图像生成与编辑接口" }].map(api => <article key={api.name} className="rounded-xl border border-slate-700 p-5"><h3 className="font-semibold">{api.name}</h3><p className="my-3 text-sm text-slate-400">{api.note} · 待测试，未接入</p><a href={api.href} target="_blank" rel="noopener noreferrer" className="text-sky-300">查看官网 ↗</a></article>)}</div><p className="mt-4 text-sm text-slate-400">购买前核对当前价格、商用条款与参考图效果。这里不存储 API 密钥。</p></section>
  </main>;
}
export default function Page() { return <Suspense fallback={<main className="p-8">正在验证管理权限…</main>}><Library /></Suspense>; }
