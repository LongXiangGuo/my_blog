# iOS 路由架构：从字符串路由到泛型路由协调器

## 一、引言：路由到底在解决什么问题？

路由（Router）在 iOS 架构中的角色，可以类比 Web 后端的 **URL 路由表**：它把「一个抽象的目标地址」翻译成「一个具体的页面 + 一组参数」，并在页面之间建立可预测、可拦截、可追踪的跳转通道。

在没有路由的年代，页面跳转是这样的：

```swift
// 硬编码：页面 A 直接 import 页面 B，强耦合
let detailVC = OrderDetailViewController(orderID: "123")
navigationController?.pushViewController(detailVC, animated: true)
```

这种写法在单个 App 里能跑，但项目一旦长大，会暴露四个问题：

| 问题 | 表现 |
|------|------|
| **紧耦合** | 每个页面都得 import 它要跳的所有目标页面，模块边界被击穿 |
| **不可拦截** | 无法统一在跳转前做「登录校验 / 灰度开关 / 埋点」，逻辑散落各处 |
| **不可追踪** | 无法回答「这个页面是谁、从哪跳过来的、带什么参数」 |
| **不可扩展** | 新增一种「模态弹出 / 替换栈顶」的展示方式，要改所有调用点 |

路由框架的目标，就是把这四个问题收拢到**一个统一入口**里解决。

---

## 二、市面主流路由方案全景

在动手设计前，先梳理 iOS 生态里已经存在的几大流派。它们各有取舍，理解它们才能做好选型。

### 2.1 流派一：URL 字符串路由

代表：**MGJRouter（蘑菇街）**、**JLRoutes**、**URLNavigator**、**Routable**。

核心思想：每个页面注册一个 URL pattern，跳转时用字符串 URL 匹配。

```objc
// 注册
[MGJRouter registerURLPattern:@"mgj://user/detail" toHandler:^(NSDictionary *p) {
    UserDetailVC *vc = [[UserDetailVC alloc] init];
    vc.userID = p[@"id"];
    return vc;
}];

// 跳转
[MGJRouter openURL:@"mgj://user/detail?id=123"];
```

**优点**：
- 完全解耦，调用方不 import 目标类
- URL 是纯数据，可**远程下发**、可**动态化**（配合热更新做页面路由）
- 与 DeepLink / 推送落地天然契合（外部进来就是一个 URL）

**缺点**：
- 字符串魔法值满天飞，**编译期零检查**，写错只会在运行时暴露
- 参数是弱类型的 `[String: Any]`，需要手动解包、强转
- 引用关系不可追踪，重构时只能全局搜字符串
- 无法表达复杂导航语义（如「跨 Tab 跳转后，返回要回到来源 Tab」）

### 2.2 流派二：target-action 路由

代表：**CTMediator（蘑菇街/阿里）**。

```objc
// 跳转：不 import 目标类，通过 target/action 字符串反射调用
[CTMediator.sharedInstance performTarget:@"User" action:@"detail" params:@{@"id": @123}];
```

**优点**：解耦程度与 URL 路由相当，同时省去了 URL 的 pattern 匹配开销。
**缺点**：依赖 Objective-C 运行时反射；Swift 类型体系下用起来别扭；方法签名靠约定，编译期同样零保障，拼错 target/action 直接运行时崩。

### 2.3 流派三：协议（接口）路由

核心思想：模块对外暴露**协议**，通过协议 + 注册表获取实现。

```swift
// 用户模块对外暴露协议
protocol UserModuleRoutable {
    func openUserDetail(id: String)
}

// 宿主通过注册表拿到实现
let userModule: UserModuleRoutable = Registry.resolve(UserModuleRoutable.self)
userModule.openUserDetail(id: "123")
```

**优点**：编译期类型安全、参数强类型、调用点可被 IDE 索引追踪。
**缺点**：模块之间仍需共享「协议声明」这一依赖面；注册表本身需要额外的装配成本。

### 2.4 流派四：声明式路由（SwiftUI 原生 / TCA）

SwiftUI 的 `NavigationStack` + `navigationDestination`，以及 TCA（The Composable Architecture）里的路由，属于**状态驱动**路由：

```swift
enum Route: Hashable { case detail(id: String) }

NavigationStack(path: $path) {
    List {
        NavigationLink(value: Route.detail(id: "1")) { Text("详情") }
    }
    .navigationDestination(for: Route.self) { route in
        switch route { case .detail(let id): DetailView(id: id) }
    }
}
```

**优点**：路由状态就是数据，可持久化、可单元测试；类型安全。
**缺点**：绑定 SwiftUI 版本（`NavigationStack` 需 iOS 16+）；跨模块时仍需自建协议/注册表；状态管理心智负担更重。

### 2.5 五流派对比总览

