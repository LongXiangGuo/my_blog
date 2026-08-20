# React Navigation 完全指南（综合文档）

本文档整合了关于 React Navigation 的完整知识体系，涵盖核心概念、编译与运行时原理、Static API 架构、Options 参数详解、Focus/Blur 生命周期、条件导航以及性能优化最佳实践。


## 第一部分：核心概念与基础导航器

React Navigation 是 React Native 应用开发中最核心的导航库，用于管理页面间的跳转和切换。其核心使命是桥接 iOS 的 `UINavigationController` 和 Android 的 `FragmentManager`。

### 1. Stack Navigator（堆栈导航器）
实现最常见的页面堆栈式导航，遵循**后进先出**的原则。从列表页进入详情页时，详情页被推入栈顶；返回时，详情页从栈顶弹出。

- **核心行为**：屏幕只有在导航到该屏幕时才会挂载，在返回或手动重置状态时卸载。
- **两种实现**：
  - `@react-navigation/stack`：基于 JavaScript。
  - `@react-navigation/native-stack`：基于原生平台 API（**性能更优，推荐**）。

### 2. Tab Navigator（标签导航器）
实现底部或顶部的 Tab 切换，让用户在功能模块间快速切换。

- **核心行为**：所有路由会**一次性全部挂载**。切换 Tab 时直接显示已存在的实例，不重新创建，提供流畅切换体验。

### 3. Drawer Navigator（抽屉导航器）
实现从屏幕侧边滑出的抽屉式导航菜单，常用于主导航或设置入口。


## 第二部分：从编译到运行时 —— 工作流程与底层原理

### 2.1 架构概览
React Navigation 遵循**基于组件的结构**。Navigator（导航器）负责管理和渲染一组屏幕，本质上就是普通的 React 组件。库本身不包含原生代码，但利用 `React Native Screens`、`Reanimated` 和 `Gesture Handler` 实现高性能动画与手势。

### 2.2 编译时（Compile Time）
1. **依赖安装**：安装核心库及特定导航器包（如 `native-stack`、`bottom-tabs`）。
2. **结构定义**：通过 `createXNavigator` 创建导航器，定义屏幕映射关系（支持动态 API 组件式 或 静态 API 对象式）。
3. **TypeScript 检查**：编译时对屏幕及参数进行类型校验。
4. **Metro 打包**：将 JavaScript 打包到 APK/IPA 中。

### 2.3 运行时（Runtime）核心机制
#### （1）导航状态（Navigation State）
运行时通过一个 **JavaScript 对象**存储导航历史。结构如下：
```javascript
const state = {
  type: 'stack',            // 类型：stack / tab / drawer
  key: 'stack-1',
  routeNames: ['Home', 'Profile'],
  routes: [                 // 代表堆栈历史
    { key: 'home-1', name: 'Home', params: { sortBy: 'latest' } },
    { key: 'profile-1', name: 'Profile' },
  ],
  index: 1,                 // 当前聚焦路由的索引
  stale: false,
};
```

#### （2）状态更新流程
1. 用户触发动作（如 `navigation.navigate`）。
2. 分发 Action 更新导航状态（添加目标屏幕到堆栈）。
3. React 根据新状态重新渲染目标屏幕组件。

#### （3）受控组件模式
所有导航器都是**受控组件**——它们始终显示 `props.navigation.state` 传入的内容，唯一改变状态的方式是通过 `dispatch` 发送 action。导航器通过 `state` 和 `dispatch` 与父级通信。

#### （4）View 层渲染
导航视图（Navigation Views）负责呈现当前状态：
- **StackView**：卡片式切换动画。
- **Tabs**：可配置的切换器/分页器。
- **Drawer**：侧边抽屉视图。

### 2.4 生命周期机制（最关键差异）
这是 React Navigation 与 Web 路由最本质的区别。**导航离开时不会卸载屏幕**。

| 场景        | Web 行为           | React Navigation 行为        |
| ----------- | ------------------ | ---------------------------- |
| 从 A 到 B   | A 卸载，B 挂载     | A 保持挂载，B 挂载           |
| 从 B 返回 A | B 卸载，A 重新挂载 | B 卸载，A 的现有实例直接显示 |

