# Core Image 技术全景指南

> 一份系统化的 Core Image 框架完整技术文档，从核心概念到实战应用

---

## 第一部分：框架概述与核心哲学

### 1.1 Core Image 是什么

Core Image 是 Apple 生态系统中一个高性能的图像与视频处理框架。它提供了一套完整的图像处理管道，包括：

- **超过 150 种内置滤镜**（模糊、颜色调整、扭曲、合成等）
- **GPU 加速**（基于 Metal 后端）
- **自定义扩展能力**（通过 Metal Shading Language 编写内核）
- **智能图像分析**（与 Vision 框架协同）
- **RAW 格式处理**（专业摄影工作流支持）

### 1.2 设计哲学：惰性求值（Lazy Evaluation）

Core Image 的核心设计理念是**惰性求值**——所有滤镜操作不会立即执行，而是在 `CIContext` 渲染时才被计算。

**生活化类比：做菜 vs 写菜谱**

| 命令式编程（立即执行）                           | 声明式编程（惰性求值）                       |
| :----------------------------------------------- | :------------------------------------------- |
| 走进厨房，洗菜、切菜、下锅，每一步都产生实际结果 | 在一张纸上写下菜谱步骤，这张纸就是 `CIImage` |
| 发现错误只能重做                                 | `CIContext` 审视整个菜谱后优化流程再执行     |
| 无法全局优化                                     | 可以合并操作、跳过不必要计算                 |

**三大性能优势**：

1. **自动合并操作（Kernel Fusion）**：将多个滤镜合并为一次 GPU 调用，减少中间纹理读写
2. **避免不必要计算（ROI 机制）**：只计算最终输出所需的像素
3. **执行顺序优化**：利用 GPU 并行能力同时执行独立操作

---

## 第二部分：三大核心类

### 2.1 CIContext — 渲染引擎

`CIContext` 是 Core Image 的"渲染引擎"，负责将 `CIImage` 这个"配方"最终变成像素。它是一个**重量级的、有状态的渲染器**，创建开销很大，应在应用中**复用同一个实例**。

#### 核心内部状态（由系统管理）

| 内部组件                         | 作用                                                        |
| :------------------------------- | :---------------------------------------------------------- |
| GPU/CPU 渲染管线与命令队列       | 封装与底层图形 API（Metal）交互的所有状态，负责调度渲染命令 |
| 编译后的内核缓存（Kernel Cache） | 缓存已编译的 GPU 程序，避免重复编译开销                     |
| 中间缓存与纹理池                 | 缓存中间处理结果（`CVPixelBuffer` 或纹理）以便复用          |

#### CIContextOption — 创建参数详解

**① 颜色与格式管理**

| 参数 Key              | 值类型                     | 默认值             | 作用与说明                                                                         |
| :-------------------- | :------------------------- | :----------------- | :--------------------------------------------------------------------------------- |
| `workingColorSpace`   | `CGColorSpace` 或 `NSNull` | 扩展线性 sRGB      | 所有滤镜处理在此颜色空间中进行。传入 `NSNull` 将完全禁用 Core Image 的自动颜色管理 |
| `outputColorSpace`    | `CGColorSpace` 或 `NSNull` | 未指定时由目标决定 | 最终输出图像的颜色空间。Core Image 会将结果从 `workingColorSpace` 转换到此空间     |
| `workingFormat`       | `CIFormat` (NSNumber)      | `RGBAf` (32位浮点) | 中间计算过程使用的像素格式。更高精度（`RGBAf`）保真度更好但更耗性能和内存          |
| `outputPremultiplied` | `Bool` (NSNumber)          | `false`            | 控制输出像素是否预乘 Alpha                                                         |

**② 性能与内存优化**

| 参数 Key                | 值类型            | 默认值     | 作用与说明                                                                |
| :---------------------- | :---------------- | :--------- | :------------------------------------------------------------------------ |
| `cacheIntermediates`    | `Bool` (NSNumber) | `true`     | 是否缓存中间渲染结果。`true` 提升重复渲染性能，`false` 节省内存           |
| `memoryTarget`          | `Int` (NSNumber)  | 系统自适应 | 为渲染任务分配的最大内存（MB）。增大可提升性能但增加内存占用              |
| `highQualityDownsample` | `Bool` (NSNumber) | `false`    | 控制下采样质量。`true` 为高质量多 Pass 渲染，`false` 为高性能单 Pass 渲染 |

**③ 渲染策略与硬件控制**

| 参数 Key              | 值类型            | 默认值  | 作用与说明                                           |
| :-------------------- | :---------------- | :------ | :--------------------------------------------------- |
| `useSoftwareRenderer` | `Bool` (NSNumber) | `false` | 强制使用 CPU 软件渲染。CPU 渲染在某些场景下精度更高  |
| `allowLowPower`       | `Bool` (NSNumber) | `false` | 在多 GPU 设备上允许使用低功耗 GPU                    |
| `priorityRequestLow`  | `Bool` (NSNumber) | `false` | 以低优先级执行渲染任务，避免影响 UI 主线程动画流畅度 |

**④ 其他参数**

| 参数 Key              | 值类型            | 作用                                                             |
| :-------------------- | :---------------- | :--------------------------------------------------------------- |
| `name`                | `String`          | 为 `CIContext` 设置名称，方便调试和性能分析                      |
| `cvMetalTextureCache` | `MTLTextureCache` | 提供 Core Video 的 Metal 纹理缓存，提升 `CVPixelBuffer` 处理性能 |

#### 主要初始化方法

| 方法                       | 说明                                                |
| :------------------------- | :-------------------------------------------------- |
| `init()`                   | 使用默认选项初始化                                  |
| `init(options:)`           | 最常用，通过 `[CIContextOption: Any]` 字典传入配置  |
| `init(mtlDevice:options:)` | 指定 `MTLDevice` 创建基于 Metal 的上下文            |
| `init(cgContext:options:)` | 从 Core Graphics 上下文创建，用于渲染到 `CGContext` |

