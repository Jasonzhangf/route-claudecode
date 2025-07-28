/**
 * HTTP Server for Claude Code Router
 * Handles incoming requests and routes them through the pipeline
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnthropicInputProcessor } from './input/anthropic';
import { RoutingEngine } from './routing';
import { AnthropicOutputProcessor } from './output/anthropic';
import { CodeWhispererClient } from './providers/codewhisperer';
import { EnhancedOpenAIClient } from './providers/openai';
import { RouterConfig, BaseRequest, ProviderConfig, Provider, RoutingCategory, CategoryRouting } from './types';
import { logger } from './utils/logger';
import { sessionManager } from './session/manager';
import { v4 as uuidv4 } from 'uuid';

export class RouterServer {
  private fastify: FastifyInstance;
  private config: RouterConfig;
  private inputProcessor: AnthropicInputProcessor;
  private routingEngine: RoutingEngine;
  private outputProcessor: AnthropicOutputProcessor;
  private providers: Map<string, Provider> = new Map();

  constructor(config: RouterConfig) {
    this.config = config;
    this.fastify = Fastify({
      logger: config.debug.enabled ? {
        level: config.debug.logLevel
      } : false
    });

    // Initialize components
    this.inputProcessor = new AnthropicInputProcessor();
    this.routingEngine = new RoutingEngine(config.routing as Record<RoutingCategory, CategoryRouting>);
    this.outputProcessor = new AnthropicOutputProcessor();

    // Initialize providers
    this.initializeProviders();
    
    // Setup routes
    this.setupRoutes();
    
    // Setup hooks if enabled
    if (config.debug.enabled) {
      this.setupHooks();
    }
  }

  /**
   * Initialize providers from configuration
   */
  private initializeProviders(): void {
    // Clear existing providers
    this.providers.clear();
    
    for (const [providerId, providerConfig] of Object.entries(this.config.providers)) {
      try {
        let client: Provider;
        
        if (providerConfig.type === 'codewhisperer') {
          client = new CodeWhispererClient(providerConfig);
        } else if (providerConfig.type === 'openai') {
          // Generic OpenAI-compatible client (works for Shuaihong, etc.)
          client = new EnhancedOpenAIClient(providerConfig, providerId);
        } else {
          logger.warn(`Unsupported provider type: ${providerConfig.type}`, { providerId });
          continue;
        }
        
        this.providers.set(providerId, client);
        logger.info(`Initialized provider: ${providerId}`, { 
          type: providerConfig.type,
          endpoint: providerConfig.endpoint 
        });
      } catch (error) {
        logger.error(`Failed to initialize provider: ${providerId}`, error);
      }
    }
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.fastify.get('/health', async (request, reply) => {
      const healthStatus = await this.getHealthStatus();
      
      if (healthStatus.overall === 'healthy') {
        reply.code(200).send(healthStatus);
      } else {
        reply.code(503).send(healthStatus);
      }
    });

    // Status endpoint
    this.fastify.get('/status', async (request, reply) => {
      reply.send({
        server: 'claude-code-router',
        version: '2.0.0',
        uptime: process.uptime(),
        providers: Array.from(this.providers.keys()),
        routing: this.routingEngine.getStats(),
        debug: this.config.debug.enabled
      });
    });

    // Main messages endpoint (Anthropic API compatible)
    this.fastify.post('/v1/messages', async (request, reply) => {
      return this.handleMessagesRequest(request, reply);
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
      
      logger.trace(requestId, 'server', 'Request received', {
        method: request.method,
        url: request.url,
        headers: request.headers
      });
    });

    this.fastify.addHook('onResponse', async (request, reply) => {
      const requestId = (request as any).requestId;
      const duration = Date.now() - ((request as any).startTime || Date.now());
      
      logger.trace(requestId, 'server', 'Response sent', {
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
    
    try {
      logger.info('Processing messages request', {}, requestId, 'server');

      // Step 0: Session Management
      const sessionId = sessionManager.extractSessionId(request.headers as Record<string, string>);
      const session = sessionManager.getOrCreateSession(sessionId);
      
      logger.debug('Session information', { 
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

      const baseRequest = await this.inputProcessor.process(request.body);
      
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
        logger.debug('Updated session tools', { 
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
          logger.debug('Restored session tools', { 
            sessionId, 
            toolCount: sessionTools.length 
          }, requestId);
        }
      }

      if (baseRequest.metadata?.system && Array.isArray(baseRequest.metadata.system)) {
        sessionManager.updateSessionSystem(sessionId, baseRequest.metadata.system);
        logger.debug('Updated session system', { 
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
          logger.debug('Restored session system', { 
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
      const providerId = await this.routingEngine.route(baseRequest, requestId);
      const provider = this.providers.get(providerId);

      if (!provider) {
        throw new Error(`Provider not found: ${providerId}`);
      }

      // Step 3: Send to provider
      let providerResponse;
      if (baseRequest.stream) {
        return this.handleStreamingRequest(baseRequest, provider, reply, requestId);
      } else {
        providerResponse = await provider.sendRequest(baseRequest);
      }

      // Step 4: Process output
      const finalResponse = await this.outputProcessor.process(providerResponse, baseRequest);
      
      // 修复：强制移除stop_reason，确保工具调用后会话可以继续
      if (finalResponse && 'stop_reason' in finalResponse) {
        delete (finalResponse as any).stop_reason;
        logger.debug('Removed stop_reason from final response to allow conversation continuation', {}, requestId, 'server');
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

      logger.info('Request processed successfully', {
        provider: providerId,
        responseType: finalResponse.type || 'message',
        sessionId
      }, requestId, 'server');

      // 最后一次确保移除stop_reason
      const cleanResponse = { ...finalResponse };
      delete (cleanResponse as any).stop_reason;
      
      return cleanResponse;

    } catch (error) {
      logger.error('Request processing failed', error, requestId, 'server');
      
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      return reply.code(500).send({
        error: {
          type: 'api_error',
          message: errorMessage
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

      // Send message start event
      // CRITICAL: Use targetModel from routing if available
      const modelForStreaming = request.metadata?.targetModel || request.model;
      
      logger.debug('Streaming message start model', {
        originalModel: request.model,
        targetModel: request.metadata?.targetModel,
        modelForStreaming,
        hasTargetModel: !!request.metadata?.targetModel
      }, requestId, 'streaming');
      
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
      // 修改：永远不设置停止原因，保持对话持续
      // let stopReason = 'end_turn'; // 注释掉默认停止原因
      
      for await (const chunk of provider.sendStreamRequest(request)) {
        chunkCount++;
        logger.debug(`[PIPELINE-NODE] Raw chunk ${chunkCount} from provider`, { event: chunk.event, dataType: typeof chunk.data, hasData: !!chunk.data }, requestId, 'server');
        // Token计算调试已完成，移除调试代码
        
        // 过滤掉可能包含停止信号的事件，但保留工具调用相关的事件
        if (chunk.event === 'message_delta' && chunk.data?.delta?.stop_reason) {
          // 移除 message_delta 中的停止原因，但保留其他数据
          const filteredData = { ...chunk.data };
          if (filteredData.delta) {
            filteredData.delta = { ...filteredData.delta };
            delete filteredData.delta.stop_reason;
            delete filteredData.delta.stop_sequence;
          }
          this.sendSSEEvent(reply, chunk.event, filteredData);
        } else if (chunk.event === 'message_stop') {
          // 跳过 message_stop 事件，避免会话终止
          logger.debug('Filtered out message_stop event to allow conversation continuation', {}, requestId, 'server');
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
            logger.debug(`Token calculation - text: "${chunk.data.delta.text}" (${textLength} chars = ${Math.ceil(textLength / 4)} tokens)`, {}, requestId, 'server');
          } else if (chunk.data?.delta?.type === 'input_json_delta' && chunk.data?.delta?.partial_json) {
            // 工具调用的JSON输入内容
            const jsonLength = chunk.data.delta.partial_json.length;
            outputTokens += Math.ceil(jsonLength / 4);
            logger.debug(`Token calculation - tool JSON: "${chunk.data.delta.partial_json}" (${jsonLength} chars = ${Math.ceil(jsonLength / 4)} tokens)`, {}, requestId, 'server');
          }
        } else if (chunk.event === 'content_block_start' && chunk.data?.content_block?.type === 'tool_use') {
          // 工具调用开始 - 计算工具名称的token
          const toolName = chunk.data.content_block.name || '';
          const nameLength = toolName.length;
          outputTokens += Math.ceil(nameLength / 4);
          logger.debug(`Token calculation - tool name: "${toolName}" (${nameLength} chars = ${Math.ceil(nameLength / 4)} tokens)`, {}, requestId, 'server');
        }
        
        // 修改：忽略所有停止原因，不捕获停止信号
        // if (chunk.event === 'stream_complete' && chunk.data?.stop_reason) {
        //   stopReason = chunk.data.stop_reason;
        // }
      }

      // 保留content_block_stop事件，这对工具调用完整性是必需的
      this.sendSSEEvent(reply, 'content_block_stop', {
        type: 'content_block_stop',
        index: 0
      });

      // 修改：只发送使用量信息，不包含停止原因
      this.sendSSEEvent(reply, 'message_delta', {
        type: 'message_delta',
        delta: {
          // stop_reason: stopReason, // 移除停止原因，但保持HTTP连接正常结束
          // stop_sequence: null      // 移除停止序列  
        },
        usage: {
          output_tokens: outputTokens
        }
      });

      // 修改：不发送message_stop，避免消息结束信号
      // this.sendSSEEvent(reply, 'message_stop', {
      //   type: 'message_stop'
      // });

      // 保持HTTP连接正常结束，避免连接悬挂
      reply.raw.end();

      logger.info('Streaming request completed', {
        messageId,
        outputTokens
      }, requestId, 'server');

    } catch (error) {
      logger.error('Streaming request failed', error, requestId, 'server');
      
      const errorMessage = error instanceof Error ? error.message : 'Stream processing failed';
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
        logger.debug(`Health check failed for provider ${providerId}`, error);
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
      
      logger.info(`Claude Code Router started`, {
        host,
        port,
        providers: Array.from(this.providers.keys()),
        debug: this.config.debug.enabled
      });

      console.log(`🚀 Claude Code Router listening on http://${host}:${port}`);
      console.log(`📊 Available endpoints:`);
      console.log(`   POST /v1/messages  - Anthropic API proxy`);
      console.log(`   GET  /health       - Health check`);
      console.log(`   GET  /status       - Server status`);
      
      if (this.config.debug.enabled) {
        console.log(`🔍 Debug mode enabled - logs saved to ${this.config.debug.logDir}`);
      }

    } catch (error) {
      logger.error('Failed to start server', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    try {
      await this.fastify.close();
      logger.info('Server stopped');
    } catch (error) {
      logger.error('Error stopping server', error);
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
    
    logger.info('Server configuration updated');
  }
}