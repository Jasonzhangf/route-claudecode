# 测试系统模块

## 模块概述

测试系统提供完整的测试框架，支持单元测试、集成测试、流水线测试和回放测试，确保系统的可靠性和质量。

## 目录结构

```
src/__tests__/
├── README.md                        # 测试系统文档
├── setup/                           # 测试环境设置
│   ├── jest.config.js               # Jest配置
│   ├── test-setup.ts                # 测试环境初始化
│   ├── test-helpers.ts              # 测试辅助函数
│   └── mock-providers.ts            # Mock Provider配置
├── unit/                            # 单元测试
│   ├── client/                      # 客户端模块测试
│   │   ├── cli.test.ts              # CLI测试
│   │   ├── server-manager.test.ts   # 服务器管理测试
│   │   └── error-handler.test.ts    # 错误处理测试
│   ├── router/                      # 路由器模块测试
│   │   ├── config-manager.test.ts   # 配置管理测试
│   │   ├── request-router.test.ts   # 请求路由测试
│   │   └── pipeline-manager.test.ts # 流水线管理测试
│   ├── pipeline/                    # 流水线模块测试
│   │   ├── transformer/             # Transformer测试
│   │   │   ├── openai-transformer.test.ts
│   │   │   ├── anthropic-transformer.test.ts
│   │   │   └── gemini-transformer.test.ts
│   │   ├── protocol/                # Protocol测试
│   │   │   ├── openai-protocol.test.ts
│   │   │   └── stream-conversion.test.ts
│   │   ├── server-compatibility/    # 兼容性测试
│   │   │   ├── deepseek-compatibility.test.ts
│   │   │   └── lmstudio-compatibility.test.ts
│   │   └── server/                  # Server测试
│   │       ├── openai-server.test.ts
│   │       └── gemini-server.test.ts
│   ├── config/                      # 配置系统测试
│   │   ├── config-manager.test.ts   # 配置管理测试
│   │   ├── config-validator.test.ts # 配置验证测试
│   │   └── env-replacement.test.ts  # 环境变量替换测试
│   ├── debug/                       # Debug系统测试
│   │   ├── debug-manager.test.ts    # Debug管理测试
│   │   ├── debug-recorder.test.ts   # 记录器测试
│   │   └── replay-system.test.ts    # 回放系统测试
│   └── error-handler/               # 错误处理测试
│       ├── error-handler.test.ts    # 错误处理器测试
│       ├── error-formatter.test.ts  # 错误格式化测试
│       └── error-logger.test.ts     # 错误日志测试
├── integration/                     # 集成测试
│   ├── full-pipeline.test.ts        # 完整流水线测试
│   ├── multi-provider.test.ts       # 多Provider测试
│   ├── load-balance.test.ts         # 负载均衡测试
│   ├── config-reload.test.ts        # 配置重载测试
│   └── error-propagation.test.ts    # 错误传播测试
├── e2e/                             # 端到端测试
│   ├── cli-commands.test.ts         # CLI命令测试
│   ├── api-endpoints.test.ts        # API端点测试
│   ├── streaming.test.ts            # 流式处理测试
│   └── tool-calling.test.ts         # 工具调用测试
├── performance/                     # 性能测试
│   ├── load-test.ts                 # 负载测试
│   ├── memory-test.ts               # 内存测试
│   ├── concurrent-test.ts           # 并发测试
│   └── benchmark.ts                 # 基准测试
├── replay/                          # 回放测试
│   ├── replay-runner.ts             # 回放运行器
│   ├── replay-validator.ts          # 回放验证器
│   └── generated/                   # 生成的回放测试
│       ├── openai-gpt4-001.test.ts  # 自动生成的测试
│       └── ...
└── fixtures/                        # 测试数据
    ├── requests/                    # 请求数据
    │   ├── anthropic-requests.json  # Anthropic请求样本
    │   ├── openai-requests.json     # OpenAI请求样本
    │   └── tool-requests.json       # 工具调用请求样本
    ├── responses/                   # 响应数据
    │   ├── anthropic-responses.json # Anthropic响应样本
    │   ├── openai-responses.json    # OpenAI响应样本
    │   └── error-responses.json     # 错误响应样本
    └── configs/                     # 配置数据
        ├── test-providers.json      # 测试Provider配置
        ├── test-routing.json        # 测试路由配置
        └── invalid-configs.json     # 无效配置样本
```

## 测试规则和标准

### 1. 测试命名规则
```typescript
// 测试文件命名: [module-name].test.ts
// 测试描述命名: describe('[ModuleName]', () => {})
// 测试用例命名: test('should [expected behavior] when [condition]', () => {})

describe('OpenAITransformer', () => {
  test('should transform Anthropic request to OpenAI format when valid input provided', async () => {
    // 测试实现
  });
  
  test('should throw ValidationError when invalid Anthropic request provided', async () => {
    // 测试实现
  });
});
```

