# SDIP

**SDIP** 在汽车/物联网架构中的全称与核心定义
全称：Secure Device Identity Protocol（安全设备身份协议）
核心职责：该协议用于建立车辆（Vehicle）与用户设备（如 iPhone/Apple Watch 等智能终端）、云端服务器之间的可信信任链（Chain of Trust）。
SdipCoreContract：则是该身份协议在 Swift/iOS 客户端侧的核心契约（Contract）/核心处理类。它定义了设备和车辆在进行双向身份认证、密钥交换、证书校验时，必须遵循的底层加密格式、签名算法与交互规范。
为什么它叫“Contract（契约/合同）”？
在面向对象设计（OOD）和大型通信系统（如汽车与外部实体的联网通信）中，Contract 通常指代一种通信契约。
它规定了：
签名时，数据必须按照 (挑战码 + 证书二进制) 顺序拼接。
验签时，必须采用你前几轮贴出的苹果官方 SecKeyAlgorithm 算法家族。
双方在握手（Handshake）阶段数据包的严格内存和字节对齐。
因此，SdipCoreContract 就是智能汽车生态中，负责“核验车辆真实物理身份、防止中间人伪装车机”的最核心安全契约组件。