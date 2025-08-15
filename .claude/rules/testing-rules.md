# RCC v4.0 测试规则和质量标准

## 测试哲学

### 真实流水线测试原则

RCC v4.0 严格禁止Mock测试，所有测试必须通过真实的流水线进行。这确保了测试的真实性和系统的可靠性。

## 测试架构约束

### 1. 禁止Mock测试（最高优先级）

#### 绝对禁止的Mock模式
```typescript
// ❌ 严重违规：Mock外部API
describe('Bad Test Example', () => {
  test('should not mock external API', async () => {
    const mockOpenAI = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'mocked response' } }]
    });
    
    // 这种测试是被严格禁止的
    jest.mock('openai', () => ({ OpenAI: () => ({ chat: { completions: { create: mockOpenAI } } }) }));
  });
});

// ❌ 严重违规：Mock模块响应
describe('Another Bad Example', () => {
  test('should not mock module responses', () => {
    const mockTransformer = {
      transform: jest.fn().mockReturnValue('fake transformed data')
    };
    
    // 这种测试无法验证真实行为
  });
});

// ❌ 严重违规：Mock配置或依赖
describe('Config Mock Violation', () => {
  beforeEach(() => {
    jest.mock('../config', () => ({
      ConfigManager: jest.fn().mockImplementation(() => ({
        getProviders: () => ['fake-provider']
      }))
    }));
  });
});
```

#### 正确的真实测试模式
```typescript
// ✅ 正确：真实流水线集成测试
describe('Router Module Real Pipeline Test', () => {
  let router: RouterManager;
  let realConfig: ConfigManager;
  let testProviders: ProviderConfig[];
  
  beforeAll(async () => {
    // 使用真实配置文件（测试环境）
    realConfig = new ConfigManager('./test-configs/real-providers.json');
    
    // 加载真实Provider配置
    testProviders = await realConfig.loadProviders();
    
    // 创建真实路由器实例
    router = new RouterManager(realConfig);
    await router.initialize();
  });
  
  test('should route real Anthropic request through OpenAI provider', async () => {
    // 真实的Anthropic格式请求
    const anthropicRequest: AnthropicRequest = {
      model: 'claude-3-sonnet',
      messages: [
        { role: 'user', content: 'Explain quantum computing in one sentence.' }
      ],
      max_tokens: 100
    };
    
    // 通过真实流水线处理
    const response = await router.processRequest(anthropicRequest);
    
    // 验证真实响应结构
    expect(response).toHaveProperty('content');
    expect(response.content).toBeInstanceOf(Array);
    expect(response.content[0]).toHaveProperty('text');
    expect(typeof response.content[0].text).toBe('string');
    expect(response.content[0].text.length).toBeGreaterThan(0);
    
    // 验证响应时间合理性
    expect(response.usage?.input_tokens).toBeGreaterThan(0);
    expect(response.usage?.output_tokens).toBeGreaterThan(0);
  });
  
  test('should handle real streaming request', async () => {
    const streamRequest: AnthropicRequest = {
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'Count from 1 to 5.' }],
      max_tokens: 50,
      stream: true
    };
    
    const responseStream = await router.processStreamRequest(streamRequest);
    
    let eventCount = 0;
    let finalContent = '';
    
    for await (const chunk of responseStream) {
      eventCount++;
      if (chunk.type === 'content_block_delta') {
        finalContent += chunk.delta.text || '';
      }
    }
    
    expect(eventCount).toBeGreaterThan(0);
    expect(finalContent).toMatch(/1.*2.*3.*4.*5/); // 验证真实计数内容
  });
});
```

### 2. 基于Debug系统的测试架构

