# iOS 模块化架构：从协议族到可装配的 App 内核

## 一、引言：为什么需要模块化？

当一个 App 从「一个 Target、几十个文件」长到「几十个业务域、上千个文件」时，单一工程的坍塌是必然的。模块化（Modularity）要解决的是**规模化的组织问题**：

| 痛点 | 未模块化时的表现 |
|------|----------------|
| **编译爆炸** | 改一行代码，全量重编译，等 10 分钟 |
| **边界模糊** | 任何文件都能 import 任何文件，依赖图是张密网 |
| **无法复用** | 一个功能写死在某 App 里，换个 App 要重写 |
| **无法灰度** | 一个模块上线，全家桶一起上，回滚也要全量回 |

模块化的目标，是把「一坨」拆成「一组**可独立开发、独立测试、独立装配、独立上下架**的单元」。但要拆得开、又装得回，需要一套**协议契约 + 生命周期 + 装配机制**，这正是本文主角 `CrossModularity` 要解决的事。

---

## 二、模块化的三个层次

模块化不是「拆文件夹」那么简单，它有三个递进的层次：

```
第一层：代码隔离（物理拆分）
        —— 不同模块分目录 / 分 Target / 分 Pod / 分 Package
              │
第二层：依赖倒置（逻辑解耦）
        —— 模块只依赖「协议」，不依赖「具体实现」
              │
第三层：运行时装配（动态组合）
        —— 模块通过容器注册、通过路由跳转、通过生命周期协同
```

大多数团队停留在第一层（物理拆分），结果拆出了 N 个互相 import 的 Target，依赖图更乱了。**真正的模块化是第二、三层**，而 `CrossModularity` + `CrossDIContainer` + `CrossRouter` 三个包，正好分别覆盖了装配、依赖、跳转三个维度。

---

## 三、CrossModularity：模块化协议族

`CrossModularity` 定义了一组**模块化能力协议**，每个业务模块只要遵守它，就能被宿主统一识别、装配、调度。

### 3.1 模块标识：`Module`

```swift
public struct Module: Hashable, Codable, Identifiable, RawRepresentable {
    public let id: String
    public let displayName: String?
    public let version: String?
    public let category: Category   // infrastructure / business / demo / kernel
    public let priority: Int        // 装配优先级，越小越先
}
```

`Category` 把模块分成四类，天然形成分层依赖方向：

| Category | 含义 | 举例 |
|----------|------|------|
| `kernel` | 内核引导 | `appKernel` |
| `infrastructure` | 基础设施 | `di` / `network` / `media` / `sqlite.data` |
| `business` | 业务模块 | `user` / `chat` / `chess` / `settings` |
| `demo` | 演示模块 | `demo.chat` / `demo.webrtc` |

`priority` 决定装配顺序——基础设施必须先于业务模块注册完成，这在启动流程里是关键约束。

### 3.2 模块能力协议族

核心协议 `AppModule`，以及它衍生出的一组「能力面」协议：

```swift
@MainActor
public protocol AppModule {
    var module: Module { get }
    var isEnabled: Bool { get set }
    func onEnable() throws
    func onDisable()
}
```

围绕它，模块可以选择性遵守以下能力协议（**按需实现，不强求**）：

| 协议 | 能力 | 关键方法 |
|------|------|---------|
| `AppModuleRoutable` | 提供页面 | `supportRoutes()` / `buildView(route:)` |
| `AppModuleWidgetProvider` | 提供小组件 | `supportWidgets()` / `buildWidget(widget:)` |
| `AppModuleSearchable` | 提供首页卡片入口 | `cardEntries()` |
| `AppModuleInitializable` | 异步初始化 | `onInitialize() async throws` |
| `AppModulePrivacyDataProcessor` | 隐私删除 | `onDelete(scope:)` |
| `AppModuleLifeCycleProcessor` | 生命周期钩子 | `onRegister` / `onUserDidLogin` / `onMemoryWarning` ... |

这种「能力面拆分」的收益：一个纯工具模块（如日志）可以只实现 `AppModuleInitializable`，不被迫实现它用不到的路由/UI 方法。

### 3.3 模块路由：`AppRoute` / `ModuleRoute`

模块跳转不再是「裸字符串」，而是**模块 + 路径 + 强类型参数**的结构：

```swift
public struct ModuleRoute: Codable, Hashable {
    public let module: Module      // 属于哪个模块
    public let path: String        // 模块内路径
    public let params: [String: CodableValue]  // 强类型参数
}
```

`CodableValue`（来自 `CrossDIContainer`）让参数在「结构化数据 ↔ 可编解码」之间自由转换，比 URL 路由的 `[String: Any]` 安全得多。

### 3.4 卡片入口与 Demo 组件

- `ModuleCardEntry`：模块在首页的卡片入口（标题/副标题/图标/颜色/目标路由/排序），让首页变成一个「模块货架」，由各模块自主贡献卡片。
- `ModuleDemoWidget`：模块自带的演示面板（标题 + 一组 action + 日志面板），用于独立验证模块功能，不依赖宿主主流程。

