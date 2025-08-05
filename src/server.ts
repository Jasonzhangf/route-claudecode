/**
 * HTTP Server for Claude Code Router
 * Handles incoming requests and routes them through the pipeline
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnthropicInputProcessor } from './input/anthropic';
import { RoutingEngine } from './routing';
import { AnthropicOutputProcessor } from './output/anthropic';
import { CodeWhispererProvider } from './providers/codewhisperer';
import { EnhancedOpenAIClient } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { LMStudioClient } from './providers/lmstudio';
import { RouterConfig, BaseRequest, ProviderConfig, Provider, RoutingCategory, CategoryRouting, ProviderError } from './types';
import { getLogger, setDefaultPort, createRequestTracker, createErrorTracker } from './logging';
import { sessionManager } from './session/manager';
import { ProviderExpander, ProviderExpansionResult } from './routing/provider-expander';
import { v4 as uuidv4 } from 'uuid';
import { createPatchManager } from './patches';
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

  constructor(config: RouterConfig, serverType?: string) {
    this.config = config;
    
    // 设置默认端口并初始化统一日志系统
    setDefaultPort(config.server.port);
    process.env.RCC_PORT = config.server.port.toString(); // 设置环境变量供兼容性logger使用
    this.logger = getLogger(config.server.port);
    this.requestTracker = createRequestTracker(config.server.port);
    this.errorTracker = createErrorTracker(config.server.port);
    this.patchManager = createPatchManager(config.server.port);
    
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
          // Generic OpenAI-compatible client (works for Shuaihong, etc.)
          client = new EnhancedOpenAIClient(providerConfig, expandedProviderId);
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
        return reply.code(400).send({
          error: {
            type: 'invalid_request_error',
            message: 'Request format not supported'
          }
        });
      }

      baseRequest = await this.inputProcessor.process(request.body);
      this.logger.logPipeline('input-processed', 'Input processing completed', { baseRequest }, requestId);
      
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
      providerId = await this.routingEngine.route(baseRequest, requestId);
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
        this.logger.logPipeline('provider-response', 'Provider response received', { providerResponse }, requestId);
        
        // Debug Hook: Trace provider response
        if (this.config.debug.enabled) {
          // Debug trace removed
        }
      }

      // Step 4: Process output (patches are now applied inside providers)
      const finalResponse = await this.outputProcessor.process(providerResponse, baseRequest);
      this.logger.logPipeline('output-processed', 'Output processing completed', { finalResponse }, requestId);
      
      // Debug Hook: Trace output processing
      if (this.config.debug.enabled) {
        // Debug trace removed
      }
      
      // Keep stop_reason for proper conversation flow control
      if (finalResponse && 'stop_reason' in finalResponse) {
        this.logger.logFinishReason((finalResponse as any).stop_reason, {
          provider: providerId,
          model: targetModel,
          responseType: 'non-streaming'
        }, requestId, 'final-response');
        
        // 同时记录到调试日志系统
        const { logFinishReasonDebug } = await import('./utils/finish-reason-debug');
        logFinishReasonDebug(
          requestId,
          (finalResponse as any).stop_reason,
          providerId,
          targetModel || 'unknown',
          this.config.server.port,
          {
            responseType: 'non-streaming',
            timestamp: new Date().toISOString()
          }
        );
      }

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
      // Enhanced failure logging with model info and error details
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const httpCode = error instanceof ProviderError ? error.statusCode : 500;
      
      this.logger.error('sendRequest failed', {
        error: errorMessage,
        httpCode,
        provider: providerId || 'unknown',
        model: targetModel || baseRequest?.model || 'unknown',
        originalModel: baseRequest?.model || 'unknown',
        routingCategory: baseRequest?.metadata?.routingCategory || 'unknown',
        requestId,
        stack: error instanceof Error ? error.stack : undefined
      }, requestId, 'server');
      
      // 记录失败的统计信息 - 增强错误信息记录
      if (providerId && targetModel) {
        // 记录详细的provider失败信息
        this.logger.warn(`Provider failure reported`, {
          providerId,
          model: targetModel,
          originalModel: baseRequest?.model || 'unknown',
          errorMessage,
          httpCode,
          routingCategory: baseRequest?.metadata?.routingCategory || 'unknown',
          requestId,
          timestamp: new Date().toISOString()
        }, requestId, 'provider');
        
        this.routingEngine.recordProviderResult(
          providerId, 
          false, 
          errorMessage, 
          httpCode, 
          targetModel
        );

        // 记录详细的失败日志 (临时注释掉，稍后修复接口匹配)
        /*await this.pipelineDebugger.logFailure({
          timestamp: new Date().toISOString(),
          requestId,
          providerId,
          model: targetModel,
          originalModel: baseRequest?.model || 'unknown',
          error: errorMessage,
          httpCode,
          errorType: this.categorizeError(errorMessage, httpCode),
          requestDuration: Date.now() - startTime,
          routingCategory: baseRequest?.metadata?.routingCategory,
          sessionId: sessionManager.extractSessionId(request.headers as Record<string, string>),
          userAgent: (request.headers as any)['user-agent']
        });*/
      }
      
      // For ProviderError, preserve the original status code (especially 429)
      if (error instanceof ProviderError) {
        return reply.code(error.statusCode).send({
          error: {
            type: 'api_error',
            message: error.message
          }
        });
      }
      
      const serverErrorMessage = error instanceof Error ? error.message : 'Internal server error';
      return reply.code(500).send({
        error: {
          type: 'api_error',
          message: serverErrorMessage
        }
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
    try {
      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

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
      let outputTokens = 0;
      let chunkCount = 0;
      
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

      for await (const chunk of provider.sendStreamRequest(request)) {
        chunkCount++;
        // 只在trace级别记录chunk详情，避免刷屏
        this.logger.trace(`Streaming chunk ${chunkCount}`, { 
          event: chunk.event, 
          hasData: !!chunk.data,
          dataType: typeof chunk.data 
        }, requestId, 'streaming');
        
        // 智能停止信号处理：保留工具调用stop_reason，移除其他stop_reason
        if (chunk.event === 'message_delta' && chunk.data?.delta?.stop_reason) {
          const stopReason = chunk.data.delta.stop_reason;
          const isToolUse = stopReason === 'tool_use';
          
          if (isToolUse) {
            hasToolUse = true;
            // 工具调用完成 - 保留stop_reason以触发继续对话
            this.sendSSEEvent(reply, chunk.event, chunk.data);
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
            // 非工具调用 - 移除stop_reason防止会话终止
            const filteredData = { ...chunk.data };
            if (filteredData.delta) {
              filteredData.delta = { ...filteredData.delta };
              delete filteredData.delta.stop_reason;
              delete filteredData.delta.stop_sequence;
            }
            this.sendSSEEvent(reply, chunk.event, filteredData);
            this.logger.debug(`Removed non-tool stop_reason to prevent early termination: ${stopReason}`, {}, requestId, 'server');
          }
        } else if (chunk.event === 'message_stop') {
          // message_stop事件处理：只有工具调用时才发送
          if (hasToolUse) {
            this.sendSSEEvent(reply, chunk.event, chunk.data);
            this.logger.debug('Allowed message_stop event for proper tool calling workflow', {}, requestId, 'server');
          } else {
            this.logger.debug('Filtered out message_stop event to allow conversation continuation', {}, requestId, 'server');
          }
        } else {
          // 正常转发其他事件（包括工具调用相关事件）
          this.sendSSEEvent(reply, chunk.event, chunk.data);
        }
        
        // 计算输出tokens - 包括文本和工具调用内容
        if (chunk.event === 'content_block_delta') {
          if (chunk.data?.delta?.text) {
            // 文本内容
            const textLength = chunk.data.delta.text.length;
            outputTokens += Math.ceil(textLength / 4);
            // 移除刷屏的token计算日志
            // this.logger.trace(`Token calculation - text: "${chunk.data.delta.text}" (${textLength} chars = ${Math.ceil(textLength / 4)} tokens)`, {}, requestId, 'server');
          } else if (chunk.data?.delta?.type === 'input_json_delta' && chunk.data?.delta?.partial_json) {
            // 工具调用的JSON输入内容
            const jsonLength = chunk.data.delta.partial_json.length;
            outputTokens += Math.ceil(jsonLength / 4);
            // 移除刷屏的token计算日志
            // this.logger.trace(`Token calculation - tool JSON: "${chunk.data.delta.partial_json}" (${jsonLength} chars = ${Math.ceil(jsonLength / 4)} tokens)`, {}, requestId, 'server');
          }
        } else if (chunk.event === 'content_block_start' && chunk.data?.content_block?.type === 'tool_use') {
          // 工具调用开始 - 计算工具名称的token
          const toolName = chunk.data.content_block.name || '';
          const nameLength = toolName.length;
          outputTokens += Math.ceil(nameLength / 4);
          // 移除刷屏的token计算日志
          // this.logger.trace(`Token calculation - tool name: "${toolName}" (${nameLength} chars = ${Math.ceil(nameLength / 4)} tokens)`, {}, requestId, 'server');
        }
        
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
      this.logger.error('Streaming request failed', error, requestId, 'server');
      
      const errorMessage = error instanceof Error ? error.message : 'Stream processing failed';
      // Re-enable comprehensive failure logging (临时注释掉，稍后修复接口匹配)
        /*const failureData = {
          timestamp: new Date().toISOString(),
          requestId: requestId,
          port: this.config.server.port,
          provider: provider.name || 'unknown',
          model: request.metadata?.targetModel || request.model,
          key: 'streaming_key_not_available',
          errorCode: (error as any)?.response?.status || 500,
          reason: errorMessage
        };
        this.pipelineDebugger.logFailure(failureData);*/
      // Send error event
      this.sendSSEEvent(reply, 'error', {
        type: 'error',
        error: {
          type: 'overloaded_error',
          message: errorMessage
        }
      });
      
      reply.raw.end();
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