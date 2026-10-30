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
  // Only this known local destination is accepted from the browser.
  const destination = data.get('next') === '/tools/hand-drawn-photo/' ? '/tools/hand-drawn-photo/' : '/account';
  if (mode !== "update-password" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return { error: "请输入有效的邮箱地址。" };
  if (mode !== "forgot-password" && (!password || password.length > 128)) return { error: "请输入密码，最多 128 个字符。" };
  if (["signup", "update-password"].includes(mode)) {
    if (password.length < 6) return { error: "密码至少需要 6 个字符。" };
    if (password !== data.get("confirmPassword")) return { error: "两次输入的密码不一致。" };
  }
  try {
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: "登录未成功。请检查邮箱和密码；如果项目仍要求邮箱验证，请先完成验证。" };
    } else if (mode === "signup" || mode === "forgot-password") {
      const origin = validSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
      if (!origin) return { error: "账户服务暂未开放，请稍后再试。" };
      const result = mode === "signup"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirm` } })
        : await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
      if (result.error) {
        if (result.error.name === 'AuthRetryableFetchError') return { error: '无法连接 Supabase，请检查服务端网络或代理配置后重试。' };
        const code = result.error.code;
        const hints: Record<string, string> = {
          over_email_send_rate_limit: "验证邮件发送过于频繁，请稍后重试；管理员可在 Supabase 检查邮件额度。",
          over_request_rate_limit: "请求过于频繁，请稍后重试。",
          weak_password: "密码不符合 Supabase 的密码策略，请管理员检查 Authentication 中的最小长度和复杂度设置。",
          signup_disabled: "Supabase 项目尚未允许注册，请管理员开启邮箱注册。",
          email_provider_disabled: "Supabase 项目未开启邮箱登录，请管理员检查邮箱登录设置。",
          email_address_invalid: "邮箱格式不被账户服务接受，请检查后重试。",
          unexpected_failure: "账户服务或验证邮件发送异常，请管理员查看 Supabase Auth 日志。",
        };
        return { error: hints[code ?? ''] ?? (mode === "signup" ? "注册未成功。该邮箱可能已注册，或验证邮件暂时无法发送；请尝试登录或稍后重试。" : "暂时无法发送重置邮件，请稍后重试。") };
      }
      // With Confirm email disabled, Supabase establishes the session during signup.
      if (mode === "signup" && result.data && "session" in result.data && result.data.session) redirect(destination);
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
  redirect(mode === "update-password" ? "/auth/login?reset=success" : destination);
}
export async function signOut() {
  const supabase = await supabaseServer();
  const result = await supabase?.auth.signOut();
  if (result?.error) redirect("/account?error=signout");
  redirect("/auth/login");
}
