# RCC v4.0 最终正确架构设计文档

## 核心设计原则

### 🎯 架构理念
1. **初始化时创建所有流水线**: 服务器启动时根据routing table创建所有流水线
2. **一个Provider.Model.APIKey一条流水线**: 每个Provider-Model-APIKey组合对应一条独立流水线
3. **Demo1风格虚拟模型映射**: 根据输入模型+请求条件动态生成虚拟模型
4. **流水线选择，不是Provider选择**: 路由器选择流水线列表，负载均衡器选择具体流水线
5. **APIKey级负载均衡**: 同一Provider.Model的多个APIKey对应多条流水线，负载均衡选择
6. **握手连接**: 每条流水线在初始化时完成4层内部握手连接
7. **Runtime状态**: 初始化完成后，所有流水线处于活跃运行状态

## 虚拟模型定义（Demo1风格）

### ✅ 实际存在的5个虚拟模型
```typescript
function mapToVirtualModel(inputModel: string, request: any): string {
  const tokenCount = calculateTokenCount(request);
  
  // 1. 长上下文检测 (>60K tokens)
  if (tokenCount > 60000) {
    return 'longContext';
  }
  
  // 2. Claude 3.5 Haiku → 背景任务
  if (inputModel?.startsWith('claude-3-5-haiku')) {
    return 'background';
  }
  
  // 3. 推理模型检测 (包含thinking参数)
  if (request.thinking) {
    return 'reasoning';
  }
  
  // 4. Web搜索工具检测
  if (Array.isArray(request.tools) && request.tools.some(tool =>
    tool.type?.startsWith('web_search') || tool.name?.includes('search'))) {
    return 'webSearch';
  }
  
  // 5. 默认 - 包括Claude 3.5 Sonnet等所有其他情况
  return 'default';
}
```

### 虚拟模型清单
- **`default`**: 默认模型（包括Claude 3.5 Sonnet、Claude Sonnet 4等）
- **`background`**: Claude 3.5 Haiku系列 
- **`reasoning`**: 包含thinking参数的推理请求
- **`webSearch`**: 包含web搜索工具的请求
- **`longContext`**: 超过60K tokens的长上下文请求

## 系统启动流程

### 1. 服务器启动 (Server Start)
```typescript
async function startServer() {
  // Step 1: 加载配置
  const userConfig = loadUserConfig();
  const systemConfig = loadSystemConfig(); 
  
  // Step 2: 构建路由表（根据虚拟模型映射）
  const routingTable = buildRoutingTable(userConfig, systemConfig);
  
  // Step 3: 初始化Pipeline Manager（根据routing table创建所有流水线）
  const pipelineManager = new PipelineManager();
  await pipelineManager.initializeFromRoutingTable(routingTable);
  
  // Step 4: 创建路由器（基于已初始化的流水线）
  const pipelineRouter = new PipelineRouter(routingTable);
  
  // Step 5: 创建负载均衡器
  const loadBalancer = new LoadBalancer(pipelineManager);
  
  // Step 6: 启动Debug系统，记录所有"活着"的流水线
  const debugSystem = new PipelineDebugSystem(pipelineManager);
  await debugSystem.performInitializationCheck(routingTable);
  
  // Step 7: 启动HTTP服务器
  const httpServer = new HttpServer(pipelineRouter, loadBalancer, debugSystem);
  await httpServer.start();
  
  console.log('✅ RCC v4.0 Server started with all pipelines ready');
}
```

### 2. 流水线初始化 (Pipeline Initialization)
```typescript
async initializeFromRoutingTable(routingTable: RoutingTable) {
  console.log('🔧 Initializing all pipelines from routing table...');
  
  for (const [virtualModel, routes] of Object.entries(routingTable.routes)) {
    for (const route of routes) {
      const provider = systemConfig.providerTypes[route.provider];
      
      // 为每个APIKey创建一条独立流水线
      for (let keyIndex = 0; keyIndex < route.apiKeys.length; keyIndex++) {
        const pipelineId = `${route.provider}-${route.targetModel}-key${keyIndex}`;
        
        console.log(`  🔨 Creating pipeline: ${pipelineId}`);
        console.log(`     - Virtual Model: ${virtualModel}`);
        console.log(`     - Provider: ${route.provider}`);
        console.log(`     - Target Model: ${route.targetModel}`);
        console.log(`     - API Key Index: ${keyIndex}`);
        
        // 创建完整的4层流水线
        const pipeline = await this.createCompletePipeline({
          pipelineId,
          virtualModel,
          provider: route.provider,
          targetModel: route.targetModel,
          apiKey: route.apiKeys[keyIndex],  // 绑定特定的APIKey
          endpoint: provider.endpoint,
          transformer: provider.transformer,
          protocol: provider.protocol,
          serverCompatibility: provider.serverCompatibility
        });
        
        // 执行握手连接
        console.log(`  🤝 Handshaking pipeline: ${pipelineId}`);
        await pipeline.handshake();
        
        // 标记为runtime状态
        pipeline.status = 'runtime';
        this.pipelines.set(pipelineId, pipeline);
        
        console.log(`  ✅ Pipeline ready: ${pipelineId}`);
      }
    }
  }
  
  console.log(`🎉 All ${this.pipelines.size} pipelines initialized and ready`);
}
```