---

## 四、模块化三件套的协同

单独一个 `CrossModularity` 是「骨架」，真正跑起来需要三个包协同：

```
              ┌─────────────────────────────────────┐
              │            宿主 App（内核）           │
              └──────────────┬──────────────────────┘
                             │ 装配 & 调度
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   CrossModularity      CrossDIContainer     CrossRouter
   （模块协议族）         （依赖注入容器）       （路由协调器）
        │                    │                    │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │ 模块声明 │          │ 依赖装配 │          │ 页面跳转 │
   │ 生命周期 │          │ 作用域   │          │ 守卫/深链│
   │ 卡片入口 │          │ 循环检测 │          │ 跨Tab导航│
   └─────────┘          └─────────┘          └─────────┘
```

### 4.1 装配流程

模块的生命周期被 `CrossDIContainer` 管理：

```swift
// 模块注册时，把自身服务注入容器
func onRegister(_ container: DIContainer) throws {
    container.register(UserService.self, scope: .module(.user)) { _ in
        UserServiceImpl()
    }
}
```

DI 容器的**模块作用域**（`.module(Module)`）是关键：同一模块内解析复用实例，跨模块访问触发违规检测，模块退出时 `container.destroy("user")` 一键销毁该模块缓存。

### 4.2 跳转流程

模块通过 `RouteNavigating` 最小面跳转，不 import 宿主：

```swift
@Environment(\.appRouter) private var router: any RouteNavigating
router.navigate(to: "user/profile", params: ["id": "42"])
```

目标页面由模块通过 `AppModuleRoutable.buildView(route:)` 提供，宿主统一注册到 `RouterRegistry`，形成「模块提供页面 → 注册表集中 → 路由统一分发」的闭环。

### 4.3 生命周期协同

`AppModuleLifeCycleProcessor` 让模块感知宿主级事件（登录/登出/内存警告/前后台），宿主在对应时机广播给所有模块。这让模块不仅是「被跳转的页面」，更是「随 App 心跳的活体」。

---

## 五、市面主流模块化方案对比

模块化在 iOS 生态里有几种落地形态，各有代价：

| 方案 | 代表 | 优点 | 缺点 |
|------|------|------|------|
| **CocoaPods 多库** | 私有 Pod 仓库 | 版本化、成熟、生态广 | Pod 维护重、二进制预编译配置繁琐 |
| **SPM 单仓多 Target** | Monorepo + Package.swift | 源码清晰、CI 友好、无版本地狱 | SPM 二进制分发较弱、跨包依赖有时别扭 |
| **Xcode 多 Project/Workspace** | 手写 Workspace | 无第三方依赖 | 配置复杂、易漂移 |
| **二进制 Framework** | XCFramework | 编译极快、代码保密 | 制作/分发流程重、调试不便 |
| **协议 + 注册表（微内核）** | 本文方案 | 解耦彻底、可装配、可灰度 | 需要自建装配层，前期有设计成本 |

### 选型建议

| 你的诉求 | 推荐 |
|---------|------|
| 团队小、求省事 | SPM 单仓多 Target（Monorepo），简单直接 |
| 需要二进制交付/保密 | XCFramework |
| 已有大量 Pod 基建 | CocoaPods 私有库，别推倒重来 |
| 追求**运行时可装配、可灰度、可独立上下架** | 协议 + 注册表（微内核，如 CrossModularity 方案） |

---

## 六、模块化的工程收益

一套到位的模块化，最终会换来这些可量化的收益：

1. **编译提速**：改业务模块，基础设施不重编（配合二进制化效果更显著）。
2. **边界清晰**：模块只依赖协议，依赖图从「密网」变「星型」——所有模块都指向内核，彼此不交叉。
3. **可灰度**：`isEnabled` / `featureFlags` 让模块可以独立开关、独立上架、独立回滚。
4. **可测试**：模块独立成 Package/Target，单测隔离，CI 只跑变更模块的测试。
5. **可复用**：模块自包含（协议 + 实现 + 演示 Widget），可整体搬到另一个 App。

---

## 七、总结

模块化分三层：**代码隔离 → 依赖倒置 → 运行时装配**。多数团队停在了第一层，而真正的价值在第二、三层。

`CrossModularity` 用一组**能力面协议**定义「模块是什么、能干什么、如何被装配」，配合 `CrossDIContainer` 的模块作用域注入、`CrossRouter` 的协议路由，构成了一个完整的**微内核式**模块化架构：

- **模块**：遵守协议，声明自己的路由、Widget、卡片、生命周期
- **容器**：按模块作用域装配依赖，循环检测、违规拦截
- **路由**：统一分发页面跳转，守卫拦截、深链门控

这套三件套的上篇文章（路由）讲的是「怎么跳」，这篇（模块化）讲的是「怎么拆、怎么装」。两者合起来，是一个大型 SwiftUI App 从「单体泥球」走向「可装配内核」的完整答案。