#### Debug数据捕获测试
```typescript
describe('Debug-based Real Pipeline Testing', () => {
  let debugManager: DebugManager;
  let sessionId: string;
  
  beforeEach(async () => {
    debugManager = new DebugManager();
    sessionId = `test-session-${Date.now()}`;
    
    // 启动调试数据捕获
    await debugManager.startSession(sessionId, {
      captureLevel: 'detailed',
      modules: ['client', 'router', 'pipeline', 'transformer', 'server'],
      includeTimings: true,
      includeMemoryUsage: true
    });
  });
  
  afterEach(async () => {
    await debugManager.stopSession(sessionId);
  });
  
  test('should capture complete data flow through real pipeline', async () => {
    const request: AnthropicRequest = {
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'What is TypeScript?' }],
      max_tokens: 100
    };
    
    // 执行真实请求
    const response = await router.processRequest(request);
    
    // 获取调试捕获的数据
    const capturedData = await debugManager.getSessionData(sessionId);
    
    // 验证完整的数据流捕获
    expect(capturedData).toHaveProperty('client');
    expect(capturedData).toHaveProperty('router');
    expect(capturedData).toHaveProperty('pipeline');
    
    // 验证流水线数据完整性
    expect(capturedData.pipeline).toHaveProperty('transformer');
    expect(capturedData.pipeline).toHaveProperty('protocol');
    expect(capturedData.pipeline).toHaveProperty('serverCompatibility');
    expect(capturedData.pipeline).toHaveProperty('server');
    
    // 验证数据流转顺序
    const timeline = capturedData.timeline;
    expect(timeline[0].module).toBe('client');
    expect(timeline[timeline.length - 1].module).toBe('client');
    
    // 验证真实转换过程
    const transformerInput = capturedData.pipeline.transformer.input;
    const transformerOutput = capturedData.pipeline.transformer.output;
    
    expect(transformerInput).toMatchObject(request); // Anthropic格式
    expect(transformerOutput).toHaveProperty('model'); // OpenAI格式
    expect(transformerOutput).toHaveProperty('messages');
    
    // 验证真实服务器通信
    const serverCall = capturedData.pipeline.server;
    expect(serverCall.request).toBeDefined();
    expect(serverCall.response).toBeDefined();
    expect(serverCall.httpStatus).toBe(200);
    expect(serverCall.responseTime).toBeGreaterThan(0);
  });
  
  test('should validate error handling through real pipeline', async () => {
    // 故意使用无效API Key触发真实错误
    const invalidConfig = new ConfigManager('./test-configs/invalid-api-key.json');
    const errorRouter = new RouterManager(invalidConfig);
    
    const request: AnthropicRequest = {
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'Test error handling' }],
      max_tokens: 50
    };
    
    // 期待真实的网络错误
    await expect(errorRouter.processRequest(request))
      .rejects.toThrow(NetworkError);
    
    // 验证错误被正确捕获和记录
    const errorData = await debugManager.getSessionErrors(sessionId);
    expect(errorData).toHaveLength(1);
    expect(errorData[0].type).toBe(ErrorType.NETWORK_ERROR);
    expect(errorData[0].module).toBe('server');
    expect(errorData[0].details).toHaveProperty('httpStatus', 401);
  });
});
```

### 3. 回放测试系统

#### 基于真实数据的回放
```typescript
describe('Replay-based Testing', () => {
  let replayManager: ReplayManager;
  
  beforeAll(async () => {
    replayManager = new ReplayManager();
    
    // 加载预先捕获的真实数据
    await replayManager.loadSession('./test-data/real-sessions/successful-requests.json');
  });
  
  test('should replay real successful request', async () => {
    // 从真实会话中回放特定请求
    const replayResult = await replayManager.replayRequest('request-001');
    
    expect(replayResult.success).toBe(true);
    expect(replayResult.originalResponse).toEqual(replayResult.replayedResponse);
    
    // 验证回放的性能特征
    expect(replayResult.timingDifference).toBeLessThan(100); // ms
    expect(replayResult.memoryDifference).toBeLessThan(10); // MB
  });
  
  test('should generate unit test from replay data', async () => {
    // 从回放数据自动生成单元测试
    const generatedTest = await replayManager.generateUnitTest('request-001');
    
    expect(generatedTest).toContain('describe');
    expect(generatedTest).toContain('test');
    expect(generatedTest).toContain('expect');
    
    // 验证生成的测试不包含Mock
    expect(generatedTest).not.toContain('mock');
    expect(generatedTest).not.toContain('jest.fn()');
    expect(generatedTest).not.toContain('mockReturnValue');
  });
});
```

