/**
 * Pipeline兼容性管理器 - 管理兼容性模块加载和处理
 *
 * 职责：
 * 1. 动态加载兼容性模块
 * 2. 处理Server-Compatibility层逻辑
 * 3. 管理兼容性模块的生命周期
 *
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../utils/secure-logger';
import { RequestContext } from './pipeline-request-processor';
// TODO: API化 - 通过Pipeline API获取处理上下文和配置管理器
// import { ModuleProcessingContext, unifiedConfigManager } from '../config/unified-config-manager';
import { unifiedConfigManager } from '../config/unified-config-manager';
import { RoutingTable } from './pipeline-table-manager';

/**
 * 模块处理上下文接口 - API化版本
 * TODO: 在Pipeline API实施后，这个接口将通过API调用获取
 */
interface ModuleProcessingContext {
  readonly requestId: string;
  readonly providerName?: string;
  readonly protocol?: string;
  readonly config?: {
    readonly endpoint?: string;
    readonly apiKey?: string;
    readonly timeout?: number;
    readonly maxRetries?: number;
    readonly actualModel?: string;
    readonly originalModel?: string;
    readonly serverCompatibility?: string;
  };
  readonly debug?: {
    readonly enabled: boolean;
    readonly level: number;
    readonly outputPath?: string;
  };
  metadata?: {
    architecture?: string;
    layer?: string;
    protocolConfig?: {
      endpoint?: string;
      apiKey?: string;
      protocol?: string;
      timeout?: number;
      maxRetries?: number;
      customHeaders?: Record<string, string>;
    };
    [key: string]: any;
  };
}
import {
  COMPATIBILITY_TAGS,
  PROVIDER_NAMES,
  DEFAULT_ENDPOINTS,
  DEFAULT_TIMEOUTS,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_API_KEYS,
  DEFAULT_MODELS,
  DEFAULT_MAX_TOKENS,
  COMPATIBILITY_MODULE_PATHS,
  COMPATIBILITY_MODULE_CLASSES,
  PROVIDER_TO_COMPATIBILITY_MAPPING,
  URL_PATTERNS,
  LAYER_NAMES,
  PROCESSING_MODES
} from '../constants/compatibility-constants';

export interface CompatibilityModuleInfo {
  id: string;
  name: string;
  type: string;
  status: string;
}

/**
 * Pipeline兼容性管理器
 * 负责处理所有兼容性相关的逻辑
 */
export class PipelineCompatibilityManager extends EventEmitter {
  private routingTable: RoutingTable | null = null;
  private loadedModules: Map<string, any> = new Map();

  constructor(routingTable: RoutingTable | null = null) {
    super();
    this.routingTable = routingTable;
  }

