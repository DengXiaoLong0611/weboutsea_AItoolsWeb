"use client";

import { useMemo, useState } from "react";
import LocaleSwitcher from "@/components/locale-switcher";
import Link from "next/link";
import ToolDirectory from "@/components/tool-directory";
import {
  contentByLocale,
  siteConfig,
  type Locale,
  type ThemeMode,
  type ToolStage,
} from "@/data/site-content";

const stageColorClass: Record<ToolStage, { showcase: string; minimal: string }> = {
  live: {
    showcase: "bg-emerald-400/20 text-emerald-300",
    minimal: "bg-emerald-100 text-emerald-700",
  },
  shipping: {
    showcase: "bg-sky-400/20 text-sky-300",
    minimal: "bg-blue-100 text-blue-700",
  },
  in_build: {
    showcase: "bg-slate-200/15 text-slate-200/85",
    minimal: "bg-slate-100 text-slate-600",
  },
};

export default function Home({ locale, initialMode, query }: { locale: Locale; initialMode: ThemeMode; query: string }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const isMinimal = mode === "minimal";

  const copy = useMemo(() => contentByLocale[locale], [locale]);

  if (isMinimal) {
    return <ToolDirectory locale={locale} copy={copy} query={query} onShowcase={() => setMode("showcase")} />;
  }

  return (
    <div
      className={`min-h-screen ${
        isMinimal ? "bg-[#f8fafc] text-[#0f172a]" : "bg-[#060b16] text-[#edf2ff]"
      }`}
    >
      <header
        className={`sticky top-0 z-20 border-b backdrop-blur ${
          isMinimal
            ? "border-slate-200 bg-white/90"
            : "border-[#223454]/80 bg-[#060b16]/85"
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 lg:px-8">
          <p className="text-sm font-semibold tracking-tight">{copy.brand}</p>
          <nav
            className={`hidden items-center gap-6 text-sm md:flex ${
              isMinimal ? "text-slate-600" : "text-[#edf2ff]/75"
            }`}
          >
            <a className="transition-colors hover:text-sky-500" href="#tools">
              {copy.nav.tools}
            </a>
            <a className="transition-colors hover:text-sky-500" href="#cases">
              {copy.nav.cases}
            </a>
            <a className="transition-colors hover:text-sky-500" href="#offers">
              {copy.nav.offers}
            </a>
            <a className="transition-colors hover:text-sky-500" href="#contact">
              {copy.nav.contact}
            </a>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/account" className="rounded-full border border-slate-500 px-3 py-2 text-sm">{locale === "zh" ? "登录 / 账户" : "Sign in / Account"}</Link>
            <LocaleSwitcher locale={locale} mode={mode} query={query} />
            <div
              className={`flex rounded-full border p-1 ${
                isMinimal ? "border-slate-200 bg-slate-100" : "border-[#223454] bg-[#101a2e]"
              }`}
            >
              <button
                type="button"
                onClick={() => setMode("showcase")}
                className="rounded-full bg-sky-400 px-3 py-1 text-xs font-medium text-[#03111d]"
              >
                Showcase
              </button>
              <button
                type="button"
                onClick={() => setMode("minimal")}
                className="rounded-full px-3 py-1 text-xs font-medium text-slate-300"
              >
                Minimal
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-10 lg:px-8 lg:py-14">
        <section
          className={`grid gap-8 ${
            isMinimal ? "lg:grid-cols-[1.55fr_1fr]" : "lg:grid-cols-[1.7fr_1fr] lg:items-end"
          }`}
        >
          <div className="space-y-7">
            <h1 className="max-w-4xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {copy.headline}
            </h1>
            <p
              className={`max-w-3xl text-lg leading-relaxed ${
                isMinimal ? "text-slate-600" : "text-[#edf2ff]/78"
              }`}
            >
              {copy.subheading}
            </p>
            <div className={`flex flex-wrap gap-3 ${isMinimal ? "text-sm" : ""}`}>
              <a
                className={`rounded-full px-6 py-3 font-medium transition ${
                  isMinimal
                    ? "bg-slate-900 text-white hover:bg-slate-700"
                    : "bg-sky-400 text-[#03111d] hover:bg-sky-300"
                }`}
                href="#contact"
              >
                {copy.primaryCta}
              </a>
              <a
                className={`rounded-full border px-6 py-3 font-medium transition ${
                  isMinimal
                    ? "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                    : "border-[#223454] bg-[#0d1527] text-[#edf2ff] hover:border-sky-400/70 hover:text-sky-300"
                }`}
                href="#workflow"
              >
                {copy.secondaryCta}
              </a>
            </div>
          </div>
          <div
            className={`grid gap-3 rounded-2xl border p-5 ${
              isMinimal ? "border-slate-200 bg-white" : "border-[#223454] bg-[#101a2e]"
            }`}
          >
            <p
              className={`text-xs uppercase tracking-wide ${
                isMinimal ? "text-slate-500" : "text-[#89ddff]"
              }`}
            >
              {copy.metricsTitle}
            </p>
            {copy.metrics.map((item) => (
              <div
                key={item.label}
                className={`rounded-xl border px-4 py-4 ${
                  isMinimal
                    ? "border-slate-200 bg-slate-50"
                    : "border-[#223454]/80 bg-[#060b16]/45"
                }`}
              >
                <p
                  className={`text-xs uppercase tracking-wide ${
                    isMinimal ? "text-slate-500" : "text-[#edf2ff]/60"
                  }`}
                >
                  {item.label}
                </p>
                <p
                  className={`mt-2 text-3xl font-semibold ${
                    isMinimal ? "text-slate-900" : "text-[#89ddff]"
                  }`}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {isMinimal && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">{copy.quickLinksTitle}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {copy.quickLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </section>
        )}

        <section id="tools" className="space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {copy.toolsTitle}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {copy.tools.map((tool) => (
              <article
                key={tool.name}
                className={`rounded-2xl border px-5 py-5 ${
                  isMinimal ? "border-slate-200 bg-white" : "border-[#223454] bg-[#101a2e]"
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-xl font-medium tracking-tight">{tool.name}</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      stageColorClass[tool.stage][mode]
                    }`}
                  >
                    {copy.stageLabels[tool.stage]}
                  </span>
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    isMinimal ? "text-slate-700" : "text-[#edf2ff]/86"
                  }`}
                >
                  {tool.value}
                </p>
                <p
                  className={`mt-3 text-sm leading-relaxed ${
                    isMinimal ? "text-slate-500" : "text-[#edf2ff]/66"
                  }`}
                >
                  {tool.summary}
                </p>
                {tool.href && (
                  <Link href={tool.href} className="mt-4 inline-flex rounded-full bg-sky-400 px-4 py-2 text-sm font-medium text-[#03111d] hover:bg-sky-300">
                    {locale === "zh" ? "打开工具 →" : "Open tool →"}
                  </Link>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {tool.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        isMinimal
                          ? "border-slate-200 bg-slate-50 text-slate-600"
                          : "border-[#223454] bg-[#060b16]/50 text-[#edf2ff]/76"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="cases" className="space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {copy.casesTitle}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {copy.cases.map((item) => (
              <article
                key={item.title}
                className={`rounded-2xl border px-5 py-5 ${
                  isMinimal
                    ? "border-slate-200 bg-white"
                    : "border-[#223454] bg-[#0d1527]"
                }`}
              >
                <p
                  className={`text-xs uppercase tracking-wide ${
                    isMinimal ? "text-slate-500" : "text-[#89ddff]/90"
                  }`}
                >
                  {item.region}
                </p>
                <h3 className="mt-2 text-lg font-medium">{item.title}</h3>
                <p
                  className={`mt-2 text-base font-semibold ${
                    isMinimal ? "text-emerald-700" : "text-emerald-300"
                  }`}
                >
                  {item.result}
                </p>
                <p
                  className={`mt-3 text-sm leading-relaxed ${
                    isMinimal ? "text-slate-600" : "text-[#edf2ff]/72"
                  }`}
                >
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="offers"
          className={`grid gap-6 rounded-3xl border px-6 py-7 lg:grid-cols-[1fr_1fr] ${
            isMinimal ? "border-slate-200 bg-white" : "border-[#223454] bg-[#101a2e]"
          }`}
        >
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {copy.offersTitle}
            </h2>
            <p
              className={`max-w-xl text-sm leading-relaxed ${
                isMinimal ? "text-slate-600" : "text-[#edf2ff]/74"
              }`}
            >
              {copy.offersIntro}
            </p>
          </div>
          <div className="space-y-3">
            {copy.offers.map((offer) => (
              <article
                key={offer.title}
                className={`rounded-2xl border px-4 py-4 ${
                  isMinimal
                    ? "border-slate-200 bg-slate-50"
                    : "border-[#223454]/80 bg-[#060b16]/40"
                }`}
              >
                <h3 className={isMinimal ? "font-medium text-slate-900" : "font-medium text-sky-300"}>
                  {offer.title}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed ${
                    isMinimal ? "text-slate-600" : "text-[#edf2ff]/76"
                  }`}
                >
                  {offer.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {copy.workflowTitle}
          </h2>
          <ol className="space-y-3">
            {copy.workflow.map((step) => (
              <li
                key={step}
                className={`rounded-2xl border px-5 py-4 text-sm leading-relaxed ${
                  isMinimal
                    ? "border-slate-200 bg-white text-slate-700"
                    : "border-[#223454] bg-[#0d1527] text-[#edf2ff]/80"
                }`}
              >
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section
          id="contact"
          className={`rounded-3xl border px-6 py-8 text-center ${
            isMinimal
              ? "border-slate-200 bg-white"
              : "border-sky-400/60 bg-[#101a2e]"
          }`}
        >
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {copy.contactTitle}
          </h2>
          <p
            className={`mx-auto mt-3 max-w-2xl text-sm leading-relaxed ${
              isMinimal ? "text-slate-600" : "text-[#edf2ff]/78"
            }`}
          >
            {copy.contactText}
          </p>
          <a
            className={`mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold transition ${
              isMinimal
                ? "bg-slate-900 text-white hover:bg-slate-700"
                : "bg-sky-400 text-[#03111d] hover:bg-sky-300"
            }`}
            href={`mailto:${siteConfig.contactEmail}`}
          >
            {siteConfig.contactEmail}
          </a>
        </section>
      </main>

      <footer
        className={`border-t px-6 py-6 text-center text-xs lg:px-8 ${
          isMinimal
            ? "border-slate-200 text-slate-500"
            : "border-[#223454]/80 text-[#edf2ff]/55"
        }`}
      >
        © {siteConfig.copyrightYear} {siteConfig.copyright}. Built with Next.js.
      </footer>
    </div>
  );
}
