# Vue.js 深度解析：架构设计、实现原理、工作流程、调用栈、设计模式

## 一、整体架构设计
Vue3 采用**模块化单体 + 包拆分（Monorepo）**架构，源码仓库按功能拆分为独立包，各包低耦合，可单独导入使用，符合渐进式框架思想。

### 源码包分层（monorepo/packages）
| 包                   | 作用                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| `vue`                | 完整构建产物，把 runtime + compiler 打包，直接用于浏览器                 |
| `@vue/runtime‑dom`   | DOM 平台渲染层，浏览器 DOM API 适配                                      |
| `@vue/runtime‑core`  | **核心运行时**，与平台无关；组件、vnode、diff、patch、生命周期全部在这里 |
| `@vue/compiler‑core` | 模板编译器核心，与平台无关，parse/transform/codegen                      |
| `@vue/compiler‑dom`  | DOM 模板编译，处理 v‑bind、v‑on 等 DOM 指令                              |
| `@vue/reactivity`    | **响应式模块**，Proxy 实现，可脱离 Vue 单独使用                          |
| `@vue/compiler‑sfc`  | 单文件组件 `.vue` 编译器，解析 template/script/style                     |
| `@vue/shared`        | 公共工具函数、常量、类型判断，全包共享                                   |

### 整体分层模型
1. **应用层**：用户业务代码（SFC组件、script‑setup、Options API）
2. **编译层 Compiler**：把模板字符串 → AST → 渲染函数 `render()`
3. **响应式层 Reactivity**：数据劫持、依赖收集、触发更新
4. **运行时层 Runtime‑Core**：组件实例、虚拟DOM、diff、patch、生命周期调度
5. **平台适配层 Runtime‑Dom**：封装浏览器 DOM API；可替换为其他平台（SSR、Native）

> 架构设计目标：**平台无关、编译与运行时解耦、模块可独立复用、支持运行时编译/预编译两种模式**。
> - 预编译：构建阶段 vite/webpack 编译模板为 render 函数，浏览器只加载 runtime，体积更小；
> - 运行时编译：浏览器内实时编译模板，用于 CDN 直接引入场景。

---

## 二、核心模块实现原理与完整工作流程
完整流程：**创建应用实例 → 解析组件 → 模板编译 → 创建组件实例 → setup执行 → 响应式代理数据 → 生成VNode → patch渲染真实DOM → 数据变更触发更新 → diff对比 → patch打补丁更新DOM → 组件卸载**

### 2.1 响应式系统（`@vue/reactivity`）
#### Vue2：`Object.defineProperty`
- 劫持对象已有属性的 get/set；
- 缺陷：无法监听新增/删除属性；不支持数组下标修改；只能对象属性，不支持 Map/Set。

#### Vue3：Proxy + Reflect
核心类型：
1. `reactive`：代理对象，返回响应式Proxy
2. `ref`：包装基础类型，内部包一层对象 `.value`
3. `computed`：计算属性，带缓存的响应式派生值
4. `effect`：副作用函数，依赖收集与触发更新底层API

##### 响应式完整流程
1. **依赖收集（get阶段）**
当访问响应式数据，触发 Proxy get 捕获器：
- 当前正在执行的 `effect`（副作用）存入 `activeEffect`；
- 在 `targetMap`（WeakMap）建立：`target对象 → key → dep(Set集合)`；
- 将 `activeEffect` 添加进 dep，完成收集。

2. **触发更新（set阶段）**
修改响应式数据触发 Proxy set：
- 通过 target、key 找到对应的 dep；
- 遍历 dep 内部所有 effect，执行调度触发更新。

> 关键：`Dep` 就是保存副作用的集合；`effect` 是要重新执行的函数；`track` 收集依赖，`trigger` 触发更新。

> 计算属性 `computed`：内部是一个特殊 effect，`lazy:true`，不立即执行；只有读取时才执行；同时有缓存，依赖不变直接返回旧值。

> 侦听器 `watch`：内部基于 effect，监听指定数据源，数据变化执行回调。

### 2.2 模板编译器 Compiler
输入：模板字符串 `<div>{{msg}}</div>`
输出：渲染函数 `render()`，返回VNode。

三个核心阶段：`parse → transform → codegen`
1. **Parse（解析）**
将 HTML 模板字符串解析生成 **AST抽象语法树**。处理标签、文本、插值、注释；生成节点 type、tag、props、children。

2. **Transform（转换）**
遍历 AST，对节点做转换：
- 处理插值 `{{xxx}}`；
- 处理指令 `v‑if/v‑for/v‑bind/v‑on`；
- 优化静态节点，标记 `static`，给后续渲染做优化；
- `v‑if` 转为条件分支，`v‑for` 转为循环；
- SFC中识别 `<script setup>` 语法糖。

