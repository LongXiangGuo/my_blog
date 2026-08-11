# README 检查报告

> 检查时间: 2026-08-10
> 对照页面: https://github.com/LongXiangGuo/my_blog
> 检查范围: 项目根目录 `README.md`（含自动生成的 Contents 目录树）

---

## 一、已修复的错别字（直接修复）

以下错别字已直接修复，无需再处理：

| #   | 位置                                                             | 原内容                       | 修复后               | 类型                              |
| --- | ---------------------------------------------------------------- | ---------------------------- | -------------------- | --------------------------------- |
| 1   | README.md 第 11 行                                               | `vitepress,node`             | `vitepress, node`    | 逗号后缺空格                      |
| 2   | `ios/basic/4.class_ vtable.md` → `4.class_vtable.md`             | 文件名含空格 `class_ vtable` | `class_vtable`       | 文件名拼写错误（多余空格）        |
| 3   | `ios/basic/20.swift_marco.md` → `20.swift_macro.md`              | `swift_marco`                | `swift_macro`        | 文件名拼写错误（Marco→Macro）     |
| 4   | `ios/basic/24.design_partten.md` → `24.design_pattern.md`        | `design_partten`             | `design_pattern`     | 文件名拼写错误（partten→pattern） |
| 5   | `ios/functions/17.core_montion.md` → `17.core_motion.md`         | `core_montion`               | `core_motion`        | 文件名拼写错误（montion→motion）  |
| 6   | `flutter/13.offf_screen_capture.md` → `13.off_screen_capture.md` | `offf_screen_capture`        | `off_screen_capture` | 文件名拼写错误（多了一个 f）      |
| 7   | `ios/ito/Network/Bojour.md` → `Bonjour.md`                       | `Bojour`                     | `Bonjour`            | 文件名拼写错误（少了一个 n）      |
| 8   | `llm/tools/4.anythingllvm.md` → `4.anythingllm.md`               | `anythingllvm`               | `anythingllm`        | 文件名拼写错误（llvm→llm）        |

> 备注：以上文件名错别字同时影响 `README.md` 目录树和 `.vitepress/sidebar.generated.mts` 侧边栏配置，均已通过重新生成脚本同步修复。

---

## 二、已修复的格式/显示问题

### 2.1 目录树路径过期（对照 GitHub 页面发现）

**问题**：README.md 的 Contents 目录树和 sidebar 配置中，所有 iOS 硬件相关链接指向 `ios/hardware/...`，但本地实际目录已重命名为 `ios/ito/`。GitHub 上这些链接会 404 无法显示。

**修复**：运行 `node scripts/generate-readme-toc.mjs` 和 `node scripts/generate-sidebar.mjs` 重新生成，路径已更新为 `ios/ito/...`。

### 2.2 目录树缺失文件

**问题**：旧目录树遗漏了大量已存在的文件/目录，GitHub 上无法通过目录树访问。

**缺失的目录/文件（已补全）**：

- `ios/architecture/` 整个目录（DIInject、Modules、Network、Router）
- `ios/av/` 整个目录（ffmpeg、av_foundation、语音降噪、av_audio）
- `ios/basic/13.lock`、`23.background_task`、`24.design_pattern`、`25.swift_ui_test`、`26.app_kit`
- `ios/core/10.upload_app_store`、`11.code_sign`、`9.apm`
- `ios/functions/17.core_motion`
- `ios/graphics/core_image`、`GameplayKit`、`spritekit`
- `tools/brew`
- `security/` 整个目录（brand、ECC、hash、secrets、tee、vault、证书管理、防重放篡改）

**修复**：重新生成目录树，131 个 markdown 文件已全部收录。

### 2.3 sidebar 引用了不存在的文件

**问题**：旧 `sidebar.generated.mts` 中包含大量已删除文件的链接，例如：
- `/ios/hardware/card_type`（不存在）
- `/ios/hardware/CC/Deps`、`MGU`、`SDIP`、`VehicleInfo`（整个 CC 目录已不存在）
- `/ios/hardware/EA/iap2`（不存在，实际为 `EA/EA`）
- `/ios/hardware/BLE/术语`（不存在）

**修复**：重新生成 sidebar，已清除所有无效链接。

---

## 三、待查看的问题备注（未直接修改，需确认）

以下问题非单纯错别字，涉及命名规范或内容设计，需你确认后再处理：

### 3.1 目录树标题大小写不规范（由生成脚本 `toTitle` 函数导致）

目录树标题由 `scripts/generate-readme-toc.mjs` 的 `toTitle()` 函数从文件名自动转换，仅做首字母大写处理，不识别专有缩写。以下标题与 Apple/社区标准写法不一致：

