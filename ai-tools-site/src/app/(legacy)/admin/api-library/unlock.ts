"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLibraryAdmin } from "@/lib/private-library";
import { supabaseServer } from "@/lib/supabase/server";

const cookie = "private_collection";
const duration = 3600;

function signature(userId: string, expires: number) {
  const secret = process.env.DRAWING_COOKIE_SECRET;
  const pin = process.env.PRIVATE_LIBRARY_PIN;
  if (!secret || secret.length < 32 || !pin) return null;
  return createHmac("sha256", secret).update(JSON.stringify(["library", userId, expires, pin])).digest("hex");
}

export async function collectionUnlocked(userId: string) {
  const [time, token] = ((await cookies()).get(cookie)?.value ?? "").split(".");
  const expires = Number(time);
  if (!Number.isSafeInteger(expires) || expires <= Date.now() || !/^[a-f0-9]{64}$/.test(token ?? "")) return false;
  const expected = signature(userId, expires);
  return !!expected && timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
}

export async function unlockCollection(data: FormData) {
  const supabase = await supabaseServer();
  const user = (await supabase?.auth.getUser())?.data.user;
  if (!user || !isLibraryAdmin(user.email)) redirect("/auth/login");
  const expires = Date.now() + duration * 1000;
  const token = signature(user.id, expires);
  if (!token) redirect("/admin/api-library?error=config");
  if (data.get("pin") !== process.env.PRIVATE_LIBRARY_PIN) redirect("/admin/api-library?error=pin");
  (await cookies()).set(cookie, `${expires}.${token}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/admin/api-library", maxAge: duration,
  });
  redirect("/admin/api-library");
}
