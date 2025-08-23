---
trigger: always_on
alwaysApply: true
---
# RCC v4.0 编程规则和开发标准

## 项目基本信息

**项目名称**: Route Claude Code (RCC) v4.0  
**架构模式**: 严格模块化，流水线处理  
**开发语言**: TypeScript/Node.js  

## 开发前强制检查清单

### 1. 文档查阅要求

#### 开发前必须检查的文档（按优先级）
- **[MANDATORY]** `.claude/project-details/modules/[module-name]/README.md` - 查看目标模块的详细设计
- **[MANDATORY]** `.claude/project-details/rcc-v4-specification.md` - 了解项目总体规格
- **[MANDATORY]** `.claude/project-details/modules/README.md` - 理解模块化架构
- **[MANDATORY]** `.claude/project-details/client-module-design.md` - 客户端模块详细设计（如涉及）

#### 文档检查验证步骤
```bash
# 1. 确认目标模块文档存在
ls -la .claude/project-details/modules/[target-module]/README.md

# 2. 检查相关依赖模块的文档
find .claude/project-details/modules/ -name "README.md" | grep [dependency-modules]

# 3. 验证最新的项目规格
stat .claude/project-details/rcc-v4-specification.md
```

### 2. 架构理解验证

开发前必须能回答以下问题：
- [ ] 目标模块在六层架构中的位置？(Client → Router → Pipeline → Transformer/Protocol/Server-Compatibility/Server)
- [ ] 模块的单一职责是什么？
- [ ] 模块的输入/输出接口定义？
- [ ] 与其他模块的依赖关系？
- [ ] 错误处理责任边界？

## 模块化编程约束

### 1. 严格模块边界

#### 禁止行为（违反立即拒绝）
```typescript
// ❌ 禁止：跨模块直接调用内部方法
import { InternalMethod } from '../other-module/internal';

// ❌ 禁止：模块功能重叠
class Router {
  // 这是Pipeline的职责，不应在Router中实现
  transformData() {} 
}

// ❌ 禁止：绕过标准接口
const directAccess = require('../../../pipeline/internal/private-method');
```

#### 正确做法
```typescript
// ✅ 正确：通过标准接口通信
import { RouterManager } from '../router';
import { PipelineManager } from '../pipeline';

class ClientModule {
  constructor(
    private routerManager: RouterManager,
    private pipelineManager: PipelineManager
  ) {}
}

// ✅ 正确：明确的接口定义
interface ModuleInterface {
  process(input: StandardInput): Promise<StandardOutput>;
  handleError(error: RCCError): void;
}
```

### 2. 目录结构规范

#### 强制目录结构
```
src/[module-name]/
├── README.md                    # 必须：模块说明文档
├── index.ts                     # 必须：模块入口和接口导出
├── [module-name].ts             # 必须：主要实现类
├── types/                       # 必须：模块专用类型定义
│   ├── [module]-types.ts        # 模块接口类型
│   ├── [module]-config.ts       # 配置类型
│   └── [module]-errors.ts       # 错误类型
├── utils/                       # 可选：模块内部工具
└── __tests__/                   # 必须：模块测试
    ├── [module].test.ts         # 单元测试
    └── integration.test.ts      # 集成测试
```

#### 文件命名规范
- **模块文件**: `kebab-case` (例如: `server-manager.ts`)
- **类型文件**: `kebab-case` + `-types.ts` 后缀
- **测试文件**: 原文件名 + `.test.ts` 后缀
- **配置文件**: `kebab-case` + `-config.ts` 后缀

## 代码质量强制标准

### 1. 零硬编码原则（最高优先级）

**🚨 强制规则**: 所有硬编码值必须放入 `src/constants/` 目录下的专用文件中

#### 绝对禁止的硬编码
```typescript
// ❌ 严重违规：硬编码URL、端口、密钥
const API_URL = "https://api.openai.com/v1";
const DEFAULT_PORT = 3456;
const API_KEY = "sk-...";

// ❌ 严重违规：硬编码模型名称
if (model === "gpt-4") {
  // ...
}

// ❌ 严重违规：硬编码文件路径
const configPath = "/home/user/.route-claudecode/config";

// ❌ 严重违规：硬编码错误消息
throw new Error("Configuration file not found");

// ❌ 严重违规：硬编码超时时间
setTimeout(callback, 5000);
```

