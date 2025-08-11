# OpenAI Pipeline Design Guidebook
**项目所有者**: Jason Zhang  
**版本**: v1.0.0  
**创建日期**: 2025-08-09  
**适用范围**: 所有Transformer和Provider设计指导  

## 📋 目录
1. [系统架构总览](#系统架构总览)
2. [标准流水线设计](#标准流水线设计)
3. [Transformer设计模式](#transformer设计模式)
4. [预处理和后处理架构](#预处理和后处理架构)
5. [错误处理机制](#错误处理机制)
6. [注册架构设计](#注册架构设计)
7. [日志捕获系统](#日志捕获系统)
8. [Finish Reason处理](#finish-reason处理)
9. [工具调用传递机制](#工具调用传递机制)
10. [性能优化策略](#性能优化策略)

---

## 🏗️ 系统架构总览

### 四层模块化架构
基于当前Claude Code Router v2.7.0实现，系统采用四层清晰分离的架构：

```
客户端请求 → 输入层 → 路由层 → 输出层 → 提供商层 → AI服务
     ↓         ↓        ↓        ↓         ↓
  Request  → Router → Engine → Client → Third-party
```

### 核心设计原则
1. **零硬编码**: 所有配置外部化，运行时动态加载
2. **细菌式编程**: 小巧、模块化、自包含的组件设计
3. **严格类型安全**: TypeScript接口定义和类型检查
4. **失败时快速失败**: 错误早发现、早处理，不使用fallback

---

## 🚀 标准流水线设计

### 11模块标准流水线架构

基于LM Studio实现的完整流水线包含以下11个核心模块：

```typescript
// 标准模块接口定义
interface Module {
  readonly id: string;
  readonly type: ModuleType;
  readonly debug: DebugCapture;
  readonly test: UnitTest;
  process(input: ModuleInput): Promise<ModuleOutput>;
}

// 11个核心模块类型
type ModuleType = 
  | 'client-router'           // 客户端路由器
  | 'input-transformer'       // 输入格式转换
  | 'request-preprocessor'    // 请求预处理器
  | 'provider-interface'      // Provider接口层
  | 'third-party-server'      // 第三方服务连接
  | 'response-preprocessor'   // 响应预处理器
  | 'response-transformer'    // 响应格式转换
  | 'post-processor'          // 后处理器
  | 'response-router'         // 响应路由器
  | 'output-processor'        // 输出处理器
  | 'debug-system';           // 调试系统
```

### 模块间数据流

```typescript
// 标准数据流定义
interface ModuleInput {
  data: any;
  metadata: {
    requestId: string;
    timestamp: number;
    source: string;
    target?: string;
  };
  context: {
    session: SessionContext;
    routing: RoutingContext;
    transformation: TransformationContext;
  };
}

interface ModuleOutput {
  data: any;
  metadata: ModuleInput['metadata'];
  debug?: DebugInfo;
  performance?: PerformanceMetrics;
}
```

### 动态模块注册机制

```typescript
// 模块注册器
class ModuleRegistry {
  private modules: Map<string, Module> = new Map();
  private dependencies: Map<string, string[]> = new Map();
  
  register(module: Module): void {
    this.modules.set(module.id, module);
    this.resolveAndValidateDependencies();
  }
  
  // 动态依赖解析
  private resolveAndValidateDependencies(): void {
    // 验证所有依赖都已注册
    // 检测循环依赖
    // 构建执行链
  }
}
```

---

## 🔄 Transformer设计模式

### 统一Transformer接口

```typescript
// 位置: src/transformers/types.ts
interface MessageTransformer {
  transformRequestToUnified(request: any): UnifiedRequest;
  transformRequestFromUnified(request: UnifiedRequest): any;
  transformResponseToUnified(response: any): UnifiedResponse;
  transformResponseFromUnified(response: UnifiedResponse): any;
}
```

### OpenAI Transformer实现

当前实现位于 `src/transformers/openai.ts`，核心特征：

```typescript
// OpenAI格式转换核心逻辑
export class OpenAITransformer implements MessageTransformer {
  transformRequestToUnified(request: OpenAIRequest): UnifiedRequest {
    return {
      messages: this.convertMessages(request.messages),
      system: this.extractSystem(request.messages),
      tools: this.convertTools(request.tools),
      metadata: {
        model: request.model,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        stream: request.stream
      }
    };
  }
  
  // 关键：工具调用格式转换
  private convertTools(tools?: any[]): UnifiedTool[] | undefined {
    if (!tools) return undefined;
    
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters  // OpenAI -> Anthropic
    }));
  }
}
```

### Transformer Manager架构

```typescript
// 位置: src/transformers/manager.ts
export class TransformationManager {
  private transformers: Map<string, MessageTransformer> = new Map();
  
  constructor() {
    // 自动注册所有transformer
    this.initializeTransformers();
  }
  
  transformRequest(request: any, context: TransformationContext): any {
    // 双向转换：Source -> Unified -> Target
    const sourceTransformer = this.transformers.get(context.sourceProvider);
    const targetTransformer = this.transformers.get(context.targetProvider);
    
    const unified = sourceTransformer.transformRequestToUnified(request);
    return targetTransformer.transformRequestFromUnified(unified);
  }
}
```

### 设计模式要点

1. **统一抽象层**: 所有格式都通过UnifiedRequest/Response进行转换
2. **双向转换**: 每个transformer支持To/From Unified的双向转换
3. **上下文传递**: TransformationContext提供转换所需的上下文信息
4. **类型安全**: 完整的TypeScript类型定义

---

## ⚙️ 预处理和后处理架构

### 请求预处理器设计

```typescript
// 请求预处理流水线
class RequestPreprocessor implements Module {
  async process(input: ModuleInput): Promise<ModuleOutput> {
    const request = input.data;
    
    // 1. 请求验证
    await this.validateRequest(request);
    
    // 2. 认证处理
    await this.processAuthentication(request, input.context);
    
    // 3. 参数标准化
    const normalized = await this.normalizeParameters(request);
    
    // 4. 工具格式转换
    const withTools = await this.processTools(normalized);
    
    // 5. 系统消息处理
    const final = await this.processSystemMessages(withTools);
    
    return {
      data: final,
      metadata: input.metadata,
      debug: this.captureDebugInfo(input, final)
    };
  }
  
  private async processTools(request: any): Promise<any> {
    if (!request.metadata?.tools) return request;
    
    // OpenAI工具格式转换
    const tools = request.metadata.tools.map((tool: any) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema  // Anthropic -> OpenAI
      }
    }));
    
    return { ...request, tools };
  }
}
```

### 响应后处理器设计

```typescript
class ResponsePostProcessor implements Module {
  async process(input: ModuleInput): Promise<ModuleOutput> {
    const response = input.data;
    
    // 1. 响应验证
    await this.validateResponse(response);
    
    // 2. 格式标准化
    const normalized = await this.normalizeResponse(response);
    
    // 3. 工具调用提取
    const withToolCalls = await this.extractToolCalls(normalized);
    
    // 4. finish_reason映射
    const mapped = await this.mapFinishReason(withToolCalls);
    
    // 5. 使用统计更新
    const final = await this.updateUsageStats(mapped);
    
    return {
      data: final,
      metadata: input.metadata,
      performance: this.capturePerformanceMetrics(input)
    };
  }
  
  private async extractToolCalls(response: any): Promise<any> {
    const choice = response.choices?.[0];
    if (!choice?.message?.content) return response;
    
    // LM Studio嵌入式工具调用提取
    const toolCallRegex = /<tool_call>\s*(\{.*?\})\s*<\/tool_call>/gs;
    const matches = [...choice.message.content.matchAll(toolCallRegex)];
    
    if (matches.length > 0) {
      const toolCalls = matches.map((match, index) => ({
        id: `call_${Date.now()}_${index}`,
        type: 'function',
        function: {
          name: JSON.parse(match[1]).name,
          arguments: JSON.stringify(JSON.parse(match[1]).parameters)
        }
      }));
      
      // 更新响应
      choice.message.tool_calls = toolCalls;
      choice.finish_reason = 'tool_calls';
      
      // 移除嵌入式工具调用文本
      choice.message.content = choice.message.content.replace(toolCallRegex, '').trim();
    }
    
    return response;
  }
}
```

---

## 🚨 错误处理机制

### MaxToken错误处理

```typescript
// 位置: src/utils/error-handler.ts
class MaxTokenErrorHandler {
  async handleMaxTokenError(
    error: any, 
    request: BaseRequest, 
    provider: string
  ): Promise<never> {
    
    const errorDetails = {
      provider,
      model: request.model,
      requestedTokens: request.max_tokens,
      messageCount: request.messages.length,
      estimatedInputTokens: this.calculateInputTokens(request)
    };
    
    // 严格错误处理 - 不使用fallback
    if (this.isMaxTokenError(error)) {
      throw new ProviderError(
        `Max tokens exceeded: ${errorDetails.requestedTokens}`,
        provider,
        400,
        errorDetails
      );
    }
    
    throw error;
  }
  
  private isMaxTokenError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('max') && message.includes('token') ||
      message.includes('context length') ||
      message.includes('maximum context') ||
      error.status === 400 && message.includes('token')
    );
  }
}
```

### 分层错误处理架构

```typescript
// 错误处理层次
interface ErrorHandlingLayer {
  level: 'module' | 'provider' | 'router' | 'global';
  handler: (error: any, context: any) => Promise<any>;
  recovery?: (error: any, context: any) => Promise<any>;
}

class ErrorHandlingSystem {
  private handlers: Map<string, ErrorHandlingLayer[]> = new Map();
  
  // 注册错误处理器
  register(errorType: string, layer: ErrorHandlingLayer): void {
    const existing = this.handlers.get(errorType) || [];
    existing.push(layer);
    this.handlers.set(errorType, existing.sort((a, b) => 
      this.getLayerPriority(a.level) - this.getLayerPriority(b.level)
    ));
  }
  
  // 错误处理执行
  async handle(error: any, context: any): Promise<never> {
    const errorType = this.classifyError(error);
    const handlers = this.handlers.get(errorType) || [];
    
    for (const handler of handlers) {
      try {
        await handler.handler(error, context);
      } catch (handlerError) {
        logger.error(`Error handler failed: ${handler.level}`, handlerError);
      }
    }
    
    throw error; // 最终总是抛出错误，不隐藏问题
  }
}
```

---

## 📝 注册架构设计

### Provider动态注册

```typescript
// 位置: src/providers/registry.ts
export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();
  private healthCheckers: Map<string, HealthChecker> = new Map();
  
  async register(
    providerId: string, 
    config: ProviderConfig,
    providerClass: new (config: ProviderConfig, id: string) => Provider
  ): Promise<void> {
    
    // 1. 配置验证
    await this.validateConfig(config, providerId);
    
    // 2. Provider实例化
    const provider = new providerClass(config, providerId);
    
    // 3. 健康检查
    const isHealthy = await provider.isHealthy();
    if (!isHealthy) {
      throw new Error(`Provider ${providerId} failed health check`);
    }
    
    // 4. 注册到系统
    this.providers.set(providerId, provider);
    
    // 5. 启动健康监控
    this.startHealthMonitoring(providerId, provider);
    
    logger.info(`Provider registered: ${providerId}`, {
      type: provider.type,
      healthy: isHealthy,
      config: this.sanitizeConfig(config)
    });
  }
  
  private startHealthMonitoring(providerId: string, provider: Provider): void {
    const checker = new HealthChecker(provider, {
      interval: 30000,  // 30秒检查间隔
      timeout: 10000,   // 10秒超时
      retries: 3        // 3次重试
    });
    
    checker.on('health-changed', (healthy: boolean) => {
      this.updateProviderHealth(providerId, healthy);
    });
    
    this.healthCheckers.set(providerId, checker);
    checker.start();
  }
}
```

### Transformer自动发现注册

```typescript
// Transformer自动注册机制
class TransformerAutoRegistry {
  private scanPath = path.join(__dirname, '../transformers');
  
  async autoRegister(manager: TransformationManager): Promise<void> {
    const files = await fs.readdir(this.scanPath);
    
    for (const file of files) {
      if (file.endsWith('.ts') && !file.includes('types') && !file.includes('manager')) {
        try {
          const module = await import(path.join(this.scanPath, file));
          
          // 查找transformer工厂函数
          const factoryName = `create${this.capitalize(path.basename(file, '.ts'))}Transformer`;
          const factory = module[factoryName];
          
          if (typeof factory === 'function') {
            const transformer = factory();
            const name = path.basename(file, '.ts');
            
            manager.registerTransformer(name, transformer);
            logger.info(`Auto-registered transformer: ${name}`);
          }
        } catch (error) {
          logger.warn(`Failed to auto-register transformer from ${file}:`, error);
        }
      }
    }
  }
}
```

---

## 📊 日志捕获系统

### 结构化日志设计

```typescript
// 位置: src/utils/logger.ts
interface LogEntry {
  timestamp: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata?: Record<string, any>;
  requestId?: string;
  component?: string;
  performance?: PerformanceMetrics;
}

class StructuredLogger {
  private outputs: LogOutput[] = [];
  
  // 上下文感知的日志记录
  trace(requestId: string, component: string, message: string, metadata?: any): void {
    this.log('trace', message, metadata, requestId, component);
  }
  
  // 性能日志专用方法
  performance(
    requestId: string,
    component: string,
    operation: string,
    metrics: PerformanceMetrics
  ): void {
    this.log('info', `Performance: ${operation}`, {
      ...metrics,
      operation
    }, requestId, component);
  }
  
  private log(
    level: LogEntry['level'],
    message: string,
    metadata?: any,
    requestId?: string,
    component?: string
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
      requestId,
      component
    };
    
    // 分发到所有输出
    this.outputs.forEach(output => output.write(entry));
  }
}
```

### Debug数据捕获

```typescript
// Debug系统架构
interface DebugCapture {
  captureInput(data: any, metadata: any): DebugSnapshot;
  captureOutput(data: any, metadata: any): DebugSnapshot;
  captureError(error: any, context: any): DebugSnapshot;
}

class ModuleDebugCapture implements DebugCapture {
  constructor(private moduleId: string) {}
  
  captureInput(data: any, metadata: any): DebugSnapshot {
    return {
      id: `${this.moduleId}_input_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'input',
      module: this.moduleId,
      data: this.sanitizeData(data),
      metadata,
      size: this.calculateDataSize(data)
    };
  }
  
  // 敏感数据脱敏
  private sanitizeData(data: any): any {
    if (typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    // 移除敏感字段
    ['apiKey', 'api_key', 'token', 'authorization'].forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}
```

### Replay系统

```typescript
// Debug重放系统
class DebugReplaySystem {
  private database: DebugDatabase = new DebugDatabase();
  
  async captureSnapshot(
    moduleId: string,
    requestId: string,
    data: any,
    type: 'input' | 'output' | 'error'
  ): Promise<string> {
    const snapshot = {
      id: `${requestId}_${moduleId}_${type}_${Date.now()}`,
      moduleId,
      requestId,
      type,
      data: this.serializeData(data),
      timestamp: new Date(),
      metadata: this.extractMetadata(data)
    };
    
    await this.database.save(snapshot);
    return snapshot.id;
  }
  
  async replay(snapshotId: string, targetModule: string): Promise<any> {
    const snapshot = await this.database.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    
    // 获取目标模块
    const module = ModuleRegistry.get(targetModule);
    if (!module) {
      throw new Error(`Module not found: ${targetModule}`);
    }
    
    // 重放输入数据
    const replayInput: ModuleInput = {
      data: this.deserializeData(snapshot.data),
      metadata: {
        ...snapshot.metadata,
        isReplay: true,
        originalSnapshotId: snapshotId
      }
    };
    
    return await module.process(replayInput);
  }
}
```

---

## 🎯 Finish Reason处理

### 严格映射系统

```typescript
// 位置: src/transformers/response-converter.ts
const STRICT_FINISH_REASON_MAPPING: Record<string, string> = {
  // OpenAI -> Anthropic 标准映射
  'stop': 'end_turn',
  'length': 'max_tokens', 
  'tool_calls': 'tool_use',
  'function_call': 'tool_use',
  'content_filter': 'stop_sequence',
  
  // 直接透传已转换的值 (LMStudio/ModelScope兼容)
  'end_turn': 'end_turn',
  'max_tokens': 'max_tokens',
  'tool_use': 'tool_use',
  'stop_sequence': 'stop_sequence',
};

export function mapFinishReasonStrict(finishReason?: string): string {
  if (!finishReason) {
    throw new Error('mapFinishReasonStrict: finishReason is required but was undefined/empty');
  }
  
  if (finishReason === 'unknown') {
    throw new Error(`mapFinishReasonStrict: received 'unknown' finish reason`);
  }
  
  const mappedReason = STRICT_FINISH_REASON_MAPPING[finishReason];
  if (!mappedReason) {
    throw new Error(`mapFinishReasonStrict: Unknown finish reason '${finishReason}'`);
  }
  
  return mappedReason;
}
```

### Provider特定处理

```typescript
// 不同Provider的finish_reason处理差异
class FinishReasonHandler {
  private providerMappings: Map<string, Record<string, string>> = new Map();
  
  constructor() {
    // ModelScope特殊映射
    this.providerMappings.set('modelscope', {
      'end_turn': 'end_turn',    // ModelScope直接返回
      'tool_use': 'tool_use',    // ModelScope直接返回
      'stop': 'end_turn',
      'tool_calls': 'tool_use'
    });
    
    // LM Studio特殊映射
    this.providerMappings.set('lmstudio', {
      'stop': 'end_turn',
      'tool_calls': 'tool_use',  // 工具调用解析后设置
      'length': 'max_tokens'
    });
  }
  
  mapForProvider(
    finishReason: string, 
    providerId: string, 
    context: any
  ): string {
    const providerMapping = this.providerMappings.get(providerId);
    
    if (providerMapping && providerMapping[finishReason]) {
      return providerMapping[finishReason];
    }
    
    // fallback到标准映射
    return mapFinishReasonStrict(finishReason);
  }
}
```

---

## 🔧 工具调用传递机制

### 双向工具格式转换

```typescript
// Anthropic -> OpenAI 工具转换
function convertAnthropicToolsToOpenAI(tools: AnthropicTool[]): OpenAITool[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema  // 关键：schema字段映射
    }
  }));
}

// OpenAI -> Anthropic 工具调用转换
function convertOpenAIToolCallsToAnthropic(
  toolCalls: OpenAIToolCall[]
): AnthropicToolUse[] {
  return toolCalls.map(toolCall => {
    let parsedInput = {};
    try {
      parsedInput = JSON.parse(toolCall.function.arguments);
    } catch (error) {
      logger.warn('Failed to parse tool call arguments', {
        toolName: toolCall.function.name,
        arguments: toolCall.function.arguments,
        error: error.message
      });
      parsedInput = { arguments: toolCall.function.arguments };
    }
    
    // 标准化工具ID格式
    let toolId = toolCall.id;
    if (!toolId || !toolId.startsWith('toolu_')) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 8);
      toolId = `toolu_${timestamp}_${random}`;
    }
    
    return {
      type: 'tool_use',
      id: toolId,
      name: toolCall.function.name,
      input: parsedInput
    };
  });
}
```

### LM Studio嵌入式工具调用

```typescript
// LM Studio特殊工具调用解析
class LMStudioToolCallParser {
  private toolCallRegex = /<tool_call>\s*(\{.*?\})\s*<\/tool_call>/gs;
  
  async parseResponse(response: any): Promise<ParseResult> {
    const choice = response.choices?.[0];
    if (!choice?.message?.content) {
      return { success: false, toolCalls: [], confidence: 0 };
    }
    
    const matches = [...choice.message.content.matchAll(this.toolCallRegex)];
    
    if (matches.length === 0) {
      return { success: false, toolCalls: [], confidence: 0 };
    }
    
    const toolCalls: ToolCall[] = [];
    let parseErrors = 0;
    
    for (const [index, match] of matches.entries()) {
      try {
        const toolData = JSON.parse(match[1]);
        
        toolCalls.push({
          id: `call_${Date.now()}_${index}`,
          type: 'function',
          function: {
            name: toolData.name || toolData.function,
            arguments: JSON.stringify(toolData.parameters || toolData.arguments || {})
          }
        });
      } catch (error) {
        parseErrors++;
        logger.warn('Failed to parse embedded tool call', { 
          match: match[1], 
          error: error.message 
        });
      }
    }
    
    // 计算解析信心度
    const confidence = matches.length > 0 ? 
      (matches.length - parseErrors) / matches.length : 0;
    
    // 移除原文本中的工具调用标记
    const remainingContent = choice.message.content
      .replace(this.toolCallRegex, '')
      .trim();
    
    return {
      success: toolCalls.length > 0,
      toolCalls,
      confidence,
      parseMethod: 'embedded_xml_tags',
      remainingContent
    };
  }
}
```

### 工具调用状态管理

```typescript
// 工具调用生命周期管理
class ToolCallStateManager {
  private activeToolCalls: Map<string, ToolCallState> = new Map();
  
  startToolCall(requestId: string, toolCall: any): string {
    const callId = this.generateCallId(requestId, toolCall);
    
    const state: ToolCallState = {
      id: callId,
      requestId,
      toolName: toolCall.function?.name || toolCall.name,
      status: 'initiated',
      startTime: new Date(),
      input: toolCall.function?.arguments || toolCall.input,
      provider: this.extractProvider(requestId)
    };
    
    this.activeToolCalls.set(callId, state);
    
    logger.debug('Tool call initiated', {
      callId,
      toolName: state.toolName,
      provider: state.provider
    });
    
    return callId;
  }
  
  completeToolCall(callId: string, result: any, error?: any): void {
    const state = this.activeToolCalls.get(callId);
    if (!state) return;
    
    state.status = error ? 'failed' : 'completed';
    state.endTime = new Date();
    state.result = result;
    state.error = error;
    state.duration = state.endTime.getTime() - state.startTime.getTime();
    
    logger.debug('Tool call completed', {
      callId,
      status: state.status,
      duration: `${state.duration}ms`,
      toolName: state.toolName
    });
    
    // 清理完成的调用 (保留24小时用于调试)
    setTimeout(() => {
      this.activeToolCalls.delete(callId);
    }, 24 * 60 * 60 * 1000);
  }
}
```

---

## ⚡ 性能优化策略

### 并发处理架构

```typescript
// 请求并发控制
class ConcurrencyManager {
  private maxConcurrent: number = 100;
  private activeRequests: Set<string> = new Set();
  private requestQueue: QueueItem[] = [];
  
  async processRequest<T>(
    requestId: string,
    processor: () => Promise<T>
  ): Promise<T> {
    
    // 并发限制检查
    if (this.activeRequests.size >= this.maxConcurrent) {
      await this.enqueueRequest(requestId);
    }
    
    this.activeRequests.add(requestId);
    
    try {
      const startTime = Date.now();
      const result = await processor();
      const duration = Date.now() - startTime;
      
      this.recordPerformance(requestId, duration);
      return result;
      
    } finally {
      this.activeRequests.delete(requestId);
      this.processQueue();
    }
  }
  
  private recordPerformance(requestId: string, duration: number): void {
    responseStatsManager.recordLatency(requestId, duration);
    
    // 性能警告
    if (duration > 30000) { // 30秒
      logger.warn(`Slow request detected: ${requestId}`, {
        duration: `${duration}ms`,
        threshold: '30000ms'
      });
    }
  }
}
```

### 内存管理优化

```typescript
// 智能缓存管理
class SmartCacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 1000;
  private ttlMs: number = 5 * 60 * 1000; // 5分钟
  
  set(key: string, value: any, ttl?: number): void {
    // 空间管理
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.ttlMs,
      accessCount: 0
    });
  }
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // TTL检查
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    return entry.value;
  }
  
  private evictOldest(): void {
    // LRU淘汰策略
    let oldestKey: string | null = null;
    let oldestTime: number = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const accessTime = entry.lastAccess || entry.timestamp;
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}
```

### 流式处理优化

```typescript
// 高效流式处理
class OptimizedStreamProcessor {
  async *processStream(
    stream: AsyncIterable<any>,
    transformer: StreamTransformer
  ): AsyncIterable<any> {
    
    const buffer: StreamChunk[] = [];
    const batchSize = 10;
    
    try {
      for await (const chunk of stream) {
        buffer.push(chunk);
        
        // 批处理优化
        if (buffer.length >= batchSize) {
          const processed = await transformer.processBatch(buffer);
          for (const item of processed) {
            yield item;
          }
          buffer.length = 0; // 清空缓冲区
        }
      }
      
      // 处理剩余数据
      if (buffer.length > 0) {
        const processed = await transformer.processBatch(buffer);
        for (const item of processed) {
          yield item;
        }
      }
      
    } catch (error) {
      logger.error('Stream processing failed', error);
      throw error;
    }
  }
}
```

---

## 📝 设计指导原则总结

### 1. 架构设计原则
- **单一职责**: 每个模块负责一个明确的功能
- **依赖注入**: 通过接口注入依赖，便于测试和替换
- **配置外部化**: 所有配置参数外部管理，支持运行时更新
- **类型安全**: 完整的TypeScript类型定义，编译时错误检查

### 2. 错误处理原则
- **快速失败**: 遇到错误立即失败，不使用fallback隐藏问题
- **分层处理**: 不同层次的错误使用相应的处理策略
- **完整记录**: 所有错误都要记录完整的上下文信息
- **可恢复性**: 临时错误支持重试，永久错误支持降级

### 3. 性能优化原则
- **并发控制**: 合理的并发限制避免系统过载
- **资源管理**: 智能缓存和内存管理策略
- **批处理**: 小数据批量处理提高效率
- **监控跟踪**: 完整的性能指标收集和分析

### 4. 可维护性原则
- **模块化**: 功能模块可以独立开发和测试
- **可扩展**: 新功能可以通过插件方式添加
- **可观察**: 完整的日志、监控和调试支持
- **文档完整**: 每个模块都有清晰的接口文档

---

**文档版本**: v1.0.0  
**最后更新**: 2025-08-09  
**维护者**: Jason Zhang  

本文档为Claude Code Router项目的所有Transformer和Provider开发提供标准化指导。遵循本指导原则可以确保新组件与现有系统的完美集成。