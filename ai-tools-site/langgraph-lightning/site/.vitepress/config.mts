import { defineConfig } from 'vitepress'
import { loadEnv } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url))
const siteRoot = path.resolve(here, '..')
const map = JSON.parse(fs.readFileSync(path.join(siteRoot, 'translation-map.json'), 'utf8')) as Record<string, string>
const env = loadEnv('production', process.cwd(), '')
const siteOrigin = (env.NEXT_PUBLIC_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : env.VERCEL_URL ? `https://${env.VERCEL_URL}` : '')).replace(/\/$/, '')
const reverseMap = Object.fromEntries(Object.entries(map).map(([en, zh]) => [zh, en])) as Record<string, string>
const pageRoute = (page: string) => {
  const route = `/${page.replace(/\.md$/, '')}`.replace(/(^|\/)index$/, '$1')
  return route
}
const enSidebar = Object.keys(map).reduce((acc, url) => {
  const moduleName = url.split('/')[1]
  let group = acc.find((item) => item.text === moduleName.replace('module-', 'Module '))
  if (!group) { group = { text: moduleName.replace('module-', 'Module '), collapsed: false, items: [] }; acc.push(group) }
  const page = path.join(siteRoot, `${url.slice(1)}.md`)
  const title = fs.readFileSync(page, 'utf8').match(/^#\s+(.+)$/m)?.[1] || path.basename(page, '.md')
  group.items.push({ text: title, link: url })
  return acc
}, [] as Array<{text:string;collapsed:boolean;items:Array<{text:string;link:string}>}>)
const zhSidebar = [0,1,2,3,4,5,6].map((n) => {
  const dir = path.join(siteRoot, 'zh', `module-${n}`)
  const items = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((file) => {
    const slug = file.slice(0, -3)
    const title = fs.readFileSync(path.join(dir, file), 'utf8').match(/^#\s+(.+)$/m)?.[1] || slug
    return { text: title, link: `/zh/module-${n}/${slug}` }
  })
  return { text: `第 ${n} 章`, collapsed: false, items }
}).filter((group) => group.items.length)
export default defineConfig({
  outDir: '../../public/learn/langgraph', base: '/learn/langgraph/', cleanUrls: true,
  title: 'LangGraph Lightning', description: 'A practical, chapter-by-chapter guide to building with LangGraph.',
  locales: {
    root: { label: 'English', lang: 'en-US', title: 'LangGraph Lightning', description: 'A practical guide to building with LangGraph.', themeConfig: {
      nav: [{text:'Home',link:'/'},{text:'Start learning',link:'/module-0/0.0-LangGraph'},{text:'中文',link:'/zh/'},{text:'Source & license',link:'/SOURCE_NOTICE'}], sidebar: enSidebar,
      outline:{label:'On this page',level:[2,3]}, docFooter:{prev:'Previous',next:'Next'}, search:{provider:'local'},
      footer:{message:'English translation of community learning materials. MIT licensed.',copyright:'Based on work by Wang Jixing (Bryce Wang). Not an official LangChain publication.'}
    }},
    zh: { label:'简体中文',lang:'zh-CN',title:'LangGraph 光速上手',description:'LangGraph 分章节学习与实践指南。',themeConfig:{
      nav:[{text:'首页',link:'/zh/'},{text:'开始学习',link:'/zh/module-0/0.0-LangGraph-快速案例'},{text:'English',link:'/'},{text:'来源与许可证',link:'/SOURCE_NOTICE'}],sidebar:zhSidebar,
      outline:{label:'本页目录',level:[2,3]},docFooter:{prev:'上一页',next:'下一页'},search:{provider:'local',options:{translations:{button:{buttonText:'搜索',buttonAriaLabel:'搜索文档'},modal:{noResultsText:'未找到相关结果',resetButtonTitle:'清除搜索内容',footer:{selectText:'选择',navigateText:'切换',closeText:'关闭'}}}}},
      footer:{message:'内容基于 MIT 许可证发布；版权归原作者所有。',copyright:'原作者：王几行XING（Bryce Wang）。非 LangChain 官方出版物。'}
    }}
  },
  head:[['meta',{name:'author',content:'Wang Jixing (Bryce Wang)'}],['meta',{name:'keywords',content:'LangGraph, LangChain, AI agents, Python, tutorial'}],['link',{rel:'icon',href:'/learn/langgraph/logo.svg'}]],
  transformHead({ page, head }) {
    if (!siteOrigin) return head
    const route = pageRoute(page)
    const canonical = `${siteOrigin}/learn/langgraph${route === '/' ? '/' : route}`
    const alternate = route === '/' ? '/zh/' : route === '/zh/' ? '/' : map[route] ?? reverseMap[route]
    const tags = [['link', { rel: 'canonical', href: canonical }]] as Array<[string, Record<string, string>]>
    if (alternate) {
      const englishRoute = route.startsWith('/zh/') ? alternate : route
      const chineseRoute = route.startsWith('/zh/') ? route : alternate
      tags.push(['link', { rel: 'alternate', hreflang: 'en', href: `${siteOrigin}/learn/langgraph${englishRoute}` }])
      tags.push(['link', { rel: 'alternate', hreflang: 'zh-CN', href: `${siteOrigin}/learn/langgraph${chineseRoute}` }])
      tags.push(['link', { rel: 'alternate', hreflang: 'x-default', href: `${siteOrigin}/learn/langgraph${englishRoute}` }])
    }
    return [...head, ...tags]
  },
  themeConfig:{search:{provider:'local'},logo:'/logo.svg',socialLinks:[{icon:'github',link:'https://github.com/memristors/langgraph-lightning'}]},
  markdown:{lineNumbers:true,theme:{light:'github-light',dark:'github-dark'}}
})
