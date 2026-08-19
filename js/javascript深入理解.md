# JavaScript 核心知识完全解析手册（从 V8 底层到事件循环）

> **前言**：本文并非 API 速查手册，而是一份深入 **V8 引擎底层机制**、**内存模型** 与 **ECMAScript 规范抽象操作** 的完整指南。我们将从编译期开始，历经执行上下文、原型链、异步循环，直至 ES6+ 的元编程特性，构建完整的 JS 知识体系。

---

## 第一章：执行上下文与作用域（Execution Context & Scope）

JS 代码并非逐行直译，而是经历**编译阶段**再执行。这是理解变量提升、闭包和内存泄漏的基石。

### 1.1 编译期与执行期的“时空割裂”

- **编译期（Creation Phase）**：解析器（Parser）生成 AST，确定当前作用域的所有标识符，并分配内存。
- **执行期（Execution Phase）**：逐行执行代码，进行赋值、计算和函数调用。

### 1.2 全局执行上下文（GEC）与函数执行上下文（FEC）

- **GEC**：页面/进程启动时创建，包含**变量环境（VE）**（存储 `var` 和函数声明）和**词法环境（LE）**（存储 `let/const`）。
- **FEC**：每次函数调用时创建，包含 VE、LE 和 `this` 绑定，并被推入调用栈（Call Stack）。

**内存布局（编译完成后）：**

```text
+-------------------------------------------------------+
|          全局执行上下文 (GEC) - 编译阶段完成             |
+------------------------+------------------------------+
|   变量环境 (VE)        |    词法环境 (LE)             |
|   (存储 var/函数)      |    (存储 let/const)          |
+------------------------+------------------------------+
|  a: undefined          |  b: <uninitialized>  (TDZ)  |
|  foo: 0x7F8A (函数体)  |  c: <uninitialized>  (TDZ)  |
+------------------------+------------------------------+
```

### 1.3 变量提升（Hoisting）与暂时性死区（TDZ）

- **`var`**：声明提升并初始化为 `undefined`，允许提前访问（值为 `undefined`）。
- **`let/const`**：声明提升但**未初始化**，进入块级作用域后到声明前无法访问，形成 **TDZ（Temporal Dead Zone）**。访问即报 `ReferenceError`。

### 1.4 作用域链与闭包的“堆内存”真相

**作用域链**：函数访问变量时，从当前作用域向上逐级查找（通过 `[[OuterEnv]]` 指针）。

**闭包本质**：函数保留对其外部词法环境的引用（存储在**堆内存**中），即使外部函数执行完毕（FEC 弹出），该环境对象依然存活。

**堆内存布局（闭包引用大对象）：**

```text
【outer 执行完，setTimeout 等待中】
调用栈: [global] 
堆内存:
+---------------------------------------+
| 闭包上下文 (Closure Context)           |
|  +---------------------------------+  |
|  | bigData (0x7F) 大小: 8MB        |  | <-- 被 inner 的 [[Scope]] 死死抱住
|  +---------------------------------+  |
+---------------------------------------+
        ↑ (引用)
+-------------------+
| inner 函数对象     |
| [[Scope]] --------|---> 指向上述闭包上下文
+-------------------+
```

> **关键优化**：V8 采用“分析型闭包（Analyzed Closure）”，只捕获被引用的变量。若 `inner` 未使用 `bigData`，`bigData` 不会进入闭包上下文，随栈帧弹出立即释放。

---

## 第二章：原型链与面向对象（Prototype & OOP）

JS 的继承基于对象（原型），而非类。ES6 `class` 仅为语法糖。

### 2.1 核心指针：`prototype` 与 `__proto__` 的内存分工

- **`prototype`**：**只有函数（构造函数）才有**。它是挂载共享属性和方法的“模具”（如 `Array.prototype` 存放 `push` 方法）。
- **`__proto__`**（底层 `[[Prototype]]`）：**所有对象都有**。它指向自己“亲生父亲”的模具内存地址。

