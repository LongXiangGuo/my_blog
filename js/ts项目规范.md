## 一、基础规范

>在多人团队协作的项目里,为ts项目指定一套统一的规范是非常有必要的

### 1.1 为什么需要基础规范

在团队协作中，不同成员的编码习惯差异会直接导致代码库风格混乱——同一个项目里，有人用单引号有人用双引号、有人写分号有人不写、变量命名五花八门。这些看似细小的分歧，累积起来会造成巨大的协作成本：如果一个团队每天合并20个PR，每个PR因格式问题产生3分钟的来回讨论，一个月就会消耗约12小时的无效时间。

基础规范的核心目标不是“谁说得对”，而是**消除争议、降低认知负担**。规范一旦建立，新成员通过看到规范被强制执行来学习，而不是通过老成员口口相传。

### 1.2 ESLint + Prettier 的分工

ESLint 和 Prettier 的职责必须清晰分离，否则两者会在代码风格上打架：

| 工具           | 职责                                 | 典型规则                                     |
| -------------- | ------------------------------------ | -------------------------------------------- |
| **ESLint**     | 代码质量（正确性、可维护性、一致性） | 未使用变量、不安全模式、导入边界、代码坏味道 |
| **Prettier**   | 代码格式化（确定性排版）             | 缩进、引号、分号、换行、尾逗号               |
| **TypeScript** | 类型安全与契约清晰度                 | 类型不匹配、无效属性访问、API误用            |

Linting 的核心原则是 **“将反馈左移”** ——越早发现缺陷，修复成本越低。

### 1.3 ESLint 基础配置

使用 ESLint 的 flat config 新格式（`eslint.config.mjs`），推荐从 `@typescript-eslint` 的推荐规则开始：

```javascript
// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 禁止使用 var
      'no-var': 'error',
      // 优先使用 const
      'prefer-const': 'error',
      // 使用 === 而非 ==
      'eqeqeq': ['error', 'always'],
      // 禁止使用 any（可先设为 warn 逐步收紧）
      '@typescript-eslint/no-explicit-any': 'warn',
      // 未使用变量报错
      '@typescript-eslint/no-unused-vars': 'error',
      // 导出函数需要显式返回类型
      '@typescript-eslint/explicit-function-return-type': 'warn',
    }
  }
);
```

Linting 应主要捕获控制流中的 bug 和安全隐患，同时强制执行现代化、习惯性的代码风格。每一条规则都应基于客观标准，而非个人偏好。

### 1.4 Prettier 基础配置

```javascript
// prettier.config.js
export default {
  printWidth: 100,
  semi: true,           // 统一使用分号
  singleQuote: true,    // 统一使用单引号
  trailingComma: 'es5',
  tabWidth: 2,
};
```

Prettier 还应配置为自动排序 import 语句、格式化 JSDoc 注释等，使 git diff 更小、代码审查更聚焦。


## 二、核心配置

### 2.1 tsconfig.json —— 团队与编译器的契约

`tsconfig.json` 本质上定义的是**团队对类型安全的态度**，而不仅仅是工具链配置。它回答的是：我们允许多宽松的类型行为？我们是否愿意在开发期就把风险暴露出来？

### 2.2 推荐的严格配置

基于微软官方推荐及业界最佳实践：

```json
{
  "compilerOptions": {
    // 基础选项
    "target": "ES2022",
    "module": "NodeNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    
    // ⚠️ 严格类型检查——这是类型安全的基石
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    
    // 🔥 强烈推荐开启——暴露索引访问的真实风险
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    
    // 模块解析
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    
    // 其他
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmitOnError": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 2.3 关键配置解读

**`strict: true`** 是真正开启 TypeScript 的开关。开启后，TypeScript 会认真处理隐式 any、空值问题、不安全赋值、宽松的函数参数兼容等各类潜在类型漏洞。不开 strict，TypeScript 最有价值的保护就被关掉了。

**`noUncheckedIndexedAccess: true`** 能暴露大量被忽略的真实风险。例如 `const value = map["x"]` 在未开启时类型被推断为 `number`，开启后变为 `number | undefined`——后者更符合现实。大量线上 bug 都来自“我以为这个 key 一定有”“我以为这个数组下标一定取得到”这类错误假设。

**`skipLibCheck: true`** 跳过对 `node_modules` 中声明文件的类型检查，能显著提升编译速度，但代价是降低了对依赖声明问题的感知——这是一个性能与稳定性的折中。

### 2.4 在 Monorepo 中共享配置

在 Monorepo 场景下，应在根目录创建共享的 `tsconfig.base.json`，各子项目继承该基础配置：

```json
// packages/app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

