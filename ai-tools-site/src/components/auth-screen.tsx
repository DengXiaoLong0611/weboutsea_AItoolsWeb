import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "@/components/auth-form";
import { authConfig } from "@/lib/supabase/config";
import { supabaseServer } from "@/lib/supabase/server";
const titles: Record<string, string> = { login: "欢迎回来", signup: "创建你的账户", "forgot-password": "找回密码", "update-password": "设置新密码" };
async function AuthPageContent({ mode, searchParams }: { mode: string; searchParams: Promise<Record<string, string | undefined>> }) {
  await connection();
  const query = await searchParams;
  const returnTo = query.next === '/tools/hand-drawn-photo/' ? query.next : '/account';
  if (mode === "update-password") {
    const client = await supabaseServer();
    if (!client) redirect("/auth/login");
    if (client) {
      const { data: { user } } = await client.auth.getUser();
      if (!user) redirect("/auth/forgot-password?error=expired");
    }
  }
  return <main className="min-h-screen bg-[#060b16] px-5 py-12 text-[#edf2ff]">
    <div className="mx-auto max-w-md"><Link href="/" className="text-sm text-sky-300">← 返回 AI Global Toolkit</Link>
    <section className="mt-8 rounded-2xl border border-[#223454] bg-[#101a2e] p-6 sm:p-8"><h1 className="text-2xl font-semibold">{titles[mode]}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-300">{mode === "signup" ? "使用邮箱和密码注册，注册成功后直接进入账户，无需邮箱验证。" : mode === "forgot-password" ? "输入注册邮箱，我们会发送重置链接。" : mode === "update-password" ? "请为账户设置一个新的独立密码。" : "使用你的邮箱和密码登录。"}</p>
    {query.error && <p role="alert" className="mt-4 text-sm text-rose-300">链接已失效或验证未完成，请重新注册或申请密码重置。</p>}
    {query.reset === "success" && <p role="status" className="mt-4 text-sm text-emerald-300">密码已更新，请使用新密码登录。</p>}
    {authConfig() ? <AuthForm mode={mode} returnTo={returnTo} /> : <p role="status" className="mt-6 text-sm text-amber-200">账户服务暂未开放，请稍后再来。</p>}
    </section></div></main>;
}

export default function AuthPage(props: Parameters<typeof AuthPageContent>[0]) {
  return <Suspense fallback={<main className="p-8">正在载入账户服务…</main>}><AuthPageContent {...props} /></Suspense>;
}
