import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { confirmationDestination } from "@/lib/supabase/policy";
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const destination = confirmationDestination(type);
  const supabase = await supabaseServer();
  if (supabase && destination && token_hash && (type === "signup" || type === "recovery")) {
    try {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type });
      if (!error) {
        const response = NextResponse.redirect(new URL(destination, request.url));
        response.headers.set("Cache-Control", "private, no-store");
        response.headers.set("Referrer-Policy", "no-referrer");
        return response;
      }
    } catch { /* Invalid links and network errors use the same safe destination. */ }
  }
  const response = NextResponse.redirect(new URL("/auth/login?error=confirmation", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