#### 强制Constants目录结构
```
src/constants/
├── index.ts                     # 统一导出所有常量
├── api-defaults.ts              # API相关默认值
├── server-defaults.ts           # 服务器相关默认值
├── timeout-defaults.ts          # 超时相关默认值
├── error-messages.ts            # 错误消息常量
├── file-paths.ts                # 文件路径常量
├── model-mappings.ts            # 模型映射常量
└── validation-rules.ts          # 验证规则常量
```

#### 正确的Constants使用方式
```typescript
// ✅ 正确：src/constants/api-defaults.ts
export const API_DEFAULTS = {
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
  DEFAULT_MAX_TOKENS: 4096,
  DEFAULT_TEMPERATURE: 0.7,
} as const;

export const SUPPORTED_MODELS = {
  OPENAI: ['gpt-4', 'gpt-3.5-turbo'] as const,
  ANTHROPIC: ['claude-3-sonnet', 'claude-3-haiku'] as const,
  GEMINI: ['gemini-pro', 'gemini-pro-vision'] as const,
} as const;

// ✅ 正确：src/constants/server-defaults.ts
export const SERVER_DEFAULTS = {
  DEFAULT_PORT: 5506,
  DEFAULT_HOST: '0.0.0.0',
  MAX_CONNECTIONS: 1000,
  KEEP_ALIVE_TIMEOUT: 30000,
} as const;

// ✅ 正确：src/constants/timeout-defaults.ts
export const TIMEOUT_DEFAULTS = {
  REQUEST_TIMEOUT: 30000,
  CONNECTION_TIMEOUT: 5000,
  HEALTH_CHECK_INTERVAL: 10000,
  RETRY_DELAY: 1000,
} as const;

// ✅ 正确：src/constants/error-messages.ts
export const ERROR_MESSAGES = {
  CONFIG_NOT_FOUND: 'Configuration file not found',
  PROVIDER_NOT_CONFIGURED: 'Provider not configured',
  INVALID_MODEL: 'Invalid model specified',
  CONNECTION_FAILED: 'Failed to connect to provider',
} as const;

// ✅ 正确：src/constants/file-paths.ts
export const FILE_PATHS = {
  DEFAULT_CONFIG_DIR: '~/.route-claudecode',
  DEFAULT_LOG_DIR: '~/.route-claudecode/logs',
  DEFAULT_CONFIG_FILE: 'config.json',
  GENERATED_CONFIGS_DIR: './generated',
} as const;

// ✅ 正确：在代码中使用常量
import { API_DEFAULTS, SERVER_DEFAULTS, ERROR_MESSAGES } from '../constants';

class ConfigManager {
  private config: ProviderConfig;
  
  constructor(configPath: string = FILE_PATHS.DEFAULT_CONFIG_FILE) {
    this.config = this.loadConfig(configPath);
  }
  
  getProviderUrl(provider: string): string {
    const url = this.config.providers[provider]?.baseUrl;
    if (!url) {
      throw new ConfigError(ERROR_MESSAGES.PROVIDER_NOT_CONFIGURED);
    }
    return url;
  }
  
  getDefaultTimeout(): number {
    return this.config.timeout || TIMEOUT_DEFAULTS.REQUEST_TIMEOUT;
  }
}

// ✅ 正确：环境变量替换（配置模板仍使用constants）
const configTemplate = {
  apiKey: "${OPENAI_API_KEY}",
  baseUrl: `\${API_BASE_URL:-${API_DEFAULTS.OPENAI_BASE_URL}}`
};
```

#### Constants文件编写规范
```typescript
// 每个constants文件必须遵循以下结构
// src/constants/example-defaults.ts

/**
 * [模块名称] 默认值常量
 * 
 * 包含所有与[模块功能]相关的硬编码值
 * 任何涉及[具体范围]的常量都应定义在此文件中
 * 
 * @module ExampleDefaults
 * @version 1.0.0
 * @lastUpdated 2024-08-21
 */

// 使用 as const 确保类型安全
export const EXAMPLE_DEFAULTS = {
  // 分组相关常量，添加注释说明用途
  
  // 网络相关
  DEFAULT_PORT: 5506,                    // 默认服务端口
  MAX_CONNECTIONS: 1000,                 // 最大连接数
  
  // 超时相关  
  CONNECTION_TIMEOUT: 5000,              // 连接超时（毫秒）
  REQUEST_TIMEOUT: 30000,                // 请求超时（毫秒）
  
  // 重试相关
  MAX_RETRIES: 3,                        // 最大重试次数
  RETRY_DELAY: 1000,                     // 重试延迟（毫秒）
  
} as const;

// 枚举类型常量使用对象形式
export const STATUS_CODES = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
} as const;

// 字符串常量数组
export const SUPPORTED_FORMATS = [
  'json',
  'yaml',
  'toml'
] as const;

// 导出类型以便TypeScript类型检查
export type ExampleDefaultsType = typeof EXAMPLE_DEFAULTS;
export type StatusCode = typeof STATUS_CODES[keyof typeof STATUS_CODES];
export type SupportedFormat = typeof SUPPORTED_FORMATS[number];
```

