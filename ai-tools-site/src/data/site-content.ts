export type Locale = "zh" | "en";
export type ThemeMode = "showcase" | "minimal";
export type ToolStage = "live" | "shipping" | "in_build";

export type ToolItem = {
  id: string;
  category: "image" | "content" | "growth" | "support";
  href?: string;
  name: string;
  stage: ToolStage;
  value: string;
  summary: string;
  tags: string[];
};

export type CaseItem = {
  title: string;
  region: string;
  result: string;
  detail: string;
};

export type OfferItem = {
  title: string;
  detail: string;
};

export type LocaleContent = {
  brand: string;
  nav: { tools: string; cases: string; offers: string; contact: string };
  headline: string;
  subheading: string;
  primaryCta: string;
  secondaryCta: string;
  metricsTitle: string;
  metrics: Array<{ label: string; value: string }>;
  toolsTitle: string;
  casesTitle: string;
  offersTitle: string;
  offersIntro: string;
  workflowTitle: string;
  workflow: string[];
  contactTitle: string;
  contactText: string;
  quickLinksTitle: string;
  quickLinks: Array<{ label: string; href: string }>;
  stageLabels: Record<ToolStage, string>;
  tools: ToolItem[];
  offers: OfferItem[];
  cases: CaseItem[];
};

export const siteConfig = {
  contactEmail: "382592406@qq.com",
  copyright: "AI Global Toolkit",
  copyrightYear: "2026",
};

