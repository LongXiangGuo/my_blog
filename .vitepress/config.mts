import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { sidebar } from './sidebar.generated.mts'

export default withMermaid(defineConfig({
  title: 'Hardware Notes',
  description: '跨平台硬件接入与协议文档',
  cleanUrls: true,
  mermaid: {
    theme: 'default'
  },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: 'Android', link: '/android/1.coroutine.md' },
      { text: 'iOS', link: '/ios/basic/1.struct_vs_class_v1' },
      { text: 'OHOS', link: '/#content-map' },
      { text: 'Tools', link: '/#content-map' },
      { text: 'JS', link: '/#content-map' }
    ],
    search: {
      provider: 'local'
    },
    sidebar
  }
}))
