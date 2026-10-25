"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { siteConfig, type Locale, type LocaleContent, type ToolItem } from "@/data/site-content";
import "./tool-directory.css";

type Category = "all" | ToolItem["category"];

export default function ToolDirectory({ locale, copy, onLocaleChange, onShowcase }: {
  locale: Locale;
  copy: LocaleContent;
  onLocaleChange: (locale: Locale) => void;
  onShowcase: () => void;
}) {
  const zh = locale === "zh";
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const categories: { id: Category; label: string }[] = [
    { id: "all", label: zh ? "全部工具" : "All tools" },
    { id: "image", label: zh ? "图片与设计" : "Images & design" },
    { id: "content", label: zh ? "内容创作" : "Content" },
    { id: "growth", label: zh ? "网站与增长" : "Web & growth" },
    { id: "support", label: zh ? "效率与客服" : "Productivity" },
  ];
  const needle = query.trim().toLocaleLowerCase();
  const filtered = copy.tools.filter(tool =>
    (category === "all" || tool.category === category) &&
    (!availableOnly || Boolean(tool.href)) &&
    (!needle || [tool.name, tool.value, tool.summary, ...tool.tags].join(" ").toLocaleLowerCase().includes(needle))
  );
  const readyCount = copy.tools.filter(tool => tool.href).length;

  return (
    <div className="directory">
      <header className="directory-header">
        <div className="directory-width directory-topbar">
          <Link href="/?mode=minimal" className="directory-brand">{copy.brand}<span>{zh ? "工具目录" : "Tool directory"}</span></Link>
          <div className="directory-switches">
            <Link href="/account" className="rounded-full border border-slate-500 px-3 py-2 text-sm">{locale === "zh" ? "登录 / 账户" : "Sign in / Account"}</Link>
            <div role="group" aria-label={zh ? "语言" : "Language"}>
              <button type="button" aria-pressed={zh} onClick={() => onLocaleChange("zh")}>中文</button>
              <button type="button" aria-pressed={!zh} onClick={() => onLocaleChange("en")}>English</button>
            </div>
            <div role="group" aria-label={zh ? "布局" : "Layout"}>
              <button type="button" onClick={onShowcase}>Showcase</button>
              <button type="button" aria-pressed="true">Minimal</button>
            </div>
          </div>
        </div>
        <nav className="directory-nav" aria-label={zh ? "工具分类" : "Tool categories"}>
          <div className="directory-width directory-nav-inner">
            {categories.map(item => <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}
            <a className="directory-contact" href={`mailto:${siteConfig.contactEmail}`}>{zh ? "联系与建议" : "Contact"}</a>
          </div>
        </nav>
      </header>

      <main className="directory-width directory-main" id="tools">
        <section className="directory-intro">
          <div><h1>{zh ? "发现工具，直接开始。" : "Find a tool. Make something."}</h1><p>{zh ? "把好用的工具放在一起，从一张宠物照片开始。" : "Useful tools in one place. Start with your favorite pet photo."}</p></div>
          <form className="directory-search" role="search" onSubmit={event => event.preventDefault()}>
            <label htmlFor="tool-search">{zh ? "搜索工具" : "Search tools"}</label>
            <div><input id="tool-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={zh ? "名称、用途或关键词" : "Name, task or keyword"} /><button type="submit">{zh ? "搜索" : "Search"}</button></div>
          </form>
        </section>

        <div className="directory-body">
          <section className="directory-results" aria-label={zh ? "工具列表" : "Tool list"}>
            <div className="directory-sectionbar"><h2>{categories.find(item => item.id === category)?.label}<span>{filtered.length}</span></h2><label className="directory-checkbox"><input type="checkbox" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)} />{zh ? "只看可使用" : "Available only"}</label></div>
            <div className="directory-grid" aria-live="polite" aria-atomic="false">
              {filtered.map(tool => <article className={`directory-tool ${tool.href ? "directory-tool-ready" : ""}`} key={tool.id}>
                {tool.id === "pet-photo" && <Link href={tool.href!} tabIndex={-1} aria-hidden="true" className="directory-tool-photo"><Image src="/tools/pet-photo/assets/demo/preview.webp" alt="" width={600} height={400} /><span>{zh ? "相框效果概念图" : "Frame styling concept"}</span></Link>}
                <div className="directory-tool-content">
                  <div className="directory-tool-meta"><span>{categories.find(item => item.id === tool.category)?.label}</span><span className={tool.href ? "directory-status-ready" : "directory-status-pending"}>{tool.href ? (zh ? "可使用" : "Available") : (zh ? "待接入" : "Not connected")}</span></div>
                  <h3>{tool.href ? <Link href={tool.href}>{tool.name}</Link> : tool.name}</h3>
                  <p>{tool.value}</p>
                  <div className="directory-tool-tags">{tool.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
                  <div className="directory-tool-bottom">{tool.href ? <><span>{zh ? "本地编辑 · 暂无 AI" : "Local editor · No AI yet"}</span><Link href={tool.href}>{zh ? "打开工具" : "Open tool"}<span aria-hidden="true"> →</span></Link></> : <span>{zh ? "介绍模板，尚无可用入口" : "Showcase template; no working tool yet"}</span>}</div>
                </div>
              </article>)}
            </div>
            {filtered.length === 0 && <div className="directory-empty"><h3>{zh ? "没有找到匹配的工具" : "No matching tools"}</h3><p>{zh ? "试试其他关键词，或清空筛选看看全部工具。" : "Try a different keyword or clear your filters."}</p><button type="button" onClick={() => { setQuery(""); setCategory("all"); setAvailableOnly(false); }}>{zh ? "清空筛选" : "Clear filters"}</button></div>}
          </section>

          <aside className="directory-sidebar">
            <section><h2>{zh ? "现在可以试试" : "Ready to try"}</h2><Link className="directory-sidebar-tool" href="/tools/pet-photo"><strong>{zh ? "宠物照片" : "Pet Photos"}</strong><span>{zh ? "照片 → 排版 → PNG" : "Photo → Layout → PNG"}</span><span className="directory-text-link">{zh ? "制作一张纪念照 →" : "Make a keepsake →"}</span></Link><p>{zh ? "当前有 " : "Currently "}{readyCount}{zh ? " 个工具可直接使用，其余条目为待接入的介绍模板。" : " working tool. Other entries are templates awaiting integration."}</p></section>
            <section><h2>{zh ? "使用小贴士" : "Good to know"}</h2><ul><li>{zh ? "无需注册，打开即可编辑。" : "No account needed."}</li><li>{zh ? "上传照片只在浏览器内处理。" : "Uploaded photos stay in your browser."}</li><li>{zh ? "下载后记得保存原始照片。" : "Keep your original photo after exporting."}</li></ul></section>
            <section><h2>{zh ? "一起完善工具站" : "Help shape the toolkit"}</h2><p>{zh ? "有想用的功能，或者遇到了问题？欢迎发邮件告诉我。" : "Have an idea or run into a problem? Send me a note."}</p><a className="directory-email" href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a></section>
          </aside>
        </div>
      </main>
      <footer className="directory-footer"><div className="directory-width"><span>© {siteConfig.copyrightYear} {copy.brand}</span><span>{zh ? "工具持续更新中" : "More tools on the way"}</span></div></footer>
    </div>
  );
}