这意味着所有 Tab 屏幕可能同时保持挂载，嵌套导航时所有层级的历史状态都会被保留。


## 第三部分：性能优化 —— React.memo vs React.PureComponent

两者都是 React 提供的性能优化工具，通过**浅比较（shallow comparison）**避免不必要的重新渲染。

| 维度           | React.memo                               | React.PureComponent                             |
| -------------- | ---------------------------------------- | ----------------------------------------------- |
| **适用组件**   | 函数组件（高阶组件 HOC）                 | 类组件（基类）                                  |
| **比较范围**   | 仅对 `props` 进行浅比较                  | 对 `props` 和 `state` 均进行浅比较              |
| **自定义比较** | 支持传入自定义比较函数（作为第二个参数） | 不支持，内置 `shouldComponentUpdate` 逻辑       |
| **使用方式**   | `export default React.memo(MyComponent)` | `class MyComponent extends React.PureComponent` |

**注意**：浅比较仅能检测基本类型变化和对象引用变化。若复杂对象内部属性变化但引用不变，可能导致组件不更新，需谨慎使用。


## 第四部分：React Navigation 7 Static API —— 架构、原理与流程

### 4.1 为什么需要 Static API
解决动态 API 的两大痛点：**TypeScript 配置繁琐**（需手动维护 ParamList）和**深度链接配置割裂**。Static API **完全构建在 Dynamic API 之上**，是可选升级，动态 API 不会消失。

### 4.2 架构设计与对比

| 维度         | 动态 API（组件式）              | 静态 API（对象式）                    |
| ------------ | ------------------------------- | ------------------------------------- |
| **配置方式** | JSX 组件（`<Stack.Navigator>`） | 纯配置对象                            |
| **结构解析** | 运行时动态构建                  | 编译时静态定义                        |
| **类型推断** | 手动维护 `ParamList`            | **自动**从配置推断类型                |
| **深度链接** | 单独配置 `linking` 对象         | 整合在配置中（支持 `enabled:'auto'`） |

**静态 API 示例**：
```javascript
const RootStack = createNativeStackNavigator({
  screens: {
    Home: HomeScreen,
    Profile: ProfileScreen,
  },
});
const Navigation = createStaticNavigation(RootStack);
```

### 4.3 工作流程
- **编译时**：
  1. 解析配置对象，静态评估整个导航树。
  2. TypeScript 自动推断 `StaticParamList` 并通过模块增强使其全局可用。
  3. 自动生成路径配置（`enabled: 'auto'`）。
- **运行时**：
  `createStaticNavigation` 返回类似 `NavigationContainer` 的组件，底层调用动态 API，**行为与动态 API 完全一致**。

**核心限制**：导航结构必须是静态的（不能在运行时动态创建屏幕列表），但支持通过 `if` 属性实现条件渲染。


## 第五部分：导航器 Options —— 底层原理与参数详解

### 5.1 底层工作原理
- **分层定义与合并**：Options 可在三个层级定义，优先级从低到高为：导航器级 `screenOptions` → 组级 `Group.screenOptions` → 屏幕级 `options`（最高）。
- **函数式解析**：当 options 是函数时，传入 `{ navigation, route }` 并执行。
- **作用域限制**：**只能从该导航器的屏幕组件中修改该导航器的 options**。内层导航器的屏幕无法直接修改外层导航器的 options。
- **动态更新**：屏幕内可使用 `navigation.setOptions()` 在运行时更新。

### 5.2 Options 与原生参数的映射关系
React Navigation 的 Options 最终映射到 iOS 和 Android 的原生 UI 参数：