#### Constants使用检查脚本
```bash
#!/bin/bash
# scripts/check-hardcoding.sh

echo "🔍 检查硬编码违规..."

# 检查是否有硬编码的URL
check_hardcoded_urls() {
    echo "📡 检查硬编码URL..."
    
    local url_patterns=(
        "https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
        "localhost:[0-9]+"
        "127\.0\.0\.1:[0-9]+"
    )
    
    for pattern in "${url_patterns[@]}"; do
        # 排除constants目录和测试文件
        if git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l "$pattern" 2>/dev/null; then
            echo "❌ 发现硬编码URL: $pattern"
            git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l "$pattern" | sed 's/^/   - /'
            return 1
        fi
    done
    
    echo "✅ URL检查通过"
}

# 检查是否有硬编码的端口号
check_hardcoded_ports() {
    echo "🔌 检查硬编码端口..."
    
    # 查找数字端口号（排除constants目录）
    if git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l ":[0-9]\{4,5\}" 2>/dev/null; then
        echo "❌ 发现硬编码端口号"
        git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l ":[0-9]\{4,5\}" | sed 's/^/   - /'
        return 1
    fi
    
    echo "✅ 端口检查通过"
}

# 检查是否有硬编码的错误消息
check_hardcoded_errors() {
    echo "⚠️  检查硬编码错误消息..."
    
    # 查找硬编码的Error构造函数
    if git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l "new Error(" 2>/dev/null; then
        echo "❌ 发现硬编码错误消息"
        git ls-files "src/**/*.ts" | grep -v "constants" | grep -v "__tests__" | xargs grep -l "new Error(" | sed 's/^/   - /'
        return 1
    fi
    
    echo "✅ 错误消息检查通过"
}

# 执行所有检查
check_hardcoded_urls
check_hardcoded_ports  
check_hardcoded_errors

echo "🎉 硬编码检查完成"
```

### 2. 零静默失败原则

#### 禁止的静默失败模式
```typescript
// ❌ 禁止：静默忽略错误
try {
  await processRequest();
} catch (error) {
  // 静默忽略 - 严重违规
}

// ❌ 禁止：默认值掩盖错误
function getConfig(key: string): string {
  try {
    return config[key];
  } catch {
    return "default"; // 掩盖了配置错误
  }
}

// ❌ 禁止：Fallback机制
function callAPI() {
  try {
    return callPrimaryAPI();
  } catch {
    return mockResponse(); // 违规的fallback
  }
}
```

#### 正确的错误处理
```typescript
// ✅ 正确：明确的错误处理和传播
async function processRequest(request: RCCRequest): Promise<RCCResponse> {
  try {
    const result = await this.pipeline.process(request);
    return result;
  } catch (error) {
    const rccError: RCCError = {
      id: generateErrorId(),
      type: ErrorType.PIPELINE_ERROR,
      module: 'request-processor',
      message: 'Request processing failed',
      details: error,
      timestamp: Date.now(),
      requestId: request.id
    };
    
    // 必须通过标准错误处理器
    this.errorHandler.handleError(rccError);
    throw rccError; // 必须重新抛出
  }
}

// ✅ 正确：配置验证失败时明确报错
function validateConfig(config: any): asserts config is ValidConfig {
  if (!config.providers || config.providers.length === 0) {
    throw new ConfigError(
      'No providers configured', 
      { configPath: this.configPath }
    );
  }
}
```

### 3. 零Mockup响应原则

