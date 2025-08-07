/**
 * Health Check Handler Module
 * 
 * 处理服务健康状态相关的请求
 * 按照细菌式编程原则：小巧、模块化、自包含
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { Provider } from '@/types';

export interface HealthHandlerDependencies {
  providers: Map<string, Provider>;
  logger: any;
  errorTracker: any;
  requestTracker: any;
}

export class HealthHandler {
  constructor(private deps: HealthHandlerDependencies) {}

  /**
   * 处理 /health 请求
   */
  async handleHealthCheck(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const healthStatus = await this.getHealthStatus();
      
      if (healthStatus.healthy) {
        reply.code(200).send(healthStatus);
      } else {
        reply.code(503).send(healthStatus);
      }
    } catch (error) {
      this.deps.logger.error('Health check failed', error);
      reply.code(500).send({
        status: 'error',
        message: 'Health check system failure'
      });
    }
  }

  /**
   * 处理 /status 请求
   */
  async handleStatusCheck(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const providerCount = this.deps.providers.size;
      const recommendations = this.generateHealthRecommendations({
        providerCount,
        errors: this.deps.errorTracker?.getErrorCount() || 0
      });

      reply.send({
        status: 'operational',
        providers: providerCount,
        timestamp: new Date().toISOString(),
        recommendations
      });
    } catch (error) {
      this.deps.logger.error('Status check failed', error);
      reply.code(500).send({
        status: 'error',
        message: 'Status check failure'
      });
    }
  }

  /**
   * 处理 /api/stats 请求
   */
  async handleStatsCheck(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const providerStats: Record<string, any> = {};
      
      for (const [providerId, provider] of this.deps.providers) {
        try {
          const isHealthy = await provider.isHealthy();
          providerStats[providerId] = {
            healthy: isHealthy,
            name: provider.name || providerId,
            type: this.getProviderType(providerId)
          };
        } catch (error) {
          providerStats[providerId] = {
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            name: provider.name || providerId,
            type: this.getProviderType(providerId)
          };
        }
      }

      const errorStats = this.deps.errorTracker?.getStats() || {};
      const requestStats = this.deps.requestTracker?.getStats() || {};

      reply.send({
        timestamp: new Date().toISOString(),
        providers: providerStats,
        errors: errorStats,
        requests: requestStats,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      });
    } catch (error) {
      this.deps.logger.error('Stats check failed', error);
      reply.code(500).send({
        status: 'error',
        message: 'Stats collection failure'
      });
    }
  }

  /**
   * 获取健康状态
   */
  private async getHealthStatus(): Promise<any> {
    const providerHealth: Record<string, boolean> = {};
    let healthyCount = 0;

    for (const [providerId, provider] of this.deps.providers) {
      try {
        const isHealthy = await provider.isHealthy();
        providerHealth[providerId] = isHealthy;
        if (isHealthy) healthyCount++;
      } catch (error) {
        providerHealth[providerId] = false;
        this.deps.logger.warn(`Provider ${providerId} health check failed:`, error);
      }
    }

    const totalProviders = this.deps.providers.size;
    const isHealthy = healthyCount > 0;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      healthy: isHealthy,
      providers: providerHealth,
      summary: {
        total: totalProviders,
        healthy: healthyCount,
        unhealthy: totalProviders - healthyCount
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  /**
   * 生成健康建议
   */
  private generateHealthRecommendations(stats: any): string[] {
    const recommendations: string[] = [];
    
    if (stats.providerCount === 0) {
      recommendations.push('No providers configured - add at least one provider');
    }
    
    if (stats.errors > 10) {
      recommendations.push('High error rate detected - check provider configurations');
    }
    
    return recommendations;
  }

  /**
   * 获取Provider类型
   */
  private getProviderType(providerId: string): 'anthropic' | 'openai' | 'gemini' | 'codewhisperer' {
    if (providerId.includes('anthropic')) return 'anthropic';
    if (providerId.includes('openai') || providerId.includes('modelscope') || providerId.includes('lmstudio')) return 'openai';
    if (providerId.includes('gemini') || providerId.includes('google')) return 'gemini';
    return 'codewhisperer';
  }
}

/**
 * 创建Health Handler实例的工厂函数
 */
export function createHealthHandler(deps: HealthHandlerDependencies): HealthHandler {
  return new HealthHandler(deps);
}