# 主流加密算法全面解析：从原理到实战

> 一文读懂AES、RSA、ECC、SM4的核心原理、架构设计与最佳实践


## 一、引言

在数字化转型加速的今天，数据安全已成为企业和个人不可回避的核心议题。无论是金融交易、医疗记录、政务数据，还是日常的即时通讯，加密技术都在默默守护着每一比特信息的安全。

然而，面对琳琅满目的加密算法——AES、RSA、ECC、SM4……开发者常常陷入选择困境：该用对称加密还是非对称加密？密钥长度如何取舍？如何在安全性与性能之间找到平衡？

本文将从**简介、应用场景、架构设计、实现原理、全景类图、设计模式、工作流程、代码实现、参数汇总、常见问题与解决方案、最佳实践**等维度，对主流加密算法进行全面解析。

> **声明**：本文基于公开技术文档、学术论文及GitHub开源项目整理，力求内容准确、实时，杜绝胡编乱造。


## 二、加密算法分类概述

### 2.1 对称加密（Symmetric Encryption）

- **原理**：加密和解密使用**同一把密钥**
- **优点**：速度快，适合大数据量加密
- **缺点**：密钥分发困难，需通过安全渠道共享
- **典型算法**：AES、SM4

### 2.2 非对称加密（Asymmetric Encryption）

- **原理**：使用**公钥加密、私钥解密**（或反向）
- **优点**：无需共享密钥，安全性高
- **缺点**：速度慢，约为对称加密的1/1000
- **典型算法**：RSA、ECC（椭圆曲线）、SM2

### 2.3 混合加密方案

**常见方案**：先用非对称加密传输对称密钥（会话密钥），再用对称密钥加密数据。**代表案例**：HTTPS（TLS握手阶段使用RSA或ECC，数据阶段使用AES）。**优势**：兼具安全性与性能。


## 三、AES（Advanced Encryption Standard）

### 3.1 简介

AES是美国国家标准与技术研究院（NIST）于2001年发布的对称分组加密标准，是当今全球**应用最广泛的对称加密算法**。AES-256被美国国家安全局（NSA）批准用于保护**绝密级信息**。

AES是一种**迭代密码**，加密和解密过程由同一基本函数的多次迭代组成。其设计基于**代换-置换网络（SPN）** 结构。

### 3.2 应用场景

| 场景           | 说明                                   |
| -------------- | -------------------------------------- |
| 云存储加密     | 保护云端数据静态安全                   |
| 磁盘加密       | 全磁盘加密（FDE）、透明数据加密（TDE） |
| 数据库字段加密 | 身份证号、银行卡号等敏感字段           |
| HTTPS数据传输  | TLS握手完成后，使用AES加密应用数据     |
| 文件加密存储   | 本地文件及企业文档加密                 |

### 3.3 架构设计

AES的架构采用**三层结构**：

```
┌─────────────────────────────────────────────────────┐
│                   应用层（API）                      │
│            encrypt(plaintext, key) → ciphertext     │
├─────────────────────────────────────────────────────┤
│                   轮函数层                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │SubBytes  │ │ShiftRows │ │MixColumns│ │AddRound│ │
│  │（字节代换）│ │（行移位） │ │（列混合） │ │Key(轮密钥加)│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
├─────────────────────────────────────────────────────┤
│                   密钥扩展层                        │
│         KeyExpansion（将原始密钥扩展为轮密钥）       │
└─────────────────────────────────────────────────────┘
```

### 3.4 实现原理

AES将128位明文排列成一个**4×4字节矩阵**（称为State）。加密过程分为：

1. **初始轮**：明文与原始密钥异或（AddRoundKey）
2. **前N-1轮**（每轮4步）：
   - **SubBytes（字节代换）** ：通过S盒进行非线性字节替换
   - **ShiftRows（行移位）** ：矩阵行循环移位
   - **MixColumns（列混合）** ：列上的矩阵乘法运算
   - **AddRoundKey（轮密钥加）** ：与轮密钥异或
3. **最后一轮**：SubBytes → ShiftRows → AddRoundKey（无MixColumns）