#### 绝对禁止的Mockup响应
```typescript
// ❌ 严重违规：Mockup响应
function callExternalAPI(): APIResponse {
  if (process.env.NODE_ENV === 'development') {
    return {
      success: true,
      data: "mock response" // 这是严重违规
    };
  }
  // 实际API调用
}

// ❌ 严重违规：假的成功响应
async function saveToDatabase(data: any): Promise<void> {
  if (!this.database.isConnected()) {
    console.log("Database not connected, skipping save");
    return; // 假装成功保存
  }
}
```

#### 正确的真实处理
```typescript
// ✅ 正确：总是真实处理
async function callExternalAPI(config: APIConfig): Promise<APIResponse> {
  const client = this.createAPIClient(config);
  
  try {
    const response = await client.request(config.endpoint);
    return this.validateResponse(response);
  } catch (error) {
    throw new NetworkError(
      `API call failed: ${config.endpoint}`,
      { error, config: config.endpoint }
    );
  }
}

// ✅ 正确：数据库失败时明确错误
async function saveToDatabase(data: any): Promise<void> {
  if (!this.database.isConnected()) {
    throw new DatabaseError(
      'Database connection not available',
      { operation: 'save', data: data.id }
    );
  }
  
  await this.database.save(data);
}
```

## 脚本设计规格遵循

### 1. 开发脚本标准

基于 `.claude/project-details/modules/development/README.md` 的脚本设计规格：

#### 命名规范遵循
```bash
# 开发环境脚本路径和命名
scripts/dev/
├── setup-dev-env.sh            # 开发环境设置
├── start-dev.sh                # 开发模式启动  
├── debug-mode.sh               # 调试模式启动
└── hot-reload.sh               # 热重载启动

# 调试工具脚本
scripts/debug/
├── curl-commands.sh            # cURL命令集合
├── log-viewer.sh               # 日志查看器
├── debug-session.sh            # 调试会话管理
└── health-check.sh             # 健康检查
```

#### 日志文件命名遵循
```bash
# 运行时日志必须按规格命名
~/.route-claudecode/logs/port-[port]/[module]-[YYYY-MM-DD_HH-MM-SS].log

# 示例
~/.route-claudecode/logs/port-3456/client-2024-08-15_14-30-22.log
~/.route-claudecode/logs/port-3456/router-2024-08-15_14-30-22.log
```

#### 临时文件管理
```bash
# 调试临时文件结构
./tmp/debug/port-[port]/session-[timestamp]/
./tmp/debug/port-3456/session-2024-08-15_14-30-22/
├── session.log              # 会话日志
├── curl-responses/          # cURL响应文件
└── debug-data/              # 调试数据
```

### 2. 脚本权限和安全

#### 脚本执行检查
```bash
# 每个脚本必须包含权限检查
#!/bin/bash
set -e  # 遇到错误立即退出

# 检查必要权限
if [ ! -w "$HOME/.route-claudecode" ]; then
    echo "错误: 无法写入配置目录 $HOME/.route-claudecode"
    exit 1
fi

# 检查必要依赖
command -v node >/dev/null 2>&1 || { 
    echo "错误: Node.js 未安装" 
    exit 1 
}
```

#### 环境变量验证
```bash
# 关键环境变量验证
validate_environment() {
    local required_vars=("NODE_ENV" "RCC_PORT" "RCC_CONFIG_PATH")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "错误: 环境变量 $var 未设置"
            exit 1
        fi
    done
}
```

## 开发后文档同步机制

### 1. 强制文档更新检查

#### 修改代码后必须检查的文档
```bash
# 检查清单脚本
#!/bin/bash
# scripts/dev/check-docs-sync.sh

echo "🔍 检查文档同步状态..."

# 1. 检查模块README是否需要更新
if [ -f "src/$MODULE_NAME/index.ts" ]; then
    MODULE_README=".claude/project-details/modules/$MODULE_NAME/README.md"
    if [ ! -f "$MODULE_README" ]; then
        echo "❌ 缺少模块文档: $MODULE_README"
        exit 1
    fi
    
    # 检查接口是否变更
    if git diff HEAD~1 src/$MODULE_NAME/index.ts | grep -q "interface\|export"; then
        echo "⚠️  接口已变更，请更新模块文档: $MODULE_README"
        echo "   变更的接口:"
        git diff HEAD~1 src/$MODULE_NAME/index.ts | grep "^\+.*interface\|^\+.*export"
    fi
fi

# 2. 检查错误类型是否需要更新文档
if git diff HEAD~1 --name-only | grep -q "error-types.ts"; then
    echo "⚠️  错误类型已变更，请更新错误处理文档"
fi

# 3. 检查配置类型是否需要更新文档  
if git diff HEAD~1 --name-only | grep -q "config.ts"; then
    echo "⚠️  配置类型已变更，请更新配置文档"
fi
```