## 测试分层架构

### 1. 单元测试 - 模块级真实测试

#### 模块隔离测试
```typescript
describe('Transformer Module Unit Tests', () => {
  let transformer: OpenAITransformer;
  
  beforeEach(() => {
    // 创建真实Transformer实例，不使用Mock
    transformer = new OpenAITransformer();
  });
  
  test('should transform real Anthropic request to OpenAI format', async () => {
    const anthropicRequest: AnthropicRequest = {
      model: 'claude-3-sonnet',
      messages: [
        { role: 'user', content: 'Hello world' }
      ],
      max_tokens: 100,
      temperature: 0.7,
      stream: false
    };
    
    // 真实转换，不使用Mock
    const openaiRequest = await transformer.transformRequest(anthropicRequest, 'openai');
    
    // 验证转换结果
    expect(openaiRequest).toHaveProperty('model');
    expect(openaiRequest).toHaveProperty('messages');
    expect(openaiRequest.messages).toHaveLength(1);
    expect(openaiRequest.messages[0]).toEqual({
      role: 'user',
      content: 'Hello world'
    });
    expect(openaiRequest.max_tokens).toBe(100);
    expect(openaiRequest.temperature).toBe(0.7);
    expect(openaiRequest.stream).toBe(false);
  });
  
  test('should handle complex message structures', async () => {
    const complexRequest: AnthropicRequest = {
      model: 'claude-3-sonnet',
      messages: [
        { role: 'user', content: 'What is this image?' },
        { role: 'assistant', content: 'I can see an image, but...' },
        { role: 'user', content: 'Please describe it in detail.' }
      ],
      max_tokens: 200,
      tools: [
        {
          name: 'analyze_image',
          description: 'Analyze image content',
          input_schema: {
            type: 'object',
            properties: {
              description: { type: 'string' }
            }
          }
        }
      ]
    };
    
    const result = await transformer.transformRequest(complexRequest, 'openai');
    
    // 验证复杂结构的正确转换
    expect(result.messages).toHaveLength(3);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].function.name).toBe('analyze_image');
  });
});
```

### 2. 集成测试 - 多模块协作测试

#### 模块间真实协作
```typescript
describe('Router-Pipeline Integration Tests', () => {
  let router: RouterManager;
  let pipelineManager: PipelineManager;
  let configManager: ConfigManager;
  
  beforeAll(async () => {
    // 使用真实配置
    configManager = new ConfigManager('./test-configs/integration-test.json');
    pipelineManager = new PipelineManager(configManager);
    router = new RouterManager(configManager, pipelineManager);
    
    await router.initialize();
  });
  
  test('should create and use real pipeline for request processing', async () => {
    const request: AnthropicRequest = {
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'Integration test message' }],
      max_tokens: 50
    };
    
    // 验证路由器选择正确的Pipeline
    const selectedProvider = await router.selectProvider(request);
    expect(selectedProvider).toBeDefined();
    expect(selectedProvider.protocol).toBe('openai');
    
    // 验证Pipeline被正确创建
    const pipeline = await pipelineManager.getPipeline(
      selectedProvider.name, 
      request.model
    );
    expect(pipeline).toBeDefined();
    expect(pipeline.provider).toBe(selectedProvider.name);
    
    // 执行真实的端到端处理
    const response = await router.processRequest(request);
    
    // 验证响应格式正确
    expect(response).toHaveProperty('content');
    expect(response.content[0]).toHaveProperty('text');
    expect(response).toHaveProperty('usage');
    expect(response.usage.input_tokens).toBeGreaterThan(0);
  });
  
  test('should handle multiple concurrent requests', async () => {
    const requests = Array.from({ length: 5 }, (_, i) => ({
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: `Concurrent test message ${i + 1}` }],
      max_tokens: 30
    }));
    
    // 并发执行真实请求
    const responses = await Promise.all(
      requests.map(req => router.processRequest(req))
    );
    
    // 验证所有响应都成功
    expect(responses).toHaveLength(5);
    responses.forEach((response, index) => {
      expect(response.content[0].text).toBeDefined();
      expect(response.content[0].text.length).toBeGreaterThan(0);
    });
    
    // 验证Pipeline复用和隔离
    const activePipelines = pipelineManager.getActivePipelines();
    expect(activePipelines.size).toBeGreaterThanOrEqual(1);
  });
});
```

