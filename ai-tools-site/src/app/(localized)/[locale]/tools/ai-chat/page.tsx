import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AIChat from "@/components/ai-chat";
import { isLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return {
    title: locale === "zh" ? "AI 聊天 · DeepSeek | AI 出海工具站" : "AI Chat · Powered by DeepSeek | AI Global Toolkit",
    description: locale === "zh" ? "使用 DeepSeek 进行日常问答、写作与头脑风暴，支持连续对话与流式回复。" : "Think, write and explore with DeepSeek. A simple AI chat with streaming replies and conversational context.",
    alternates: { canonical: `/${locale}/tools/ai-chat`, languages: { en: "/en/tools/ai-chat", "zh-CN": "/zh/tools/ai-chat", "x-default": "/en/tools/ai-chat" } },
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Suspense fallback={<AIChat locale={locale} configured={false} />}><ConnectedChat locale={locale} /></Suspense>;
}

async function ConnectedChat({ locale }: { locale: "en" | "zh" }) {
  await connection();
  return <AIChat locale={locale} configured={Boolean(process.env.DEEPSEEK_API_KEY?.trim())} />;
}