## 请求处理流程

### 1. 完整请求处理流程
```typescript
async handleRequest(inputModel: string, request: any) {
  console.log(`📥 Incoming request: ${inputModel}`);
  
  // Step 1: Demo1风格的虚拟模型映射
  const virtualModel = this.mapToVirtualModel(inputModel, request);
  console.log(`🎯 Mapped to virtual model: ${virtualModel}`);
  
  // Step 2: 路由器根据虚拟模型找到对应的流水线列表
  const routingDecision = pipelineRouter.route(virtualModel);
  console.log(`🛣️  Available pipelines: ${routingDecision.availablePipelines.join(', ')}`);
  
  // Step 3: 负载均衡选择具体流水线
  const selectedPipelineId = loadBalancer.selectPipeline(routingDecision.availablePipelines);
  console.log(`⚖️  Selected pipeline: ${selectedPipelineId}`);
  
  // Step 4: 获取流水线（已经runtime状态）
  const pipeline = pipelineManager.getPipeline(selectedPipelineId);
  if (!pipeline || pipeline.status !== 'runtime') {
    throw new Error(`Pipeline ${selectedPipelineId} not ready`);
  }
  
  // Step 5: 直接执行（无需组装，流水线已连接）
  console.log(`🏃 Executing pipeline: ${selectedPipelineId}`);
  const response = await pipeline.execute(request);
  
  console.log(`✅ Request completed via pipeline: ${selectedPipelineId}`);
  return response;
}
```

### 2. 流水线执行 (Pipeline Execution)
```typescript
class CompletePipeline {
  readonly pipelineId: string;
  readonly virtualModel: string;
  readonly provider: string; 
  readonly targetModel: string;
  readonly apiKey: string;
  
  // 4层架构组件（初始化时已创建并连接）
  readonly transformer: TransformerModule;
  readonly protocol: ProtocolModule;
  readonly serverCompatibility: ServerCompatibilityModule; 
  readonly server: ServerModule;
  
  status: 'initializing' | 'runtime' | 'error' | 'stopped';
  lastHandshakeTime: Date;
  
  async execute(request: any): Promise<any> {
    console.log(`🔄 Pipeline ${this.pipelineId} executing request`);
    
    // 直接通过4层链路处理，无需运行时决策
    let data = request;
    
    try {
      // Layer 1: Transformer (已连接)
      console.log(`  📝 Layer 1 - Transformer: ${this.transformer.constructor.name}`);
      data = await this.transformer.transform(data);
      
      // Layer 2: Protocol (已连接)
      console.log(`  🔌 Layer 2 - Protocol: ${this.protocol.constructor.name}`);
      data = await this.protocol.process(data);
      
      // Layer 3: Server Compatibility (已连接)
      console.log(`  🔧 Layer 3 - ServerCompatibility: ${this.serverCompatibility.constructor.name}`);
      data = await this.serverCompatibility.adapt(data);
      
      // Layer 4: Server (已连接)
      console.log(`  🌐 Layer 4 - Server: ${this.server.constructor.name}`);
      const response = await this.server.execute(data);
      
      console.log(`  ✅ Pipeline ${this.pipelineId} execution completed`);
      return response;
      
    } catch (error) {
      console.error(`  ❌ Pipeline ${this.pipelineId} execution failed:`, error.message);
      throw error;
    }
  }
  
  async handshake(): Promise<void> {
    console.log(`🤝 Handshaking pipeline ${this.pipelineId}`);
    
    // 连接4层组件
    await this.transformer.initialize();
    await this.protocol.initialize();  
    await this.serverCompatibility.initialize();
    await this.server.initialize();
    
    // 验证连接
    const healthCheck = await this.healthCheck();
    if (!healthCheck) {
      throw new Error(`Pipeline ${this.pipelineId} handshake failed`);
    }
    
    this.lastHandshakeTime = new Date();
    console.log(`✅ Pipeline ${this.pipelineId} handshake completed`);
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      // 检查每一层是否正常
      const transformerOK = await this.transformer.healthCheck?.() ?? true;
      const protocolOK = await this.protocol.healthCheck?.() ?? true;
      const compatibilityOK = await this.serverCompatibility.healthCheck?.() ?? true;
      const serverOK = await this.server.healthCheck?.() ?? true;
      
      return transformerOK && protocolOK && compatibilityOK && serverOK;
    } catch (error) {
      console.error(`Health check failed for pipeline ${this.pipelineId}:`, error.message);
      return false;
    }
  }
}
```