### 3. 端到端测试 - 完整系统测试

#### 完整系统真实测试
```typescript
describe('Complete System End-to-End Tests', () => {
  let clientModule: ClientModule;
  let serverProcess: any;
  let testPort: number;
  
  beforeAll(async () => {
    testPort = 3457; // 测试专用端口
    
    // 启动真实服务器
    clientModule = new ClientModule();
    await clientModule.startServer(testPort);
    
    // 等待服务器就绪
    await waitForServer(testPort);
  });
  
  afterAll(async () => {
    await clientModule.stopServer();
  });
  
  test('should handle real HTTP request end-to-end', async () => {
    // 发送真实HTTP请求
    const response = await fetch(`http://localhost:${testPort}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet',
        messages: [
          { role: 'user', content: 'End-to-end test message' }
        ],
        max_tokens: 100
      })
    });
    
    expect(response.status).toBe(200);
    
    const jsonResponse = await response.json();
    expect(jsonResponse).toHaveProperty('content');
    expect(jsonResponse.content[0]).toHaveProperty('text');
    expect(jsonResponse).toHaveProperty('usage');
    
    // 验证响应时间合理
    const responseTime = response.headers.get('x-response-time');
    expect(parseInt(responseTime!)).toBeLessThan(5000); // 5秒内
  });
  
  test('should handle real streaming request end-to-end', async () => {
    const response = await fetch(`http://localhost:${testPort}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'Stream test: count to 3' }],
        max_tokens: 50,
        stream: true
      })
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/stream');
    
    // 读取真实流式响应
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    let eventCount = 0;
    let content = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          const parsed = JSON.parse(data);
          eventCount++;
          
          if (parsed.type === 'content_block_delta') {
            content += parsed.delta.text || '';
          }
        }
      }
    }
    
    expect(eventCount).toBeGreaterThan(0);
    expect(content.length).toBeGreaterThan(0);
  });
});

// 辅助函数：等待服务器就绪
async function waitForServer(port: number, maxWaitTime = 10000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return;
    } catch {
      // 服务器还未就绪
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Server on port ${port} did not become ready within ${maxWaitTime}ms`);
}
```

## 性能测试架构

### 1. 真实负载测试

#### 并发性能测试
```typescript
describe('Real Performance Tests', () => {
  test('should handle concurrent load with real requests', async () => {
    const concurrentUsers = 10;
    const requestsPerUser = 5;
    
    const generateUserRequests = (userId: number) => {
      return Array.from({ length: requestsPerUser }, (_, requestIndex) => ({
        userId,
        requestIndex,
        request: {
          model: 'claude-3-sonnet',
          messages: [{ 
            role: 'user', 
            content: `Load test message from user ${userId}, request ${requestIndex + 1}` 
          }],
          max_tokens: 50
        }
      }));
    };
    
    const allRequests = Array.from({ length: concurrentUsers }, generateUserRequests).flat();
    
    const startTime = Date.now();
    
    // 并发执行所有真实请求
    const results = await Promise.allSettled(
      allRequests.map(({ userId, requestIndex, request }) => 
        router.processRequest(request)
      )
    );
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // 分析性能结果
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    
    console.log(`Performance Test Results:`);
    console.log(`Total requests: ${allRequests.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Average time per request: ${totalTime / allRequests.length}ms`);
    console.log(`Requests per second: ${(allRequests.length / totalTime) * 1000}`);
    
    // 性能断言
    expect(successful.length).toBeGreaterThan(allRequests.length * 0.95); // 95%成功率
    expect(totalTime / allRequests.length).toBeLessThan(200); // 平均每请求<200ms
    expect(failed.length).toBeLessThan(allRequests.length * 0.05); // 失败率<5%
  });
});
```

### 2. 内存和资源监控

#### 真实资源使用测试
```typescript
describe('Resource Usage Tests', () => {
  test('should maintain reasonable memory usage under load', async () => {
    const initialMemory = process.memoryUsage();
    
    // 执行大量真实请求
    const requests = Array.from({ length: 100 }, (_, i) => ({
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: `Memory test message ${i + 1}` }],
      max_tokens: 30
    }));
    
    // 分批处理以模拟实际使用模式
    const batchSize = 10;
    const memorySnapshots: NodeJS.MemoryUsage[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(request => router.processRequest(request))
      );
      
      // 记录内存使用情况
      memorySnapshots.push(process.memoryUsage());
      
      // 允许垃圾回收
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage();
    
    // 分析内存使用
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
    
    console.log(`Memory Usage Analysis:`);
    console.log(`Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${memoryIncreasePercent.toFixed(2)}%)`);
    
    // 内存使用断言
    expect(finalMemory.heapUsed).toBeLessThan(200 * 1024 * 1024); // <200MB
    expect(memoryIncreasePercent).toBeLessThan(50); // 增长<50%
    
    // 检查内存泄漏模式
    const maxMemory = Math.max(...memorySnapshots.map(s => s.heapUsed));
    const avgMemory = memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / memorySnapshots.length;
    
    expect(finalMemory.heapUsed).toBeLessThan(maxMemory * 1.1); // 最终内存不应远超峰值
  });
});
```

## 测试数据管理

### 1. 真实测试数据

#### 测试数据生成和管理
```typescript
class RealTestDataManager {
  private static instance: RealTestDataManager;
  