### 3.5 关键参数

| 参数     | AES-128         | AES-192         | AES-256         |
| -------- | --------------- | --------------- | --------------- |
| 密钥长度 | 128位（16字节） | 192位（24字节） | 256位（32字节） |
| 分组长度 | 128位（16字节） | 128位（16字节） | 128位（16字节） |
| 加密轮数 | 10轮            | 12轮            | 14轮            |
| 安全强度 | 128比特         | 192比特         | 256比特         |

### 3.6 工作模式（Mode of Operation）

AES作为分组密码，需结合工作模式处理任意长度数据：

| 模式    | 特点                                     | 适用场景           |
| ------- | ---------------------------------------- | ------------------ |
| **ECB** | 简单，相同明文产生相同密文               | 不推荐用于安全场景 |
| **CBC** | 需要IV，密文链接                         | 通用加密           |
| **CTR** | 流密码模式，可并行                       | 高性能场景         |
| **GCM** | 认证加密（AEAD），同时提供机密性和完整性 | 推荐首选           |
| **CCM** | 认证加密，组合CTR+CBC-MAC                | 物联网等受限环境   |


## 四、RSA（Rivest-Shamir-Adleman）

### 4.1 简介

RSA是**公钥密码体系的开山之作**，由Ron Rivest、Adi Shamir和Leonard Adleman于1977年提出。其安全性基于**大整数因式分解的数学困难性**。RSA已被ISO推荐为公钥数据加密标准。

> ⚠️ **致命缺点**：RSA加密速度大致是AES的**1/30左右**。

### 4.2 应用场景

| 场景          | 说明                         |
| ------------- | ---------------------------- |
| HTTPS/SSL证书 | 数字证书、TLS握手            |
| 数字签名      | 身份认证、防抵赖             |
| 密钥交换      | 安全传输对称密钥（会话密钥） |
| 区块链        | 云存储安全、交易验证         |
| 政务加密      | 政务新媒体信息安全           |

### 4.3 架构设计

RSA系统的典型架构采用**三层纵深防御模型**：

```
┌─────────────────────────────────────────────────────┐
│                   应用层                            │
│        加密/解密/签名/验签 API                       │
├─────────────────────────────────────────────────────┤
│                   RSA引擎层                         │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ 密钥生成模块  │  │ 加解密模块   │                │
│  │（大素数生成） │  │（模幂运算）  │                │
│  └──────────────┘  └──────────────┘                │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ 填充模块     │  │ 签名/验签模块 │                │
│  │（PKCS#1/OAEP）│  │（PKCS#1/PSS）│                │
│  └──────────────┘  └──────────────┘                │
├─────────────────────────────────────────────────────┤
│                   数学运算层                        │
│     大整数运算 / 蒙哥马利模幂 / CRT优化             │
└─────────────────────────────────────────────────────┘
```

### 4.4 实现原理

RSA的核心流程涵盖**五大关键阶段**：

#### 4.4.1 密钥生成

1. 随机选择两个大素数 **p** 和 **q**
2. 计算 **n = p × q**（n的长度即为密钥长度）
3. 计算欧拉函数 **φ(n) = (p-1) × (q-1)**
4. 选择公钥指数 **e**（通常为65537），满足 1 < e < φ(n) 且 gcd(e, φ(n)) = 1
5. 计算私钥指数 **d**，满足 **e × d ≡ 1 (mod φ(n))**
6. **公钥：(e, n)** ，**私钥：(d, n)**

#### 4.4.2 加密与解密

- **加密**：C = M^e mod n（M为明文，C为密文）
- **解密**：M = C^d mod n

### 4.5 关键参数

| 密钥长度 | 安全强度 | 推荐状态       |
| -------- | -------- | -------------- |
| 1024位   | ~80比特  | ❌ 已不推荐     |
| 2048位   | ~112比特 | ✅ **当前推荐** |
| 3072位   | ~128比特 | ✅ 高安全场景   |
| 4096位   | ~140比特 | ✅ 极高安全场景 |