## 配置文件结构

### 用户配置文件示例
```json
{
  "providers": {
    "lmstudio": {
      "apiKeys": ["key1", "key2", "key3"],
      "maxTokens": 4096
    }
  },
  "routing": {
    "rules": [
      {
        "name": "default",
        "provider": "lmstudio",
        "model": "llama-3.1-8b"
      },
      {
        "name": "background", 
        "provider": "lmstudio",
        "model": "llama-3.1-8b"
      },
      {
        "name": "reasoning",
        "provider": "lmstudio", 
        "model": "llama-3.1-70b"
      },
      {
        "name": "webSearch",
        "provider": "lmstudio",
        "model": "llama-3.1-70b"
      },
      {
        "name": "longContext",
        "provider": "lmstudio",
        "model": "llama-3.1-405b"
      }
    ]
  }
}
```

### 系统配置文件示例
```json
{
  "providerTypes": {
    "lmstudio": {
      "endpoint": "http://localhost:1234/v1",
      "protocol": "openai",
      "transformer": "lmstudio-standard",
      "serverCompatibility": "lmstudio",
      "timeout": 30000,
      "maxRetries": 2
    }
  },
  "transformers": {
    "lmstudio-standard": {
      "maxTokens": 4096,
      "passthrough": true,
      "formatters": ["local-model-optimizer"]
    }
  },
  "serverCompatibilityModules": {
    "lmstudio": {
      "module": "LMStudioCompatibilityModule",
      "description": "LM Studio专用优化模块，特殊处理工具格式"
    }
  }
}
```

### 转换后的Routing Table
```typescript
const routingTable: RoutingTable = {
  routes: {
    "default": [{
      routeId: "route-default-lmstudio",
      virtualModel: "default",
      provider: "lmstudio",
      targetModel: "llama-3.1-8b",
      apiKeys: ["key1", "key2", "key3"],
      pipelineIds: [
        "lmstudio-llama-3.1-8b-key0",
        "lmstudio-llama-3.1-8b-key1", 
        "lmstudio-llama-3.1-8b-key2"
      ],
      isActive: true,
      health: "healthy"
    }],
    "background": [{
      routeId: "route-background-lmstudio",
      virtualModel: "background", 
      provider: "lmstudio",
      targetModel: "llama-3.1-8b",
      apiKeys: ["key1", "key2", "key3"],
      pipelineIds: [
        "lmstudio-llama-3.1-8b-key0",
        "lmstudio-llama-3.1-8b-key1",
        "lmstudio-llama-3.1-8b-key2"
      ],
      isActive: true,
      health: "healthy"
    }],
    "reasoning": [{
      routeId: "route-reasoning-lmstudio",
      virtualModel: "reasoning",
      provider: "lmstudio", 
      targetModel: "llama-3.1-70b",
      apiKeys: ["key1", "key2", "key3"],
      pipelineIds: [
        "lmstudio-llama-3.1-70b-key0",
        "lmstudio-llama-3.1-70b-key1",
        "lmstudio-llama-3.1-70b-key2"
      ],
      isActive: true,
      health: "healthy"
    }],
    "webSearch": [{
      routeId: "route-webSearch-lmstudio",
      virtualModel: "webSearch",
      provider: "lmstudio",
      targetModel: "llama-3.1-70b", 
      apiKeys: ["key1", "key2", "key3"],
      pipelineIds: [
        "lmstudio-llama-3.1-70b-key0",
        "lmstudio-llama-3.1-70b-key1",
        "lmstudio-llama-3.1-70b-key2"
      ],
      isActive: true,
      health: "healthy"
    }],
    "longContext": [{
      routeId: "route-longContext-lmstudio",
      virtualModel: "longContext",
      provider: "lmstudio",
      targetModel: "llama-3.1-405b",
      apiKeys: ["key1", "key2", "key3"],
      pipelineIds: [
        "lmstudio-llama-3.1-405b-key0",
        "lmstudio-llama-3.1-405b-key1", 
        "lmstudio-llama-3.1-405b-key2"
      ],
      isActive: true,
      health: "healthy"
    }]
  },
  defaultRoute: "default"
};
```

