## 一、简介

CFNetwork 是 Apple 提供的一个**底层、高性能的 C 语言网络框架**。它是 **BSD Socket 的轻量级封装和扩展**，在保留 Socket 强大控制能力的同时，提供了更便捷的 API 和与 Run Loop 的深度集成。

CFNetwork 由多个相互独立的 API 组成，每个 API 负责一种特定的网络协议或功能。这些 API 可以根据应用需求单独使用，也可以组合使用。

### 与 Network.framework 的关系

在 Apple 的网络框架体系中，CFNetwork 与 Network.framework **处于同一层次**（Core Foundation 层），两者都构建于 BSD Socket 之上：

| 特性             | CFNetwork                      | Network.framework      |
| ---------------- | ------------------------------ | ---------------------- |
| 语言             | C                              | Swift / Objective-C    |
| 引入时间         | 早期 macOS / iOS               | iOS 12+ / macOS 10.14+ |
| API 风格         | Core Foundation 风格（CF*Ref） | 现代面向对象           |
| 与 Run Loop 集成 | 深度集成                       | 使用 DispatchQueue     |

---

## 二、架构图

CFNetwork 在整个 iOS 网络体系中的位置如下图所示：

```
┌─────────────────────────────────────────────────────────────┐
│                      Cocoa 层                              │
│    WebKit / NSURLSession / NSURLConnection / Bonjour       │
│              (基于 CFNetwork 实现)                          │
├─────────────────────────────────────────────────────────────┤
│                Core Foundation 层                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 CFNetwork                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │   │
│  │  │ CFHTTP   │ │ CFFTP    │ │ CFHTTPAuth       │   │   │
│  │  │ API      │ │ API      │ │ API              │   │   │
│  │  └──────────┘ └──────────┘ └──────────────────┘   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │   │
│  │  │ CFHost   │ │ CFNet    │ │ CFNetDiagnostics │   │   │
│  │  │ API      │ │ Services │ │ API              │   │   │
│  │  └──────────┘ └──────────┘ └──────────────────┘   │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │           CFStream API (读写流)                     │   │
│  │      CFReadStream / CFWriteStream                   │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │           CFSocket API (Socket 抽象)                │   │
│  │      BSD Socket 的 Run Loop 集成封装                │   │
│  └──────────────────────┬──────────────────────────────┘   │
├─────────────────────────┼───────────────────────────────────┤
│                    OS 层 (内核空间)                        │
│                   BSD Sockets                             │
└─────────────────────────────────────────────────────────────┘
```

### 架构层次说明

| 层次              | 组件                         | 说明                             |
| ----------------- | ---------------------------- | -------------------------------- |
| **Cocoa 层**      | NSURLSession, WebKit 等      | 高层 API，基于 CFNetwork 实现    |
| **CFNetwork API** | CFHTTP, CFFTP, CFHost 等     | 各独立协议 API，可单独或组合使用 |
| **CFStream**      | CFReadStream / CFWriteStream | 提供设备无关的数据读写能力       |
| **CFSocket**      | CFSocket                     | BSD Socket 的抽象，融入 Run Loop |
| **OS 层**         | BSD Sockets                  | 内核提供的底层 Socket 接口       |

**关键点**：CFStream 实际上是 Core Foundation 的一部分，而非 CFNetwork 的一部分。CFNetwork 建立在 CFStream 和 CFSocket 之上。

---

## 三、底层原理

### 1. 基于 BSD Socket 的封装

CFNetwork **物理上和理论上都基于 BSD Socket**。它并没有重新发明网络通信的底层机制，而是在 BSD Socket 之上提供了更友好的抽象：

- **CFSocket**：对 BSD Socket 的轻量级封装，几乎提供了 BSD Socket 的全部功能
- **CFStream**：在 CFSocket 之上构建的读写流抽象

### 2. Run Loop 集成

CFNetwork 与 BSD Socket 的**核心区别在于 Run Loop 集成**。通过将 Socket 融入 Run Loop：

- 应用可以**在单线程中处理网络事件**，无需额外创建和管理线程
- 网络事件通过 Run Loop 源（Run Loop Source）触发回调
- 与 UI 事件循环自然融合，简化了异步网络编程

### 3. 引用计数内存管理

CFNetwork 使用 Core Foundation 的**引用计数**内存管理模型（CFRetain / CFRelease）。开发者需要手动管理 CF 对象的内存，遵循 **"Create Rule"**：通过 `Create` 或 `Copy` 方法获得的对象，需要用 `CFRelease` 释放。

### 4. 协议栈控制

CFNetwork 提供了对协议栈的**精细控制能力**：
- 可以设置 SSL 连接的 PeerName 和证书验证方式
- 可以控制每个响应包的接收
- 支持 HTTP 认证、Cookie 管理等

---

## 四、应用场景

### 适合使用 CFNetwork 的场景