## 五、ECC（Elliptic Curve Cryptography）

### 5.1 简介

ECC（椭圆曲线密码学）是一种基于**椭圆曲线数学理论**的非对称加密算法，由Neal Koblitz和Victor Miller于1985年分别独立提出。ECC的核心优势是**使用更短的密钥提供与RSA相当甚至更高的安全等级**。

> 💡 **ECC-256位的安全强度，相当于RSA-3072位**。

### 5.2 应用场景

| 场景              | 说明                          |
| ----------------- | ----------------------------- |
| 移动端加密        | 资源受限环境下的密钥交换      |
| 物联网（IoT）     | 轻量级认证与加密              |
| 区块链            | 比特币、以太坊等使用secp256k1 |
| 数字签名（ECDSA） | 身份认证                      |
| 密钥交换（ECDH）  | 安全协商会话密钥              |
| 车联网（V2X）     | 车辆与路侧单元安全通信        |

### 5.3 架构设计

```
┌─────────────────────────────────────────────────────┐
│                   应用层                            │
│      ECDH密钥交换 / ECDSA签名验签 / 加解密          │
├─────────────────────────────────────────────────────┤
│                   ECC核心层                         │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ 曲线参数管理  │  │ 密钥对生成   │                │
│  │（曲线选择）   │  │（标量乘法）  │                │
│  └──────────────┘  └──────────────┘                │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ 点运算模块   │  │ 编码/解码    │                │
│  │（加/倍/标量乘）│  │（点压缩等） │                │
│  └──────────────┘  └──────────────┘                │
├─────────────────────────────────────────────────────┤
│                   有限域运算层                      │
│           模运算 / 逆元 / 椭圆曲线方程              │
└─────────────────────────────────────────────────────┘
```

### 5.4 实现原理

ECC基于椭圆曲线方程 **y² = x³ + ax + b**（在有限域上）：

1. **曲线选择**：选择一条安全椭圆曲线（如 secp256r1、Curve25519）
2. **基点G**：曲线上选择一个公开基点
3. **密钥生成**：
   - 私钥：随机整数 **d**（1 < d < n，n为基点阶）
   - 公钥：**Q = d × G**（椭圆曲线上的标量乘法）
4. **加密**：将明文映射到曲线上的点，使用接收方公钥进行加密
5. **解密**：使用私钥进行标量乘法还原

### 5.5 关键参数

| 曲线名称                | 密钥长度 | 安全强度 | 典型应用       |
| ----------------------- | -------- | -------- | -------------- |
| secp256r1（NIST P-256） | 256位    | 128比特  | 通用ECC        |
| secp384r1（NIST P-384） | 384位    | 192比特  | 高安全场景     |
| secp521r1（NIST P-521） | 521位    | ~256比特 | 极高安全       |
| **Curve25519**          | 256位    | 128比特  | ✅ **现代推荐** |
| Curve448                | 448位    | 224比特  | 高安全场景     |


## 六、国密SM4（商用密码算法）

### 6.1 简介

SM4是中国国家密码管理局于**2012年3月21日**发布的对称分组密码算法（标准号：GM/T 0002-2012）。SM4的block大小为**128位**，算法是**开源**的。

SM4的地位类似于NIST中的AES，是我国**自主可控的商用密码标准**。SM4采用**32轮非线性迭代结构**，解密算法与加密算法结构相同，仅轮密钥**逆序使用**。

### 6.2 应用场景

| 场景               | 说明                          |
| ------------------ | ----------------------------- |
| 中国政务系统       | 政府数据加密保护              |
| 金融系统           | 银行、证券等核心交易数据      |
| 关键信息基础设施   | 等保2.0合规要求               |
| 无线局域网（WAPI） | 随WAPI标准一起公布            |
| 车联网             | 轻量化认证方案                |
| 语音识别加密       | SM4-CTR流密码模式消除填充开销 |

### 6.3 架构设计

SM4采用**非平衡Feistel网络结构**：