3. **Codegen（代码生成）**
遍历转换后的 AST，拼接 JS 代码，生成渲染函数。
示例模板：
```html
<div>{{count}}</div>
```
编译输出伪代码：
```js
function render(_ctx, _cache) {
  return _createVNode("div", null, _ctx.count)
}
```

> 重要：`<script setup>` 是编译期语法糖，不是运行时API；编译器把顶层变量自动绑定到渲染上下文，无需手动 return。

### 2.3 运行时核心 Runtime‑Core
#### 1）组件实例 ComponentInstance
每个组件对应一个实例对象 `ComponentInternalInstance`，保存：
- 组件类型、vnode、父实例、子实例；
- setup返回值、代理后的响应式状态；
- 生命周期钩子队列；
- 渲染副作用 `renderEffect`；
- props、slots。

创建组件实例后执行 `setup()`（组合式API）；选项式API则解析`data/methods/computed/watch`做适配。

#### 2）虚拟DOM VNode
VNode 是普通JS对象，描述DOM节点信息：
```ts
interface VNode {
  type: string | Component; //标签名 /组件
  props: object | null;
  children: VNode[] | string;
  el: HTMLElement|null; //对应真实DOM
  shapeFlag: number; //标记节点类型：元素/组件/文本/Portal/Suspense
}
```

`createVNode / h()` 用来创建VNode。VNode不持有DOM，只是描述。

#### 3）Patch & Diff（打补丁算法）
`patch` 函数：接收旧VNode、新VNode，对比差异，操作真实DOM。

patch分支逻辑：
1. 旧VNode不存在 → 执行挂载 `mount`，创建真实DOM；
2. 新VNode不存在 → 执行卸载 `unmount`，销毁DOM；
3. 新旧都存在：
   - 不同节点类型：直接卸载旧，挂载新；
   - 同类型节点：执行diff更新。

##### Diff核心策略（同层比较，不跨层级）
1. 先对比文本节点；
2. 元素节点对比props；
3. **子节点diff（最复杂）**
子节点三种场景：
- 旧子节点数组，新子节点数组 → **key的最长递增子序列算法**，最小移动DOM；
- 旧数组，新文本；旧文本，新数组；
- 简单清空重建。

> Vue3 Diff优化点：使用key + 最长递增子序列，最大化复用DOM节点；Vue2是双端对比。

#### 4）组件完整渲染流程
```
创建App → createApp()
→ mount("#app")
→ 创建根组件实例
→ 执行setup()
→ 建立renderEffect（渲染副作用，内部执行render函数）
→ 执行render函数得到VNode树
→ patch(vnode,null,container) 挂载DOM
```

##### 数据更新流程
1. 修改响应式数据，Proxy set 触发 `trigger`
2. 触发组件的 `renderEffect` 调度
3. 不是立即执行，进入微任务队列（`queueJob` 异步更新队列）
> 多次修改数据不会多次渲染，一轮事件循环只渲染一次。
4. 微任务阶段执行渲染副作用，重新调用 render 获取新VNode
5. patch，旧VNode vs 新VNode，diff，局部更新DOM。

> 异步更新队列：`nextTick` 就是等待这一轮微任务渲染完成。

### 2.4 生命周期原理
生命周期不是魔法，只是组件不同阶段执行回调函数队列。
组件实例上保存各个钩子数组，在mount/patch/unmount不同阶段依次调用。

执行顺序：
`setup()` → beforeCreate → created → beforeMount → render → mount DOM → mounted → 数据变化 beforeUpdate → 更新DOM → updated → beforeUnmount → unmounted

> 注意：`setup` 在 beforeCreate **之前执行**。

### 2.5 SFC单文件组件编译流程
`.vue` 文件不是浏览器原生识别，需要 compiler‑sfc：
1. 拆分 template / script / script‑setup / style；
2. template交给compiler‑dom编译为render函数；
3. script‑setup编译，变量提升、自动暴露上下文；
4. style处理 scoped 属性，给CSS添加属性选择器实现样式隔离。

---