### 2. 测试分类标准
```typescript
// 单元测试: 测试单个模块的功能
// 集成测试: 测试模块间的交互
// 端到端测试: 测试完整的用户场景
// 性能测试: 测试系统性能指标
// 回放测试: 基于Debug记录的回放验证

// 测试标签
describe('OpenAITransformer', () => {
  describe('Unit Tests', () => {
    // 单元测试
  });
  
  describe('Integration Tests', () => {
    // 集成测试
  });
});
```

### 3. 真实流水线测试要求
```typescript
// 禁止Mock规则
// ❌ 不允许: jest.mock()
// ❌ 不允许: sinon.stub()
// ❌ 不允许: 任何形式的mockup响应

// ✅ 允许: 真实的API调用
// ✅ 允许: 真实的流水线处理
// ✅ 允许: 真实的配置文件

describe('Real Pipeline Tests', () => {
  test('should process real OpenAI request through complete pipeline', async () => {
    // 使用真实的OpenAI API
    const pipeline = await createRealPipeline('openai', 'gpt-3.5-turbo');
    const result = await pipeline.process(realAnthropicRequest);
    
    expect(result).toBeDefined();
    expect(result.content).toBeTruthy();
  });
});
```

### 4. 测试数据管理
```typescript
// 测试数据文件结构
interface TestFixture {
  name: string;
  description: string;
  input: any;
  expectedOutput: any;
  metadata: {
    provider: string;
    model: string;
    testType: 'unit' | 'integration' | 'e2e';
    tags: string[];
  };
}

// 测试数据加载
class TestDataLoader {
  static loadFixture(category: string, name: string): TestFixture {
    return require(`../fixtures/${category}/${name}.json`);
  }
  
  static loadAllFixtures(category: string): TestFixture[] {
    // 加载指定分类的所有测试数据
  }
}
```

## Jest配置

### jest.config.js
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/test-setup.ts'],
  testTimeout: 30000, // 30秒超时，适应真实API调用
  
  // 测试分组
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/__tests__/unit/**/*.test.ts'],
      testTimeout: 10000,
    },
    {
      displayName: 'integration', 
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.ts'],
      testTimeout: 30000,
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/src/__tests__/e2e/**/*.test.ts'],
      testTimeout: 60000,
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/__tests__/performance/**/*.test.ts'],
      testTimeout: 120000,
    }
  ],
  
  // 环境变量
  setupFiles: ['<rootDir>/src/__tests__/setup/env-setup.js'],
  
  // 全局变量
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  }
};
```

### 测试环境设置
```typescript
// src/__tests__/setup/test-setup.ts
import { TestEnvironment } from './test-environment';
import { TestDataLoader } from './test-data-loader';
import { RealProviderManager } from './real-provider-manager';

// 全局测试环境初始化
beforeAll(async () => {
  // 初始化测试环境
  await TestEnvironment.initialize();
  
  // 加载测试配置
  await TestDataLoader.loadTestConfigs();
  
  // 初始化真实Provider连接
  await RealProviderManager.initialize();
});

afterAll(async () => {
  // 清理测试环境
  await TestEnvironment.cleanup();
  
  // 关闭Provider连接
  await RealProviderManager.cleanup();
});

// 每个测试前的设置
beforeEach(() => {
  // 重置测试状态
  TestEnvironment.reset();
});

afterEach(() => {
  // 清理测试数据
  TestEnvironment.clearTestData();
});
```

## 测试辅助工具

### 测试辅助函数
```typescript
// src/__tests__/setup/test-helpers.ts
export class TestHelpers {
  // 创建测试用的真实流水线
  static async createRealPipeline(provider: string, model: string): Promise<Pipeline> {
    const config = TestDataLoader.getProviderConfig(provider);
    return await PipelineFactory.createPipeline(provider, model, config);
  }
  
