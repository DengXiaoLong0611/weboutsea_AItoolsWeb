import { notFound } from "next/navigation";
import { Suspense } from "react";
import Home from "@/components/site-home";
import { isLocale } from "@/lib/i18n";

type PageProps = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Content({ params, searchParams }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const encoded = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach(item => encoded.append(key, item));
    else if (value !== undefined) encoded.set(key, value);
  }
  return <Home locale={locale} initialMode={query.mode === "minimal" ? "minimal" : "showcase"} query={encoded.toString()} />;
}

export default function Page(props: PageProps) {
  return <Suspense fallback={null}><Content {...props} /></Suspense>;
}
