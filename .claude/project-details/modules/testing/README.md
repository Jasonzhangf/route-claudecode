# 测试模块 (Testing Module)

## 模块概述

测试模块是RCC v4.0系统的质量保证中心，负责单元测试、集成测试、端到端测试和性能测试的管理和执行。

## 模块职责

1. **测试框架管理**: 管理测试框架和工具
2. **测试用例管理**: 管理测试用例的生命周期
3. **测试执行**: 执行各种类型的测试
4. **测试报告**: 生成和管理测试报告
5. **测试数据管理**: 管理测试所需的数据和环境
6. **持续集成**: 与CI/CD系统集成

## 模块结构

```
testing/
├── README.md                          # 本模块设计文档
├── test-framework-v4.md               # RCC v4.0 测试框架文档
├── index.ts                           # 模块入口和导出
├── test-runner.ts                     # 测试运行器
├── test-manager.ts                    # 测试管理器
├── test-reporter.ts                   # 测试报告器
├── test-data-manager.ts               # 测试数据管理器
├── test-environment.ts                # 测试环境管理器
├── test-coverage.ts                   # 测试覆盖率管理器
├── performance-tester.ts              # 性能测试器
├── integration-tester.ts              # 集成测试器
├── unit-tester.ts                     # 单元测试器
├── mock-server.ts                     # Mock服务器
├── fixtures/                         # 测试固件
│   ├── sample-requests/               # 示例请求
│   ├── sample-responses/              # 示例响应
│   ├── test-configs/                  # 测试配置
│   └── mock-data/                     # Mock数据
├── test-cases/                        # 测试用例
│   ├── unit-tests/                    # 单元测试用例
│   ├── integration-tests/             # 集成测试用例
│   ├── e2e-tests/                     # 端到端测试用例
│   └── performance-tests/             # 性能测试用例
└── reports/                           # 测试报告
    ├── coverage/                      # 覆盖率报告
    ├── performance/                   # 性能报告
    └── results/                       # 测试结果
```

## 核心组件

### 测试管理器 (TestManager)
负责测试的完整生命周期管理，是模块的主入口点。

### 测试运行器 (TestRunner)
负责实际执行测试用例，支持多种测试框架。

### 测试报告器 (TestReporter)
生成和管理测试报告，支持多种报告格式。

### 测试数据管理器 (TestDataManager)
管理测试所需的数据和环境配置。

### 测试环境管理器 (TestEnvironment)
管理测试环境的创建、配置和清理。

### 测试覆盖率管理器 (TestCoverage)
管理代码覆盖率统计和报告。

### 性能测试器 (PerformanceTester)
执行性能测试，测量系统性能指标。

### 集成测试器 (IntegrationTester)
执行模块间集成测试。

### 单元测试器 (UnitTester)
执行组件级单元测试。

### Mock服务器 (MockServer)
提供模拟的外部服务，支持离线测试。

## 测试框架

### RCC v4.0 测试框架
详细文档请参见: [test-framework-v4.md](test-framework-v4.md)

RCC v4.0 测试框架是一个完整的自动化测试系统，包括：
- **测试用例**: 覆盖所有转换场景的 Jest 测试文件
- **测试运行器**: 自动化执行测试的 Shell 脚本
- **比较系统**: RCC v4.0 与 Claude Code Router 结果对比
- **修复验证**: 自动修复功能验证机制
- **报告生成**: 详细的测试和比较报告

## 测试类型

### 单元测试 (Unit Tests)
```typescript
// 测试ClientManager的基本功能
describe('ClientManager', () => {
  let clientManager: ClientManager;

  beforeEach(() => {
    clientManager = new ClientManager();
  });

  test('should initialize correctly', async () => {
    await clientManager.initialize();
    expect(clientManager.isInitialized()).toBe(true);
  });

  test('should handle CLI commands', async () => {
    const result = await clientManager.executeCommand('start', { port: 3456 });
    expect(result).toBeDefined();
  });
});
```

### 集成测试 (Integration Tests)
```typescript
// 测试客户端到路由器的集成
describe('Client-Router Integration', () => {
  let clientManager: ClientManager;
  let routerManager: RouterManager;

  beforeAll(async () => {
    clientManager = new ClientManager();
    routerManager = new RouterManager();
    await Promise.all([
      clientManager.initialize(),
      routerManager.initialize()
    ]);
  });

  test('should route client requests through router', async () => {
    const request: RCCRequest = {
      id: 'test-001',
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const response = await clientManager.sendRequest(request);
    const routedResponse = await routerManager.routeRequest(request);
    
    expect(response).toEqual(routedResponse);
  });
});
```

### 端到端测试 (End-to-End Tests)
```typescript
// 测试完整的请求处理流程
describe('End-to-End Pipeline Test', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await startRCCTestServer(3456);
  });

  afterAll(async () => {
    await server.close();
  });

  test('should process complete request pipeline', async () => {
    const requestBody = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'What is 2+2?' }
      ]
    };

    const response = await fetch('http://localhost:3456/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.choices).toBeDefined();
    expect(data.choices[0].message.content).toContain('4');
  });
});
```

