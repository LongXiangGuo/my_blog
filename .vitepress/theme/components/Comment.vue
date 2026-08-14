<template>
  <div class="giscus-container">
    <div ref="container"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'

const { isDark } = useData()
const container = ref<HTMLElement>()

const CONFIG = {
  repo: 'LongXiangGuo/my_blog',
  repoId: 'R_kgDOS8dm8w',
  category: 'General',
  categoryId: 'DIC_kwDOS8dm884DDVx7',
  mapping: 'pathname',
  strict: '0',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'bottom',
  lang: 'zh-CN',
}

function loadGiscus(theme: string) {
  if (!container.value) return
  // 清掉旧实例，避免主题切换时重复叠加
  container.value.innerHTML = ''

  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.async = true
  script.crossOrigin = 'anonymous'
  script.setAttribute('data-repo', CONFIG.repo)
  script.setAttribute('data-repo-id', CONFIG.repoId)
  script.setAttribute('data-category', CONFIG.category)
  script.setAttribute('data-category-id', CONFIG.categoryId)
  script.setAttribute('data-mapping', CONFIG.mapping)
  script.setAttribute('data-strict', CONFIG.strict)
  script.setAttribute('data-reactions-enabled', CONFIG.reactionsEnabled)
  script.setAttribute('data-emit-metadata', CONFIG.emitMetadata)
  script.setAttribute('data-input-position', CONFIG.inputPosition)
  script.setAttribute('data-theme', theme)
  script.setAttribute('data-lang', CONFIG.lang)
  container.value.appendChild(script)
}

onMounted(() => {
  loadGiscus(isDark.value ? 'dark' : 'light')
  watch(isDark, (dark) => loadGiscus(dark ? 'dark' : 'light'))
})
</script>

<style scoped>
.giscus-container {
  margin-top: 2rem;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 1.5rem;
}
</style>