#### 主要渲染方法

| 方法                              | 参数                       | 返回值     | 说明                      |
| :-------------------------------- | :------------------------- | :--------- | :------------------------ |
| `createCGImage(_:from:)`          | `CIImage`, `CGRect`        | `CGImage?` | 将 CIImage 渲染为 CGImage |
| `render(_:to:)`                   | `CIImage`, `CVPixelBuffer` | `void`     | 渲染到像素缓冲区          |
| `render(_:toBitmap:rowBytes:...)` | 多个参数                   | `void`     | 渲染到位图数据            |

### 2.2 CIImage — 图像配方

`CIImage` 是 Core Image 处理或生成图像的**抽象表示**，它本身不包含像素数据，而是一组"**图像配方**"（image recipe）——即如何生成图像的指令集。

**核心特性**：
- 不可变对象，线程安全
- 采用惰性求值，只有在渲染时才真正生成图像
- 可从多种来源创建：磁盘文件、`NSData`、`CVPixelBuffer`、`CGImage` 等

#### 主要创建方法

| 方法                           | 参数                             | 说明                                  |
| :----------------------------- | :------------------------------- | :------------------------------------ |
| `init(cgImage:)`               | `CGImage`                        | 从 Core Graphics 图像创建             |
| `init(color:)`                 | `CIColor`                        | 从颜色创建单色图像                    |
| `init(contentsOf:)`            | `URL`                            | 从 URL 加载图像                       |
| `init(data:)`                  | `NSData`                         | 从数据创建图像                        |
| `init(cvPixelBuffer:options:)` | `CVPixelBuffer`, `[String:Any]?` | 从 CoreVideo 像素缓冲区创建（零拷贝） |

#### 主要操作方法

| 方法                                | 参数                      | 返回值    | 说明                       |
| :---------------------------------- | :------------------------ | :-------- | :------------------------- |
| `applyingFilter(_:withParameters:)` | `String`, `[String:Any]?` | `CIImage` | 对图像应用指定滤镜         |
| `cropped(to:)`                      | `CGRect`                  | `CIImage` | 裁剪图像到指定区域         |
| `clampingToExtent()`                | 无                        | `CIImage` | 将图像边缘像素向外无限延伸 |
| `imageBySamplingNearest()`          | 无                        | `CIImage` | 使用最近邻采样             |
| `settingProperties(_:)`             | `[String:Any]`            | `CIImage` | 覆盖图像的元数据属性       |

### 2.3 CIFilter — 图像处理器

`CIFilter` 是 Core Image 的核心滤镜类，通过对一个或多个输入图像进行操作或生成新图像数据来产生输出图像。

**重要特性**：
- `CIFilter` 对象是**可变的**，不能在多线程间安全共享
- 通过**键值对（KVC）**来设置和获取参数
- 每个滤镜的参数可通过 `attributes` 方法查询

#### 主要属性与方法

| 属性/方法                  | 说明                     |
| :------------------------- | :----------------------- |
| `inputImage: CIImage?`     | 滤镜的输入图像           |
| `outputImage: CIImage?`    | 滤镜的输出图像（只读）   |
| `init(name:)`              | 通过滤镜名称创建滤镜实例 |
| `attributes`               | 获取滤镜的所有属性字典   |
| `setValue(_:forKey:)`      | 通过 KVC 设置参数值      |
| `value(forKey:)`           | 通过 KVC 获取参数值      |
| `inputKeys` / `outputKeys` | 获取所有输入/输出键名称  |

#### 类型安全的滤镜 API（iOS 13+ / macOS 10.15+）

```objc
// 传统 KVC 方式
CIFilter *filter = [CIFilter filterWithName:@"CIFalseColor"];
[filter setValue:inputImage forKey:kCIInputImageKey];

// 类型安全方式
CIFilter<CIFalseColor> *filter = CIFilter.falseColorFilter;
filter.inputImage = inputImage;
filter.color0 = [CIColor colorWithRed:1 green:1 blue:0];
```

---

## 第三部分：辅助数据类型

### 3.1 CIColor — 颜色对象

Core Image 的颜色类，包含颜色值和颜色空间引用。所有颜色分量值范围均为 0.0 到 1.0。

| 属性                               | 类型            | 说明                         |
| :--------------------------------- | :-------------- | :--------------------------- |
| `red` / `green` / `blue` / `alpha` | `CGFloat`       | 各通道值                     |
| `components`                       | `[CGFloat]`     | 所有颜色分量（含 alpha）数组 |
| `colorSpace`                       | `CGColorSpace?` | 颜色的颜色空间               |
| `numberOfComponents`               | `Int`           | 分量数量                     |

| 方法                                     | 说明                     |
| :--------------------------------------- | :----------------------- |
| `init(red:green:blue:alpha:)`            | 创建 RGB 颜色            |
| `init(red:green:blue:alpha:colorSpace:)` | 在指定颜色空间中创建颜色 |
| `init(cgColor:)`                         | 从 CGColor 创建          |
| `colorWithString(_:)`                    | 从字符串解析颜色         |

### 3.2 CIVector — 向量对象

可存储一个或多个 `CGFloat` 值，用于表示坐标点、方向向量、几何矩形、变换矩阵、卷积权重等。

| 属性                           | 说明                       |
| :----------------------------- | :------------------------- |
| `count: Int`                   | 向量中元素数量             |
| `X` / `Y` / `Z` / `W: CGFloat` | 前四个分量                 |
| `point: CGPoint`               | 由 (X, Y) 表示的点         |
| `rectangle: CGRect`            | 由 (X, Y, Z, W) 表示的矩形 |

| 方法                       | 说明                     |
| :------------------------- | :----------------------- |
| `init(x:y:)`               | 创建二维向量             |
| `init(x:y:z:w:)`           | 创建四维向量             |
| `init(cgAffineTransform:)` | 从仿射变换创建（6 个值） |
| `init(string:)`            | 从字符串解析向量         |
| `value(at:)`               | 获取指定位置的值         |

