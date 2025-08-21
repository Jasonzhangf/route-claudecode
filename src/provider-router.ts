/**
 * Provider路由器 - 管理多个AI Provider的路由
 *
 * 负责将请求路由到合适的AI Provider
 *
 * @author RCC v4.0
 */

import { SimpleRouter, RoutingConfig, RouteResult } from './router/simple-router';
import { secureLogger } from './utils/secure-logger';

/**
 * Provider路由器配置
 */
export interface ProviderRouterConfig {
  routing: RoutingConfig;
  debug?: boolean;
}

/**
 * Provider路由器类
 */
export class ProviderRouter {
  private router: SimpleRouter;
  private config: ProviderRouterConfig;
  private logger = secureLogger;

  constructor(config: ProviderRouterConfig) {
    this.config = config;
    this.router = new SimpleRouter(config.routing);
    
    this.logger.info('ProviderRouter initialized', {
      providers: Object.keys(config.routing.providers).length,
      rules: config.routing.rules.length
    });
  }

  /**
   * 路由请求到Provider
   */
  async route(request: any): Promise<RouteResult> {
    try {
      this.logger.info('Routing request to provider', { 
        model: request.model,
        messageCount: request.messages?.length 
      });

      const result = await this.router.route(request);
      
      this.logger.info('Request routed successfully', {
        provider: result.provider,
        model: result.model,
        endpoint: result.endpoint.baseUrl
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to route request', { error });
      throw error;
    }
  }

  /**
   * 获取可用Providers
   */
  getAvailableProviders(): string[] {
    return this.router.getAvailableProviders();
  }

  /**
   * 更新路由配置
   */
  updateConfig(config: ProviderRouterConfig): void {
    this.config = config;
    this.router.updateConfig(config.routing);
    
    this.logger.info('ProviderRouter configuration updated');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const routerHealth = await this.router.healthCheck();
      
      return {
        healthy: routerHealth.healthy,
        details: {
          router: routerHealth.details,
          config: {
            providersCount: Object.keys(this.config.routing.providers).length,
            rulesCount: this.config.routing.rules.length
          }
        }
      };
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return {
        healthy: false,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * 获取路由统计信息
   */
  getStats(): any {
    return {
      availableProviders: this.getAvailableProviders(),
      totalProviders: Object.keys(this.config.routing.providers).length,
      totalRules: this.config.routing.rules.length,
      enabledRules: this.config.routing.rules.filter(r => r.enabled).length
    };
  }

  /**
   * 静态方法：路由到真实Provider (兼容legacy代码)
   */
  static async routeToRealProvider(request: any, config: any, requestId?: string): Promise<any> {
    secureLogger.info('Legacy routeToRealProvider called', { requestId });
    
    // 创建临时路由器实例
    const tempRouter = new ProviderRouter({
      routing: config.routing || config,
      debug: config.debug || false
    });
    
    try {
      const result = await tempRouter.route(request);
      return result;
    } catch (error) {
      secureLogger.error('Legacy routeToRealProvider failed', { error, requestId });
      throw error;
    }
  }
}

/**
 * 创建Provider路由器实例
 */
export function createProviderRouter(config: ProviderRouterConfig): ProviderRouter {
  return new ProviderRouter(config);
}

/**
 * 默认Provider路由器配置
 */
export const defaultProviderRouterConfig: ProviderRouterConfig = {
  routing: {
    defaultProvider: 'default',
    rules: [],
    providers: {}
  },
  debug: false
};