```
┌─────────────────────────────────────────────────────┐
│                   应用层                            │
│         encrypt(plaintext, key) → ciphertext        │
├─────────────────────────────────────────────────────┤
│                   SM4核心层                         │
│  ┌─────────────────────────────────────────────┐   │
│  │              32轮非线性迭代                  │   │
│  │  ┌──────────────────────────────────────┐  │   │
│  │  │ 轮函数F：异或 → S盒变换 → 线性变换  │  │   │
│  │  └──────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│                   密钥扩展层                        │
│        将128位密钥扩展为32个32位轮密钥              │
└─────────────────────────────────────────────────────┘
```

### 6.4 实现原理

SM4算法流程：

1. **分组**：128位明文分为4个32位字（X₀, X₁, X₂, X₃）
2. **32轮加密迭代**：每轮使用一个轮密钥rkᵢ（i=0,1,...,31）
   - 轮函数：Xᵢ₊₄ = Xᵢ ⊕ T(Xᵢ₊₁ ⊕ Xᵢ₊₂ ⊕ Xᵢ₊₃ ⊕ rkᵢ)
   - 其中T包含**非线性变换（S盒）** 和**线性变换（L）**
3. **反序变换**：输出 (X₃₅, X₃₄, X₃₃, X₃₂)
4. **解密**：与加密结构相同，轮密钥逆序使用

### 6.5 关键参数

| 参数     | 值                |
| -------- | ----------------- |
| 分组长度 | 128位（16字节）   |
| 密钥长度 | 128位（16字节）   |
| 迭代轮数 | 32轮              |
| 算法结构 | 非平衡Feistel网络 |
| 安全强度 | ~128比特          |


## 七、安全强度对比全景表

| 算法类型 | 算法         | 密钥长度 | 安全强度          | 相对性能 | 推荐状态     |
| -------- | ------------ | -------- | ----------------- | -------- | ------------ |
| 对称     | **AES-128**  | 128位    | 128比特           | ⭐⭐⭐⭐⭐    | ✅ 推荐       |
| 对称     | **AES-256**  | 256位    | 256比特           | ⭐⭐⭐⭐     | ✅ 高安全推荐 |
| 对称     | **SM4**      | 128位    | ~128比特          | ⭐⭐⭐⭐     | ✅ 国密合规   |
| 非对称   | **RSA-2048** | 2048位   | ~112比特          | ⭐⭐       | ✅ 推荐       |
| 非对称   | **RSA-3072** | 3072位   | ~128比特          | ⭐        | ✅ 高安全     |
| 非对称   | **ECC-256**  | 256位    | 128比特           | ⭐⭐⭐⭐     | ✅ **首选**   |
| 非对称   | **SM2**      | 256位    | ~128比特          | ⭐⭐⭐⭐     | ✅ 国密合规   |
| 哈希     | **SHA-256**  | —        | 128比特（抗碰撞） | ⭐⭐⭐⭐⭐    | ✅ 推荐       |
| 哈希     | **SM3**      | —        | ~128比特          | ⭐⭐⭐⭐     | ✅ 国密合规   |

> 📌 **核心洞察**：实现**相同的128比特安全强度**，AES-128需要128位密钥，ECC-256需要256位，而RSA需要**3072位**。这就是为什么在资源受限场景下，ECC比RSA更具优势。


## 八、设计模式：构建可扩展的加解密框架

### 8.1 策略模式（Strategy Pattern）

在加解密框架设计中，**策略模式**被广泛用于封装不同的加密算法。

```java
// 统一加解密接口（策略接口）
public interface CryptoProcessor {
    CryptoCategory getCategory();
    String encrypt(String content);
    String decrypt(String content);
}

// 具体策略：AES实现
public class AesProcessor implements CryptoProcessor {
    @Override
    public String encrypt(String content) {
        // AES加密实现
    }
    @Override
    public String decrypt(String content) {
        // AES解密实现
    }
}

// 具体策略：RSA实现
public class RsaProcessor implements CryptoProcessor {
    // 类似实现
}

// 业务代码：只依赖接口，不关心具体算法
CryptoProcessor processor = getProcessor("AES");
String encrypted = processor.encrypt(data);
```

