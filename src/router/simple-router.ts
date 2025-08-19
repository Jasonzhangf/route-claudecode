/**
 * DEPRECATED: This file has been replaced by src/modules/routing/core-router.ts
 *
 * ❌ DO NOT USE: This simple router is deprecated
 * ✅ USE INSTEAD: src/modules/routing/core-router.ts - CoreRouter
 *
 * The new CoreRouter provides pure routing decisions with zero fallback policy.
 * Key management and load balancing are handled by separate modules.
 *
 * @deprecated Use CoreRouter from src/modules/routing/core-router.ts instead
 * @see src/modules/routing/core-router.ts
 */

import { secureLogger } from '../utils/secure-logger';
import { VirtualModelMapper, VirtualModelType } from './virtual-model-mapping';

export interface ProviderEndpoint {
  providerId: string;
  model: string;
  weight: number;
  apiKeys: string[];
  endpoint: string;
  currentKeyIndex: number;
  maxTokens?: number; // User's maxTokens configuration
  blacklist: {
    keyIndex: number;
    until: Date;
    reason: string;
  }[];
}

export interface VirtualModelConfig {
  virtualModel: VirtualModelType;
  providers: ProviderEndpoint[];
}

export interface RoutingConfig {
  virtualModels: Record<string, VirtualModelConfig>;
  blacklistSettings: {
    timeout429: number; // 429错误blacklist时间 (毫秒)
    timeoutError: number; // 其他错误blacklist时间
  };
}

export interface RoutingDecision {
  originalModel: string;
  virtualModel: VirtualModelType;
  selectedProvider: string;
  selectedModel: string;
  selectedEndpoint: string;
  selectedApiKey: string;
  reasoning: string;
}

export class RouterError extends Error {
  constructor(
    message: string,
    public readonly errorType: 'NO_CONFIG' | 'NO_VIRTUAL_MODEL' | 'NO_PROVIDER' | 'ALL_BLACKLISTED'
  ) {
    super(message);
    this.name = 'RouterError';
  }
}

/**
 * 简化路由器
 * 零fallback策略 - 失败时立即抛出错误
 */
export class SimpleRouter {
  private config: RoutingConfig;

  constructor(config: RoutingConfig) {
    this.config = config;
  }

  /**
   * 进行路由决策 - 使用demo1风格的简单直接路由
   * @param inputModel 输入模型名称
   * @param request 完整请求对象
   * @returns 路由决策结果
   * @throws RouterError 如果无法路由
   */
  route(inputModel: string, request: any): RoutingDecision {
    // Step 1: 根据demo1逻辑选择目标虚拟模型
    const virtualModel = this.getTargetVirtualModel(inputModel, request);

    // Step 2: 检查虚拟模型配置是否存在
    const virtualConfig = this.config.virtualModels[virtualModel];
    if (!virtualConfig) {
      throw new RouterError(`缺少路由配置：无法找到虚拟模型 '${virtualModel}' 的配置`, 'NO_VIRTUAL_MODEL');
    }

    // Step 3: 负载均衡选择Provider
    const selectedProvider = this.selectProvider(virtualConfig.providers);

    secureLogger.info('Routing decision completed', {
      originalModel: inputModel,
      virtualModel,
      selectedProvider: selectedProvider.providerId,
      selectedModel: selectedProvider.model,
    });

    return {
      originalModel: inputModel,
      virtualModel,
      selectedProvider: selectedProvider.providerId,
      selectedModel: selectedProvider.model,
      selectedEndpoint: selectedProvider.endpoint,
      selectedApiKey: selectedProvider.apiKeys[selectedProvider.currentKeyIndex],
      reasoning: `${inputModel} → ${virtualModel} → ${selectedProvider.providerId}.${selectedProvider.model}`,
    };
  }

