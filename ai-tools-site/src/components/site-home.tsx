import ToolDirectory from "@/components/tool-directory";
import { contentByLocale, type Locale } from "@/data/site-content";
import { supabaseServer } from "@/lib/supabase/server";
import { accountInitial } from "@/lib/account-avatar";

export default async function Home({ locale, query }: { locale: Locale; query: string }) {
  const supabase = await supabaseServer();
  const auth = await supabase?.auth.getUser().catch(() => null);
  const user = auth?.data.user;
  return <ToolDirectory locale={locale} copy={contentByLocale[locale]} query={query} initial={user ? accountInitial(user.email) : undefined} />;
}
