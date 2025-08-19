# TypeScript-Only 强制执行政策 (MANDATORY TYPESCRIPT-ONLY POLICY)

## 🚨 项目级强制执行指令 - 不可违反

⚠️ **绝对禁止**: 本项目强制要求100%使用TypeScript开发，任何违反TypeScript-Only政策的行为将被自动拒绝。

### 📋 核心强制执行规则 (CORE ENFORCEMENT RULES)

#### Rule #1: 禁止修改JavaScript文件 (NO JAVASCRIPT FILE MODIFICATION)

**严格禁止的操作**:
- ❌ 修改任何 `.js` 文件 
- ❌ 创建新的 `.js` 文件
- ❌ 将 `.ts` 文件重命名为 `.js`
- ❌ 使用JavaScript语法编写代码

**强制要求**:
- ✅ 所有业务逻辑必须用 `.ts` 文件编写
- ✅ 所有新代码必须具备完整的TypeScript类型定义
- ✅ 使用TypeScript语法和特性

#### Rule #2: 源代码100%TypeScript (100% TYPESCRIPT SOURCE CODE)

**源代码目录约束** (`src/` 目录):
```typescript
// ✅ 正确示例 - 完整TypeScript类型定义
interface RequestConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  timeout?: number;
}

class ApiClient {
  private config: RequestConfig;
  
  constructor(config: RequestConfig) {
    this.config = config;
  }
  
  async request<T>(data?: unknown): Promise<T> {
    // TypeScript实现
  }
}
```

```javascript
// ❌ 错误示例 - JavaScript语法
const client = {
  request: function(data) {
    // JavaScript实现 - 严禁使用
  }
}
```

#### Rule #3: 编译文件保护 (COMPILED FILES PROTECTION)

**严格禁止修改编译后文件**:
- ❌ 直接修改 `dist/` 目录下的任何文件
- ❌ 手动编辑 `.js` 编译产物
- ❌ 手动编辑 `.d.ts` 声明文件
- ❌ 绕过TypeScript编译器直接修改输出文件

**强制工作流程**:
1. ✅ 修改 `src/` 目录下的 `.ts` 源文件
2. ✅ 运行 `npm run build` 重新编译
3. ✅ 验证编译无错误
4. ✅ 测试编译后的功能

#### Rule #4: TypeScript错误零容忍 (ZERO TYPESCRIPT ERRORS)

**编译错误处理原则**:
- ❌ 禁止忽略TypeScript编译错误
- ❌ 禁止使用 `@ts-ignore` 绕过错误
- ❌ 禁止禁用严格类型检查
- ❌ 禁止使用 `any` 类型作为错误修复手段

**正确错误处理流程**:
```typescript
// ✅ 正确 - 明确类型定义
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

async function fetchData(): Promise<ApiResponse<UserData>> {
  // 具体实现
}

// ❌ 错误 - 使用any逃避类型检查  
async function fetchData(): Promise<any> {
  // 不允许
}
```

### 🔧 技术实现要求 (TECHNICAL REQUIREMENTS)

#### TypeScript配置强制要求

**tsconfig.json 必需配置**:
```json
{
  "compilerOptions": {
    "strict": true,                          // 强制严格模式
    "noImplicitAny": true,                  // 禁止隐式any
    "noImplicitReturns": true,              // 禁止隐式返回
    "noFallthroughCasesInSwitch": true,     // 禁止switch fall-through
    "noUncheckedIndexedAccess": true,       // 禁止未检查的索引访问
    "exactOptionalPropertyTypes": true,      // 精确可选属性类型
    "noImplicitOverride": true,             // 禁止隐式override
    "noPropertyAccessFromIndexSignature": true  // 禁止从索引签名访问属性
  }
}
```

#### 文件结构强制约束

**允许的文件扩展名**:
- ✅ `.ts` - TypeScript源文件
- ✅ `.d.ts` - TypeScript声明文件  
- ✅ `.json` - 配置文件
- ✅ `.md` - 文档文件

**禁止的文件扩展名**:
- ❌ `.js` - JavaScript文件 (除了编译产物)
- ❌ `.jsx` - React JavaScript文件
- ❌ `.mjs` - ES Module JavaScript文件

### 🛡️ 自动化检查机制 (AUTOMATED ENFORCEMENT)

#### 预提交检查 (Pre-commit Hooks)