| Options 属性        | 作用                  | 对应原生（iOS）                           | 对应原生（Android）                     |
| ------------------- | --------------------- | ----------------------------------------- | --------------------------------------- |
| `title`             | 设置标题文字          | `navigationItem.title`                    | `ActionBar.setTitle()`                  |
| `headerStyle`       | 标题栏样式（背景色）  | `navigationBar.barTintColor`              | `ActionBar.setBackgroundDrawable()`     |
| `headerTintColor`   | 标题/返回按钮颜色     | `navigationBar.tintColor`                 | `ActionBar.setTitleTextColor()`         |
| `headerTitleStyle`  | 标题字体样式          | `navigationBar.titleTextAttributes`       | `ActionBar.setTitleTextColor()`         |
| `headerShown`       | 是否显示标题栏        | `navigationBar.hidden`                    | `ActionBar.hide()` / `show()`           |
| `headerBackTitle`   | 返回按钮文字          | `navigationItem.backBarButtonItem`        | 无直接对应（Android 通常只显示箭头）    |
| `headerBackVisible` | 是否显示返回按钮      | `navigationItem.hidesBackButton`          | `ActionBar.setDisplayHomeAsUpEnabled()` |
| `gestureEnabled`    | 是否启用手势返回      | `interactivePopGestureRecognizer.enabled` | 无直接对应（依赖系统返回手势）          |
| `presentation`      | 呈现方式（卡片/模态） | `modalPresentationStyle`                  | `Window.setFlags()`                     |

### 5.3 常用 Options 参数示例及用途

**（1）标题与样式**
```javascript
options={{
  title: '个人主页',
  headerTitleAlign: 'center',
  headerStyle: { backgroundColor: '#f4511e' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' },
  headerShadowVisible: false,
}}
```

**（2）行为控制**
```javascript
options={{
  headerShown: false,           // 隐藏标题栏（常用于全屏页面）
  gestureEnabled: true,         // 启用手势返回
  presentation: 'modal',        // 模态呈现（从底部弹出）
  animation: 'slide_from_right',// 转场动画类型
}}
```

**（3）Tab 导航器特有**
```javascript
screenOptions={({ route }) => ({
  tabBarIcon: ({ focused, color, size }) => <Icon name="home" />,
  tabBarActiveTintColor: 'tomato',
  tabBarInactiveTintColor: 'gray',
  tabBarBadge: 3,
  tabBarBadgeStyle: { backgroundColor: 'red' },
})}
```

**（4）动态使用路由参数**
```javascript
options={({ route }) => ({
  title: route.params?.name || '默认标题',
})}
```


## 第六部分：Focus / Blur 生命周期事件详解

### 6.1 什么是 Focus / Blur
由于屏幕**默认保持挂载**，React 标准的 `componentDidMount` / `componentWillUnmount` 无法感知页面的“进入”和“离开”。React Navigation 提供了事件来感知聚焦/失焦状态。

**事件映射（版本差异）**：
- 早期版本（v4）：`willFocus` / `didFocus` / `willBlur` / `didBlur`
- 现代版本（v5+）：简化为 `focus` / `blur`，并增加 `beforeRemove`（可阻止离开）

### 6.2 底层实现原理
1. 导航状态（`state`）变化时（如 `index` 改变）。
2. 导航器计算哪些屏幕获得/失去焦点。
3. 通过**事件发射器（Event Emitter）**触发对应监听器。
4. 事件对象包含 `data`、`target` 和可选的 `preventDefault` 方法。

### 6.3 使用方式

**（1）useFocusEffect（推荐，函数组件）**
```javascript
import { useFocusEffect } from '@react-navigation/native';

function ProfileScreen() {
  useFocusEffect(
    React.useCallback(() => {
      fetchProfileData();       // 聚焦时执行
      return () => { /* 失焦清理（如取消请求） */ };
    }, [])
  );
}
```

**（2）addListener（通用）**
```javascript
React.useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    // 处理聚焦
  });
  return unsubscribe;
}, [navigation]);
```

**（3）类组件**
```javascript
componentDidMount() {
  this._unsubscribe = this.props.navigation.addListener('focus', this.onFocus);
}
componentWillUnmount() {
  this._unsubscribe?.();
}
```

**注意事项**：
- `addListener` 只能监听**直接导航器**的事件，如需监听父级使用 `navigation.getParent()`。
- `useFocusEffect` 在失焦时**自动执行清理函数**，适合数据获取副作用。


## 第七部分：条件导航（认证流程）详解

