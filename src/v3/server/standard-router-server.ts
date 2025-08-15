/**
 * 标准化路由服务器 v3.1.0
 * 
 * 使用标准化配置格式和动态流水线管理
 * 完全分离Provider List和Routing Table
 * 
 * @author Jason Zhang
 * @version v3.1.0
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  StandardRouterConfig, 
  StandardConfigValidator,
  ConfigurationMigrator,
  RoutingCategory 
} from '../config/standard-config-schema.js';
import { WorkerManager, WorkerPoolConfig } from '../pipeline/worker-manager.js';
import { UnifiedInputProcessor } from '../client/unified-processor.js';
import { AnthropicOutputProcessor } from '../post-processor/anthropic.js';
import { getLogger, setDefaultPort } from '../logging/index.js';
import { handleUnifiedError } from '../utils/error-handler.js';
import { v4 as uuidv4 } from 'uuid';
import { BaseRequest } from '../types/index.js';

/**
 * 动态路由引擎 v3.1.0
 */
export class DynamicRoutingEngine {
  private routingTable: StandardRouterConfig['routing'];
  private stats = new Map<string, any>();
  
  constructor(config: StandardRouterConfig) {
    this.routingTable = config.routing;
  }
  
  /**
   * 路由请求到合适的流水线
   */
  public route(request: BaseRequest, requestId: string): { providerId: string; model: string; category: RoutingCategory } {
    // 1. 确定路由类别
    const category = this.determineCategory(request);
    
    // 2. 获取类别路由配置
    const categoryConfig = this.routingTable.categories[category];
    if (!categoryConfig) {
      throw new Error(`No routing configuration found for category: ${category}`);
    }
    
    // 3. 选择Provider和Model
    const target = this.selectTarget(categoryConfig, requestId);
    
    // 4. 更新请求元数据
    request.metadata = {
      ...request.metadata,
      routingCategory: category,
      originalModel: request.model,
      targetProvider: target.providerId,
      targetModel: target.model
    };
    
    // 5. 记录路由统计
    this.recordRoutingStats(category, target.providerId, target.model);
    
    return {
      providerId: target.providerId,
      model: target.model,
      category
    };
  }
  
  /**
   * 确定路由类别
   */
  private determineCategory(request: BaseRequest): RoutingCategory {
    // 1. 检查请求中是否明确指定类别
    if (request.metadata?.category) {
      return request.metadata.category as RoutingCategory;
    }
    
    // 2. 检查消息长度是否为长上下文 (50k字符阈值)
    if (request.messages && Array.isArray(request.messages)) {
      const totalLength = request.messages.reduce((sum, msg) => {
        return sum + (msg.content?.length || 0);
      }, 0);
      
      if (totalLength > 50000) { // 50k characters
        return 'longcontext';
      }
    }
    
    // 3. 检查工具使用 - 表示default类别
    if (request.tools && Array.isArray(request.tools) && request.tools.length > 0) {
      return 'default';
    }
    
    // 4. 检查搜索相关关键词
    if (request.messages && Array.isArray(request.messages)) {
      const hasSearchKeywords = request.messages.some((msg) => {
        const content = typeof msg.content === 'string' ? msg.content.toLowerCase() : '';
        return content.includes('search') || content.includes('find') || content.includes('lookup');
      });
      
      if (hasSearchKeywords) {
        return 'search';
      }
    }
    
    // 5. 检查背景处理指示器
    if (request.stream === false && !request.tools) {
      return 'background';
    }
    
    // 6. 检查明确的思考模式
    if (request.metadata?.thinking) {
      return 'thinking';
    }
    
    // 7. 默认类别
    return 'default';
  }
  
  /**
   * 选择路由目标
   */
  private selectTarget(categoryConfig: any, requestId: string): { providerId: string; model: string } {
    // 处理标准v3.1.0格式 (有primary字段) 和传统格式 (直接provider/model字段)
    if (categoryConfig.primary) {
      // 标准v3.1.0格式
      return {
        providerId: categoryConfig.primary.provider,
        model: categoryConfig.primary.model
      };
    } else {
      // 传统格式兼容
      return {
        providerId: categoryConfig.provider,
        model: categoryConfig.model
      };
    }
  }
  
