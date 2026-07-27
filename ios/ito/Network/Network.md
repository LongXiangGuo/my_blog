## 一、简介

Network.framework 是 Apple 在 iOS 12、macOS 10.14 等系统中推出的现代化网络框架，被定位为 **BSD Socket 的现代替代品**。它提供了一套面向连接级别（Connection Level）编程的现代化 API，让开发者能够以更安全、更高效的方式管理 TCP、UDP、TLS 乃至 QUIC 等协议的网络连接。

**核心特性**包括：

| 特性         | 说明                             |
| ------------ | -------------------------------- |
| TCP/UDP 连接 | 直接管理传输层连接               |
| TLS 安全连接 | 内建安全连接机制                 |
| 多路径传输   | 自动在 Wi-Fi 和蜂窝之间切换      |
| 网络路径感知 | 实时监测网络变化，优化连接策略   |
| 状态机管理   | 支持 Ready/Waiting/Failed 等状态 |
| 低功耗优化   | 移动设备上的智能资源管理         |

> **定位说明**：Network.framework 属于**传输层**框架，用于直接访问 TLS、TCP、UDP 等协议。如果只需要加载 HTTP/HTTPS 资源，应继续使用 `URLSession`（它底层正是基于 Network.framework 构建的）。

---

## 二、架构图

iOS 网络框架整体分为四个层次：

```
┌─────────────────────────────────────────────────────────────┐
│                       应用层 (Application)                  │
│         AFNetworking / Alamofire / 自定义业务代码            │
├─────────────────────────────────────────────────────────────┤
│                  Cocoa / Foundation 层                      │
│    NSURLSession / NSURLConnection / WebKit / Bonjour        │
│                (基于 Network.framework 实现)                 │
├──────────────────────────┬──────────────────────────────────┤
│      用户态网络框架层 (User‑space Network APIs)              │
│  ┌─────────────────────┐ ┌──────────────────────────────┐  │
│  │  Network.framework  │ │    CFNetwork (C API)         │  │
│  │  (Swift/ObjC)       │ │    CFSocket / CFStream       │  │
│  │  TLS / QUIC / 多路径 │ │    (传统 C 接口)             │  │
│  └─────────────────────┘ └──────────────────────────────┘  │
│              两者均直接与 BSD Socket 交互                    │
├─────────────────────────────────────────────────────────────┤
│                   系统层 (内核空间)                         │
│              BSD Sockets / 内核协议栈 (TCP/IP/UDP)          │
└─────────────────────────────────────────────────────────────┘
```

Network.framework 位于 BSD Socket 之上、CFNetwork 之旁，直接与内核的 socket 接口交互。`URLSession` 等高层框架底层也依赖 Network.framework 实现网络连接。

从协议栈角度看，Network.framework 采用**可组合的协议栈设计**：

```
┌──────────────────────────────────────────────┐
│              应用层自定义协议                   │
├──────────────────────────────────────────────┤
│   TLS / QUIC / WebSocket / 自定义 Framer     │
├──────────────────────────────────────────────┤
│              TCP / UDP                        │
├──────────────────────────────────────────────┤
│                IP                             │
└──────────────────────────────────────────────┘
```

开发者可以通过 `NWParameters` 和 `NWProtocolFramer` 灵活组合协议栈，甚至定义自己的应用层协议。

---

## 三、底层原理

### 1. 智能连接建立

使用 BSD Socket 建立连接需要手动处理 DNS 解析、IPv4/IPv6 地址选择、代理配置等复杂逻辑。Network.framework 则通过 **"按名称连接"** 和 **Happy Eyeballs 算法**自动完成这些工作：

- 自动解析主机名为多个 IP 地址
- 并行尝试 IPv4 和 IPv6 连接
- 选择最优路径，自动处理网络切换

### 2. 用户态网络栈

Network.framework 运行在**用户态**，与 URLSession 共享同一个高性能用户态网络栈。这意味着：

- 避免频繁的内核态/用户态切换
- 更高效的数据传输
- 更好的流量控制和拥塞管理

### 3. 状态机模型

Network.framework 的连接采用状态机管理：

- **Setup**：连接初始化
- **Preparing**：正在建立连接
- **Ready**：连接就绪，可收发数据
- **Waiting**：等待网络恢复（如断网后重连）
- **Failed**：连接失败

这种模型让开发者可以清晰地处理各种网络状态变化，而不是像传统 Socket 那样需要手动管理复杂的回调逻辑。

### 4. 异步与结构化并发

从 iOS 26 / macOS 26 开始，Network.framework 深度集成了 Swift 的**结构化并发**支持，网络代码可以与其他 Swift 异步代码无缝融合。

---

## 四、应用场景

Network.framework 适用于以下场景：

| 场景                 | 说明                                        |
| -------------------- | ------------------------------------------- |
| **自定义应用层协议** | 需要直接控制 TCP/UDP 连接的游戏、即时通讯等 |
| **P2P 通信**         | 设备间直接数据传输                          |
| **局域网服务**       | 实现本地服务器、文件共享等                  |
| **网络状态监控**     | 使用 `NWPathMonitor` 实时监测网络变化       |
| **QUIC 协议应用**    | 使用现代 QUIC 传输协议                      |
| **WebSocket 通信**   | 原生支持 WebSocket 协议                     |
| **VPN/网络扩展**     | 与 NetworkExtension 框架配合                |

**不适合的场景**：普通的 HTTP/HTTPS API 请求应使用 `URLSession`。

---

## 五、实现代码

### 1. 网络状态监控（NWPathMonitor）

