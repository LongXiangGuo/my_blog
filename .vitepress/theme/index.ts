import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import AsidePager from './components/AsidePager.vue'
import Comment from './components/Comment.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'aside-outline-after': () => h(AsidePager),
      'doc-footer-before': () => h(Comment)
    })
  }
}
