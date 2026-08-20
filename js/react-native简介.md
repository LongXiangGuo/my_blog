# React Native 从入门到精通：一份完整的学习与实践指南

> 本文整合了 React Native 开发所需的全部核心知识，从基础预备、环境搭建，到导航、状态管理、底层渲染原理，再到热更新、SwiftUI/Compose 集成，以及与 Cordova 的横向对比，为你呈现一条清晰的全栈进阶之路。

---

## 目录

1. [引言：为什么选择 React Native](#1-引言为什么选择-react-native)
2. [第一阶段：预备知识 —— 打好地基](#2-第一阶段预备知识--打好地基)
3. [第二阶段：环境搭建与第一个应用](#3-第二阶段环境搭建与第一个应用)
4. [第三阶段：核心组件与样式布局](#4-第三阶段核心组件与样式布局)
5. [第四阶段：导航管理 —— React Navigation 完全指南](#5-第四阶段导航管理--react-navigation-完全指南)
6. [第五阶段：状态管理 —— 从内置方案到专业库](#6-第五阶段状态管理--从内置方案到专业库)
7. [第六阶段：深入原理 —— JSX 如何变成原生视图](#7-第六阶段深入原理--jsx-如何变成原生视图)
8. [第七阶段：热更新与动态下发](#8-第七阶段热更新与动态下发)
9. [第八阶段：集成 SwiftUI / Jetpack Compose](#9-第八阶段集成-swiftui--jetpack-compose)
10. [第九阶段：技术选型对比 —— Cordova vs React Native](#10-第九阶段技术选型对比--cordova-vs-react-native)
11. [第十阶段：性能优化与最佳实践](#11-第十阶段性能优化与最佳实践)
12. [结语：走向精通之路](#12-结语走向精通之路)

---

## 1. 引言：为什么选择 React Native

React Native 是由 Meta（原 Facebook）开源的跨平台移动应用开发框架，它允许开发者使用 JavaScript 和 React 编写代码，同时生成在 iOS 和 Android 上运行的原生应用。与传统的 WebView 方案（如 Cordova）不同，React Native 不渲染 Web 内容，而是通过 JavaScript 驱动原生 UI 组件，从而实现接近原生应用的性能和体验。

- **跨平台复用**：一套代码可覆盖 iOS、Android，甚至 Web（通过 React Native for Web）。
- **原生体验**：最终渲染的是真正的 `UIView`（iOS）或 `View`（Android），交互和动效符合平台规范。
- **活跃生态**：背靠 React 生态，拥有丰富的第三方库和工具链。
- **热更新能力**：可通过 CodePush 等服务动态下发 JavaScript 代码，绕过应用商店审核。

无论你是前端开发者希望拓展移动端，还是原生开发者追求更高效率，React Native 都是一条值得投入的路径。

---

## 2. 第一阶段：预备知识 —— 打好地基

在正式接触 React Native 之前，必须牢固掌握以下前置技能：

### 2.1 JavaScript (ES6+) 核心语法
- 变量声明：`let`、`const`
- 箭头函数、模板字符串
- 解构赋值、展开运算符（`...`）
- 模块导入导出（`import`/`export`）

### 2.2 异步编程
React Native 应用大量依赖网络请求，因此必须熟练使用：
- `Promise` 与 `async/await`
- 网络请求库：`fetch` 或 `axios`

### 2.3 TypeScript（强烈推荐）
TypeScript 为 JavaScript 添加了静态类型系统，能显著提升代码可维护性和开发体验。现代 React Native 项目普遍采用 TS。

### 2.4 Git 版本控制
掌握基本的 Git 命令（`clone`、`add`、`commit`、`push`、`pull`）以及 GitHub/GitLab 流程。

### 2.5 React 核心概念
- **JSX 语法**：在 JavaScript 中嵌入 HTML 标记。
- **组件化**：函数组件与类组件，理解 `props` 和 `state`。
- **核心 Hooks**：
  - `useState`：管理组件内部状态。
  - `useEffect`：处理副作用（数据请求、订阅等）。
  - `useContext`：跨层级共享数据。
- **React 渲染流程**：虚拟 DOM、Diff 算法、协调（Reconciliation）。

> **建议**：在开始 RN 之前，先通过 React 官方文档或在线课程，用 Web 项目练习上述概念，做到心中有数。

---

## 3. 第二阶段：环境搭建与第一个应用

React Native 开发环境主要有两种选择：

### 3.1 Expo（推荐新手）
Expo 是一个框架和工具链，极大简化了开发流程。你无需安装 Android Studio 或 Xcode，即可在手机上通过 Expo Go 应用快速预览。

- **创建项目**：`npx create-expo-app my-app`
- **启动**：`cd my-app && npx expo start`
- **优势**：内置大量常用组件和 API，支持 OTA 热更新，官方文档丰富。
- **适用场景**：中小型应用、快速原型、学习阶段。

### 3.2 React Native CLI（原生 CLI）
适合需要深度定制原生代码或集成第三方原生 SDK 的复杂项目。

- **创建项目**：`npx react-native init my-app`
- **需要配置**：Android Studio（Android SDK）、Xcode（iOS，仅 macOS）。
- **优势**：完全控制原生层，可自由修改 Gradle 或 Podfile。

> **学习建议**：初学者从 Expo 起步，待熟悉核心概念后再逐步了解 CLI 的差异。

### 3.3 项目结构（Expo 典型）
```
my-app/
├── App.js               # 根组件
├── app.json             # 应用配置
├── assets/              # 图片、字体等资源
├── components/          # 可复用组件
├── screens/             # 页面组件
├── navigation/          # 导航配置
└── package.json
```

---

## 4. 第三阶段：核心组件与样式布局

React Native 提供了一套与 Web 类似但完全基于原生渲染的基础组件。

### 4.1 核心基础组件
| 组件           | 作用                       | 类比 HTML                       |
| -------------- | -------------------------- | ------------------------------- |
| `<View>`       | 容器，布局的基础           | `<div>`                         |
| `<Text>`       | 显示文本                   | `<span>` / `<p>`                |
| `<Image>`      | 显示图片                   | `<img>`                         |
| `<TextInput>`  | 文本输入框                 | `<input>`                       |
| `<ScrollView>` | 可滚动容器（适合少量内容） | `<div style="overflow:scroll">` |
| `<FlatList>`   | 高性能长列表（懒加载）     | 无直接类比                      |

### 4.2 样式与 Flexbox 布局
RN 使用 JavaScript 对象定义样式，属性采用驼峰命名（如 `backgroundColor`、`fontSize`）。默认布局模型为 **Flexbox**。

- **核心属性**：`flexDirection`（主轴方向）、`justifyContent`（主轴对齐）、`alignItems`（交叉轴对齐）、`flex`（权重）。
- **样式继承**：仅 `Text` 组件会继承父级样式，其他组件默认不继承。
- **StyleSheet**：推荐使用 `StyleSheet.create` 创建样式对象，提升性能和类型安全。

```jsx
import { StyleSheet, View, Text } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
});
```

### 4.3 处理用户交互
- `<Button>`：简单按钮，自带平台样式。
- `<TouchableOpacity>` / `<TouchableHighlight>`：可自定义按压效果。
- `<Pressable>`：更强大，支持多种交互状态。

---

## 5. 第四阶段：导航管理 —— React Navigation 完全指南

导航是移动应用的核心体验。React Navigation 是官方推荐的导航库，提供 Stack、Tab、Drawer 等常见导航器。

### 5.1 核心概念与导航器类型

| 导航器               | 行为                                 | 适用场景                       |
| -------------------- | ------------------------------------ | ------------------------------ |
| **Stack Navigator**  | 页面堆栈，后进先出（LIFO）           | 列表→详情，表单流程            |
| **Tab Navigator**    | 底部或顶部标签切换，所有页面同时挂载 | 主功能模块（首页、发现、我的） |
| **Drawer Navigator** | 侧边抽屉滑动菜单                     | 多层级菜单或设置入口           |

- **Stack 推荐使用 `@react-navigation/native-stack`**，它基于原生 `UINavigationController` 和 `FragmentManager`，性能优于纯 JS 实现。

### 5.2 工作流程与底层原理

React Navigation 完全由 JavaScript 驱动，不包含原生代码，但依赖 `react-native-screens`、`react-native-reanimated` 和 `react-native-gesture-handler` 实现高性能转场动画。

#### 运行时状态（Navigation State）
所有导航器的状态都存储为一个普通的 JavaScript 对象，例如 Stack 的状态：
```js
const state = {
  type: 'stack',
  key: 'stack-1',
  routeNames: ['Home', 'Profile'],
  routes: [
    { key: 'home-1', name: 'Home', params: { sort: 'latest' } },
    { key: 'profile-1', name: 'Profile' },
  ],
  index: 1,        // 当前聚焦的路由索引
};
```
用户执行 `navigate` 或 `goBack` 时，React Navigation 会分发 Action 更新此状态，然后重新渲染对应的屏幕组件。

#### 生命周期机制（与 Web 的本质区别）
- **Web**：页面切换会卸载（unmount）离开的页面，挂载（mount）新页面。
- **React Navigation**：**离开的页面保持挂载**（仅 Stack 会卸载栈顶之下的页面？实际上 Stack 默认会保留之前页面实例，返回时直接显示，不重新创建）。Tab 和 Drawer 的所有页面同时保持挂载。

这意味着你不能依赖 `useEffect` 的清理或组件挂载/卸载来判断页面可见性，必须使用导航提供的 **Focus/Blur 事件**。

#### 使用 Focus / Blur 事件
```jsx
import { useFocusEffect } from '@react-navigation/native';

function ProfileScreen() {
  useFocusEffect(
    React.useCallback(() => {
      // 页面获得焦点时执行（如刷新数据）
      fetchProfile();

      return () => {
        // 页面失去焦点时清理（如取消请求）
        // 注意：此清理会在失焦时立即执行，而非组件卸载时
      };
    }, [])
  );
  // ...
}
```
或者使用 `navigation.addListener('focus', handler)` 进行更细粒度的控制。

### 5.3 Static API（v7+）—— 更好的 TypeScript 支持

从 React Navigation 7 开始，官方引入了静态 API，通过配置对象而非 JSX 定义导航，自动推断类型并简化深度链接。

```js
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const RootStack = createNativeStackNavigator({
  screens: {
    Home: HomeScreen,
    Profile: ProfileScreen,
  },
});

// 自动推断 ParamList，无需手动声明
const Navigation = createStaticNavigation(RootStack);
```

### 5.4 Options 与原生参数映射

导航器选项（如 `title`、`headerStyle`）最终会映射到 iOS 和 Android 的原生 UI 控件。下表总结了常用选项的对应关系：

| Options 属性            | iOS 对应                              | Android 对应                        |
| ----------------------- | ------------------------------------- | ----------------------------------- |
| `title`                 | `navigationItem.title`                | `ActionBar.setTitle()`              |
| `headerStyle`           | `navigationBar.barTintColor`          | `ActionBar.setBackgroundDrawable()` |
| `headerTintColor`       | `navigationBar.tintColor`             | `ActionBar.setTitleTextColor()`     |
| `headerShown`           | `navigationBar.hidden`                | `ActionBar.hide()` / `show()`       |
| `presentation: 'modal'` | `modalPresentationStyle = .pageSheet` | `Window.setFlags()`（类似效果）     |

### 5.5 条件导航（认证流程）

React Navigation 不采用 Web 路由的“拦截器”模式，而是通过声明式 `if` 条件控制屏幕是否可用。当条件不满足时，屏幕从导航树中移除，用户无法导航到它。

```js
const RootStack = createNativeStackNavigator({
  screens: {
    Home: { if: useIsSignedIn, screen: HomeScreen },
    SignIn: { if: useIsSignedOut, screen: SignInScreen },
  },
});
```
登录后，`SignIn` 屏幕自动消失，`Home` 自动显示，无需手动 `navigate`。返回键也不会回退到登录页。

---

## 6. 第五阶段：状态管理 —— 从内置方案到专业库

React Native 应用的状态管理与 React Web 完全一致，但需要关注移动端特有的性能敏感点。

### 6.1 内置 Hooks：useState / useReducer

#### 底层原理：基于 Fiber 的 Hook 链表
每个函数组件对应一个 Fiber 节点，`fiber.memoizedState` 指向第一个 Hook，后续 Hook 通过 `next` 链接成单向链表。

- `useState` 返回的 `setState` 会将更新动作放入 `hook.queue` 中，然后触发调度（`scheduleUpdateOnFiber`）。
- React 通过 **Lane 模型** 区分更新优先级（如用户交互、数据请求）。
- 批处理：在合成事件中，多个 `setState` 会合并为一次渲染。

#### 闭包陷阱
每次渲染都会生成一个独立的闭包，捕获当前状态值。如果使用 `setState(newVal)` 直接替换，可能因过期值覆盖最新状态。**推荐使用函数式更新**：`setState(prev => prev + 1)`，确保基于最新值计算。

### 6.2 Context API —— 跨组件共享

- `createContext` 创建一个 Context 对象，包含 `Provider` 和 `Consumer`。
- Provider 通过 `value` 属性传递数据，内部使用 `pushProvider`/`popProvider` 维护值栈。
- 消费组件（`useContext`）会在 Fiber 的 `dependencies` 链表中注册该 Context，当 Provider 值变化时，React 仅更新注册了该 Context 的组件，跳过无关子树。

**性能提示**：Context 值变化会触发所有消费组件的重渲染，因此不适合高频变化的数据。建议结合 `useMemo` 缓存 value 对象。

### 6.3 全局状态库：Zustand / Redux Toolkit

当应用规模变大，跨组件共享和复杂业务逻辑需要更专业的方案。

- **Zustand**：轻量，基于外部 Store，通过选择器（selector）实现细粒度订阅，避免无用渲染。
- **Redux Toolkit**：遵循 Flux 单向流，强调不可变更新，配套 DevTools 强大。
- 选择建议：中小项目选 Zustand，大型团队项目选 Redux Toolkit。

### 6.4 服务器状态管理：TanStack Query（React Query）

React Query 是专门管理异步数据（网络请求）的库，它不替代全局状态，而是作为 **服务器状态的缓存层**。

#### 核心架构
- **QueryClient**：中央协调器，管理缓存和配置。
- **QueryCache**：以 `queryKey` 为键存储 Query 实例。
- **QueryObserver**：连接 Query 和 UI 组件，数据变化时通知重渲染。
- **策略**：Stale-While-Revalidate —— 优先返回缓存，后台自动重新获取。

#### 工作流程
1. `useQuery` 调用时，根据 `queryKey` 查找缓存。
2. 若有缓存且未过期（`staleTime`），直接返回。
3. 若缓存过期或无缓存，触发 `fetch`。
4. 请求过程中，状态（`status`）切换，成功或失败后更新缓存并通知观察者。

#### 关键能力
- **请求去重**：相同 `queryKey` 的并发请求复用同一个 Promise。
- **重试与取消**：内置重试机制，支持 `AbortSignal` 取消。
- **结构共享**：更新数据时尽可能保留对象引用，减少重渲染。

---

## 7. 第六阶段：深入原理 —— JSX 如何变成原生视图

这是理解 React Native 跨平台能力的关键。我们分为旧架构和新架构来讲解。

### 7.1 旧架构（Bridge 模式）

1. **JSX 编译**：打包时 Babel 将 JSX 转为 `React.createElement` 调用，生成虚拟 DOM。
2. **序列化与传递**：在 JavaScript 线程中，UI 操作（如创建 `View`）被序列化为 JSON 消息，通过 **异步 Bridge** 发送到原生端的 Shadow 线程。
3. **构建 Shadow Tree**：原生端反序列化，构建 **影子树（Shadow Tree）**，这是一棵轻量级的 UI 结构树，不包含具体视图。
4. **布局计算（Yoga）**：Shadow Tree 交由 Facebook 开源的 **Yoga 引擎** 进行 Flexbox 布局计算，得到每个节点的坐标和尺寸。
5. **生成原生视图**：布局结果传回 UI 线程，真正创建 `UIView`（iOS）或 `View`（Android）实例，并配置属性。

整个过程靠的是传递 **“指令”** —— 结构化 JSON 数据，例如：
```json
["createView", 343, "RCTView", 31, {"backgroundColor": -16181, "width": 200, "height": 200}]
```

#### “指令”到原生实例的映射
JavaScript 发送的视图名称（如 `"RCTView"`）需要在原生端有一个对应的视图管理器和视图类。映射关系在运行时建立：

- **iOS**：通过 `RCT_EXPORT_MODULE()` 宏注册 `RCTViewManager`，`RCTUIManager` 维护 `_componentDataByName` 字典。
- **Android**：通过 `ViewManagerRegistry` 维护 `Map<String, ViewManager>`。

当 `createView` 指令到达时，原生端根据 `viewName` 查找管理器，然后利用 **运行时反射**（Objective-C Runtime / Java 反射）动态创建 `UIView` 或 `View` 的实例。

**关键点**：指令只描述“创建什么视图”，并非底层的绘制指令（如 OpenGL 调用）。绘制由原生视图自身的 `drawRect:` 或 `onDraw` 完成。

### 7.2 新架构（Fabric + JSI）

- **JSI（JavaScript Interface）**：取代 Bridge，允许 JavaScript 与原生端直接同步调用，无序列化开销。
- **Fabric 渲染器**：将渲染工作转移到 C++ 层，支持并发渲染和优先级的精细控制。
- **TurboModules**：按需加载原生模块，减少启动时间。

新架构大幅提升了性能，尤其在启动速度和列表滚动方面。

---

## 8. 第七阶段：热更新与动态下发

React Native 支持 **热更新**（动态下发），核心是更新 **JavaScript Bundle** 文件（包含所有 JS 代码和静态资源）。

### 8.1 工作原理
- 应用由编译好的原生二进制（`App` 壳）和 JS Bundle 组成。
- 热更新工具（如 **CodePush**、**Expo Updates**）允许开发者将新 Bundle 推送到 CDN，客户端检测到更新后下载并替换本地的 Bundle，下次启动或重新加载时生效。

### 8.2 可更新与不可更新
- ✅ **可以更新**：JavaScript 代码（修复 Bug、调整 UI）、图片资源、配置文件。
- ❌ **不可更新**：任何涉及原生代码的修改（如 `AppDelegate.m`、添加新插件、修改 `build.gradle`），必须通过应用商店发布新版。

### 8.3 与 SwiftUI 的关系
如果应用中集成了 SwiftUI 组件，这些组件代码必须提前编译进二进制，无法通过热更新修改。RN 只能动态调用已存在的 SwiftUI 组件，无法动态下发新的 SwiftUI 代码。

---

## 9. 第八阶段：集成 SwiftUI / Jetpack Compose

React Native 新架构使得直接使用 SwiftUI（iOS）和 Jetpack Compose（Android）成为可能，这意味着开发者可以在 RN 应用中嵌入最新的原生 UI 框架。

### 9.1 核心思路：桥接而非转换
React Native 不将组件转换为 SwiftUI/Compose，而是提供 **桥接能力**，允许 JS 中直接使用 SwiftUI 或 Compose 组件。最终屏幕上渲染的是真正的 SwiftUI 或 Compose 视图。

### 9.2 实现方式
- **iOS**：所有 SwiftUI 组件必须包裹在 `<SwiftUI>` 根容器内，底层使用 `UIHostingController` 将 SwiftUI 视图嵌入 UIKit 容器。
- **Android**：所有 Compose 组件包裹在 `<Host>` 容器内。

工作流程：
1. 在 React 中声明 SwiftUI/Compose 组件（返回 `null`，不创建 RN 视图）。
2. 组件树结构和 props 被序列化传递至原生端。
3. 原生端直接使用 SwiftUI/Compose 渲染，布局和动画全由原生框架处理。

### 9.3 优势与限制
- **优势**：原生性能、平台真实性、即时使用新 API。
- **限制**：需要 RN 新架构、iOS 15.1+、不能将普通 RN 视图（`<View>`）嵌入到 SwiftUI/Compose 树中（两种体系隔离），只能通过根容器整合。

> 实践可通过 Expo 的 `@expo/ui` 或社区库（如 `@mgcrea/react-native-swiftui`）实现。

---

## 10. 第九阶段：技术选型对比 —— Cordova vs React Native

了解其他跨平台方案的优劣势，有助于你做出合理的技术决策。

### 10.1 Cordova 的核心架构

Cordova（原名 PhoneGap）是早期的混合应用框架，它直接将 Web 应用（HTML/CSS/JS）包装在原生 WebView 中，并通过插件桥接设备 API。

#### 工作流程
- **编译**：`cordova prepare` 复制 `www/` 资源到平台目录，`cordova compile` 调用 Gradle/Xcode 打包成 APK/IPA。
- **渲染**：完全由 WebView（Android WebView / iOS WKWebView）渲染 DOM，不转换为原生 UI。
- **交互**：JS 通过 Cordova 提供的插件 API（如相机、GPS）调用原生功能，通过回调返回结果。

### 10.2 Cordova vs React Native 详细对比

| 维度         | Cordova                  | React Native                       |
| ------------ | ------------------------ | ---------------------------------- |
| **渲染方式** | WebView 渲染 DOM         | 原生 UI 组件渲染                   |
| **性能**     | 中等，受 WebView 限制    | 高，接近原生                       |
| **UI 体验**  | Web 风格，难以与原生统一 | 原生风格，平台适配良好             |
| **原生能力** | 通过插件调用             | 通过原生模块（或 JSI）调用，更灵活 |
| **热更新**   | 支持（更新 Web 资源）    | 支持（更新 JS Bundle）             |
| **开发语言** | HTML/CSS/JS（任意框架）  | JavaScript/TypeScript + React      |
| **学习曲线** | 低（Web 开发者友好）     | 中（需学习 React 和 RN 概念）      |
| **社区生态** | 逐渐衰退，插件维护滞后   | 活跃，不断更新                     |
| **典型应用** | 内容展示、简单工具       | 高性能应用、复杂交互               |

### 10.3 何时选择 Cordova
- 对 UI 性能要求不高，且团队 Web 技术深厚。
- 需要快速将现有 Web 应用转为移动 App。
- 项目是短期原型或内部工具。

### 10.4 现代替代方案
- **Capacitor**（Ionic 团队）：Cordova 的现代替代，API 更优雅。
- **Flutter**：自渲染引擎，极致性能，但学习成本高。
- **原生开发**：适合长期维护、深度系统集成的复杂应用。

**结论**：对于新项目，除非有特殊原因，否则优先考虑 React Native 或 Capacitor。RN 在性能和生态系统上明显优于 Cordova。

---

## 11. 第十阶段：性能优化与最佳实践

### 11.1 避免不必要的重渲染
- 使用 `React.memo` 包裹纯展示组件。
- 使用 `useCallback` 和 `useMemo` 缓存函数和计算结果。
- 在 FlatList 中使用 `removeClippedSubviews` 和 `windowSize` 控制渲染范围。

### 11.2 导航性能
- 尽量使用 `native-stack` 而非 JS 堆栈。
- 利用 `useFocusEffect` 按需加载数据，避免在 `useEffect` 中无差别请求。
- 使用 `navigation.popToTop()` 或 `pop()` 释放深层页面，减少内存占用。

### 11.3 图片优化
- 使用 `resizeMode` 控制缩放。
- 优先使用网络图片的 CDN 压缩，本地图片尽量使用 WebP 格式。
- 考虑使用 `react-native-fast-image` 替代 `Image`。

### 11.4 状态管理优化
- 使用 Redux/Zustand 的选择器（selector）精确订阅，避免全局更新。
- 对于服务器数据，使用 React Query 的缓存和后台刷新机制，减少无效请求。

### 11.5 启动速度优化
- 启用 Hermes 引擎（Android 默认，iOS 可开启）。
- 使用 `react-native-bundle-visualizer` 分析包体积，移除无用依赖。
- 延迟加载非首屏组件（如使用 `lazy` 和 `Suspense`）。

### 11.6 调试工具
- **React Native Debugger**：集成 Redux DevTools 和 Chrome 调试。
- **Flipper**：Meta 官方调试平台，支持查看布局、网络请求等。
- **React DevTools**：用于检查组件树和 Hooks 状态。

---

## 12. 结语：走向精通之路

React Native 的学习是一段从“会用”到“懂原理”的旅程。我们在这篇博客中，从最基础的 JavaScript 和 React 预备知识，逐步深入到组件、导航、状态管理、底层渲染、热更新、原生框架集成，乃至与 Cordova 的技术对比。每个阶段都附带了核心原理的解析，而不仅仅是 API 的使用。