  /**
   * 记录路由统计
   */
  private recordRoutingStats(category: string, providerId: string, model: string): void {
    const key = `${category}:${providerId}:${model}`;
    const current = this.stats.get(key) || { count: 0, lastUsed: null };
    
    this.stats.set(key, {
      count: current.count + 1,
      lastUsed: new Date().toISOString()
    });
  }
  
  /**
   * 获取路由统计
   */
  public getStats(): any {
    const result: any = {};
    for (const [key, stats] of this.stats) {
      result[key] = stats;
    }
    return result;
  }
}

/**
 * 标准化路由服务器
 */
export class StandardRouterServer {
  private fastify: FastifyInstance;
  private config: StandardRouterConfig;
  private workerManager: WorkerManager;
  private routingEngine: DynamicRoutingEngine;
  private inputProcessor: UnifiedInputProcessor;
  private outputProcessor: AnthropicOutputProcessor;
  private logger: any;
  
  constructor(config: any) {
    // 验证和标准化配置
    this.config = this.validateAndMigrateConfig(config);
    
    // 初始化日志系统
    setDefaultPort(this.config.server.port);
    this.logger = getLogger(this.config.server.port);
    
    // 初始化Fastify
    this.fastify = Fastify({
      logger: this.config.debug.enabled ? {
        level: this.config.debug.logLevel
      } : false
    });
    
    // 初始化组件
    this.workerManager = new WorkerManager('round-robin');
    this.routingEngine = new DynamicRoutingEngine(this.config);
    this.inputProcessor = new UnifiedInputProcessor();
    this.outputProcessor = new AnthropicOutputProcessor(this.config.server.port);
    
    // 设置路由
    this.setupRoutes();
  }
  
  /**
   * 验证和迁移配置
   */
  private validateAndMigrateConfig(config: any): StandardRouterConfig {
    try {
      // 检查配置版本
      if (!config.configVersion || config.configVersion.startsWith('v3.0')) {
        this.logger?.info('Migrating configuration from v3.0.x to v3.1.0');
        return ConfigurationMigrator.migrateFromV3_0(config);
      } else if (config.configVersion === 'v3.1.0') {
        return StandardConfigValidator.validate(config);
      } else {
        throw new Error(`Unsupported configuration version: ${config.configVersion}`);
      }
    } catch (error) {
      this.logger?.error('Configuration validation failed', error);
      throw error;
    }
  }
  
