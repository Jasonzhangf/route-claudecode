/**
 * RCC v4.0 Router Preprocessor
 * 
 * 一次性路由器预处理器 - 零接口暴露设计
 * 
 * 设计理念：
 * - 只在系统初始化时运行一次
 * - 唯一的公开方法：preprocess()
 * - 所有内部方法使用下划线前缀，外部无法访问
 * - 输入：配置文件，输出：路由表和流水线配置
 * - 生命周期结束后即销毁，不保留任何引用
 * 
 * @author Claude
 */

// Import from local types
import { RoutingTable, ProviderInfo, RouteMapping } from './routing-table-types';
import { RCCError, RCCErrorCode, EnhancedErrorHandler } from '../../error-handler/src/enhanced-error-handler';
import { ModuleDebugIntegration } from '../../logging/src/debug-integration';

/**
 * 流水线配置接口
 */
export interface PipelineConfig {
  pipelineId: string;
  routeId: string;
  provider: string;
  model: string;
  endpoint: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
  maxTokens?: number;
  layers: PipelineLayer[];
}

/**
 * 流水线层配置
 */
export interface PipelineLayer {
  name: string;
  type: 'client' | 'router' | 'transformer' | 'protocol' | 'server-compatibility' | 'server';
  order: number;
  config: Record<string, any>;
}

/**
 * 路由预处理结果
 */
export interface RouterPreprocessResult {
  success: boolean;
  routingTable?: _InternalRoutingTable;
  pipelineConfigs?: PipelineConfig[];
  errors: string[];
  warnings: string[];
  stats: {
    routesCount: number;
    pipelinesCount: number;
    processingTimeMs: number;
  };
}

/**
 * 内部路由表结构（与现有PipelineRouter兼容）
 */
interface _InternalRoutingTable {
  routes: Record<string, _PipelineRoute[]>; // virtualModel -> PipelineRoute[]
  defaultRoute: string;
  metadata: {
    configSource: string;
    generatedAt: string;
    preprocessorVersion: string;
  };
}

/**
 * 内部流水线路由定义
 */
interface _PipelineRoute {
  routeId: string;
  routeName: string;
  virtualModel: string;
  provider: string;
  apiKeyIndex: number;
  pipelineId: string;
  isActive: boolean;
  health: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * 路由预处理错误类 - 已废弃，使用统一的RCCError
 */
class _RouterPreprocessError extends RCCError {
  constructor(message: string, code: string) {
    super(message, RCCErrorCode.INTERNAL_ERROR, 'router');
  }
}

/**
 * 路由器预处理器 - 静态类，零接口暴露
 * 
 * 外部只能访问preprocess()方法
 * 所有内部逻辑使用下划线前缀，完全封装
 */
export class RouterPreprocessor {
  private static errorHandler: EnhancedErrorHandler = new EnhancedErrorHandler();
  private static debugIntegration: ModuleDebugIntegration = new ModuleDebugIntegration({
    moduleId: 'router',
    moduleName: 'RouterPreprocessor',
    enabled: true,
    captureLevel: 'full'
  });
  
  /**
   * 预处理器版本（内部）
   */
  private static readonly _VERSION = '4.1.0';
  
  /**
   * 默认流水线层配置（内部）
   * 流水线从transformer层开始到server层结束
   */
  private static readonly _DEFAULT_LAYERS: PipelineLayer[] = [
    { name: 'transformer', type: 'transformer', order: 1, config: {} },
    { name: 'protocol', type: 'protocol', order: 2, config: {} },
    { name: 'server-compatibility', type: 'server-compatibility', order: 3, config: {} },
    { name: 'server', type: 'server', order: 4, config: {} }
  ];
  
