/**
 * Decoupled Router Server for Claude Code Router V3.0
 * Independent authentication, expansion, and model mapping
 * 
 * Project owner: Jason Zhang
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UnifiedInputProcessor } from '../client/unified-processor.js';
import { RoutingEngine } from '../router/index.js';
import { AnthropicOutputProcessor } from '../post-processor/anthropic.js';
import { CodeWhispererProvider, GeminiProvider, AnthropicProvider } from '../provider-protocol/base-provider.js';
import { createOpenAIClient } from '../provider-protocol/openai/client-factory.js';
import { RouterConfig, BaseRequest, BaseResponse, ProviderConfig, Provider, RoutingCategory, CategoryRouting, ProviderError } from '../types/index.js';
import { ProcessingContext } from '../shared/layer-interface.js';
import { getLogger, setDefaultPort, createRequestTracker, createErrorTracker } from '../logging/index.js';
import { sessionManager } from '../session/manager.js';
import { v4 as uuidv4 } from 'uuid';
import { ResponsePipeline } from '../pipeline/response-pipeline.js';
import { transformationManager } from '../transformer/manager.js';
import { 
  UnifiedErrorHandler, 
  handleProviderError, 
  handleStreamingError, 
  handleRoutingError, 
  handleInputError, 
  handleOutputError 
} from '../utils/error-handler.js';
import { handleMaxTokensError, MaxTokensErrorHandler } from '../utils/max-tokens-error-handler.js';
import { ConversationQueueManager } from '../session/conversation-queue-manager.js';
import { DebugSystem } from '../debug/debug-system.js';
import { PreprocessingPipeline } from '../preprocessor/preprocessing-pipeline.js';

// Independent modules
import { authenticationManager, AuthenticationManager, AuthenticationConfig } from '../auth/authentication-manager.js';
import { providerExpansionManager, ProviderExpansionManager } from '../expansion/provider-expansion-manager.js';
import { multiKeyManager, MultiKeyManager } from '../multikey/multikey-manager.js';
import { modelMappingManager, ModelMappingManager } from '../mapping/model-mapping-manager.js';

export class DecoupledRouterServer {
  private fastify: FastifyInstance;
  private config: RouterConfig;
  private inputProcessor: UnifiedInputProcessor;
  private routingEngine: RoutingEngine;
  private outputProcessor: AnthropicOutputProcessor;
  private providers: Map<string, Provider> = new Map();
  private logger: any;
  private requestTracker: any;
  private errorTracker: any;
  private responsePipeline: ResponsePipeline;
  private queueManager: any;
  private debugSystem: DebugSystem;
  private preprocessingPipeline: PreprocessingPipeline;

  // Independent managers
  private authManager: AuthenticationManager;
  private expansionManager: ProviderExpansionManager;
  private keyManager: MultiKeyManager;
  private mappingManager: ModelMappingManager;

  constructor(config: RouterConfig, serverType?: string) {
    this.config = config;
    
    // 设置默认端口并初始化统一日志系统
    setDefaultPort(config.server.port);
    process.env.RCC_PORT = config.server.port.toString();
    this.queueManager = new ConversationQueueManager();
    this.logger = getLogger(config.server.port);
    this.requestTracker = createRequestTracker(config.server.port);
    this.errorTracker = createErrorTracker(config.server.port);
    
    // 初始化独立管理器
    this.authManager = authenticationManager;
    this.expansionManager = providerExpansionManager;
    this.keyManager = multiKeyManager;
    this.mappingManager = modelMappingManager;
    
    // 初始化调试系统
    this.debugSystem = new DebugSystem({
      enableRecording: config.debug.enabled,
      enableAuditTrail: config.debug.enabled,
      enableReplay: config.debug.enabled,
      enablePerformanceMetrics: config.debug.enabled
    });
    
    // 初始化响应处理流水线
    this.responsePipeline = new ResponsePipeline(this.debugSystem);
    
    // 初始化预处理管道
    this.preprocessingPipeline = new PreprocessingPipeline(config, this.debugSystem);
    
    this.fastify = Fastify({
      logger: config.debug.enabled ? {
        level: config.debug.logLevel
      } : false
    });

    console.log('🚀 Initializing Decoupled Router Server V3.0...');
    
    // 步骤1: 处理Provider扩展
    this.initializeProviderExpansion();
    
    // 步骤2: 处理认证配置
    this.initializeAuthentication();
    
    // 步骤3: 处理多Key管理
    this.initializeMultiKeyManagement();
    
    // 步骤4: 初始化路由
    this.initializeRouting();
    
    // 步骤5: 初始化Provider实例
    this.initializeProviders();
    
    // 步骤6: 设置路由
    this.setupRoutes();
    
    // 步骤7: 设置钩子
    if (config.debug.enabled) {
      this.setupHooks();
    }

    console.log('✅ Decoupled Router Server V3.0 initialized successfully');
  }

  /**
   * 初始化Provider扩展
   */
  private initializeProviderExpansion(): void {
    console.log('🔧 Step 1: Initializing provider expansion...');
    
    // 设置扩展规则
    for (const [providerId, config] of Object.entries(this.config.providers)) {
      this.expansionManager.setExpansionRule(config.type, {
        strategy: 'multi-key-expansion',
        maxInstances: 10,
        keyRotationCooldownMs: 1000
      });
    }
    
    // 执行扩展
    const expansionResult = this.expansionManager.expandProviders(this.config.providers);
    
    console.log('✅ Provider expansion completed:', this.expansionManager.getExpansionStats());
  }

  /**
   * 初始化认证配置
   */
  private initializeAuthentication(): void {
    console.log('🔐 Step 2: Initializing authentication...');
    
    const expansionResult = this.expansionManager.getExpansionResults();
    if (!expansionResult) {
      throw new Error('Provider expansion must be completed before authentication initialization');
    }

    // 为每个扩展的provider注册认证配置
    for (const [providerId, expandedInfo] of expansionResult.expandedProviders) {
      const providerConfig = this.config.providers[expandedInfo.originalProviderId];
      
      const authConfig = AuthenticationManager.fromProviderConfig(
        providerId,
        expandedInfo.originalProviderId,
        expandedInfo.keyIndex,
        expandedInfo.totalKeys,
        providerConfig
      );
      
      this.authManager.registerAuth(authConfig);
    }
    
    console.log('✅ Authentication configuration completed:', this.authManager.getAuthStats());
  }

  /**
   * 初始化多Key管理
   */
  private initializeMultiKeyManagement(): void {
    console.log('🔑 Step 3: Initializing multi-key management...');
    
    // 为每个provider注册keys
    for (const [providerId, config] of Object.entries(this.config.providers)) {
      const registeredKeys = this.keyManager.registerKeysFromConfig(providerId, config);
      console.log(`Registered ${registeredKeys.length} keys for provider ${providerId}`);
    }
    
    console.log('✅ Multi-key management initialized:', this.keyManager.getKeyStats());
  }

  /**
   * 初始化路由配置
   */
  private initializeRouting(): void {
    console.log('🎯 Step 4: Initializing routing...');
    
    // 使用扩展管理器更新路由配置
    const routingConfig = this.config.routing as any;
    const expandedRouting = this.expansionManager.updateRoutingConfig(
      routingConfig.categories || routingConfig
    );
    
    // 初始化输入处理器和路由引擎
    this.inputProcessor = new UnifiedInputProcessor();
    this.routingEngine = new RoutingEngine(
      expandedRouting as Record<RoutingCategory, CategoryRouting>
    );
    this.outputProcessor = new AnthropicOutputProcessor(this.config.server.port);
    
    console.log('✅ Routing configuration completed');
  }

  /**
   * 初始化Provider实例（解耦版本）
   */
  private initializeProviders(): void {
    console.log('🔧 Step 5: Initializing decoupled providers...');
    
    this.providers.clear();
    
    const expansionResult = this.expansionManager.getExpansionResults();
    if (!expansionResult) {
      throw new Error('Provider expansion results not available');
    }

    // 为每个扩展的provider创建实例
    for (const [expandedProviderId, expandedInfo] of expansionResult.expandedProviders) {
      try {
        // 获取原始配置
        const originalConfig = this.config.providers[expandedInfo.originalProviderId];
        
        // 获取认证配置
        const authConfig = this.authManager.getAuth(expandedProviderId);
        if (!authConfig) {
          console.warn(`No authentication config found for ${expandedProviderId}`);
          continue;
        }
        
        // 创建解耦的provider配置
        const decoupledConfig = this.createDecoupledProviderConfig(
          originalConfig,
          authConfig,
          expandedInfo
        );
        
        // 创建provider实例
        let client: Provider;
        
        switch (originalConfig.type) {
          case 'codewhisperer':
            client = new CodeWhispererProvider(decoupledConfig, expandedProviderId);
            break;
          case 'openai':
          case 'lmstudio':
            client = createOpenAIClient(decoupledConfig, expandedProviderId);
            break;
          case 'anthropic':
            client = new AnthropicProvider(decoupledConfig);
            break;
          case 'gemini':
            client = new GeminiProvider(decoupledConfig, expandedProviderId);
            break;
          default:
            console.warn(`Unsupported provider type: ${originalConfig.type}`);
            continue;
        }
        
        this.providers.set(expandedProviderId, client);
        
        console.log(`✅ Initialized decoupled provider: ${expandedProviderId}`, {
          type: originalConfig.type,
          endpoint: originalConfig.endpoint,
          authType: authConfig.type,
          keyIndex: expandedInfo.keyIndex + 1,
          totalKeys: expandedInfo.totalKeys
        });
        
      } catch (error) {
        console.error(`❌ Failed to initialize provider: ${expandedProviderId}`, {
          error: error instanceof Error ? error.message : String(error),
          expandedInfo
        });
      }
    }
    
    console.log(`✅ Decoupled providers initialization completed: ${this.providers.size} providers`);
  }

  /**
   * 创建解耦的Provider配置
   */
  private createDecoupledProviderConfig(
    originalConfig: any,
    authConfig: any,
    expandedInfo: any
  ): ProviderConfig {
    // 基础配置，不包含认证信息
    const baseConfig = {
      type: originalConfig.type,
      endpoint: originalConfig.endpoint,
      timeout: originalConfig.timeout,
      maxRetries: originalConfig.maxRetries,
      retryDelay: originalConfig.retryDelay,
      models: originalConfig.models,
      defaultModel: originalConfig.defaultModel || (originalConfig.models && originalConfig.models[0]) || '',
      name: expandedInfo.providerId
    };

    // 根据认证类型添加认证信息
    const decoupledConfig: ProviderConfig = {
      ...baseConfig,
      authentication: {
        type: authConfig.credentials.type,
        credentials: authConfig.credentials.credentials
      }
    };

    return decoupledConfig;
  }

  /**
   * 智能Provider选择（使用独立管理器）
   */
  private findProvider(providerId: string, requestId: string): any {
    // 1. 直接查找
    let provider = this.providers.get(providerId);
    if (provider) {
      return provider;
    }

    // 2. 使用认证管理器进行Key轮换选择
    const authConfig = this.authManager.getAuthWithRotation(providerId, requestId);
    if (authConfig) {
      provider = this.providers.get(authConfig.id);
      if (provider) {
        console.log(`🔄 Auth-based provider selection: ${authConfig.id} for ${providerId}`, {
          keyIndex: authConfig.keyIndex,
          totalKeys: authConfig.totalKeys,
          requestId
        });
        return provider;
      }
    }

    // 3. 使用多Key管理器选择最佳Key
    const keyInfo = this.keyManager.selectKey(providerId, { type: 'round_robin' });
    if (keyInfo) {
      // 查找对应的provider
      const expandedProviders = this.expansionManager.findExpandedProviders(providerId);
      for (const expandedProvider of expandedProviders) {
        provider = this.providers.get(expandedProvider.providerId);
        if (provider) {
          console.log(`🔑 Key-based provider selection: ${expandedProvider.providerId} for ${providerId}`, {
            keyId: keyInfo.keyId,
            requestId
          });
          return provider;
        }
      }
    }

    console.warn(`❌ No provider found for: ${providerId}`, { requestId });
    return null;
  }

  /**
   * 处理请求的核心逻辑（增强版）
   */
  async processRequest(request: BaseRequest, requestId: string): Promise<BaseResponse> {
    const startTime = Date.now();
    let routingDecision: any = null;
    
    try {
      console.log(`🔄 Processing request ${requestId} with decoupled architecture`);
      
      // 步骤1: 输入处理
      const processedInput = await this.inputProcessor.process(request);

      // 步骤2: 路由决策（使用模型映射管理器）
      const routingProviderId = await this.routingEngine.route(processedInput, requestId);
      
      // 创建路由决策对象
      routingDecision = {
        providerId: routingProviderId,
        targetModel: processedInput.model || 'default'
      };
      
      const modelInfo = this.mappingManager.getModel(routingDecision.targetModel);
      
      if (!modelInfo) {
        console.warn(`Model mapping not found: ${routingDecision.targetModel}`);
      }

      // 步骤3: 智能Provider选择
      const provider = this.findProvider(routingDecision.providerId, requestId);
      if (!provider) {
        throw new Error(`Provider not found: ${routingDecision.providerId}`);
      }

      // 步骤4: 认证处理
      const authConfig = this.authManager.getAuth(routingDecision.providerId) || 
                         this.authManager.getAuthWithRotation(routingDecision.providerId, requestId);
      
      // 步骤5: 应用transformer转换
      let providerConfig = this.config.providers[routingDecision.providerId];
      if (!providerConfig && this.expansionManager) {
        const expandedProvider = this.expansionManager.getExpandedProvider(routingDecision.providerId);
        if (expandedProvider) {
          providerConfig = this.config.providers[expandedProvider.originalProviderId];
        }
      }

      if (!providerConfig) {
        throw new Error(`Provider configuration not found: ${routingDecision.providerId}`);
      }

      // Transformer处理
      const transformedRequest = await transformationManager.transformInput(processedInput, {
        provider: providerConfig.type,
        direction: 'input',
        requestId,
        originalRequest: request
      });

      // 步骤6: 发送请求到Provider
      transformedRequest.model = routingDecision.targetModel;
      const response = await provider.sendRequest(transformedRequest);

      // 步骤7: 响应转换
      const transformedResponse = await transformationManager.transformOutput(response, {
        provider: 'anthropic',
        direction: 'output',
        requestId,
        originalRequest: request
      });

      // 步骤8: 输出处理
      const finalResponse = await this.outputProcessor.process(transformedResponse, {
        requestId,
        port: this.config.server.port,
        debug: this.config.debug.enabled
      } as any);

      // 更新统计
      if (authConfig) {
        this.keyManager.markRequestComplete(authConfig.id, true);
      }
      
      console.log(`✅ Request ${requestId} completed successfully`, {
        providerId: routingDecision.providerId,
        model: routingDecision.targetModel,
        processingTime: Date.now() - startTime
      });

      return finalResponse;

    } catch (error) {
      console.error(`❌ Request ${requestId} failed:`, error);
      
      // 标记认证失败
      if (routingDecision) {
        const authConfig = this.authManager.getAuth(routingDecision.providerId);
        if (authConfig) {
          this.keyManager.markRequestComplete(authConfig.id, false, (error as Error).message);
          this.authManager.markAuthFailure(authConfig.id, (error as Error).message);
        }
      }
      
      throw error;
    }
  }

  /**
   * 设置路由（简化版本）
   */
  private setupRoutes(): void {
    // 健康检查
    this.fastify.get('/health', async (request, reply) => {
      const stats = {
        server: 'healthy',
        providers: this.providers.size,
        auth: this.authManager.getAuthStats(),
        keys: this.keyManager.getKeyStats(),
        expansion: this.expansionManager.getExpansionStats(),
        mapping: this.mappingManager.getMappingStats()
      };
      
      reply.send(stats);
    });

    // 状态接口
    this.fastify.get('/status', async (request, reply) => {
      reply.send({
        version: 'v3.0-decoupled',
        providers: Array.from(this.providers.keys()),
        decoupledArchitecture: {
          authentication: 'independent',
          expansion: 'independent', 
          multiKey: 'independent',
          modelMapping: 'independent'
        },
        stats: {
          auth: this.authManager.getAuthStats(),
          keys: this.keyManager.getKeyStats(),
          expansion: this.expansionManager.getExpansionStats(),
          mapping: this.mappingManager.getMappingStats()
        }
      });
    });

    // 主要API端点
    this.fastify.post('/v1/messages', async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = uuidv4();
      
      try {
        const response = await this.processRequest(request.body as BaseRequest, requestId);
        reply.send(response);
      } catch (error) {
        reply.code(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
          requestId
        });
      }
    });
  }

  /**
   * 设置钩子
   */
  private setupHooks(): void {
    this.fastify.addHook('onRequest', async (request, reply) => {
      this.requestTracker.trackRequest(request);
    });

    this.fastify.addHook('onError', async (request, reply, error) => {
      this.errorTracker.trackError(error, request);
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

      console.log(`🚀 Decoupled Router Server V3.0 listening on ${address}`);
      console.log(`📊 Available endpoints:`);
      console.log(`   POST /v1/messages - Anthropic API proxy`);
      console.log(`   GET  /health     - Health check`);
      console.log(`   GET  /status     - Server status`);
      console.log(`🔧 Independent Architecture:`);
      console.log(`   - Authentication: ${this.authManager.getAuthStats().totalConfigs} configs`);
      console.log(`   - Multi-Key: ${this.keyManager.getKeyStats().totalKeys} keys`);
      console.log(`   - Expansion: ${this.expansionManager.getExpansionStats()?.totalExpanded || 0} expanded providers`);
      console.log(`   - Model Mapping: ${this.mappingManager.getMappingStats().models} models`);
      
    } catch (error) {
      console.error('❌ Failed to start decoupled server:', error);
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    try {
      await this.fastify.close();
      console.log('🛑 Decoupled Router Server stopped');
    } catch (error) {
      console.error('❌ Error stopping server:', error);
      throw error;
    }
  }
}