### 8.2 工厂模式（Factory Pattern）

**工厂模式**负责根据算法类型创建对应的处理器实例：

```java
public class CryptoProcessorFactory {
    private Map<CryptoCategory, CryptoProcessor> processors = new EnumMap<>();
    
    public CryptoProcessor findProcessor(CryptoCategory category) {
        CryptoProcessor processor = processors.get(category);
        if (processor == null) {
            throw new CryptoException("未找到处理器: " + category);
        }
        return processor;
    }
}
```

### 8.3 全景类图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        <<interface>>                                   │
│                      CryptoProcessor                                   │
│  + encrypt(String): String                                             │
│  + decrypt(String): String                                             │
│  + getCategory(): CryptoCategory                                       │
└─────────────────────────────────────────────────────────────────────────┘
          △                    △                    △
          │                    │                    │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   AesProcessor  │ │   RsaProcessor  │ │   Sm2Processor  │
│  - SecretKey key│ │  - PublicKey pk │ │  - PrivateKey sk│
│  - IvParameter  │ │  - PrivateKey sk│ │  - PublicKey pk │
│                 │ │                 │ │                 │
│  + encrypt()    │ │  + encrypt()    │ │  + encrypt()    │
│  + decrypt()    │ │  + decrypt()    │ │  + decrypt()    │
└─────────────────┘ └─────────────────┘ └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                     CryptoProcessorFactory                             │
│  - Map<CryptoCategory, CryptoProcessor> processors                    │
│  + findProcessor(Category): CryptoProcessor                           │
│  + registerProcessor(Category, CryptoProcessor): void                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.4 设计优势

- **高内聚、低耦合**：业务代码仅依赖接口，无需关心具体算法
- **易扩展**：新增算法仅需实现接口并注册，零侵入扩展
- **可配置**：通过配置或注解动态切换算法
- **统一管理**：密钥、IV等参数统一管理


## 九、工作流程与流程图

### 9.1 AES加密流程图

```
┌──────────────┐
│  128位明文   │
└──────┬───────┘
       ▼
┌──────────────┐
│ 初始轮密钥加  │ ← 原始密钥
└──────┬───────┘
       ▼
┌──────────────────────────────────────────┐
│          前 N-1 轮（N=10/12/14）         │
│  ┌──────────┐ ┌──────────┐              │
│  │SubBytes  │→│ShiftRows │              │
│  └──────────┘ └──────────┘              │
│       ▼           ▼                      │
│  ┌──────────┐ ┌──────────┐              │
│  │MixColumns│→│AddRoundKey│ ← 轮密钥    │
│  └──────────┘ └──────────┘              │
└──────────────────────────────────────────┘
       ▼
┌──────────────────────────────────────────┐
│              最后一轮                     │
│  ┌──────────┐ ┌──────────┐              │
│  │SubBytes  │→│ShiftRows │              │
│  └──────────┘ └──────────┘              │
│       ▼                                  │
│  ┌──────────┐                            │
│  │AddRoundKey│ ← 轮密钥                  │
│  └──────────┘                            │
└──────┬───────────────────────────────────┘
       ▼
┌──────────────┐
│  128位密文   │
└──────────────┘
```

### 9.2 RSA加密流程图

```
┌─────────────────────────────────────────────────────────────┐
│                      密钥生成阶段                           │
│  ┌────────┐   ┌────────┐                                  │
│  │ 素数p  │   │ 素数q  │                                  │
│  └────┬───┘   └───┬────┘                                  │
│       └─────┬─────┘                                        │
│             ▼                                              │
│  ┌─────────────────────┐                                   │
│  │ n = p × q           │                                   │
│  │ φ(n) = (p-1)(q-1)   │                                   │
│  └─────────────────────┘                                   │
│             ▼                                              │
│  ┌─────────────────────┐                                   │
│  │ 选 e（如65537）     │                                   │
│  │ 算 d ≡ e⁻¹ mod φ(n)│                                   │
│  └─────────────────────┘                                   │
│             ▼                                              │
│  ┌─────────────────────┐                                   │
│  │ 公钥(e,n)  私钥(d,n)│                                   │
│  └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────────┐          ┌─────────────────────┐
│     加密阶段         │          │     解密阶段         │
│  C = M^e mod n      │          │  M = C^d mod n      │
└─────────────────────┘          └─────────────────────┘
```