  /**
   * 路由器预处理主方法 - 唯一的公开接口
   * 
   * @param routingTable 来自ConfigPreprocessor的路由表
   * @returns 预处理结果，包含路由表和流水线配置
   */
  static async preprocess(routingTable: RoutingTable): Promise<RouterPreprocessResult> {
    const startTime = Date.now();
    
    // Router preprocessing started
    
    try {
      // 1. 验证输入
      this._validateInput(routingTable);
      
      // 2. 生成内部路由表
      const internalRoutingTable = this._generateInternalRoutingTable(routingTable);
      
      // 3. 生成流水线配置
      const pipelineConfigs = this._generatePipelineConfigs(routingTable);
      
      // 4. 验证生成结果
      const validationErrors = this._validateResults(internalRoutingTable, pipelineConfigs);
      
      // 5. 计算处理统计
      const processingTimeMs = Date.now() - startTime;
      const stats = {
        routesCount: Object.keys(internalRoutingTable.routes).length,
        pipelinesCount: pipelineConfigs.length,
        processingTimeMs
      };
      
      // Router preprocessing completed
      
      return {
        success: validationErrors.length === 0,
        routingTable: validationErrors.length === 0 ? internalRoutingTable : undefined,
        pipelineConfigs: validationErrors.length === 0 ? pipelineConfigs : undefined,
        errors: validationErrors,
        warnings: [],
        stats
      };
      
    } catch (err) {
      const processingTimeMs = Date.now() - startTime;
      const error = err as Error;
      
      // Router preprocessing failed
      
      return {
        success: false,
        errors: [err instanceof RCCError ? err.message : (err as Error).message],
        warnings: [],
        stats: {
          routesCount: 0,
          pipelinesCount: 0,
          processingTimeMs
        }
      };
    }
  }
  
  /**
   * 验证输入参数（内部方法）
   */
  private static _validateInput(routingTable: RoutingTable): void {
    if (!routingTable) {
      throw new _RouterPreprocessError('路由表不能为空', 'INVALID_INPUT');
    }
    
    if (!routingTable.providers || routingTable.providers.length === 0) {
      throw new _RouterPreprocessError('路由表中没有Provider配置', 'NO_PROVIDERS');
    }
    
    if (!routingTable.routes || Object.keys(routingTable.routes).length === 0) {
      throw new _RouterPreprocessError('路由表中没有路由配置', 'NO_ROUTES');
    }
  }
  
  /**
   * 生成内部路由表（内部方法）
   */
  private static _generateInternalRoutingTable(routingTable: RoutingTable): _InternalRoutingTable {
    const routes: Record<string, _PipelineRoute[]> = {};
    
    // 为每个路由生成流水线路由
    for (const [routeName, routeSpec] of Object.entries(routingTable.routes)) {
      // 解析路由规格："provider,model" 或 "provider1,model1;provider2,model2;..."
      const routeOptions = routeSpec.split(';');
      const targetModel = routeName; // 路由名称作为目标模型
      
      for (let i = 0; i < routeOptions.length; i++) {
        const [provider, model] = routeOptions[i].split(',');
        if (!provider || !model) continue;
        
        const providerInfo = routingTable.providers.find(p => p.name === provider.trim());
        if (!providerInfo) continue;
        
        // 获取API密钥数组
        const apiKeys = Array.isArray(providerInfo.api_key) ? providerInfo.api_key : [providerInfo.api_key];
        
        // 为每个API密钥生成一个路由条目
        for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
          const pipelineRoute: _PipelineRoute = {
            routeId: `route_${routeName}_${provider.trim()}_${i}_${keyIndex}`,
            routeName: routeName,
            virtualModel: targetModel,
            provider: provider.trim(),
            apiKeyIndex: keyIndex,
            pipelineId: `pipeline_${provider.trim()}_${model.trim()}_${keyIndex}`,
            isActive: true,
            health: 'healthy'
          };
          
          if (!routes[targetModel]) {
            routes[targetModel] = [];
          }
          routes[targetModel].push(pipelineRoute);
        }
      }
    }
    
    // 按Provider优先级排序
    for (const targetModel in routes) {
      routes[targetModel].sort((a, b) => {
        const providerA = routingTable.providers.find(p => p.name === a.provider);
        const providerB = routingTable.providers.find(p => p.name === b.provider);
        return (providerB?.priority || 0) - (providerA?.priority || 0);
      });
    }
    