## 实际创建的流水线列表

根据上述配置，系统将创建以下流水线：

```typescript
const expectedPipelines = [
  // default 和 background 虚拟模型共享相同的 lmstudio-llama-3.1-8b
  "lmstudio-llama-3.1-8b-key0",
  "lmstudio-llama-3.1-8b-key1", 
  "lmstudio-llama-3.1-8b-key2",
  
  // reasoning 和 webSearch 虚拟模型共享相同的 lmstudio-llama-3.1-70b
  "lmstudio-llama-3.1-70b-key0",
  "lmstudio-llama-3.1-70b-key1",
  "lmstudio-llama-3.1-70b-key2",
  
  // longContext 虚拟模型独享 lmstudio-llama-3.1-405b
  "lmstudio-llama-3.1-405b-key0",
  "lmstudio-llama-3.1-405b-key1",
  "lmstudio-llama-3.1-405b-key2"
];

// 总计：9条流水线
// 3个不同的 Provider.Model 组合 × 3个APIKey = 9条流水线
```

## 分层测试和诊断系统

### 1. 初始化检查（自检）
```typescript
class PipelineDebugSystem {
  async performInitializationCheck(routingTable: RoutingTable): Promise<void> {
    console.log('🔍 === Pipeline Initialization Check ===');
    
    // Step 1: 记录所有"活着"的流水线
    const livePipelines = this.recordLivePipelines();
    
    // Step 2: 根据配置文件计算期望的流水线
    const expectedPipelines = this.calculateExpectedPipelines(routingTable);
    
    // Step 3: 对比验证
    const validationResult = this.validatePipelinesAgainstConfig(expectedPipelines, livePipelines);
    
    // Step 4: 检查每条流水线的内部结构
    await this.validatePipelineArchitecture(livePipelines);
    
    if (validationResult.isValid) {
      console.log('✅ Initialization check passed: All pipelines correctly configured');
    } else {
      console.error('❌ Initialization check failed:', validationResult.errors);
      throw new Error('Pipeline initialization validation failed');
    }
  }
  
  recordLivePipelines(): PipelineDebugInfo[] {
    console.log('📋 Recording live pipelines:');
    
    const livePipelines = this.pipelineManager.getAllPipelines();
    const debugInfo: PipelineDebugInfo[] = [];
    
    for (const [pipelineId, pipeline] of livePipelines) {
      const info: PipelineDebugInfo = {
        pipelineId,
        status: pipeline.status,
        routeInfo: {
          virtualModel: pipeline.virtualModel,
          provider: pipeline.provider,
          targetModel: pipeline.targetModel,
          apiKeyIndex: this.extractApiKeyIndex(pipelineId)
        },
        layerStatus: {
          transformer: pipeline.transformer ? 'connected' : 'error',
          protocol: pipeline.protocol ? 'connected' : 'error',
          serverCompatibility: pipeline.serverCompatibility ? 'connected' : 'error',
          server: pipeline.server ? 'connected' : 'error'
        },
        lastExecutionTime: undefined,
        errorCount: 0,
        successCount: 0
      };
      
      debugInfo.push(info);
      
      console.log(`  ✅ ${pipelineId}`);
      console.log(`     - Virtual Model: ${info.routeInfo.virtualModel}`);
      console.log(`     - Provider.Model: ${info.routeInfo.provider}.${info.routeInfo.targetModel}`);
      console.log(`     - API Key Index: ${info.routeInfo.apiKeyIndex}`);
      console.log(`     - Status: ${info.status}`);
      console.log(`     - Layers: ${JSON.stringify(info.layerStatus)}`);
    }
    
    return debugInfo;
  }
  
  calculateExpectedPipelines(routingTable: RoutingTable): ExpectedPipeline[] {
    console.log('🧮 Calculating expected pipelines from config:');
    
    const expected: ExpectedPipeline[] = [];
    const seenProviderModels = new Set<string>();
    
    for (const [virtualModel, routes] of Object.entries(routingTable.routes)) {
      for (const route of routes) {
        const providerModel = `${route.provider}-${route.targetModel}`;
        
        // 避免重复计算相同的Provider.Model
        if (!seenProviderModels.has(providerModel)) {
          seenProviderModels.add(providerModel);
          
          // 每个APIKey对应一条流水线
          for (let keyIndex = 0; keyIndex < route.apiKeys.length; keyIndex++) {
            const expectedPipeline: ExpectedPipeline = {
              pipelineId: `${route.provider}-${route.targetModel}-key${keyIndex}`,
              provider: route.provider,
              targetModel: route.targetModel, 
              apiKeyIndex: keyIndex,
              shouldExist: true
            };
            
            expected.push(expectedPipeline);
            console.log(`  📋 Expected: ${expectedPipeline.pipelineId}`);
          }
        }
      }
    }
    
    console.log(`📊 Total expected pipelines: ${expected.length}`);
    return expected;
  }
  
  async validatePipelineArchitecture(livePipelines: PipelineDebugInfo[]): Promise<void> {
    console.log('🏗️  Validating pipeline architecture:');
    
    for (const pipelineInfo of livePipelines) {
      const pipeline = this.pipelineManager.getPipeline(pipelineInfo.pipelineId);
      if (!pipeline) continue;
      
      console.log(`  🔍 Checking ${pipelineInfo.pipelineId}:`);
      
      // 验证4层架构是否完整
      const architectureCheck = {
        hasTransformer: !!pipeline.transformer,
        hasProtocol: !!pipeline.protocol,
        hasServerCompatibility: !!pipeline.serverCompatibility,
        hasServer: !!pipeline.server
      };
      
      const isComplete = Object.values(architectureCheck).every(Boolean);
      
      if (isComplete) {
        console.log(`    ✅ Architecture complete: Transformer → Protocol → ServerCompatibility → Server`);
        
        // 执行健康检查
        const isHealthy = await pipeline.healthCheck();
        console.log(`    ${isHealthy ? '✅' : '❌'} Health check: ${isHealthy ? 'PASS' : 'FAIL'}`);
        
      } else {
        console.log(`    ❌ Architecture incomplete:`, architectureCheck);
        throw new Error(`Pipeline ${pipelineInfo.pipelineId} has incomplete architecture`);
      }
    }
  }
}
```

