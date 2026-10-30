"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readNDJSON } from "@/lib/chat/protocol";
import type { Locale } from "@/data/site-content";
import "./ai-chat.css";

type Message = { id: string; role: "user" | "assistant"; content: string; state?: "complete" | "stopped" | "failed" | "truncated" };
const errors: Record<string, [string, string]> = {
  sign_in_required: ["Sign in to start chatting. After signing in, return to this tab and retry.", "请先登录，登录后回到此标签页重试即可。"],
  not_configured: ["Chat is not connected yet. The site owner needs to configure the DeepSeek API key.", "聊天服务尚未接通，请站点管理员配置 DeepSeek API 密钥。"],
  rate_limited: ["You’re sending messages too quickly. Please wait a minute.", "发送太频繁，请等待一分钟后重试。"],
  provider_busy: ["DeepSeek is busy. Please try again in a moment.", "DeepSeek 暂时繁忙，请稍后重试。"],
  provider_balance: ["The chat service has run out of provider credit. Please contact the site owner.", "模型服务余额不足，请联系站点管理员。"],
  provider_auth: ["The model connection needs attention from the site owner.", "模型连接配置有误，请联系站点管理员。"],
  invalid_request: ["This conversation is too long or contains an invalid message. Start a new chat or shorten your message.", "对话过长或消息无效，请新建对话或缩短消息。"],
  too_large: ["Your message is too large. Please shorten it.", "消息过大，请缩短后重试。"],
  timeout: ["The reply timed out. Any partial answer is kept below; you can retry.", "回复超时，已保留收到的内容，可以重试。"],
  stream_failed: ["The reply was interrupted. You can retry the last message.", "回复中断，可以重试最后一条消息。"],
  auth_unavailable: ["The account service is temporarily unavailable. Please try again later.", "账户服务暂不可用，请稍后重试。"],
};

