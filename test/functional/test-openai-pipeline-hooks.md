# OpenAI流水线Hook系统测试

## 测试用例
非侵入式OpenAI流水线数据拦截和捕获中间件系统

## 测试目标
1. **非侵入式Hook**: 在不修改现有代码的情况下捕获流水线数据
2. **实时数据拦截**: 在运行时拦截和记录关键节点数据
3. **灵活Hook注册**: 支持自定义Hook函数的动态注册
4. **完整集成指南**: 提供现有系统的快速集成方案

## 最近执行记录

### 2025-07-30 17:42:15 - Hook系统架构设计 ✅ SUCCESS
- **执行时长**: 架构设计阶段  
- **状态**: Hook系统核心架构完成
- **日志文件**: 与数据捕获系统共享 `/tmp/openai-pipeline-captures/`
- **发现要点**:
  - ✅ 非侵入式包装器设计，不破坏现有代码结构
  - ✅ 支持路由引擎和Provider的透明Hook
  - ✅ HTTP请求/响应拦截器自动捕获API交互
  - ✅ 自定义Hook注册机制，支持扩展分析逻辑
  - ✅ 完整的集成指南和演示代码

## 核心架构组件

### 1. Hook管理器 (OpenAIPipelineHookManager)
- **Hook注册**: 支持6个步骤的自定义Hook函数注册
- **启用/禁用**: 动态控制Hook系统的开关状态
- **数据传递**: 在Hook之间安全传递捕获的数据
- **错误处理**: Hook执行失败时的优雅降级

### 2. 包装器系统
- **路由引擎包装器**: 透明包装RoutingEngine，自动捕获Step 1和Step 2
- **OpenAI Provider包装器**: 包装EnhancedOpenAIClient，捕获Step 3和Step 6
- **流式处理支持**: 特殊处理流式响应的数据重构

### 3. HTTP拦截器
- **请求拦截**: 捕获发送给OpenAI API的原始请求
- **响应拦截**: 自动捕获Step 4和Step 5的数据
- **错误拦截**: 记录和分析HTTP请求错误

## 集成方式

### 基础集成模式
```javascript
// 1. 创建Hook管理器
const hookManager = new OpenAIPipelineHookManager();
await hookManager.enable();

// 2. 包装现有组件
const HookedRoutingEngine = hookManager.createRoutingEngineWrapper(RoutingEngine);
const HookedProvider = hookManager.createOpenAIProviderWrapper(EnhancedOpenAIClient);

// 3. 使用包装后的组件
const routingEngine = new HookedRoutingEngine(config);
const provider = new HookedProvider(config, providerId);
```

### HTTP拦截器集成
```javascript
const interceptor = hookManager.createHttpInterceptor();

// Axios配置
axiosInstance.interceptors.request.use(interceptor.request);
axiosInstance.interceptors.response.use(interceptor.response, interceptor.error);
```

### 自定义Hook注册
```javascript
// 注册分析Hook
hookManager.registerHook('step4', async (data) => {
  console.log('Raw API response analysis:', data.rawResponse);
});

hookManager.registerHook('step6', async (data) => {
  console.log('Final response validation:', data.response);
});
```

## Hook触发时机

### Step 1: Input Processing
- **触发点**: RoutingEngine.route() 方法开始
- **捕获数据**: 原始Anthropic请求、token计算、工具信息
- **用途**: 输入验证、请求分析、性能监控

### Step 2: Routing Decision  
- **触发点**: RoutingEngine.route() 方法完成
- **捕获数据**: 路由类别、选择的Provider、模型映射
- **用途**: 路由决策分析、负载均衡监控

### Step 3: Transformation
- **触发点**: Provider.sendRequest() 或 sendStreamRequest() 开始
- **捕获数据**: Anthropic→OpenAI格式转换前后对比
- **用途**: 格式转换验证、数据完整性检查

### Step 4: Raw API Response
- **触发点**: HTTP响应拦截器
- **捕获数据**: OpenAI API原始响应数据
- **用途**: API响应分析、错误诊断

### Step 5: Transformer Input
- **触发点**: HTTP响应拦截器（与Step 4同时）
- **捕获数据**: 转换器接收到的数据
- **用途**: 转换器输入验证、数据传递检查

### Step 6: Transformer Output
- **触发点**: Provider方法返回前
- **捕获数据**: 最终Anthropic格式响应
- **用途**: 输出质量验证、内容完整性检查

## 使用场景

### 1. 开发调试
```javascript
// 注册调试Hook
hookManager.registerHook('step3', async (data) => {
  console.log('🔍 Transformation Debug:', {
    original: data.anthropicRequest.model,
    target: data.openaiRequest.model,
    tools: data.anthropicRequest.tools?.length || 0
  });
});
```

### 2. 性能监控
```javascript
const startTimes = new Map();

hookManager.registerHook('step1', async (data) => {
  startTimes.set(data.requestId, Date.now());
});

hookManager.registerHook('step6', async (data) => {
  const duration = Date.now() - startTimes.get(data.requestId);
  console.log(`⏱️ Request duration: ${duration}ms`);
});
```

### 3. 质量保证
```javascript
hookManager.registerHook('step6', async (data) => {
  const response = data.response;
  if (!response.content || response.content.length === 0) {
    console.warn('⚠️ Empty response detected');
  }
});
```

### 4. 错误分析
```javascript
hookManager.registerHook('error', async (data) => {
  const error = data.error;
  console.error('🚨 Pipeline error:', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
});
```

## 输出数据格式

### Hook数据结构
每个Hook接收的数据根据步骤不同而变化：

- **Step 1**: `{ request, requestId }`
- **Step 2**: `{ routingResult, requestId }`  
- **Step 3**: `{ anthropicRequest, openaiRequest }`
- **Step 4**: `{ rawResponse }`
- **Step 5**: `{ transformerInput }`
- **Step 6**: `{ response, events? }`

### 报告格式
```json
{
  "enabled": true,
  "hookCount": 6,
  "registeredSteps": ["step1", "step2", "step3", "step4", "step5", "step6"],
  "captureSystemReady": true,
  "sessionId": "capture-1753512345678"
}
```

## 性能影响
- **内存开销**: 轻量级包装器，最小内存占用
- **执行延迟**: Hook异步执行，不阻塞主流程
- **错误隔离**: Hook执行失败不影响主要功能

## 下一步计划
1. **真实环境测试**: 在实际API调用中验证Hook系统
2. **回放验证系统**: 基于捕获数据实现调试回放
3. **智能分析Hook**: 扩展自动化问题检测能力
4. **性能优化**: Hook执行的性能优化和资源管理

## 相关文件
- **Hook系统**: `/test/functional/test-openai-pipeline-hooks.js`
- **数据捕获系统**: `/test/functional/test-openai-pipeline-data-capture.js`
- **使用文档**: 本文件
- **输出目录**: `/tmp/openai-pipeline-captures/`