  /**
   * 根据demo1逻辑确定目标虚拟模型
   * 参考demo1/src/utils/router.ts的getUseModel函数
   */
  private getTargetVirtualModel(inputModel: string, request: any): VirtualModelType {
    // 计算token数量
    const tokenCount = this.calculateTokenCount(request);

    // 1. 长上下文检测 (>60K tokens)
    if (tokenCount > 60000) {
      secureLogger.info('Using longContext model due to token count', { tokenCount });
      return VirtualModelType.LONG_CONTEXT;
    }

    // 2. Claude 3.5 Haiku → 背景任务
    if (inputModel?.startsWith('claude-3-5-haiku')) {
      secureLogger.info('Using background model for claude-3-5-haiku', { inputModel });
      return VirtualModelType.BACKGROUND;
    }

    // 3. 推理模型检测 (包含thinking参数)
    if (request.thinking) {
      secureLogger.info('Using reasoning model for thinking request', { thinking: request.thinking });
      return VirtualModelType.REASONING;
    }

    // 4. Web搜索工具检测
    if (Array.isArray(request.tools) && request.tools.some((tool: any) => 
        tool.type?.startsWith('web_search') || tool.name?.includes('search'))) {
      secureLogger.info('Using webSearch model for web search tools');
      return VirtualModelType.WEB_SEARCH;
    }

    // 5. 默认规则
    secureLogger.info('Using default model', { inputModel });
    return VirtualModelType.DEFAULT;
  }

  /**
   * 计算token数量 (参考demo1的实现)
   */
  private calculateTokenCount(request: any): number {
    let tokenCount = 0;

    // 计算messages token
    if (Array.isArray(request.messages)) {
      request.messages.forEach((message: any) => {
        if (typeof message.content === 'string') {
          tokenCount += Math.ceil(message.content.length / 4); // 简化估算：4个字符≈1个token
        } else if (Array.isArray(message.content)) {
          message.content.forEach((contentPart: any) => {
            if (contentPart.type === 'text') {
              tokenCount += Math.ceil(contentPart.text.length / 4);
            } else if (contentPart.type === 'tool_use') {
              tokenCount += Math.ceil(JSON.stringify(contentPart.input).length / 4);
            } else if (contentPart.type === 'tool_result') {
              const content = typeof contentPart.content === 'string' 
                ? contentPart.content 
                : JSON.stringify(contentPart.content);
              tokenCount += Math.ceil(content.length / 4);
            }
          });
        }
      });
    }

    // 计算system token
    if (typeof request.system === 'string') {
      tokenCount += Math.ceil(request.system.length / 4);
    } else if (Array.isArray(request.system)) {
      request.system.forEach((item: any) => {
        if (item.type === 'text' && typeof item.text === 'string') {
          tokenCount += Math.ceil(item.text.length / 4);
        }
      });
    }

    // 计算tools token
    if (Array.isArray(request.tools)) {
      request.tools.forEach((tool: any) => {
        if (tool.description) {
          tokenCount += Math.ceil((tool.name + tool.description).length / 4);
        }
        if (tool.input_schema) {
          tokenCount += Math.ceil(JSON.stringify(tool.input_schema).length / 4);
        }
      });
    }

    return tokenCount;
  }

  /**
   * 负载均衡选择Provider
   * 考虑权重分配 + blacklist状态 + 多key轮询
   */
  private selectProvider(providers: ProviderEndpoint[]): ProviderEndpoint {
    if (!providers || providers.length === 0) {
      throw new RouterError('No providers configured', 'NO_PROVIDER');
    }

    // 过滤掉完全blacklisted的providers
    const availableProviders = providers.filter(provider => this.hasAvailableKey(provider));

    if (availableProviders.length === 0) {
      throw new RouterError('All providers are blacklisted', 'ALL_BLACKLISTED');
    }

    // 按权重选择Provider (加权随机算法)
    const selectedProvider = this.weightedRandomSelect(availableProviders);

    // 选择可用的API Key
    this.selectAvailableKey(selectedProvider);

    return selectedProvider;
  }

  /**
   * 检查Provider是否有可用的API Key
   */
  private hasAvailableKey(provider: ProviderEndpoint): boolean {
    const now = new Date();

    // 检查是否有至少一个非blacklisted的key
    for (let i = 0; i < provider.apiKeys.length; i++) {
      const blacklistEntry = provider.blacklist.find(bl => bl.keyIndex === i);
      if (!blacklistEntry || blacklistEntry.until < now) {
        return true;
      }
    }

    return false;
  }

