# 利用大模型流式对话

下面给出一套在 iOS 中使用 **Swift + SwiftUI** 实现大模型流式对话的完整示例代码。它使用 `URLSession` 的 `bytes` 方法解析 Server-Sent Events (SSE)，并将生成的文本逐字显示在界面上。

---

## 1. 网络层：流式请求与解析

```swift
import Foundation

// 假设使用 OpenAI 风格的 API（兼容大多数大模型）
struct ChatMessage: Codable {
    let role: String
    let content: String
}

struct ChatRequest: Codable {
    let model: String
    let messages: [ChatMessage]
    let stream: Bool
}

class StreamingLLMService {
    private let apiKey = "YOUR_API_KEY"
    private let endpoint = "https://api.openai.com/v1/chat/completions"

    func streamChat(messages: [ChatMessage]) async throws -> AsyncThrowingStream<String, Error> {
        var request = URLRequest(url: URL(string: endpoint)!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ChatRequest(model: "gpt-3.5-turbo", messages: messages, stream: true)
        request.httpBody = try JSONEncoder().encode(body)
        
        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        
        return AsyncThrowingStream { continuation in
            var iterator = bytes.lines.makeAsyncIterator()
            Task {
                do {
                    while let line = try await iterator.next() {
                        // SSE 格式: "data: {...}"
                        if line.hasPrefix("data: "), let data = line.dropFirst(6).data(using: .utf8) {
                            if line == "data: [DONE]" {
                                continuation.finish()
                                break
                            }
                            // 解析 JSON 获取 delta.content
                            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                               let choices = json["choices"] as? [[String: Any]],
                               let delta = choices.first?["delta"] as? [String: Any],
                               let content = delta["content"] as? String {
                                continuation.yield(content)
                            }
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
}
```

---

## 2. UI 层：逐字显示 + 打字机效果

```swift
import SwiftUI

struct ChatView: View {
    @State private var userInput = ""
    @State private var assistantReply = ""
    @State private var isStreaming = false
    
    private let service = StreamingLLMService()
    
    var body: some View {
        VStack {
            ScrollView {
                Text(assistantReply)
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Color.gray.opacity(0.1))
            .cornerRadius(12)
            
            HStack {
                TextField("输入问题...", text: $userInput)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .disabled(isStreaming)
                
                Button("发送") {
                    Task { await sendAndStream() }
                }
                .disabled(userInput.trimmingCharacters(in: .whitespaces).isEmpty || isStreaming)
            }
            .padding()
        }
        .padding()
    }
    
    private func sendAndStream() async {
        let question = userInput
        userInput = ""
        assistantReply = ""
        isStreaming = true
        
        let messages = [
            ChatMessage(role: "system", content: "You are a helpful assistant."),
            ChatMessage(role: "user", content: question)
        ]
        
        do {
            let stream = try await service.streamChat(messages: messages)
            for try await chunk in stream {
                // 逐步追加到显示文本（主线程更新 UI）
                await MainActor.run {
                    assistantReply += chunk
                }
            }
        } catch {
            await MainActor.run {
                assistantReply = "出错：\(error.localizedDescription)"
            }
        }
        
        await MainActor.run {
            isStreaming = false
        }
    }
}

// 预览
#Preview {
    ChatView()
}
```

---

## 3. 关键说明

- **流式请求**：`URLSession.shared.bytes(for:)` 返回一个异步的字节序列，逐行读取即可获得 SSE 数据。
- **解析 SSE**：每一行形如 `data: {"choices":[{"delta":{"content":"你"}}]}`，需要提取 `delta.content` 字段。
- **UI 更新**：每收到一个文本块，就通过 `@MainActor.run` 追加到 `assistantReply` 变量中，SwiftUI 会自动重绘视图，形成逐字出现的动画。
- **结束标志**：当收到 `data: [DONE]` 时关闭流。

---

## 4. 适配其他模型

如果你使用的是其他大模型（如国内的智谱、文心、通义等），只需调整：
- API 地址
- 请求体格式（例如有些模型使用 `"messages"` + `"stream"` 字段）
- 响应解析逻辑（关键是找到每次返回的文本片段）

调整上述代码中的 `ChatRequest` 结构体和解析部分即可。

---

## 5. 进阶优化

- **Markdown 渲染**：可使用 `AttributedString` 配合 `Down` 库，在流式过程中逐步渲染。
- **取消流**：引入 `Task.cancel()`，在视图消失或用户点击停止时取消异步任务。
- **错误重试**：在 `catch` 块中加入指数退避重试逻辑。

以上代码可以直接复制到 Xcode 工程中，填入有效 API Key 即可运行。如果需要完整 Demo 工程，可以进一步告知。
在流式对话中渲染 Markdown 的核心挑战是：**需要随着文本块的不断追加，实时、高效地将累积的 Markdown 文本转换为带格式的富文本（如粗体、列表、代码块等）并显示出来**。

下面提供两种主流方案：**原生 `AttributedString`（推荐）** 和 **第三方库 `Down`**。我会以之前的 `ChatView` 为基础给出具体实现。

---

### 方案一：使用原生 `AttributedString`（iOS 15+，无需依赖）

SwiftUI 的 `Text` 可以直接接受从 Markdown 生成的 `AttributedString`。只需在每次收到新 chunk 时重新解析整个 `assistantReply`。

**修改 `ChatView` 中的显示部分：**

