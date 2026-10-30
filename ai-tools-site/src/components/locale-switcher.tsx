"use client";

import { useEffect } from "react";
import { localeCookie, type SiteLocale } from "@/lib/i18n";

export default function LocaleSwitcher({ locale, mode, query: search }: { locale: SiteLocale; mode: "minimal" | "showcase"; query: string }) {
  useEffect(() => {
    document.cookie = `${localeCookie}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [locale]);
  const query = new URLSearchParams(search);
  query.set("mode", mode);
  const suffix = query.size ? `?${query}` : "";
  return <nav aria-label={locale === "zh" ? "语言" : "Language"} className="flex gap-2 rounded-full border border-slate-500 p-1 text-sm">
    {(["en", "zh"] as const).map(language => <a
      key={language}
      href={`/${language}${suffix}`}
      hrefLang={language === "zh" ? "zh-CN" : "en"}
      lang={language === "zh" ? "zh-CN" : "en"}
      aria-current={language === locale ? "page" : undefined}
      className={`rounded-full px-3 py-1 ${language === locale ? "bg-sky-400 text-slate-950" : ""}`}
      onClick={event => {
        document.cookie = `${localeCookie}=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        event.currentTarget.href = `/${language}${suffix}${window.location.hash}`;
      }}
    >{language === "en" ? "English" : "中文"}</a>)}
  </nav>;
}