  /**
   * 处理Server-Compatibility层
   */
  async processServerCompatibilityLayer(
    request: any,
    routingDecision: any,
    context: RequestContext
  ): Promise<any> {
    try {
      // 🔧 关键修复：使用负载均衡器选中的pipeline，而不是列表第一个
      const availablePipelines = Array.isArray(routingDecision.availablePipelines) ? routingDecision.availablePipelines : [];
      const selectedPipelineId = routingDecision.selectedPipeline || (availablePipelines.length > 0 ? availablePipelines[0] : null);
      const providerType = this.extractProviderFromPipelineId(selectedPipelineId);
      
      secureLogger.info('🔥 ServerCompatibility层pipeline选择', {
        requestId: context.requestId,
        selectedPipelineId,
        availablePipelines: availablePipelines,
        extractedProviderType: providerType,
        usedSelectedPipeline: !!routingDecision.selectedPipeline
      });
      
      // 🔧 修复：从Providers配置中正确获取serverCompatibility设置
      let compatibilityTag = 'passthrough'; // 默认值
      let compatibilityOptions: any = {};
      
      // 🔧 优先从Providers配置中获取serverCompatibility设置
      if (routingDecision?.providers && Array.isArray(routingDecision.providers)) {
        const selectedProvider = routingDecision.providers.find((p: any) => p.name === providerType);
        if (selectedProvider?.serverCompatibility) {
          compatibilityTag = selectedProvider.serverCompatibility.use || 'passthrough';
          compatibilityOptions = selectedProvider.serverCompatibility.options || {};
          
          secureLogger.info('🔧 使用Providers配置中的serverCompatibility', {
            requestId: context.requestId,
            providerType,
            compatibilityTag,
            hasOptions: Object.keys(compatibilityOptions).length > 0,
            architecture: 'providers-config'
          });
        } else {
          // 如果在Providers中找不到配置，回退到routingDecision
          if (routingDecision?.serverCompatibility) {
            compatibilityTag = routingDecision.serverCompatibility.use || 'passthrough';
            compatibilityOptions = routingDecision.serverCompatibility.options || {};
            
            secureLogger.info('🔧 使用routingDecision中的serverCompatibility', {
              requestId: context.requestId,
              providerType,
              compatibilityTag,
              hasOptions: Object.keys(compatibilityOptions).length > 0,
              architecture: 'routing-decision'
            });
          } else {
            // 向后兼容：从 pipeline ID 中推断
            compatibilityTag = this.extractCompatibilityFromPipelineId(selectedPipelineId, routingDecision);
            
            secureLogger.info('🔧 使用向后兼容的compatibility推断', {
              requestId: context.requestId,
              providerType,
              compatibilityTag,
              pipelineId: selectedPipelineId,
              architecture: 'backward-compatible'
            });
          }
        }
      } else {
        // 如果没有Providers配置，回退到原有逻辑
        if (routingDecision?.serverCompatibility) {
          compatibilityTag = routingDecision.serverCompatibility.use || 'passthrough';
          compatibilityOptions = routingDecision.serverCompatibility.options || {};
          
          secureLogger.info('🔧 使用routingDecision中的serverCompatibility', {
            requestId: context.requestId,
            providerType,
            compatibilityTag,
            hasOptions: Object.keys(compatibilityOptions).length > 0,
            architecture: 'routing-decision'
          });
        } else {
          // 向后兼容：从 pipeline ID 中推断
          compatibilityTag = this.extractCompatibilityFromPipelineId(selectedPipelineId, routingDecision);
          
          secureLogger.info('🔧 使用向后兼容的compatibility推断', {
            requestId: context.requestId,
            providerType,
            compatibilityTag,
            pipelineId: selectedPipelineId,
            architecture: 'backward-compatible'
          });
        }
      }
      
      secureLogger.debug(`${LAYER_NAMES.SERVER_COMPATIBILITY}层处理开始`, {
        requestId: context.requestId,
        compatibilityTag,
        providerType,
        pipelineId: selectedPipelineId,
        hasCompatibilityOptions: Object.keys(compatibilityOptions).length > 0
      });

      // 🎯 Architecture Engineer设计：使用Context传递配置，避免__internal对象
      let processedRequest = { ...request };
      
      // 🔧 关键修复：从原始context中复制protocolConfig，避免context对象分离
      const originalProtocolConfig = context.metadata?.protocolConfig || {};
      
      secureLogger.info('🔥🔥 [COMPATIBILITY-CONTEXT-FIX] 检查原始context的protocolConfig', {
        requestId: context.requestId,
        hasOriginalMetadata: !!context.metadata,
        hasOriginalProtocolConfig: !!context.metadata?.protocolConfig,
        originalProtocolConfigKeys: context.metadata?.protocolConfig ? Object.keys(context.metadata.protocolConfig) : 'no-config',
        hasOriginalCustomHeaders: !!(context.metadata?.protocolConfig?.customHeaders),
        originalCustomHeadersKeys: context.metadata?.protocolConfig?.customHeaders ? Object.keys(context.metadata.protocolConfig.customHeaders) : 'no-headers'
      });

      // 创建ModuleProcessingContext传递给兼容性模块
      const moduleContext: ModuleProcessingContext = {
        requestId: context.requestId,
        providerName: providerType,
        protocol: 'openai', // ServerCompatibility层后都是OpenAI格式
        config: {
          endpoint: routingDecision?.endpoint || 'http://localhost:8080/v1',
          apiKey: routingDecision?.apiKey || '',
          timeout: 30000, // 缩短到30秒，快速失败避免长时间等待
          maxRetries: 3,
          actualModel: request.model, // TODO: 需要从上层传递真实的actualModel
          originalModel: request.model,
          serverCompatibility: compatibilityTag
        },
        metadata: {
          architecture: 'six-layer-enterprise',
          layer: 'server-compatibility',
          // 🔑 关键修复：复制原始context中的protocolConfig，确保context连续性
          protocolConfig: { ...originalProtocolConfig }
        }
      };
      
      // 动态加载兼容性模块
      const compatibilityModule = await this.loadCompatibilityModule(
        compatibilityTag,
        compatibilityOptions, // 传递兼容性选项
        request,
        context,
        routingDecision
      );

      if (compatibilityModule) {
        // 🎯 Architecture Engineer设计：传递Context而不是__internal对象
        if (typeof compatibilityModule.processRequest === 'function') {
          // 新的Context接口
          processedRequest = await compatibilityModule.processRequest(request, routingDecision, moduleContext);
        } else if (typeof compatibilityModule.process === 'function') {
          // 兼容旧接口，但传递Context
          processedRequest = await compatibilityModule.process(request, moduleContext);
        } else {
          secureLogger.warn('兼容性模块无有效的process方法', {
            requestId: context.requestId,
            compatibilityTag,
            availableMethods: Object.getOwnPropertyNames(compatibilityModule)
          });
          processedRequest = request;
        }
        
        // 🔑 关键修复：将兼容性模块修改后的protocolConfig复制回原始context
        // 确保Pipeline Request Processor能够访问到自定义头部等配置
        if (moduleContext.metadata?.protocolConfig) {
          if (!context.metadata) {
            context.metadata = {};
          }
          context.metadata.protocolConfig = { ...moduleContext.metadata.protocolConfig };
          
          secureLogger.info('🔥🔥 [COMPATIBILITY-CONTEXT-FIX] 复制protocolConfig回原始context', {
            requestId: context.requestId,
            hasCustomHeaders: !!(context.metadata.protocolConfig.customHeaders),
            customHeadersKeys: context.metadata.protocolConfig.customHeaders ? Object.keys(context.metadata.protocolConfig.customHeaders) : 'no-headers',
            contextSynchronized: true
          });
        }
        
        // 🎯 移除任何可能的内部字段，确保输出纯净
        delete (processedRequest as any).__internal;
        delete (processedRequest as any).anthropic;
        delete (processedRequest as any)._metadata;
        delete (processedRequest as any)._config;
        
        secureLogger.debug(`${LAYER_NAMES.SERVER_COMPATIBILITY}层：Context模式处理完成`, {
          requestId: context.requestId,
          compatibilityTag,
          dataIsPure: !('__internal' in processedRequest),
          hasContext: !!moduleContext,
          providerName: moduleContext.providerName,
          protocolConfigSynced: !!(context.metadata?.protocolConfig)
        });

        context.transformations.push({
          layer: LAYER_NAMES.SERVER_COMPATIBILITY,
          compatibilityTag,
          timestamp: new Date(),
        });

      } else {
        // 如果没有找到兼容性模块，使用透传模式
        secureLogger.debug(`${LAYER_NAMES.SERVER_COMPATIBILITY}层：使用${PROCESSING_MODES.PASSTHROUGH}模式`, {
          requestId: context.requestId,
          compatibilityTag,
        });

        context.transformations.push({
          layer: LAYER_NAMES.SERVER_COMPATIBILITY,
          mode: PROCESSING_MODES.PASSTHROUGH,
          timestamp: new Date(),
        });
      }

      return processedRequest;

    } catch (error) {
      secureLogger.error(`${LAYER_NAMES.SERVER_COMPATIBILITY}层处理失败`, {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack,
      });

      // 如果兼容性处理失败，返回原始请求但记录错误
      context.errors.push({
        layer: LAYER_NAMES.SERVER_COMPATIBILITY,
        error: error.message,
        timestamp: new Date(),
      });

      return request;
    }
  }