**内存指向图：**

```text
          +------------------+
          |   function Foo   |  (构造函数，存在于堆内存)
          |   prototype  -----|--------------+
          +------------------+              |
                                            v
+------------------+          +----------------------------+
|   let f = new Foo |         |     Foo.prototype (对象)    |
|   __proto__  -----|-------->|     (原型对象)              |
+------------------+          |     __proto__  ------------+--> Object.prototype --> null
                              |     constructor: Foo       |
                              +----------------------------+
```

### 2.2 `new` 操作符的 4 步底层调用链（V8 视角）

1. **分配内存**：`Heap::Allocate` 在堆中划出一块内存。
2. **绑定原型**：`newObj->map->prototype = Constructor.prototype`（**直接赋值，无查找**）。
3. **执行构造函数**：`Call(Constructor, newObj, args)`，将 `this` 指向新对象。
4. **返回对象**：若构造函数返回引用类型，则返回该引用；否则返回新对象。

**手写实现：**
```javascript
function myNew(Constructor, ...args) {
    const obj = Object.create(Constructor.prototype); // 绑定原型
    const result = Constructor.apply(obj, args);     // 执行构造
    return (result && typeof result === 'object') ? result : obj;
}
```

### 2.3 最优继承模式：寄生组合继承

**目的**：切断父子构造函数的直接引用，避免父类构造函数执行两次及原型污染。

```javascript
function inherit(Child, Parent) {
    // 1. 创建空对象，__proto__ 指向 Parent.prototype（不执行 Parent）
    Child.prototype = Object.create(Parent.prototype);
    // 2. 修复 constructor 指针
    Child.prototype.constructor = Child;
}
```

### 2.4 `instanceof` 原理与手写

沿着左侧对象的 `__proto__` 链查找，是否等于右侧函数的 `prototype`。**注意：不查找基本类型**。

```javascript
function myInstanceof(left, right) {
    if (left === null || left === undefined) return false;
    if (typeof left !== 'object' && typeof left !== 'function') return false;
    let proto = Object.getPrototypeOf(left);
    while (proto) {
        if (proto === right.prototype) return true;
        proto = Object.getPrototypeOf(proto);
    }
    return false;
}
```

### 2.5 跨语言对比：JS vs iOS（ObjC）

| 概念             | JavaScript               | Objective-C           | 本质         |
| :--------------- | :----------------------- | :-------------------- | :----------- |
| **模具（蓝图）** | `Constructor.prototype`  | `[Class class]` 对象  | 存储实例方法 |
| **实例血缘指针** | `instance.__proto__`     | `instance->isa`       | 指向类型内存 |
| **继承链向上**   | `prototype.__proto__`    | `class->superclass`   | 向父级查找   |
| **类方法存储**   | 构造函数自身（函数对象） | **元类（MetaClass）** | 静态方法位置 |

---

## 第三章：对象内存布局与属性访问（V8 隐藏类）

### 3.1 物理结构：对象头 + 内嵌属性 + 溢出指针

V8 中的对象不是哈希表，而是一个**连续内存块**：

```text
+=====================================================================+
| 对象头 (Header)                                                      |
| 1. Map 指针 (指向 Hidden Class)                                      |
| 2. 标记字 (GC 颜色、锁状态)                                          |
+------------------+---------------------------------------------------+
| 指针字段           | 3. Properties 指针 -> 外部属性存储区 (溢出)      |
|                   | 4. Elements 指针 -> 数字索引存储区 (如 arr[0])    |
+------------------+---------------------------------------------------+
| 对象内属性槽位     | 5. 槽位 1 (in-object prop): 指向 "name"        |
| (In-object Props) | 6. 槽位 2 (in-object prop): 小整数 10 (SMI)     |
+------------------+---------------------------------------------------+
```

### 3.2 快速模式（Fast Mode） vs 字典模式（Slow Mode）

