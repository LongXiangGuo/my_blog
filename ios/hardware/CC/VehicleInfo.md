# VehicleInfo

```swift
    /// The IuK service pack.
    /// Values: SP15, SP18, SP21, SP24, or UNKNOWN
    public let servicePack: ServicePack
    /// The head-unit's software version.
    public let softwareVersion: String
    /// The brand of this vehicle.
    /// Values: MyApp, MINI, ROLLS_ROYCE,  UNKNOWN or UNRECOGNIZED
    public let brand: VehicleBrand
    /// Represents the software production interruption (PU = Produktions Unterbrechung).
    /// The format follows "YY-MM" (e.g., "25-07") or is empty if no data is available.
    public let softwarePu: String
```

**ServicePack**: 车辆或车载中央通信单元（通常是 Telematics Control Unit, 简称 TCU）的软件/固件版本包（Service Pack）标识。

>SP15, SP18, SP21, SP24：这些代表具体的 Service Pack（服务包/软件版本） 版本号。数字通常与该软件版本的冻结年份、发布季度或大版本代号挂钩：
行业惯例示例：在很多德系车企（如宝马 MyApp 的大客户/数字钥匙系统架构）中，“SP18” 代表 2018 年左右发布的电子电气架构/固件版本（如 Service Pack 2018，搭载该系统的车辆具有特定的硬件基线），而 “SP21” 和 “SP24” 则代表更新一代的架构（如支持超宽带 UWB 技术、更高级的证书链验证）。

因为不同年份（不同 SP 版本）的汽车，其车载芯片算力、支持的蓝牙/Wi-Fi 协议、以及安全芯片（SE）的能力完全不同，客户端必须通过这个字段来进行功能降级或版本分支控制。

```swift
witch vehicle.servicePack {
case .sp24:
    // SP24 支持最新的高速 Wi-Fi 5G 频段和 RFC4754 签名算法
    enableUltraFastFeatureServices()
case .sp21:
    // SP21 仅支持基础的 Wi-Fi 功能和 X962 签名算法
    enableStandardFeatureServices()
case .sp18, .sp15:
    // 极老的车型，完全不支持通过 Wi-Fi 传输特定特征服务
    disableWifiFeatureServices()
case .UNKNOWN:
    // 无法识别，走最安全的保守策略
    fallBackToMinimumSafetyProtocol()
}
```

## RFC 4754

RFC 4754 是互联网工程任务组（IETF）制定的一个经典密码学标准规范，全称为：《IKE and IKEv2 Authentication Using the Elliptic Curve Digital Signature Algorithm (ECDSA)》（使用椭圆曲线数字签名算法的 IKE/IKEv2 认证）。 

» RFC Editor
在苹果的 Security 框架以及车联网（如数字车钥匙、SdipCoreContract）的开发上下文中，当看到算法中带有 RFC4754（例如 iOS 17 新增的 ecdsaSignatureMessageRFC4754SHA256）时，它指代的并不是全新的数学算法，而是一种特定格式的、标准化的 ECDSA（椭圆曲线签名）签名数据输出规范。

1. 传统的 ASN.1 / DER 编码格式（老版本车机常用）
在传统的密码学组件中（如早期的 OpenSSL），

### 通常被打包成一个 ASN.1 结构体 并使用 DER 格式 序列化。
它的特点是带有大量的“元数据”标记（标记这是一个结构体、标记整数长度等）。
它的长度是可变的（因为正数最高位如果为 1，前面要补 0x00 防止被误判为负数），通常在 70 到 72 字节左右。
2. RFC 4754 规定的格式（纯二进制固定长度拼接）
RFC 4754 规范为了在网络协议（如 IPsec / IKEv2 VPN）中实现极高效率的传输，规定：彻底去掉所有 ASN.1 冗余标记，直接将 
 和 
 的原始二进制按固定长度进行前后拼接（即 r + s）。 

» RFC Editor
 +1
对于最常用的 P-256 (SHA-256) 椭圆曲线：

 占 32 字节，
 占 32 字节。
无论什么情况，RFC4754 格式的签名数据长度永远固定为 64 字节（512 位）。 

Practical Cryptography for Developers
