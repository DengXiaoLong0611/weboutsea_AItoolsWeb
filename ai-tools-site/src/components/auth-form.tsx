"use client";
import { useActionState } from "react";
import Link from "next/link";
import { authenticate, type AuthState } from "@/app/auth/actions";
export default function AuthForm({ mode, returnTo = '/account' }: { mode: string; returnTo?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(authenticate.bind(null, mode), {});
  const titles: Record<string, string> = { login: "登录", signup: "创建账户", "forgot-password": "找回密码", "update-password": "设置新密码" };
  const newPassword = mode === "signup" || mode === "update-password";
  const inputClass = "mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-white focus:outline-2 focus:outline-sky-400";
  return <form action={action} className="mt-7 space-y-5">
    <input type="hidden" name="next" value={returnTo} />
    {mode !== "update-password" && <label className="block text-sm">邮箱地址<input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
    {mode !== "forgot-password" && <label className="block text-sm">{newPassword ? "密码（至少 6 个字符）" : "密码"}<input className={inputClass} name="password" type="password" autoComplete={newPassword ? "new-password" : "current-password"} minLength={newPassword ? 6 : 1} maxLength={128} required /></label>}
    {newPassword && <label className="block text-sm">确认密码<input className={inputClass} name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} maxLength={128} /></label>}
    {state.error && <p role="alert" className="text-sm text-rose-300">{state.error}</p>}
    {state.message && <p role="status" className="text-sm text-emerald-300">{state.message}</p>}
    <button disabled={pending} className="w-full rounded-xl bg-sky-400 px-4 py-3 font-medium text-slate-950 hover:bg-sky-300 disabled:opacity-50">{pending ? "正在处理…" : mode === "forgot-password" ? "发送重置邮件" : titles[mode]}</button>
    <div className="flex flex-wrap gap-4 text-sm text-sky-300">{mode !== "login" && <Link href={`/auth/login?next=${encodeURIComponent(returnTo)}`}>返回登录</Link>}{mode === "login" && <><Link href={`/auth/signup?next=${encodeURIComponent(returnTo)}`}>创建账户</Link><Link href="/auth/forgot-password">忘记密码？</Link></>}</div>
  </form>;
}
