"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { validSiteUrl } from "@/lib/supabase/policy";
export type AuthState = { error?: string; message?: string };
export async function authenticate(mode: string, _previous: AuthState, data: FormData): Promise<AuthState> {
  const supabase = await supabaseServer();
  if (!supabase) return { error: "账户服务暂未开放，请稍后再试。" };
  if (!["login", "signup", "forgot-password", "update-password"].includes(mode)) return { error: "请求无效。" };
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");
  if (mode !== "update-password" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return { error: "请输入有效的邮箱地址。" };
  if (mode !== "forgot-password" && (!password || password.length > 128)) return { error: "请输入密码，最多 128 个字符。" };
  if (["signup", "update-password"].includes(mode)) {
    if (password.length < 12) return { error: "密码至少需要 12 个字符。" };
    if (password !== data.get("confirmPassword")) return { error: "两次输入的密码不一致。" };
  }
  try {
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: "登录未成功。请检查邮箱和密码，并确认已完成邮箱验证。" };
    } else if (mode === "signup" || mode === "forgot-password") {
      const origin = validSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
      if (!origin) return { error: "账户服务暂未开放，请稍后再试。" };
      const result = mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirm` } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
      if (result.error) return { error: "暂时无法发送邮件。请稍后重试，或检查密码是否符合要求。" };
      return { message: mode === "signup" ? "如果该邮箱可以注册，你将收到验证邮件。请检查收件箱和垃圾邮件。已有账户可直接登录。" : "如果该邮箱已注册，你将收到密码重置邮件。请检查收件箱和垃圾邮件。" };
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return { error: "重置链接已失效，请重新申请密码重置。" };
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: "修改未成功。请使用与旧密码不同的新密码，或重新申请重置链接。" };
      await supabase.auth.signOut({ scope: "global" });
    }
  } catch (error) {
    // Next.js redirects must propagate; never log credentials or service responses.
    unstable_rethrow(error);
    return { error: "暂时无法连接账户服务，请稍后重试。" };
  }
  redirect(mode === "update-password" ? "/auth/login?reset=success" : "/account");
}
export async function signOut() {
  const supabase = await supabaseServer();
  const result = await supabase?.auth.signOut();
  if (result?.error) redirect("/account?error=signout");
  redirect("/auth/login");
}