  /**
   * 设置HTTP路由
   */
  private setupRoutes(): void {
    // 健康检查端点
    this.fastify.get('/health', async (request, reply) => {
      try {
        const workerMetrics = this.workerManager.getMetrics();
        const allWorkers = this.workerManager.getAllWorkers();
        const healthyWorkers = allWorkers.filter(worker => worker.isHealthy()).length;
        const totalWorkers = allWorkers.length;
        
        const overall = healthyWorkers === totalWorkers ? 'healthy' : 
                       healthyWorkers > 0 ? 'degraded' : 'unhealthy';
        
        const healthStatus = {
          overall,
          workers: {
            total: totalWorkers,
            healthy: healthyWorkers,
            processing: workerMetrics.processingWorkers
          },
          metrics: workerMetrics,
          timestamp: new Date().toISOString()
        };
        
        this.logger.debug('Health check requested', {
          status: overall,
          healthyWorkers,
          totalWorkers
        });
        
        if (overall === 'healthy') {
          reply.code(200).send(healthStatus);
        } else {
          reply.code(503).send(healthStatus);
        }
        
      } catch (error) {
        this.logger.error('Health check failed', error);
        reply.code(500).send({
          error: 'Health check failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
    
    // 状态端点
    this.fastify.get('/status', async (request, reply) => {
      const routingStats = this.routingEngine.getStats();
      const workerMetrics = this.workerManager.getMetrics();
      
      reply.send({
        server: 'claude-code-router-v3.1',
        version: '3.1.0',
        architecture: 'worker-pipeline',
        uptime: process.uptime(),
        config: {
          configVersion: this.config.configVersion,
          providersCount: Object.keys(this.config.providers).length,
          categoriesCount: Object.keys(this.config.routing.categories).length,
          workersCount: workerMetrics.totalWorkers
        },
        routing: routingStats,
        workers: workerMetrics,
        timestamp: new Date().toISOString()
      });
    });
    
    // 配置端点
    this.fastify.get('/config', async (request, reply) => {
      // 返回不包含敏感信息的配置
      const safeConfig = {
        configVersion: this.config.configVersion,
        architecture: this.config.architecture,
        server: this.config.server,
        providers: Object.fromEntries(
          Object.entries(this.config.providers).map(([id, provider]) => [
            id,
            {
              type: provider.type,
              endpoint: provider.endpoint,
              models: provider.models,
              maxTokens: provider.maxTokens,
              healthCheck: provider.healthCheck,
              description: provider.description
            }
          ])
        ),
        routing: this.config.routing,
        metadata: this.config.metadata
      };
      
      reply.send(safeConfig);
    });
    
    // 主要消息端点 (Anthropic API兼容)
    this.fastify.post('/v1/messages', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleMessagesRequest(request, reply);
    });
    
    this.fastify.post('/v1/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleMessagesRequest(request, reply);
    });
  }
  
  /**
   * 处理消息请求
   */
  private async handleMessagesRequest(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const requestId = uuidv4();
    const startTime = Date.now();
    let baseRequest: any = null;
    let routingResult: any = null;
    
    try {
      this.logger.info('Processing request through dynamic pipeline system', { requestId });
      
      // Step 1: 处理输入
      if (!this.inputProcessor.canProcess(request.body)) {
        return reply.code(400).send({
          error: {
            type: 'invalid_request_error',
            message: 'Request format not supported'
          }
        });
      }
      
      baseRequest = await this.inputProcessor.process(request.body);
      baseRequest.metadata = { ...baseRequest.metadata, requestId };
      
      this.logger.debug('Input processed', { requestId, originalModel: baseRequest.model });
      
      // Step 2: 路由请求
      routingResult = this.routingEngine.route(baseRequest, requestId);
      
      this.logger.info('Request routed', {
        requestId,
        category: routingResult.category,
        providerId: routingResult.providerId,
        model: routingResult.model,
        originalModel: baseRequest.model
      });
      
      // Step 3: 发送到Worker输入流水线 (Anthropic → Provider)
      const workerInputResult = await this.workerManager.processInput(
        routingResult.providerId,
        routingResult.model,
        baseRequest,
        {
          requestId,
          timestamp: startTime,
          metadata: {
            category: routingResult.category,
            originalModel: baseRequest.model
          },
          debugEnabled: this.config.debug.enabled
        }
      );
      
      this.logger.debug('Worker input processed', { 
        requestId, 
        processingTime: Date.now() - startTime 
      });
      
      // Step 4: 发送到Worker输出流水线 (Provider → Anthropic)
      const workerOutputResult = await this.workerManager.processOutput(
        routingResult.providerId,
        routingResult.model,
        workerInputResult,
        {
          requestId,
          timestamp: startTime,
          metadata: {
            category: routingResult.category,
            provider: routingResult.providerId,
            model: routingResult.model
          },
          debugEnabled: this.config.debug.enabled
        }
      );
      
      this.logger.debug('Worker output processed', { 
        requestId, 
        processingTime: Date.now() - startTime 
      });
      
      // Step 5: 检查是否为流式请求
      if (baseRequest.stream) {
        // 流式响应：将Worker的完整响应转换为流式输出
        return this.handleStreamingResponse(workerOutputResult, reply, {
          requestId,
          category: routingResult.category,
          provider: routingResult.providerId,
          model: routingResult.model,
          startTime
        });
      } else {
        // 非流式响应：直接处理输出
        const finalResponse = await this.outputProcessor.process(workerOutputResult, {
          sessionId: requestId,
          requestId,
          timestamp: new Date(startTime),
          metadata: {
            layer: 'post-processor',
            processingTime: Date.now() - startTime,
            baseRequest,
            provider: routingResult.providerId
          },
          debugEnabled: this.config.debug.enabled
        });
        
        this.logger.info('Request completed successfully', {
          requestId,
          category: routingResult.category,
          provider: routingResult.providerId,
          model: routingResult.model,
          totalTime: Date.now() - startTime
        });
        
        return finalResponse;
      }
      
    } catch (error) {
      this.logger.error('Request failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
        processingTime: Date.now() - startTime
      });
      
      // 使用统一错误处理器
      handleUnifiedError(error, reply, {
        requestId,
        component: 'StandardRouterServer',
        method: 'handleMessagesRequest',
        providerId: routingResult?.providerId || baseRequest?.metadata?.targetProvider,
        model: routingResult?.model || baseRequest?.metadata?.targetModel || baseRequest?.model,
        endpoint: this.config.server.host + ':' + this.config.server.port,
        processingTime: Date.now() - startTime,
        type: 'provider', // 默认为provider错误类型
        supportedProviders: ['openai', 'gemini', 'codewhisperer'],
        alternatives: [
          'Check provider configuration',
          'Use supported provider types',
          'Verify endpoint connectivity',
          'Check authentication credentials'
        ]
      });
    }
  }
  
  /**
   * 处理流式响应
   * 将Worker的完整响应转换为流式输出
   */
  private async handleStreamingResponse(
    workerResponse: any, 
    reply: FastifyReply, 
    context: {
      requestId: string;
      category: string;
      provider: string;
      model: string;
      startTime: number;
    }
  ): Promise<void> {
    try {
      // 设置SSE响应头
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      // 生成消息ID
      const messageId = `msg_${Date.now()}`;
      
      // 最终输出处理
      const finalResponse = await this.outputProcessor.process(workerResponse, {
        sessionId: context.requestId,
        requestId: context.requestId,
        timestamp: new Date(context.startTime),
        metadata: {
          layer: 'post-processor',
          processingTime: Date.now() - context.startTime,
          provider: context.provider
        },
        debugEnabled: this.config.debug.enabled
      });
      
      // 模拟流式响应：将完整响应分块发送
      await this.simulateStreamingResponse(finalResponse, reply, messageId, context);
      
      this.logger.info('Streaming request completed successfully', {
        requestId: context.requestId,
        category: context.category,
        provider: context.provider,
        model: context.model,
        totalTime: Date.now() - context.startTime
      });
      
    } catch (error) {
      this.logger.error('Streaming response failed', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      // 使用统一错误处理器处理流式错误
      handleUnifiedError(error, reply, {
        requestId: context.requestId,
        component: 'StandardRouterServer',
        method: 'handleStreamingResponse',
        providerId: context.provider,
        model: context.model,
        type: 'streaming',
        phase: 'response_processing',
        streamPosition: 0
      });
    }
  }
  
  /**
   * 模拟流式响应
   * 将完整的响应内容分块发送，模拟真实的流式响应
   */
  private async simulateStreamingResponse(
    response: any,
    reply: FastifyReply,
    messageId: string,
    context: { requestId: string }
  ): Promise<void> {
    try {
      // 发送流开始事件
      const startEvent = {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: response.model || 'unknown',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      };
      reply.raw.write(`data: ${JSON.stringify(startEvent)}\n\n`);
      
      // 获取响应内容
      const content = response.content || [];
      const textContent = content.find((c: any) => c.type === 'text')?.text || '';
      
      if (textContent) {
        // 发送内容开始事件
        const contentBlockStart = {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '' }
        };
        reply.raw.write(`data: ${JSON.stringify(contentBlockStart)}\n\n`);
        
        // 将文本分块发送（模拟逐字输出）
        const chunks = this.splitTextIntoChunks(textContent, 15); // 每15个字符一块
        
        for (const chunk of chunks) {
          const deltaEvent = {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: chunk }
          };
          reply.raw.write(`data: ${JSON.stringify(deltaEvent)}\n\n`);
          
          // 添加小延迟模拟真实流式响应
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        // 发送内容结束事件
        const contentBlockStop = {
          type: 'content_block_stop',
          index: 0
        };
        reply.raw.write(`data: ${JSON.stringify(contentBlockStop)}\n\n`);
      }
      
      // 发送消息结束事件
      const stopEvent = {
        type: 'message_stop'
      };
      reply.raw.write(`data: ${JSON.stringify(stopEvent)}\n\n`);
      
      // 结束流
      reply.raw.end();
      
    } catch (error) {
      this.logger.error('Error in simulated streaming response', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      reply.raw.end();
    }
  }
  
  /**
   * 将文本分割成块
   */
  private splitTextIntoChunks(text: string, chunkSize: number = 15): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  /**
   * 启动服务器
   */
  public async start(): Promise<void> {
    try {
      // 创建Worker池配置
      this.logger.info('Creating worker pool configurations...');
      const workerPoolConfigs = this.createWorkerPoolConfigs();
      
      // 初始化Worker管理器
      this.logger.info('Initializing worker manager...');
      await this.workerManager.initialize(workerPoolConfigs);
      
      // 启动HTTP服务器
      const { host, port } = this.config.server;
      await this.fastify.listen({ port, host });
      
      const workerMetrics = this.workerManager.getMetrics();
      
      this.logger.info(`🚀 Standard Router Server v3.1.0 started`, {
        host,
        port,
        providers: Object.keys(this.config.providers).length,
        categories: Object.keys(this.config.routing.categories).length,
        workers: workerMetrics.totalWorkers,
        healthyWorkers: workerMetrics.healthyWorkers,
        architecture: 'worker-pipeline'
      });
      
      this.logger.info(`📊 Available endpoints:`);
      this.logger.info(`   POST /v1/messages             - Anthropic API proxy`);
      this.logger.info(`   POST /v1/chat/completions     - OpenAI API proxy`);
      this.logger.info(`   GET  /health                  - Health check`);
      this.logger.info(`   GET  /status                  - Server status`);
      this.logger.info(`   GET  /config                  - Configuration (safe)`);
      
      if (this.config.debug.enabled) {
        this.logger.info(`🔍 Debug mode enabled - request tracing active`);
      }
      
    } catch (error) {
      this.logger.error('Failed to start server', error);
      throw error;
    }
  }
  
  /**
   * 创建Worker池配置
   */
  private createWorkerPoolConfigs(): WorkerPoolConfig[] {
    const workerPoolConfigs: WorkerPoolConfig[] = [];
    const uniqueProviderModels = new Set<string>();
    
    // 收集所有路由类别中的Provider.Model组合
    for (const [category, categoryConfig] of Object.entries(this.config.routing.categories)) {
      // 使用any类型避免类型检查问题
      const config = categoryConfig as any;
      
      // 处理标准v3.1.0格式和传统格式
      let primaryProvider: string;
      let primaryModel: string;
      
      if (config.primary) {
        // 标准v3.1.0格式
        primaryProvider = config.primary.provider;
        primaryModel = config.primary.model;
      } else {
        // 传统格式兼容
        primaryProvider = config.provider;
        primaryModel = config.model;
      }
      
      const key = `${primaryProvider}.${primaryModel}`;
      uniqueProviderModels.add(key);
      
      // 添加后备Provider (如果有)
      if (config.backups) {
        for (const backup of config.backups) {
          const backupKey = `${backup.provider}.${backup.model}`;
          uniqueProviderModels.add(backupKey);
        }
      }
      
      // 添加fallbacks (标准格式)
      if (config.fallbacks) {
        for (const fallback of config.fallbacks) {
          const fallbackKey = `${fallback.provider}.${fallback.model}`;
          uniqueProviderModels.add(fallbackKey);
        }
      }
    }
    
    // 为每个唯一的Provider.Model组合创建Worker池
    for (const providerModel of uniqueProviderModels) {
      const [providerId, model] = providerModel.split('.');
      const providerConfig = this.config.providers[providerId];
      
      if (!providerConfig) {
        this.logger.warn(`Provider ${providerId} not found in configuration`);
        continue;
      }
      
      if (!providerConfig.models.includes(model)) {
        this.logger.warn(`Model ${model} not found in provider ${providerId}`);
        continue;
      }
      
      const poolConfig: WorkerPoolConfig = {
        providerId,
        model,
        providerConfig,
        poolSize: 2, // 每个Provider.Model组合创建2个Worker
        debugEnabled: this.config.debug?.enabled || false
      };
      
      workerPoolConfigs.push(poolConfig);
      this.logger.debug(`Created worker pool config: ${providerId}.${model}`);
    }
    
    this.logger.info(`Created ${workerPoolConfigs.length} worker pool configurations`);
    return workerPoolConfigs;
  }
  
  /**
   * 停止服务器
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping Standard Router Server...');
      
      // 关闭Worker管理器
      await this.workerManager.shutdown();
      
      // 关闭HTTP服务器
      await this.fastify.close();
      
      this.logger.info('Standard Router Server stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping server', error);
      throw error;
    }
  }
}

/**
 * 配置验证和启动辅助函数
 */
export async function startStandardRouterServer(configPath: string): Promise<StandardRouterServer> {
  const fs = await import('fs/promises');
  
  try {
    // 读取配置文件
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    // 创建并启动服务器
    const server = new StandardRouterServer(config);
    await server.start();
    
    return server;
    
  } catch (error) {
    console.error('Failed to start Standard Router Server:', error);
    throw error;
  }
}

/**
 * 创建标准配置示例
 */
export function createStandardConfigExample(): StandardRouterConfig {
  return {
    configVersion: 'v3.1.0',
    architecture: 'v3.1-dynamic-pipeline',
    server: {
      port: 5555,
      host: '0.0.0.0',
      name: 'standard-router-v3.1'
    },
    providers: {
      'shuaihong-main': {
        type: 'openai',
        endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
        authentication: {
          type: 'bearer',
          credentials: {
            apiKeys: ['sk-example-key-1', 'sk-example-key-2']
          }
        },
        models: ['glm-4.5-air', 'glm-4.5', 'glm-4.5-flash'],
        defaultModel: 'glm-4.5-air',
        maxTokens: {
          'glm-4.5-air': 131072,
          'glm-4.5': 131072,
          'glm-4.5-flash': 131072
        },
        timeout: 120000,
        retry: {
          maxRetries: 3,
          delayMs: 2000
        },
        healthCheck: {
          enabled: true,
          model: 'glm-4.5-air',
          timeout: 15000
        },
        description: 'ShuaiHong 主要模型Provider',
        priority: 1
      }
    },
    routing: {
      strategy: 'category-driven',
      categories: {
        default: {
          primary: { provider: 'shuaihong-main', model: 'glm-4.5-air' }
        },
        background: {
          primary: { provider: 'shuaihong-main', model: 'glm-4.5-flash' }
        },
        thinking: {
          primary: { provider: 'shuaihong-main', model: 'glm-4.5' }
        },
        longcontext: {
          primary: { provider: 'shuaihong-main', model: 'glm-4.5-air' }
        },
        search: {
          primary: { provider: 'shuaihong-main', model: 'glm-4.5-flash' }
        }
      },
      globalSettings: {
        enableMultiKeyExpansion: true,
        defaultCategory: 'default'
      }
    },
    sixLayerArchitecture: {
      client: { acceptAnthropicFormat: true, supportStreaming: true },
      router: {
        strategy: 'dynamic-pipeline',
        multiInstance: { enabled: true, maxInstancesPerProvider: 3, keyRotation: { strategy: 'health_based', cooldownMs: 5000, maxRetriesPerKey: 3, rateLimitCooldownMs: 60000 } },
        failoverThreshold: 2,
        healthCheckInterval: 30000
      },
      postProcessor: { type: 'anthropic', streamingSupport: true },
      transformer: { type: 'mixed', bidirectional: true, features: [] },
      providerProtocol: { type: 'mixed' },
      preprocessor: { type: 'feature-based', mode: 'auto-detect', features: [] }
    },
    debug: {
      enabled: true,
      logLevel: 'info',
      traceRequests: true,
      saveRequests: true,
      enableRecording: true,
      enableAuditTrail: true,
      enableReplay: true,
      enablePerformanceMetrics: true,
      logDir: '/tmp/logs'
    },
    replaySystem: {
      enabled: true,
      captureAllLayers: true,
      databasePath: '/tmp/database/',
      dataRetentionDays: 30
    },
    metadata: {
      version: 'v3.1.0',
      createdAt: new Date().toISOString(),
      createdBy: 'Standard Router Server v3.1.0',
      description: '标准化动态流水线路由配置',
      architecture: 'v3.1-dynamic-pipeline'
    },
    hooks: []
  };
}