    return {
      routes,
      defaultRoute: 'default', // 默认路由名称
      metadata: {
        configSource: 'ConfigPreprocessor',
        generatedAt: new Date().toISOString(),
        preprocessorVersion: this._VERSION
      }
    };
  }
  
  /**
   * 生成流水线配置（内部方法）
   */
  private static _generatePipelineConfigs(routingTable: RoutingTable): PipelineConfig[] {
    const pipelineConfigs: PipelineConfig[] = [];
    const generatedPipelines = new Set<string>(); // 避免重复生成相同的流水线
    
    for (const [routeName, routeSpec] of Object.entries(routingTable.routes)) {
      // 解析路由规格："provider,model" 或 "provider1,model1;provider2,model2;..."
      const routeOptions = routeSpec.split(';');
      
      for (let i = 0; i < routeOptions.length; i++) {
        const [providerName, modelName] = routeOptions[i].split(',');
        if (!providerName || !modelName) continue;
        
        const provider = routingTable.providers.find(p => p.name === providerName.trim());
        
        if (!provider) {
          // Provider not found for route
          continue;
        }
        
        // 获取API密钥数组
        const apiKeys = Array.isArray(provider.api_key) ? provider.api_key : [provider.api_key];
        
        // 为每个API密钥生成一个流水线配置
        for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex++) {
          const pipelineKey = `${providerName.trim()}_${modelName.trim()}_${keyIndex}`;
          if (generatedPipelines.has(pipelineKey)) {
            continue; // 避免重复生成相同的流水线
          }
          
          const apiKey = apiKeys[keyIndex];
          
          // 获取模型的maxTokens值
          let modelMaxTokens: number | undefined;
          
          // 首先从模型级别获取maxTokens
          for (const model of provider.models) {
            if (typeof model === 'object' && model.name === modelName.trim() && model.maxTokens !== undefined) {
              modelMaxTokens = model.maxTokens;
              break;
            }
          }
          
          // 如果模型级别没有，则从Provider级别获取
          if (modelMaxTokens === undefined && provider.maxTokens !== undefined) {
            modelMaxTokens = provider.maxTokens;
          }
          
          const pipelineConfig: PipelineConfig = {
            pipelineId: `pipeline_${providerName.trim()}_${modelName.trim()}_${keyIndex}`,
            routeId: `route_${routeName}_${providerName.trim()}_${i}_${keyIndex}`,
            provider: providerName.trim(),
            model: modelName.trim(),
            endpoint: provider.api_base_url,
            apiKey: apiKey,
            timeout: 60000, // 默认超时
            maxRetries: 3, // 默认重试次数
            layers: this._generateLayerConfigs(provider, { 
              routeName, 
              providerName: providerName.trim(), 
              modelName: modelName.trim(),
              apiKeyIndex: keyIndex
            })
          };
          
          // 添加maxTokens到顶层配置（如果存在）
          if (modelMaxTokens !== undefined) {
            pipelineConfig.maxTokens = modelMaxTokens;
          }
          
          pipelineConfigs.push(pipelineConfig);
          generatedPipelines.add(pipelineKey);
        }
      }
    }
    