### 7.1 它是不是拦截器？
**不是**。Web 端路由拦截器是 **事后拦截**（导航发生时检查条件，不满足则重定向）。React Navigation 的条件导航是 **事前过滤** —— 在导航配置中通过 `if` 属性声明屏幕的可用条件，**条件不满足的屏幕根本不可用**（无法通过任何方式导航到它），且导航器根据状态变化**自动切换**屏幕，无需手动调用 `navigate`。

### 7.2 工作流程与示例

**（1）定义条件 Hook**
```javascript
function useIsSignedIn() {
  const { user } = React.useContext(AuthContext);
  return !!user;
}
function useIsSignedOut() {
  const { user } = React.useContext(AuthContext);
  return !user;
}
```

**（2）配置条件屏幕（Static API）**
```javascript
const RootStack = createNativeStackNavigator({
  screens: {
    Home: { if: useIsSignedIn, screen: HomeScreen },
    SignIn: { if: useIsSignedOut, screen: SignInScreen },
  },
});
```

**（3）运行时自动切换逻辑**

| 状态   | useIsSignedIn | useIsSignedOut | 可用屏幕 | 显示                   |
| ------ | ------------- | -------------- | -------- | ---------------------- |
| 未登录 | false         | true           | SignIn   | SignInScreen           |
| 登录后 | true          | false          | Home     | HomeScreen（自动切换） |

用户登录后，React Navigation 检测到 SignIn 不再满足条件 → 自动移除该屏幕；Home 成为第一个匹配屏幕 → 自动显示。用户按返回键**不会回到登录页**，因为登录页已被移除。

### 7.3 使用 Groups 组织复杂条件
```javascript
const RootStack = createNativeStackNavigator({
  groups: {
    Guest: {
      if: useIsGuest,
      screenOptions: { headerShown: false },
      screens: { SignIn: SignInScreen, SignUp: SignUpScreen },
    },
    User: {
      if: useIsUser,
      screens: { Home: HomeScreen, Profile: ProfileScreen },
    },
  },
});
```

### 7.4 重要原则
1. **不要手动触发导航**：登录/登出后应让 React Navigation 根据条件变化自动处理，避免手动 `navigate`。
2. **注意屏幕顺序**：多个屏幕同时满足条件时，**第一个匹配的屏幕会被显示**。
3. **处理 Loading 状态**：在认证状态加载完成前，应显示加载指示器，避免有条件地渲染屏幕。


## 第八部分：综合最佳实践总结

### 8.1 导航器选择与配置
- **优先使用 Native Stack**：`createNativeStackNavigator` 性能优于 JS 实现。
- **最小化嵌套**：用尽可能少的嵌套层级实现功能，避免性能下降和参数传递复杂化。
- **使用 Static API（v7+）**：获得更好的 TypeScript 支持和深度链接能力。

### 8.2 性能优化
- **避免不必要的重渲染**：使用 `useNavigationState` 时通过 selector 精确选择数据。
- **聚焦时执行副作用**：用 `useFocusEffect` 替代 `useEffect` 处理数据请求。
- **优化重组件**：配合 `React.memo` 避免焦点变化时的全局重渲染。
- **管理堆栈内存**：使用 `navigation.popTo()` 主动释放深层页面内存；利用 `useIsFocused` 在失焦时卸载非必要内容。
- **谨慎使用全局状态**：Stack/Tab 中的屏幕在 Redux/Context 更新时仍会重渲染，需注意更新范围。

### 8.3 状态与数据管理
- **参数需可序列化**：传递给路由的参数应是可 JSON 序列化的对象。
- **状态持久化**：使用 `persistNavigationState` 和 `loadNavigationState` 让用户重启 App 后回到相同位置（App 版本更新时建议更换持久化 key）。

### 8.4 架构与流程
- **认证流程使用条件导航**：采用声明式 `if` 条件而非命令式跳转。
- **深度链接**：利用内置支持，配置 `linking` 选项映射 URL 到屏幕。

### 8.5 常见错误规避
- **只渲染一个导航器**：大多数应用在根组件附近只应渲染一个导航器容器。
- **理解 Options 作用域**：内层导航器的屏幕无法直接修改外层导航器的 options。