### 2. 文档同步验证

#### 接口变更同步检查
```typescript
// 在模块主文件中添加版本信息
export const MODULE_VERSION = '1.0.0';
export const LAST_UPDATED = '2024-08-15';
export const BREAKING_CHANGES: string[] = [
  'v1.0.0: Initial release',
  // 记录所有重要变更
];

// 接口变更时必须更新
export interface ModuleAPI {
  // 接口版本标识
  readonly apiVersion: string;
  readonly lastUpdated: string;
  
  // 核心方法
  process(input: Input): Promise<Output>;
}
```

#### 自动文档同步脚本
```bash
#!/bin/bash
# scripts/dev/sync-docs.sh

echo "📝 同步模块文档..."

# 提取接口定义并更新文档
extract_interfaces() {
    local module_file="$1"
    local doc_file="$2"
    
    echo "## 接口定义" > temp_interfaces.md
    echo "" >> temp_interfaces.md
    echo '```typescript' >> temp_interfaces.md
    
    # 提取所有导出的接口和类型
    grep -A 10 "export interface\|export type\|export class" "$module_file" >> temp_interfaces.md
    
    echo '```' >> temp_interfaces.md
    
    # 更新文档中的接口部分
    sed -i '/## 接口定义/,/```$/c\' "$doc_file"
    cat temp_interfaces.md >> "$doc_file"
    rm temp_interfaces.md
}
```

## 错误处理要求

### 1. 统一错误处理架构

#### 错误类型定义规范
```typescript
// src/types/error-types.ts
export enum ErrorType {
  // 客户端错误 (4xx)
  CLIENT_ERROR = 'CLIENT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  
  // 服务器错误 (5xx)  
  PIPELINE_ERROR = 'PIPELINE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  
  // 系统错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  MODULE_ERROR = 'MODULE_ERROR'
}

export interface RCCError {
  readonly id: string;
  readonly type: ErrorType;
  readonly module: string;
  readonly message: string;
  readonly details?: any;
  readonly timestamp: number;
  readonly requestId?: string;
  readonly stack?: string;
}
```

#### 标准错误处理流程
```typescript
// 每个模块必须实现标准错误处理
abstract class BaseModule {
  protected errorHandler: ErrorHandler;
  
  protected createError(
    type: ErrorType,
    message: string,
    details?: any,
    requestId?: string
  ): RCCError {
    return {
      id: this.generateErrorId(),
      type,
      module: this.moduleName,
      message,
      details,
      timestamp: Date.now(),
      requestId,
      stack: new Error().stack
    };
  }
  
  protected handleError(error: RCCError): never {
    this.errorHandler.handleError(error);
    throw error; // 必须重新抛出，不允许静默
  }
}
```

### 2. 模块级错误边界

#### 模块错误责任定义
```typescript
// 客户端模块错误边界
class ClientModule extends BaseModule {
  async processRequest(request: Request): Promise<Response> {
    try {
      // 验证输入
      this.validateInput(request);
      
      // 委托给路由器
      const response = await this.router.routeRequest(request);
      
      // 验证输出
      this.validateOutput(response);
      
      return response;
    } catch (error) {
      if (error instanceof RCCError) {
        throw error; // 已知错误直接传播
      }
      
      // 未知错误包装为模块错误
      throw this.createError(
        ErrorType.CLIENT_ERROR,
        'Client module processing failed',
        error,
        request.id
      );
    }
  }
}
```

## TypeScript代码规范

### 1. 类型安全要求

#### 严格类型检查
```json
// tsconfig.json - 必须的严格设置
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

#### 接口设计规范
```typescript
// ✅ 正确：明确的接口定义
interface ProcessingOptions {
  readonly timeout: number;
  readonly retryCount: number;
  readonly enableDebug: boolean;
}

interface ProcessingResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: RCCError;
  readonly metadata: {
    readonly processingTime: number;
    readonly retryAttempts: number;
  };
}

// ✅ 正确：使用泛型确保类型安全
class Pipeline<TInput, TOutput> {
  async process(input: TInput): Promise<ProcessingResult<TOutput>> {
    // 实现
  }
}
```

### 2. 命名约定