  // 等待异步操作完成
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) return;
      await this.sleep(100);
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  }
  
  // 创建测试请求
  static createTestRequest(type: 'anthropic' | 'openai', options?: any): any {
    const fixtures = TestDataLoader.loadFixture('requests', `${type}-requests`);
    return { ...fixtures.basic, ...options };
  }
  
  // 验证响应格式
  static validateResponse(response: any, expectedFormat: string): boolean {
    const schema = TestDataLoader.getResponseSchema(expectedFormat);
    return this.validateAgainstSchema(response, schema);
  }
  
  // 比较两个对象的差异
  static findDifferences(obj1: any, obj2: any): string[] {
    // 深度比较实现
    return [];
  }
  
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 真实Provider管理器
```typescript
// src/__tests__/setup/real-provider-manager.ts
export class RealProviderManager {
  private static providers: Map<string, any> = new Map();
  
  static async initialize(): Promise<void> {
    // 从环境变量加载真实的API密钥
    const configs = this.loadRealConfigs();
    
    for (const config of configs) {
      if (this.hasValidCredentials(config)) {
        const provider = await this.createRealProvider(config);
        this.providers.set(config.name, provider);
      }
    }
  }
  
  static getProvider(name: string): any {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Real provider ${name} not available for testing`);
    }
    return provider;
  }
  
  static isProviderAvailable(name: string): boolean {
    return this.providers.has(name);
  }
  
  private static loadRealConfigs(): ProviderConfig[] {
    return [
      {
        name: 'openai',
        apiKey: process.env.OPENAI_API_KEY_TEST,
        baseUrl: 'https://api.openai.com/v1'
      },
      {
        name: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY_TEST,
        baseUrl: 'https://api.anthropic.com'
      }
      // 其他Provider配置
    ];
  }
  
  private static hasValidCredentials(config: ProviderConfig): boolean {
    return !!(config.apiKey && config.apiKey !== 'undefined');
  }
}
```

## 回放测试系统

### 回放测试生成器
```typescript
// src/__tests__/replay/replay-generator.ts
export class ReplayTestGenerator {
  static async generateTestFromDebugRecord(recordId: string): Promise<string> {
    const record = await DebugRecorder.loadRecord(recordId);
    
    const testCode = `
// Auto-generated replay test for ${recordId}
// Generated at: ${new Date().toISOString()}

describe('Replay Test - ${recordId}', () => {
  test('should reproduce original behavior', async () => {
    // Original request
    const originalRequest = ${JSON.stringify(record.request.body, null, 4)};
    
    // Create real pipeline
    const pipeline = await TestHelpers.createRealPipeline(
      '${record.pipeline.provider}',
      '${record.pipeline.model}'
    );
    
    // Execute request
    const result = await pipeline.process(originalRequest);
    
    // Validate result structure
    expect(result).toBeDefined();
    expect(result.content).toBeTruthy();
    
    // Compare with original response (flexible comparison)
    const originalResponse = ${JSON.stringify(record.response.body, null, 4)};
    TestHelpers.validateSimilarResponse(result, originalResponse);
  });
});
    `;
    
    return testCode;
  }
  
  static async generateAllReplayTests(): Promise<void> {
    const records = await DebugRecorder.getAllRecords();
    
    for (const record of records) {
      const testCode = await this.generateTestFromDebugRecord(record.requestId);
      const fileName = `${record.pipeline.provider}-${record.pipeline.model}-${record.requestId}.test.ts`;
      const filePath = path.join(__dirname, 'generated', fileName);
      
      await fs.writeFile(filePath, testCode);
    }
  }
}
```

## 测试命令

### package.json测试脚本
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --selectProjects unit",
    "test:integration": "jest --selectProjects integration", 
    "test:e2e": "jest --selectProjects e2e",
    "test:performance": "jest --selectProjects performance",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:replay": "jest src/__tests__/replay",
    "test:generate-replay": "ts-node src/__tests__/replay/replay-generator.ts",
    "test:real-pipeline": "jest --testNamePattern='Real Pipeline'",
    "test:debug": "jest --verbose --no-cache"
  }
}
```

### 测试运行脚本
```bash
#!/bin/bash
# scripts/run-tests.sh

set -e

echo "🧪 Running RCC v4.0 Test Suite"

# 检查环境变量
if [ -z "$OPENAI_API_KEY_TEST" ]; then
  echo "⚠️  Warning: OPENAI_API_KEY_TEST not set, skipping OpenAI real tests"
fi

if [ -z "$ANTHROPIC_API_KEY_TEST" ]; then
  echo "⚠️  Warning: ANTHROPIC_API_KEY_TEST not set, skipping Anthropic real tests"
fi

# 运行不同类型的测试
echo "📋 Running unit tests..."
npm run test:unit

echo "🔗 Running integration tests..."
npm run test:integration

echo "🌐 Running e2e tests..."
npm run test:e2e

echo "⚡ Running performance tests..."
npm run test:performance

echo "🔄 Running replay tests..."
npm run test:replay

echo "📊 Generating coverage report..."
npm run test:coverage

echo "✅ All tests completed!"
```

## 质量要求

### 测试覆盖率要求
- **代码覆盖率**: 最低80%
- **分支覆盖率**: 最低75%
- **函数覆盖率**: 最低90%
- **行覆盖率**: 最低85%

### 测试质量标准
- ✅ 无Mock测试（真实流水线测试）
- ✅ 完整的错误场景覆盖
- ✅ 性能基准测试
- ✅ 回放测试验证
- ✅ 并发安全测试
- ✅ 内存泄漏检测

### 测试数据管理
- ✅ 测试数据版本化管理
- ✅ 敏感数据脱敏处理
- ✅ 测试环境隔离
- ✅ 自动化测试数据生成

这个测试系统确保了RCC v4.0的高质量和可靠性，通过真实流水线测试验证系统的实际工作能力。