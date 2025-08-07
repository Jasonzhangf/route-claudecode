/**
 * Route Setup Module
 * 
 * 负责设置所有HTTP路由和中间件
 * 按照细菌式编程原则：小巧、模块化、自包含
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { HealthHandler } from '../handlers/health-handler';
import { AdminHandler } from '../handlers/admin-handler';
import { MessagesHandler } from '../handlers/messages-handler';

export interface RouteSetupDependencies {
  fastify: FastifyInstance;
  healthHandler: HealthHandler;
  adminHandler: AdminHandler;
  messagesHandler: MessagesHandler;
  logger: any;
  config: {
    server: {
      port: number;
    };
  };
}

export class RouteSetup {
  constructor(private deps: RouteSetupDependencies) {}

  /**
   * 设置所有路由
   */
  setupRoutes(): void {
    this.setupHealthRoutes();
    this.setupAdminRoutes();
    this.setupMessageRoutes();
    this.setupCompatibilityRoutes();
    
    this.deps.logger.info('All routes configured successfully');
  }

  /**
   * 设置健康检查路由
   */
  private setupHealthRoutes(): void {
    // 基础健康检查
    this.deps.fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.healthHandler.handleHealthCheck(request, reply);
    });

    // 详细状态检查
    this.deps.fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.healthHandler.handleStatusCheck(request, reply);
    });
  }

  /**
   * 设置管理API路由
   */
  private setupAdminRoutes(): void {
    // 系统统计
    this.deps.fastify.get('/api/stats', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleApiStats(request, reply);
    });

    // 简化统计
    this.deps.fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleStats(request, reply);
    });

    // 双重统计
    this.deps.fastify.get('/dual-stats', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleDualStats(request, reply);
    });

    // 失败记录
    this.deps.fastify.get('/api/failures', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleFailures(request, reply);
    });

    // Provider管理
    this.deps.fastify.post('/api/providers/:providerId/disable', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleProviderDisable(request, reply);
    });

    this.deps.fastify.post('/api/providers/:providerId/enable', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleProviderEnable(request, reply);
    });

    this.deps.fastify.get('/api/providers/temporary-disabled', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleTemporaryDisabled(request, reply);
    });

    // 系统控制
    this.deps.fastify.post('/shutdown', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleShutdown(request, reply);
    });

    // OpenAI客户端状态（兼容性）
    this.deps.fastify.get('/api/openai-client-status', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleOpenAIClientStatus(request, reply);
    });

    // 错误诊断
    this.deps.fastify.get('/api/error-diagnostics', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleErrorDiagnostics(request, reply);
    });
  }

  /**
   * 设置消息处理路由
   */
  private setupMessageRoutes(): void {
    // Anthropic格式的消息接口
    this.deps.fastify.post('/v1/messages', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.messagesHandler.handleMessagesRequest(request, reply);
    });

    // Token计数接口
    this.deps.fastify.post('/v1/messages/count_tokens', async (request: FastifyRequest, reply: FastifyReply) => {
      return this.deps.adminHandler.handleCountTokens(request, reply);
    });
  }

  /**
   * 设置兼容性路由
   */
  private setupCompatibilityRoutes(): void {
    // OpenAI兼容接口（转发到messages处理器）
    this.deps.fastify.post('/v1/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
      // 将OpenAI格式请求转换为Anthropic格式，然后使用相同的处理器
      return this.handleOpenAICompatibility(request, reply);
    });
  }

  /**
   * 设置请求钩子
   */
  setupHooks(): void {
    // 请求前钩子
    this.deps.fastify.addHook('onRequest', async (request, reply) => {
      const requestId = this.generateRequestId();
      (request as any).requestId = requestId;
      (request as any).startTime = Date.now();
      
      this.deps.logger.info('Incoming request', {
        method: request.method,
        url: request.url,
        requestId
      }, requestId, 'request');
    });

    // 响应后钩子
    this.deps.fastify.addHook('onResponse', async (request, reply) => {
      const requestId = (request as any).requestId;
      const startTime = (request as any).startTime || Date.now();
      const responseTime = Date.now() - startTime;
      
      this.deps.logger.info('Request completed', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: `${responseTime}ms`,
        requestId
      }, requestId, 'response');
    });

    this.deps.logger.info('Request hooks configured');
  }

  /**
   * 处理OpenAI客户端状态请求
   */
  private async handleOpenAIClientStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // 简化的OpenAI客户端状态响应
      const status = {
        status: 'operational',
        timestamp: new Date().toISOString(),
        port: this.deps.config.server.port,
        version: '2.8.0',
        openaiCompatible: true
      };
      
      reply.send(status);
    } catch (error) {
      this.deps.logger.error('OpenAI client status failed', error);
      reply.code(500).send({
        status: 'error',
        message: 'Status check failed'
      });
    }
  }

  /**
   * 处理OpenAI兼容性请求
   */
  private async handleOpenAICompatibility(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    try {
      // 这里应该将OpenAI格式转换为Anthropic格式
      // 为了简化，暂时直接转发给messages处理器
      this.deps.logger.info('Converting OpenAI request to Anthropic format', {
        originalUrl: request.url
      }, (request as any).requestId, 'compatibility');
      
      // 转换请求格式（简化实现）
      const openaiBody = request.body as any;
      const anthropicBody = this.convertOpenAIToAnthropic(openaiBody);
      
      // 修改请求体
      request.body = anthropicBody;
      
      // 使用messages处理器处理
      return this.deps.messagesHandler.handleMessagesRequest(request, reply);
      
    } catch (error) {
      this.deps.logger.error('OpenAI compatibility conversion failed', error);
      reply.code(500).send({
        error: {
          type: 'internal_server_error',
          message: 'Request format conversion failed'
        }
      });
    }
  }

  /**
   * 简化的OpenAI到Anthropic格式转换
   */
  private convertOpenAIToAnthropic(openaiBody: any): any {
    // 简化的转换逻辑
    return {
      model: openaiBody.model,
      messages: openaiBody.messages || [],
      max_tokens: openaiBody.max_tokens || 1024,
      stream: openaiBody.stream || false,
      tools: openaiBody.tools,
      tool_choice: openaiBody.tool_choice
    };
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * 创建Route Setup实例的工厂函数
 */
export function createRouteSetup(deps: RouteSetupDependencies): RouteSetup {
  return new RouteSetup(deps);
}