### 3.3 CISampler — 图像数据读取器

`CISampler` 本身不处理图像，而是为 `CIKernel` 提供**标准化的像素读取服务**。它定义了当内核需要读取某个坐标的像素时，具体该如何操作。

| 功能           | 说明                                                                                                                               |
| :------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **采样与插值** | 读取非整数坐标时，通过插值计算颜色值。默认双线性插值，可指定最近邻插值                                                             |
| **环绕模式**   | 定义超出图像边界时的处理方式：`kCISamplerWrapClamp`（拉伸边缘）、`kCISamplerWrapMirror`（镜像）、`kCISamplerWrapBlack`（返回黑色） |
| **坐标变换**   | 可对采样坐标应用变换（缩放、旋转），让内核"看到"经过变换的图像                                                                     |

---

## 第四部分：自定义滤镜系统

### 4.1 插件架构

Core Image 采用插件架构，允许开发者编写自定义滤镜并与系统滤镜无缝集成。

#### 核心组件

| 组件                                   | 职责                                                     |
| :------------------------------------- | :------------------------------------------------------- |
| **`CIFilter`** (自定义滤镜)            | 插件的基本单元，通过子类化 `CIFilter` 封装图像处理逻辑   |
| **`CIKernel`** (处理核心)              | 滤镜的"发动机"，负责实际的计算                           |
| **`CIFilterConstructor`** (滤镜构造器) | 协议，当有人通过名字请求滤镜时返回正确的 `CIFilter` 实例 |
| **Image Unit** (图像单元)              | macOS 上分发插件的打包格式（`.plugin` 后缀的文件夹）     |
| **`CIPlugIn`** (插件加载器)            | 系统级机制，在标准目录中发现和加载 `.plugin` 包          |

> **注意**：iOS 上出于安全考虑，不支持将自定义滤镜打包为 Image Unit 全局加载。自定义滤镜只能作为 App 的一部分内部使用。

#### 工作流程

1. **开发者创建**：编写内核代码 → 创建 `CIFilter` 子类 → 创建 `CIFilterConstructor` → 实现 `CIPlugInRegistration` 协议
2. **打包分发**：使用 Xcode 的 Image Unit Plugin 模板编译为 `.plugin` 文件
3. **用户安装**：放入系统的 Image Units 目录（如 `~/Library/Graphics/Image Units`）
4. **App 加载与发现**：`CIPlugIn` 扫描目录 → 加载插件 → 注册滤镜
5. **App 使用滤镜**：通过 `[CIFilter filterWithName:@"MyCustomFilter"]` 像使用系统滤镜一样调用

### 4.2 四种内核类型

| 内核类型            | 处理对象          | 返回类型 | 输入图像          | 作用与示例                                       |
| :------------------ | :---------------- | :------- | :---------------- | :----------------------------------------------- |
| **`CIKernel`**      | 通用（颜色/位置） | `float4` | 一个或多个        | 最通用的内核，可同时处理像素的颜色和位置         |
| **`CIColorKernel`** | 颜色信息          | `float4` | 零个或多个        | 仅处理像素颜色，不改变位置。用于亮度、对比度调整 |
| **`CIWarpKernel`**  | 几何信息（位置）  | `float2` | 恰好一个          | 仅改变像素位置（几何形变）。用于扭曲、旋转、翻转 |
| **`CIBlendKernel`** | 颜色信息（混合）  | `float4` | 两个（前景/背景） | 专门用于混合两个图像。用于叠加、相乘、变暗       |

> **补充**：还有 `CIImageProcessorKernel`，提供对底层像素数据的直接访问，适用于更复杂的处理流程。

### 4.3 内核代码编写

Core Image 内核目前主要有两种写法：**传统的 Core Image Kernel Language (CIKL)** 和现在**主流的 Metal Shading Language (MSL)**。Apple 推荐使用 MSL，它更现代，能在编译时就发现错误。

#### 4.3.1 基础示例：`do_nothing` 内核

**Metal Shading Language (MSL) — 现代推荐写法**

```cpp
#include <CoreImage/CoreImage.h>

using namespace coreimage;

extern "C" {
    float4 do_nothing(sample_t s) { 
        return s;  // 直接返回输入的像素颜色
    }
}
```

| 类型         | 说明                                                     |
| :----------- | :------------------------------------------------------- |
| `sample_t s` | 代表从输入图像中采样的一个像素的颜色值，是 `float4` 类型 |
| `float4`     | 四维向量，分别代表 R、G、B、A 通道，值范围 0.0 到 1.0    |

**Core Image Kernel Language (CIKL) — 传统写法**

```glsl
kernel vec4 do_nothing(__sample s) { 
    return s.rgba;  // 返回输入像素的 RGBA 值
}
```

#### 4.3.2 CIColorKernel 示例：黑白滤镜

```cpp
#include <CoreImage/CoreImage.h>
using namespace coreimage;

extern "C" {
    float4 blackAndWhite(sample_t s) {
        // 亮度公式：Y = 0.299×R + 0.587×G + 0.114×B
        float luminance = dot(s.rgb, float3(0.299, 0.587, 0.114));
        return float4(luminance, luminance, luminance, s.a);
    }
}
```

**`dot` 算法详解**：

`dot` 是向量点积运算，数学上定义为：
$$\text{dot}(a, b) = a.x \cdot b.x + a.y \cdot b.y + a.z \cdot b.z$$

亮度权重系数来源于 **ITU-R BT.709 标准**，根据人眼对不同颜色敏感度的不同，将 RGB 转换为亮度 Y。人眼对绿色最敏感、对蓝色最不敏感。

#### 4.3.3 CIWarpKernel 示例：垂直翻转

