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
import { 
  DEFAULT_ENDPOINTS,
  DEFAULT_TIMEOUTS,
  DEFAULT_RETRY_CONFIG,
  PROVIDER_NAMES,
  COMPATIBILITY_TAGS
} from '../constants/compatibility-constants';

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
  endpoint: string;
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
    const providers = this.config.providers || [];
    
    if (providers.length === 0) {
      throw new Error('No providers configured in user configuration');
    }

    const allPipelines: PipelineDefinition[] = [];
    const pipelinesGroupedByVirtualModel: Record<string, PipelineDefinition[]> = {};

    // 为每个provider生成流水线定义
    for (const provider of providers) {
      const providerPipelines = await this.generatePipelinesForProvider(provider);
      allPipelines.push(...providerPipelines);

      // 按虚拟模型分组
      for (const pipeline of providerPipelines) {
        const virtualModel = pipeline.virtualModel;
        if (!pipelinesGroupedByVirtualModel[virtualModel]) {
          pipelinesGroupedByVirtualModel[virtualModel] = [];
        }
        pipelinesGroupedByVirtualModel[virtualModel].push(pipeline);
      }
    }

    const routingTable: RoutingTable = {
      configName: 'runtime-generated',
      configFile: 'runtime-from-config',
      generatedAt: new Date().toISOString(),
      totalPipelines: allPipelines.length,
      pipelinesGroupedByVirtualModel,
      allPipelines,
    };

    secureLogger.debug('Runtime路由表生成详情', {
      totalProviders: providers.length,
      totalPipelines: allPipelines.length,
      virtualModelCount: Object.keys(pipelinesGroupedByVirtualModel).length,
      virtualModels: Object.keys(pipelinesGroupedByVirtualModel),
    });

    return routingTable;
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
   * 创建单个流水线定义
   */
  private async createPipelineDefinition(
    provider: any,
    targetModel: string,
    apiKeyIndex: number,
    apiKey: string
  ): Promise<PipelineDefinition> {
    // 生成流水线ID
    const pipelineId = `${provider.name}-${targetModel}-key${apiKeyIndex}`;
    
    // 确定虚拟模型名称
    const virtualModel = this.determineVirtualModel(provider, targetModel);
    
    // 生成架构配置
    const architecture = this.createPipelineArchitecture(provider, targetModel);
    
    // 计算握手时间（模拟）
    const handshakeTime = Math.floor(Math.random() * 5) + 1;
    
    const pipeline: PipelineDefinition = {
      pipelineId,
      virtualModel,
      provider: provider.name,
      targetModel,
      apiKeyIndex,
      endpoint: provider.api_base_url || this.getDefaultEndpointForProvider(provider.name),
      status: 'runtime',
      createdAt: new Date().toISOString(),
      handshakeTime,
      architecture,
    };

    secureLogger.debug('创建流水线定义', {
      pipelineId,
      virtualModel,
      provider: provider.name,
      targetModel,
      endpoint: pipeline.endpoint,
    });

    return pipeline;
  }

  /**
   * 确定虚拟模型名称 - 基于Router配置而非硬编码
   */
  private determineVirtualModel(provider: any, targetModel: string): string {
    // 🔧 关键修复：使用Router配置来确定虚拟模型名称
    // 扫描config中的router配置，找到指向当前provider+model组合的虚拟模型
    
    // 如果有MergedConfig的router配置，使用它
    if (this.config.router) {
      for (const [virtualModel, routingRule] of Object.entries(this.config.router)) {
        if (typeof routingRule === 'string' && routingRule.includes(',')) {
          const [configProvider, configModel] = routingRule.split(',');
          if (configProvider.trim() === provider.name && configModel.trim() === targetModel) {
            return virtualModel;
          }
        }
      }
    }
    
    // 如果provider有virtualModelMapping配置，使用它
    if (provider.virtualModelMapping && provider.virtualModelMapping[targetModel]) {
      return provider.virtualModelMapping[targetModel];
    }
    
    // 🔧 最终回退：使用default而不是provider名称
    // 这与VirtualModelMapper的默认行为一致
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