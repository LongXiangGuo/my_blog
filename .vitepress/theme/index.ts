import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import AsidePager from './components/AsidePager.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'aside-outline-after': () => h(AsidePager)
    })
  }
}
