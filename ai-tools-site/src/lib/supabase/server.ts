import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfig } from "./config";
import { supabaseFetch } from './transport';
export async function supabaseServer() {
  const config = authConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    global: { fetch: supabaseFetch },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server components cannot set cookies; proxy refreshes them. */ }
      },
    },
  });
}
