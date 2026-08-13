import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { sidebar, nav } from './sidebar.generated.mts'

// base 通过环境变量 VITEPRESS_BASE 控制，兼容两种部署目标：
// - COS 部署（默认）：/blog/（与 .env.cos 的 KEY_PREFIX 保持一致）
// - GitHub Pages：/my_blog/（仓库名，由 .github/workflows/deploy.yml 注入）
const base = process.env.VITEPRESS_BASE || '/blog/'

export default withMermaid(defineConfig({
  title: 'Hardware Notes',
  description: '跨平台硬件接入与协议文档',
  base,
  // 静态托管时不会做「无后缀 -> .html」重写，
  // 必须关闭 cleanUrls，否则子页面会 404。
  cleanUrls: false,
  mermaid: {
    theme: 'default'
  },
  markdown: {
    config(md) {
      const originInlineCode = md.renderer.rules.code_inline
      md.renderer.rules.code_inline = (tokens, idx, opts, env, self) => {
        tokens[idx].attrSet('v-pre', '')
        if (originInlineCode) {
          return originInlineCode(tokens, idx, opts, env, self)
        }
        // fallback 默认渲染逻辑
        return self.renderToken(tokens, idx, opts)
      }
    }
  },
  themeConfig: {
    nav,
    search: {
      provider: 'local'
    },
    sidebar
  }
}))