| 场景                         | 说明                                     |
| ---------------------------- | ---------------------------------------- |
| **自定义协议通信**           | 需要直接控制 Socket 层级的自定义网络协议 |
| **FTP 客户端**               | CFFTP API 原生支持 FTP 协议              |
| **DNS 解析**                 | CFHost API 用于域名解析                  |
| **网络诊断**                 | CFNetDiagnostics API 用于网络问题诊断    |
| **嵌入式设备通信**           | 连接设备创建的 Wi-Fi 热点进行数据传输    |
| **需要精细控制 HTTP 的场景** | 如 SNI 防 DNS 污染等需要底层控制的场景   |

### 不适合的场景

| 场景                         | 推荐方案                                            |
| ---------------------------- | --------------------------------------------------- |
| **普通 HTTP/HTTPS API 请求** | 使用 `URLSession`                                   |
| **现代化 Swift 网络编程**    | 使用 `Network.framework`                            |
| **WebSocket 通信**           | 使用 `URLSessionWebSocketTask` 或 Network.framework |

> **历史参考**：早期的知名网络框架 **ASIHTTPRequest** 就是基于 CFNetwork 封装的。

---

## 五、实现代码

> **注意**：以下代码使用 C 语言和 Core Foundation API，需要导入 `<CFNetwork/CFNetwork.h>`。

### 1. 简单的 HTTP GET 请求

```objective-c
#import <CFNetwork/CFNetwork.h>

// 1. 创建请求
CFStringRef method = CFSTR("GET");
CFStringRef urlStr = CFSTR("http://www.baidu.com");
CFURLRef url = CFURLCreateWithString(kCFAllocatorDefault, urlStr, NULL);
CFHTTPMessageRef request = CFHTTPMessageCreateRequest(kCFAllocatorDefault, 
                                                       method, url, 
                                                       kCFHTTPVersion1_1);

// 2. 设置请求头（可选）
CFHTTPMessageSetHeaderFieldValue(request, CFSTR("User-Agent"), 
                                 CFSTR("CFNetwork/1.0"));

// 3. 创建读取流
CFReadStreamRef readStream = CFReadStreamCreateForHTTPRequest(kCFAllocatorDefault, 
                                                               request);

// 4. 设置流上下文（传入 self 用于回调）
CFStreamClientContext context = {
    0,                      // version
    (__bridge void *)(self), // info
    NULL,                   // retain
    NULL,                   // release
    NULL                    // copyDescription
};

// 5. 设置回调事件
CFOptionFlags events = kCFStreamEventOpenCompleted | 
                       kCFStreamEventHasBytesAvailable | 
                       kCFStreamEventErrorOccurred | 
                       kCFStreamEventEndEncountered;
CFReadStreamSetClient(readStream, events, myCallBack, &context);

// 6. 将流加入 Run Loop
CFReadStreamScheduleWithRunLoop(readStream, CFRunLoopGetCurrent(), 
                                kCFRunLoopCommonModes);

// 7. 打开流
CFReadStreamOpen(readStream);

// 8. 释放不再需要的对象
CFRelease(request);
CFRelease(url);
```

### 2. 回调函数实现

```objective-c
void myCallBack(CFReadStreamRef stream, CFStreamEventType type, 
                void *clientCallBackInfo) {
    // 获取传入的对象
    MyViewController *self = (__bridge MyViewController *)clientCallBackInfo;
    
    switch (type) {
        case kCFStreamEventOpenCompleted:
            NSLog(@"流已打开");
            break;
            
        case kCFStreamEventHasBytesAvailable: {
            // 读取数据
            UInt8 buffer[1024];
            CFIndex bytesRead = CFReadStreamRead(stream, buffer, 1024);
            if (bytesRead > 0) {
                NSData *data = [NSData dataWithBytes:buffer length:bytesRead];
                [self appendData:data];
            }
            break;
        }
            
        case kCFStreamEventErrorOccurred: {
            CFErrorRef error = CFReadStreamCopyError(stream);
            NSLog(@"错误: %@", CFErrorCopyDescription(error));
            CFRelease(error);
            break;
        }
            
        case kCFStreamEventEndEncountered:
            NSLog(@"数据接收完成");
            // 关闭流
            CFReadStreamClose(stream);
            // 从 Run Loop 移除
            CFReadStreamUnscheduleFromRunLoop(stream, CFRunLoopGetCurrent(), 
                                              kCFRunLoopCommonModes);
            [self handleComplete];
            break;
            
        default:
            break;
    }
}
```



### 3. POST 请求（带请求体）