export default function AIChat({ locale, configured }: { locale: Locale; configured: boolean }) {
  const zh = locale === "zh";
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = messages.at(-1);
  const retryable = last?.role === "assistant" && last.state !== "complete";
  const contextTooLong = messages.length >= 30 || messages.some(m => m.content.length > 8000) || messages.reduce((n, m) => n + m.content.length, 0) + draft.length > 24000;
  const t = (en: string, cn: string) => zh ? cn : en;

  useEffect(() => () => { active.current?.abort(); if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  useEffect(() => { if (nearBottom.current) bottom.current?.scrollIntoView({ behavior: "instant", block: "end" }); }, [messages, busy]);

  async function generate(history: Message[]) {
    if (active.current || !configured) return;
    const controller = new AbortController();
    active.current = controller;
    const id = crypto.randomUUID();
    setMessages([...history, { id, role: "assistant", content: "" }]);
    setBusy(true);
    setError("");
    setNotice("");
    nearBottom.current = true;
    let answer = "";
    let finished = false;
    const update = (state?: Message["state"]) => {
      if (active.current !== controller) return;
      setMessages([...history, { id, role: "assistant", content: answer, state }]);
    };
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        let code = "provider_unavailable";
        try { code = (await response.json()).error ?? code; } catch { /* Keep safe fallback. */ }
        throw new Error(code);
      }
      if (!response.body) throw new Error("stream_failed");
      for await (const event of readNDJSON(response.body)) {
        if (controller.signal.aborted || active.current !== controller) return;
        if (event.type === "error") throw new Error(event.code);
        if (event.type === "delta") { answer += event.text; update(); }
        if (event.type === "done") {
          finished = true;
          update(event.truncated ? "truncated" : "complete");
          break;
        }
      }
      if (!finished) throw new Error("stream_failed");
    } catch (cause) {
      if (active.current !== controller) return;
      if (controller.signal.aborted) update("stopped");
      else {
        update("failed");
        setError(cause instanceof Error && errors[cause.message] ? cause.message : "stream_failed");
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
        textarea.current?.focus();
      }
    }
  }

  function submit() {
    if (busy || !draft.trim() || !configured || contextTooLong || retryable) return;
    const history: Message[] = [...messages, { id: crypto.randomUUID(), role: "user", content: draft.trim() }];
    setDraft("");
    void generate(history);
  }
  function stop() { active.current?.abort(); }
  function newChat() {
    if (messages.length && !window.confirm(t("Clear this conversation? It cannot be restored.", "清空当前对话？清空后无法恢复。"))) return;
    active.current?.abort(); active.current = null;
    setMessages([]); setBusy(false); setError(""); setDraft(""); setNotice("");
    textarea.current?.focus();
  }
  function keepPartial() {
    if (!last?.content.trim()) return;
    // Long output cannot be sent back unchanged because each message is capped.
    if (last.content.length > 8000) { setNotice(t("This reply is too long to reuse as context. Copy it and start a new chat.", "回复过长，无法继续作为上下文，请复制后新建对话。")); return; }
    setMessages(items => items.map(m => m.id === last.id ? { ...m, state: "complete" } : m));
    setError("");
  }
  async function copy(message: Message) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(""), 2000);
    } catch { setNotice(t("Copy failed. Please select and copy the text manually.", "复制失败，请选中文字手动复制。")); }
  }

  return <div className="chat-app">
    <aside className="chat-sidebar">
      <Link className="chat-brand" href={`/${locale}?mode=minimal`}><span className="chat-brand-mark">a</span><span>AI Global Toolkit<small>{t("A little help. A lot of possibilities.", "一点帮助，更多可能。")}</small></span></Link>
      <button className="chat-new" onClick={newChat}><span aria-hidden="true">＋</span>{t("New chat", "新建对话")}</button>
      <div className="chat-side-label">{t("YOUR WORKSPACE", "你的工作空间")}</div>
      <div className="chat-active"><span aria-hidden="true">◉</span> {t("AI Chat", "AI 聊天")} <span className="chat-beta">BETA</span></div>
      <p className="chat-local-note">{t("Your conversation stays in this tab. Refreshing or leaving clears it.", "对话仅保留在当前页面，刷新或离开后清空。")}</p>
      <div className="chat-sidebar-bottom"><Link href={`/${locale}?mode=minimal`}>← {t("Explore all tools", "浏览全部工具")}</Link><Link href="/account">{t("Sign in / Account", "登录 / 账户")} ↗</Link><div className="chat-language"><strong>{zh ? "中文" : "English"}</strong><Link href={`/${zh ? "en" : "zh"}/tools/ai-chat`}>{zh ? "English" : "中文"} ↗</Link></div></div>
    </aside>

    <main className="chat-main">
      <header className="chat-header"><Link className="chat-mobile-back" href={`/${locale}?mode=minimal`} aria-label={t("Back to tools", "返回工具目录")}>←</Link><div><span className="chat-model-dot" />DeepSeek <span className="chat-header-tag">{t("Everyday assistant", "日常助手")}</span></div><button className="chat-mobile-new" onClick={newChat}>{t("New chat", "新建对话")} ＋</button><Link className="chat-header-language" href={`/${zh ? "en" : "zh"}/tools/ai-chat`}>{zh ? "EN" : "中文"}</Link></header>
      {!configured && <div className="chat-config" role="status">{t("Preview · Chat will be available once the DeepSeek API key is configured.", "界面预览 · 配置 DeepSeek API 密钥后即可开始聊天。")}</div>}
      <div className="chat-scroll" onScroll={event => { const el = event.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}>
        {messages.length === 0 ? <section className="chat-welcome">
          <div className="chat-spark" aria-hidden="true">✳</div><div className="chat-eyebrow">{t("A SPACE TO THINK, WRITE & EXPLORE", "思考、写作与探索的空间")}</div>
          <h1>{t("What’s on your mind?", "今天，想聊点什么？")}</h1><p>{t("A rough idea, a tricky question, a blank page. Start anywhere.", "一个模糊的想法，一个棘手的问题，或者一张白纸。从这里开始。")}</p>
          <div className="chat-suggestions">{[
            { icon: "✎", title: t("Find the right words", "找到合适的表达"), subtitle: t("Turn a rough draft into a clear message", "把零散想法变成清晰的文字"), prompt: t("Help me rewrite a message to sound clear and friendly. Ask me to paste my draft first.", "帮我把一段消息改写得清晰、友好。请先让我提供草稿。") },
            { icon: "◈", title: t("Make sense of something", "理解一个新概念"), subtitle: t("Break a complex idea into simple terms", "用简单的语言解释复杂的问题"), prompt: t("I want to understand a complex topic. Ask me which topic, then explain it with a simple example.", "我想理解一个复杂概念。请先问我是什么概念，然后用简单例子解释。") },
            { icon: "↗", title: t("Explore an idea", "一起探索想法"), subtitle: t("A fresh perspective to get you moving", "换个角度，找到下一步"), prompt: t("Help me brainstorm an idea. Start by asking what I’m working on and what I want to achieve.", "帮我梳理一个想法。先问我在做什么，以及我想达到什么目标。") },
          ].map(item => <button key={item.title} onClick={() => { setDraft(item.prompt); textarea.current?.focus(); }}><span className="chat-suggestion-icon" aria-hidden="true">{item.icon}</span><strong>{item.title}</strong><span>{item.subtitle}</span><span className="chat-suggestion-arrow" aria-hidden="true">↗</span></button>)}</div>
        </section> : <div className="chat-messages" role="log" aria-label={t("Conversation", "聊天记录")} aria-live="off">{messages.map((message, i) => <article key={message.id} className={`chat-message chat-message-${message.role}`}>
          <div className="chat-message-label">{message.role === "user" ? t("You", "你") : <><span className="chat-mini-spark" aria-hidden="true">✳</span> DeepSeek</>}</div>
          <div className="chat-message-text">{message.content || (busy && i === messages.length - 1 ? <span className="chat-thinking">{t("Thinking", "正在思考")}<span>···</span></span> : t("No reply received.", "尚未收到回复。"))}</div>
          {message.role === "assistant" && <div className="chat-message-actions">{message.content && <button onClick={() => void copy(message)} disabled={busy && i === messages.length - 1}>{copied === message.id ? t("Copied ✓", "已复制 ✓") : t("Copy", "复制")}</button>}{message.state === "stopped" && <span>{t("Stopped", "已停止")}</span>}{message.state === "failed" && <span>{t("Reply interrupted", "回复未完成")}</span>}{message.state === "truncated" && <span>{t("Reply reached the output limit", "回复已达到长度上限")}</span>}</div>}
        </article>)}</div>}
        <div ref={bottom} className="chat-bottom-anchor" />
      </div>
      <div className="chat-compose-area">
        {error && <div className="chat-error" role="alert">{errors[error]?.[zh ? 1 : 0]}{error === "sign_in_required" && <> <a href="/auth/login" target="_blank" rel="noopener noreferrer">{t("Sign in ↗", "前往登录 ↗")}</a></>}</div>}
        {notice && <p className="chat-notice" role="status">{notice}</p>}
        {!busy && retryable && <div className="chat-recovery"><button onClick={() => void generate(messages.slice(0, -1))}>{t("Retry last message", "重试最后一条消息")}</button>{last.content.trim() && <button onClick={keepPartial}>{t("Continue with this reply", "保留此回复并继续")}</button>}</div>}
        {contextTooLong && !retryable && <p className="chat-notice">{t("This conversation has reached its context limit. Start a new chat to continue.", "对话已达到上下文上限，请新建对话继续。")}</p>}
        <form className="chat-composer" onSubmit={event => { event.preventDefault(); submit(); }}>
          <label className="chat-sr-only" htmlFor="chat-input">{t("Your message", "你的消息")}</label>
          <textarea ref={textarea} id="chat-input" value={draft} maxLength={8000} rows={3} placeholder={t("Ask anything, or try an idea above…", "问点什么，或者试试上面的灵感…")} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
          <div className="chat-compose-bottom"><span><span className="chat-model-dot" />DeepSeek <span className="chat-keyboard-hint">· {t("Shift + Enter for a new line", "Shift + Enter 换行")}</span></span><div><span className="chat-char-count">{draft.length > 6000 ? `${draft.length}/8000` : ""}</span>{busy ? <button type="button" className="chat-send chat-stop" onClick={stop} aria-label={t("Stop generating", "停止生成")}>■</button> : <button type="submit" className="chat-send" disabled={!draft.trim() || !configured || contextTooLong || !!retryable} aria-label={t("Send message", "发送消息")}>↑</button>}</div></div>
        </form>
        <p className="chat-disclaimer" aria-live="polite">{busy ? t("Generating a reply…", "正在生成回复…") : t("Sign-in required. Messages are sent to DeepSeek. AI can make mistakes.", "需登录使用。消息会发送给 DeepSeek，AI 回答可能有误。")}</p>
      </div>
    </main>
  </div>;
}
