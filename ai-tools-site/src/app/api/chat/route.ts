import { handleChatRequest, createLimiter } from "@/lib/chat/server";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 120;
const limiter = createLimiter();

export async function POST(request: Request) {
  return handleChatRequest(request, {
    apiKey: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL,
    siteOrigin: process.env.NEXT_PUBLIC_SITE_URL,
    limiter,
    getUser: async () => {
      const supabase = await supabaseServer();
      if (!supabase) return null;
      const { data: { user }, error } = await supabase.auth.getUser();
      return error ? null : user?.id ?? null;
    },
  });
}