```swift
import Network

let monitor = NWPathMonitor()
monitor.pathUpdateHandler = { path in
    if path.status == .satisfied {
        print("网络可用")
        if path.usesInterfaceType(.wifi) {
            print("当前使用 Wi-Fi")
        } else if path.usesInterfaceType(.cellular) {
            print("当前使用蜂窝数据")
        }
    } else {
        print("网络不可用")
    }
}
monitor.start(queue: .global())
```



### 2. TCP 客户端连接

```swift
import Network

// 创建连接参数 (TCP)
let parameters = NWParameters.tcp

// 创建端点
let endpoint = NWEndpoint.hostPort(host: "example.com", port: 80)

// 创建连接
let connection = NWConnection(to: endpoint, using: parameters)

// 设置状态更新回调
connection.stateUpdateHandler = { state in
    switch state {
    case .ready:
        print("连接就绪")
        // 发送数据
        let data = "GET / HTTP/1.0\r\n\r\n".data(using: .utf8)!
        connection.send(content: data, completion: .contentProcessed { error in
            if let error = error {
                print("发送失败: \(error)")
            }
        })
    case .failed(let error):
        print("连接失败: \(error)")
    default:
        break
    }
}

// 启动连接
connection.start(queue: .global())
```



### 3. TCP 服务器（NWListener）

```swift
import Network

// 创建监听器
let listener = try! NWListener(using: .tcp, on: 8080)

listener.stateUpdateHandler = { state in
    switch state {
    case .ready:
        print("服务器已启动，监听端口 8080")
    case .failed(let error):
        print("服务器启动失败: \(error)")
    default:
        break
    }
}

listener.newConnectionHandler = { connection in
    print("收到新连接")
    connection.start(queue: .global())
    
    connection.receive(minimumIncompleteLength: 1, maximumLength: 1024) { 
        data, context, isComplete, error in
        if let data = data, let message = String(data: data, encoding: .utf8) {
            print("收到数据: \(message)")
        }
    }
}

listener.start(queue: .global())
```



### 4. 自定义协议栈（TLS + TCP）

```swift
import Network

// 创建 TLS 参数
let tlsOptions = NWProtocolTLS.Options()
// 配置 TLS（如设置最低版本）
sec_protocol_options_set_min_tls_version(tlsOptions.securityProtocolOptions, .TLSv12)

// 创建 TCP 参数
let tcpOptions = NWProtocolTCP.Options()
tcpOptions.enableKeepalive = true
tcpOptions.keepaliveIdle = 60

// 组合参数
let parameters = NWParameters(tls: tlsOptions, tcp: tcpOptions)

let connection = NWConnection(host: "example.com", port: 443, using: parameters)
connection.start(queue: .global())
```



### 5. 网络路径约束（仅 Wi-Fi）

```swift
import Network

let parameters = NWParameters.tcp
parameters.requiredInterfaceType = .wifi  // 仅允许 Wi-Fi

let connection = NWConnection(host: "example.com", port: 80, using: parameters)
```



---

## 六、注意事项

### 1. ⚠️ ATS（App Transport Security）不适用

**ATS 不适用于 Network.framework、CFNetwork 或 BSD Socket 等底层网络接口**。如果使用 Network.framework，需要**自行配置 TLS 安全策略**，例如设置最低 TLS 版本为 1.2：

```swift
let tlsOptions = NWProtocolTLS.Options()
sec_protocol_options_set_min_tls_version(tlsOptions.securityProtocolOptions, .TLSv12)
```

### 2. ⚠️ 系统版本要求

Network.framework 需要 **iOS 12.0+**、macOS 10.14+、tvOS 12.0+、watchOS 6.0+。如果应用需要支持更低版本，必须添加 `@available` 检查。

### 3. ⚠️ 内存管理

- **大文件传输**：传输超大文件（如 600MB）可能导致 Jetsam 内存崩溃，iOS 会因高内存使用而杀死应用
- **循环引用**：在闭包中需注意使用 `[weak self]` 避免循环引用
- **已知内存泄漏**：`NWConnection` 的 `start` 函数在某些版本可能存在内存泄漏，需关注 Apple 的修复更新

### 4. ⚠️ 队列管理

Network.framework 的回调在指定的 `DispatchQueue` 上执行，需要合理选择队列：

```swift
// 使用全局并发队列
connection.start(queue: .global())

// 或使用自定义串行队列
let queue = DispatchQueue(label: "com.app.network")
connection.start(queue: queue)
```

### 5. ⚠️ 连接状态处理

必须妥善处理所有连接状态，特别是 `.failed` 和 `.waiting` 状态，以实现优雅的网络恢复和错误提示。

### 6. ⚠️ 隐私权限

从 iOS 14 开始，访问本地网络需要进行隐私声明并在 `Info.plist` 中添加 `NSLocalNetworkUsageDescription`。

### 7. ⚠️ 与 URLSession 的关系

- **不要混用**：对于 HTTP 请求，应使用 `URLSession`；Network.framework 用于需要直接控制传输层的场景
- `URLSession` 底层已使用 Network.framework，无需重复封装

---

## 总结

Network.framework 是 Apple 为替代传统 BSD Socket 而设计的现代化网络框架，具有智能连接建立、内置 TLS 安全、多路径支持和结构化并发等优势。适用于需要直接控制 TCP/UDP/TLS/QUIC 连接的自定义协议场景。使用时需注意自行配置 TLS 安全策略（ATS 不适用）、系统版本要求、内存管理和隐私权限等关键问题。