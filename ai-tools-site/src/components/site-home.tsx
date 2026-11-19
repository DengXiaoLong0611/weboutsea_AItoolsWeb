import ToolDirectory from "@/components/tool-directory";
import { contentByLocale, type Locale } from "@/data/site-content";

export default function Home({ locale, query }: { locale: Locale; query: string }) {
  return <ToolDirectory locale={locale} copy={contentByLocale[locale]} query={query} />;
}
