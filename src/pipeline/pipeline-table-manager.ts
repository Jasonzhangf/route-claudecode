/**
 * Pipeline表管理器 - 管理流水线表生成和加载
 *
 * 职责：
 * 1. 生成Runtime流水线表
 * 2. 加载静态流水线表文件
 * 3. 管理流水线表的缓存和更新
 *
 * @author RCC v4.0
 */

import { secureLogger } from '../utils/secure-logger';
import { MergedConfig } from '../config/config-reader';
import { ExpandedRouting, ExpandedProvider } from '../config/provider-expander';
import { PipelineError } from '../types/error';
import { 
  DEFAULT_ENDPOINTS,
  DEFAULT_TIMEOUTS,
  DEFAULT_RETRY_CONFIG,
  PROVIDER_NAMES,
  COMPATIBILITY_TAGS
} from '../constants/compatibility-constants';
import { TIMEOUT_DEFAULTS } from '../constants/timeout-defaults';

export interface RoutingTable {
  configName: string;
  configFile: string;
  generatedAt: string;
  totalPipelines: number;
  pipelinesGroupedByVirtualModel: Record<string, any[]>;
  allPipelines: any[];
}

export interface PipelineArchitecture {
  transformer: {
    id: string;
    name: string;
    type: string;
    status: string;
  };
  protocol: {
    id: string;
    name: string;
    type: string;
    status: string;
  };
  serverCompatibility: {
    id: string;
    name: string;
    type: string;
    status: string;
  };
  server: {
    id: string;
    name: string;
    type: string;
    status: string;
    endpoint: string;
  };
}

export interface PipelineDefinition {
  pipelineId: string;
  virtualModel: string;
  provider: string;
  targetModel: string;
  apiKeyIndex: number;
  apiKey: string;
  endpoint: string;
  priority: number;
  isSecurityEnhanced: boolean;
  category: string;
  status: string;
  createdAt: string;
  handshakeTime: number;
  architecture: PipelineArchitecture;
}

/**
 * Pipeline表管理器
 * 负责生成和管理流水线路由表
 */
export class PipelineTableManager {
  private config: MergedConfig;
  private cachedTable: RoutingTable | null = null;
  private tableGeneratedAt: number = 0;
  private cacheValidityMs: number = 300000; // 5分钟缓存有效期

  constructor(config: MergedConfig) {
    this.config = config;
  }

  /**
   * 获取或生成流水线路由表
   */
  async getOrGenerateRoutingTable(): Promise<RoutingTable> {
    const now = Date.now();
    
    // 检查缓存是否有效
    if (this.cachedTable && (now - this.tableGeneratedAt) < this.cacheValidityMs) {
      secureLogger.debug('使用缓存的流水线路由表', {
        generatedAt: this.cachedTable.generatedAt,
        totalPipelines: this.cachedTable.totalPipelines,
        cacheAge: now - this.tableGeneratedAt,
      });
      return this.cachedTable;
    }

    // 生成新的路由表
    secureLogger.info('生成新的流水线路由表', {
      configName: 'runtime-config',
      hasProviders: !!(this.config.providers && this.config.providers.length > 0),
    });

    try {
      const routingTable = await this.generateRuntimeRoutingTable();
      
      // 更新缓存
      this.cachedTable = routingTable;
      this.tableGeneratedAt = now;
      
      secureLogger.info('流水线路由表生成成功', {
        totalPipelines: routingTable.totalPipelines,
        virtualModels: Object.keys(routingTable.pipelinesGroupedByVirtualModel),
      });

      return routingTable;
    } catch (error) {
      secureLogger.error('流水线路由表生成失败', {
        error: error.message,
        stack: error.stack,
      });
      throw new Error(`Pipeline routing table generation failed: ${error.message}`);
    }
  }