```cpp
#include <CoreImage/CoreImage.h>
using namespace coreimage;

extern "C" {
    float2 flipVertical(float2 destination, sampler src) {
        float2 destCoord = destination;
        float height = src.extent().z;  // 获取源图像高度
        float2 sourceCoord = float2(destCoord.x, height - destCoord.y);
        return sourceCoord;  // 返回源坐标，Core Image 会去这里取样
    }
}
```

| 参数                 | 说明                                                      |
| :------------------- | :-------------------------------------------------------- |
| `float2 destination` | `CIWarpKernel` 特有参数，表示目标图像中当前处理的像素坐标 |
| `sampler src`        | 输入图像的采样器，可获取图像尺寸等信息                    |
| `src.extent().z`     | 获取输入图像的高度                                        |

#### 4.3.4 CIBlendKernel 示例：平均混合

```cpp
#include <CoreImage/CoreImage.h>
using namespace coreimage;

extern "C" {
    float4 averageBlend(sample_t foreground, sample_t background) {
        return (foreground + background) * 0.5f;
    }
}
```

### 4.4 Swift 中加载与使用内核

#### 项目配置：Xcode 构建规则

在项目的 **Build Rules** 选项卡中，为 `*.ci.metal` 文件添加自定义规则：

```bash
mkdir -p "${DERIVED_FILE_DIR}/compiled"
metal -c -fcikernel -target air64 -I . -o "${DERIVED_FILE_DIR}/compiled/${INPUT_FILE_NAME}.air" "${INPUT_FILE_DIR}/${INPUT_FILE_NAME}"
```

#### Swift 加载代码

```swift
import CoreImage

class MyBlackAndWhiteFilter: CIFilter {
    @objc dynamic var inputImage: CIImage?

    private static let kernel: CIColorKernel = {
        guard let url = Bundle.main.url(forResource: "MyKernels", 
                                         withExtension: "ci.metallib"),
              let data = try? Data(contentsOf: url) else {
            fatalError("无法加载内核库文件")
        }
        guard let kernel = CIColorKernel(functionName: "blackAndWhite",
                                         fromMetalLibraryData: data) else {
            fatalError("无法创建内核")
        }
        return kernel
    }()

    override var outputImage: CIImage? {
        guard let inputImage = inputImage else { return nil }
        return Self.kernel.apply(extent: inputImage.extent,
                                 arguments: [inputImage])
    }
}
```

#### 多参数内核示例

**内核代码**：
```cpp
float4 adjustBrightness(sample_t s, float brightness) {
    return s + float4(brightness, brightness, brightness, 0.0);
}
```

**Swift 调用**：
```swift
arguments: [inputImage, 0.2]  // 依次对应 s 和 brightness
```

### 4.5 内核函数原理与运行机制

**什么是内核函数？**

内核函数本质上是在 **GPU 上执行的并行计算函数**。它将整个图像视为一个二维网格，每个像素对应一个 GPU 线程，内核函数被大量核心同时调用，每个线程处理一个像素，实现**大规模并行加速**。

**执行流程**：

1. 调用 `kernel.apply(...)` 时，不立即执行，而是返回一个 `CIImage` 对象（记录指令）
2. 最终渲染时，Core Image 构建完整的处理图（render graph）进行优化
3. 合并相邻操作（Kernel Fusion）
4. 将内核编译/调度到 GPU 执行
5. 自动处理 ROI（Region of Interest）裁剪和缓存

**与 OpenGL 运行时编译着色器的对比**：

| 对比维度 | Core Image 内核                                   | OpenGL 运行时编译着色器                              |
| :------- | :------------------------------------------------ | :--------------------------------------------------- |
| 抽象层次 | 高。封装了渲染管道、缓存、色彩管理、自动 ROI 优化 | 低。需手动管理顶点/片元着色器、帧缓冲对象            |
| 编译时机 | 预先编译为 `.metallib`，运行时直接加载二进制      | 运行时调用 `glShaderSource` + `glCompileShader` 编译 |
| 错误处理 | 编译错误在 Xcode 构建阶段发现                     | 运行时编译错误只能运行时捕获                         |
| 性能优化 | 可对处理图进行全局优化（合并多个滤镜）            | 优化需开发者自行实现                                 |

### 4.6 常用算法与公式

**颜色处理 (CIColorKernel)**

| 效果       | 公式                                              |
| :--------- | :------------------------------------------------ |
| 灰度转换   | `luminance = 0.299×R + 0.587×G + 0.114×B`         |
| 对比度调整 | `result.rgb = (color.rgb - 0.5) × contrast + 0.5` |
| 颜色反转   | `result.rgb = 1.0 - color.rgb`                    |

**几何变换 (CIWarpKernel)**

| 效果     | 算法                                                     |
| :------- | :------------------------------------------------------- |
| 垂直翻转 | `sourceCoord = (destCoord.x, imageHeight - destCoord.y)` |
| 旋涡效果 | 根据像素到中心的距离和角度，计算新的极坐标位置           |

**图像混合 (CIBlendKernel)**

| 效果     | 公式                                               |
| :------- | :------------------------------------------------- |
| 正片叠底 | `result = foreground × background`                 |
| 屏幕     | `result = 1 - (1 - foreground) × (1 - background)` |
| 差值     | `result = abs(foreground - background)`            |
| 平均值   | `result = (foreground + background) / 2`           |

**卷积操作**：通过权重矩阵与每个像素及其邻域进行运算
- **模糊**：权重矩阵元素均为正值，中心权重最大
- **锐化**：中心权重为正，周围为负
- **边缘检测**：梯度算子（如 Sobel 算子）

---

## 第五部分：颜色管理深度解析

### 5.1 色彩空间的核心概念

**什么是色彩空间？**

色彩空间是一套**用数字来定义颜色的"字典"或"坐标系"**。它是一个**抽象的数学概念**，而不是物理概念。

