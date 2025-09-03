# 测试框架实施指引

## 概述

本文档提供了RCC v4.1 API驱动解耦测试框架的实施指引，帮助开发团队正确实施和使用新的测试系统。

## 测试框架架构

### 核心组件

1. **测试API网关**：统一入口，路由测试请求到相应模块
2. **模块测试API**：各模块提供的标准化测试接口
3. **测试数据管理器**：管理测试数据的生成、加载和清理
4. **测试执行引擎**：执行各种类型的测试用例
5. **测试报告系统**：收集、分析和展示测试结果

### 设计原则

1. **API优先**：所有测试通过标准化API接口进行，避免直接代码依赖
2. **模块独立**：每个模块提供独立的测试API端点
3. **松耦合**：测试系统与被测模块通过API交互，降低耦合度
4. **可重用性**：API测试接口可被多种测试场景复用
5. **可扩展性**：支持新模块和测试类型的快速集成

## 实施步骤

### 1. 环境准备

#### 安装依赖
```bash
npm install axios express uuid jest supertest
npm install --save-dev @types/express @types/jest @types/node @types/supertest @types/uuid ts-jest typescript
```

#### 配置测试环境
```bash
# 创建测试目录结构
mkdir -p src/test/{api,data,reports}
mkdir -p tests/{unit,integration,e2e,performance}
```

### 2. 实现测试数据管理器

#### 创建数据管理器
```typescript
// src/test/data-manager.ts
import { TestData, TestDataSchema, TestDataSource, CleanupCriteria } from './types';

export class TestDataManager {
  // 实现数据生成、加载、验证和清理功能
  async generateTestData(schema: TestDataSchema, config: any, name: string): Promise<TestData[]> {
    // 实现数据生成逻辑
  }
  
  async loadTestData(source: TestDataSource): Promise<TestData[]> {
    // 实现数据加载逻辑
  }
  
  async validateTestData(data: TestData, schema: TestDataSchema): Promise<any> {
    // 实现数据验证逻辑
  }
  
  async cleanupTestData(criteria: CleanupCriteria): Promise<void> {
    // 实现数据清理逻辑
  }
}
```

### 3. 开发测试执行引擎

#### 创建执行引擎
```typescript
// src/test/execution-engine.ts
import { TestCase, TestSuite, TestPlan, TestResult, TestReport } from './types';

export class TestExecutionEngine {
  // 实现测试执行功能
  async executeTestCase(testCase: TestCase): Promise<TestResult> {
    // 实现测试用例执行逻辑
  }
  
  async executeTestSuite(testSuite: TestSuite): Promise<TestResult[]> {
    // 实现测试套件执行逻辑
  }
  
  async executeTestPlan(testPlan: TestPlan): Promise<TestReport> {
    // 实现测试计划执行逻辑
  }
}
```

### 4. 实现各模块测试API

#### 客户端模块测试API
```typescript
// src/test/api/client-test-api.ts
import { Router } from 'express';

const router = Router();

// 健康检查接口
router.get('/health', (req, res) => {
  // 实现健康检查逻辑
});

// 功能测试接口
router.post('/test/functional', (req, res) => {
  // 实现功能测试逻辑
});

// 性能测试接口
router.post('/test/performance', (req, res) => {
  // 实现性能测试逻辑
});

export default router;
```

#### 路由器模块测试API
```typescript
// src/test/api/router-test-api.ts
import { Router } from 'express';

const router = Router();

// 健康检查接口
router.get('/health', (req, res) => {
  // 实现健康检查逻辑
});

// 路由功能测试接口
router.post('/test/route/request', (req, res) => {
  // 实现路由测试逻辑
});

export default router;
```

#### 流水线模块测试API
```typescript
// src/test/api/pipeline-test-api.ts
import { Router } from 'express';

const router = Router();

// 健康检查接口
router.get('/health', (req, res) => {
  // 实现健康检查逻辑
});

// 流水线执行测试接口
router.post('/test/execute', (req, res) => {
  // 实现流水线测试逻辑
});

export default router;
```

### 5. 建立测试报告系统

#### 创建报告系统
```typescript
// src/test/reporting-system.ts
import { TestReport } from './types';

export class TestReportingSystem {
  // 实现报告生成功能
  async generateReport(report: TestReport, config: any): Promise<string> {
    // 实现报告生成逻辑
  }
  
  getReportHistory(): TestReport[] {
    // 实现报告历史查询逻辑
  }
}
```

## 测试类型实施

### 1. 单元测试

#### 编写单元测试
```typescript
// tests/unit/client-module.test.ts
import { TestExecutionEngine } from '../../src/test/execution-engine';

describe('Client Module Unit Tests', () => {
  let testEngine: TestExecutionEngine;
  
  beforeEach(() => {
    testEngine = new TestExecutionEngine({
      baseUrl: 'http://localhost:5506',
      authToken: 'test-token',
      timeout: 5000,
      retries: 3,
      parallel: true,
      maxConcurrency: 5
    });
  });
  
  test('should execute CLI command successfully', async () => {
    const testCase = {
      id: 'cli-command-test',
      name: 'CLI Command Test',
      description: 'Test CLI command execution',
      type: 'unit',
      module: 'client',
      input: {
        command: 'start',
        args: ['--port', '5506']
      },
      expected: {
        output: 'Server started on port 5506'
      }
    };
    
    const result = await testEngine.executeTestCase(testCase);
    expect(result.status).toBe('passed');
  });
});
```

### 2. 集成测试