- **快速模式**：属性固定在前 3~4 个槽位，访问通过隐藏类偏移量（O(1)），极快。
- **慢速模式（字典模式）**：当属性数量超过上限或动态增删频繁时，降级为外部哈希表，节省内存但查找变慢。

---

## 第四章：`this` 的完全绑定规则与 `constructor` 澄清

### 4.1 `this` 优先级（从高到低）

1. **new 绑定**：`new Foo()`，`this` 指向新对象。
2. **显式绑定**：`call/apply/bind`，强制修改 `this`。
3. **隐式绑定**：`obj.foo()`，`this` 指向调用对象 `obj`。
4. **默认绑定**：独立调用，非严格模式 `global/window`，严格模式 `undefined`。
5. **箭头函数**：无自己的 `this`，继承外层词法作用域的 `this`（不可 `bind` 修改）。

### 4.2 核心误区：`constructor` 是静态方法吗？

**绝对不 是！** `constructor` 是挂在 **`Foo.prototype`** 上的共享属性，供实例访问以找到构造函数。**静态方法**挂在 `Foo` 自己身上（如 `static create()`）。

```javascript
class Foo { constructor() {} static bar() {} }
const f = new Foo();
console.log(f.constructor === Foo);        // true
console.log(Foo.bar);                      // [Function] (静态)
console.log(f.bar);                        // undefined (实例不可访问静态)
```

---

## 第五章：异步编程与事件循环（Event Loop）

### 5.1 V8 与宿主的分工（宏观架构）

- **V8 引擎**：只负责堆、栈、GC 以及 JS 代码的解释执行。它**不实现**定时器或 I/O。
- **宿主环境（浏览器/Node.js）**：提供 `setTimeout`、`fetch`、`fs.readFile` 等 API，并实现**事件循环（Event Loop）**。

### 5.2 宏任务（MacroTask）与微任务（MicroTask）执行顺序

1. 执行全局同步代码（Script）。
2. **清空微任务队列**（`Promise.then`，`MutationObserver`，`queueMicrotask`）。
3. 取**一个**宏任务（`setTimeout`，`setInterval`，I/O）执行。
4. 再次清空微任务队列（若执行宏任务时产生了新微任务）。
5. 循环往复。

### 5.3 经典坑点：`new Promise` 执行器是同步的

```javascript
new Promise((resolve) => {
    console.log('A'); // 立即同步执行
    resolve();
}).then(() => console.log('B')); // 微任务
console.log('C'); // 同步
// 输出顺序: A, C, B
```

### 5.4 宏任务中的栈帧生命周期与内存风险

**关键**：外层发起者（如 `outer`）的栈帧在执行 `setTimeout` 后会**立即弹出销毁**。宏任务回调在全新的空调用栈中执行。

**风险点**：若在宏任务中将局部对象挂载到**全局变量**或**闭包**上，则会导致内存泄漏。
```javascript
let cache = {};
setTimeout(() => {
    let huge = new ArrayBuffer(1024 * 1024 * 50);
    cache['key'] = huge; // ❌ 泄漏！宏任务结束，栈帧销毁，但 huge 被全局 cache 持有
}, 0);
```

### 5.5 Web Workers 与共享内存

- **隔离**：每个 Worker 拥有独立的 V8 隔离区（Isolate）、堆内存和事件循环。
- **通信**：`postMessage` 使用结构化克隆（深拷贝）传递数据。
- **共享内存**：仅 `SharedArrayBuffer` 允许共享原始二进制内存，需配合 `Atomics` 进行同步。

---

## 第六章：ES6+ 核心底层原理（元编程与内存管理）

### 6.1 `Symbol`：唯一属性键与内置协议

- **底层**：V8 堆中分配 `Symbol` 结构体，包含全局唯一 64 位哈希值。
- **存储**：作为属性键时，存储在对象的 **`SymbolTable`**（专用哈希表）中，`for...in` 和 `Object.keys()` 会跳过，`Reflect.ownKeys()` 才能获取。
- **`Symbol.iterator`**：`for...of` 循环通过 `GetMethod(obj, Symbol.iterator)` 获取迭代器，若不存在则抛出 `TypeError`。

