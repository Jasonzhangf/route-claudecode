/**
 * Six-Layer Architecture Server - 最终架构实现
 * 严格按照六层架构设计，确保层级隔离和按需初始化
 * 
 * Project owner: Jason Zhang
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

// 层级组件导入 - 严格按照六层架构
import { UnifiedInputProcessor } from '../client/unified-processor.js';
import { sixLayerRouter, SixLayerRouter, RoutingDecision } from '../router/six-layer-router.js';
import { AnthropicOutputProcessor } from '../client-layer-processor/anthropic.js';
import { transformationManager } from '../transformer/manager.js';
import { PreprocessingPipeline } from '../server-layer-processor/preprocessing-pipeline.js';

// Provider Protocol层组件 - 按需初始化
import { CodeWhispererProvider, GeminiProvider, AnthropicProvider } from '../provider-protocol/base-provider.js';
import { createOpenAIClient } from '../provider-protocol/openai/client-factory.js';

// 配置和管理组件
import { configurationManager } from '../config/configuration-manager.js';
import { getLogger, setDefaultPort, createRequestTracker, createErrorTracker } from '../logging/index.js';
import { DebugSystem } from '../debug/debug-system.js';

// 类型定义
import { RouterConfig, BaseRequest, BaseResponse, ProviderConfig, Provider } from '../types/index.js';

export class SixLayerServer {
  private fastify: FastifyInstance;
  private config: RouterConfig;
  private logger: any;
  private requestTracker: any;
  private errorTracker: any;
  private debugSystem: DebugSystem;

  // 六层架构组件
  private clientLayer: UnifiedInputProcessor;
  private routerLayer: SixLayerRouter;
  private clientLayerProcessor: AnthropicOutputProcessor;
  private transformerLayer: any; // transformationManager
  private providerProtocolLayer: Map<string, Provider> = new Map();
  private serverLayerProcessor: PreprocessingPipeline;

  constructor(config: RouterConfig) {
    this.config = config;
    
    // 设置日志系统
    setDefaultPort(config.server.port);
    process.env.RCC_PORT = config.server.port.toString();
    this.logger = getLogger(config.server.port);
    this.requestTracker = createRequestTracker(config.server.port);
    this.errorTracker = createErrorTracker(config.server.port);
    
    // 初始化调试系统
    this.debugSystem = new DebugSystem({
      enableRecording: config.debug.enabled,
      enableAuditTrail: config.debug.enabled,
      enableReplay: config.debug.enabled,
      enablePerformanceMetrics: config.debug.enabled
    });
    
    // 初始化Fastify
    this.fastify = Fastify({
      logger: config.debug.enabled ? {
        level: config.debug.logLevel
      } : false
    });

    console.log('🏗️ Six-Layer Architecture Server initializing...');
    this.initializeArchitecture();
  }

  /**
   * 初始化六层架构
   */
  private async initializeArchitecture(): Promise<void> {
    try {
      console.log('📐 Step 1: Initializing Client Layer...');
      this.initializeClientLayer();
      
      console.log('🎯 Step 2: Initializing Router Layer...');
      await this.initializeRouterLayer();
      
      console.log('📝 Step 3: Initializing Client-Layer-Processor...');
      this.initializeClientLayerProcessor();
      
      console.log('🔄 Step 4: Initializing Transformer Layer...');
      this.initializeTransformerLayer();
      
      console.log('🔌 Step 5: Initializing Provider-Protocol Layer (on-demand)...');
      await this.initializeProviderProtocolLayer();
      
      console.log('⚙️ Step 6: Initializing Server-Layer-Processor...');
      this.initializeServerLayerProcessor();
      
      console.log('🌐 Step 7: Setting up HTTP routes...');
      this.setupRoutes();
      
      console.log('✅ Six-Layer Architecture initialization completed');
    } catch (error) {
      console.error('❌ Architecture initialization failed:', error);
      throw error;
    }
  }

  /**
   * 第一层：客户端层初始化
   */
  private initializeClientLayer(): void {
    this.clientLayer = new UnifiedInputProcessor();
    console.log('✅ Client Layer initialized - handles HTTP to BaseRequest conversion');
  }

  /**
   * 第二层：路由层初始化
   */
  private async initializeRouterLayer(): Promise<void> {
    this.routerLayer = sixLayerRouter;
    // 路由层自己管理认证和负载均衡
    console.log('✅ Router Layer initialized - manages routing, auth, and load balancing');
  }

  /**
   * 第三层：客户端层处理器初始化
   */
  private initializeClientLayerProcessor(): void {
    this.clientLayerProcessor = new AnthropicOutputProcessor(this.config.server.port);
    console.log('✅ Client-Layer-Processor initialized - handles client response formatting');
  }

  /**
   * 第四层：转换层初始化
   */
  private initializeTransformerLayer(): void {
    this.transformerLayer = transformationManager;
    console.log('✅ Transformer Layer initialized - handles protocol transformations');
  }

  /**
   * 第五层：Provider协议层初始化（按需）
   */
  private async initializeProviderProtocolLayer(): Promise<void> {
    // 只初始化路由表中的活动providers
    const activeProviders = configurationManager.getActiveProviders();
    
    console.log(`🔌 Initializing ${activeProviders.length} active providers...`);
    
    for (const providerId of activeProviders) {
      try {
        const provider = await this.createProviderInstance(providerId);
        if (provider) {
          this.providerProtocolLayer.set(providerId, provider);
          console.log(`✅ Provider initialized: ${providerId}`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize provider: ${providerId}`, error);
        // 通知路由层此provider不可用
        this.routerLayer.reportProviderFailure(providerId, `Initialization failed: ${error}`, 'init');
      }
    }
    
    console.log(`✅ Provider-Protocol Layer initialized with ${this.providerProtocolLayer.size} providers`);
  }

  /**
   * 创建Provider实例
   */
  private async createProviderInstance(providerId: string): Promise<Provider | null> {
    const authConfig = configurationManager.getProviderAuthConfig(providerId);
    if (!authConfig) {
      console.warn(`⚠️ No auth config found for provider: ${providerId}`);
      return null;
    }

    // 构建Provider配置
    const providerConfig: ProviderConfig = {
      type: authConfig.type as 'codewhisperer' | 'gemini' | 'openai' | 'anthropic' | 'lmstudio' | 'shuaihong',
      endpoint: '', // 从配置中获取
      authentication: {
        type: authConfig.type,
        credentials: authConfig.credentials
      },
      timeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
      models: [],
      defaultModel: '',
      name: providerId
    };

    // 根据Provider类型创建实例
    switch (authConfig.type) {
      case 'codewhisperer':
        return new CodeWhispererProvider(providerConfig, providerId);
      
      case 'gemini':
        return new GeminiProvider(providerConfig, providerId);
      
      case 'anthropic':
        return new AnthropicProvider(providerConfig);
      
      case 'openai':
      case 'lmstudio':
      default:
        return createOpenAIClient(providerConfig, providerId);
    }
  }

  /**
   * 第六层：服务器层处理器初始化
   */
  private initializeServerLayerProcessor(): void {
    this.serverLayerProcessor = new PreprocessingPipeline(this.config, this.debugSystem);
    console.log('✅ Server-Layer-Processor initialized - handles server request preprocessing');
  }

  /**
   * 六层架构请求处理流程
   */
  private async processRequestThroughLayers(request: BaseRequest, requestId: string): Promise<BaseResponse> {
    const startTime = Date.now();
    let routingDecision: RoutingDecision | null = null;

    try {
      console.log(`🔄 Processing request ${requestId} through six layers...`);

      // =================== 第一层：Client Layer ===================
      console.log(`[${requestId}] Layer 1: Client processing...`);
      const processedInput = await this.clientLayer.process(request);
      
      // =================== 第二层：Router Layer ===================
      console.log(`[${requestId}] Layer 2: Routing decision...`);
      routingDecision = await this.routerLayer.route(processedInput, requestId);
      
      // 检查Provider是否可用
      const provider = this.providerProtocolLayer.get(routingDecision.providerId);
      if (!provider) {
        throw new Error(`Provider not available: ${routingDecision.providerId}`);
      }

      // =================== 第四层：Transformer Layer ===================
      console.log(`[${requestId}] Layer 4: Input transformation...`);
      const authConfig = configurationManager.getProviderAuthConfig(routingDecision.providerId);
      const transformedRequest = await this.transformerLayer.transformInput(processedInput, {
        provider: authConfig?.type || 'openai',
        direction: 'input',
        requestId,
        originalRequest: request
      });

      // 设置目标模型
      transformedRequest.model = routingDecision.targetModel;

      // =================== 第五层：Provider-Protocol Layer ===================
      console.log(`[${requestId}] Layer 5: Provider API call...`);
      const response = await provider.sendRequest(transformedRequest);

      // =================== 第四层：Transformer Layer (响应转换) ===================
      console.log(`[${requestId}] Layer 4: Output transformation...`);
      const transformedResponse = await this.transformerLayer.transformOutput(response, {
        provider: 'anthropic',
        direction: 'output',
        requestId,
        originalRequest: request
      });

      // =================== 第三层：Client-Layer-Processor ===================
      console.log(`[${requestId}] Layer 3: Client response formatting...`);
      const finalResponse = await this.clientLayerProcessor.process(transformedResponse, {
        requestId,
        port: this.config.server.port,
        debug: this.config.debug.enabled
      } as any);

      // 报告成功
      this.routerLayer.reportProviderSuccess(routingDecision.providerId, requestId);

      console.log(`✅ Request ${requestId} completed successfully in ${Date.now() - startTime}ms`, {
        layers: 'Client → Router → Client-Layer-Processor → Transformer → Provider-Protocol → Server-Layer-Processor',
        category: routingDecision.category,
        provider: routingDecision.providerId,
        model: routingDecision.targetModel
      });

      return finalResponse;

    } catch (error) {
      console.error(`❌ Request ${requestId} failed:`, error);
      
      // 报告失败
      if (routingDecision) {
        this.routerLayer.reportProviderFailure(
          routingDecision.providerId,
          (error as Error).message,
          requestId
        );
      }
      
      throw error;
    }
  }

  /**
   * 设置HTTP路由
   */
  private setupRoutes(): void {
    // 健康检查
    this.fastify.get('/health', async (request, reply) => {
      const stats = {
        server: 'healthy',
        architecture: 'six-layer',
        layers: {
          client: 'active',
          router: 'active', 
          clientLayerProcessor: 'active',
          transformer: 'active',
          providerProtocol: `${this.providerProtocolLayer.size} providers`,
          serverLayerProcessor: 'active'
        },
        routing: this.routerLayer.getRoutingStats(),
        configuration: configurationManager.getConfigStats()
      };
      
      reply.send(stats);
    });

    // 状态接口
    this.fastify.get('/status', async (request, reply) => {
      reply.send({
        version: 'v3.0-six-layer-final',
        architecture: {
          type: 'six-layer',
          layers: [
            'Client Layer',
            'Router Layer',
            'Client-Layer-Processor', 
            'Transformer Layer',
            'Provider-Protocol Layer',
            'Server-Layer-Processor'
          ],
          isolation: 'strict',
          initialization: 'on-demand'
        },
        providers: Array.from(this.providerProtocolLayer.keys()),
        stats: this.routerLayer.getRoutingStats()
      });
    });

    // 路由信息接口
    this.fastify.get('/routing', async (request, reply) => {
      reply.send({
        activeProviders: configurationManager.getActiveProviders(),
        blacklistedProviders: configurationManager.getBlacklistedProviders(),
        routingStats: this.routerLayer.getRoutingStats(),
        configStats: configurationManager.getConfigStats()
      });
    });

    // 主要API端点
    this.fastify.post('/v1/messages', async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = uuidv4();
      
      try {
        const response = await this.processRequestThroughLayers(
          request.body as BaseRequest, 
          requestId
        );
        reply.send(response);
      } catch (error) {
        reply.code(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          requestId,
          architecture: 'six-layer'
        });
      }
    });

    // Token计数接口
    this.fastify.post('/v1/messages/count_tokens', async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = uuidv4();
      
      try {
        // 简化的token计数逻辑
        const body = request.body as any;
        const text = JSON.stringify(body.messages || []);
        const estimatedTokens = Math.ceil(text.length / 4); // 粗略估算
        
        reply.send({
          input_tokens: estimatedTokens,
          processing_time: 10,
          request_id: requestId
        });
      } catch (error) {
        reply.code(500).send({
          error: 'Token counting failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          requestId
        });
      }
    });

    // 调试信息接口
    this.fastify.get('/debug', async (request, reply) => {
      if (!this.config.debug.enabled) {
        reply.code(404).send({ error: 'Debug mode not enabled' });
        return;
      }

      reply.send({
        architecture: 'six-layer-final',
        layers: {
          client: { status: 'active', type: 'UnifiedInputProcessor' },
          router: { status: 'active', type: 'SixLayerRouter', stats: this.routerLayer.getRoutingStats() },
          clientLayerProcessor: { status: 'active', type: 'AnthropicOutputProcessor' },
          transformer: { status: 'active', type: 'TransformationManager' },
          providerProtocol: { 
            status: 'active', 
            providers: Array.from(this.providerProtocolLayer.keys()),
            total: this.providerProtocolLayer.size
          },
          serverLayerProcessor: { status: 'active', type: 'PreprocessingPipeline' }
        },
        configuration: configurationManager.getConfigStats(),
        debug: this.debugSystem ? 'enabled' : 'disabled'
      });
    });
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    try {
      const address = await this.fastify.listen({
        port: this.config.server.port,
        host: this.config.server.host
      });

      console.log(`🚀 Six-Layer Architecture Server listening on ${address}`);
      console.log(`📐 Architecture: Client → Router → Client-Layer-Processor → Transformer → Provider-Protocol → Server-Layer-Processor`);
      console.log(`🔌 Active Providers: ${this.providerProtocolLayer.size}`);
      console.log(`📊 Available endpoints:`);
      console.log(`   POST /v1/messages             - Anthropic API proxy`);
      console.log(`   POST /v1/messages/count_tokens - Token counting`);
      console.log(`   GET  /health                  - Health check`);
      console.log(`   GET  /status                  - Server status`);
      console.log(`   GET  /routing                 - Routing information`);
      console.log(`   GET  /debug                   - Debug information (if enabled)`);
      
    } catch (error) {
      console.error('❌ Failed to start six-layer server:', error);
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    try {
      await this.fastify.close();
      console.log('🛑 Six-Layer Architecture Server stopped');
    } catch (error) {
      console.error('❌ Error stopping server:', error);
      throw error;
    }
  }
}