  /**
   * 动态加载兼容性模块
   */
  async loadCompatibilityModule(
    compatibilityTag: string,
    compatibilityOptions: any = {}, // 兼容性选项代替moduleInfo
    request: any,
    context: RequestContext,
    routingDecision?: any
  ): Promise<any | null> {
    try {
      // 检查是否已经加载过该模块
      if (this.loadedModules.has(compatibilityTag)) {
        return this.loadedModules.get(compatibilityTag);
      }

      secureLogger.debug('动态加载兼容性模块', {
        requestId: context.requestId,
        compatibilityTag,
        availableModules: this.getAvailableCompatibilityModules(),
      });

      let compatibilityModule: any = null;

      // 🔧 关键修复：基于新统一配置格式动态确定兼容性模块
      switch (compatibilityTag) {
        case COMPATIBILITY_TAGS.LMSTUDIO:
        case 'lmstudio': // 支持新统一配置格式
          compatibilityModule = await this.loadLMStudioCompatibility(compatibilityOptions);
          break;
        case COMPATIBILITY_TAGS.OLLAMA:
        case 'ollama':
          compatibilityModule = await this.loadOllamaCompatibility(compatibilityOptions);
          break;
        case COMPATIBILITY_TAGS.VLLM:
        case 'vllm':
          compatibilityModule = await this.loadVLLMCompatibility(compatibilityOptions);
          break;
        case COMPATIBILITY_TAGS.ANTHROPIC:
        case 'anthropic':
          compatibilityModule = await this.loadAnthropicCompatibility(compatibilityOptions);
          break;
        case COMPATIBILITY_TAGS.MODELSCOPE:
        case 'modelscope':
          compatibilityModule = await this.loadModelScopeCompatibility(compatibilityOptions);
          break;
        case COMPATIBILITY_TAGS.QWEN:
        case 'qwen':
          compatibilityModule = await this.loadQwenCompatibility(compatibilityOptions);
          break;
        case COMPATIBILITY_TAGS.IFLOW:
        case 'iflow':
          compatibilityModule = await this.loadIFlowCompatibility(compatibilityOptions);
          break;
        case COMPATIBILITY_TAGS.OPENAI:
        case 'openai':
        case COMPATIBILITY_TAGS.DEFAULT:
        case 'passthrough':
          // OpenAI标准格式或透传模式
          compatibilityModule = await this.loadPassthroughCompatibility(compatibilityOptions);
          break;
        default:
          secureLogger.warn(`未知的兼容性标签，使用${PROCESSING_MODES.PASSTHROUGH}模式`, {
            requestId: context.requestId,
            compatibilityTag,
          });
          compatibilityModule = await this.loadPassthroughCompatibility(compatibilityOptions);
          break;
      }

      // 缓存加载的模块
      if (compatibilityModule) {
        this.loadedModules.set(compatibilityTag, compatibilityModule);
        secureLogger.info('兼容性模块加载成功', {
          requestId: context.requestId,
          compatibilityTag,
          moduleType: typeof compatibilityModule,
        });
      }

      return compatibilityModule;

    } catch (error) {
      secureLogger.error('兼容性模块加载失败', {
        requestId: context.requestId,
        compatibilityTag,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 加载LM Studio兼容性模块 - 支持新统一配置
   */
  private async loadLMStudioCompatibility(compatibilityOptions: any = {}): Promise<any> {
    try {
      const moduleExports = require(COMPATIBILITY_MODULE_PATHS.LMSTUDIO);
      const ModuleClass = moduleExports[COMPATIBILITY_MODULE_CLASSES.LMSTUDIO];
      
      // 🔧 新架构：从路由决策中获取LM Studio配置
      const lmstudioConfig = {
        ...compatibilityOptions // 使用传入的兼容性选项
      };
      
      secureLogger.debug('🔧 LMStudio兼容性配置', {
        hasOptions: Object.keys(compatibilityOptions).length > 0,
        mergedConfig: Object.keys(lmstudioConfig),
        architecture: 'unified-format'
      });
      
      const module = new ModuleClass(lmstudioConfig);
      await module.initialize();
      
      return module;
    } catch (error) {
      secureLogger.error(`${PROVIDER_NAMES.LMSTUDIO}兼容性模块加载失败`, {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * 加载Ollama兼容性模块 - 支持新统一配置
   */
  private async loadOllamaCompatibility(compatibilityOptions: any = {}): Promise<any> {
    try {
      const moduleExports = require(COMPATIBILITY_MODULE_PATHS.OLLAMA);
      const ModuleClass = moduleExports[COMPATIBILITY_MODULE_CLASSES.OLLAMA];
      
      // 从配置中获取Ollama配置
      const ollamaConfig = this.getOllamaConfigFromConfig();
      
      const module = new ModuleClass(ollamaConfig);
      await module.initialize();
      
      return module;
    } catch (error) {
      secureLogger.warn(`${PROVIDER_NAMES.OLLAMA}兼容性模块加载失败，使用${PROCESSING_MODES.PASSTHROUGH}模式`, {
        error: error.message,
      });
      return await this.loadPassthroughCompatibility();
    }
  }

  /**
   * 加载VLLM兼容性模块
   */
  private async loadVLLMCompatibility(compatibilityOptions: any = {}): Promise<any> {
    try {
      const moduleExports = require(COMPATIBILITY_MODULE_PATHS.VLLM);
      const ModuleClass = moduleExports[COMPATIBILITY_MODULE_CLASSES.VLLM];
      
      // 从配置中获取VLLM配置
      const vllmConfig = this.getVLLMConfigFromConfig();
      
      const module = new ModuleClass(vllmConfig);
      await module.initialize();
      
      return module;
    } catch (error) {
      secureLogger.warn(`${PROVIDER_NAMES.VLLM}兼容性模块加载失败，使用${PROCESSING_MODES.PASSTHROUGH}模式`, {
        error: error.message,
      });
      return await this.loadPassthroughCompatibility();
    }
  }

  /**
   * 加载ModelScope兼容性模块
   */
  private async loadModelScopeCompatibility(compatibilityOptions: any = {}): Promise<any> {
    try {
      const moduleExports = require(COMPATIBILITY_MODULE_PATHS.MODELSCOPE);
      const ModuleClass = moduleExports[COMPATIBILITY_MODULE_CLASSES.MODELSCOPE];
      
      // 从配置中获取ModelScope配置
      const modelScopeConfig = this.getModelScopeConfigFromConfig();
      
      const module = new ModuleClass(modelScopeConfig);
      await module.initialize();
      
      return module;
    } catch (error) {
      secureLogger.error(`${PROVIDER_NAMES.MODELSCOPE}兼容性模块加载失败`, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 加载Anthropic兼容性模块
   */
  private async loadAnthropicCompatibility(compatibilityOptions: any = {}): Promise<any> {
    try {
      const moduleExports = require(COMPATIBILITY_MODULE_PATHS.ANTHROPIC);
      const ModuleClass = moduleExports[COMPATIBILITY_MODULE_CLASSES.ANTHROPIC];
      
      // 从配置中获取Anthropic配置
      const anthropicConfig = this.getAnthropicConfigFromConfig();
      
      const module = new ModuleClass(anthropicConfig);
      await module.initialize();
      
      return module;
    } catch (error) {
      secureLogger.warn(`${PROVIDER_NAMES.ANTHROPIC}兼容性模块加载失败，使用${PROCESSING_MODES.PASSTHROUGH}模式`, {
        error: error.message,
      });
      return await this.loadPassthroughCompatibility();
    }
  }

  /**
   * 加载Qwen兼容性模块
   */
  private async loadQwenCompatibility(compatibilityOptions: any = {}): Promise<any> {
    try {
      const moduleExports = require(COMPATIBILITY_MODULE_PATHS.QWEN);
      const ModuleClass = moduleExports[COMPATIBILITY_MODULE_CLASSES.QWEN];
      
      // 从配置中获取Qwen配置
      const qwenConfig = this.getQwenConfigFromConfig();
      
      const module = new ModuleClass(qwenConfig);
      await module.initialize();
      
      return module;
    } catch (error) {
      secureLogger.error(`${PROVIDER_NAMES.QWEN}兼容性模块加载失败`, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 加载iFlow兼容性模块
   */
  private async loadIFlowCompatibility(compatibilityOptions: any = {}): Promise<any> {
    try {
      const moduleExports = require(COMPATIBILITY_MODULE_PATHS.IFLOW);
      const ModuleClass = moduleExports[COMPATIBILITY_MODULE_CLASSES.IFLOW];
      
      // 从配置中获取iFlow配置
      const iflowConfig = this.getIFlowConfigFromConfig();
      
      const module = new ModuleClass(iflowConfig);
      await module.initialize();
      
      return module;
    } catch (error) {
      secureLogger.error(`${PROVIDER_NAMES.IFLOW}兼容性模块加载失败`, {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 加载透传兼容性模块
   */
  private async loadPassthroughCompatibility(compatibilityOptions: any = {}): Promise<any> {
    try {
      const moduleExports = require(COMPATIBILITY_MODULE_PATHS.PASSTHROUGH);
      const ModuleClass = moduleExports[COMPATIBILITY_MODULE_CLASSES.PASSTHROUGH];
      
      const module = new ModuleClass({});
      await module.initialize();
      
      return module;
    } catch (error) {
      secureLogger.error(`${PROCESSING_MODES.PASSTHROUGH}兼容性模块加载失败`, {
        error: error.message,
      });
      
      // 返回一个简单的透传实现
      return {
        async process(request: any): Promise<any> {
          return request;
        }
      };
    }
  }

  /**
   * 从流水线ID中提取provider类型
   */
  private extractProviderFromPipelineId(pipelineId: string): string {
    const parts = pipelineId.split('-');
    return parts[0] || 'unknown';
  }

  /**
   * 从流水线ID中提取兼容性标签 (向后兼容)
   */
  private extractCompatibilityFromPipelineId(pipelineId: string, routingDecision?: any): string {
    // 解析流水线ID格式：provider-model-keyIndex
    const parts = pipelineId.split('-');
    const provider = parts[0] || 'unknown';
    
    secureLogger.info('🔍 提取兼容性标签', {
      pipelineId,
      provider,
      availableMappings: Object.keys(PROVIDER_TO_COMPATIBILITY_MAPPING),
    });
    
    // 使用常量映射provider到兼容性标签
    const compatibilityTag = PROVIDER_TO_COMPATIBILITY_MAPPING[provider as keyof typeof PROVIDER_TO_COMPATIBILITY_MAPPING];
    
    if (compatibilityTag) {
      secureLogger.info('✅ 找到兼容性映射', {
        provider,
        compatibilityTag,
      });
      return compatibilityTag;
    }
    
    // 🔧 关键修复：移除硬编码fallback，根据API端点动态确定
    const providerConfig = this.getProviderConfigByName(provider, routingDecision);
    if (providerConfig) {
      const endpoint = providerConfig.api_base_url || '';
      
      // 根据端点特征确定兼容性标签
      if (endpoint.includes('localhost:1234') || endpoint.includes('lmstudio')) {
        return COMPATIBILITY_TAGS.LMSTUDIO;
      } else if (endpoint.includes('localhost:11434') || endpoint.includes('ollama')) {
        return COMPATIBILITY_TAGS.OLLAMA;
      } else if (endpoint.includes('anthropic.com')) {
        return COMPATIBILITY_TAGS.ANTHROPIC;
      } else if (endpoint.includes('modelscope.cn')) {
        return COMPATIBILITY_TAGS.MODELSCOPE;
      } else if (endpoint.includes('dashscope.aliyuncs.com')) {
        return COMPATIBILITY_TAGS.QWEN;
      } else if (endpoint.includes('openai.com')) {
        return COMPATIBILITY_TAGS.PASSTHROUGH;
      }
    }
    
    secureLogger.warn('未找到兼容性映射，使用透传模式', {
      provider,
      pipelineId,
    });
    
    // 默认使用透传兼容性
    return COMPATIBILITY_TAGS.PASSTHROUGH;
  }

  /**
   * 根据Provider名称获取配置
   */
  private getProviderConfigByName(providerName: string, routingDecision: any): any | null {
    // 从routingDecision中获取provider配置
    if (routingDecision?.providers) {
      return routingDecision.providers.find((p: any) => p.name === providerName) || null;
    }
    return null;
  }

  /**
   * 从路由决策中获取LM Studio配置
   */
  private getLMStudioConfigFromRoutingDecision(routingDecision: any): any {
    // 从路由表中获取provider配置
    const providers = this.routingTable?.allPipelines?.map(p => ({
      name: p.provider,
      api_base_url: p.endpoint,
      models: [p.targetModel]
    })) || [];
    
    const lmstudioProvider = providers.find((p: any) => 
      p.name === PROVIDER_NAMES.LMSTUDIO || 
      p.name === PROVIDER_NAMES.OPENAI || 
      p.api_base_url?.includes(URL_PATTERNS.LMSTUDIO_LOCALHOST)
    );

    if (lmstudioProvider) {
      return {
        baseUrl: lmstudioProvider.api_base_url || DEFAULT_ENDPOINTS.LMSTUDIO,
        timeout: DEFAULT_TIMEOUTS.STANDARD,
        maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
        retryDelay: DEFAULT_RETRY_CONFIG.RETRY_DELAY,
        models: lmstudioProvider.models || DEFAULT_MODELS.LMSTUDIO,
      };
    }

    // 如果没有找到，返回默认配置
    return {
      baseUrl: DEFAULT_ENDPOINTS.LMSTUDIO,
      timeout: DEFAULT_TIMEOUTS.STANDARD,
      maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
      retryDelay: DEFAULT_RETRY_CONFIG.RETRY_DELAY,
      models: DEFAULT_MODELS.LMSTUDIO,
    };
  }

  /**
   * 从配置中获取Ollama配置
   */
  private getOllamaConfigFromConfig(): any {
    // 从路由表中获取provider配置
    const providers = this.routingTable?.allPipelines?.map(p => ({
      name: p.provider,
      api_base_url: p.endpoint,
      models: [p.targetModel]
    })) || [];
    
    const ollamaProvider = providers.find(p => 
      p.name === PROVIDER_NAMES.OLLAMA || 
      p.api_base_url?.includes(URL_PATTERNS.OLLAMA_LOCALHOST)
    );

    if (ollamaProvider) {
      return {
        baseUrl: ollamaProvider.api_base_url || DEFAULT_ENDPOINTS.OLLAMA,
        timeout: DEFAULT_TIMEOUTS.STANDARD,
        maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
        models: ollamaProvider.models || DEFAULT_MODELS.OLLAMA,
      };
    }

    return {
      baseUrl: DEFAULT_ENDPOINTS.OLLAMA,
      timeout: DEFAULT_TIMEOUTS.STANDARD,
      maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
      models: DEFAULT_MODELS.OLLAMA,
    };
  }

  /**
   * 从配置中获取VLLM配置
   */
  private getVLLMConfigFromConfig(): any {
    // 从路由表中获取provider配置
    const providers = this.routingTable?.allPipelines?.map(p => ({
      name: p.provider,
      api_base_url: p.endpoint,
      models: [p.targetModel]
    })) || [];
    
    const vllmProvider = providers.find(p => 
      p.name === PROVIDER_NAMES.VLLM || 
      p.api_base_url?.includes(URL_PATTERNS.VLLM_PATTERN)
    );

    if (vllmProvider) {
      return {
        baseUrl: vllmProvider.api_base_url,
        timeout: DEFAULT_TIMEOUTS.STANDARD,
        maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
        models: vllmProvider.models || DEFAULT_MODELS.OPENAI,
      };
    }

    return {
      baseUrl: DEFAULT_ENDPOINTS.VLLM,
      timeout: DEFAULT_TIMEOUTS.STANDARD,
      maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
      models: DEFAULT_MODELS.OPENAI,
    };
  }

  /**
   * 从配置中获取ModelScope配置
   */
  private getModelScopeConfigFromConfig(): any {
    // 从路由表中获取provider配置
    const providers = this.routingTable?.allPipelines?.map(p => ({
      name: p.provider,
      api_base_url: p.endpoint,
      models: [p.targetModel]
    })) || [];
    
    const modelScopeProvider = providers.find(p => 
      p.name === PROVIDER_NAMES.MODELSCOPE || 
      p.api_base_url?.includes('modelscope.cn')
    );

    if (modelScopeProvider) {
      return {
        preserveToolCalls: true,
        validateInputSchema: true,
        maxToolsPerRequest: 20,
        baseUrl: modelScopeProvider.api_base_url,
        timeout: DEFAULT_TIMEOUTS.STANDARD,
        maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
        models: modelScopeProvider.models || [],
      };
    }

    return {
      preserveToolCalls: true,
      validateInputSchema: true,
      maxToolsPerRequest: 20,
      timeout: DEFAULT_TIMEOUTS.STANDARD,
      maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
      models: [],
    };
  }

  /**
   * 从配置中获取Anthropic配置
   */
  private getAnthropicConfigFromConfig(): any {
    // 从路由表中获取provider配置
    const providers = this.routingTable?.allPipelines?.map(p => ({
      name: p.provider,
      api_base_url: p.endpoint,
      models: [p.targetModel]
    })) || [];
    
    const anthropicProvider = providers.find(p => 
      p.name === PROVIDER_NAMES.ANTHROPIC || 
      p.api_base_url?.includes(URL_PATTERNS.ANTHROPIC_DOMAIN)
    );

    if (anthropicProvider) {
      return {
        baseUrl: anthropicProvider.api_base_url || DEFAULT_ENDPOINTS.ANTHROPIC,
        timeout: DEFAULT_TIMEOUTS.STANDARD,
        maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
        models: anthropicProvider.models || DEFAULT_MODELS.ANTHROPIC,
      };
    }

    return {
      baseUrl: DEFAULT_ENDPOINTS.ANTHROPIC,
      timeout: DEFAULT_TIMEOUTS.STANDARD,
      maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
      models: DEFAULT_MODELS.ANTHROPIC,
    };
  }

  /**
   * 从配置中获取Qwen配置
   */
  private getQwenConfigFromConfig(): any {
    // 从路由表中获取provider配置
    const providers = this.routingTable?.allPipelines?.map(p => ({
      name: p.provider,
      api_base_url: p.endpoint,
      models: [p.targetModel]
    })) || [];
    
    const qwenProvider = providers.find(p => 
      p.name === PROVIDER_NAMES.QWEN || 
      p.api_base_url?.includes(URL_PATTERNS.QWEN_DOMAIN)
    );

    if (qwenProvider) {
      return {
        baseUrl: qwenProvider.api_base_url || `https://${URL_PATTERNS.QWEN_DOMAIN}/v1`,
        timeout: DEFAULT_TIMEOUTS.STANDARD,
        maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
        models: qwenProvider.models || ['qwen-plus', 'qwen-max'],
        authDir: '~/.route-claudecode/auth'
      };
    }

    return {
      baseUrl: `https://${URL_PATTERNS.QWEN_DOMAIN}/v1`,
      timeout: DEFAULT_TIMEOUTS.STANDARD,
      maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
      models: ['qwen-plus', 'qwen-max'],
      authDir: '~/.route-claudecode/auth'
    };
  }

  /**
   * 从配置中获取iFlow配置 - ✅ Configuration-driven implementation
   */
  private getIFlowConfigFromConfig(): any {
    // 从路由表中获取provider配置
    const providers = this.routingTable?.allPipelines?.map(p => ({
      name: p.provider,
      api_base_url: p.endpoint,
      models: [p.targetModel]
    })) || [];
    
    const iflowProvider = providers.find(p => 
      p.name === PROVIDER_NAMES.IFLOW || 
      p.api_base_url?.includes(URL_PATTERNS.IFLOW_DOMAIN)
    );

    if (iflowProvider) {
      // ✅ Extract serverCompatibility options for enhanced configuration
      // Note: In this simplified version, we don't have access to serverCompatibility options
      return {
        baseUrl: iflowProvider.api_base_url || DEFAULT_ENDPOINTS.IFLOW,
        timeout: DEFAULT_TIMEOUTS.STANDARD,
        maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
        
        // ✅ Enhanced model configuration
        models: {
          available: iflowProvider.models || DEFAULT_MODELS.IFLOW,
          default: DEFAULT_MODELS.IFLOW[0],
          mapping: {
            'deepseek': 'deepseek-r1',
            'kimi': 'kimi-k2', 
            'qwen': 'qwen3-coder',
            'glm': 'glm-4.5'
          }
        },
        
        // ✅ Authentication configuration
        authentication: {
          method: 'Bearer',
          format: 'Bearer {token}'
        },
        
        // ✅ Parameter configuration
        parameters: {
          topK: { min: 1, max: 100, default: 40 },
          temperature: { min: 0.1, max: 2.0, default: 0.7 }
        },
        
        // ✅ Endpoint configuration
        endpoints: {
          primary: iflowProvider.api_base_url || DEFAULT_ENDPOINTS.IFLOW,
          fallback: []
        }
      };
    }

    // ✅ Default configuration with proper structure
    return {
      baseUrl: DEFAULT_ENDPOINTS.IFLOW,
      timeout: DEFAULT_TIMEOUTS.STANDARD,
      maxRetries: DEFAULT_RETRY_CONFIG.MAX_RETRIES,
      
      models: {
        available: DEFAULT_MODELS.IFLOW,
        default: DEFAULT_MODELS.IFLOW[0],
        mapping: {
          'deepseek': 'deepseek-r1',
          'kimi': 'kimi-k2',
          'qwen': 'qwen3-coder', 
          'glm': 'glm-4.5'
        }
      },
      
      authentication: {
        method: 'Bearer',
        format: 'Bearer {token}'
      },
      
      parameters: {
        topK: { min: 1, max: 100, default: 40 },
        temperature: { min: 0.1, max: 2.0, default: 0.7 }
      },
      
      endpoints: {
        primary: DEFAULT_ENDPOINTS.IFLOW,
        fallback: []
      }
    };
  }

  /**
   * 获取可用的兼容性模块列表
   */
  private getAvailableCompatibilityModules(): string[] {
    return [
      COMPATIBILITY_TAGS.LMSTUDIO,
      COMPATIBILITY_TAGS.OLLAMA,
      COMPATIBILITY_TAGS.VLLM,
      COMPATIBILITY_TAGS.ANTHROPIC,
      COMPATIBILITY_TAGS.MODELSCOPE,
      COMPATIBILITY_TAGS.QWEN,
      COMPATIBILITY_TAGS.IFLOW,
      COMPATIBILITY_TAGS.PASSTHROUGH
    ];
  }

  /**
   * 清理已加载的兼容性模块
   */
  async cleanup(): Promise<void> {
    for (const [tag, module] of this.loadedModules) {
      try {
        if (module && typeof module.cleanup === 'function') {
          await module.cleanup();
        }
      } catch (error) {
        secureLogger.warn('兼容性模块清理失败', {
          tag,
          error: error.message,
        });
      }
    }
    
    this.loadedModules.clear();
    secureLogger.info('兼容性管理器清理完成');
  }
}