| 维度 | URL 路由 | target-action | 协议路由 | 声明式 |
|------|---------|--------------|---------|--------|
| 解耦程度 | 极高 | 极高 | 高 | 中（依赖状态类型） |
| 编译期安全 | ❌ | ❌ | ✅ | ✅ |
| 参数类型 | 弱类型 | 弱类型 | 强类型 | 强类型 |
| 动态化能力 | ✅ | ✅ | ❌ | ❌ |
| 导航语义表达 | 弱 | 弱 | 中 | 中 |
| SwiftUI 契合度 | 低 | 低 | 中 | 高 |
| 学习/维护成本 | 低 | 低 | 中 | 高 |

---

## 三、CrossRouter：一套泛型路由协调器的设计

我司自研的 `CrossRouter` 是一个**零业务代码、零第三方依赖**的 SwiftUI 路由协调器（Swift Package）。它在「协议路由」流派的基础上，用泛型解决了根状态与多 Tab 栈的问题，并补齐了守卫、DeepLink、生命周期等工程化能力。

### 3.1 整体架构

```
                          ┌────────────────────────────┐
                          │  AppRouter<Root, Tab>       │
                          │  （唯一实现类，7 个职责面）   │
                          └──────────────┬─────────────┘
        ┌──────────────┬──────────────┬──┴─────┬──────────────┬─────────────┐
        │              │              │        │              │             │
 RouteNavigating RouteStateControlling RouteRegistryProviding DeepLinkHandling RouteGuarding
   (模块最小面)     (根/Tab栈控制)       (注册表)      (深链分发)      (守卫流水线)
        │              │              │        │              │             │
        │              │              │        │              │      RouteLifecycleHandling
        │              │              │        │              │      RouteLogging
        │              │              ▼        │              │
        │              │      ┌──────────────┐ │              │
        │              │      │ RouterRegistry│ │              │
        │              │      │ WidgetRegistry│ │              │
        │              │      └──────────────┘ │              │
        │              │              │        │              │
        └──────────────┴───────┬──────┴────────┘              │
                               ▼                               │
                     TabRouter（每 Tab 独立导航栈）              │
                               │                               │
                     RoutePath + RouteContext                  │
```

### 3.2 三个核心类型

#### （1）`RoutePath` —— 回答「去哪」

```swift
public struct RoutePath: Hashable, Codable, Sendable {
    public let path: String
    public let params: [String: String]
}
```

关键设计是**用 struct 模拟 enum（开闭原则）**：基础框架只提供通用能力，业务层通过 `extension` 添加自己的静态常量，既保留点语法优雅，又无限扩展，且不改基础代码：

```swift
extension RoutePath {
    public static let orderDetail = RoutePath(path: "order/detail")
    public static func order(_ id: String) -> RoutePath {
        RoutePath(path: "order/detail/\(id)")
    }
}
```

#### （2）`RouteContext` —— 回答「怎么去」和「回来怎么办」

`RoutePath` 只管目的地，`RouteContext` 管过程与回调：

| 字段 | 含义 |
|------|------|
| `source` | 来源标识（埋点/返回逻辑），如 `"home_banner"` |
| `sourceTab` | 来源 Tab（跨 Tab 返回的依据） |
| `presentation` | `.push` / `.present` / `.replace` 三种展示方式 |
| `onDismiss` | 返回后回调（后 → 前传值） |
| `popToRoute` | push 前先把当前栈 pop 到指定路由 |
| `restoreSourceTabOnPopToRoot` | 跨 Tab 返回：目标 Tab 栈回根时自动切回来源 Tab |
| `replaceTargetRoot` | 切 Tab 时是否替换目标 Tab 根视图（防遗留空栈） |

#### （3）泛型根状态与 Tab

```swift
public final class AppRouter<Root: AppRootStateProviding, Tab: TabRouteProviding> { ... }
```

- `Root` 支持 `onboarding → auth → main` 这类**根状态切换**（登录前后整套界面树的替换）
- `Tab` 支持**多 Tab 栈独立导航**，每个 Tab 有自己的 `TabRouter` 导航栈，互不干扰

### 3.3 职责拆分：接口隔离原则（ISP）

`AppRouter` 职责很多，若全堆在一个类里，会变成 God Object。于是把 public API 按职责拆成 **7 个协议**：

| 协议 | 面向谁 | 职责 |
|------|--------|------|
| `RouteNavigating` | 业务模块 | 最小导航面（跳转/返回/构建视图），模块**不 import 宿主类型** |
| `RouteStateControlling` | 宿主 | 根状态/Tab 切换/Tab 栈访问 |
| `RouteRegistryProviding` | 注册器/Bootstrap | 路由/Widget 注册表读写 |
| `DeepLinkHandling` | 系统入口 | 深链分发 + pending 暂存 |
| `RouteGuarding` | 宿主配置 | 守卫管理 |
| `RouteLifecycleHandling` | 宿主转发 | 前后台生命周期钩子 |
| `RouteLogging` | 宿主/诊断 | 日志收集 + 外部钩子 |

拆分带来的直接收益：**30 个业务模块只需依赖 `RouteNavigating` 一个最小协议即可安全跳转**，不 import 宿主类型，模块与宿主彻底解耦。

### 3.4 注册表：精确路径 + 前缀通配