  static getInstance(): RealTestDataManager {
    if (!this.instance) {
      this.instance = new RealTestDataManager();
    }
    return this.instance;
  }
  
  // 生成真实的测试请求
  generateRealTestRequests(count: number): AnthropicRequest[] {
    const templates = [
      'Explain the concept of recursion in programming',
      'What are the benefits of TypeScript over JavaScript?',
      'Describe the difference between REST and GraphQL APIs',
      'How does machine learning differ from traditional programming?',
      'What are the key principles of microservices architecture?'
    ];
    
    return Array.from({ length: count }, (_, i) => ({
      model: 'claude-3-sonnet',
      messages: [
        { role: 'user', content: templates[i % templates.length] }
      ],
      max_tokens: 100 + Math.floor(Math.random() * 100), // 100-200 tokens
      temperature: 0.1 + Math.random() * 0.8, // 0.1-0.9
      stream: Math.random() > 0.5 // 随机流式/非流式
    }));
  }
  
  // 加载预定义的真实测试场景
  async loadTestScenarios(scenarioName: string): Promise<TestScenario[]> {
    const scenarioPath = `./test-data/scenarios/${scenarioName}.json`;
    const scenarioData = await fs.readFile(scenarioPath, 'utf-8');
    return JSON.parse(scenarioData);
  }
  
  // 保存测试会话数据
  async saveTestSession(sessionId: string, data: any): Promise<void> {
    const sessionPath = `./test-data/sessions/${sessionId}.json`;
    await fs.writeFile(sessionPath, JSON.stringify(data, null, 2));
  }
}

