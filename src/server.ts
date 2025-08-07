/**
 * HTTP Server for Claude Code Router
 * Handles incoming requests and routes them through the pipeline
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnthropicInputProcessor } from './input/anthropic';
import { RoutingEngine } from './routing';
import { AnthropicOutputProcessor } from './output/anthropic';
import { CodeWhispererProvider } from './providers/codewhisperer';
import { createOpenAIClient } from './providers/openai/client-factory';
import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { LMStudioClient } from './providers/lmstudio';
import { RouterConfig, BaseRequest, ProviderConfig, Provider, RoutingCategory, CategoryRouting, ProviderError } from './types';
import { getLogger, setDefaultPort, createRequestTracker, createErrorTracker } from './logging';
import { sessionManager } from './session/manager';
import { ProviderExpander, ProviderExpansionResult } from './routing/provider-expander';
import { v4 as uuidv4 } from 'uuid';
import { createPatchManager } from './patches';
import { ResponsePipeline } from './pipeline/response-pipeline';
import { transformationManager } from './transformers/manager';
import { getUnifiedPatchPreprocessor } from './preprocessing/unified-patch-preprocessor';
import { 
  UnifiedErrorHandler, 
  handleProviderError, 
  handleStreamingError, 
  handleRoutingError, 
  handleInputError, 
  handleOutputError 
} from './utils/error-handler';
import { MaxTokensErrorHandler } from './utils/max-tokens-error-handler';
// Debug hooks temporarily removed

export class RouterServer {
  private fastify: FastifyInstance;
  private config: RouterConfig;
  private inputProcessor: AnthropicInputProcessor;
  private routingEngine: RoutingEngine;
  private outputProcessor: AnthropicOutputProcessor;
  private providers: Map<string, Provider> = new Map();
  private providerExpansion?: ProviderExpansionResult;
  private logger: any;
  private requestTracker: any;
  private errorTracker: any;
  private patchManager: ReturnType<typeof createPatchManager>;
  private responsePipeline: ResponsePipeline;
  private unifiedPreprocessor: ReturnType<typeof getUnifiedPatchPreprocessor>;

  constructor(config: RouterConfig, serverType?: string) {
    this.config = config;
    
    // 设置默认端口并初始化统一日志系统
    setDefaultPort(config.server.port);
    process.env.RCC_PORT = config.server.port.toString(); // 设置环境变量供兼容性logger使用
    this.logger = getLogger(config.server.port);
    this.requestTracker = createRequestTracker(config.server.port);
    this.errorTracker = createErrorTracker(config.server.port);
    this.patchManager = createPatchManager(config.server.port);
    
    // 🆕 初始化统一预处理器 - 集中管理所有补丁逻辑
    const preprocessingConfig = (config as any).preprocessing || {};
    this.unifiedPreprocessor = getUnifiedPatchPreprocessor(config.server.port, preprocessingConfig);
    
    // 初始化响应处理流水线
    this.responsePipeline = new ResponsePipeline(
      this.patchManager,
      transformationManager,
      config.server.port
    );
    
    this.fastify = Fastify({
      logger: config.debug.enabled ? {
        level: config.debug.logLevel
      } : false
    });

    // 🔧 Step 1: 扩展providers（多Key等价于多Provider）
    this.providerExpansion = ProviderExpander.expandProviders(config.providers);
    
    // 🔧 Step 2: 更新routing配置以使用扩展后的providers
    const expandedRouting = ProviderExpander.updateRoutingWithExpandedProviders(
      config.routing,
      this.providerExpansion.expandedProviders
    );
    
    // Initialize components
    this.inputProcessor = new AnthropicInputProcessor();
    this.routingEngine = new RoutingEngine(
      expandedRouting as Record<RoutingCategory, CategoryRouting>
    );
    this.outputProcessor = new AnthropicOutputProcessor(config.server.port);

    // Initialize providers (using expanded configurations)
    this.initializeProviders();
    
    // Setup routes
    this.setupRoutes();
    
    // Setup hooks if enabled
    if (config.debug.enabled) {
      this.setupHooks();
      // Enable model name debug tracer
      // Debug tracer removed
    }
  }

  /**
   * Initialize providers from expanded configuration
   */
  private initializeProviders(): void {
    // Clear existing providers
    this.providers.clear();
    
    // Provider expansion should be completed in constructor
    
    // 🔧 使用扩展后的providers配置
    for (const [expandedProviderId, expandedProvider] of this.providerExpansion!.expandedProviders) {
      const providerConfig = expandedProvider.config;
      try {
        let client: Provider;
        
        if (providerConfig.type === 'codewhisperer') {
          client = new CodeWhispererProvider(expandedProviderId);
        } else if (providerConfig.type === 'openai') {
          // OpenAI-compatible client (SDK implementation)
          client = createOpenAIClient(providerConfig, expandedProviderId, this.config);
        } else if (providerConfig.type === 'anthropic') {
          // Direct Anthropic API client
          client = new AnthropicProvider(providerConfig);
        } else if (providerConfig.type === 'gemini') {
          // Google Gemini API client
          client = new GeminiProvider(providerConfig, expandedProviderId);
        } else if (providerConfig.type === 'lmstudio') {
          // LM Studio local server client
          client = new LMStudioClient(providerConfig, expandedProviderId);
        } else {
          this.logger.warn(`Unsupported provider type: ${providerConfig.type}`, { providerId: expandedProviderId });
          continue;
        }
        
        this.providers.set(expandedProviderId, client);
        
        // 🔧 增强日志：显示扩展信息
        if (expandedProvider.totalKeys > 1) {
          this.logger.info(`Initialized expanded provider: ${expandedProviderId}`, { 
            type: providerConfig.type,
            endpoint: providerConfig.endpoint,
            originalProvider: expandedProvider.originalProviderId,
            keyIndex: expandedProvider.keyIndex + 1,
            totalKeys: expandedProvider.totalKeys,
            expansionStrategy: 'multi-key-as-multi-provider'
          });
        } else {
          this.logger.info(`Initialized provider: ${expandedProviderId}`, { 
            type: providerConfig.type,
            endpoint: providerConfig.endpoint 
          });
        }
      } catch (error) {
        this.logger.error(`Failed to initialize expanded provider: ${expandedProviderId}`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          expandedProviderId,
          originalProvider: expandedProvider.originalProviderId,
          keyIndex: expandedProvider.keyIndex + 1,
          providerType: providerConfig.type,
          endpoint: providerConfig.endpoint
        });
      }
    }
  }

  /**
   * 动态查找提供者：支持原始名称和多密钥轮询
   */
  private findProvider(providerId: string, requestId: string): any {
    // 1. 首先尝试直接查找原始名称
    let provider = this.providers.get(providerId);
    if (provider) {
      return provider;
    }

    // 2. 如果找不到，查找所有匹配的扩展提供者
    const availableProviders = Array.from(this.providers.keys());
    const matchingProviders = availableProviders.filter(name => name.startsWith(`${providerId}-key`));
    
    if (matchingProviders.length > 0) {
      // 3. 使用简单的轮询策略选择一个提供者
      const selectedProvider = this.selectProviderFromPool(matchingProviders, providerId, requestId);
      provider = this.providers.get(selectedProvider);
      
      if (provider) {
        this.logger.debug(`Dynamic provider selection: ${selectedProvider} for ${providerId}`, {
          availableKeys: matchingProviders.length,
          selectedProvider
        }, requestId, 'server');
        return provider;
      }
    }

    // 4. 如果都找不到，抛出错误
    this.logger.error(`Provider not found: ${providerId}`, {
      availableProviders,
      requestedProvider: providerId,
      matchingProviders
    }, requestId, 'server');
    throw new Error(`Provider not found: ${providerId}. Available providers: ${availableProviders.join(', ')}`);
  }

  /**
   * 从提供者池中选择一个提供者（简单轮询）
   */
  private selectProviderFromPool(providers: string[], originalProviderId: string, requestId: string): string {
    // 使用请求ID的哈希来实现简单的负载均衡
    const hash = requestId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = hash % providers.length;
    return providers[index];
  }

  /**
   * 生成健康建议
   */
  private generateHealthRecommendations(stats: any): string[] {
    const recommendations = [];

    if (stats.silentFailureRate > 15) {
      recommendations.push('Critical: High silent failure rate detected. Review error handling logic immediately.');
    } else if (stats.silentFailureRate > 5) {
      recommendations.push('Warning: Elevated silent failure rate. Monitor error handling closely.');
    }

    if (stats.errorsByPort[6689] > 0) {
      recommendations.push('Port 6689 showing errors. Check provider configuration and endpoint availability.');
    }

    if (stats.errorsByType['http_404'] > stats.totalErrors * 0.3) {
      recommendations.push('High rate of 404 errors. Verify model names and endpoint configurations.');
    }

    if (stats.errorsByType['network_ECONNREFUSED'] > 0) {
      recommendations.push('Connection refused errors detected. Check if all provider services are running.');
    }

    if (stats.recentSilentFailures.length > 0) {
      recommendations.push(`${stats.recentSilentFailures.length} recent silent failures detected. Review error handling for affected requests.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Error system is functioning normally. Continue monitoring.');
    }

    return recommendations;
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.fastify.get('/health', async (request, reply) => {
      try {
        const healthStatus = await this.getHealthStatus();
        
        this.logger.info('Health check requested', {
          status: healthStatus.overall,
          healthyProviders: healthStatus.healthy,
          totalProviders: healthStatus.total
        });
        
        if (healthStatus.overall === 'healthy') {
          reply.code(200).send(healthStatus);
        } else {
          reply.code(503).send(healthStatus);
        }
      } catch (error) {
        this.logger.error('Health check failed', error);
        this.logger.error('Health check failed', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
        reply.code(500).send({
          error: 'Health check failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Status endpoint
    this.fastify.get('/status', async (request, reply) => {
      const routingStats = this.routingEngine.getStats();
      
      // 添加临时禁用状态到每个provider health
      if (routingStats.providerHealth) {
        Object.keys(routingStats.providerHealth).forEach(providerId => {
          routingStats.providerHealth[providerId].isTemporarilyDisabledByUser = 
            this.routingEngine.isProviderTemporarilyDisabled(providerId);
        });
      }
      
      reply.send({
        server: 'claude-code-router',
        version: '2.0.0',
        uptime: process.uptime(),
        providers: Array.from(this.providers.keys()),
        routing: routingStats,
        temporarilyDisabledProviders: this.routingEngine.getTemporarilyDisabledProviders(),
        debug: this.config.debug.enabled
      });
    });

    // OpenAI Client Status API endpoint
    this.fastify.get('/api/openai-client-status', async (request, reply) => {
      try {
        const { OpenAIClientFactory } = await import('./providers/openai/client-factory');
        const clientStatus = OpenAIClientFactory.getAllClientStatus();
        
        reply.send({
          timestamp: new Date().toISOString(),
          clientStatus,
          totalClients: Object.keys(clientStatus).length
        });
      } catch (error) {
        reply.status(500).send({
          error: 'Failed to get OpenAI client status',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Statistics API endpoint
    this.fastify.get('/api/stats', async (request, reply) => {
      try {
        const summary = this.routingEngine.getStatsSummary();
        const responseStats = this.routingEngine.getResponseStats();

        // 处理provider分布数据
        const providers: { [key: string]: number } = {};
        const models: { [key: string]: number } = {};
        const distribution: { [key: string]: number } = {};

        for (const [providerId, providerData] of Object.entries(responseStats)) {
          let providerTotal = 0;
          for (const [modelName, stat] of Object.entries(providerData as any)) {
            const statData = stat as any;
            providerTotal += statData.totalResponses || 0;
            models[modelName] = (models[modelName] || 0) + (statData.totalResponses || 0);
            distribution[`${providerId}/${modelName}`] = statData.totalResponses || 0;
          }
          if (providerTotal > 0) {
            providers[providerId] = providerTotal;
          }
        }

        // 计算性能指标
        let totalResponseTime = 0;
        let totalResponses = 0;
        for (const [, providerData] of Object.entries(responseStats)) {
          for (const [, stat] of Object.entries(providerData as any)) {
            const statData = stat as any;
            totalResponseTime += statData.totalResponseTime || 0;
            totalResponses += statData.totalResponses || 0;
          }
        }

        const performance = {
          avgResponseTime: totalResponses > 0 ? Math.round(totalResponseTime / totalResponses) : 0,
          requestsPerMinute: Math.round(totalResponses / (process.uptime() / 60))
        };

        // 获取失败统计 (temporarily disabled)
        const failureStats = {};
        const failureTrends = {};

        reply.send({
          summary,
          providers,
          models,
          distribution,
          performance,
          failures: {
            stats: failureStats,
            trends: failureTrends
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Failed to get statistics', error);
        reply.status(500).send({
          error: 'Failed to get statistics',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Statistics dashboard endpoint
    this.fastify.get('/stats', async (request, reply) => {
      reply.type('text/html');
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const htmlPath = path.join(__dirname, '../public/stats.html');
        const html = await fs.readFile(htmlPath, 'utf-8');
        reply.send(html);
      } catch (error) {
        reply.status(404).send(`
          <html>
            <body>
              <h1>Statistics Dashboard</h1>
              <p>Dashboard file not found. Please ensure public/stats.html exists.</p>
              <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            </body>
          </html>
        `);
      }
    });

    // Dual server monitoring dashboard endpoint
    this.fastify.get('/dual-stats', async (request, reply) => {
      reply.type('text/html');
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const htmlPath = path.join(__dirname, '../public/dual-stats.html');
        const html = await fs.readFile(htmlPath, 'utf-8');
        reply.send(html);
      } catch (error) {
        reply.status(404).send(`
          <html>
            <body>
              <h1>Dual Server Monitoring Dashboard</h1>
              <p>Dashboard file not found. Please ensure public/dual-stats.html exists.</p>
              <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            </body>
          </html>
        `);
      }
    });

    // Failure analysis API endpoint
    this.fastify.get('/api/failures', async (request, reply) => {
      try {
        const hours = parseInt((request.query as any)?.hours || '24');
        const days = parseInt((request.query as any)?.days || '7');
        
        const [stats, trends] = [{}, {}];

        reply.send({
          stats,
          trends,
          meta: {
            hoursAnalyzed: hours,
            daysAnalyzed: days,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        this.logger.error('Failed to get failure analysis', error);
        reply.status(500).send({
          error: 'Failed to get failure analysis',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Temporary provider control endpoints
    this.fastify.post('/api/providers/:providerId/disable', async (request, reply) => {
      try {
        const { providerId } = request.params as { providerId: string };
        const success = this.routingEngine.temporarilyDisableProvider(providerId);
        
        if (success) {
          reply.send({
            success: true,
            message: `Provider ${providerId} temporarily disabled`,
            providerId,
            action: 'disable',
            timestamp: new Date().toISOString()
          });
        } else {
          reply.status(404).send({
            success: false,
            error: 'Provider not found',
            providerId
          });
        }
      } catch (error) {
        this.logger.error('Failed to disable provider', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to disable provider',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.fastify.post('/api/providers/:providerId/enable', async (request, reply) => {
      try {
        const { providerId } = request.params as { providerId: string };
        const success = this.routingEngine.temporarilyEnableProvider(providerId);
        
        reply.send({
          success: true,
          message: success ? 
            `Provider ${providerId} temporarily enabled` : 
            `Provider ${providerId} was not disabled`,
          providerId,
          action: 'enable',
          wasDisabled: success,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Failed to enable provider', error);
        reply.status(500).send({
          success: false,
          error: 'Failed to enable provider',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.fastify.get('/api/providers/temporary-disabled', async (request, reply) => {
      try {
        const disabledProviders = this.routingEngine.getTemporarilyDisabledProviders();
        
        reply.send({
          disabledProviders,
          count: disabledProviders.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Failed to get disabled providers', error);
        reply.status(500).send({
          error: 'Failed to get disabled providers',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Shutdown endpoint for graceful server stop
    this.fastify.post('/shutdown', async (request, reply) => {
      try {
        this.logger.info('Shutdown request received via API', {}, 'server');
        
        reply.send({
          message: 'Server shutdown initiated',
          timestamp: new Date().toISOString()
        });
        
        // Give the response time to be sent before shutting down
        setTimeout(() => {
          this.stop().then(() => {
            this.logger.info('Server shutdown completed via API', {}, 'server');
            process.exit(0);
          }).catch((error) => {
            this.logger.error('Error during API shutdown', error, 'server');
            process.exit(1);
          });
        }, 100);
        
      } catch (error) {
        this.logger.error('Error handling shutdown request', error, 'server');
        reply.code(500).send({
          error: {
            type: 'shutdown_error',
            message: 'Failed to initiate shutdown'
          }
        });
      }
    });

    // Main messages endpoint (Anthropic API compatible)
        this.fastify.post('/v1/messages', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleMessagesRequest(request, reply);
    });

    this.fastify.post('/v1/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleMessagesRequest(request, reply);
    });

    // Token counting endpoint (Anthropic API compatible)
    this.fastify.post('/v1/messages/count_tokens', async (request, reply) => {
      return this.handleCountTokensRequest(request, reply);
    });

    // Error diagnostics API endpoint
    this.fastify.get('/api/error-diagnostics', async (request, reply) => {
      try {
        const { ErrorSystemDiagnostics } = await import('./utils/error-system-diagnostics');
        const stats = ErrorSystemDiagnostics.getDiagnosticsStats();
        
        reply.send({
          ...stats,
          port: this.config.server.port,
          timestamp: new Date().toISOString(),
          systemHealth: {
            silentFailureRate: stats.silentFailureRate,
            healthStatus: stats.silentFailureRate < 5 ? 'healthy' : 
                         stats.silentFailureRate < 15 ? 'warning' : 'critical',
            recommendations: this.generateHealthRecommendations(stats)
          }
        });
      } catch (error) {
        this.logger.error('Failed to get error diagnostics', error);
        reply.status(500).send({
          error: 'Failed to get error diagnostics',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Catch-all for other paths
    this.fastify.setNotFoundHandler((request, reply) => {
      reply.code(404).send({
        error: {
          type: 'not_found',
          message: `Endpoint ${request.method} ${request.url} not found`
        }
      });
    });
  }

  /**
   * Setup debugging hooks
   */
  private setupHooks(): void {
    this.fastify.addHook('onRequest', async (request, reply) => {
      const requestId = uuidv4();
      (request as any).requestId = requestId;
      (request as any).startTime = Date.now();
      
      this.logger.debug(requestId, 'server', 'Request received', {
        method: request.method,
        url: request.url,
        headers: request.headers
      });
    });

    this.fastify.addHook('onResponse', async (request, reply) => {
      const requestId = (request as any).requestId;
      const duration = Date.now() - ((request as any).startTime || Date.now());
      
      this.logger.debug(requestId, 'server', 'Response sent', {
        statusCode: reply.statusCode,
        duration: `${duration}ms`
      });
    });
  }

  /**
   * Handle messages endpoint requests
   */
  private async handleMessagesRequest(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const requestId = (request as any).requestId || uuidv4();
    const startTime = Date.now();
    let providerId: string | undefined;
    let targetModel: string | undefined;
    let baseRequest: BaseRequest | undefined;
    
    try {
      this.logger.logPipeline('start', 'Request started', { timestamp: new Date().toISOString() }, requestId);

      // Step 0: Session Management
      const sessionId = sessionManager.extractSessionId(request.headers as Record<string, string>);
      const session = sessionManager.getOrCreateSession(sessionId);
      
      this.logger.debug('Session information', { 
        sessionId, 
        conversationId: session.conversationId,
        messageHistory: session.messageHistory.length 
      }, requestId, 'server');

      // Step 1: Process input
      if (!this.inputProcessor.canProcess(request.body)) {
        // 检查是否为流式请求并使用统一错误处理
        const isStreamingRequest = !!(request.body as any)?.stream;
        const error = new Error('Request format not supported');
        
        if (isStreamingRequest) {
          // 流式请求使用SSE错误格式
          handleStreamingError(error, reply, {
            requestId,
            providerId: 'unknown',
            model: 'unknown'
          });
        } else {
          // 非流式请求使用JSON错误格式
          handleInputError(error, reply, {
            requestId,
            providerId: 'unknown',
            model: 'unknown'
          });
        }
        return;
      }

      try {
        baseRequest = await this.inputProcessor.process(request.body);
        this.logger.logPipeline('input-processed', 'Input processing completed', { baseRequest }, requestId);
      } catch (inputError) {
        // 检查是否为流式请求并使用统一错误处理
        const isStreamingRequest = !!(request.body as any)?.stream;
        
        if (isStreamingRequest) {
          // 流式请求使用SSE错误格式
          handleStreamingError(inputError, reply, {
            requestId,
            providerId: 'unknown',
            model: (request.body as any)?.model || 'unknown'
          });
        } else {
          // 非流式请求使用JSON错误格式
          handleInputError(inputError, reply, {
            requestId,
            providerId: 'unknown',
            model: (request.body as any)?.model || 'unknown'
          });
        }
        return;
      }
      
      // Debug Hook: Trace input processing
      if (this.config.debug.enabled) {
        // Debug trace removed
      }
      
      // Add session context to request metadata
      baseRequest.metadata = { 
        ...baseRequest.metadata, 
        requestId,
        sessionId,
        conversationId: session.conversationId
      };

      // 处理工具和系统消息的持久化
      if (baseRequest.metadata?.tools && Array.isArray(baseRequest.metadata.tools)) {
        sessionManager.updateSessionTools(sessionId, baseRequest.metadata.tools);
        this.logger.debug('Updated session tools', { 
          sessionId, 
          toolCount: baseRequest.metadata.tools.length 
        }, requestId);
      } else {
        // 如果当前请求没有工具但会话中有工具，恢复工具定义
        const sessionTools = sessionManager.getSessionTools(sessionId);
        if (sessionTools.length > 0) {
          baseRequest.metadata = { 
            ...baseRequest.metadata, 
            tools: sessionTools 
          };
          this.logger.debug('Restored session tools', { 
            sessionId, 
            toolCount: sessionTools.length 
          }, requestId);
        }
      }

      if (baseRequest.metadata?.system && Array.isArray(baseRequest.metadata.system)) {
        sessionManager.updateSessionSystem(sessionId, baseRequest.metadata.system);
        this.logger.debug('Updated session system', { 
          sessionId, 
          systemCount: baseRequest.metadata.system.length 
        }, requestId);
      } else {
        // 如果当前请求没有系统消息但会话中有，恢复系统消息
        const sessionSystem = sessionManager.getSessionSystem(sessionId);
        if (sessionSystem.length > 0) {
          baseRequest.metadata = { 
            ...baseRequest.metadata, 
            system: sessionSystem 
          };
          this.logger.debug('Restored session system', { 
            sessionId, 
            systemCount: sessionSystem.length 
          }, requestId);
        }
      }

      // Store user message in session
      const currentMessage = baseRequest.messages[baseRequest.messages.length - 1];
      if (currentMessage && currentMessage.role === 'user') {
        sessionManager.addMessage(sessionId, {
          role: 'user',
          content: currentMessage.content,
          timestamp: new Date()
        });
      }

      // Step 2: Route request
      try {
        providerId = await this.routingEngine.route(baseRequest, requestId);
      } catch (routingError) {
        // 检查是否为流式请求并使用统一错误处理
        const isStreamingRequest = baseRequest.stream;
        
        if (isStreamingRequest) {
          // 流式请求使用SSE错误格式
          handleStreamingError(routingError, reply, {
            requestId,
            providerId: 'unknown',
            model: baseRequest.model
          });
        } else {
          // 非流式请求使用JSON错误格式
          handleRoutingError(routingError, reply, {
            requestId,
            providerId: 'unknown',
            model: baseRequest.model
          });
        }
        return;
      }
      this.logger.debug('Routing completed', { 
        providerId, 
        targetModel: baseRequest.metadata?.targetModel,
        originalModel: baseRequest.model,
        routingCategory: baseRequest.metadata?.routingCategory
      }, requestId, 'routing-complete');
      targetModel = baseRequest.metadata?.targetModel || baseRequest.model;
      
      // Debug Hook: Trace routing
      if (this.config.debug.enabled) {
        // Debug trace removed
      }
      
      let provider = this.findProvider(providerId, requestId);

      // Step 3: Send to provider
      let providerResponse;
      if (baseRequest.stream) {
        return this.handleStreamingRequest(baseRequest, provider, reply, requestId);
      } else {
        // Debug Hook: Trace provider request
        if (this.config.debug.enabled) {
          // Debug trace removed
        }
        
        providerResponse = await provider.sendRequest(baseRequest);
        
        // 🆕 统一预处理：对Provider响应应用补丁系统
        const preprocessedResponse = await this.unifiedPreprocessor.preprocessResponse(
          providerResponse,
          providerId as any, // Cast to Provider type
          targetModel || baseRequest.model,
          requestId
        );
        
        this.logger.logPipeline('provider-response', 'Provider response received and preprocessed', { 
          originalResponse: providerResponse,
          preprocessedResponse,
          preprocessingApplied: preprocessedResponse !== providerResponse
        }, requestId);
        
        // Debug Hook: Trace provider response
        if (this.config.debug.enabled) {
          // Debug trace removed
        }
        
        // 使用预处理后的响应
        providerResponse = preprocessedResponse;
        
        // 添加详细日志记录，查看预处理后的响应内容
        this.logger.debug('Preprocessed provider response', {
          providerResponse: JSON.stringify(providerResponse, null, 2)
        }, requestId, 'server');
      }

      // Step 4: Process output through unified response pipeline
      // 模型响应 -> 预处理 -> 流式/非流式响应 -> 格式转换 -> 后处理 -> 客户端
      const pipelineContext = {
        requestId,
        provider: providerId,
        model: targetModel || baseRequest.model,
        isStreaming: false,
        timestamp: Date.now()
      };
      
      const pipelineResponse = await this.responsePipeline.process(providerResponse, pipelineContext);
      const finalResponse = await this.outputProcessor.process(pipelineResponse, baseRequest);
      this.logger.logPipeline('output-processed', 'Response pipeline and output processing completed', { finalResponse }, requestId);
      
      // Debug Hook: Trace output processing
      if (this.config.debug.enabled) {
        // Debug trace removed
      }
      
      // 🏗️ 架构一致性修复：完全移除server层的finish_reason检查
      // 根据架构设计原则，所有finish_reason检查都在provider层和预处理层完成
      // server层只负责流式传输已经验证过的响应，不再进行重复检查

      // Store assistant response in session
      if (finalResponse && finalResponse.content) {
        const assistantContent = Array.isArray(finalResponse.content) 
          ? finalResponse.content.map(c => c.text || c).join('')
          : finalResponse.content;
        
        sessionManager.addMessage(sessionId, {
          role: 'assistant',
          content: assistantContent,
          timestamp: new Date(),
          metadata: {
            provider: providerId,
            model: baseRequest.metadata?.targetModel || baseRequest.model, // Use target model from routing
            originalModel: baseRequest.model,
            routingApplied: !!baseRequest.metadata?.targetModel
          }
        });
      }

      this.logger.debug('Request processed successfully', {
        provider: providerId,
        responseType: finalResponse.type || 'message',
        sessionId,
        model: targetModel,
        originalModel: baseRequest.model
      }, requestId, 'server');

      // 记录成功的统计信息
      const responseTimeMs = Date.now() - startTime;
      this.routingEngine.recordProviderResult(
        providerId, 
        true, 
        undefined, 
        undefined, 
        targetModel, 
        responseTimeMs
      );

      // Keep stop_reason in final response for proper conversation flow
      const cleanResponse = { ...finalResponse };
      
      // Debug Hook: Finalize trace and generate report
      if (this.config.debug.enabled) {
        // Debug trace removed
      }
      
      this.logger.debug(requestId, { finalResponse: cleanResponse });
      return cleanResponse;

    } catch (error) {
      // 记录失败的统计信息
      if (providerId && targetModel) {
        this.routingEngine.recordProviderResult(
          providerId, 
          false, 
          error instanceof Error ? error.message : 'Unknown error', 
          error instanceof ProviderError ? error.statusCode : 500, 
          targetModel
        );
      }
      
      // 🚨 Special handling for MaxTokensError
      if (error instanceof Error && (error as any).code === 'MAX_TOKENS_EXCEEDED') {
        this.logger.warn('Max tokens limit exceeded', {
          requestId,
          provider: (error as any).details?.provider,
          model: (error as any).details?.model,
          finishReason: (error as any).details?.finishReason
        }, requestId, 'server');
        
        return reply.code(500).send(MaxTokensErrorHandler.formatErrorResponse(error as any));
      }
      
      // 使用统一错误处理系统
      handleProviderError(error, reply, {
        requestId,
        providerId: providerId || 'unknown',
        model: targetModel || baseRequest?.model || 'unknown'
      });
      
      // 确保错误处理正确执行
      UnifiedErrorHandler.validateErrorHandling(error, reply, {
        requestId,
        providerId: providerId || 'unknown',
        model: targetModel || baseRequest?.model || 'unknown',
        stage: 'provider'
      });
    }
  }

  /**
   * Handle token counting requests
   */
  private async handleCountTokensRequest(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const requestId = (request as any).requestId || uuidv4();
    
    try {
      this.logger.info('Processing count tokens request', {}, requestId, 'server');
      
      const body = request.body as any;
      if (!body || !body.messages) {
        return reply.code(400).send({
          error: {
            type: 'invalid_request_error',
            message: 'Missing required field: messages'
          }
        });
      }

      // Use our tokenizer to count tokens
      const { calculateTokenCount } = await import('./utils/tokenizer');
      
      // Calculate input tokens from messages
      const inputTokens = calculateTokenCount(body.messages);
      
      // Return token count in Anthropic format
      return reply.send({
        input_tokens: inputTokens
      });
      
    } catch (error) {
      this.logger.error('Error processing count tokens request', error, requestId, 'server');
      return reply.code(500).send({
        error: {
          type: 'internal_server_error',
          message: 'Failed to count tokens'
        }
      });
    }
  }

  /**
   * Handle streaming requests
   */
  private async handleStreamingRequest(
    request: BaseRequest,
    provider: Provider,
    reply: FastifyReply,
    requestId: string
  ): Promise<void> {
    // 声明变量在函数顶部，以便catch块可以访问
    let outputTokens = 0;
    let chunkCount = 0;
    let streamInitialized = false;
    
    try {
      // 🔧 修复核心沉默失败：先获取流并验证第一个块，确保请求有效性后再设置HTTP状态码
      const streamIterable = provider.sendStreamRequest(request);
      const streamIterator = streamIterable[Symbol.asyncIterator]();
      const firstChunk = await streamIterator.next();
      
      // 如果第一个块就失败了，说明请求无效，直接抛出错误而不设置200状态码
      if (firstChunk.done && !firstChunk.value) {
        throw new Error('Streaming request failed: No valid response from provider');
      }
      
      // 只有确认流式响应有效后，才设置200状态码和SSE头
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      streamInitialized = true;

      // Generate message ID
      const messageId = `msg_${Date.now()}`;
      let hasToolUse = false;

      // Send message start event
      // CRITICAL: Use original model name for streaming response, not internal mapped name
      const modelForStreaming = request.metadata?.originalModel || request.model;
      
      // Debug Hook: Trace streaming start
      if (this.config.debug.enabled) {
        // Debug trace removed
      }
      
      this.logger.debug('Streaming message start model', {
        originalRequestModel: request.model,
        originalModelFromMetadata: request.metadata?.originalModel,
        targetModel: request.metadata?.targetModel,
        modelForStreaming,
        hasOriginalModel: !!request.metadata?.originalModel
      }, requestId, 'streaming');
      
      // Send proper message_start event with stop_reason
      this.sendSSEEvent(reply, 'message_start', {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: modelForStreaming, // Use target model from routing
          stop_reason: null,
          stop_sequence: null,
          usage: {
            input_tokens: 0,
            output_tokens: 0
          }
        }
      });

      // Send ping
      this.sendSSEEvent(reply, 'ping', { type: 'ping' });

      // Send content block start
      this.sendSSEEvent(reply, 'content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'text',
          text: ''
        }
      });

      // Stream from provider
      
      // Debug Hook: Trace provider streaming request
      if (this.config.debug.enabled) {
        // Debug trace removed
      }
      
      let heartbeatInterval: NodeJS.Timeout | undefined;

      // Start heartbeat for Gemini models if stream is from a Gemini provider
      if ((provider as any).type === 'gemini') {
        this.logger.debug('Starting heartbeat for Gemini streaming', {}, requestId, 'streaming');
        heartbeatInterval = setInterval(() => {
          this.sendSSEEvent(reply, 'ping', { type: 'ping' });
          // 移除刷屏的heartbeat日志
          // this.logger.trace('Sent heartbeat ping for Gemini stream', {}, requestId, 'streaming');
        }, 30000); // Send a ping every 30 seconds
      }

      // 🔧 流处理修复：首先处理已验证的第一个块，然后处理剩余的流
      let currentChunk = firstChunk.value;
      let isDone = firstChunk.done;

      while (!isDone) {
        chunkCount++;
        // 只在debug级别记录chunk详情，避免刷屏
        this.logger.debug(`Streaming chunk ${chunkCount}`, { 
          event: currentChunk.event, 
          hasData: !!currentChunk.data,
          dataType: typeof currentChunk.data 
        }, requestId, 'streaming');
        
        // 🎯 通过响应流水线处理流式数据块
        const pipelineContext = {
          requestId,
          provider: provider.name || 'unknown',
          model: request.metadata?.targetModel || request.model,
          isStreaming: true,
          timestamp: Date.now()
        };
        
        let processedChunk = currentChunk;
        try {
          // 🆕 统一预处理：先对流式数据块应用补丁系统
          const preprocessedChunk = await this.unifiedPreprocessor.preprocessStreaming(
            currentChunk,
            pipelineContext.provider as any,
            pipelineContext.model,
            requestId
          );
          
          // 🔧 然后应用响应流水线处理（如果chunk.data存在）
          if (preprocessedChunk.data) {
            const processedData = await this.responsePipeline.process(preprocessedChunk.data, pipelineContext);
            processedChunk = { ...preprocessedChunk, data: processedData };
          } else {
            processedChunk = preprocessedChunk;
          }
          
          this.logger.debug('Streaming chunk processed through unified preprocessing and pipeline', {
            originalChunk: currentChunk.event,
            preprocessingApplied: preprocessedChunk !== currentChunk,
            pipelineApplied: !!preprocessedChunk.data,
            finalEvent: processedChunk.event
          }, requestId, 'streaming-preprocessing');
          
        } catch (error) {
          this.logger.warn('Unified preprocessing or pipeline processing failed for streaming chunk, using original', {
            error: error instanceof Error ? error.message : String(error),
            chunkEvent: currentChunk.event
          }, requestId, 'streaming-pipeline');
          // 使用原始chunk继续处理
          processedChunk = currentChunk;
        }
        
        // 智能停止信号处理：保留工具调用stop_reason，移除其他stop_reason
        if (processedChunk.event === 'message_delta' && processedChunk.data?.delta?.stop_reason) {
          const stopReason = processedChunk.data.delta.stop_reason;
          const isToolUse = stopReason === 'tool_use';
          
          if (isToolUse) {
            hasToolUse = true;
            // 工具调用完成 - 保留stop_reason以触发继续对话
            this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
            this.logger.logFinishReason(stopReason, {
              provider: provider.name,
              model: request.model,
              responseType: 'streaming',
              action: 'preserved-for-continuation'
            }, requestId, 'streaming-tool-use');
            
            // 同时记录到调试日志系统
            const { logFinishReasonDebug } = await import('./utils/finish-reason-debug');
            logFinishReasonDebug(
              requestId,
              stopReason,
              provider.name,
              request.model,
              this.config.server.port,
              {
                responseType: 'streaming',
                action: 'preserved-for-continuation',
                timestamp: new Date().toISOString()
              }
            );
          } else {
            // 🔧 修复：预处理器已经正确处理了stop_reason，直接发送
            // 不再移除stop_reason，因为预处理器已经确保了正确的值
            this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
            this.logger.debug(`Sent message_delta with stop_reason: ${stopReason} (preprocessor handled)`, {
              stopReason,
              requestId
            }, requestId, 'server');
          }
        } else if (processedChunk.event === 'message_stop') {
          // 🔧 修复：工具调用场景下不发送message_stop，保持对话开放
          if (hasToolUse) {
            this.logger.debug('Skipping message_stop for tool_use scenario to keep conversation open', { 
              requestId, 
              hasToolUse 
            }, requestId, 'server');
            // 不发送message_stop，让对话保持开放状态等待工具执行结果
          } else {
            // 非工具调用场景正常发送message_stop
            this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
            this.logger.debug('Sent message_stop event for non-tool scenario', { requestId }, requestId, 'server');
          }
        } else {
          // 正常转发其他事件（包括工具调用相关事件）
          this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
        }
        
        // 计算输出tokens - 包括文本和工具调用内容
        if (processedChunk.event === 'content_block_delta') {
          if (processedChunk.data?.delta?.text) {
            // 文本内容
            const textLength = processedChunk.data.delta.text.length;
            outputTokens += Math.ceil(textLength / 4);
            // 移除刷屏的token计算日志
            // this.logger.trace(`Token calculation - text: "${processedChunk.data.delta.text}" (${textLength} chars = ${Math.ceil(textLength / 4)} tokens)`, {}, requestId, 'server');
          } else if (processedChunk.data?.delta?.type === 'input_json_delta' && processedChunk.data?.delta?.partial_json) {
            // 工具调用的JSON输入内容
            const jsonLength = processedChunk.data.delta.partial_json.length;
            outputTokens += Math.ceil(jsonLength / 4);
            // 移除刷屏的token计算日志
            // this.logger.trace(`Token calculation - tool JSON: "${processedChunk.data.delta.partial_json}" (${jsonLength} chars = ${Math.ceil(jsonLength / 4)} tokens)`, {}, requestId, 'server');
          }
        } else if (processedChunk.event === 'content_block_start' && processedChunk.data?.content_block?.type === 'tool_use') {
          // 工具调用开始 - 计算工具名称的token
          const toolName = processedChunk.data.content_block.name || '';
          const nameLength = toolName.length;
          outputTokens += Math.ceil(nameLength / 4);
          // 移除刷屏的token计算日志
          // this.logger.trace(`Token calculation - tool name: "${toolName}" (${nameLength} chars = ${Math.ceil(nameLength / 4)} tokens)`, {}, requestId, 'server');
        }
        
        // 🔧 获取下一个数据块继续处理流
        const nextResult = await streamIterator.next();
        currentChunk = nextResult.value;
        isDone = nextResult.done;
      }

      // 保留content_block_stop事件，这对工具调用完整性是必需的
      this.sendSSEEvent(reply, 'content_block_stop', {
        type: 'content_block_stop',
        index: 0
      });

      // Send usage info without stop signals to keep conversation open
      this.sendSSEEvent(reply, 'message_delta', {
        type: 'message_delta',
        delta: {
          // Empty delta - no stop signals to keep conversation alive
        },
        usage: {
          output_tokens: outputTokens
        }
      });

      // Do NOT send message_stop event to keep conversation open

      // 保持HTTP连接正常结束，避免连接悬挂
      this.logger.logPipeline('streaming-end', 'Streaming completed', { outputTokens }, requestId);
      
      // 完成streaming session记录
      this.logger.logStreaming('Streaming session completed', {
        totalChunks: chunkCount,
        outputTokens,
        provider: provider.name || 'unknown'
      }, requestId, 'streaming_complete');
      
      // Clear heartbeat interval if it was set
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        this.logger.debug('Cleared Gemini streaming heartbeat interval', {}, requestId, 'streaming');
      }

      reply.raw.end();

      this.logger.debug('Streaming request completed', {
        messageId,
        outputTokens,
        chunkCount,
        provider: provider.name
      }, requestId, 'server');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Stream processing failed';
      const errorCode = (error as any)?.response?.status || 500;
      const providerName = provider.name || 'unknown';
      const modelName = request.metadata?.targetModel || request.model || 'unknown';
      
      // 🚨 Enhanced streaming failure logging with detailed information
      const failureData = {
        timestamp: new Date().toISOString(),
        requestId: requestId,
        port: this.config.server.port,
        provider: providerName,
        model: modelName,
        originalModel: request.model,
        routingCategory: request.metadata?.routingCategory || 'unknown',
        errorCode: errorCode,
        reason: errorMessage,
        stage: 'streaming',
        chunkCount: chunkCount,
        outputTokens: outputTokens,
        errorType: error instanceof Error ? error.name : 'UnknownError',
        stack: error instanceof Error ? error.stack : undefined,
        requestMetadata: {
          sessionId: request.metadata?.sessionId,
          conversationId: request.metadata?.conversationId,
          userId: request.metadata?.user_id,
          isStreaming: true,
          targetProvider: request.metadata?.targetProvider
        }
      };
      
      // 详细的failure logging
      this.logger.error('Streaming request failed with detailed context', failureData, requestId, 'streaming-failure');
      
      // 强制控制台输出详细错误信息（确保用户能看到）
      console.error(`🚨 [STREAMING FAILURE] Request ${requestId}`);
      console.error(`   Provider: ${providerName}`);
      console.error(`   Model: ${modelName} (original: ${request.model})`);
      console.error(`   Error Code: ${errorCode}`);
      console.error(`   Error Message: ${errorMessage}`);
      console.error(`   Chunks Processed: ${chunkCount}`);
      console.error(`   Output Tokens: ${outputTokens}`);
      console.error(`   Port: ${this.config.server.port}`);
      console.error(`   Stage: streaming`);
      console.error(`   Service Status: UNAVAILABLE`);
      
      // 使用统一错误处理系统处理streaming错误
      handleStreamingError(error, reply, {
        requestId,
        providerId: providerName,
        model: modelName
      });
      
      // 确保错误处理正确执行
      UnifiedErrorHandler.validateErrorHandling(error, reply, {
        requestId,
        providerId: providerName,
        model: modelName,
        stage: 'streaming',
        isStreaming: true
      });
    }
  }

  /**
   * Send Server-Sent Event
   */
  private sendSSEEvent(reply: FastifyReply, event: string, data: any): void {
    const eventData = JSON.stringify(data);
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${eventData}\n\n`);
  }

  /**
   * Get health status of all providers
   */
  private async getHealthStatus(): Promise<any> {
    const providerHealth: Record<string, boolean> = {};
    let healthyCount = 0;

    for (const [providerId, provider] of this.providers) {
      try {
        const isHealthy = await provider.isHealthy();
        providerHealth[providerId] = isHealthy;
        if (isHealthy) healthyCount++;
      } catch (error) {
        providerHealth[providerId] = false;
        this.logger.debug(`Health check failed for provider ${providerId}`, error);
      }
    }

    const totalProviders = this.providers.size;
    const overall = healthyCount === totalProviders ? 'healthy' : 
                   healthyCount > 0 ? 'degraded' : 'unhealthy';

    return {
      overall,
      providers: providerHealth,
      healthy: healthyCount,
      total: totalProviders,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      const { host, port } = this.config.server;
      await this.fastify.listen({ port, host });
      
      this.logger.info(`Claude Code Router started`, {
        host,
        port,
        providers: Array.from(this.providers.keys()),
        debug: this.config.debug.enabled
      });

      this.logger.info(`🚀 Claude Code Router listening on http://${host}:${port}`);
      this.logger.info(`📊 Available endpoints:`);
      this.logger.info(`   POST /v1/messages             - Anthropic API proxy`);
      this.logger.info(`   POST /v1/messages/count_tokens - Token counting API`);
      this.logger.info(`   GET  /health                  - Health check`);
      this.logger.info(`   GET  /status                  - Server status`);
      this.logger.info(`   GET  /stats                   - Statistics dashboard`);
      this.logger.info(`   GET  /api/stats    - Statistics API (JSON)`);
      this.logger.info(`   GET  /api/failures - Failure analysis API`);
      
      if (this.config.debug.enabled) {
        this.logger.info(`🔍 Debug mode enabled - logs saved to ${this.config.debug.logDir}`);
      }

    } catch (error) {
      this.logger.error('Failed to start server', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    try {
      await this.fastify.close();
      this.logger.info('Server stopped');
    } catch (error) {
      this.logger.error('Error stopping server', error);
      throw error;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: RouterConfig): void {
    this.config = config;
    this.routingEngine.updateConfig(config.routing as Record<RoutingCategory, CategoryRouting>);
    
    // Reinitialize providers if needed
    this.initializeProviders();
    
      this.logger.info('Server configuration updated');
  }

  /**
   * 对错误进行分类，用于失败日志
   */
  private categorizeError(error: string, httpCode?: number): string {
    const errorLower = error.toLowerCase();

    if (httpCode) {
      if (httpCode >= 500) return 'Server Error';
      if (httpCode === 429) return 'Rate Limited';
      if (httpCode === 401 || httpCode === 403) return 'Authentication';
      if (httpCode >= 400) return 'Client Error';
    }

    if (errorLower.includes('timeout')) return 'Timeout';
    if (errorLower.includes('network') || errorLower.includes('connection')) return 'Network';
    if (errorLower.includes('auth') || errorLower.includes('token')) return 'Authentication';
    if (errorLower.includes('rate') || errorLower.includes('limit')) return 'Rate Limited';
    if (errorLower.includes('quota') || errorLower.includes('billing')) return 'Quota/Billing';

    return 'Unknown Error';
  }

  /**
   * 获取提供商类型
   */
  private getProviderType(providerId: string): 'anthropic' | 'openai' | 'gemini' | 'codewhisperer' {
    if (providerId.includes('anthropic')) return 'anthropic';
    if (providerId.includes('openai') || providerId.includes('gpt')) return 'openai';
    if (providerId.includes('gemini') || providerId.includes('google')) return 'gemini';
    if (providerId.includes('codewhisperer') || providerId.includes('amazon')) return 'codewhisperer';
    
    // 默认返回 anthropic（因为这是主要的用例）
    return 'anthropic';
  }
}