```bash
#!/bin/bash
# .claude/rules/scripts/typescript-only-check.sh

echo "🔍 执行TypeScript-Only强制检查..."

# 检查是否有JavaScript文件被修改
JS_FILES=$(git diff --cached --name-only | grep -E '\.(js|jsx|mjs)$' | grep -v '^dist/' || true)
if [ ! -z "$JS_FILES" ]; then
  echo "❌ 错误: 检测到JavaScript文件修改，违反TypeScript-Only政策"
  echo "违规文件:"
  echo "$JS_FILES"
  echo ""
  echo "解决方案: 使用TypeScript (.ts) 文件替代JavaScript文件"
  exit 1
fi

# 检查TypeScript编译
echo "🔧 检查TypeScript编译..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ 错误: TypeScript编译失败"
  echo "必须修复所有TypeScript错误后才能提交"
  exit 1
fi

# 检查类型覆盖率
echo "📊 检查TypeScript类型覆盖率..."
npx type-coverage --at-least 95
if [ $? -ne 0 ]; then
  echo "❌ 错误: TypeScript类型覆盖率低于95%"
  echo "请添加缺失的类型定义"
  exit 1
fi

echo "✅ TypeScript-Only检查通过"
```

#### 开发时实时检查

```json
// package.json scripts
{
  "scripts": {
    "dev": "tsc --watch --strict",
    "build": "tsc --noEmit && tsc",
    "type-check": "tsc --noEmit",
    "lint:ts": "eslint src/**/*.ts --ext .ts",
    "pre-commit": "bash .claude/rules/scripts/typescript-only-check.sh"
  }
}
```

### 📋 违规处理机制 (VIOLATION HANDLING)

#### 自动拒绝条件

以下行为将导致开发工作被**自动拒绝**:

1. **JavaScript文件操作**:
   - 修改任何 `.js` 文件
   - 创建新的 `.js` 文件
   - 尝试用JavaScript语法编写代码

2. **编译错误忽略**:
   - 使用 `@ts-ignore` 绕过错误
   - 禁用严格类型检查
   - 提交存在TypeScript错误的代码

3. **类型安全违规**:
   - 大量使用 `any` 类型
   - 类型覆盖率低于95%
   - 缺失关键接口定义

#### 错误修复指导

**遇到TypeScript错误时的标准处理流程**:

1. **分析错误类型**:
   ```bash
   # 运行类型检查
   npm run type-check
   
   # 查看详细错误信息
   npx tsc --noEmit --pretty
   ```

2. **定义正确类型**:
   ```typescript
   // 为未知类型创建接口
   interface ApiError {
     code: string;
     message: string;
     details?: unknown;
   }
   
   // 使用联合类型处理多种可能
   type ResponseStatus = 'success' | 'error' | 'pending';
   ```

3. **渐进式类型改进**:
   ```typescript
   // 第一步：使用基础类型
   function processData(data: unknown): string {
     // 类型守卫
     if (typeof data === 'string') {
       return data;
     }
     return JSON.stringify(data);
   }
   
   // 第二步：精确类型定义
   interface ProcessableData {
     id: string;
     content: string;
   }
   
   function processData(data: ProcessableData): string {
     return `${data.id}: ${data.content}`;
   }
   ```

### 🎯 质量保证标准 (QUALITY ASSURANCE)

#### TypeScript质量指标

**必需达到的标准**:
- ✅ 类型覆盖率: ≥95%
- ✅ 编译错误: 0个
- ✅ 类型lint错误: 0个
- ✅ 严格模式: 100%启用

#### 代码审查检查清单

**TypeScript-Only审查要点**:
- [ ] 所有函数都有明确的参数和返回类型
- [ ] 接口定义完整且准确
- [ ] 没有使用 `any` 类型作为捷径
- [ ] 错误处理具备类型安全
- [ ] 异步操作正确使用Promise类型
- [ ] 模块导入导出使用TypeScript语法

### 🚀 开发工具集成 (DEVELOPMENT TOOLS)

#### VS Code配置

```json
// .vscode/settings.json
{
  "typescript.preferences.strictFunctionTypes": true,
  "typescript.preferences.strictNullChecks": true,
  "typescript.preferences.strictPropertyInitialization": true,
  "files.exclude": {
    "**/*.js": {"when": "$(basename).ts"},
    "dist/": true
  },
  "search.exclude": {
    "dist/": true,
    "**/*.js": true
  }
}
```

#### ESLint TypeScript配置

```json
// .eslintrc.json
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/prefer-as-const": "error",
    "@typescript-eslint/restrict-template-expressions": "error"
  }
}
```

---

## 📊 合规监控报告

### 实时监控指标

**每日检查项目**:
- TypeScript编译状态
- 类型覆盖率变化
- JavaScript文件数量监控
- 违规操作检测日志

### 月度质量报告

**自动生成报告包含**:
- TypeScript采用率统计
- 类型安全改进趋势
- 常见违规模式分析
- 开发效率影响评估

---

## ⚠️ 最终警告

**此政策为项目生命周期内的永久性规则，任何尝试绕过或违反TypeScript-Only要求的行为都将导致开发工作被立即拒绝。**

**项目成功的关键在于严格遵循TypeScript最佳实践，确保代码的类型安全、可维护性和可扩展性。**