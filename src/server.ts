/**
 * HTTP Server for Claude Code Router
 * Handles incoming requests and routes them through the pipeline
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AnthropicInputProcessor } from './input/anthropic';
import { RoutingEngine } from './routing';
import { AnthropicOutputProcessor } from './output/anthropic';
import { CodeWhispererClient } from './providers/codewhisperer';
import { OpenAICompatibleClient } from './providers/openai';
import { RouterConfig, BaseRequest, ProviderConfig, Provider } from './types';
import { logger } from './utils/logger';
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
    this.routingEngine = new RoutingEngine(config.routing);
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
    
    for (const [providerId, providerConfig] of Object.entries(this.config.routing.providers)) {
      try {
        let client: Provider;
        
        if (providerConfig.type === 'codewhisperer') {
          client = new CodeWhispererClient(providerConfig);
        } else if (providerConfig.type === 'openai') {
          // Generic OpenAI-compatible client (works for Shuaihong, etc.)
          client = new OpenAICompatibleClient(providerConfig, providerId);
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
      baseRequest.metadata = { ...baseRequest.metadata, requestId };

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

      logger.info('Request processed successfully', {
        provider: providerId,
        responseType: finalResponse.type || 'message'
      }, requestId, 'server');

      return finalResponse;

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
      this.sendSSEEvent(reply, 'message_start', {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: request.model,
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
      for await (const chunk of provider.sendStreamRequest(request)) {
        this.sendSSEEvent(reply, chunk.event, chunk.data);
        
        if (chunk.event === 'content_block_delta' && chunk.data?.delta?.text) {
          outputTokens += Math.ceil(chunk.data.delta.text.length / 4);
        }
      }

      // Send content block stop
      this.sendSSEEvent(reply, 'content_block_stop', {
        type: 'content_block_stop',
        index: 0
      });

      // Send message delta with final usage
      this.sendSSEEvent(reply, 'message_delta', {
        type: 'message_delta',
        delta: {
          stop_reason: 'end_turn',
          stop_sequence: null
        },
        usage: {
          output_tokens: outputTokens
        }
      });

      // Send message stop
      this.sendSSEEvent(reply, 'message_stop', {
        type: 'message_stop'
      });

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
    this.routingEngine.updateConfig(config.routing);
    
    // Reinitialize providers if needed
    this.initializeProviders();
    
    logger.info('Server configuration updated');
  }
}