这样可以在所有包中保持一致的编译设置，只需在一个地方更新 TypeScript 配置。


## 三、工程实践

### 3.1 Git 提交前自动检查（Husky + lint-staged）

规范要落地，不能只靠自觉，必须通过工具强制执行：

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

效果是：代码提交前自动格式化，不符合规范的代码无法提交。Code Review 时不再需要讨论“分号加不加”这类问题，可以专注于逻辑本身。

### 3.2 CI/CD 质量门禁

在 CI 流程中设置强制性的质量门禁，是保证团队稳定性的关键。推荐在 CI 中按顺序执行以下检查：

```yaml
# GitHub Actions 示例
jobs:
  quality-gates:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint          # ESLint 检查
      - run: npm run typecheck     # TypeScript 类型检查 (tsc --noEmit)
      - run: npm run test          # 单元测试
      - run: npm run build         # 构建验证
```

**质量门禁的核心原则**：任何一项检查失败，都应阻止合并和部署。行业数据显示，集成自动化验证步骤的团队能在 Code Review 前捕获超过 85% 的 bug，显著减少回滚成本。

### 3.3 编码规范文档化

工具只能覆盖“格式”层面的规范，业务层面的规范需要文档来明确：

```markdown
# 团队开发规范

## API 调用
✅ 使用统一的 request 工具
❌ 不要直接用 fetch 或 axios

## 组件编写
✅ 优先使用函数组件 + Hooks
❌ 不要新写 Class 组件

## 命名规范
- 组件文件：PascalCase（UserProfile.tsx）
- 工具函数：camelCase（formatDate.ts）
- 常量：UPPER_SNAKE_CASE（API_BASE_URL）
```

规范落地后，Code Review 时间可以从平均 1 小时降到 20 分钟。

### 3.4 TypeScript 类型规范要点

- **优先使用 `interface` 定义对象形状**：`interface` 支持声明合并，更适合面向对象设计和扩展
- **使用 `type` 处理复杂类型组合**：联合类型、交叉类型、映射类型等
- **避免 `any`，拥抱 `unknown`**：`any` 会绕过所有类型检查，是类型安全的头号敌人
- **开启类型感知的 ESLint 规则**：如 `no-floating-promises`、`no-misused-promises`、`no-unsafe-*` 系列规则
- **`strict-boolean-expressions`**：防止在条件判断中出现 truthy/falsy 的意外行为

### 3.5 渐进式收紧策略

如果接手的是老项目，不一定能一夜之间把所有严格选项全开。但长期方向应该是**逐步收紧，而不是为了清静持续放松**。具体策略：

1. 新代码用新规则，老代码逐步改造
2. 将 `any` 从 `error` 降为 `warn`，逐步消除
3. 先在 CI 中设置为 `warning` 不阻断构建，待问题解决后升级为 `error`
4. 定期更新 lint 规则以适应新技术特性


## 总结：保障团队稳定性的三层体系

| 层次         | 内容                           | 目标                       |
| ------------ | ------------------------------ | -------------------------- |
| **基础规范** | ESLint + Prettier 配置         | 消除风格争议，统一编码习惯 |
| **核心配置** | tsconfig 严格模式 + 共享配置   | 类型安全，在编译期暴露风险 |
| **工程实践** | Husky + CI 质量门禁 + 规范文档 | 强制执行，防止规范被绕过   |

三者缺一不可：**没有基础规范，团队风格混乱；没有核心配置，类型安全形同虚设；没有工程实践，规范永远停留在纸面**。