  /**
   * 为Provider选择可用的API Key
   */
  private selectAvailableKey(provider: ProviderEndpoint): void {
    const now = new Date();

    // 轮询策略：从当前索引开始查找下一个可用key
    for (let attempt = 0; attempt < provider.apiKeys.length; attempt++) {
      const keyIndex = (provider.currentKeyIndex + attempt) % provider.apiKeys.length;
      const blacklistEntry = provider.blacklist.find(bl => bl.keyIndex === keyIndex);

      if (!blacklistEntry || blacklistEntry.until < now) {
        provider.currentKeyIndex = keyIndex;
        return;
      }
    }

    // 理论上不会到达这里，因为hasAvailableKey已经检查过
    throw new RouterError(`No available API key for provider ${provider.providerId}`, 'ALL_BLACKLISTED');
  }

  /**
   * 加权随机选择算法
   */
  private weightedRandomSelect(providers: ProviderEndpoint[]): ProviderEndpoint {
    // 计算总权重
    const totalWeight = providers.reduce((sum, provider) => sum + provider.weight, 0);

    if (totalWeight === 0) {
      // 如果所有权重都是0，均匀选择
      return providers[Math.floor(Math.random() * providers.length)];
    }

    // 生成随机数
    let random = Math.random() * totalWeight;

    // 选择Provider
    for (const provider of providers) {
      random -= provider.weight;
      if (random <= 0) {
        return provider;
      }
    }

    // 备选方案 (理论上不会到达)
    return providers[providers.length - 1];
  }

  /**
   * 将API Key标记为blacklisted
   * @param providerId Provider ID
   * @param keyIndex API Key索引
   * @param errorType 错误类型 ('429' | 'error')
   * @param reason 错误原因
   */
  blacklistKey(providerId: string, keyIndex: number, errorType: '429' | 'error', reason: string): void {
    // 查找Provider
    for (const virtualConfig of Object.values(this.config.virtualModels)) {
      const provider = virtualConfig.providers.find(p => p.providerId === providerId);
      if (provider) {
        const timeout =
          errorType === '429' ? this.config.blacklistSettings.timeout429 : this.config.blacklistSettings.timeoutError;

        const until = new Date(Date.now() + timeout);

        // 移除旧的blacklist条目
        provider.blacklist = provider.blacklist.filter(bl => bl.keyIndex !== keyIndex);

        // 添加新的blacklist条目
        provider.blacklist.push({
          keyIndex,
          until,
          reason,
        });

        secureLogger.warn('API key blacklisted', {
          providerId,
          keyIndex,
          errorType,
          reason,
          until: until.toISOString(),
        });

        return;
      }
    }

    secureLogger.error('Provider not found for blacklisting', { providerId, keyIndex });
  }

  /**
   * 清理过期的blacklist条目
   */
  cleanupExpiredBlacklists(): void {
    const now = new Date();

    for (const virtualConfig of Object.values(this.config.virtualModels)) {
      for (const provider of virtualConfig.providers) {
        const originalCount = provider.blacklist.length;
        provider.blacklist = provider.blacklist.filter(bl => bl.until > now);

        if (provider.blacklist.length < originalCount) {
          secureLogger.info('Cleaned up expired blacklist entries', {
            providerId: provider.providerId,
            removed: originalCount - provider.blacklist.length,
          });
        }
      }
    }
  }

  /**
   * 获取路由统计信息
   */
  getStatistics(): any {
    const stats = {
      virtualModels: {} as any,
      totalProviders: 0,
      totalBlacklisted: 0,
    };

    for (const [virtualModel, config] of Object.entries(this.config.virtualModels)) {
      const providerStats = config.providers.map(provider => ({
        providerId: provider.providerId,
        weight: provider.weight,
        totalKeys: provider.apiKeys.length,
        blacklistedKeys: provider.blacklist.length,
        currentKeyIndex: provider.currentKeyIndex,
      }));

      stats.virtualModels[virtualModel] = providerStats;
      stats.totalProviders += config.providers.length;
      stats.totalBlacklisted += config.providers.reduce((sum, p) => sum + p.blacklist.length, 0);
    }

    return stats;
  }
}