### 9.3 SM4加密流程图

```
┌──────────────┐
│ 128位明文    │
│ (X₀,X₁,X₂,X₃)│
└──────┬───────┘
       ▼
┌──────────────────────────────────────────────────┐
│              32轮迭代（i=0→31）                  │
│  ┌────────────────────────────────────────────┐ │
│  │ Xᵢ₊₄ = Xᵢ ⊕ T(Xᵢ₊₁ ⊕ Xᵢ₊₂ ⊕ Xᵢ₊₃ ⊕ rkᵢ) │ │
│  │                                            │ │
│  │ 其中 T = L(τ(...))                        │ │
│  │ τ：4个S盒并行替换                         │ │
│  │ L：线性变换（循环移位+异或）              │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
       ▼
┌──────────────┐
│ 反序输出     │
│ (X₃₅,X₃₄,X₃₃,X₃₂)│
└──────┬───────┘
       ▼
┌──────────────┐
│ 128位密文    │
└──────────────┘
```


## 十、详细实现代码示例

### 10.1 AES-GCM（Java）

```java
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.security.SecureRandom;

public class AESGCMExample {
    
    public static byte[] encrypt(byte[] plaintext, SecretKey key) throws Exception {
        // 1. 生成随机IV（12字节，GCM推荐）
        byte[] iv = new byte[12];
        SecureRandom random = new SecureRandom();
        random.nextBytes(iv);
        
        // 2. 初始化Cipher
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        GCMParameterSpec spec = new GCMParameterSpec(128, iv); // 128位认证标签
        cipher.init(Cipher.ENCRYPT_MODE, key, spec);
        
        // 3. 加密
        byte[] ciphertext = cipher.doFinal(plaintext);
        
        // 4. 返回 IV + 密文（便于解密时提取IV）
        byte[] result = new byte[iv.length + ciphertext.length];
        System.arraycopy(iv, 0, result, 0, iv.length);
        System.arraycopy(ciphertext, 0, result, iv.length, ciphertext.length);
        return result;
    }
    
    public static byte[] decrypt(byte[] ciphertextWithIv, SecretKey key) throws Exception {
        // 1. 提取IV
        byte[] iv = new byte[12];
        System.arraycopy(ciphertextWithIv, 0, iv, 0, iv.length);
        
        // 2. 提取密文
        byte[] ciphertext = new byte[ciphertextWithIv.length - iv.length];
        System.arraycopy(ciphertextWithIv, iv.length, ciphertext, 0, ciphertext.length);
        
        // 3. 解密
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        GCMParameterSpec spec = new GCMParameterSpec(128, iv);
        cipher.init(Cipher.DECRYPT_MODE, key, spec);
        return cipher.doFinal(ciphertext);
    }
}
```

### 10.2 RSA加密（Java）

```java
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import javax.crypto.Cipher;

public class RSAExample {
    
    public static KeyPair generateKeyPair() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048); // 2048位密钥
        return generator.generateKeyPair();
    }
    
    public static byte[] encrypt(byte[] plaintext, PublicKey publicKey) throws Exception {
        Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        cipher.init(Cipher.ENCRYPT_MODE, publicKey);
        return cipher.doFinal(plaintext);
    }
    
    public static byte[] decrypt(byte[] ciphertext, PrivateKey privateKey) throws Exception {
        Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        cipher.init(Cipher.DECRYPT_MODE, privateKey);
        return cipher.doFinal(ciphertext);
    }
}
```

### 10.3 SM4-CBC（Go）

