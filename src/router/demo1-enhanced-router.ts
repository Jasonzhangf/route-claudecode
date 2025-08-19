/**
 * DEPRECATED: This file has been replaced by src/modules/routing/core-router.ts
 *
 * ❌ DO NOT USE: This demo1 enhanced router is deprecated
 * ✅ USE INSTEAD: src/modules/routing/core-router.ts - CoreRouter
 *
 * Demo routing logic should be moved to separate demo modules.
 *
 * @deprecated Use CoreRouter from src/modules/routing/core-router.ts instead
 * @see src/modules/routing/core-router.ts
 */

import { get_encoding } from 'tiktoken';
import { secureLogger } from '../utils/secure-logger';
import { MultiKeyManager } from './multi-key-manager';

const enc = get_encoding('cl100k_base');

export class Demo1EnhancedRouter {
  private multiKeyManager: MultiKeyManager;

  constructor(private config: any) {
    this.multiKeyManager = new MultiKeyManager(config);
    this.initializePeriodicReset();
  }

  /**
   * 完全复制demo1的token计算逻辑
   */
  private calculateTokenCount(messages: any[], system: any, tools: any[]): number {
    let tokenCount = 0;

    if (Array.isArray(messages)) {
      messages.forEach(message => {
        if (typeof message.content === 'string') {
          tokenCount += enc.encode(message.content).length;
        } else if (Array.isArray(message.content)) {
          message.content.forEach((contentPart: any) => {
            if (contentPart.type === 'text') {
              tokenCount += enc.encode(contentPart.text).length;
            } else if (contentPart.type === 'tool_use') {
              tokenCount += enc.encode(JSON.stringify(contentPart.input)).length;
            } else if (contentPart.type === 'tool_result') {
              tokenCount += enc.encode(
                typeof contentPart.content === 'string' ? contentPart.content : JSON.stringify(contentPart.content)
              ).length;
            }
          });
        }
      });
    }

    if (typeof system === 'string') {
      tokenCount += enc.encode(system).length;
    } else if (Array.isArray(system)) {
      system.forEach((item: any) => {
        if (item.type !== 'text') return;
        if (typeof item.text === 'string') {
          tokenCount += enc.encode(item.text).length;
        } else if (Array.isArray(item.text)) {
          item.text.forEach((textPart: any) => {
            tokenCount += enc.encode(textPart || '').length;
          });
        }
      });
    }

    if (tools) {
      tools.forEach((tool: any) => {
        if (tool.description) {
          tokenCount += enc.encode(tool.name + tool.description).length;
        }
        if (tool.input_schema) {
          tokenCount += enc.encode(JSON.stringify(tool.input_schema)).length;
        }
      });
    }

    return tokenCount;
  }

  /**
   * 完全复制demo1的路由选择逻辑
   */
  private getUseModel(req: any, tokenCount: number): string {
    if (req.body.model.includes(',')) {
      return req.body.model;
    }

    // 1. 长文档检测 - tokenCount > 60K
    if (tokenCount > 1000 * 60 && this.config.Router.longContext) {
      secureLogger.info('Using long context model due to token count', { tokenCount });
      return this.config.Router.longContext;
    }

    // 2. 轻量模型检测 - claude-3-5-haiku
    if (req.body.model?.startsWith('claude-3-5-haiku') && this.config.Router.background) {
      secureLogger.info('Using background model for', { model: req.body.model });
      return this.config.Router.background;
    }

    // 3. 推理模式检测 - thinking参数
    if (req.body.thinking && this.config.Router.think) {
      secureLogger.info('Using think model for', { thinking: req.body.thinking });
      return this.config.Router.think;
    }

    // 4. Web搜索检测 - web_search工具
    if (
      Array.isArray(req.body.tools) &&
      req.body.tools.some((tool: any) => tool.type?.startsWith('web_search')) &&
      this.config.Router.webSearch
    ) {
      secureLogger.info('Using web search model for tools');
      return this.config.Router.webSearch;
    }

    // 5. 默认路由
    return this.config.Router.default;
  }