### 性能测试 (Performance Tests)
```typescript
// 测试系统性能指标
describe('Performance Benchmark', () => {
  test('should handle concurrent requests within SLA', async () => {
    const startTime = Date.now();
    const requests = Array(100).fill(null).map((_, i) => ({
      model: 'gpt-4',
      messages: [{ role: 'user', content: `Request ${i}` }]
    }));

    // 并发发送100个请求
    const promises = requests.map(req => 
      fetch('http://localhost:3456/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      })
    );

    const responses = await Promise.all(promises);
    const endTime = Date.now();
    
    const totalTime = endTime - startTime;
    const avgTime = totalTime / requests.length;
    
    // 平均响应时间应小于100ms
    expect(avgTime).toBeLessThan(100);
    
    // 所有请求应成功处理
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});
```

### 回放测试 (Replay Tests)
```typescript
// 基于Debug记录的回放测试
describe('Replay Test Suite', () => {
  let replaySystem: ReplaySystem;

  beforeAll(() => {
    replaySystem = new ReplaySystem();
  });

  test('should replay recorded scenario correctly', async () => {
    const scenarioId = 'scenario-2024-08-15_14-30-22_001';
    const result = await replaySystem.replayRequest(scenarioId);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.responseTime).toBeLessThan(200);
  });

  test('should validate replayed response', async () => {
    const scenarioId = 'scenario-2024-08-15_14-30-22_001';
    const originalRecord = await replaySystem.getOriginalRecord(scenarioId);
    const replayedResult = await replaySystem.replayRequest(scenarioId);
    
    const isValid = replaySystem.validateReplay(originalRecord, replayedResult);
    expect(isValid).toBe(true);
  });
});
```

### 转换测试 (Transformation Tests)
详细文档请参见: [test-framework-v4.md](test-framework-v4.md)

RCC v4.0 专门针对 Anthropic 到 OpenAI 格式转换的测试：
- 基本转换测试
- 工具调用转换测试
- 流式协议测试
- 复杂场景测试

## 测试配置

### 测试环境变量
```bash
# 测试配置
export TEST_ENV=development
export TEST_MOCK_SERVERS=true
export TEST_COVERAGE_ENABLED=true
export TEST_REPORT_FORMAT=json
export TEST_TIMEOUT=30000
```

### 测试配置文件
```json
{
  "test": {
    "environments": {
      "unit": {
        "timeout": 5000,
        "reporters": ["console", "json"]
      },
      "integration": {
        "timeout": 15000,
        "reporters": ["console", "html"]
      },
      "e2e": {
        "timeout": 30000,
        "reporters": ["console", "html", "junit"]
      }
    },
    "coverage": {
      "enabled": true,
      "thresholds": {
        "statements": 80,
        "branches": 70,
        "functions": 85,
        "lines": 80
      }
    },
    "mock": {
      "enabled": true,
      "servers": {
        "openai": "http://localhost:8080/mock/openai",
        "anthropic": "http://localhost:8080/mock/anthropic"
      }
    }
  }
}
```

## 接口定义

```typescript
interface TestingModuleInterface {
  initialize(): Promise<void>;
  runTests(testSuite: string): Promise<TestResults>;
  runAllTests(): Promise<TestResults>;
  getTestCoverage(): Promise<CoverageReport>;
  generateTestReport(): Promise<TestReport>;
  createTestCase(testCase: TestCase): Promise<void>;
  updateTestCase(testCaseId: string, testCase: TestCase): Promise<void>;
  deleteTestCase(testCaseId: string): Promise<void>;
}

interface TestRunnerInterface {
  runUnitTests(): Promise<TestResults>;
  runIntegrationTests(): Promise<TestResults>;
  runE2ETests(): Promise<TestResults>;
  runPerformanceTests(): Promise<TestResults>;
  runReplayTests(): Promise<TestResults>;
  runTransformationTests(): Promise<TestResults>;
}

interface TestReporterInterface {
  generateConsoleReport(results: TestResults): string;
  generateHTMLReport(results: TestResults): string;
  generateJSONReport(results: TestResults): string;
  generateJUnitReport(results: TestResults): string;
  generateComparisonReport(rccResults: any, ccrResults: any): string;
}

interface MockServerInterface {
  start(): Promise<void>;
  stop(): Promise<void>;
  mockRequest(endpoint: string, response: any): void;
  verifyRequest(endpoint: string): boolean;
  reset(): void;
}
```

## 依赖关系

- 依赖配置模块获取测试配置
- 依赖Debug模块获取回放测试数据
- 被CI/CD系统调用以执行自动化测试

## 设计原则

1. **全面覆盖**: 确保单元测试、集成测试和端到端测试全覆盖
2. **自动化**: 支持自动化测试执行和报告生成
3. **可重复性**: 确保测试结果的一致性和可重复性
4. **性能监控**: 集成性能测试和基准测试
5. **质量门禁**: 与CI/CD集成，确保质量门禁
6. **可维护性**: 提供清晰的测试结构和文档
7. **隔离性**: 确保测试环境的隔离和清理
8. **可扩展性**: 支持新的测试类型和框架集成