### 6.2 `Proxy` 与 `Reflect`：系统级拦截器

- **内存架构**：`Proxy` 创建 `JSProxy` 对象，持有 `target` 和 `handler` 指针。它不修改原对象。
- **调用链（`proxy.name`）**：`JS代码` → `Bytecode` → `JSProxy::GetProperty` → `CallHandler(handler.get)` → 返回。涉及 C++ 到 JS 的上下文切换（性能低于普通对象）。
- **Vue3 选型原因**：`Proxy` 拦截 `[[Set]]`，不关心属性是否存在，天然支持**数组索引**和**新增属性**响应式，无需 `Vue.set` 等 hack。

### 6.3 模块化（ESM）的静态解析与循环依赖

**加载三阶段**：
1. **构建**：Host 加载源码 → V8 解析为 AST → 创建 `Module Record`。
2. **实例化**：DFS（深度优先）遍历依赖图，建立 `[[Environment]]` 引用链接（不执行代码）。
3. **求值**：执行顶层代码。

**循环依赖对比**：

| 规范         | 绑定机制                                                   | 循环依赖处理                                                       |
| :----------- | :--------------------------------------------------------- | :----------------------------------------------------------------- |
| **CommonJS** | **值拷贝**：`require` 时复制值，后续修改不影响已导入副本。 | DFS 加载，遇到循环返回当前已执行的缓存值（可能为 `undefined`）。   |
| **ESM**      | **实时引用（Live Binding）**：导入的是内存指针。           | DFS 建立所有引用后执行，只要导出在调用前完成赋值，就能拿到正确值。 |

### 6.4 `WeakMap` / `WeakSet`：与 GC 协作的弱引用

- **底层（Ephemeron 机制）**：键值对被设计为“瞬态”。GC 标记阶段，若**键**不可达（无其他强引用），则键和值**均不标记**，清除阶段直接抹除整个条目。
- **应用**：存储 DOM 节点或私有数据，防止内存泄漏。类实例销毁时，对应的私有数据自动从 `WeakMap` 中消失。
- **限制**：不可遍历（无 `keys()`、`values()`，因遍历时键可能已被回收）。

---

## 附录：核心手写代码与调试工具

### A.1 手写 `instanceof`（支持边界条件）
```javascript
function myInstanceof(left, right) {
  if (left === null || left === undefined) return false;
  if (typeof left !== 'object' && typeof left !== 'function') return false;
  if (typeof right !== 'function') throw new TypeError('Right-hand side is not callable');
  let proto = Object.getPrototypeOf(left);
  while (proto) {
    if (proto === right.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

### A.2 递归“三指针”打印机（展示 `__proto__`、`prototype`、`constructor`）
该函数沿原型链递归展开所有属性，清晰展示内存指向：
```javascript
function deepPrint(obj, indent = '', isLast = true, visited = new WeakSet()) {
  if (obj === null) return console.log('null');
  if (visited.has(obj)) return console.log('[循环引用]');
  visited.add(obj);
  console.log(`${indent}${isLast ? '└── ' : '├── '}[${obj.constructor?.name || 'null原型'}]`);
  // ... 获取自有属性并递归打印 ...
}
```

### A.3 Node.js 调试技巧
- **查看隐藏属性**：`console.dir(obj, { showHidden: true, depth: null })`
- **查看字节码**：`node --print-bytecode script.js`
- **查看 GC 日志**：`node --trace-gc script.js`

---

> **结束语**：JavaScript 的精髓在于 **内存指针的流转**（原型、闭包、引用）和 **事件循环的调度**。理解 V8 的隐藏类、弱引用机制以及宿主环境的任务队列，将帮助你在性能优化和架构设计上做出更精准的决策。