#### TypeScript命名规范
```typescript
// 接口：PascalCase，I前缀可选
interface RequestProcessor {}
interface IRequestProcessor {} // 也可接受

// 类：PascalCase
class RouterManager {}

// 方法和变量：camelCase
const processRequest = () => {};
let requestCount = 0;

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT = 5000;

// 类型别名：PascalCase
type ProcessorFunction<T> = (input: T) => Promise<T>;

// 枚举：PascalCase
enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}
```

## 测试要求

### 1. 真实流水线测试（禁止Mock）

#### 测试架构要求
```typescript
// ✅ 正确：真实流水线测试
describe('RouterModule Integration Test', () => {
  let router: RouterManager;
  let realConfig: ConfigManager;
  
  beforeEach(async () => {
    // 使用真实配置，不是Mock
    realConfig = new ConfigManager('./test-configs/integration.json');
    router = new RouterManager(realConfig);
    await router.initialize();
  });
  
  test('should route request through real pipeline', async () => {
    // 真实的Anthropic格式请求
    const request: AnthropicRequest = {
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 100
    };
    
    // 通过真实流水线处理
    const response = await router.processRequest(request);
    
    // 验证真实响应格式
    expect(response).toHaveProperty('content');
    expect(response.content).toBeInstanceOf(Array);
  });
});

// ❌ 禁止：Mock测试
describe('Bad Test Example', () => {
  test('should not use mocks', async () => {
    const mockRouter = jest.fn().mockReturnValue({
      processRequest: jest.fn().mockResolvedValue('fake response')
    });
    // 这种测试是被禁止的
  });
});
```

### 2. 调试数据捕获测试

#### 基于Debug系统的测试
```typescript
// 使用Debug系统进行数据驱动测试
describe('Debug-based Testing', () => {
  let debugManager: DebugManager;
  
  beforeEach(() => {
    debugManager = new DebugManager();
    debugManager.startRecording('test-session');
  });
  
  afterEach(() => {
    debugManager.stopRecording();
  });
  
  test('should capture complete data flow', async () => {
    const request = createTestRequest();
    
    // 执行真实流水线
    await router.processRequest(request);
    
    // 验证调试数据完整性
    const capturedData = debugManager.getSessionData('test-session');
    
    expect(capturedData).toHaveProperty('client');
    expect(capturedData).toHaveProperty('router');
    expect(capturedData).toHaveProperty('pipeline');
    expect(capturedData.pipeline).toHaveProperty('transformer');
    expect(capturedData.pipeline).toHaveProperty('server');
  });
});
```

## 性能和监控要求

### 1. 性能指标监控

#### 必须监控的指标
```typescript
interface PerformanceMetrics {
  requestProcessingTime: number;  // 请求处理时间
  memoryUsage: NodeJS.MemoryUsage; // 内存使用
  activeConnections: number;       // 活跃连接数
  errorRate: number;              // 错误率
  throughput: number;             // 吞吐量
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  
  startRequest(requestId: string): void {
    this.startTime.set(requestId, Date.now());
  }
  
  endRequest(requestId: string, success: boolean): void {
    const duration = Date.now() - this.startTime.get(requestId);
    this.recordMetric('requestProcessingTime', duration);
    this.recordMetric('errorRate', success ? 0 : 1);
  }
  
  // 性能要求验证
  validatePerformance(): void {
    if (this.metrics.requestProcessingTime > 100) {
      console.warn(`Request processing time ${this.metrics.requestProcessingTime}ms exceeds 100ms target`);
    }
    
    if (this.metrics.memoryUsage.heapUsed > 200 * 1024 * 1024) {
      console.warn(`Memory usage ${this.metrics.memoryUsage.heapUsed / 1024 / 1024}MB exceeds 200MB target`);
    }
  }
}
```

## 部署和构建要求

### 1. 构建脚本规范