> **重要澄清**：色彩空间中的"空间"是**数学坐标空间**（如三维坐标系），**不是**屏幕上红绿蓝子像素的物理排列布局图。子像素排列是**物理硬件**概念，只影响显示清晰度，不影响颜色准确度。

**RGB 色彩空间的三个核心要素**：

| 要素                           | 说明                                                                                            |
| :----------------------------- | :---------------------------------------------------------------------------------------------- |
| **色域 (Gamut)**               | 一个色彩空间所能表达的所有颜色的范围。用 CIE 色度图上的三角形表示，顶点为该空间的三原色色度坐标 |
| **伽玛校正曲线 (Gamma Curve)** | 非线性色调映射曲线，匹配人眼对暗部变化更敏感的特性                                              |
| **白点 (White Point)**         | 纯白色（RGB 值均为最大值）在该空间中的颜色。如 D65 标准白点模拟正午阳光色温                     |

### 5.2 主流色彩空间对比

| 色彩空间         | 开发者 / 动机                          | 色域大小                       | 适用场景                                  | 缺点                       |
| :--------------- | :------------------------------------- | :----------------------------- | :---------------------------------------- | :------------------------- |
| **sRGB**         | 惠普 + 微软 (1996)，统一早期显示器标准 | 最小                           | 互联网、日常照片、消费级电子设备          | 色域狭窄，尤其在青绿色区域 |
| **Adobe RGB**    | Adobe (1998)，专业摄影和高质量印刷     | 比 sRGB 大，青绿色扩展明显     | 专业摄影后期、高端打印                    | 在不支持的显示器上色彩暗淡 |
| **DCI-P3**       | 电影电视工程师协会 (2007)，数字影院    | 比 sRGB 大约 25%，红绿色域更广 | 数字电影、HDR 视频、现代高端显示设备      | 仍小于 Adobe RGB           |
| **ProPhoto RGB** | 柯达，覆盖几乎所有自然界颜色           | 极大，远超人类色域             | 专业摄影"工作空间"（如 Adobe Camera Raw） | 不适合直接输出，必须转换   |

### 5.3 选择建议

| 场景                                   | 推荐色彩空间                               |
| :------------------------------------- | :----------------------------------------- |
| 追求最广泛的兼容性                     | sRGB                                       |
| 为现代数字电影、HDR 视频或苹果设备创作 | DCI-P3 / Display P3                        |
| 专业摄影且作品需高质量印刷             | Adobe RGB                                  |
| 顶级专业修图，追求极致色彩保真度       | ProPhoto RGB（编辑）+ 目标设备转换（输出） |

### 5.4 像素格式详解

Core Image 中三种常见的 32 位像素内存布局（每通道 8 位，共 4 字节）：

| 格式常量             | 内存字节顺序 | Alpha 位置          | 说明                                                     |
| :------------------- | :----------- | :------------------ | :------------------------------------------------------- |
| **`kCIFormatRGBA8`** | R, G, B, A   | 末尾 (第4字节)      | 标准现代布局，Alpha 有效。Metal 高度优化，**首选**       |
| **`kCIFormatARGB8`** | A, R, G, B   | 开头 (第1字节)      | 传统 Mac/Quartz 布局，Alpha 有效。需字节混洗，有性能开销 |
| **`kCIFormatRGBX8`** | R, G, B, X   | 无（第4字节为占位） | **Alpha 无效/被忽略**，X 仅为填充字节。视为完全不透明    |

**实战注意事项**：

1. **颜色完全错乱**：使用错误的格式会导通道混洗，图像变得花花绿绿
2. **透明效果失效**：使用 `kCIFormatRGBX8` 进行合成时，叠加结果会完全盖住背景
3. **性能建议**：现代 Apple 芯片上，`kCIFormatRGBA8` 最优；`kCIFormatARGB8` 建议仅用于兼容老旧 CGContext

---

## 第六部分：性能优化与底层机制

### 6.1 惰性求值的代码层面解析

**`CIImage` 的内部结构：操作图（Node Graph）**

```swift
let input = CIImage(image: uiImage)!
let blurred = input.applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 10])
let adjusted = blurred.applyingFilter("CIColorControls", parameters: [kCIInputContrastKey: 1.5])
let cropped = adjusted.cropped(to: CGRect(x: 0, y: 0, width: 200, height: 200))
```

底层形成**有向无环图（DAG）**：
- **图像源节点**：持有 `CGImage`、`CVPixelBuffer`、URL 等数据源引用
- **滤镜操作节点**：持有 `CIFilter` 实例及参数，指向输入节点引用
- **几何操作节点**：裁剪、变换等

这些节点**不持有任何像素数据**，只记录操作指令和依赖关系。

**`CIContext` 渲染流程**：

1. **图遍历与优化（前端）**：
   - **节点合并（Kernel Fusion）**：将相邻的可合并滤镜组合成一个自定义 GPU 内核
   - **裁剪传播（ROI 推导）**：从输出区域反向传播，计算每个节点实际需要的输入区域

2. **编译与调度（后端）**：
   - 生成 GPU 绘制命令（或 CPU 处理命令）
   - 分配纹理内存（合并后无需中间纹理则省略）
   - 提交命令到 GPU 命令队列

3. **数据绑定与执行**：
   - 输入数据上传到 GPU（利用 `CVPixelBuffer` 或 Metal 纹理缓存）
   - 滤镜参数绑定为着色器 uniforms
   - GPU 并行处理每个像素
   - 结果回读（如 `createCGImage` 需要从 GPU 读回 CPU 内存）

**自定义滤镜 ROI 回调示例**（Objective-C）：

```objc
- (CGRect)regionOfInterestForOutputRect:(CGRect)outputRect {
    CGFloat radius = self.inputRadius.floatValue;
    return CGRectInset(outputRect, -radius, -radius);  // 模糊需要扩展区域
}
```

### 6.2 IOSurface 与零拷贝

**IOSurface 是什么？**