interface TestScenario {
  name: string;
  description: string;
  requests: AnthropicRequest[];
  expectedBehavior: {
    minSuccessRate: number;
    maxResponseTime: number;
    expectedContentPattern?: RegExp;
  };
}
```

### 2. 测试环境管理

#### 隔离的测试环境
```typescript
class TestEnvironmentManager {
  private testConfig: ConfigManager;
  private testPort: number;
  
  constructor() {
    this.testPort = 3458; // 专用测试端口
  }
  
  async setupTestEnvironment(): Promise<void> {
    // 创建隔离的测试配置
    this.testConfig = new ConfigManager('./test-configs/isolated-test.json');
    
    // 验证测试配置不会影响生产
    const config = await this.testConfig.loadConfig();
    if (config.environment !== 'test') {
      throw new Error('Test environment must use test configuration');
    }
    
    // 确保测试端口可用
    await this.ensurePortAvailable(this.testPort);
    
    // 初始化测试专用数据库/日志目录
    await this.initializeTestStorage();
  }
  
  async teardownTestEnvironment(): Promise<void> {
    // 清理测试数据
    await this.cleanupTestData();
    
    // 释放测试端口
    await this.releaseTestPort();
  }
  
  private async ensurePortAvailable(port: number): Promise<void> {
    // 检查端口是否可用的实现
    const server = require('net').createServer();
    
    return new Promise((resolve, reject) => {
      server.listen(port, () => {
        server.close();
        resolve();
      });
      
      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error(`Test port ${port} is already in use`));
        } else {
          reject(err);
        }
      });
    });
  }
}
```

## 持续集成测试

### 1. CI/CD流水线测试

#### GitHub Actions测试配置
```yaml
# .github/workflows/real-pipeline-tests.yml
name: Real Pipeline Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  real-integration-tests:
    runs-on: ubuntu-latest
    
    env:
      NODE_ENV: test
      RCC_TEST_PORT: 3458
      
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Setup test environment
      run: |
        mkdir -p ~/.route-claudecode/logs
        mkdir -p ~/.route-claudecode/debug
        mkdir -p ./test-data/sessions
    
    - name: Run TypeScript compilation
      run: npm run build
    
    - name: Run real unit tests
      run: npm run test:unit:real
    
    - name: Run real integration tests
      run: npm run test:integration:real
      
    - name: Run real e2e tests
      run: npm run test:e2e:real
      timeout-minutes: 10
    
    - name: Run performance tests
      run: npm run test:performance
      timeout-minutes: 15
    
    - name: Generate test report
      run: npm run test:report
      if: always()
    
    - name: Upload test artifacts
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: test-results-${{ matrix.node-version }}
        path: |
          ./test-results/
          ./test-data/sessions/
          ~/.route-claudecode/logs/
```

### 2. 测试质量门禁

#### 质量检查脚本
```bash
#!/bin/bash
# scripts/test/quality-gates.sh

set -e

echo "🔍 运行测试质量门禁检查..."

# 1. 检查是否有Mock测试
echo "📋 检查Mock测试违规..."
check_mock_violations() {
    local mock_patterns=(
        "jest\.mock"
        "mockReturnValue"
        "mockResolvedValue" 
        "jest\.fn\(\)"
        "createMock"
        "mock\("
    )
    
    for pattern in "${mock_patterns[@]}"; do
        if find ./src ./test -name "*.ts" -type f -exec grep -l "$pattern" {} \; 2>/dev/null | grep -v node_modules; then
            echo "❌ 发现Mock测试违规: $pattern"
            echo "   违规文件:"
            find ./src ./test -name "*.ts" -type f -exec grep -l "$pattern" {} \; | sed 's/^/   - /'
            exit 1
        fi
    done
    
    echo "✅ Mock测试检查通过"
}

