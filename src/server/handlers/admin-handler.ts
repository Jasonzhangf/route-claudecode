/**
 * Admin API Handler Module
 * 
 * 处理管理相关的API请求（stats、provider管理、shutdown等）
 * 按照细菌式编程原则：小巧、模块化、自包含
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { Provider } from '@/types';

export interface AdminHandlerDependencies {
  providers: Map<string, Provider>;
  logger: any;
  errorTracker?: any;
  requestTracker?: any;
  config: {
    server: {
      port: number;
    };
  };
}

export class AdminHandler {
  constructor(private deps: AdminHandlerDependencies) {}

  /**
   * 处理 /api/stats 请求
   */
  async handleApiStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const stats = await this.collectSystemStats();
      reply.send(stats);
    } catch (error) {
      this.deps.logger.error('API stats collection failed', error);
      reply.code(500).send({
        error: {
          type: 'internal_server_error',
          message: 'Stats collection failed'
        }
      });
    }
  }

  /**
   * 处理 /stats 请求（简化版本）
   */
  async handleStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const basicStats = {
        timestamp: new Date().toISOString(),
        providers: this.deps.providers.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        port: this.deps.config.server.port
      };
      
      reply.send(basicStats);
    } catch (error) {
      this.deps.logger.error('Basic stats collection failed', error);
      reply.code(500).send({
        error: 'Stats unavailable'
      });
    }
  }

  /**
   * 处理 /dual-stats 请求
   */
  async handleDualStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const [systemStats, providerStats] = await Promise.all([
        this.collectSystemStats(),
        this.collectProviderStats()
      ]);
      
      reply.send({
        system: systemStats,
        providers: providerStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.deps.logger.error('Dual stats collection failed', error);
      reply.code(500).send({
        error: 'Dual stats collection failed'
      });
    }
  }

  /**
   * 处理 /api/failures 请求
   */
  async handleFailures(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const failures = this.deps.errorTracker?.getFailures() || [];
      const recentFailures = failures.slice(-50); // 最近50个失败
      
      reply.send({
        total: failures.length,
        recent: recentFailures.length,
        failures: recentFailures,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.deps.logger.error('Failures collection failed', error);
      reply.code(500).send({
        error: 'Failures data unavailable'
      });
    }
  }

  /**
   * 处理 /api/providers/:providerId/disable 请求
   */
  async handleProviderDisable(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { providerId } = request.params as { providerId: string };
      const provider = this.deps.providers.get(providerId);
      
      if (!provider) {
        return reply.code(404).send({
          error: {
            type: 'not_found',
            message: `Provider '${providerId}' not found`
          }
        });
      }
      
      // 假设provider有disable方法
      if ('disable' in provider && typeof provider.disable === 'function') {
        await (provider as any).disable();
      }
      
      this.deps.logger.info(`Provider ${providerId} disabled via API`);
      
      reply.send({
        message: `Provider ${providerId} disabled successfully`,
        providerId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.deps.logger.error('Provider disable failed', error);
      reply.code(500).send({
        error: 'Provider disable operation failed'
      });
    }
  }

  /**
   * 处理 /api/providers/:providerId/enable 请求
   */
  async handleProviderEnable(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { providerId } = request.params as { providerId: string };
      const provider = this.deps.providers.get(providerId);
      
      if (!provider) {
        return reply.code(404).send({
          error: {
            type: 'not_found',
            message: `Provider '${providerId}' not found`
          }
        });
      }
      
      // 假设provider有enable方法
      if ('enable' in provider && typeof provider.enable === 'function') {
        await (provider as any).enable();
      }
      
      this.deps.logger.info(`Provider ${providerId} enabled via API`);
      
      reply.send({
        message: `Provider ${providerId} enabled successfully`,
        providerId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.deps.logger.error('Provider enable failed', error);
      reply.code(500).send({
        error: 'Provider enable operation failed'
      });
    }
  }

  /**
   * 处理 /api/providers/temporary-disabled 请求
   */
  async handleTemporaryDisabled(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const disabledProviders = [];
      
      for (const [providerId, provider] of this.deps.providers) {
        const isHealthy = await provider.isHealthy();
        if (!isHealthy) {
          disabledProviders.push({
            providerId,
            name: provider.name || providerId,
            reason: 'Health check failed'
          });
        }
      }
      
      reply.send({
        count: disabledProviders.length,
        providers: disabledProviders,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.deps.logger.error('Temporary disabled providers check failed', error);
      reply.code(500).send({
        error: 'Unable to check disabled providers'
      });
    }
  }

  /**
   * 处理 /shutdown 请求
   */
  async handleShutdown(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      this.deps.logger.info('Shutdown requested via API');
      
      reply.send({
        message: 'Server shutdown initiated',
        timestamp: new Date().toISOString()
      });
      
      // 延迟关闭以确保响应发送完成
      setTimeout(() => {
        this.deps.logger.info('Shutting down server...');
        process.exit(0);
      }, 1000);
    } catch (error) {
      this.deps.logger.error('Shutdown request failed', error);
      reply.code(500).send({
        error: 'Shutdown operation failed'
      });
    }
  }

  /**
   * 处理 /v1/messages/count_tokens 请求
   */
  async handleCountTokens(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = request.body as any;
      if (!body || !body.messages) {
        return reply.code(400).send({
          error: {
            type: 'invalid_request_error',
            message: 'Missing required field: messages'
          }
        });
      }

      // 使用tokenizer计算tokens
      const { calculateTokenCount } = await import('@/utils/tokenizer');
      const inputTokens = calculateTokenCount(body.messages);
      
      reply.send({
        input_tokens: inputTokens
      });
      
    } catch (error) {
      this.deps.logger.error('Token count calculation failed', error);
      reply.code(500).send({
        error: {
          type: 'internal_server_error',
          message: 'Failed to count tokens'
        }
      });
    }
  }

  /**
   * 处理 /api/error-diagnostics 请求
   */
  async handleErrorDiagnostics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const diagnostics = {
        timestamp: new Date().toISOString(),
        errors: {
          total: this.deps.errorTracker?.getErrorCount() || 0,
          byProvider: this.deps.errorTracker?.getErrorsByProvider() || {},
          recent: this.deps.errorTracker?.getRecentErrors(10) || []
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          port: this.deps.config.server.port
        },
        providers: await this.collectProviderDiagnostics()
      };
      
      reply.send(diagnostics);
    } catch (error) {
      this.deps.logger.error('Error diagnostics collection failed', error);
      reply.code(500).send({
        error: 'Diagnostics collection failed'
      });
    }
  }

  /**
   * 收集系统统计信息
   */
  private async collectSystemStats(): Promise<any> {
    return {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        port: this.deps.config.server.port,
        nodeVersion: process.version
      },
      providers: {
        total: this.deps.providers.size,
        list: Array.from(this.deps.providers.keys())
      },
      errors: this.deps.errorTracker?.getStats() || {},
      requests: this.deps.requestTracker?.getStats() || {}
    };
  }

  /**
   * 收集Provider统计信息
   */
  private async collectProviderStats(): Promise<any> {
    const providerStats: Record<string, any> = {};
    
    for (const [providerId, provider] of this.deps.providers) {
      try {
        const isHealthy = await provider.isHealthy();
        providerStats[providerId] = {
          name: provider.name || providerId,
          healthy: isHealthy,
          type: this.getProviderType(providerId)
        };
      } catch (error) {
        providerStats[providerId] = {
          name: provider.name || providerId,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: this.getProviderType(providerId)
        };
      }
    }
    
    return providerStats;
  }

  /**
   * 收集Provider诊断信息
   */
  private async collectProviderDiagnostics(): Promise<any> {
    const diagnostics: Record<string, any> = {};
    
    for (const [providerId, provider] of this.deps.providers) {
      try {
        const isHealthy = await provider.isHealthy();
        diagnostics[providerId] = {
          name: provider.name || providerId,
          healthy: isHealthy,
          type: this.getProviderType(providerId),
          lastCheck: new Date().toISOString()
        };
        
        // 如果provider有额外的诊断信息
        if ('getDiagnostics' in provider && typeof provider.getDiagnostics === 'function') {
          diagnostics[providerId].details = await (provider as any).getDiagnostics();
        }
      } catch (error) {
        diagnostics[providerId] = {
          name: provider.name || providerId,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: this.getProviderType(providerId),
          lastCheck: new Date().toISOString()
        };
      }
    }
    
    return diagnostics;
  }

  /**
   * 获取Provider类型
   */
  private getProviderType(providerId: string): string {
    if (providerId.includes('anthropic')) return 'anthropic';
    if (providerId.includes('openai') || providerId.includes('modelscope') || providerId.includes('lmstudio')) return 'openai';
    if (providerId.includes('gemini') || providerId.includes('google')) return 'gemini';
    return 'codewhisperer';
  }
}

/**
 * 创建Admin Handler实例的工厂函数
 */
export function createAdminHandler(deps: AdminHandlerDependencies): AdminHandler {
  return new AdminHandler(deps);
}