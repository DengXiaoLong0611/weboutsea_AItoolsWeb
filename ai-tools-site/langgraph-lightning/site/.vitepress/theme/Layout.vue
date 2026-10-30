<script setup lang="ts">
import { computed } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import pageMap from '../../translation-map.json'
const { lang } = useData()
const route = useRoute()
const target = computed(() => {
  const current = decodeURIComponent(route.path.replace(/^\/learn\/langgraph(?=\/|$)/, '')).replace(/\.html$/, '').replace(/\/$/, '') || '/'
  if (lang.value === 'zh-CN') {
    if (current === '/zh') return '/'
    const english = Object.entries(pageMap).find(([, zh]) => zh === current)
    return english?.[0] ?? '/'
  }
  if (current === '/') return '/zh/'
  return pageMap[current] ?? '/zh/'
})
const aiToolsHref = computed(() => lang.value === 'zh-CN' ? '/zh' : '/en')
const aiToolsLabel = computed(() => lang.value === 'zh-CN' ? 'AI 工具站' : 'AI tools')
const label = computed(() => lang.value === 'zh-CN' ? 'Read this page in English' : '阅读本页中文版')
</script>
<template>
  <DefaultTheme.Layout>
    <template #nav-bar-content-after>
      <a class="VPNavBarMenuLink tools-site-link" :href="aiToolsHref">{{ aiToolsLabel }}</a>
    </template>
    <template #nav-bar-menu-after>
      <a class="VPNavBarMenuLink tools-site-link" :href="aiToolsHref">{{ aiToolsLabel }}</a>
    </template>
    <template #doc-after>
      <p class="locale-page-link"><a :href="withBase(target)">{{ label }} →</a></p>
    </template>
  </DefaultTheme.Layout>
</template>
<style>
.tools-site-link { padding: 0 12px; color: var(--vp-c-text-1); font-size: 13px; font-weight: 500; }
.locale-page-link { margin: 32px 0 8px; padding: 16px 20px; border: 1px solid var(--vp-c-divider); border-radius: 10px; }
.locale-page-link a { color: var(--vp-c-brand-1); font-weight: 600; }
</style>