`IOSurface` 是 Apple 平台上**跨进程、零拷贝**共享硬件加速图像缓冲区的底层框架。

**包含内容**：
- 像素格式、尺寸、色彩空间、行距（bytes per row）等元信息
- 指向实际像素数据的物理内存页引用

**工作流程**：

| 步骤        | 说明                                                  |
| :---------- | :---------------------------------------------------- |
| 1. 创建     | 视频采集进程创建 `IOSurface` 对象并分配内存           |
| 2. 写入     | 相机硬件将图像数据直接写入 `IOSurface` 内存           |
| 3. 共享     | `IOSurface` 引用通过 IPC（Mach IPC）传递给其他进程    |
| 4. 使用     | 接收进程映射到自己的地址空间，或直接交给 GPU 作为纹理 |
| 5. 生命周期 | 使用引用计数管理，计数归零时回收内存                  |

### 6.3 CVPixelBuffer 与 Core Image 的交互

**从 `CVPixelBuffer` 创建 `CIImage`**：

```swift
let ciImage = CIImage(cvPixelBuffer: pixelBuffer, options: [
    kCIImageColorSpace: colorSpace,
    kCIImageProperties: metadata
])
```

**参数说明**：

| 参数                                                    | 说明                                       |
| :------------------------------------------------------ | :----------------------------------------- |
| `pixelBuffer`                                           | 输入的 `CVPixelBuffer` 对象                |
| `kCIImageColorSpace`                                    | 指定图像颜色空间，未提供时从缓冲区附件获取 |
| `kCIImageProperties`                                    | 图像元数据（如 EXIF）                      |
| `kCIImageAuxiliaryDepth` / `kCIImageAuxiliaryDisparity` | 指明缓冲区包含深度或视差数据               |

**底层实现**：`CIImage` 初始化时**不复制像素数据**，只持有对 `CVPixelBuffer` 的引用。`CVPixelBuffer` 背后的内存由 `IOSurface` 支持，GPU 可直接访问同一块物理内存。

**渲染回 `CVPixelBuffer`**：

```swift
context.render(image, to: pixelBuffer, bounds: bounds, colorSpace: colorSpace)
```

**关键点**：
- Core Image 尝试将渲染结果直接写入目标 `CVPixelBuffer` 的 `IOSurface`
- 只要格式兼容，避免额外内存拷贝
- `bounds` 参数实现**按需渲染**，只计算和输出子矩形区域
- `colorSpace` 参数确保颜色在目标设备显示正确

**性能优化最佳实践**：

| 实践                     | 说明                                                      |
| :----------------------- | :-------------------------------------------------------- |
| 开启 `IOSurface` 支持    | 创建 `CVPixelBuffer` 时设置属性字典启用                   |
| 使用 `CVPixelBufferPool` | 循环复用缓冲区，避免频繁创建销毁                          |
| 颜色空间一致性           | 确保 `CIImage`、`CIContext`、`CVPixelBuffer` 颜色空间一致 |
| 处理前锁定               | 调用 `CVPixelBufferLockBaseAddress` 防止数据被修改        |
| 异步渲染                 | 不阻塞 UI 的后台任务使用异步渲染 API                      |

---

## 第七部分：图像分析与辅助数据

### 7.1 CIDetector — 智能特征检测器

用于在静态图像或视频中搜索和识别显著特征（人脸、矩形、条形码等）。

**重要特性**：
- `CIDetector` 可能持有大量状态资源，应**复用同一个检测器实例**
- 创建开销较大，避免频繁创建

**主要方法**：

| 方法                                | 参数                                            | 返回值        | 说明                 |
| :---------------------------------- | :---------------------------------------------- | :------------ | :------------------- |
| `detector(ofType:context:options:)` | `CIDetectorType`, `CIContext?`, `[String:Any]?` | `CIDetector?` | 创建指定类型的检测器 |
| `features(in:)`                     | `CIImage`                                       | `[CIFeature]` | 检测图像中的特征     |
| `features(in:options:)`             | `CIImage`, `[String:Any]?`                      | `[CIFeature]` | 带选项的检测         |

**检测器类型**：

| 类型                      | 说明               |
| :------------------------ | :----------------- |
| `CIDetectorTypeFace`      | 人脸检测（iOS 5+） |
| `CIDetectorTypeRectangle` | 矩形检测           |
| `CIDetectorTypeQRCode`    | 二维码检测         |

**检测选项**：

| 选项                       | 说明              |
| :------------------------- | :---------------- |
| `CIDetectorAccuracy`       | 检测精度（高/低） |
| `CIDetectorTracking`       | 是否启用跟踪      |
| `CIDetectorMinFeatureSize` | 最小特征尺寸      |
| `CIDetectorNumberOfAngles` | 角度数量          |

### 7.2 CIFeature — 特征对象

表示检测器在图像中识别到的特征的抽象基类。

| 子类                 | 说明                             |
| :------------------- | :------------------------------- |
| `CIFaceFeature`      | 人脸特征（包含眼睛、嘴巴位置等） |
| `CIRectangleFeature` | 矩形特征（包含四个顶点）         |
| `CIQRCodeFeature`    | 二维码特征（包含解码信息）       |

### 7.3 深度与视差

**概念区分**：

| 概念                 | 定义                                           | 特点                                   |
| :------------------- | :--------------------------------------------- | :------------------------------------- |
| **视差 (Disparity)** | 同一物体在左右两个视角图像中位置的**像素差异** | 物体越近，视差越大；物体越远，视差越小 |
| **深度 (Depth)**     | 物体到相机的**实际物理距离**（米）             | Depth ∝ 1/Disparity（反比关系）        |

**作用**：

| 应用               | 说明                                   |
| :----------------- | :------------------------------------- |
| 人像模式与背景虚化 | 模拟大光圈景深效果                     |
| AR 增强现实        | 实现真实与虚拟物体的遮挡关系           |
| 3D 建模与摄影测量  | 从多张照片重建三维模型                 |
| 创意编辑           | 独立调整背景虚化程度，添加 3D 灯光效果 |

