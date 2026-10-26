import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isLibraryAdmin } from "@/lib/private-library";
import { signOut } from "@/app/auth/actions";
async function AccountContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await connection();
  const supabase = await supabaseServer();
  if (!supabase) redirect("/auth/login");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/auth/login");
  const query = await searchParams;
  return <main className="min-h-screen px-5 py-12"><section className="mx-auto max-w-xl rounded-2xl border border-[#223454] bg-[#101a2e] p-8">
    <Link href="/" className="text-sm text-sky-300">← 返回工具站</Link><h1 className="mt-6 text-2xl font-semibold">我的账户</h1>
    <p className="mt-5 text-sm text-slate-400">登录邮箱</p><p className="mt-2 break-all">{user.email}</p>
    <p className="mt-5 text-sm text-slate-300">你已成功登录，可以返回工具站继续浏览。</p>
    {isLibraryAdmin(user.email) && <Link href="/admin/api-library" className="mt-6 block text-sky-300">私人 API 与提示词收藏库 →</Link>}
    <Link href="/auth/forgot-password" className="mt-6 inline-block text-sm text-sky-300">通过邮件重置密码</Link>
    {query.error && <p role="alert" className="mt-4 text-rose-300">退出未成功，请稍后重试。</p>}
    <form action={signOut} className="mt-6"><button className="rounded-xl border border-slate-500 px-5 py-2 text-sm hover:bg-slate-800">退出登录</button></form>
  </section></main>;
}

export default function Account(props: Parameters<typeof AccountContent>[0]) {
  return <Suspense fallback={<main className="p-8">正在载入账户服务…</main>}><AccountContent {...props} /></Suspense>;
}