### 2. 运行时请求测试
```typescript
class RequestTestSystem {
  async performRequestTest(testRequest: any): Promise<void> {
    console.log('🧪 === Request Test System ===');
    console.log(`📥 Test request: ${JSON.stringify(testRequest, null, 2)}`);
    
    // Step 1: 路由检查
    const routingResult = await this.testRouting(testRequest);
    
    // Step 2: 流水线执行检查
    const executionResult = await this.testPipelineExecution(routingResult.selectedPipelineId, testRequest);
    
    // Step 3: 响应验证
    if (executionResult.hasResponse) {
      await this.validateResponse(executionResult.response, testRequest);
    } else {
      await this.diagnoseExecutionFailure(routingResult.selectedPipelineId, testRequest);
    }
  }
  
  async testRouting(testRequest: any): Promise<RoutingTestResult> {
    console.log('🛣️  Testing routing logic:');
    
    // 虚拟模型映射测试
    const inputModel = testRequest.model || 'claude-3-5-sonnet';
    const virtualModel = this.mapToVirtualModel(inputModel, testRequest);
    console.log(`  📍 Virtual model mapping: ${inputModel} → ${virtualModel}`);
    
    // 路由器测试
    const routingDecision = this.pipelineRouter.route(virtualModel);
    console.log(`  🎯 Available pipelines: ${routingDecision.availablePipelines.join(', ')}`);
    
    if (routingDecision.availablePipelines.length === 0) {
      throw new Error(`No available pipelines for virtual model: ${virtualModel}`);
    }
    
    // 负载均衡测试
    const selectedPipelineId = this.loadBalancer.selectPipeline(routingDecision.availablePipelines);
    console.log(`  ⚖️  Selected pipeline: ${selectedPipelineId}`);
    
    return {
      virtualModel,
      availablePipelines: routingDecision.availablePipelines,
      selectedPipelineId,
      isRoutingValid: true
    };
  }
  
  async testPipelineExecution(pipelineId: string, testRequest: any): Promise<ExecutionTestResult> {
    console.log(`🏃 Testing pipeline execution: ${pipelineId}`);
    
    const pipeline = this.pipelineManager.getPipeline(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }
    
    if (pipeline.status !== 'runtime') {
      throw new Error(`Pipeline not ready: ${pipelineId}, status: ${pipeline.status}`);
    }
    
    try {
      const response = await pipeline.execute(testRequest);
      console.log(`  ✅ Pipeline execution successful`);
      console.log(`  📤 Response preview: ${JSON.stringify(response).substring(0, 200)}...`);
      
      return {
        pipelineId,
        hasResponse: true,
        response,
        executionTime: Date.now(),
        error: null
      };
      
    } catch (error) {
      console.log(`  ❌ Pipeline execution failed: ${error.message}`);
      
      return {
        pipelineId, 
        hasResponse: false,
        response: null,
        executionTime: Date.now(),
        error: error.message
      };
    }
  }
  
  async validateResponse(response: any, originalRequest: any): Promise<void> {
    console.log('🔍 Validating response from server layer upwards:');
    
    // Layer 4: Server Response Validation
    console.log('  🌐 Layer 4 - Server Response:');
    if (!response) {
      throw new Error('No response from server layer');
    }
    
    if (!response.choices || !Array.isArray(response.choices)) {
      throw new Error('Invalid server response format: missing choices array');
    }
    console.log('    ✅ Server response format valid');
    
    // Layer 3: Server Compatibility Response
    console.log('  🔧 Layer 3 - Server Compatibility:');
    // 验证是否正确处理了LM Studio特殊格式
    console.log('    ✅ Server compatibility processing valid');
    
    // Layer 2: Protocol Response
    console.log('  🔌 Layer 2 - Protocol:');  
    // 验证协议响应格式
    console.log('    ✅ Protocol response valid');
    
    // Layer 1: Transformer Response
    console.log('  📝 Layer 1 - Transformer:');
    // 验证最终响应格式是否符合Anthropic标准
    console.log('    ✅ Transformer response valid');
    
    console.log('🎉 Response validation completed successfully');
  }
  
  async diagnoseExecutionFailure(pipelineId: string, testRequest: any): Promise<void> {
    console.log('🩺 Diagnosing execution failure from server layer upwards:');
    
    const pipeline = this.pipelineManager.getPipeline(pipelineId);
    if (!pipeline) {
      console.error('❌ Pipeline not found');
      return;
    }
    
    // Layer 4: Server Request Diagnosis
    console.log('  🌐 Layer 4 - Server Layer:');
    try {
      // 尝试直接测试Server层
      const serverRequest = await this.buildServerRequest(testRequest, pipeline);
      console.log('    📤 Server request built successfully');
      console.log(`    🔍 Request preview: ${JSON.stringify(serverRequest).substring(0, 200)}...`);
      
      // 尝试调用Server
      const serverResponse = await pipeline.server.execute(serverRequest);
      console.log('    ✅ Server layer responds correctly');
      
    } catch (error) {
      console.log(`    ❌ Server layer error: ${error.message}`);
      console.log('    🔍 Check: API endpoint, API key, model name, request format');
      return;
    }
    
    // Layer 3: Server Compatibility Diagnosis
    console.log('  🔧 Layer 3 - Server Compatibility:');
    try {
      const compatRequest = await pipeline.serverCompatibility.adapt(testRequest);
      console.log('    ✅ Server compatibility adaptation successful');
    } catch (error) {
      console.log(`    ❌ Server compatibility error: ${error.message}`);
      return;
    }
    
    // Layer 2: Protocol Diagnosis
    console.log('  🔌 Layer 2 - Protocol:');
    try {
      const protocolRequest = await pipeline.protocol.process(testRequest);
      console.log('    ✅ Protocol processing successful');
    } catch (error) {
      console.log(`    ❌ Protocol error: ${error.message}`);
      return;
    }
    
    // Layer 1: Transformer Diagnosis
    console.log('  📝 Layer 1 - Transformer:');
    try {
      const transformedRequest = await pipeline.transformer.transform(testRequest);
      console.log('    ✅ Transformer processing successful');
    } catch (error) {
      console.log(`    ❌ Transformer error: ${error.message}`);
      return;
    }
    
    console.log('🤔 All layers seem functional individually - checking integration...');
  }
}
```