| 当前标题                      | 建议标题                    | 涉及文件/目录                           |
| ----------------------------- | --------------------------- | --------------------------------------- |
| Ios                           | iOS                         | ios/ 目录及所有 ios_ 开头文件           |
| Av / Av Foundation / Av Audio | AV / AVFoundation / AVAudio | ios/av/ 目录                            |
| Ffmpeg                        | FFmpeg                      | ios/av/1.ffmpeg                         |
| Gcd                           | GCD                         | ios/core/6.gcd                          |
| Runloop                       | RunLoop                     | ios/core/5.runloop                      |
| Apm                           | APM                         | ios/core/9.apm                          |
| Swift Ui / Swift Ui Test      | SwiftUI / SwiftUI Test      | ios/basic/16.swift_ui、25.swift_ui_test |
| Ios Frameworks                | iOS Frameworks              | ios/basic/19.ios_frameworks             |
| Ios Memory                    | iOS Memory                  | ios/basic/6.ios_memory                  |
| Ios Rich Text                 | iOS Rich Text               | ios/functions/11.ios_rich_text          |
| Auto Release Pool             | Autorelease Pool            | ios/basic/7.auto_release_pool           |
| Accessory Setupkit            | AccessorySetupKit           | ios/functions/13.accessory_setupkit     |
| Llm Stream Chat               | LLM Stream Chat             | ios/functions/5.llm_stream_chat         |
| Open Gl                       | OpenGL                      | ios/graphics/open_gl                    |
| Spritekit                     | SpriteKit                   | ios/graphics/spritekit                  |
| Ito                           | ITO（或改为中文"硬件"）     | ios/ito/ 目录                           |
| Ai Agent                      | AI Agent                    | ai-agent/ 目录                          |
| Mcp Transport Architecture    | MCP Transport Architecture  | js/mcp-transport-architecture           |
| Llm                           | LLM                         | llm/ 目录                               |
| Anythingllm                   | AnythingLLM                 | llm/tools/4.anythingllm                 |
| Tee                           | TEE                         | security/tee                            |

**建议修复方式**：在 `scripts/generate-readme-toc.mjs` 和 `scripts/generate-sidebar.mjs` 的 `toTitle()` 函数中增加专有名词映射表（如 `{ ios: 'iOS', av: 'AV', gcd: 'GCD', ... }`），而非改文件名。需要我帮你改脚本请告知。

### 3.2 文件编号冲突

**问题**：`ios/basic/` 目录下 `13.combine.md` 和 `13.lock.md` 使用了相同的数字编号 `13`，目录树中两条都会出现但顺序无法区分。

**建议**：将 `13.lock.md` 改为 `14.lock.md`（并顺延后续文件编号），或改为 `13b.lock.md`。

### 3.3 package.json 的 name 字段

**问题**：`package.json` 第 2 行 `"name": "hardware"`，与项目实际内容（博客知识库）不符，疑似遗留值。

**建议**：改为 `"name": "my_blog"`。

### 3.4 README 正文描述较简略

**问题**：第 3 行"本地知识库收集"作为项目简介偏简略，GitHub 仓库页显示时信息量不足。

**建议**（仅供参考，不强制修改）：
```
本地知识库收集 —— 基于 VitePress 搭建的个人技术博客，涵盖 iOS、Flutter、Android、LLM 等领域学习笔记。
```

### 3.5 "更新目录" 命令说明不完整

**问题**：README 第 5-7 行"更新目录"小节只写了 `npm run docs:sidebar`（生成侧边栏），但未提及 `npm run docs:readme-toc`（生成 README 目录树）。两个是不同命令。

**建议**：补充说明，例如：
```
## 更新目录

# 生成侧边栏
npm run docs:sidebar

# 生成 README 目录树
npm run docs:readme-toc
```

---

## 四、修改清单汇总

| 操作       | 文件                                                             | 状态     |
| ---------- | ---------------------------------------------------------------- | -------- |
| 修复错别字 | README.md（`vitepress,node` → `vitepress, node`）                | ✅ 已完成 |
| 重命名     | `ios/basic/4.class_ vtable.md` → `4.class_vtable.md`             | ✅ 已完成 |
| 重命名     | `ios/basic/20.swift_marco.md` → `20.swift_macro.md`              | ✅ 已完成 |
| 重命名     | `ios/basic/24.design_partten.md` → `24.design_pattern.md`        | ✅ 已完成 |
| 重命名     | `ios/functions/17.core_montion.md` → `17.core_motion.md`         | ✅ 已完成 |
| 重命名     | `flutter/13.offf_screen_capture.md` → `13.off_screen_capture.md` | ✅ 已完成 |
| 重命名     | `ios/ito/Network/Bojour.md` → `Bonjour.md`                       | ✅ 已完成 |
| 重命名     | `llm/tools/4.anythingllvm.md` → `4.anythingllm.md`               | ✅ 已完成 |
| 重新生成   | README.md Contents 目录树                                        | ✅ 已完成 |
| 重新生成   | .vitepress/sidebar.generated.mts 侧边栏                          | ✅ 已完成 |
| 待确认     | 标题大小写规范（需改生成脚本）                                   | ⏳ 待确认 |
| 待确认     | 编号冲突 13.combine / 13.lock                                    | ⏳ 待确认 |
| 待确认     | package.json name 字段                                           | ⏳ 待确认 |
| 待确认     | README 正文描述补充                                              | ⏳ 待确认 |