  /**
   * 解析路由配置获取provider和model
   */
  private parseRouterConfig(routerValue: string): { providerName: string; modelName: string } | null {
    if (!routerValue || !routerValue.includes(',')) {
      secureLogger.error('Invalid router config format', { routerValue });
      return null;
    }

    const [providerName, modelName] = routerValue.split(',');
    return { providerName: providerName.trim(), modelName: modelName.trim() };
  }

  /**
   * 主路由处理函数
   */
  async route(req: any): Promise<{
    providerName: string;
    modelName: string;
    apiKey: string;
    apiBaseUrl: string;
    transformer?: any;
  } | null> {
    try {
      const { messages, system = [], tools } = req.body;

      // 1. 计算token数量
      const tokenCount = this.calculateTokenCount(messages || [], system, tools || []);

      // 2. 获取路由规则（完全按demo1逻辑）
      const routerValue = this.getUseModel(req, tokenCount);

      // 3. 解析路由配置
      const routeConfig = this.parseRouterConfig(routerValue);
      if (!routeConfig) {
        return null;
      }

      // 4. 获取可用的API Key（多key轮询）
      const apiKey = this.multiKeyManager.getNextApiKey(routeConfig.providerName);
      if (!apiKey) {
        secureLogger.error('No available API key for provider', {
          providerName: routeConfig.providerName,
        });
        return null;
      }

      // 5. 获取Provider配置
      const provider = this.findProvider(routeConfig.providerName);
      if (!provider) {
        secureLogger.error('Provider not found', {
          providerName: routeConfig.providerName,
        });
        return null;
      }

      secureLogger.info('Route selected', {
        providerName: routeConfig.providerName,
        modelName: routeConfig.modelName,
        tokenCount,
        routerValue,
      });

      return {
        providerName: routeConfig.providerName,
        modelName: routeConfig.modelName,
        apiKey,
        apiBaseUrl: provider.api_base_url,
        transformer: provider.transformer,
      };
    } catch (error: any) {
      secureLogger.error('Error in router', { error: error.message });

      // 降级到默认路由
      const defaultRoute = this.parseRouterConfig(this.config.Router.default);
      if (defaultRoute) {
        const apiKey = this.multiKeyManager.getNextApiKey(defaultRoute.providerName);
        const provider = this.findProvider(defaultRoute.providerName);

        if (apiKey && provider) {
          return {
            providerName: defaultRoute.providerName,
            modelName: defaultRoute.modelName,
            apiKey,
            apiBaseUrl: provider.api_base_url,
            transformer: provider.transformer,
          };
        }
      }

      return null;
    }
  }

  /**
   * 查找Provider配置
   */
  private findProvider(providerName: string): any {
    if (!this.config.Providers) return null;
    return this.config.Providers.find((p: any) => p.name === providerName) || null;
  }

  /**
   * 标记API Key失败
   */
  markKeyFailed(providerName: string, apiKey: string, error: any): void {
    this.multiKeyManager.markKeyFailed(providerName, apiKey, error);
  }

  /**
   * 获取路由器统计信息
   */
  getStats(): any {
    const stats: any = {};

    if (this.config.Providers) {
      for (const provider of this.config.Providers) {
        stats[provider.name] = this.multiKeyManager.getProviderStats(provider.name);
      }
    }

    return stats;
  }

  /**
   * 初始化周期性统计重置（每小时）
   */
  private initializePeriodicReset(): void {
    const resetInterval = this.config.MultiKeyConfig?.loadBalancing?.resetInterval || 3600000;

    setInterval(() => {
      this.multiKeyManager.resetStats();
    }, resetInterval);

    secureLogger.info('Periodic stats reset initialized', {
      intervalMs: resetInterval,
    });
  }
}
