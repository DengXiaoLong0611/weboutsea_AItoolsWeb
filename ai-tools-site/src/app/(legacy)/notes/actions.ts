"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isLibraryAdmin } from "@/lib/private-library";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseFetch } from "@/lib/supabase/transport";

export async function publishNote(form: FormData) {
  const supabase = await supabaseServer();
  const user = (await supabase?.auth.getUser())?.data.user;
  if (!user || !isLibraryAdmin(user.email)) redirect("/notes");

  const body = String(form.get("body") ?? "").trim();
  const image = String(form.get("image") ?? "").trim();
  const parsed = URL.parse(image);
  if (!body || body.length > 2000 || image.length > 1500 ||
    (image && (parsed?.protocol !== "https:" || parsed.username || parsed.password))) {
    redirect("/notes?error=input");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) redirect("/notes?error=config");
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch },
  });
  const { error } = await admin.from("public_notes").insert({ body, image_url: image || null });
  if (error) redirect("/notes?error=storage");
  redirect("/notes");
}