export const contentByLocale: Record<Locale, LocaleContent> = {
  en: {
    brand: "AI Global Toolkit",
    nav: { tools: "Tools", cases: "Cases", offers: "Offers", contact: "Contact" },
    headline: "Build once, launch globally, iterate with AI every week.",
    subheading:
      "A conversion-focused showcase for your AI tools, real outcomes, and service offers. Drop new content in minutes and keep shipping.",
    primaryCta: "Book a Growth Call",
    secondaryCta: "View Live Tool Pipeline",
    metricsTitle: "Core growth metrics",
    metrics: [
      { label: "Average launch cycle", value: "72h" },
      { label: "Countries targeted", value: "20+" },
      { label: "Tool pages published", value: "40+" },
    ],
    toolsTitle: "Current AI Tool Stack",
    casesTitle: "Case Outcomes",
    offersTitle: "What You Can Launch With Us",
    offersIntro:
      "Choose one offer to start, then expand with weekly publishing cycles. Every block is content-driven so you can replace copy or sections quickly when a new AI asset is ready.",
    workflowTitle: "Publishing Workflow",
    workflow: [
      "Capture one source brief: audience, promise, proof.",
      "Generate page blocks, copy variants, and media prompts.",
      "Publish, track leads, and collect sales feedback.",
      "Recycle wins into the next week of content and pages.",
    ],
    contactTitle: "Ready to launch your AI growth website?",
    contactText:
      "Send your current offers, target market, and one successful asset. We will turn it into a publish-ready showcase structure you can keep scaling.",
    quickLinksTitle: "Quick links",
    quickLinks: [
      { label: "Pricing consultation", href: "#contact" },
      { label: "Tool pipeline", href: "#tools" },
      { label: "Case outcomes", href: "#cases" },
      { label: "Service offers", href: "#offers" },
      { label: "Workflow details", href: "#workflow" },
      { label: "Email us now", href: "#contact" },
    ],
    stageLabels: {
      live: "Live",
      shipping: "Shipping",
      in_build: "In Build",
    },
    tools: [
      {
        id: "ai-chat",
        category: "content",
        href: "/en/tools/ai-chat",
        name: "AI Chat · DeepSeek",
        stage: "in_build",
        value: "Think, write and explore with a conversational AI assistant.",
        summary: "Streaming text chat with DeepSeek. Sign-in and server API configuration required.",
        tags: ["Chat", "Writing", "DeepSeek"],
      },

      {
        id: "langgraph-learning",
        category: "content",
        href: "/learn/langgraph/",
        name: "LangGraph Lightning · Learning Guide",
        stage: "live",
        value: "Learn LangGraph through practical, chapter-based lessons.",
        summary: "Bilingual community learning site based on the LangGraph Lightning repository; English landing page with the original Chinese lessons.",
        tags: ["LangGraph", "AI agents", "Tutorial"],
      },
      {
        id: "hand-drawn-photo",
        category: "image",
        href: "/tools/hand-drawn-photo/",
        name: "AI Hand-drawn Photos",
        stage: "in_build",
        value: "Explore warm oil-pastel portraits of pets and their people.",
        summary: "Try two illustrations without an account. Sign-in and purchase are required afterward; payments are coming soon.",
        tags: ["Illustration", "Photo comparison", "Preview"],
      },
      {
        id: "pet-photo",
        category: "image",
        href: "/tools/pet-photo",
        name: "Pet Photos · 宠物照片",
        stage: "live",
        value: "Turn a pet photo into a personalized print, right in your browser.",
        summary: "Upload a photo, adjust the crop, add a name and export a PNG. No AI generation or cloud upload.",
        tags: ["Photos", "Print layouts", "PNG export"],
      },
      {
        id: "landing-generator",
        category: "growth",
        name: "Landing Generator",
        stage: "live",
        value: "Auto-builds multilingual tool pages with SEO blocks and CTA wiring.",
        summary:
          "Feeds product notes + customer language into a reusable launch template.",
        tags: ["SEO", "Localization", "Lead Gen"],
      },
      {
        id: "short-form-engine",
        category: "content",
        name: "Short-Form Engine",
        stage: "live",
        value:
          "Transforms one long-form idea into short videos, snippets, and threads.",
        summary:
          "Keeps channel voice consistent while adapting for platform constraints.",
        tags: ["Content Ops", "Video", "Distribution"],
      },
      {
        id: "offer-optimizer",
        category: "growth",
        name: "Offer Optimizer",
        stage: "shipping",
        value:
          "Tests headline-angle pairs and CTA copy based on intent segment.",
        summary:
          "Uses weekly win/loss signal to prioritize experiments with strongest upside.",
        tags: ["CRO", "Copy", "Experimentation"],
      },
      {
        id: "support-bot",
        category: "support",
        name: "Support Knowledge Bot",
        stage: "in_build",
        value: "Converts docs and tickets into instant customer-facing answers.",
        summary:
          "Captures unresolved questions to continuously update your help center.",
        tags: ["Support", "Knowledge Base", "Automation"],
      },
    ],
    offers: [
      {
        title: "MVP Showcase Setup",
        detail:
          "Fast first version for AI product pages, core proof sections, and contact funnel.",
      },
      {
        title: "Weekly Content Operations",
        detail:
          "Build and publish new tools, tutorials, and proof stories with repeatable workflow.",
      },
      {
        title: "Conversion Stack Upgrade",
        detail:
          "Strengthen positioning, on-page credibility, and CTA flow to improve lead quality.",
      },
    ],
    cases: [
      {
        title: "Automation Studio",
        region: "Southeast Asia",
        result: "3.2x qualified leads in 6 weeks",
        detail:
          "Rebuilt tool pages around buyer jobs and embedded trust signals near key decision points.",
      },
      {
        title: "Micro-SaaS Founder",
        region: "North America",
        result: "From 0 to first 18 paying users",
        detail:
          "Shipped lean SEO pages + short-form distribution loop using one source content stream.",
      },
      {
        title: "AI Agency Team",
        region: "Europe",
        result: "42% faster campaign launch",
        detail:
          "Standardized website blocks so every new offer can go live without design bottlenecks.",
      },
    ],
  },
  zh: {
    brand: "AI 出海工具站",
    nav: { tools: "工具", cases: "案例", offers: "服务", contact: "联系" },
    headline: "一次搭建，全球发布，用 AI 每周持续迭代。",
    subheading:
      "这是一个面向转化的 AI 工具展示站。你可以快速上新工具、沉淀案例成果，并持续承接咨询线索。",
    primaryCta: "预约增长咨询",
    secondaryCta: "查看工具上线管线",
    metricsTitle: "核心增长指标",
    metrics: [
      { label: "平均上线周期", value: "72小时" },
      { label: "目标国家地区", value: "20+" },
      { label: "已发布工具页", value: "40+" },
    ],
    toolsTitle: "当前 AI 工具栈",
    casesTitle: "案例结果",
    offersTitle: "你可以直接启动的合作方案",
    offersIntro:
      "先从一个服务包开始，再按周扩展内容发布。所有模块都可替换，方便你把新的 AI 成果快速上线。",
    workflowTitle: "内容发布工作流",
    workflow: [
      "先确定一个源 Brief：用户、承诺、证据。",
      "自动生成页面模块、文案变体与素材提示。",
      "上线发布并跟踪线索、收集销售反馈。",
      "把有效内容复用到下一周的页面和分发中。",
    ],
    contactTitle: "准备好启动你的 AI 出海增长站了吗？",
    contactText:
      "把你当前的服务内容、目标市场和一个已验证素材发给我们，我们会把它整理成可持续扩展的展示结构。",
    quickLinksTitle: "快速入口",
    quickLinks: [
      { label: "咨询合作方案", href: "#contact" },
      { label: "查看工具能力", href: "#tools" },
      { label: "查看案例成果", href: "#cases" },
      { label: "查看服务内容", href: "#offers" },
      { label: "查看工作流程", href: "#workflow" },
      { label: "直接邮件联系", href: "#contact" },
    ],
    stageLabels: {
      live: "已上线",
      shipping: "交付中",
      in_build: "开发中",
    },
    tools: [
      {
        id: "ai-chat",
        category: "content",
        href: "/zh/tools/ai-chat",
        name: "AI 聊天 · DeepSeek",
        stage: "in_build",
        value: "随时提问、写作和探索想法，和 AI 连续对话。",
        summary: "DeepSeek 流式文字聊天，需登录并配置服务端 API 密钥。",
        tags: ["聊天", "写作", "DeepSeek"],
      },

      {
        id: "langgraph-learning",
        category: "content",
        href: "/learn/langgraph/zh/",
        name: "LangGraph 光速上手",
        stage: "live",
        value: "通过分章节的实战教程学习 LangGraph。",
        summary: "基于 LangGraph Lightning 仓库整理的双语社区学习站，中文页面保留可读的上游 Markdown 原文。",
        tags: ["LangGraph", "AI Agent", "教程"],
      },

      {
        id: "hand-drawn-photo",
        category: "image",
        href: "/tools/hand-drawn-photo/",
        name: "AI 手绘照片生成",
        stage: "in_build",
        value: "把宠物和人与宠物合照，变成温暖的油画棒风格。",
        summary: "免登录试用 2 次，选择三种画风生成手绘；继续使用需登录并购买（支付待开放）。",
        tags: ["手绘", "照片对比", "案例预览"],
      },
      {
        id: "pet-photo",
        category: "image",
        href: "/tools/pet-photo",
        name: "宠物照片",
        stage: "live",
        value: "把喜欢的宠物照片，做成可以保存、打印的专属纪念照。",
        summary: "上传照片、调整裁切、添加名字，选择相框版式并导出 PNG。当前为本地照片编辑，不含 AI 生成。",
        tags: ["照片编辑", "相框排版", "PNG 导出"],
      },
      {
        id: "landing-generator",
        category: "growth",
        name: "落地页生成器",
        stage: "live",
        value: "自动生成多语言工具页，内置 SEO 模块和 CTA 线索入口。",
        summary: "把产品素材和用户表达方式，快速组合成可发布模板。",
        tags: ["SEO", "本地化", "线索转化"],
      },
      {
        id: "short-form-engine",
        category: "content",
        name: "短内容引擎",
        stage: "live",
        value: "把一篇长内容拆解为短视频脚本、短帖和分发文案。",
        summary: "在不同平台保持统一风格，同时适配平台规则和节奏。",
        tags: ["内容运营", "视频", "分发"],
      },
      {
        id: "offer-optimizer",
        category: "growth",
        name: "报价优化器",
        stage: "shipping",
        value: "针对不同意图人群测试标题角度和 CTA 文案组合。",
        summary: "按每周数据反馈，优先执行收益最高的实验方案。",
        tags: ["转化优化", "文案", "实验"],
      },
      {
        id: "support-bot",
        category: "support",
        name: "客服知识机器人",
        stage: "in_build",
        value: "把文档和工单沉淀为客户可直接查询的问答能力。",
        summary: "自动记录未解决问题，持续更新你的帮助中心内容。",
        tags: ["客服", "知识库", "自动化"],
      },
    ],
    offers: [
      {
        title: "MVP 展示站搭建",
        detail: "快速搭建第一版工具页、证明模块和联系漏斗，先完成上线。",
      },
      {
        title: "每周内容运营",
        detail: "持续产出并发布工具介绍、教程和案例内容，形成稳定增长节奏。",
      },
      {
        title: "转化链路升级",
        detail: "优化定位表达、信任信息和 CTA 路径，提升线索质量与成交效率。",
      },
    ],
    cases: [
      {
        title: "自动化工作室",
        region: "东南亚市场",
        result: "6 周内有效线索提升 3.2 倍",
        detail: "围绕买家任务重构工具页，并在关键决策位置补充信任证明。",
      },
      {
        title: "独立 SaaS 开发者",
        region: "北美市场",
        result: "从 0 到首批 18 位付费用户",
        detail: "通过轻量 SEO 页面 + 短内容分发闭环，快速完成冷启动验证。",
      },
      {
        title: "AI 代运营团队",
        region: "欧洲市场",
        result: "活动上线速度提升 42%",
        detail: "标准化页面模块后，每个新方案都能更快上线并进入测试。",
      },
    ],
  },
};