  /**
   * 生成Runtime流水线路由表
   */
  private async generateRuntimeRoutingTable(): Promise<RoutingTable> {
    try {
      const allPipelines: PipelineDefinition[] = [];
      const pipelinesGroupedByCategory: Record<string, PipelineDefinition[]> = {};

      // 优先使用expandedRouting生成精确的流水线配置
      if (this.config.expandedRouting) {
        secureLogger.info('使用展开后的路由配置生成流水线', {
          primaryProviders: this.config.expandedRouting.primaryProviders.length,
          securityProviders: this.config.expandedRouting.securityProviders.length
        });

        // 生成主要流水线
        for (const expandedProvider of this.config.expandedRouting.primaryProviders) {
          const pipelines = await this.generatePipelinesFromExpandedProvider(expandedProvider);
          allPipelines.push(...pipelines);
        }

        // 生成安全增强流水线
        for (const expandedProvider of this.config.expandedRouting.securityProviders) {
          const pipelines = await this.generatePipelinesFromExpandedProvider(expandedProvider);
          allPipelines.push(...pipelines);
        }
      } else {
        // 回退到传统的provider配置
        secureLogger.info('使用传统Provider配置生成流水线');
        const providers = this.config.providers || [];
        
        if (providers.length === 0) {
          throw new PipelineError('No providers configured in user configuration', {
            configProviders: providers.length,
            hasExpandedRouting: false
          });
        }

        for (const provider of providers) {
          const providerPipelines = await this.generatePipelinesForProvider(provider);
          allPipelines.push(...providerPipelines);
        }
      }

      // 按类别分组流水线
      for (const pipeline of allPipelines) {
        const category = pipeline.category;
        if (!pipelinesGroupedByCategory[category]) {
          pipelinesGroupedByCategory[category] = [];
        }
        pipelinesGroupedByCategory[category].push(pipeline);
      }

      // 按优先级排序每个类别的流水线
      Object.keys(pipelinesGroupedByCategory).forEach(category => {
        pipelinesGroupedByCategory[category].sort((a, b) => a.priority - b.priority);
      });

      const routingTable: RoutingTable = {
        configName: 'runtime-generated',
        configFile: 'runtime-from-config',
        generatedAt: new Date().toISOString(),
        totalPipelines: allPipelines.length,
        pipelinesGroupedByVirtualModel: pipelinesGroupedByCategory,
        allPipelines: allPipelines.sort((a, b) => a.priority - b.priority),
      };

      secureLogger.info('Runtime路由表生成完成', {
        totalPipelines: allPipelines.length,
        categoriesCount: Object.keys(pipelinesGroupedByCategory).length,
        categories: Object.keys(pipelinesGroupedByCategory),
        hasExpandedRouting: !!this.config.expandedRouting
      });

      return routingTable;
    } catch (error) {
      const pipelineError = new PipelineError('Pipeline路由表生成失败', {
        originalError: error,
        configProviders: this.config.providers?.length || 0,
        hasExpandedRouting: !!this.config.expandedRouting
      });
      secureLogger.error('❌ Pipeline routing table generation failed', { error: pipelineError });
      throw pipelineError;
    }
  }

