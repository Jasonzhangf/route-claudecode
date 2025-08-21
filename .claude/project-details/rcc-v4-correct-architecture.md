# RCC v4.0 正确架构设计文档

## 核心设计原则

### 🎯 架构理念
1. **初始化时创建所有流水线**: 服务器启动时根据routing table创建所有流水线
2. **一个Provider.Model一条流水线**: 每个Provider-Model组合对应一条独立流水线
3. **虚拟模型到目标模型映射**: Routing table做虚拟模型→目标模型的映射
4. **流水线选择，不是Provider选择**: 路由器选择流水线，不是Provider
5. **APIKey负载均衡**: 同一条流水线的多个APIKey之间做负载均衡
6. **握手连接**: 每条流水线在初始化时完成4层内部握手连接
7. **Runtime状态**: 初始化完成后，所有流水线处于活跃运行状态

## 系统启动流程

### 1. 服务器启动 (Server Start)
```typescript
async function startServer() {
  // Step 1: 加载配置
  const userConfig = loadUserConfig();
  const systemConfig = loadSystemConfig();
  const routingTable = buildRoutingTable(userConfig, systemConfig);
  
  // Step 2: 初始化Pipeline Manager
  const pipelineManager = new PipelineManager();
  await pipelineManager.initializeFromRoutingTable(routingTable);
  
  // Step 3: 创建路由器（基于已初始化的流水线）
  const pipelineRouter = new PipelineRouter(routingTable);
  
  // Step 4: 创建负载均衡器
  const loadBalancer = new LoadBalancer(pipelineManager);
  
  // Step 5: 启动Debug系统，记录所有"活着"的流水线
  const debugSystem = new PipelineDebugSystem(pipelineManager);
  debugSystem.recordLivePipelines();
  debugSystem.validateAgainstConfig(routingTable);
  
  // Step 6: 启动HTTP服务器
  const httpServer = new HttpServer(pipelineRouter, loadBalancer);
  await httpServer.start();
}
```

### 2. 流水线初始化 (Pipeline Initialization)
```typescript
async initializeFromRoutingTable(routingTable: RoutingTable) {
  const createdPipelines = new Set<string>();
  
  for (const [virtualModel, routes] of Object.entries(routingTable.routes)) {
    for (const route of routes) {
      const provider = systemConfig.providerTypes[route.provider];
      
      // 每个Provider.Model组合创建一条流水线
      const pipelineId = `${route.provider}-${route.targetModel}`;
      
      // 避免重复创建相同的Provider.Model流水线
      if (createdPipelines.has(pipelineId)) {
        continue;
      }
      
      // 创建完整的4层流水线
      const pipeline = await this.createCompletePipeline({
        pipelineId,
        provider: route.provider,
        targetModel: route.targetModel,
        apiKeys: route.apiKeys,  // 所有APIKey都属于这条流水线
        endpoint: provider.endpoint,
        transformer: provider.transformer,
        protocol: provider.protocol,
        serverCompatibility: provider.serverCompatibility
      });
      
      // 执行握手连接
      await pipeline.handshake();
      
      // 标记为runtime状态
      pipeline.status = 'runtime';
      
      this.pipelines.set(pipelineId, pipeline);
      createdPipelines.add(pipelineId);
    }
  }
}
```

## 请求处理流程

### 1. 请求到达 (Request Arrival)
```typescript
async handleRequest(inputModel: string, request: any) {
  // Step 1: 路由器选择可用流水线
  const routingDecision = pipelineRouter.route(inputModel);
  // 返回: { availablePipelines: ['lmstudio-default-0', 'lmstudio-default-1'] }
  
  // Step 2: 负载均衡器选择具体流水线
  const selectedPipelineId = loadBalancer.selectPipeline(routingDecision.availablePipelines);
  
  // Step 3: 获取流水线（已经runtime状态）
  const pipeline = pipelineManager.getPipeline(selectedPipelineId);
  if (!pipeline || pipeline.status !== 'runtime') {
    throw new Error(`Pipeline ${selectedPipelineId} not ready`);
  }
  
  // Step 4: 直接执行（无需组装，流水线已连接）
  const response = await pipeline.execute(request);
  
  return response;
}
```

### 2. 流水线执行 (Pipeline Execution)
```typescript
class CompletePipeline {
  async execute(request: any): Promise<any> {
    // 直接通过4层链路处理，无需运行时决策
    let data = request;
    
    // Layer 1: Transformer (已连接)
    data = await this.transformer.transform(data);
    
    // Layer 2: Protocol (已连接)
    data = await this.protocol.process(data);
    
    // Layer 3: Server Compatibility (已连接)  
    data = await this.serverCompatibility.adapt(data);
    
    // Layer 4: Server (已连接)
    const response = await this.server.execute(data);
    
    return response;
  }
}
```

## Routing Table结构