    return pipelineConfigs;
  }
  
  /**
   * 生成层配置（内部方法）
   */
  private static _generateLayerConfigs(provider: ProviderInfo, route: { modelName: string; routeName: string; apiKeyIndex?: number; [key: string]: unknown }): PipelineLayer[] {
    // 获取模型的maxTokens值
    let modelMaxTokens: number | undefined;
    
    // 首先从模型级别获取maxTokens
    for (const model of provider.models) {
      if (typeof model === 'object' && model.name === route.modelName && model.maxTokens !== undefined) {
        modelMaxTokens = model.maxTokens;
        break;
      }
    }
    
    // 如果模型级别没有，则从Provider级别获取
    if (modelMaxTokens === undefined && provider.maxTokens !== undefined) {
      modelMaxTokens = provider.maxTokens;
    }
    
    // 获取正确的API密钥索引
    const apiKeyIndex = route.apiKeyIndex || 0;
    const apiKeys = Array.isArray(provider.api_key) ? provider.api_key : [provider.api_key];
    const selectedApiKey = apiKeys[apiKeyIndex] || apiKeys[0];
    
    return this._DEFAULT_LAYERS.map(layer => {
      // 根据不同层类型生成特定配置
      let layerConfig: Record<string, unknown> = {};

      switch (layer.type) {
        case 'client':
          // 客户端层只需要基础信息
          layerConfig = {
            provider: provider.name,
            model: route.modelName
          };
          break;
          
        case 'router':
          // 路由层需要路由相关信息
          layerConfig = {
            provider: provider.name,
            model: route.modelName
          };
          break;
          
        case 'transformer':
          // 转换层需要端点和认证信息
          layerConfig = {
            provider: provider.name,
            model: route.modelName,
            endpoint: provider.api_base_url,
            apiKey: selectedApiKey
          };
          break;
          
        case 'protocol':
          // 协议层需要模型和端点信息
          layerConfig = {
            provider: provider.name,
            model: route.modelName,
            endpoint: provider.api_base_url
          };
          break;
          
        case 'server-compatibility':
          // 服务器兼容层需要完整的兼容性配置
          layerConfig = {
            provider: provider.name,
            model: route.modelName,
            endpoint: provider.api_base_url,
            apiKey: selectedApiKey,
            timeout: 60000
          };
          
          // 添加serverCompatibility配置和maxTokens
          if (provider.serverCompatibility) {
            // 先添加基本的serverCompatibility配置
            layerConfig = {
              ...layerConfig,
              ...provider.serverCompatibility
            };
            // 如果有options，则用options中的值覆盖同名属性
            if (provider.serverCompatibility.options) {
              layerConfig = {
                ...layerConfig,
                ...provider.serverCompatibility.options
              };
            }
            // 移除嵌套的options对象本身，避免重复
            delete layerConfig.options;
          }
          
          // 模型级别maxTokens优先级最高，覆盖Provider级别和options中的值
          if (modelMaxTokens !== undefined) {
            layerConfig.maxTokens = modelMaxTokens;
          }
          break;
          
        case 'server':
          // 服务器层需要完整的连接配置
          layerConfig = {
            provider: provider.name,
            model: route.modelName,
            endpoint: provider.api_base_url,
            apiKey: selectedApiKey,
            timeout: 60000
          };
          
          // 添加maxTokens配置（如果存在）
          if (modelMaxTokens !== undefined) {
            layerConfig.maxTokens = modelMaxTokens;
          }
          break;
          
        default:
          // 默认配置
          layerConfig = {
            provider: provider.name,
            model: route.modelName,
            endpoint: provider.api_base_url,
            apiKey: selectedApiKey,
            timeout: 60000
          };
          
          // 添加maxTokens配置（如果存在）
          if (modelMaxTokens !== undefined) {
            layerConfig.maxTokens = modelMaxTokens;
          }
      }

      return {
        ...layer,
        config: layerConfig
      };
    });
  }
  
  /**
   * 验证生成结果（内部方法）
   */
  private static _validateResults(
    routingTable: _InternalRoutingTable,
    pipelineConfigs: PipelineConfig[]
  ): string[] {
    const errors: string[] = [];
    
    // 验证路由表
    if (!routingTable.routes || Object.keys(routingTable.routes).length === 0) {
      errors.push('生成的路由表为空');
    }
    
    if (!routingTable.defaultRoute) {
      errors.push('缺少默认路由');
    }
    
    // 验证流水线配置
    if (!pipelineConfigs || pipelineConfigs.length === 0) {
      errors.push('没有生成流水线配置');
    }
    
    // 验证流水线配置完整性
    for (const config of pipelineConfigs) {
      if (!config.pipelineId) {
        errors.push(`流水线配置缺少ID: ${config.provider}-${config.model}`);
      }
      if (!config.endpoint) {
        errors.push(`流水线配置缺少端点: ${config.pipelineId}`);
      }
      if (!config.layers || config.layers.length === 0) {
        errors.push(`流水线配置缺少层定义: ${config.pipelineId}`);
      }
    }
    
    return errors;
  }
}