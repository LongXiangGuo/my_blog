<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

const { page, theme, frontmatter } = useData()

function ensureStartingSlash(p: string) {
  return p.startsWith('/') ? p : '/' + p
}

function normalize(p: string) {
  return decodeURI(p)
    .replace(/[?#].*$/, '')
    .replace(/(index)?\.(md|html)$/, '')
}

function isActive(currentPath: string, matchPath?: string) {
  if (matchPath === undefined) return false
  return normalize('/' + currentPath) === normalize(matchPath)
}

function getSidebar(): any[] {
  const sidebar: any = theme.value.sidebar
  const path = ensureStartingSlash(page.value.relativePath)
  if (Array.isArray(sidebar)) return sidebar
  if (sidebar == null) return []
  const dir = Object.keys(sidebar)
    .sort((a, b) => b.split('/').length - a.split('/').length)
    .find((d) => path.startsWith(ensureStartingSlash(d)))
  const s = dir ? sidebar[dir] : []
  return Array.isArray(s) ? s : (s.items || [])
}

function flatten(items: any[]): { text: string; link: string }[] {
  const links: { text: string; link: string }[] = []
  const rec = (arr: any[]) => {
    for (const item of arr) {
      if (item && item.text && item.link) links.push({ text: item.text, link: item.link })
      if (item && item.items) rec(item.items)
    }
  }
  rec(items)
  return links
}

const pager = computed(() => {
  const links = flatten(getSidebar())
  const index = links.findIndex((l) => isActive(page.value.relativePath, l.link))

  const prev = index > 0 ? links[index - 1] : null
  const next = index >= 0 && index < links.length - 1 ? links[index + 1] : null

  return { prev, next }
})
</script>

<template>
  <div v-if="pager.prev || pager.next" class="aside-pager">
    <p class="aside-pager__title">快速导航</p>
    <a v-if="pager.prev" class="pager-item pager-item--prev" :href="pager.prev.link">
      <span class="pager-item__label">← 上一篇</span>
      <span class="pager-item__text">{{ pager.prev.text }}</span>
    </a>
    <a v-if="pager.next" class="pager-item pager-item--next" :href="pager.next.link">
      <span class="pager-item__label">下一篇 →</span>
      <span class="pager-item__text">{{ pager.next.text }}</span>
    </a>
  </div>
</template>

<style scoped>
.aside-pager {
  margin-top: 24px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.aside-pager__title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.pager-item {
  display: block;
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  background: var(--vp-c-bg);
  transition: border-color 0.25s, background-color 0.25s;
}

.pager-item:last-child {
  margin-bottom: 0;
}

.pager-item:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-mute);
  text-decoration: none;
}

.pager-item__label {
  display: block;
  font-size: 11px;
  color: var(--vp-c-brand-1);
  font-weight: 500;
}

.pager-item__text {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  color: var(--vp-c-text-1);
  line-height: 1.4;
}

.pager-item--next .pager-item__label {
  color: var(--vp-c-green-1);
}
</style>