```go
package main

import (
    "crypto/cipher"
    "crypto/rand"
    "encoding/base64"
    "fmt"
    "io"
    
    "github.com/emmansun/gmsm/sm4"
)

func encryptSM4(plaintext []byte, key []byte) (string, error) {
    // 1. 创建SM4 cipher
    block, err := sm4.NewCipher(key)
    if err != nil {
        return "", err
    }
    
    // 2. 生成随机IV
    iv := make([]byte, sm4.BlockSize)
    if _, err := io.ReadFull(rand.Reader, iv); err != nil {
        return "", err
    }
    
    // 3. CBC模式加密
    ciphertext := make([]byte, len(plaintext))
    mode := cipher.NewCBCEncrypter(block, iv)
    mode.CryptBlocks(ciphertext, plaintext)
    
    // 4. 返回 IV + 密文
    result := append(iv, ciphertext...)
    return base64.StdEncoding.EncodeToString(result), nil
}

func decryptSM4(ciphertextB64 string, key []byte) ([]byte, error) {
    data, _ := base64.StdEncoding.DecodeString(ciphertextB64)
    
    // 1. 提取IV
    iv := data[:sm4.BlockSize]
    ciphertext := data[sm4.BlockSize:]
    
    // 2. 创建SM4 cipher
    block, err := sm4.NewCipher(key)
    if err != nil {
        return nil, err
    }
    
    // 3. CBC模式解密
    plaintext := make([]byte, len(ciphertext))
    mode := cipher.NewCBCDecrypter(block, iv)
    mode.CryptBlocks(plaintext, ciphertext)
    
    return plaintext, nil
}
```


## 十一、常见问题与解决方案

### Q1：密钥长度越长越安全吗？

**不完全是**。密钥长度只是"原材料"的长度，**安全强度**才是实际防护能力。对于AES，128位密钥恰好提供128比特安全强度。但对于RSA，2048位密钥仅提供约**112比特**安全强度，因为存在比穷举更高效的数学攻击方法（如数域筛法）。

**建议**：理解"安全强度"概念，而非盲目追求密钥长度。

### Q2：如何选择对称加密的工作模式？

| 场景       | 推荐模式    | 原因                             |
| ---------- | ----------- | -------------------------------- |
| 通用加密   | **AES-GCM** | 认证加密，同时提供机密性和完整性 |
| 高性能需求 | AES-CTR     | 可并行，流密码模式               |
| 磁盘加密   | AES-XTS     | 专为存储加密设计                 |
| 兼容性要求 | AES-CBC     | 广泛支持                         |

❌ **避免使用ECB模式**：相同明文产生相同密文，存在安全风险。

### Q3：RSA vs ECC 如何选择？

| 考量因素                 | RSA                    | ECC               |
| ------------------------ | ---------------------- | ----------------- |
| 相同安全强度下的密钥长度 | 3072位                 | 256位             |
| 加密/解密速度            | 慢（约AES的1/30）      | 快（比RSA快得多） |
| 密钥生成速度             | 慢                     | 快                |
| 资源占用                 | 高                     | 低                |
| 成熟度                   | 极高                   | 高                |
| **推荐**                 | 传统系统、兼容性要求高 | **新系统首选**    |

### Q4：国密SM4与国际算法如何选型？

| 场景                 | 建议                            |
| -------------------- | ------------------------------- |
| 国内政务、金融系统   | **必须使用国密**（SM2/SM3/SM4） |
| 涉及关键信息基础设施 | 优先考虑国密                    |
| 国际业务/开源项目    | AES + ECC（国际主流）           |
| 混合场景             | 同时支持国际算法和国密算法      |

### Q5：如何安全存储和管理密钥？

1. **分层密钥架构**：根密钥 → 主密钥 → 数据密钥（DEK）
2. **使用KMS/HSM**：硬件安全模块或密钥管理服务
3. **密钥轮换**：定期更换密钥，降低泄露风险
4. **密钥隔离**：DEK仅在内存中存在，断电自动销毁
5. **最小权限原则**：仅授权必要人员访问密钥


## 十二、最佳实践与智能选型指南

### 12.1 算法选型决策树