### 配置文件示例
```json
{
  "providers": {
    "lmstudio": {
      "apiKeys": ["key1", "key2"],
      "maxTokens": 4096
    }
  },
  "routing": {
    "rules": [
      {
        "name": "default",
        "provider": "lmstudio", 
        "model": "llama-3.1-8b"
      }
    ]
  }
}
```

### 转换后的Routing Table
```typescript
const routingTable: RoutingTable = {
  routes: {
    "default": [
      {
        routeId: "route-default-lmstudio-0",
        routeName: "default", 
        virtualModel: "default",
        provider: "lmstudio",
        apiKeyIndex: 0,
        pipelineId: "lmstudio-default-0",
        isActive: true,
        health: "healthy"
      },
      {
        routeId: "route-default-lmstudio-1", 
        routeName: "default",
        virtualModel: "default", 
        provider: "lmstudio",
        apiKeyIndex: 1,
        pipelineId: "lmstudio-default-1", 
        isActive: true,
        health: "healthy"
      }
    ]
  },
  defaultRoute: "default"
};
```

## Debug系统

### 初始化时Debug记录
```typescript
class PipelineDebugSystem {
  recordLivePipelines() {
    const livePipelines = this.pipelineManager.getPipelinesDebugInfo();
    
    console.log("📋 Live Pipelines Initialized:");
    livePipelines.forEach(pipeline => {
      console.log(`  ✅ ${pipeline.pipelineId}`);
      console.log(`     - Route: ${pipeline.routeInfo.virtualModel} -> ${pipeline.routeInfo.provider}`);  
      console.log(`     - Status: ${pipeline.status}`);
      console.log(`     - Layers: ${JSON.stringify(pipeline.layerStatus)}`);
    });
  }
  
  validateAgainstConfig(routingTable: RoutingTable) {
    const expectedPipelines = this.calculateExpectedPipelines(routingTable);
    const actualPipelines = this.pipelineManager.getAllPipelines();
    
    console.log("🔍 Pipeline Validation:");
    console.log(`  Expected: ${expectedPipelines.length} pipelines`);
    console.log(`  Actual: ${actualPipelines.size} pipelines`);
    
    const missing = expectedPipelines.filter(expected => 
      !actualPipelines.has(expected.pipelineId)
    );
    
    if (missing.length > 0) {
      console.error("❌ Missing Pipelines:", missing);
      throw new Error("Pipeline initialization validation failed");
    }
    
    console.log("✅ All expected pipelines are live and ready");
  }
}
```

## 负载均衡器

### 简单轮询负载均衡
```typescript
class LoadBalancer {
  private roundRobinCounters = new Map<string, number>();
  
  selectPipeline(availablePipelines: string[]): string {
    if (availablePipelines.length === 0) {
      throw new Error("No available pipelines");
    }
    
    if (availablePipelines.length === 1) {
      return availablePipelines[0];
    }
    
    // 轮询选择
    const routeKey = availablePipelines.sort().join(',');
    const currentIndex = this.roundRobinCounters.get(routeKey) || 0;
    const selectedPipeline = availablePipelines[currentIndex % availablePipelines.length];
    
    this.roundRobinCounters.set(routeKey, currentIndex + 1);
    return selectedPipeline;
  }
}
```

## 错误处理

### Zero Fallback Policy
```typescript
// ❌ 错误的fallback处理
try {
  return await primaryPipeline.execute(request);
} catch (error) {
  return await backupPipeline.execute(request); // 违反Zero Fallback
}

// ✅ 正确的Zero Fallback处理  
try {
  return await selectedPipeline.execute(request);
} catch (error) {
  // 立即抛出错误，不进行任何fallback
  throw new PipelineExecutionError(`Pipeline ${pipelineId} failed: ${error.message}`);
}
```

## 与现有实现的对比

### ❌ 当前错误实现
- 运行时选择Provider: `router.route() → selectProvider`
- 动态组装流水线: `transformer = getTransformer(provider.transformer)`  
- 运行时协议转换: `protocolLayer.process(request, routingDecision)`
- 复杂的fallback逻辑: `try primary catch backup`

### ✅ 正确的实现
- 初始化时创建流水线: `startServer() → initializeAllPipelines()`
- 路由选择流水线: `router.route() → availablePipelines[]`
- 直接执行流水线: `pipeline.execute(request)`
- Zero fallback: `throw error immediately`

## 总结

这个架构的核心优势：

1. **性能优异**: 初始化时完成所有准备工作，运行时零组装开销
2. **架构清晰**: 每条流水线是独立的、完整的处理单元
3. **易于调试**: 所有流水线状态在启动时可见，容易排查问题  
4. **负载均衡简单**: 只需要在已创建的流水线中选择
5. **零fallback**: 失败立即报错，不会产生意外的降级行为

负载均衡器只需要从已创建的流水线列表中选择，不需要关心Provider、Transformer、Protocol等细节，因为这些在初始化时就已经确定并连接好了。