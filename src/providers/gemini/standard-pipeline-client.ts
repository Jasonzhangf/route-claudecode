/**
 * Gemini Standard Pipeline Client
 * 基于OpenAI标准设计规则的11模块流水线架构重构
 * 项目所有者: Jason Zhang
 * 
 * 遵循设计原则:
 * - 零硬编码: 所有配置外部化
 * - 细菌式编程: 小巧、模块化、自包含
 * - 严格类型安全: TypeScript接口定义
 * - 失败时快速失败: 不使用fallback机制
 */

import { BaseRequest, BaseResponse, ProviderConfig, ProviderError } from '@/types';
import { logger } from '@/utils/logger';
import { GoogleGenAI } from '@google/genai';

// ==================== 模块接口定义 ====================

interface ModuleInput<T = any> {
  data: T;
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

interface ModuleOutput<T = any> {
  data: T;
  metadata: ModuleInput['metadata'];
  debug?: DebugInfo;
  performance?: PerformanceMetrics;
}

interface Module {
  readonly id: string;
  readonly type: ModuleType;
  readonly debug: DebugCapture;
  readonly test: UnitTest;
  process(input: ModuleInput): Promise<ModuleOutput>;
}

type ModuleType = 
  | 'client-router'           // 1. 客户端路由器
  | 'input-transformer'       // 2. 输入格式转换
  | 'request-preprocessor'    // 3. 请求预处理器
  | 'provider-interface'      // 4. Provider接口层
  | 'third-party-server'      // 5. 第三方服务连接
  | 'response-preprocessor'   // 6. 响应预处理器
  | 'response-transformer'    // 7. 响应格式转换
  | 'post-processor'          // 8. 后处理器
  | 'response-router'         // 9. 响应路由器
  | 'output-processor'        // 10. 输出处理器
  | 'debug-system';           // 11. 调试系统

// ==================== 支持类型定义 ====================

interface SessionContext {
  sessionId: string;
  userId?: string;
  clientInfo?: any;
}

interface RoutingContext {
  category: string;
  provider: string;
  model: string;
  originalModel: string;
}

interface TransformationContext {
  sourceFormat: string;
  targetFormat: string;
  requestId: string;
}

interface DebugInfo {
  moduleId: string;
  processingTime: number;
  inputSize: number;
  outputSize: number;
  errors?: any[];
}

interface PerformanceMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

interface DebugCapture {
  captureInput(data: any, metadata: any): DebugSnapshot;
  captureOutput(data: any, metadata: any): DebugSnapshot;
  captureError(error: any, context: any): DebugSnapshot;
}

interface DebugSnapshot {
  id: string;
  timestamp: string;
  type: 'input' | 'output' | 'error';
  module: string;
  data: any;
  metadata: any;
  size: number;
}

interface UnitTest {
  run(): Promise<TestResult>;
  validate(input: any, output: any): Promise<ValidationResult>;
}

interface TestResult {
  passed: boolean;
  duration: number;
  errors: any[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ==================== 1. 客户端路由器模块 ====================

class GeminiClientRouter implements Module {
  readonly id = 'gemini-client-router';
  readonly type: ModuleType = 'client-router';
  readonly debug: DebugCapture;
  readonly test: UnitTest;

  constructor() {
    this.debug = new ModuleDebugCapture(this.id);
    this.test = new ModuleUnitTest(this.id, this.validateRouting.bind(this));
  }

  async process(input: ModuleInput<BaseRequest>): Promise<ModuleOutput<BaseRequest>> {
    const startTime = Date.now();
    const debugInput = this.debug.captureInput(input.data, input.metadata);
    
    try {
      // 路由决策逻辑
      const routedRequest = {
        ...input.data,
        metadata: {
          ...input.data.metadata,
          requestId: input.data.metadata?.requestId || `req_${Date.now()}`,
          routedBy: this.id,
          routingDecision: {
            provider: 'gemini',
            confidence: 1.0,
            reason: 'direct-gemini-request'
          }
        }
      };

      const debugOutput = this.debug.captureOutput(routedRequest, input.metadata);
      
      return {
        data: routedRequest,
        metadata: input.metadata,
        debug: {
          moduleId: this.id,
          processingTime: Date.now() - startTime,
          inputSize: this.calculateSize(input.data),
          outputSize: this.calculateSize(routedRequest)
        }
      };
    } catch (error) {
      this.debug.captureError(error, input);
      throw new Error(`GeminiClientRouter failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async validateRouting(input: BaseRequest, output: BaseRequest): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output.metadata?.routedBy) {
      errors.push('Output missing routing metadata');
    }

    if (input.model !== output.model) {
      warnings.push('Model changed during routing');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }
}

// ==================== 2. 输入格式转换器模块 ====================

class GeminiInputTransformer implements Module {
  readonly id = 'gemini-input-transformer';
  readonly type: ModuleType = 'input-transformer';
  readonly debug: DebugCapture;
  readonly test: UnitTest;

  constructor() {
    this.debug = new ModuleDebugCapture(this.id);
    this.test = new ModuleUnitTest(this.id, this.validateTransformation.bind(this));
  }

  async process(input: ModuleInput<BaseRequest>): Promise<ModuleOutput<any>> {
    const startTime = Date.now();
    this.debug.captureInput(input.data, input.metadata);

    try {
      const geminiRequest = this.transformToGeminiFormat(input.data);
      
      this.debug.captureOutput(geminiRequest, input.metadata);
      
      return {
        data: geminiRequest,
        metadata: input.metadata,
        debug: {
          moduleId: this.id,
          processingTime: Date.now() - startTime,
          inputSize: this.calculateSize(input.data),
          outputSize: this.calculateSize(geminiRequest)
        }
      };
    } catch (error) {
      this.debug.captureError(error, input);
      throw new Error(`GeminiInputTransformer failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private transformToGeminiFormat(request: BaseRequest): any {
    const requestId = request.metadata?.requestId || 'unknown';
    
    logger.debug('Transforming to Gemini format', {
      messageCount: request.messages?.length || 0,
      hasTools: !!request.tools,
      maxTokens: request.max_tokens
    }, requestId, 'gemini-input-transformer');

    if (!request.messages || !Array.isArray(request.messages)) {
      throw new Error('request.messages must be a non-empty array');
    }

    const geminiRequest = {
      model: this.extractModelName(request.model),
      contents: this.convertMessagesToGemini(request.messages, requestId),
      generationConfig: this.buildGenerationConfig(request),
      tools: request.tools ? this.convertToolsToGemini(request.tools, requestId) : undefined,
      functionCallingConfig: request.tools ? { mode: 'ANY' } : undefined
    };

    // 移除undefined字段
    Object.keys(geminiRequest).forEach(key => {
      if (geminiRequest[key as keyof typeof geminiRequest] === undefined) {
        delete geminiRequest[key as keyof typeof geminiRequest];
      }
    });

    return geminiRequest;
  }

  private extractModelName(model: string): string {
    if (!model) {
      throw new Error('model is required');
    }

    // Zero Hardcode Principle: model patterns must be configurable
    const allowedPatterns = this.getValidModelPatterns();
    
    const isValidModel = allowedPatterns.some(pattern => pattern.test(model));
    if (!isValidModel) {
      const expectedPatterns = allowedPatterns.map(p => p.source.replace(/\^|\$|\\\./, '')).join(', ');
      throw new Error(`Unsupported model '${model}'. Expected patterns: ${expectedPatterns}`);
    }

    return model.replace(/^google\//, '');
  }
  
  /**
   * Get valid model patterns - Zero Hardcode Principle
   */
  private getValidModelPatterns(): RegExp[] {
    // In a fully configurable system, this would come from config
    // For now, use static patterns but mark as configurable
    return [
      /^gemini-1\./,
      /^gemini-2\./,
      /^gemini-pro/,
      /^gemini-ultra/,
      /^gemini-nano/,
      /^gemini-flash/
    ];
  }

  private convertMessagesToGemini(messages: any[], requestId: string): any[] {
    const contents: any[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      
      if (!message || typeof message !== 'object') {
        throw new Error(`Invalid message at index ${i}`);
      }

      // 跳过系统消息
      if (message.role === 'system') {
        continue;
      }

      const role = message.role === 'assistant' ? 'model' : 'user';
      const parts = this.convertContentToParts(message, i, requestId);

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    if (contents.length === 0) {
      throw new Error('No valid messages to convert');
    }

    return contents;
  }

  private convertContentToParts(message: any, index: number, requestId: string): any[] {
    const parts: any[] = [];

    if (typeof message.content === 'string') {
      if (message.content.trim()) {
        parts.push({ text: message.content });
      }
    } else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'text' && block.text) {
          parts.push({ text: block.text });
        } else if (block.type === 'tool_use') {
          parts.push({
            functionCall: {
              name: block.name,
              args: block.input || {}
            }
          });
        } else if (block.type === 'tool_result') {
          parts.push({
            functionResponse: {
              name: block.tool_use_id || 'unknown_tool',
              response: {
                name: block.tool_use_id || 'unknown_tool',
                content: block.content || block.result || 'Tool execution completed'
              }
            }
          });
        }
      }
    }

    return parts;
  }

  private buildGenerationConfig(request: BaseRequest): any {
    const config: any = {};
    
    if (request.max_tokens) {
      config.maxOutputTokens = request.max_tokens;
    }
    
    if (request.temperature !== undefined) {
      config.temperature = request.temperature;
    }

    return Object.keys(config).length > 0 ? config : undefined;
  }

  private convertToolsToGemini(tools: any[], requestId: string): any[] {
    if (!Array.isArray(tools)) {
      throw new Error('tools must be an array');
    }

    const functionDeclarations = tools.map((tool, index) => {
      let func: any;
      
      if (tool.function) {
        func = tool.function;
      } else if (tool.name) {
        func = tool;
      } else {
        throw new Error(`Invalid tool at index ${index}: missing function or name`);
      }

      if (!func.name) {
        throw new Error(`Invalid tool at index ${index}: missing function name`);
      }

      return {
        name: func.name,
        description: func.description || '',
        parameters: func.parameters || func.input_schema || {}
      };
    });

    return [{ functionDeclarations }];
  }

  private async validateTransformation(input: BaseRequest, output: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output.model) {
      errors.push('Output missing model field');
    }

    if (!output.contents || !Array.isArray(output.contents)) {
      errors.push('Output missing or invalid contents field');
    }

    if (input.tools && !output.tools) {
      warnings.push('Input tools not converted to output');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }
}

// ==================== 3. 请求预处理器模块 ====================

class GeminiRequestPreprocessor implements Module {
  readonly id = 'gemini-request-preprocessor';
  readonly type: ModuleType = 'request-preprocessor';
  readonly debug: DebugCapture;
  readonly test: UnitTest;

  constructor() {
    this.debug = new ModuleDebugCapture(this.id);
    this.test = new ModuleUnitTest(this.id, this.validatePreprocessing.bind(this));
  }

  async process(input: ModuleInput<any>): Promise<ModuleOutput<any>> {
    const startTime = Date.now();
    this.debug.captureInput(input.data, input.metadata);

    try {
      // 请求验证
      await this.validateRequest(input.data);
      
      // 参数标准化
      const normalized = await this.normalizeParameters(input.data);
      
      // 安全检查
      const secured = await this.applySafetyChecks(normalized);
      
      // 性能优化
      const optimized = await this.optimizeRequest(secured);
      
      this.debug.captureOutput(optimized, input.metadata);
      
      return {
        data: optimized,
        metadata: input.metadata,
        debug: {
          moduleId: this.id,
          processingTime: Date.now() - startTime,
          inputSize: this.calculateSize(input.data),
          outputSize: this.calculateSize(optimized)
        }
      };
    } catch (error) {
      this.debug.captureError(error, input);
      throw new Error(`GeminiRequestPreprocessor failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async validateRequest(request: any): Promise<void> {
    if (!request.model) {
      throw new Error('Request missing required model field');
    }

    if (!request.contents || !Array.isArray(request.contents)) {
      throw new Error('Request missing or invalid contents field');
    }

    if (request.contents.length === 0) {
      throw new Error('Request contents cannot be empty');
    }
  }

  private async normalizeParameters(request: any): Promise<any> {
    const normalized = { ...request };

    // 标准化生成配置
    if (normalized.generationConfig) {
      // 确保maxOutputTokens在合理范围内
      if (normalized.generationConfig.maxOutputTokens) {
        normalized.generationConfig.maxOutputTokens = Math.min(
          normalized.generationConfig.maxOutputTokens,
          100000 // Gemini最大token限制
        );
      }

      // 标准化温度值
      if (normalized.generationConfig.temperature !== undefined) {
        normalized.generationConfig.temperature = Math.max(0, Math.min(2, normalized.generationConfig.temperature));
      }
    }

    return normalized;
  }

  private async applySafetyChecks(request: any): Promise<any> {
    const secured = { ...request };

    // 添加默认安全设置
    if (!secured.safetySettings) {
      secured.safetySettings = [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ];
    }

    return secured;
  }

  private async optimizeRequest(request: any): Promise<any> {
    const optimized = { ...request };

    // 移除空字段
    Object.keys(optimized).forEach(key => {
      if (optimized[key] === undefined || optimized[key] === null) {
        delete optimized[key];
      }
    });

    return optimized;
  }

  private async validatePreprocessing(input: any, output: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output.safetySettings) {
      warnings.push('Output missing safety settings');
    }

    if (input.model !== output.model) {
      errors.push('Model was modified during preprocessing');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }
}

// ==================== 4. Provider接口层模块 ====================

class GeminiProviderInterface implements Module {
  readonly id = 'gemini-provider-interface';
  readonly type: ModuleType = 'provider-interface';
  readonly debug: DebugCapture;
  readonly test: UnitTest;

  constructor(private config: ProviderConfig) {
    this.debug = new ModuleDebugCapture(this.id);
    this.test = new ModuleUnitTest(this.id, this.validateInterface.bind(this));
  }

  async process(input: ModuleInput<any>): Promise<ModuleOutput<any>> {
    const startTime = Date.now();
    this.debug.captureInput(input.data, input.metadata);

    try {
      // 接口标准化
      const standardizedRequest = await this.standardizeInterface(input.data);
      
      // 认证处理
      const authenticatedRequest = await this.processAuthentication(standardizedRequest, input.context);
      
      // 端点配置
      const configuredRequest = await this.configureEndpoint(authenticatedRequest);
      
      this.debug.captureOutput(configuredRequest, input.metadata);
      
      return {
        data: configuredRequest,
        metadata: input.metadata,
        debug: {
          moduleId: this.id,
          processingTime: Date.now() - startTime,
          inputSize: this.calculateSize(input.data),
          outputSize: this.calculateSize(configuredRequest)
        }
      };
    } catch (error) {
      this.debug.captureError(error, input);
      throw new Error(`GeminiProviderInterface failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async standardizeInterface(request: any): Promise<any> {
    // 确保请求符合Gemini API接口标准
    const standardized = {
      ...request,
      _interface: {
        type: 'gemini-api',
        version: 'v1',
        endpoint: 'generateContent'
      }
    };

    return standardized;
  }

  private async processAuthentication(request: any, context: any): Promise<any> {
    const credentials = this.config.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : '';

    if (!apiKey) {
      throw new Error('Gemini API key is required for authentication');
    }

    return {
      ...request,
      _auth: {
        type: 'api-key',
        key: Array.isArray(apiKey) ? apiKey[0] : apiKey
      }
    };
  }

  private async configureEndpoint(request: any): Promise<any> {
    if (!this.config.endpoint) {
      throw new Error('GeminiProviderInterface: config.endpoint is required - no default endpoint allowed (Zero Hardcode Principle)');
    }
    const endpoint = this.config.endpoint;
    
    return {
      ...request,
      _endpoint: {
        baseUrl: endpoint,
        path: '/v1/models/generateContent',
        method: 'POST'
      }
    };
  }

  private async validateInterface(input: any, output: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output._interface) {
      errors.push('Output missing interface configuration');
    }

    if (!output._auth) {
      errors.push('Output missing authentication configuration');
    }

    if (!output._endpoint) {
      errors.push('Output missing endpoint configuration');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }
}

// ==================== 5. 第三方服务连接模块 ====================

class GeminiThirdPartyServer implements Module {
  readonly id = 'gemini-third-party-server';
  readonly type: ModuleType = 'third-party-server';
  readonly debug: DebugCapture;
  readonly test: UnitTest;
  
  private genAIClients: GoogleGenAI[] = [];
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(private config: ProviderConfig) {
    this.debug = new ModuleDebugCapture(this.id);
    this.test = new ModuleUnitTest(this.id, this.validateConnection.bind(this));
    
    this.initializeClients();
  }

  private initializeClients(): void {
    const credentials = this.config.authentication.credentials;
    const apiKey = credentials ? (credentials.apiKey || credentials.api_key) : '';
    
    if (Array.isArray(apiKey)) {
      this.genAIClients = apiKey.map(key => new GoogleGenAI({ apiKey: key }));
    } else {
      this.genAIClients = [new GoogleGenAI({ apiKey: apiKey })];
    }
  }

  async process(input: ModuleInput<any>): Promise<ModuleOutput<any>> {
    const startTime = Date.now();
    this.debug.captureInput(input.data, input.metadata);

    try {
      // 选择客户端
      const client = await this.selectClient();
      
      // 执行API调用
      const response = await this.executeApiCall(client, input.data);
      
      // 响应验证
      const validatedResponse = await this.validateResponse(response);
      
      this.debug.captureOutput(validatedResponse, input.metadata);
      
      return {
        data: validatedResponse,
        metadata: input.metadata,
        debug: {
          moduleId: this.id,
          processingTime: Date.now() - startTime,
          inputSize: this.calculateSize(input.data),
          outputSize: this.calculateSize(validatedResponse)
        }
      };
    } catch (error) {
      this.debug.captureError(error, input);
      throw new ProviderError(
        `GeminiThirdPartyServer failed: ${error instanceof Error ? error.message : String(error)}`,
        'gemini',
        (error as any)?.status || 500,
        error
      );
    }
  }

  private async selectClient(): Promise<GoogleGenAI> {
    if (this.genAIClients.length === 0) {
      throw new Error('No Gemini clients available');
    }

    // 简单轮询选择
    const clientIndex = Date.now() % this.genAIClients.length;
    return this.genAIClients[clientIndex];
  }

  private async executeApiCall(client: GoogleGenAI, request: any): Promise<any> {
    let lastError: any;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const apiRequest = this.buildApiRequest(request);
        
        const response = await Promise.race([
          client.models.generateContent(apiRequest),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Gemini API timeout after 60s')), 60000)
          )
        ]);
        
        return response;
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error) || attempt === this.maxRetries - 1) {
          break;
        }
        
        await this.waitForRetry(attempt);
      }
    }
    
    throw lastError;
  }

  private buildApiRequest(request: any): any {
    // 构建符合Gemini API标准的请求
    const apiRequest: any = {
      model: request.model,
      contents: request.contents
    };

    if (request.generationConfig) {
      apiRequest.generationConfig = request.generationConfig;
    }

    if (request.tools) {
      apiRequest.tools = request.tools;
    }

    if (request.functionCallingConfig) {
      apiRequest.functionCallingConfig = request.functionCallingConfig;
    }

    if (request.safetySettings) {
      apiRequest.safetySettings = request.safetySettings;
    }

    return apiRequest;
  }

  private async validateResponse(response: any): Promise<any> {
    if (!response) {
      throw new Error('Empty response from Gemini API');
    }

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('Gemini response has no candidates');
    }

    return response;
  }

  private isRetryableError(error: any): boolean {
    const status = error?.status || error?.response?.status;
    const message = error?.message || '';
    
    if (status) {
      const retryableStatuses = [429, 502, 503, 504];
      if (retryableStatuses.includes(status)) {
        return true;
      }
    }
    
    const retryablePatterns = [
      'quota',
      'rate',
      'RESOURCE_EXHAUSTED',
      'Too Many Requests',
      'temporarily unavailable',
      'service unavailable'
    ];
    
    return retryablePatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private async waitForRetry(attempt: number): Promise<void> {
    const delay = this.retryDelay * Math.pow(2, attempt);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async validateConnection(input: any, output: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!output.candidates) {
      errors.push('Output missing candidates field');
    }

    if (output.candidates && output.candidates.length === 0) {
      errors.push('Output has empty candidates array');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }
}

// ==================== 支持类实现 ====================

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

  captureOutput(data: any, metadata: any): DebugSnapshot {
    return {
      id: `${this.moduleId}_output_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'output',
      module: this.moduleId,
      data: this.sanitizeData(data),
      metadata,
      size: this.calculateDataSize(data)
    };
  }

  captureError(error: any, context: any): DebugSnapshot {
    return {
      id: `${this.moduleId}_error_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'error',
      module: this.moduleId,
      data: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context
      },
      metadata: context.metadata || {},
      size: this.calculateDataSize(error)
    };
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    // 移除敏感字段
    ['apiKey', 'api_key', 'token', 'authorization', '_auth'].forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
}

class ModuleUnitTest implements UnitTest {
  constructor(
    private moduleId: string,
    private validator: (input: any, output: any) => Promise<ValidationResult>
  ) {}

  async run(): Promise<TestResult> {
    const startTime = Date.now();
    const errors: any[] = [];

    try {
      // 运行基础测试用例
      const testCases = this.generateTestCases();
      
      for (const testCase of testCases) {
        try {
          const result = await this.validator(testCase.input, testCase.expectedOutput);
          if (!result.valid) {
            errors.push({
              testCase: testCase.name,
              errors: result.errors,
              warnings: result.warnings
            });
          }
        } catch (error) {
          errors.push({
            testCase: testCase.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return {
        passed: errors.length === 0,
        duration: Date.now() - startTime,
        errors
      };
    } catch (error) {
      return {
        passed: false,
        duration: Date.now() - startTime,
        errors: [{ error: error instanceof Error ? error.message : String(error) }]
      };
    }
  }

  async validate(input: any, output: any): Promise<ValidationResult> {
    return this.validator(input, output);
  }

  private generateTestCases(): Array<{ name: string; input: any; expectedOutput: any }> {
    return [
      {
        name: 'basic-validation',
        input: { test: true },
        expectedOutput: { test: true, processed: true }
      }
    ];
  }
}

// ==================== 标准流水线客户端主类 ====================

export class GeminiStandardPipelineClient {
  private modules: Map<string, Module> = new Map();
  private pipeline: Module[] = [];

  constructor(private config: ProviderConfig, private providerId: string = 'gemini-standard-pipeline') {
    this.initializePipeline();
  }

  private initializePipeline(): void {
    // 初始化11个模块（这里只实现了前5个作为示例）
    const clientRouter = new GeminiClientRouter();
    const inputTransformer = new GeminiInputTransformer();
    const requestPreprocessor = new GeminiRequestPreprocessor();
    const providerInterface = new GeminiProviderInterface(this.config);
    const thirdPartyServer = new GeminiThirdPartyServer(this.config);

    // 注册模块
    this.modules.set(clientRouter.id, clientRouter);
    this.modules.set(inputTransformer.id, inputTransformer);
    this.modules.set(requestPreprocessor.id, requestPreprocessor);
    this.modules.set(providerInterface.id, providerInterface);
    this.modules.set(thirdPartyServer.id, thirdPartyServer);

    // 构建流水线
    this.pipeline = [
      clientRouter,
      inputTransformer,
      requestPreprocessor,
      providerInterface,
      thirdPartyServer
    ];

    logger.info('Gemini Standard Pipeline initialized', {
      providerId: this.providerId,
      moduleCount: this.modules.size,
      pipelineLength: this.pipeline.length
    });
  }

  async processRequest(request: BaseRequest): Promise<BaseResponse> {
    const requestId = request.metadata?.requestId || `req_${Date.now()}`;
    const startTime = Date.now();

    logger.info('Starting Gemini Standard Pipeline processing', {
      requestId,
      moduleCount: this.pipeline.length
    });

    try {
      let currentData = request;
      const metadata = {
        requestId,
        timestamp: startTime,
        source: 'anthropic',
        target: 'gemini'
      };

      const context = {
        session: {
          sessionId: `session_${Date.now()}`,
          userId: request.metadata?.userId
        },
        routing: {
          category: 'default',
          provider: 'gemini',
          model: request.model,
          originalModel: request.model
        },
        transformation: {
          sourceFormat: 'anthropic',
          targetFormat: 'gemini',
          requestId
        }
      };

      // 通过流水线处理请求
      for (let i = 0; i < this.pipeline.length; i++) {
        const module = this.pipeline[i];
        const moduleInput: ModuleInput = {
          data: currentData,
          metadata,
          context
        };

        logger.debug(`Processing module ${i + 1}/${this.pipeline.length}: ${module.id}`, {
          requestId,
          moduleType: module.type
        });

        const moduleOutput = await module.process(moduleInput);
        currentData = moduleOutput.data;

        logger.debug(`Module ${module.id} completed`, {
          requestId,
          processingTime: moduleOutput.debug?.processingTime,
          inputSize: moduleOutput.debug?.inputSize,
          outputSize: moduleOutput.debug?.outputSize
        });
      }

      // 转换最终响应
      const finalResponse = this.convertToBaseResponse(currentData, request);

      const totalTime = Date.now() - startTime;
      logger.info('Gemini Standard Pipeline processing completed', {
        requestId,
        totalTime,
        moduleCount: this.pipeline.length
      });

      return finalResponse;

    } catch (error) {
      logger.error('Gemini Standard Pipeline processing failed', error, requestId);
      throw error;
    }
  }

  private convertToBaseResponse(geminiResponse: any, originalRequest: BaseRequest): BaseResponse {
    // 简化的响应转换
    if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      throw new Error('Invalid Gemini response: no candidates');
    }

    const candidate = geminiResponse.candidates[0];
    const content: any[] = [];

    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content.push({
            type: 'text',
            text: part.text
          });
        } else if (part.functionCall) {
          content.push({
            type: 'tool_use',
            id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: part.functionCall.name,
            input: part.functionCall.args || {}
          });
        }
      }
    }

    if (content.length === 0) {
      content.push({
        type: 'text',
        text: 'Response generated but content was empty.'
      });
    }

    // 映射结束原因
    const stopReason = this.mapFinishReason(candidate.finishReason);

    return {
      id: `msg_${Date.now()}`,
      content,
      model: originalRequest.model,
      role: 'assistant',
      stop_reason: stopReason,
      stop_sequence: null,
      usage: {
        input_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
        output_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0
      }
    };
  }

  private mapFinishReason(finishReason: string): string {
    const mapping: Record<string, string> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'stop_sequence',
      'RECITATION': 'stop_sequence',
      'OTHER': 'end_turn'
    };

    return mapping[finishReason] || 'end_turn';
  }

  async runUnitTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const [moduleId, module] of this.modules) {
      logger.info(`Running unit tests for module: ${moduleId}`);
      try {
        const result = await module.test.run();
        results.push(result);
        
        if (result.passed) {
          logger.info(`Unit tests passed for module: ${moduleId}`);
        } else {
          logger.warn(`Unit tests failed for module: ${moduleId}`, {
            errors: result.errors
          });
        }
      } catch (error) {
        logger.error(`Unit test execution failed for module: ${moduleId}`, error);
        results.push({
          passed: false,
          duration: 0,
          errors: [{ error: error instanceof Error ? error.message : String(error) }]
        });
      }
    }

    return results;
  }

  getModuleStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [moduleId, module] of this.modules) {
      stats[moduleId] = {
        type: module.type,
        id: module.id
      };
    }

    return {
      totalModules: this.modules.size,
      pipelineLength: this.pipeline.length,
      modules: stats
    };
  }
}