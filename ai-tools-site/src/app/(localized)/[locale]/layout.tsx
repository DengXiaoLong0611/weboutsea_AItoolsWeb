import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { validSiteUrl } from "@/lib/supabase/policy";
import "../../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export function generateStaticParams() {
  return [{ locale: "en" }, { locale: "zh" }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return {
    metadataBase: new URL(validSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3000"),
    title: "AI Global Toolkit",
    description: locale === "en"
      ? "Discover AI tools, explore photo tools and illustration references, and find services for global growth."
      : "发现 AI 工具，体验照片排版、浏览手绘参考案例，了解出海增长服务。",
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", "zh-CN": "/zh", "x-default": "/en" },
    },
  };
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <html lang={locale === "zh" ? "zh-CN" : "en"} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
    <body className="min-h-full flex flex-col">{children}</body>
  </html>;
}