```objective-c
// 创建 POST 请求
CFStringRef method = CFSTR("POST");
CFURLRef url = CFURLCreateWithString(kCFAllocatorDefault, 
                                      CFSTR("http://example.com/api"), NULL);
CFHTTPMessageRef request = CFHTTPMessageCreateRequest(kCFAllocatorDefault, 
                                                       method, url, 
                                                       kCFHTTPVersion1_1);

// 设置请求体
NSString *bodyString = @"key1=value1&key2=value2";
NSData *bodyData = [bodyString dataUsingEncoding:NSUTF8StringEncoding];
CFHTTPMessageSetBody(request, (CFDataRef)bodyData);

// 设置 Content-Type
CFHTTPMessageSetHeaderFieldValue(request, 
                                 CFSTR("Content-Type"), 
                                 CFSTR("application/x-www-form-urlencoded"));

// 后续步骤与 GET 请求相同...
```



### 4. DNS 解析（CFHost）

```objective-c
#import <netinet/in.h>
#import <arpa/inet.h>

CFStringRef hostname = CFSTR("www.apple.com");
CFHostRef host = CFHostCreateWithName(kCFAllocatorDefault, hostname);

CFStreamError error;
Boolean success = CFHostStartInfoResolution(host, kCFHostAddresses, &error);

if (success) {
    CFArrayRef addresses = CFHostGetAddresses(host, NULL);
    for (CFIndex i = 0; i < CFArrayGetCount(addresses); i++) {
        NSData *addrData = (NSData *)CFArrayGetValueAtIndex(addresses, i);
        struct sockaddr_in *addr = (struct sockaddr_in *)[addrData bytes];
        char *ip = inet_ntoa(addr->sin_addr);
        NSLog(@"解析到 IP: %s", ip);
    }
}

CFRelease(host);
```



---

## 六、注意事项

### 1. ⚠️ ATS（App Transport Security）不适用

**ATS 不适用于 CFNetwork、Network.framework 或 BSD Socket 等底层网络接口**。如果使用 CFNetwork 进行网络通信，需要**自行配置 TLS 安全策略**，确保使用强 TLS 设置。

### 2. ⚠️ 手动内存管理

CFNetwork 使用 Core Foundation 的引用计数模型，需要**手动管理 CF 对象的内存**：

```objective-c
// 创建的对象需要释放
CFURLRef url = CFURLCreateWithString(...);
// ... 使用 url ...
CFRelease(url);  // ⚠️ 必须释放

// 从函数返回的对象，如果不持有则不需要释放
CFStringRef description = CFErrorCopyDescription(error);
// ... 使用 ...
CFRelease(description);  // ⚠️ Copy 获得的对象也需要释放
```

### 3. ⚠️ Run Loop 依赖

CFNetwork 的网络事件依赖于 **Run Loop** 来驱动：

- 必须将流添加到 Run Loop 中（`CFReadStreamScheduleWithRunLoop`）
- 必须在有 Run Loop 的线程上使用（主线程或手动创建的 Run Loop）
- 如果使用子线程，需要**手动启动 Run Loop**（`CFRunLoopRun()`）

### 4. ⚠️ 流数据的单向性

Stream 是**单向**的，数据一旦被读取消费，就无法重新获取。如果需要双向通信，需要同时创建读流（CFReadStream）和写流（CFWriteStream）。

### 5. ⚠️ 系统版本兼容性

CFNetwork 是**历史悠久**的框架，在所有支持 iOS/macOS 的系统版本上均可使用。但部分 API 可能在较新系统上被标记为弃用（Deprecated），建议查阅最新官方文档确认。

### 6. ⚠️ 线程安全

CFNetwork 的多数 API **不是线程安全**的。建议：
- 在**单一线程**（通常是主线程）上操作 CFNetwork 对象
- 或将所有操作集中在**同一个 Run Loop** 上

### 7. ⚠️ 错误处理

必须妥善处理各种网络错误：

```objective-c
case kCFStreamEventErrorOccurred: {
    CFErrorRef error = CFReadStreamCopyError(stream);
    CFStringRef domain = CFErrorGetDomain(error);
    CFIndex code = CFErrorGetCode(error);
    // domain == kCFStreamErrorDomainPOSIX 时，code 为 UNIX errno 值
    CFRelease(error);
    break;
}
```

### 8. ⚠️ 与高层框架的关系

- **不要混用**：对于普通 HTTP 请求，优先使用 `URLSession`
- CFNetwork 是 `URLSession` 等高层框架的**底层实现**，直接使用 CFNetwork 意味着需要处理更多细节（重定向、缓存、解码等）

### 9. ⚠️ 调试支持

Apple 提供了 CFNetwork 的诊断日志功能，可通过设置环境变量 `CFNETWORK`（值 0-3）来开启，有助于调试网络问题。

---

## 总结

CFNetwork 是 Apple 网络栈中**承上启下**的关键框架——它构建于 BSD Socket 之上，又被 Cocoa 层的高层网络 API（如 URLSession）所依赖。它以 C 语言提供了一套**精细控制协议栈**的能力，适用于需要底层网络控制但不希望直接操作 BSD Socket 的场景。使用时需特别注意**手动内存管理、Run Loop 集成、ATS 不适用**等关键问题。对于大多数日常开发需求，建议优先使用 `URLSession` 或 `Network.framework`。