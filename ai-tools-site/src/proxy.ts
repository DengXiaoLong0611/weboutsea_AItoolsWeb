import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/supabase/config";
import { chooseLocale, localeCookie } from "@/lib/i18n";
import { supabaseFetch } from '@/lib/supabase/transport';
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const locale = chooseLocale(request.cookies.get(localeCookie)?.value, request.headers.get("accept-language"));
    const destination = request.nextUrl.clone();
    destination.pathname = `/${locale}`;
    const redirect = NextResponse.redirect(destination);
    redirect.headers.set("Cache-Control", "private, no-store");
    redirect.headers.set("Vary", "Accept-Language, Cookie");
    return redirect;
  }
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const config = authConfig();
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    global: { fetch: supabaseFetch },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", "private, no-store");
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}
export const config = { matcher: ["/", "/auth/:path*", "/account/:path*", "/admin/:path*"] };