## 三、关键场景代码调用栈（伪调用栈，便于理解）
### 场景1：首次挂载组件
```
createApp(App).mount('#app')
└─ createApp() 返回app实例
   └─ app.mount(rootContainer)
      └─ createVNode 创建根VNode
         └─ render(rootVNode, container) //来自runtime‑core/renderer
            └─ patch(null, rootVNode, container)
               └─ processComponent(n1=null, n2=根组件VNode)
                  └─ mountComponent()
                     ├─ createComponentInstance() //创建组件内部实例
                     ├─ setupComponent(instance)
                     │  ├─ initProps()
                     │  ├─ setupStatefulComponent()
                     │  │  └─ 执行 setup()
                     │  └─ 选项式API解析data/computed/methods
                     └─ setupRenderEffect(instance)
                        └─ new ReactiveEffect(componentUpdateFn) //renderEffect
                           └─ componentUpdateFn
                              ├─ 执行render() →生成VNode树
                              └─ patchChildren() 递归patch子VNode，生成DOM
```

### 场景2：修改响应式数据触发更新
```
count.value++
└─ Proxy set 捕获器
   └─ trigger(target, key)
      └─ 获取dep中保存的renderEffect
         └─ triggerEffect(renderEffect)
            └─ queueJob(renderEffect.run) //推入异步更新队列
               └─ Promise微任务，执行 renderEffect.run()
                  └─ componentUpdateFn()
                     ├─ render() 获取新VNode
                     └─ patch(旧VNode,新VNode)
                        └─ diff算法对比
                           └─ patchProps / patchChildren 局部更新DOM
```

### 场景3：effect依赖收集调用栈
```
const count = ref(0)
effect(()=> console.log(count.value))
└─ effect(fn)
   └─ createReactiveEffect(fn)
      └─ run()
         ├─ activeEffect = 当前effect
         └─ 执行用户fn →访问 count.value
            └─ ref get捕获器
               └─ track(target,key) //收集依赖，effect存入dep
```

---

## 四、Vue内部用到的设计模式
### 1. 观察者模式（Observer）
> 响应式系统核心。
- `Dep` 是发布者；`effect/watcher` 是观察者；
- 数据变化（发布），通知所有副作用执行更新。

### 2. 代理模式（Proxy Pattern）
- Vue3 使用原生 Proxy 对象代理原始对象，拦截 get/set，实现响应式。

### 3. 工厂模式
- `createVNode/h()`：VNode工厂函数，统一产出虚拟节点对象。
- `createApp()`：应用实例工厂。

### 4. 装饰器模式
- `effect` 的调度器 scheduler，包装原始副作用函数，实现异步队列、防抖调度，不修改原始逻辑。

### 5. 单例/实例模式
每个组件对应唯一 `ComponentInternalInstance` 实例对象，保存状态、钩子、上下文。

### 6. 策略模式
patch内部，根据VNode节点类型（元素/组件/文本/Portal/Suspense）执行不同处理分支，shapeFlag做类型标记。

### 7. 适配器模式
`runtime‑dom` 适配层，把runtime‑core抽象操作映射到浏览器DOM API；可以替换适配器支持SSR、移动端。实现跨平台。

### 8. 模板方法模式
组件生命周期，定义固定执行流程（mount‑update‑unmount），钩子留给用户自定义实现。

### 9. 组合模式
VNode树结构，父子VNode递归渲染；统一对待普通节点、组件节点，递归patch。

### 10. 享元模式
VNode内部大量复用常量、shapeFlag标记，减少对象重复创建开销；静态节点缓存优化。

### 11. 代理模式（Options API 上下文代理）
选项式API中组件实例做代理，访问`this.count`代理转发到`data`，简化用户访问。

---

## 五、Vue2与Vue3架构关键差异总结
1. **包组织**：Vue2整体单包；Vue3 monorepo模块化拆分，编译、响应式、运行时解耦。
2. **响应式**：Vue2 `Object.defineProperty`；Vue3 Proxy，支持Map/Set、新增属性。
3. **Diff算法**：Vue2双端比较；Vue3 key + **最长递增子序列**，子节点移动优化更强。
4. **API范式**：Options API（按选项划分） vs Composition API（按逻辑聚合）。
5. **编译**：Vue3编译器全量重写，静态提升、树抖动优化，减少运行时代码。
6. **模块可复用性**：Vue3 reactivity可以脱离框架单独使用。

## 六、关键性能优化底层原理（对应大纲最佳实践）
1. **静态提升**：编译器把不变的节点提升到渲染函数外，render多次执行不用重复创建VNode。
2. `v‑once` / `v‑memo`：编译/运行时标记子树跳过diff。
3. 异步更新队列：多次修改只一次渲染。
4. 代码分割：SFC + Vite实现组件懒加载，减小首屏bundle。
5. 虚拟滚动：只渲染可视区VNode，解决万级列表卡顿。

> 框架层面的优化，本质都是：**减少VNode创建数量、减少diff范围、减少真实DOM操作次数**。