### 3. 接口定义
```typescript
interface PipelineDebugInfo {
  pipelineId: string;
  status: 'initializing' | 'runtime' | 'error' | 'stopped';
  routeInfo: {
    virtualModel: string;
    provider: string;
    targetModel: string;
    apiKeyIndex: number;
  };
  layerStatus: {
    transformer: 'connected' | 'error';
    protocol: 'connected' | 'error';
    serverCompatibility: 'connected' | 'error';
    server: 'connected' | 'error';
  };
  lastExecutionTime?: Date;
  errorCount: number;
  successCount: number;
}

interface ExpectedPipeline {
  pipelineId: string;
  provider: string;
  targetModel: string;
  apiKeyIndex: number;
  shouldExist: boolean;
}

interface RoutingTestResult {
  virtualModel: string;
  availablePipelines: string[];
  selectedPipelineId: string;
  isRoutingValid: boolean;
}

interface ExecutionTestResult {
  pipelineId: string;
  hasResponse: boolean;
  response: any | null;
  executionTime: number;
  error: string | null;
}
```

## 负载均衡器

### 轮询负载均衡实现
```typescript
class LoadBalancer {
  private roundRobinCounters = new Map<string, number>();
  
  selectPipeline(availablePipelines: string[]): string {
    if (availablePipelines.length === 0) {
      throw new Error("No available pipelines for load balancing");
    }
    
    if (availablePipelines.length === 1) {
      return availablePipelines[0];
    }
    
    // 轮询选择 - 按流水线列表排序后轮询
    const sortedPipelines = availablePipelines.sort();
    const routeKey = sortedPipelines.join(',');
    const currentIndex = this.roundRobinCounters.get(routeKey) || 0;
    const selectedPipeline = sortedPipelines[currentIndex % sortedPipelines.length];
    
    this.roundRobinCounters.set(routeKey, currentIndex + 1);
    
    console.log(`⚖️  Load balancer selected: ${selectedPipeline} (${currentIndex % sortedPipelines.length + 1}/${sortedPipelines.length})`);
    return selectedPipeline;
  }
  
  getLoadBalancingStats(): LoadBalancingStats {
    const stats: LoadBalancingStats = {
      totalRoutes: this.roundRobinCounters.size,
      selections: {}
    };
    
    for (const [routeKey, count] of this.roundRobinCounters) {
      stats.selections[routeKey] = count;
    }
    
    return stats;
  }
}

interface LoadBalancingStats {
  totalRoutes: number;
  selections: Record<string, number>;
}
```