**存储位置**：
- **不在传统 EXIF 中**（EXIF 只存储小型元数据）
- 作为 **"辅助图像"** 存储在 HEIC/HEIF 等现代格式的独立数据块中
- 单通道灰度图，每个像素值代表深度或视差信息

**Apple 框架中的访问键**：

| 键                           | 获取内容 |
| :--------------------------- | :------- |
| `kCIImageAuxiliaryDisparity` | 视差图   |
| `kCIImageAuxiliaryDepth`     | 深度图   |

### 7.4 EXIF 属性

EXIF（Exchangeable Image File Format）是一种标准，用于在 JPEG、TIFF 等图像文件中嵌入拍摄时的元数据。

在 Apple 框架中，EXIF 信息通过以 `kCGImagePropertyExifDictionary` 为键的字典访问。

**常用 EXIF 键列表**：

| 键                                                   | 说明                 |
| :--------------------------------------------------- | :------------------- |
| `kCGImagePropertyExifApertureValue`                  | 光圈值               |
| `kCGImagePropertyExifBrightnessValue`                | 亮度值               |
| `kCGImagePropertyExifColorSpace`                     | 色彩空间             |
| `kCGImagePropertyExifComponentsConfiguration`        | 压缩数据的分量配置   |
| `kCGImagePropertyExifDateTimeDigitized`              | 数字化日期时间       |
| `kCGImagePropertyExifDateTimeOriginal`               | 原始图像生成日期时间 |
| `kCGImagePropertyExifExposureBiasValue`              | 曝光补偿（EV）       |
| `kCGImagePropertyExifExposureTime`                   | 曝光时间（秒）       |
| `kCGImagePropertyExifFNumber`                        | 光圈 F 值            |
| `kCGImagePropertyExifFlash`                          | 闪光灯状态           |
| `kCGImagePropertyExifFocalLength`                    | 焦距（毫米）         |
| `kCGImagePropertyExifFocalLenIn35mmFilm`             | 等效 35mm 焦距       |
| `kCGImagePropertyExifGPSLatitude` / `Longitude`      | GPS 经纬度           |
| `kCGImagePropertyExifISOSpeed`                       | ISO 感光度           |
| `kCGImagePropertyExifLensMake` / `LensModel`         | 镜头制造商/型号      |
| `kCGImagePropertyExifMake` / `Model`                 | 设备制造商/型号      |
| `kCGImagePropertyExifPixelXDimension` / `YDimension` | 图像有效尺寸（像素） |
| `kCGImagePropertyExifSceneCaptureType`               | 场景拍摄类型         |
| `kCGImagePropertyExifShutterSpeedValue`              | 快门速度值（APEX）   |
| `kCGImagePropertyExifSoftware`                       | 生成图像的软件       |
| `kCGImagePropertyExifWhiteBalance`                   | 白平衡模式           |

---

## 第八部分：实战指南 — 构建 Core Image 全能 App

### 8.1 应用概念："图像工坊"

定位为一款**集实时处理、专业编辑、智能分析与自定义扩展于一体的"图像工坊"**。

**核心功能设想**：

| 功能           | 说明                                   |
| :------------- | :------------------------------------- |
| 实时滤镜相机   | 拍摄时预览并应用滤镜效果               |
| 专业图片编辑器 | 对相册图片进行非破坏性多滤镜链式编辑   |
| RAW 照片处理   | 处理专业相机拍摄的 RAW 格式照片        |
| 视频特效处理   | 为本地视频或实时摄像头画面添加特效     |
| 智能图像分析   | 利用 Vision 框架识别人脸、文字、条形码 |
| 自定义滤镜工坊 | 提供内置环境测试 Metal 着色器效果      |

### 8.2 技术栈全景

| 技术模块           | 说明                                                |
| :----------------- | :-------------------------------------------------- |
| **核心处理引擎**   | `CIContext` + `CIImage`，高效管理和渲染图像处理任务 |
| **丰富的滤镜库**   | 150+ 内置 `CIFilter`，通过链式调用组合无限可能      |
| **自定义扩展能力** | `CIKernel` + Metal Shading Language，实现独特效果   |
| **智能分析集成**   | `Vision` 框架协同，实现人脸检测、文本识别等         |
| **底层性能加速**   | 基于 Metal 的 GPU 加速，进一步榨干设备性能          |

### 8.3 架构设计

**分层架构**：

| 层级                    | 技术选型                                                              | 职责                                           |
| :---------------------- | :-------------------------------------------------------------------- | :--------------------------------------------- |
| **表示层 (UI)**         | SwiftUI + UIKit（MTKView）                                            | 构建现代响应式用户界面                         |
| **业务逻辑层 (服务层)** | `ImageProcessingService`、`VideoProcessingService`、`AnalysisService` | 封装所有 Core Image、AVFoundation、Vision 操作 |
| **数据层 (模型层)**     | `FilterEffect`、`Adjustment` 等数据模型                               | 描述编辑操作，支持非破坏性编辑和撤销/重做      |

**核心数据流**：
```
用户操作 → UI层 → 服务层 (构建/更新 CIFilter 链) → CIContext (渲染) → UI层 (展示结果)
```

### 8.4 功能模块实现要点

#### 模块一：实时滤镜相机

| 项目         | 说明                                                                                                                                                                                                                                                                        |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **技术栈**   | AVFoundation + Core Image + Metal (MTKView)                                                                                                                                                                                                                                 |
| **实现要点** | 通过 `AVCaptureSession` 获取摄像头数据流（`CVPixelBuffer`）。创建 `CIContext` 时传入 `kCIContextCVMetalTextureCache`，利用 Metal 纹理缓存直接处理 `CVPixelBuffer`。在每一帧回调中，将 `CVPixelBuffer` 转为 `CIImage`，应用滤镜链，通过 `MTKView` 高效渲染。**必须真机测试** |