```
开始
  │
  ▼
是否涉及中国政务/金融/关键基础设施？
  ├─ 是 → 使用国密算法（SM2/SM3/SM4）
  └─ 否 → 继续
          │
          ▼
      是否需要密钥交换/数字签名/身份认证？
          ├─ 是 → 使用非对称加密
          │       ├─ 新系统/资源受限 → ECC（Curve25519）
          │       └─ 传统系统/兼容性要求 → RSA-2048或以上
          └─ 否 → 使用对称加密
                  ├─ 高敏感数据 → AES-256-GCM
                  └─ 一般敏感数据 → AES-128-GCM
```

### 12.2 各场景推荐方案

| 场景               | 推荐方案                   | 理由                |
| ------------------ | -------------------------- | ------------------- |
| **HTTPS/TLS**      | ECDHE + AES-GCM            | 前向安全性 + 高性能 |
| **数据库字段加密** | AES-256-GCM                | 高安全性，认证加密  |
| **文件加密存储**   | AES-256-XTS                | 专为存储优化        |
| **物联网设备**     | ECC-256 + AES-128          | 资源占用低          |
| **移动App通信**    | ECC（Curve25519）+ AES-GCM | 短密钥，高性能      |
| **区块链**         | ECDSA（secp256k1）         | 行业标准            |
| **中国政务系统**   | SM2 + SM3 + SM4            | 合规要求            |
| **云端数据加密**   | AES-256 + KMS管理密钥      | 安全 + 易管理       |

### 12.3 核心原则

1. **新系统优先选择 AES-256（对称）+ ECC（非对称）组合**
2. **永远不要在应用层实现自己的加密算法**——使用经过充分验证的标准库
3. **使用认证加密模式（如GCM）** ，同时保证机密性和完整性
4. **密钥管理比算法选择更重要**——再强的算法，密钥泄露也毫无意义
5. **关注量子计算威胁**：ECC可通过切换至Curve25519升级抗量子能力


## 十三、参考官方文档与标准

| 算法             | 标准/文档                            |
| ---------------- | ------------------------------------ |
| AES              | NIST FIPS 197                        |
| RSA              | PKCS#1 v2.2, RFC 8017                |
| ECC              | SEC 1/2, ANSI X9.62, NIST SP 800-56A |
| SM4              | GM/T 0002-2012                       |
| SM2              | GM/T 0003-2012                       |
| SM3              | GM/T 0004-2012                       |
| TLS 1.3 国密套件 | RFC 8998                             |


## 十四、GitHub知名开源项目

| 项目                                                                  | 语言            | 特点                                                     |
| --------------------------------------------------------------------- | --------------- | -------------------------------------------------------- |
| **[JPSSL](https://github.com/DaChengTechnology/JPSSL)**               | C++20           | 跨平台密码学库，支持AES/RSA/ECC/SM2/SM3/SM4，CPU+GPU加速 |
| **[go-cryptobin](https://github.com/deatil/go-cryptobin)**            | Go              | 常用加解密库，支持RSA/SM2/ECDSA/AES/SM4等                |
| **[gmkit](https://github.com/gmkits/gmkit)**                          | TypeScript/Java | 以国密算法为核心，统一架构的密码工具集                   |
| **[gsc](https://github.com/laenix/gsc)**                              | Go              | 分组密码教学项目，注重可读性，适合初学者                 |
| **[openHiTLS](https://github.com/openharmony/third_party_openhitls)** | C               | 开源鸿蒙密码学开发套件，支持AES/SM4/Chacha20等           |


## 十五、总结

加密算法的选择没有"银弹"，需要根据**安全需求、性能要求、合规约束、资源限制**等多维因素综合决策。

- **对称加密**：AES是事实标准，SM4是国密合规首选
- **非对称加密**：ECC是现代化首选，RSA是传统兼容之选
- **混合加密**：结合两者优势，是绝大多数安全系统的黄金实践

记住：**加密是安全的基石，但只有正确的选型、规范的实现和严格的密钥管理，才能真正构筑起牢不可破的安全防线。**

---

*本文档基于2025-2026年公开技术资料整理，将持续跟进密码学领域的最新发展。*