# 2. 检查测试覆盖率
echo "📊 检查测试覆盖率..."
check_test_coverage() {
    npm run test:coverage
    
    # 检查覆盖率报告
    local coverage_file="./coverage/coverage-summary.json"
    if [ ! -f "$coverage_file" ]; then
        echo "❌ 覆盖率报告未生成"
        exit 1
    fi
    
    # 提取覆盖率数据
    local line_coverage=$(jq '.total.lines.pct' "$coverage_file")
    local branch_coverage=$(jq '.total.branches.pct' "$coverage_file")
    local function_coverage=$(jq '.total.functions.pct' "$coverage_file")
    
    echo "覆盖率结果:"
    echo "  行覆盖率: ${line_coverage}%"
    echo "  分支覆盖率: ${branch_coverage}%"
    echo "  函数覆盖率: ${function_coverage}%"
    
    # 覆盖率门禁
    if (( $(echo "$line_coverage < 80" | bc -l) )); then
        echo "❌ 行覆盖率低于80%: ${line_coverage}%"
        exit 1
    fi
    
    if (( $(echo "$branch_coverage < 70" | bc -l) )); then
        echo "❌ 分支覆盖率低于70%: ${branch_coverage}%"
        exit 1
    fi
    
    echo "✅ 测试覆盖率检查通过"
}

# 3. 检查真实流水线测试
echo "🔄 验证真实流水线测试..."
validate_real_pipeline_tests() {
    # 运行标记为真实流水线测试的用例
    npm run test:real-pipeline
    
    # 检查是否有足够的真实测试
    local real_test_count=$(grep -r "describe.*Real Pipeline" ./test --include="*.ts" | wc -l)
    if [ "$real_test_count" -lt 5 ]; then
        echo "❌ 真实流水线测试数量不足: $real_test_count (至少需要5个)"
        exit 1
    fi
    
    echo "✅ 真实流水线测试验证通过 ($real_test_count 个测试)"
}

# 4. 性能基准检查
echo "⚡ 性能基准检查..."
check_performance_benchmarks() {
    npm run test:performance
    
    # 检查性能报告
    local perf_report="./test-results/performance-report.json"
    if [ ! -f "$perf_report" ]; then
        echo "❌ 性能报告未生成"
        exit 1
    fi
    
    # 检查关键性能指标
    local avg_response_time=$(jq '.averageResponseTime' "$perf_report")
    local memory_usage=$(jq '.peakMemoryUsage' "$perf_report")
    local success_rate=$(jq '.successRate' "$perf_report")
    
    echo "性能指标:"
    echo "  平均响应时间: ${avg_response_time}ms"
    echo "  峰值内存使用: ${memory_usage}MB"
    echo "  成功率: ${success_rate}%"
    
    # 性能门禁
    if (( $(echo "$avg_response_time > 200" | bc -l) )); then
        echo "❌ 平均响应时间超标: ${avg_response_time}ms (限制: 200ms)"
        exit 1
    fi
    
    if (( $(echo "$memory_usage > 200" | bc -l) )); then
        echo "❌ 内存使用超标: ${memory_usage}MB (限制: 200MB)"
        exit 1
    fi
    
    if (( $(echo "$success_rate < 95" | bc -l) )); then
        echo "❌ 成功率过低: ${success_rate}% (要求: 95%)"
        exit 1
    fi
    
    echo "✅ 性能基准检查通过"
}

# 执行所有检查
check_mock_violations
check_test_coverage
validate_real_pipeline_tests
check_performance_benchmarks

echo "🎉 所有测试质量门禁检查通过！"
```

## 总结

这些测试规则确保了：

1. **真实性验证**: 严格禁止Mock，所有测试使用真实流水线
2. **完整覆盖**: 从单元到端到端的全面测试覆盖
3. **性能保证**: 真实负载下的性能和资源使用验证
4. **质量门禁**: 自动化的质量检查和持续集成
5. **数据驱动**: 基于Debug系统的数据捕获和回放
6. **环境隔离**: 独立的测试环境和配置管理
7. **持续监控**: CI/CD流水线中的自动化测试执行

**违反真实流水线测试原则的代码将被严格拒绝，确保系统的可靠性和真实性。**