```swift
struct ChatView: View {
    // ... 原有属性

    var body: some View {
        VStack {
            ScrollView {
                // 将累积的 Markdown 文本转为 AttributedString 并显示
                if let attributed = try? AttributedString(markdown: assistantReply) {
                    Text(attributed)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    // 容错：解析失败时直接显示纯文本
                    Text(assistantReply)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            // ... 其余 UI
        }
    }
    
    // sendAndStream 函数中的更新部分保持不变
    // 每次收到 chunk 后执行: assistantReply += chunk
}
```

**优点**：  
- 无第三方依赖，系统原生支持  
- 自动处理常见 Markdown 语法（标题、粗体、斜体、列表、代码块、链接等）  

**缺点**：  
- 每次流式更新都会重新解析整个 Markdown 文本（通常可以接受，因为现代设备性能足够）  
- 如果 Markdown 语法不完整（例如还在流式传输中的 `**bold`），`AttributedString(markdown:)` 会抛出异常，导致显示为纯文本。需要上面示例中的 `try?` 容错。

---

### 方案二：使用 `Down` 库（更丰富的渲染控制）

[Down](https://github.com/johnxnguyen/Down) 是一个成熟的 Swift Markdown 渲染库，支持将 Markdown 转为 `NSAttributedString` 或直接渲染为 HTML/UIView。

#### 1. 安装 Down

在 `Podfile` 中添加：  
```ruby
pod 'Down'
```
或使用 Swift Package Manager：  
`https://github.com/johnxnguyen/Down.git`

#### 2. 使用 Down 渲染

```swift
import Down

// 辅助函数：将 Markdown 转为 NSAttributedString
func markdownToAttributed(_ markdown: String) -> NSAttributedString {
    let down = Down(markdownString: markdown)
    // 可选：配置样式
    let styles = DownStyles()
    styles.bodyFont = .preferredFont(forTextStyle: .body)
    styles.codeBlockFont = .monospacedSystemFont(ofSize: 14, weight: .regular)
    
    return (try? down.toAttributedString(styles: styles)) ?? NSAttributedString(string: markdown)
}

// 在 ChatView 中使用
struct ChatView: View {
    @State private var assistantReply = ""
    // 存储渲染后的富文本，避免重复解析（可选优化）
    @State private var attributedReply = NSAttributedString()
    
    var body: some View {
        VStack {
            ScrollView {
                // 使用 UIViewRepresentable 或 SwiftUI 的 Text(AttributedString)
                Text(AttributedString(attributedReply))
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            // ... 发送按钮等
        }
        .onChange(of: assistantReply) { newValue in
            // 每次文本变化时重新渲染（主线程）
            attributedReply = markdownToAttributed(newValue)
        }
    }
    
    private func sendAndStream() async {
        // ... 原有流式逻辑
        for try await chunk in stream {
            await MainActor.run {
                assistantReply += chunk
                // onChange 会自动触发重新渲染
            }
        }
    }
}
```

**优点**：  
- 渲染样式可高度定制（字体、颜色、代码高亮等）  
- 支持更完整的 Markdown 扩展（如表格、脚注）  
- 可以提前缓存部分解析结果，性能稍优  

**缺点**：  
- 引入外部依赖  
- 每次全量重新转换，和原生方案类似。

---

### 关于流式渲染的性能优化

无论哪种方案，每收到一个 chunk 都重新解析整个 Markdown 字符串是简单有效的方法。在绝大多数聊天场景下（文本长度通常不超过几千字符），现代 iPhone 完全能胜任。

如果担心极端长文本（如数万字符）的解析开销，可以采用**增量解析**，但实现复杂（需自行维护 AST 并只更新变化部分）。一般不推荐。

---

### 高级体验：逐字显示且 Markdown 语法完整才渲染

流式传输时，Markdown 语法可能暂时不完整（例如只收到了 `**bold` 的前半部分），导致解析失败而回退到纯文本。为了让体验更平滑，可以：

1. **延迟渲染**：积累一小段时间（比如 200ms）或积累若干 chunk 后再刷新 UI。  
2. **保留原始文本**：始终保留 `assistantReply` 原始 Markdown，显示时先尝试解析，失败则显示纯文本，等下一个 chunk 补齐语法后自动恢复格式。

原生的 `try? AttributedString(markdown:)` 已经实现了第 2 点——解析失败时就显示纯文本，成功时就显示富文本，对用户来说几乎无感知。

---

### 完整代码示例（原生方案）

将之前 `ChatView` 的显示部分替换为下面的代码即可获得带 Markdown 渲染的流式聊天：

```swift
ScrollView {
    if let attributed = try? AttributedString(markdown: assistantReply) {
        Text(attributed)
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
    } else {
        Text(assistantReply)  // 降级纯文本
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
```

无需额外安装库，效果立竿见影。

---

## 最终建议

- **普通聊天场景**：直接用原生 `AttributedString(markdown:)`，简单可靠。  
- **需要代码高亮、自定义样式**：选择 `Down` 或其他库。  
- **追求极致流畅**：可对 Markdown 解析进行节流（例如 `debounce` 50ms），减少 UI 刷新次数，但一般没必要。

如果你需要我提供一个完整的、带 Markdown 渲染且支持流式取消的 Demo 工程代码，可以告诉我，我可以为你整理成可直接运行的 Xcode 项目结构。