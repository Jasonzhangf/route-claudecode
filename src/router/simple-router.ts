/**
 * 简单路由器 - 基础路由功能实现
 *
 * 提供基本的请求路由和Provider选择功能
 *
 * @author RCC v4.0
 */

import { secureLogger } from '../utils/secure-logger';

/**
 * 路由配置接口
 */
export interface RoutingConfig {
  defaultProvider: string;
  rules: RoutingRule[];
  providers: Record<string, ProviderConfig>;
}

/**
 * 路由规则
 */
export interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: RouteCondition[];
  targetProvider: string;
  targetModel?: string;
}

/**
 * 路由条件
 */
export interface RouteCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'regex';
  value: string | number;
}

/**
 * Provider配置
 */
export interface ProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  type: string;
  connection: {
    baseUrl: string;
    apiKey?: string;
    timeout?: number;
    maxRetries?: number;
  };
  models: {
    supportedModels: string[];
    defaultModel: string;
  };
}

/**
 * Provider端点配置
 */
export interface ProviderEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  capabilities: string[];
}

/**
 * 路由结果
 */
export interface RouteResult {
  provider: string;
  model: string;
  endpoint: ProviderEndpoint;
  rule?: RoutingRule;
}

/**
 * 简单路由器类
 */
export class SimpleRouter {
  private config: RoutingConfig;
  private logger = secureLogger;

  constructor(config: RoutingConfig) {
    this.config = config;
  }

  /**
   * 路由请求到合适的Provider
   */
  async route(request: any): Promise<RouteResult> {
    try {
      // 根据路由规则选择Provider
      const matchedRule = this.findMatchingRule(request);
      const provider = matchedRule?.targetProvider || this.config.defaultProvider;
      
      // 获取Provider配置
      const providerConfig = this.config.providers[provider];
      if (!providerConfig) {
        throw new Error(`Provider not found: ${provider}`);
      }

      // 选择模型
      const model = matchedRule?.targetModel || 
                   request.model || 
                   providerConfig.models.defaultModel;

      // 构建端点信息
      const endpoint: ProviderEndpoint = {
        id: providerConfig.id,
        name: providerConfig.name,
        baseUrl: providerConfig.connection.baseUrl,
        apiKey: providerConfig.connection.apiKey,
        models: providerConfig.models.supportedModels,
        capabilities: ['chat', 'completion']
      };

      this.logger.info('Request routed successfully', {
        provider,
        model,
        rule: matchedRule?.id
      });

      return {
        provider,
        model,
        endpoint,
        rule: matchedRule
      };

    } catch (error) {
      this.logger.error('Routing failed', { error });
      throw error;
    }
  }

  /**
   * 查找匹配的路由规则
   */
  private findMatchingRule(request: any): RoutingRule | null {
    const enabledRules = this.config.rules
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of enabledRules) {
      if (this.evaluateConditions(rule.conditions, request)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * 评估路由条件
   */
  private evaluateConditions(conditions: RouteCondition[], request: any): boolean {
    if (conditions.length === 0) {
      return true; // 无条件匹配所有请求
    }

    return conditions.every(condition => {
      const fieldValue = this.getFieldValue(request, condition.field);
      return this.evaluateCondition(condition, fieldValue);
    });
  }

  /**
   * 获取字段值
   */
  private getFieldValue(request: any, field: string): any {
    const fields = field.split('.');
    let value = request;
    
    for (const f of fields) {
      value = value?.[f];
    }
    
    return value;
  }

  /**
   * 评估单个条件
   */
  private evaluateCondition(condition: RouteCondition, fieldValue: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'regex':
        return new RegExp(String(condition.value)).test(String(fieldValue));
      default:
        return false;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: RoutingConfig): void {
    this.config = config;
    this.logger.info('Router configuration updated');
  }

  /**
   * 获取当前配置
   */
  getConfig(): RoutingConfig {
    return { ...this.config };
  }

  /**
   * 获取可用Providers
   */
  getAvailableProviders(): string[] {
    return Object.keys(this.config.providers)
      .filter(id => this.config.providers[id].enabled);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const availableProviders = this.getAvailableProviders();
    
    return {
      healthy: availableProviders.length > 0,
      details: {
        availableProviders,
        totalRules: this.config.rules.length,
        enabledRules: this.config.rules.filter(r => r.enabled).length
      }
    };
  }
}

/**
 * 创建简单路由器实例
 */
export function createSimpleRouter(config: RoutingConfig): SimpleRouter {
  return new SimpleRouter(config);
}

/**
 * 默认路由配置
 */
export const defaultRoutingConfig: RoutingConfig = {
  defaultProvider: 'default',
  rules: [],
  providers: {}
};