```swift
// 精确路由
router.registerRoute("user/profile") { route in
    ProfileView(userID: route.param(for: "id") ?? "")
}
// 前缀通配（/product/* 一类场景）
router.registerRoute(prefix: "order/") { route in
    OrderView(path: route.path)
}
```

注册表内部用 `NSLock` 保护，精确匹配优先于前缀匹配，未命中时落到 `notFoundBuilder` 兜底渲染 404 页。

### 3.5 守卫流水线：统一拦截点

所有 `navigate` 都会先跑守卫流水线，任何一个 `.deny` 即终止导航并降级：

```swift
final class LoginGuard: RouteGuard {
    func check(route: RoutePath, context: RouteContext) -> RouteGuardDecision {
        route.path.hasPrefix("user/")
            ? .allow
            : .deny(code: .notLoggedIn, reason: "未登录",
                    redirectTo: RoutePath(path: "user/login",
                                          params: ["redirect": route.path]))
    }
}
router.addGuard(LoginGuard())
```

- 内置 4 类标准错误码：`.notFound`(404) / `.notLoggedIn`(401) / `.noPermission`(403) / `.needUpgrade`(426)
- `redirectTo` 支持标准降级与重定向，并有**深度保护**（`maxRedirectDepth`，防守卫重定向无限递归）

### 3.6 DeepLink：四类来源 + 根状态门控

```swift
let ok1 = router.handleSchemeURL(url)          // crossapp://...
let ok2 = router.handleUniversalLink(url: url)  // universal link
let ok3 = router.handleNotificationDeepLink(url: url) // 推送落地
```

- 默认解析 `crossapp://chat/list?tab=home` → 切 Tab + push
- **根状态门控**：`deepLinkGate` 为 false 时（如仍在登录页），先暂存 `pendingDeepLink`，待 `switchRoot` 到主态时自动 flush

### 3.7 SwiftUI 注入：类型擦除 + no-op 兜底

泛型 `AppRouter<Root, Tab>` 无法直接作为非泛型 `EnvironmentKey` 的 Value，于是注入时存 `any RouteNavigating`（类型擦除协议）：

```swift
WindowGroup { RootView() }
    .environment(\.appRouter, router)   // 宿主注入（自动擦除）

struct RootView: View {
    @Environment(\.appRouter) private var router: any RouteNavigating  // 模块读取
    var body: some View {
        Button("去个人中心") { router.navigate(to: "user/profile", params: ["id": "42"]) }
    }
}
```

**关键设计：未注入时不崩溃**。`defaultValue` 不是 `fatalError`，而是一个 no-op 占位 + 一次性警告，保证 App 100% 不崩，并打印调用栈定位「哪里提前读了 Environment」。

---

## 四、选型建议：不同场景怎么挑？

没有银弹，只有匹配度。按团队与场景给建议：

### 4.1 按技术栈选

| 你的情况 | 推荐 |
|---------|------|
| 纯 SwiftUI 新项目 | 声明式（`NavigationStack`）或 CrossRouter 这类 SwiftUI 泛型协调器 |
| 大量 UIKit 存量代码 | URL 路由（JLRoutes/MGJRouter）或 target-action（CTMediator），迁移成本低 |
| SwiftUI + UIKit 混合 | 协议路由或 CrossRouter（`AnyView` 跨栈构建视图） |

### 4.2 按需求强度选

| 需求 | 推荐 |
|------|------|
| 需要**动态化/热更新**下发页面 | URL 路由（URL 是数据，可远程配置） |
| 需要**编译期安全**、怕重构踩坑 | 协议路由 / 声明式 |
| 需要**统一登录校验、灰度、埋点** | 带守卫流水线的方案（如 CrossRouter） |
| 需要**跨 Tab 导航 + 返回溯源** | 泛型 Tab 栈方案（CrossRouter 强项） |
| 需要**深链 + 推送落地** | 支持 DeepLink 门控的方案 |

### 4.3 一句话结论

- **追求极致动态化**：URL 路由。
- **追求工程健壮 + SwiftUI 原生体验**：协议路由，若再叠加多 Tab/守卫/深链需求，用 CrossRouter 这类泛型协调器。
- **小项目 / 单页跳转**：别上框架，原生 push 最省心，等出现「拦截 / 解耦 / 追踪」的真实痛点再引入路由。

---

## 五、总结

路由的本质，是把散落的「页面跳转」收拢为「**可注册、可拦截、可追踪的统一入口**」。五类主流方案各有取舍：URL 路由胜在动态化，target-action 胜在轻量解耦，协议路由胜在类型安全，声明式胜在状态驱动。

`CrossRouter` 站在「协议路由」的肩膀上，用 **泛型 + 协议职责拆分 + 守卫流水线 + DeepLink 门控** 补齐了 SwiftUI 多 Tab 大型应用的工程化短板——这也是下一篇文章要讲的「模块化」的重要拼图：模块通过 `RouteNavigating` 最小面跳转，通过注册表提供页面，最终被宿主装配成一个整体。