  /**
   * 从展开的Provider配置生成流水线
   */
  private async generatePipelinesFromExpandedProvider(expandedProvider: ExpandedProvider): Promise<PipelineDefinition[]> {
    try {
      const pipelines: PipelineDefinition[] = [];
      const originalProvider = expandedProvider.originalProvider;
      
      // 处理多key配置：如果有多个API key，为每个key生成独立pipeline
      const apiKeys = this.extractApiKeysFromProvider(originalProvider);
      
      for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
        const apiKey = apiKeys[keyIndex];
        
        const pipeline = await this.createEnhancedPipelineDefinition(
          expandedProvider,
          keyIndex,
          apiKey
        );
        
        pipelines.push(pipeline);
      }
      
      secureLogger.debug('从展开Provider生成流水线', {
        providerName: expandedProvider.name,
        model: expandedProvider.model,
        category: expandedProvider.category,
        priority: expandedProvider.priority,
        isSecurityEnhanced: expandedProvider.isSecurityEnhanced,
        pipelineCount: pipelines.length
      });
      
      return pipelines;
    } catch (error) {
      const pipelineError = new PipelineError('从展开Provider生成流水线失败', {
        originalError: error,
        expandedProvider: {
          name: expandedProvider.name,
          model: expandedProvider.model,
          category: expandedProvider.category
        }
      });
      secureLogger.error('❌ Failed to generate pipelines from expanded provider', { error: pipelineError });
      throw pipelineError;
    }
  }

  /**
   * 提取Provider的API密钥列表
   */
  private extractApiKeysFromProvider(provider: any): string[] {
    // 支持多种API key配置格式
    if (provider.api_keys && Array.isArray(provider.api_keys)) {
      return provider.api_keys;
    }
    
    if (provider.apiKeys && Array.isArray(provider.apiKeys)) {
      return provider.apiKeys;
    }
    
    // 单个API key的情况
    if (provider.api_key) {
      return [provider.api_key];
    }
    
    if (provider.apiKey) {
      return [provider.apiKey];
    }
    
    // 默认使用provider名称作为key引用
    return [provider.name || 'default-key'];
  }

  /**
   * 创建增强的流水线定义（支持展开配置）
   */
  private async createEnhancedPipelineDefinition(
    expandedProvider: ExpandedProvider,
    apiKeyIndex: number,
    apiKey: string
  ): Promise<PipelineDefinition> {
    try {
      // 生成流水线ID - 包含优先级和多key信息
      const keyTag = apiKeyIndex === 0 ? 'primary' : `key${apiKeyIndex}`;
      const securityTag = expandedProvider.isSecurityEnhanced ? 'security' : 'main';
      const pipelineId = `pipeline-${expandedProvider.category}-${expandedProvider.name}-${keyTag}-${expandedProvider.model}-${securityTag}`;
      
      // 生成架构配置
      const architecture = this.createPipelineArchitecture(expandedProvider.originalProvider, expandedProvider.model);
      
      // 计算实际的优先级（考虑多key的情况）
      const adjustedPriority = expandedProvider.priority * 100 + apiKeyIndex;
      
      const pipeline: PipelineDefinition = {
        pipelineId,
        virtualModel: expandedProvider.virtualModel,
        provider: expandedProvider.name,
        targetModel: expandedProvider.model,
        apiKeyIndex,
        apiKey,
        endpoint: expandedProvider.originalProvider.api_base_url || this.getDefaultEndpointForProvider(expandedProvider.name),
        priority: adjustedPriority,
        isSecurityEnhanced: expandedProvider.isSecurityEnhanced,
        category: expandedProvider.category,
        status: 'runtime-expanded',
        createdAt: new Date().toISOString(),
        handshakeTime: this.calculateHandshakeTime(expandedProvider.originalProvider),
        architecture,
      };

      secureLogger.debug('创建增强流水线定义', {
        pipelineId,
        category: pipeline.category,
        provider: pipeline.provider,
        model: pipeline.targetModel,
        priority: pipeline.priority,
        isSecurityEnhanced: pipeline.isSecurityEnhanced,
        apiKeyIndex,
        endpoint: pipeline.endpoint,
      });

      return pipeline;
    } catch (error) {
      const pipelineError = new PipelineError('创建增强流水线定义失败', {
        originalError: error,
        expandedProvider: {
          name: expandedProvider.name,
          model: expandedProvider.model,
          category: expandedProvider.category,
          priority: expandedProvider.priority
        },
        apiKeyIndex
      });
      secureLogger.error('❌ Failed to create enhanced pipeline definition', { error: pipelineError });
      throw pipelineError;
    }
  }

  /**
   * 计算连接握手时间
   */
  private calculateHandshakeTime(provider: any): number {
    // 根据provider类型和配置计算实际的握手时间
    const baseTime = 2; // 基础握手时间（秒）
    
    // 本地provider握手更快
    if (provider.api_base_url && provider.api_base_url.includes('localhost')) {
      return baseTime * 0.5;
    }
    
    // 远程provider根据延迟预估调整
    const timeout = provider.timeout || TIMEOUT_DEFAULTS.REQUEST_TIMEOUT;
    return Math.min(baseTime + (timeout / 10000), 10); // 最多10秒
  }

  /**
   * 为单个provider生成流水线定义
   */
  private async generatePipelinesForProvider(provider: any): Promise<PipelineDefinition[]> {
    const pipelines: PipelineDefinition[] = [];
    const models = provider.models || ['default-model'];
    const apiKeys = provider.api_keys || [provider.api_key || 'default-key'];

    secureLogger.debug('为Provider生成流水线', {
      providerName: provider.name,
      modelCount: models.length,
      apiKeyCount: apiKeys.length,
      endpoint: provider.api_base_url,
    });

    // 为每个模型和API密钥组合生成流水线
    for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
      const model = models[modelIndex];
      
      for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
        const apiKey = apiKeys[keyIndex];
        
        const pipeline = await this.createPipelineDefinition(
          provider,
          model,
          keyIndex,
          apiKey
        );
        
        pipelines.push(pipeline);
      }
    }

    secureLogger.debug(`Provider ${provider.name} 生成了 ${pipelines.length} 个流水线`);
    return pipelines;
  }

  /**
   * 创建单个流水线定义（传统方式）
   */
  private async createPipelineDefinition(
    provider: any,
    targetModel: string,
    apiKeyIndex: number,
    apiKey: string
  ): Promise<PipelineDefinition> {
    try {
      // 生成流水线ID
      const pipelineId = `${provider.name}-${targetModel}-key${apiKeyIndex}`;
      
      // 确定路由名称
      const routeName = this.determineRouteName(provider, targetModel);
      
      // 生成架构配置
      const architecture = this.createPipelineArchitecture(provider, targetModel);
      
      // 计算实际握手时间
      const handshakeTime = this.calculateHandshakeTime(provider);
      
      const pipeline: PipelineDefinition = {
        pipelineId,
        virtualModel: routeName,
        provider: provider.name,
        targetModel,
        apiKeyIndex,
        apiKey,
        endpoint: provider.api_base_url || this.getDefaultEndpointForProvider(provider.name),
        priority: (provider.priority || 1) * 100 + apiKeyIndex,
        isSecurityEnhanced: false,
        category: routeName,
        status: 'runtime-legacy',
        createdAt: new Date().toISOString(),
        handshakeTime,
        architecture,
      };

      secureLogger.debug('创建传统流水线定义', {
        pipelineId,
        routeName,
        provider: provider.name,
        targetModel,
        priority: pipeline.priority,
        endpoint: pipeline.endpoint,
      });

      return pipeline;
    } catch (error) {
      const pipelineError = new PipelineError('创建流水线定义失败', {
        originalError: error,
        provider: provider.name,
        targetModel,
        apiKeyIndex
      });
      secureLogger.error('❌ Failed to create pipeline definition', { error: pipelineError });
      throw pipelineError;
    }
  }

  /**
   * 确定路由名称 - 基于Router配置而非硬编码
   */
  private determineRouteName(provider: any, targetModel: string): string {
    // 🔧 关键修复：使用Router配置来确定路由名称
    // 扫描config中的router配置，找到指向当前provider+model组合的路由名称
    
    // 如果有MergedConfig的router配置，使用它
    if (this.config.router) {
      for (const [routeName, routingRule] of Object.entries(this.config.router)) {
        if (typeof routingRule === 'string' && routingRule.includes(',')) {
          const [configProvider, configModel] = routingRule.split(',');
          if (configProvider.trim() === provider.name && configModel.trim() === targetModel) {
            return routeName;
          }
        }
      }
    }
    
    // 如果provider有routeMapping配置，使用它
    if (provider.routeMapping && provider.routeMapping[targetModel]) {
      return provider.routeMapping[targetModel];
    }
    
    // 🔧 最终回退：使用default而不是provider名称
    // 这与RouteMapper的默认行为一致
    return 'default';
  }

  /**
   * 创建流水线架构配置
   */
  private createPipelineArchitecture(provider: any, targetModel: string): PipelineArchitecture {
    const providerName = provider.name;
    
    // 根据provider类型确定架构组件
    const compatibilityTag = this.getCompatibilityTagForProvider(providerName);
    
    const architecture: PipelineArchitecture = {
      transformer: {
        id: `${providerName}-transformer`,
        name: `${providerName}-standard`,
        type: 'transformer',
        status: 'runtime',
      },
      protocol: {
        id: `${providerName}-protocol`,
        name: providerName,
        type: 'protocol',
        status: 'runtime',
      },
      serverCompatibility: {
        id: `${providerName}-compatibility`,
        name: compatibilityTag,
        type: 'serverCompatibility',
        status: 'runtime',
      },
      server: {
        id: `${providerName}-server`,
        name: `${providerName}-server`,
        type: 'server',
        status: 'runtime',
        endpoint: this.buildServerEndpoint(provider, targetModel),
      },
    };

    return architecture;
  }

  /**
   * 获取Provider的兼容性标签
   */
  private getCompatibilityTagForProvider(providerName: string): string {
    switch (providerName) {
      case PROVIDER_NAMES.LMSTUDIO:
      case PROVIDER_NAMES.OPENAI:
        return COMPATIBILITY_TAGS.LMSTUDIO;
      case PROVIDER_NAMES.OLLAMA:
        return COMPATIBILITY_TAGS.OLLAMA;
      case PROVIDER_NAMES.VLLM:
        return COMPATIBILITY_TAGS.VLLM;
      case PROVIDER_NAMES.ANTHROPIC:
        return COMPATIBILITY_TAGS.ANTHROPIC;
      default:
        return COMPATIBILITY_TAGS.PASSTHROUGH;
    }
  }

  /**
   * 构建服务器端点URL
   */
  private buildServerEndpoint(provider: any, targetModel: string): string {
    const baseUrl = provider.api_base_url || this.getDefaultEndpointForProvider(provider.name);
    
    // 确保端点包含完整的API路径
    if (baseUrl.endsWith('/v1') && !baseUrl.includes('/chat/completions')) {
      return `${baseUrl}/chat/completions`;
    }
    
    if (baseUrl.endsWith('/v1/chat/completions')) {
      return baseUrl;
    }
    
    // 处理其他可能的端点格式
    if (provider.name === PROVIDER_NAMES.ANTHROPIC) {
      return baseUrl.includes('/messages') ? baseUrl : `${baseUrl}/v1/messages`;
    }
    
    // 默认返回原始URL
    return baseUrl;
  }

  /**
   * 获取Provider的默认端点
   */
  private getDefaultEndpointForProvider(providerName: string): string {
    switch (providerName) {
      case PROVIDER_NAMES.LMSTUDIO:
      case PROVIDER_NAMES.OPENAI:
        return DEFAULT_ENDPOINTS.LMSTUDIO;
      case PROVIDER_NAMES.OLLAMA:
        return DEFAULT_ENDPOINTS.OLLAMA;
      case PROVIDER_NAMES.VLLM:
        return DEFAULT_ENDPOINTS.VLLM;
      case PROVIDER_NAMES.ANTHROPIC:
        return DEFAULT_ENDPOINTS.ANTHROPIC;
      default:
        return DEFAULT_ENDPOINTS.LMSTUDIO;
    }
  }

  /**
   * 清除缓存的路由表
   */
  clearCache(): void {
    this.cachedTable = null;
    this.tableGeneratedAt = 0;
    secureLogger.debug('流水线路由表缓存已清除');
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { cached: boolean; age: number; validUntil: number } {
    const now = Date.now();
    const age = this.cachedTable ? now - this.tableGeneratedAt : 0;
    const validUntil = this.tableGeneratedAt + this.cacheValidityMs;
    
    return {
      cached: !!this.cachedTable,
      age,
      validUntil,
    };
  }

  /**
   * 设置缓存有效期
   */
  setCacheValidity(ms: number): void {
    this.cacheValidityMs = ms;
    secureLogger.debug('流水线路由表缓存有效期已更新', { validityMs: ms });
  }

  /**
   * 验证路由表结构
   */
  validateRoutingTable(table: RoutingTable): boolean {
    try {
      if (!table.configName || !table.allPipelines || !table.pipelinesGroupedByVirtualModel) {
        return false;
      }

      if (!Array.isArray(table.allPipelines)) {
        return false;
      }

      if (typeof table.pipelinesGroupedByVirtualModel !== 'object') {
        return false;
      }

      // 验证每个流水线定义
      for (const pipeline of table.allPipelines) {
        if (!pipeline.pipelineId || !pipeline.virtualModel || !pipeline.provider) {
          return false;
        }

        if (!pipeline.architecture || !pipeline.architecture.server) {
          return false;
        }
      }

      return true;
    } catch (error) {
      secureLogger.error('路由表验证失败', { error: error.message });
      return false;
    }
  }
}