#### 模块二：专业图片编辑器

| 项目         | 说明                                                                                                                                                                                                                                                                                         |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **技术栈**   | Core Image + SwiftUI                                                                                                                                                                                                                                                                         |
| **实现要点** | 利用 `CIImage` 的**惰性求值**特性，将多个滤镜串联构建处理管线。存储用户的每一步操作（如"应用了强度为0.8的CISepiaTone滤镜"）实现非破坏性编辑和撤销/重做。可参考开源项目 [Instafilter](https://github.com/Naveed-Baloch/Instafilter) 和 [CIFilter.io](https://github.com/SuzGupta/cifilter.io) |

#### 模块三：RAW 照片处理

| 项目         | 说明                                                                                     |
| :----------- | :--------------------------------------------------------------------------------------- |
| **技术栈**   | Core Image RAW API                                                                       |
| **实现要点** | 使用 `CIRAWFilter` 处理 RAW 文件。计算量大，采用**异步加载**和后台预处理，避免阻塞主线程 |

#### 模块四：视频特效处理

| 项目         | 说明                                                                                                                                                                                                 |
| :----------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **技术栈**   | AVFoundation + Core Image                                                                                                                                                                            |
| **实现要点** | 使用 `AVAsynchronousCIImageFilteringRequest` 处理视频文件。处理视频时设置 `cacheIntermediates: false` 节省内存。参考 [Core Image by Example](https://github.com/frankschlegel/core-image-by-example) |

#### 模块五：智能图像分析

| 项目         | 说明                                                                                                                                                                                          |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **技术栈**   | Vision + Core Image                                                                                                                                                                           |
| **实现要点** | 利用 Vision 框架执行人脸检测 (`VNDetectFaceRectanglesRequest`)、文本识别 (`VNRecognizeTextRequest`)、条形码识别。将 Vision 分析结果（如人脸区域）作为参数驱动 Core Image 滤镜进行特定区域处理 |

#### 模块六：自定义滤镜工坊

| 项目         | 说明                                                                                                                                                                                                                                                                                                          |
| :----------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **技术栈**   | Metal Shading Language + Core Image                                                                                                                                                                                                                                                                           |
| **实现要点** | ① 编写 `.ci.metal` 文件，用 MSL 实现核心算法。② 在 Xcode 中为 `.ci.metal` 添加自定义构建规则，编译为 `.ci.air` 文件。③ 创建 `CIFilter` 子类，加载编译好的 `.ci.air` 文件，实例化 `CIKernel`。④ 在 `outputImage` 中调用 `CIKernel` 处理输入图像。参考 WWDC20 "Build Metal-based Core Image kernels with Xcode" |

### 8.5 开发路线图

| 阶段                       | 内容                                                                                                                          |
| :------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **第一阶段：地基 (MVP)**   | 创建可复用的 `CIContext` 管理器。实现图片编辑器核心功能：选图、应用单个滤镜、保存/分享。引入 CIFilter.io 浏览测试所有内置滤镜 |
| **第二阶段：实时与智能**   | 集成 AVFoundation 构建实时滤镜相机（MTKView 渲染）。集成 Vision 框架实现人脸检测，驱动滤镜（如背景虚化）                      |
| **第三阶段：专业与自定义** | 实现多滤镜链式编辑和撤销/重做。编写第一个 Metal 自定义滤镜（灰度、浮雕效果）并集成到 App                                      |
| **第四阶段：进阶与优化**   | 支持 RAW 格式照片处理。实现对本地视频文件的特效处理。使用 Instruments（Metal System Trace 模板）进行性能剖析和优化            |

### 8.6 常见问题与避坑指南

| 问题         | 解决方案                                                                                                      |
| :----------- | :------------------------------------------------------------------------------------------------------------ |
| **性能优化** | 复用 `CIContext`；确保图像尺寸在设备限制内；避免 CPU 与 GPU 间不必要纹理传输；使用 `autoreleasepool` 管理内存 |
| **线程安全** | `CIContext` 和 `CIImage` 线程安全可共享；**`CIFilter` 是可变的，非线程安全**，每个线程使用自己的实例          |
| **颜色管理** | 注意 `CIContext` 的 `workingColorSpace` 和 `outputColorSpace` 设置，确保颜色显示一致                          |
| **调试**     | 利用 Xcode 的 GPU 调试工具和 WWDC20 "Discover Core Image debugging techniques" 生成图像处理图分析性能瓶颈     |
| **真机测试** | Core Image 的 GPU 加速在模拟器无法完整体现，性能相关测试**务必在真机进行**                                    |

### 8.7 参考资源

**示例项目**：

| 项目                                                                            | 说明                                |
| :------------------------------------------------------------------------------ | :---------------------------------- |
| [Instafilter](https://github.com/Naveed-Baloch/Instafilter)                     | SwiftUI + Core Image 图片滤镜应用   |
| [Core Image by Example](https://github.com/frankschlegel/core-image-by-example) | Core Image 与视频处理               |
| [CIFilter.io](https://github.com/SuzGupta/cifilter.io)                          | 所有 CIFilter 的文档和示例          |
| [SwiftUICoreImage](https://github.com/danwood/SwiftUICoreImage)                 | 将 CIFilter 封装为 SwiftUI Modifier |

**官方文档与视频**：

- [Writing Custom Kernels](https://developer.apple.com/documentation/coreimage/writing-custom-kernels)
- [CIImageProcessorKernel](https://developer.apple.com/documentation/coreimage/ciimageprocessorkernel)
- WWDC20: Build Metal-based Core Image kernels with Xcode
- WWDC26: Enhance RAW image processing with Core Image

---

*本文档是对 Core Image 框架的系统化整理，覆盖从核心概念到实战开发的全链路知识。如需深入了解某个特定主题，可进一步查阅 Apple 官方文档或相关开源项目。*