#### 一键构建脚本
```bash
#!/bin/bash
# scripts/build/build.sh

set -e

echo "🔨 开始构建 RCC v4.0..."

# 1. 环境检查
echo "📋 检查构建环境..."
check_environment() {
    command -v node >/dev/null 2>&1 || { echo "❌ Node.js 未安装"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo "❌ npm 未安装"; exit 1; }
    
    # 检查Node版本
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    if ! npx semver-compare "$NODE_VERSION" "18.0.0"; then
        echo "❌ Node.js 版本必须 >= 18.0.0 (当前: $NODE_VERSION)"
        exit 1
    fi
}

# 2. 依赖安装
echo "📦 安装依赖..."
npm ci

# 3. 类型检查
echo "🔍 TypeScript 类型检查..."
npx tsc --noEmit

# 4. 代码检查
echo "🧹 代码质量检查..."
npx eslint src --ext .ts
npx prettier --check src

# 5. 编译构建
echo "⚙️ 编译 TypeScript..."
npx tsc

# 6. 测试执行
echo "🧪 执行测试..."
npm test

# 7. 构建验证
echo "✅ 构建验证..."
verify_build() {
    # 检查所有模块是否正确编译
    local modules=("client" "router" "pipeline" "debug" "config" "error-handler" "types")
    
    for module in "${modules[@]}"; do
        if [ ! -f "dist/$module/index.js" ]; then
            echo "❌ 模块编译失败: $module"
            exit 1
        fi
    done
    
    echo "✅ 所有模块编译成功"
}

verify_build

echo "🎉 构建完成！"
```

### 2. 质量检查自动化

#### Pre-commit检查
```bash
#!/bin/bash
# .husky/pre-commit

echo "🔍 Pre-commit 检查..."

# 1. 文档同步检查
./scripts/dev/check-docs-sync.sh

# 2. 代码规范检查
npm run lint:check

# 3. 类型检查
npm run type:check

# 4. 测试快速验证
npm run test:unit

# 5. 硬编码检查
check_hardcoding() {
    echo "🔍 检查硬编码..."
    
    # 检查常见硬编码模式
    local hardcode_patterns=(
        "api\.openai\.com"
        "localhost:[0-9]+"
        "sk-[a-zA-Z0-9]+"
        "claude-3"
        "gpt-4"
        "/home/[^/]+"
    )
    
    for pattern in "${hardcode_patterns[@]}"; do
        if git diff --cached --name-only | xargs grep -l "$pattern" 2>/dev/null; then
            echo "❌ 发现硬编码: $pattern"
            echo "   涉及文件:"
            git diff --cached --name-only | xargs grep -l "$pattern" | sed 's/^/   - /'
            exit 1
        fi
    done
    
    echo "✅ 硬编码检查通过"
}

check_hardcoding

echo "✅ Pre-commit 检查完成"
```

## 配置管理规范

### 1. 配置文件结构

#### 标准配置结构
```typescript
// 配置类型定义
interface RCCConfig {
  readonly version: string;
  readonly environment: 'development' | 'production' | 'test';
  readonly server: ServerConfig;
  readonly providers: ProviderConfig[];
  readonly routing: RoutingConfig;
  readonly debug: DebugConfig;
  readonly logging: LoggingConfig;
}

interface ProviderConfig {
  readonly name: string;
  readonly protocol: 'openai' | 'anthropic' | 'gemini';
  readonly baseUrl: string;
  readonly apiKey: string; // 支持环境变量替换
  readonly models: readonly string[];
  readonly maxTokens: number;
  readonly availability: boolean;
}
```

#### 配置验证规则
```typescript
class ConfigValidator {
  validate(config: any): asserts config is RCCConfig {
    // 必须验证所有配置字段
    this.validateVersion(config.version);
    this.validateProviders(config.providers);
    this.validateRouting(config.routing);
    
    // 检查环境变量依赖
    this.validateEnvironmentDependencies(config);
  }
  
  private validateEnvironmentDependencies(config: RCCConfig): void {
    for (const provider of config.providers) {
      if (provider.apiKey.startsWith('${') && provider.apiKey.endsWith('}')) {
        const envVar = provider.apiKey.slice(2, -1);
        if (!process.env[envVar]) {
          throw new ConfigError(
            `Environment variable ${envVar} is required for provider ${provider.name}`
          );
        }
      }
    }
  }
}
```

## 总结

这些编程规则确保了：

1. **架构一致性**: 严格的模块化边界和接口规范
2. **代码质量**: 零硬编码、零静默失败、零Mockup原则
3. **文档同步**: 强制的文档更新机制
4. **真实测试**: 基于真实流水线的测试架构
5. **错误透明**: 完整的错误处理和追踪链
6. **性能监控**: 明确的性能指标和监控要求
7. **自动化质量**: 构建时自动化检查和验证

**所有开发人员必须严格遵循这些规则，任何违反都将被拒绝合并。**