#### 编写集成测试
```typescript
// tests/integration/router-pipeline.test.ts
import { TestExecutionEngine } from '../../src/test/execution-engine';

describe('Router-Pipeline Integration Tests', () => {
  let testEngine: TestExecutionEngine;
  
  beforeEach(() => {
    testEngine = new TestExecutionEngine({
      baseUrl: 'http://localhost:5506',
      authToken: 'test-token',
      timeout: 10000,
      retries: 2,
      parallel: false,
      maxConcurrency: 1
    });
  });
  
  test('should route request to correct pipeline', async () => {
    const testCase = {
      id: 'routing-test',
      name: 'Request Routing Test',
      description: 'Test request routing to correct pipeline',
      type: 'integration',
      module: 'router,pipeline',
      input: {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'Hello' }]
      },
      expected: {
        provider: 'anthropic',
        pipeline: 'coding'
      }
    };
    
    const result = await testEngine.executeTestCase(testCase);
    expect(result.status).toBe('passed');
  });
});
```

### 3. 端到端测试

#### 编写端到端测试
```typescript
// tests/e2e/full-pipeline.test.ts
import { TestExecutionEngine } from '../../src/test/execution-engine';

describe('Full Pipeline End-to-End Tests', () => {
  let testEngine: TestExecutionEngine;
  
  beforeEach(() => {
    testEngine = new TestExecutionEngine({
      baseUrl: 'http://localhost:5506',
      authToken: 'test-token',
      timeout: 30000,
      retries: 1,
      parallel: false,
      maxConcurrency: 1
    });
  });
  
  test('should process complete request pipeline', async () => {
    const testCase = {
      id: 'e2e-test',
      name: 'End-to-End Pipeline Test',
      description: 'Test complete request processing pipeline',
      type: 'e2e',
      module: 'client,router,pipeline,server',
      input: {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'List files in current directory' }],
        tools: [{
          name: 'list_files',
          description: 'List files in directory',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string' }
            },
            required: ['path']
          }
        }]
      },
      expected: {
        content: expect.any(String),
        tool_calls: expect.any(Array)
      }
    };
    
    const result = await testEngine.executeTestCase(testCase);
    expect(result.status).toBe('passed');
  });
});
```

### 4. 性能测试

#### 编写性能测试
```typescript
// tests/performance/load-test.test.ts
import { TestExecutionEngine } from '../../src/test/execution-engine';

describe('Load Performance Tests', () => {
  let testEngine: TestExecutionEngine;
  
  beforeEach(() => {
    testEngine = new TestExecutionEngine({
      baseUrl: 'http://localhost:5506',
      authToken: 'test-token',
      timeout: 60000,
      retries: 0,
      parallel: true,
      maxConcurrency: 10
    });
  });
  
  test('should handle concurrent requests', async () => {
    const testCase = {
      id: 'performance-test',
      name: 'Concurrent Request Test',
      description: 'Test system performance under concurrent load',
      type: 'performance',
      module: 'router,pipeline',
      input: {
        concurrentUsers: 50,
        duration: 60,
        rampUp: 10,
        testCase: {
          name: 'load_test',
          input: {
            model: 'claude-3-sonnet',
            messages: [{ role: 'user', content: 'Hello' }]
          }
        }
      },
      expected: {
        averageResponseTime: '<100ms',
        successRate: '>95%'
      }
    };
    
    const result = await testEngine.executeTestCase(testCase);
    expect(result.status).toBe('passed');
  });
});
```

## CI/CD集成

### GitHub Actions配置

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci

  unit-tests:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Run unit tests
        run: npm run test:unit

  integration-tests:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Start test services
        run: |
          npm run start:test &
          sleep 10
      - name: Run end-to-end tests
        run: npm run test:e2e

  performance-tests:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Run performance tests
        run: npm run test:performance

  code-quality:
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Run linting
        run: npm run lint
      - name: Run type checking
        run: npm run typecheck

  build-and-deploy:
    needs: [unit-tests, integration-tests, e2e-tests, code-quality]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Build application
        run: npm run build
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment"
```

## 最佳实践

### 1. 测试数据管理

- 使用测试数据管理器生成和管理测试数据
- 确保测试数据的隔离性和可重复性
- 定期清理过期的测试数据

### 2. 测试执行

- 根据测试类型设置合适的超时时间
- 实现适当的重试机制
- 支持并行和串行测试执行

### 3. 错误处理

- 统一错误处理和报告格式
- 提供详细的错误信息和堆栈跟踪
- 实现错误恢复和重试机制

### 4. 性能监控

- 监控测试执行性能
- 收集和分析性能指标
- 设置性能基准和告警

### 5. 安全考虑

- 确保测试环境与生产环境隔离
- 使用专用的测试认证令牌
- 保护敏感测试数据

## 故障排除

### 常见问题

1. **API连接失败**
   - 检查测试服务是否正常运行
   - 验证API端点和认证配置
   - 检查网络连接和防火墙设置

2. **测试超时**
   - 增加测试超时配置
   - 优化被测系统性能
   - 检查系统资源使用情况

3. **数据验证失败**
   - 检查测试数据格式和内容
   - 验证数据模式定义
   - 确认数据生成和加载逻辑

### 调试技巧

- 使用详细的日志记录
- 实现测试执行跟踪
- 提供调试接口和工具
- 支持测试回放和重现

通过遵循本实施指引，开发团队可以正确实施和使用RCC v4.1的API驱动解耦测试框架，确保系统的质量和可靠性。