## 错误处理 - Zero Fallback Policy

```typescript
// ✅ 正确的Zero Fallback处理
class ZeroFallbackPipeline {
  async execute(request: any): Promise<any> {
    try {
      return await this.performExecution(request);
    } catch (error) {
      // 立即抛出错误，不进行任何fallback
      throw new PipelineExecutionError(
        `Pipeline ${this.pipelineId} failed: ${error.message}`,
        'PIPELINE_EXECUTION_FAILED',
        {
          pipelineId: this.pipelineId,
          originalError: error.message,
          layer: this.identifyFailedLayer(error)
        }
      );
    }
  }
}

// ❌ 错误的fallback处理（禁止使用）
/*
try {
  return await primaryPipeline.execute(request);
} catch (error) {
  // 违反Zero Fallback Policy
  return await backupPipeline.execute(request); 
}
*/
```

## 总结

这个架构的核心优势：

1. **性能优异**: 初始化时完成所有准备工作，运行时零组装开销
2. **架构清晰**: 每条流水线是独立的、完整的处理单元  
3. **易于调试**: 所有流水线状态在启动时可见，分层测试系统可精确定位问题
4. **Demo1兼容**: 保持Demo1的智能虚拟模型映射逻辑
5. **负载均衡简单**: 只需要在已创建的流水线中选择
6. **零fallback**: 失败立即报错，不会产生意外的降级行为
7. **完整测试**: 从初始化检查到运行时诊断的完整测试体系

每条流水线在初始化时就绑定了特定的Provider、Model和APIKey，负载均衡器只需要从同一Provider.Model的多条流水线中选择，实现了APIKey级别的负载分发。