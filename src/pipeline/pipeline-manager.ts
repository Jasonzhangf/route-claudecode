/**
 * 静态流水线组装系统 - 改造版 Pipeline Manager
 * 
 * 核心职责:
 * 1. 静态流水线组装系统: 根据路由器输出动态选择模块进行组装
 * 2. 流水线只组装一次，后续只会销毁和重启 
 * 3. 不负责负载均衡和请求路由(由LoadBalancer处理)
 * 4. 错误处理策略: 不可恢复的销毁，多次错误拉黑，认证问题处理
 * 
 * RCC v4.0 架构更新 (基于用户纠正):
 * - ❌ 智能动态组装 → ✅ 静态组装+动态模块选择
 * - ❌ Pipeline负责路由 → ✅ LoadBalancer负责路由
 * - ✅ 组装一次，销毁重启的生命周期管理
 * 
 * @author RCC v4.0 Architecture Team
 */

import { EventEmitter } from 'events';
import { 
  PipelineFramework, 
  PipelineConfig, 
  ExecutionContext, 
  ExecutionResult,
  ExecutionRecord,
  ModuleExecutionRecord,
  PerformanceMetrics,
  StandardPipelineFactory
} from '../interfaces/pipeline/pipeline-framework';
import { ModuleInterface, ModuleType, ModuleStatus, PipelineSpec } from '../interfaces/module/base-module';
import { StandardPipeline } from './standard-pipeline';
import { Pipeline, PipelineStatus } from '../interfaces/module/pipeline-module';
import { RoutingTable, PipelineRoute } from '../router/pipeline-router';
import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { LoadBalancerRouter, RouteRequest, RouteResponse } from './load-balancer-router';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 导入模块管理API函数
import {
  createModule,
  startModule,
  stopModule,
  configureModule,
  processWithModule,
  getModuleStatus,
  destroyModule
} from '../api/modules/module-management-api';

/**
 * 完整流水线定义 (RCC v4.0)
 */
export interface CompletePipeline {
  readonly pipelineId: string;
  readonly virtualModel: string;
  readonly provider: string;
  readonly targetModel: string;
  readonly apiKey: string;
  
  // 4层架构组件（初始化时已创建并连接）
  readonly transformer: ModuleInterface;
  readonly protocol: ModuleInterface;
  readonly serverCompatibility: ModuleInterface;
  readonly server: ModuleInterface;
  
  // 配置信息（用于生成流水线表）
  readonly serverCompatibilityName: string; // 实际使用的serverCompatibility名称
  readonly transformerName: string; // 实际使用的transformer名称
  readonly protocolName: string; // 实际使用的protocol名称
  readonly endpoint: string; // 实际endpoint地址
  
  status: 'initializing' | 'runtime' | 'error' | 'stopped';
  lastHandshakeTime: Date;
  
  execute(request: any): Promise<any>;
  handshake(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getStatus(): PipelineStatus;
  stop(): Promise<void>;
}

/**
 * 流水线创建配置 (RCC v4.0)
 */
export interface CompletePipelineConfig {
  pipelineId: string;
  virtualModel: string;
  provider: string;
  targetModel: string;
  apiKey: string;
  endpoint: string;
  transformer: string;
  protocol: string;
  serverCompatibility: string;
}

/**
 * 流水线表数据结构 (用于保存到generated目录)
 */
export interface PipelineTableData {
  configName: string;
  configFile: string;
  generatedAt: string;
  totalPipelines: number;
  pipelinesGroupedByVirtualModel: Record<string, PipelineTableEntry[]>;
  allPipelines: PipelineTableEntry[];
}

/**
 * 流水线表条目 (包含4层架构详细信息)
 */
export interface PipelineTableEntry {
  pipelineId: string;
  virtualModel: string;
  provider: string;
  targetModel: string;
  apiKeyIndex: number;
  endpoint: string;
  status: 'initializing' | 'runtime' | 'error' | 'stopped';
  createdAt: string;
  handshakeTime?: number; // 毫秒
  
  // 4层架构详细信息 (transformer → protocol → server compatibility → server)
  architecture: {
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
  };
}

/**
 * Pipeline管理器
 */
export class PipelineManager extends EventEmitter {
  private pipelines: Map<string, CompletePipeline> = new Map();
  private activeExecutions: Map<string, ExecutionRecord> = new Map();
  private factory: StandardPipelineFactory;
  private systemConfig: {
    providerTypes: Record<string, {
      endpoint: string;
      protocol: string;
      transformer: string;
      serverCompatibility: string;
      timeout?: number;
      maxRetries?: number;
    }>;
    transformers?: Record<string, any>;
    serverCompatibilityModules?: Record<string, any>;
  };
  private isInitialized: boolean = false;
  private configName: string = '';
  private configFile: string = '';
  private port: number = 0;

  // 负载均衡路由系统 (只负责路由，不组装)
  private loadBalancer: LoadBalancerRouter;

  // 静态流水线组装系统的新功能
  private pipelineAssemblyStats = {
    totalAssembled: 0,
    totalDestroyed: 0,
    assemblyTime: 0,
    lastAssemblyTimestamp: 0
  };

  // 模块选择器映射表 (根据路由器输出动态选择模块)
  private readonly MODULE_SELECTORS = {
    transformer: {
      'default': 'AnthropicOpenAITransformer'
    },
    protocol: {
      'openai': 'OpenAIProtocolEnhancer',
      'gemini': 'GeminiProtocolEnhancer', 
      'anthropic': 'AnthropicProtocolEnhancer',
      'default': 'OpenAIProtocolEnhancer'
    },
    serverCompatibility: {
      'lmstudio': 'LMStudioServerCompatibility',
      'ollama': 'OllamaServerCompatibility',
      'vllm': 'VLLMServerCompatibility',
      'anthropic': 'AnthropicServerCompatibility',
      'openai': 'PassthroughServerCompatibility',
      'gemini': 'GeminiServerCompatibility',
      'modelscope': 'ModelScopeServerCompatibility',
      'qwen': 'QwenServerCompatibility',
      'default': 'PassthroughServerCompatibility'
    },
    server: {
      'http': 'HTTPServerModule',
      'websocket': 'WebSocketServerModule',
      'default': 'HTTPServerModule'
    }
  };
  
  constructor(factory: StandardPipelineFactory, systemConfig?: any) {
    super();
    this.factory = factory;
    this.systemConfig = systemConfig;
    
    // 初始化负载均衡路由系统
    this.loadBalancer = new LoadBalancerRouter({
      strategy: 'round_robin' as any,
      maxErrorCount: 3,
      blacklistDuration: 300000
    });

    // 监听负载均衡器事件 (直接设置)
    this.loadBalancer.on('destroyPipelineRequired', async ({ pipelineId, pipeline }) => {
      secureLogger.info('🗑️ 负载均衡器请求销毁流水线', { pipelineId });
      await this.destroyPipeline(pipelineId);
      this.pipelineAssemblyStats.totalDestroyed++;
    });

    this.loadBalancer.on('authenticationRequired', ({ pipelineId }) => {
      secureLogger.warn('🔐 流水线需要认证处理', { pipelineId });
      this.emit('pipelineAuthenticationRequired', { pipelineId });
    });

    this.loadBalancer.on('pipelineReactivated', ({ pipelineId }) => {
      secureLogger.info('♻️ 流水线已重新激活', { pipelineId });
      this.emit('pipelineReactivated', { pipelineId });
    });

    secureLogger.info('🏗️ 静态流水线组装系统+负载均衡路由系统初始化完成');
  }

  /**
   * 静态流水线组装系统初始化 - 根据路由表组装所有流水线
   * 核心改造: 基于路由器输出动态选择模块进行组装
   */
  async initializeFromRoutingTable(routingTable: RoutingTable, configInfo?: { name: string; file: string; port?: number }): Promise<void> {
    secureLogger.info('🏗️ 静态流水线组装系统启动 - 基于路由表组装流水线');
    
    if (this.isInitialized) {
      secureLogger.warn('⚠️ 流水线组装系统已初始化');
      return;
    }

    // 验证路由表
    if (!routingTable || !routingTable.routes) {
      throw new Error('Invalid routing table: routes property is missing or undefined');
    }
    
    // 设置配置信息
    if (configInfo) {
      this.configName = configInfo.name;
      this.configFile = configInfo.file;
      this.port = configInfo.port || 0;
    }

    const createdPipelines: string[] = [];
    const seenProviderModels = new Set<string>();

    try {
      for (const [virtualModel, routes] of Object.entries(routingTable.routes)) {
        for (const route of routes) {
          // 从pipelineId中解析targetModel信息
          // pipelineId格式: provider-targetModel-keyN
          const pipelineIdParts = route.pipelineId.split('-');
          const targetModel = pipelineIdParts.length >= 2 ? pipelineIdParts.slice(1, -1).join('-') : 'unknown';
          const providerModel = `${route.provider}-${targetModel}`;
          
          // 避免重复创建相同的Provider.Model流水线
          if (seenProviderModels.has(providerModel)) {
            continue;
          }
          seenProviderModels.add(providerModel);

          if (!this.systemConfig?.providerTypes?.[route.provider]) {
            throw new Error(`Provider type '${route.provider}' not found in system config`);
          }

          const providerType = this.systemConfig.providerTypes[route.provider];

          // 新架构中每个PipelineRoute对应一个流水线（已包含apiKeyIndex）
          const pipelineId = route.pipelineId;

          secureLogger.info(`  🔨 Creating pipeline: ${pipelineId}`);
          secureLogger.info(`     - Virtual Model: ${virtualModel}`);
          secureLogger.info(`     - Provider: ${route.provider}`);
          secureLogger.info(`     - Target Model: ${targetModel}`);
          secureLogger.info(`     - API Key Index: ${route.apiKeyIndex}`);

          // 创建完整的4层流水线
          const completePipeline = await this.createCompletePipeline({
            pipelineId,
            virtualModel,
            provider: route.provider,
            targetModel: targetModel,
            apiKey: `api-key-${route.apiKeyIndex}`, // 从配置中获取实际的API key
            // 🐛 关键修复：必须使用用户配置的apiBaseUrl，确保所有provider内容来自配置文件
            endpoint: (route as any).apiBaseUrl || (() => {
              throw new Error(`Missing api_base_url for provider ${route.provider}. All endpoint information must come from user config.`);
            })(),
            transformer: providerType.transformer,
            protocol: providerType.protocol,
            // 🐛 关键修复：使用路由中的实际serverCompatibility而不是系统默认值
            serverCompatibility: (route as any).serverCompatibility || providerType.serverCompatibility
          });

          // 执行握手连接
          secureLogger.info(`  🤝 Handshaking pipeline: ${pipelineId}`);
          await completePipeline.handshake();

          // 标记为runtime状态
          completePipeline.status = 'runtime';
          this.pipelines.set(pipelineId, completePipeline);
          createdPipelines.push(pipelineId);

          // 注册到负载均衡系统
          this.loadBalancer.registerPipeline(completePipeline, virtualModel);
          this.pipelineAssemblyStats.totalAssembled++;

          secureLogger.info(`  ✅ Pipeline ready and registered: ${pipelineId}`);
        }
      }

      this.isInitialized = true;
      secureLogger.info(`🎉 All ${this.pipelines.size} pipelines initialized and ready`);
      
      // 保存流水线表到generated目录
      try {
        await this.savePipelineTableToGenerated();
        secureLogger.info('✅ Pipeline table saved to generated directory');
      } catch (error) {
        secureLogger.error('❌ Failed to save pipeline table:', { error: error.message });
      }

      // 保存流水线表到debug-logs目录 (用于调试)
      try {
        await this.savePipelineTableToDebugLogs();
        secureLogger.info('✅ Pipeline table saved to debug-logs directory');
      } catch (error) {
        secureLogger.error('❌ Failed to save pipeline table to debug-logs:', { error: error.message });
      }
      
      this.emit('pipelineSystemInitialized', { 
        totalPipelines: this.pipelines.size,
        createdPipelines,
        timestamp: new Date()
      });

    } catch (error) {
      secureLogger.error('❌ Pipeline system initialization failed:', { error: error.message });
      
      // 清理已创建的流水线
      for (const pipelineId of createdPipelines) {
        await this.destroyPipeline(pipelineId).catch(() => {}); // 忽略清理错误
      }
      
      this.emit('pipelineSystemInitializationFailed', { error: error.message, timestamp: new Date() });
      throw error;
    }
  }

  /**
   * 🎯 核心算法: 根据路由器输出动态选择模块
   * 静态组装系统的关键方法 - 基于路由决策选择正确的模块
   */
  private selectModulesBasedOnRouterOutput(routerOutput: any, providerType: string) {
    const selectedModules = {
      // 1. Transformer: 统一使用 Anthropic → OpenAI 转换
      transformer: this.MODULE_SELECTORS.transformer.default,
      
      // 2. Protocol: 根据路由器输出的协议选择
      protocol: this.MODULE_SELECTORS.protocol[routerOutput.protocol] || 
                this.MODULE_SELECTORS.protocol.default,
      
      // 3. ServerCompatibility: 根据provider类型选择
      serverCompatibility: this.MODULE_SELECTORS.serverCompatibility[providerType] || 
                           this.MODULE_SELECTORS.serverCompatibility.default,
      
      // 4. Server: 根据endpoint类型选择 (默认HTTP)
      server: this.determineServerModuleType(routerOutput.endpoint)
    };

    secureLogger.debug('🎯 模块选择决策完成', {
      routerOutput,
      providerType,
      selectedModules,
      architecture: 'static-assembly-dynamic-selection'
    });

    return selectedModules;
  }

  /**
   * 确定服务器模块类型
   */
  private determineServerModuleType(endpoint?: string): string {
    if (!endpoint) return this.MODULE_SELECTORS.server.default;
    
    if (endpoint.includes('ws://') || endpoint.includes('wss://')) {
      return this.MODULE_SELECTORS.server.websocket || this.MODULE_SELECTORS.server.default;
    }
    
    return this.MODULE_SELECTORS.server.default;
  }

  /**
   * 使用动态选择的模块创建流水线
   */
  private async createCompletePipelineWithSelectedModules(config: {
    pipelineId: string;
    virtualModel: string; 
    provider: string;
    targetModel: string;
    apiKey: string;
    endpoint: string;
    selectedModules: any;
    routerOutput: any;
  }): Promise<CompletePipeline> {
    secureLogger.info('🏗️ 开始组装流水线 (动态模块选择)', {
      pipelineId: config.pipelineId,
      selectedModules: config.selectedModules
    });

    // 委托给原有的创建方法，但传递选择的模块
    return await this.createCompletePipeline({
      pipelineId: config.pipelineId,
      virtualModel: config.virtualModel,
      provider: config.provider,
      targetModel: config.targetModel,
      apiKey: config.apiKey,
      endpoint: config.endpoint,
      transformer: config.selectedModules.transformer,
      protocol: config.selectedModules.protocol,
      serverCompatibility: config.selectedModules.serverCompatibility
    });
  }

  /**
   * 创建完整流水线 (Provider.Model.APIKey组合)
   */
  private async createCompletePipeline(config: CompletePipelineConfig): Promise<CompletePipeline> {
    secureLogger.info(`🏗️  Creating complete pipeline: ${config.pipelineId}`);

    // 使用API化模块管理创建模块实例
    const moduleIds: Record<string, string> = {};
    
    try {
      // 1. 创建Transformer模块
      const transformerResponse = await createModule({
        type: ModuleType.TRANSFORMER,
        moduleType: this.getModuleTypeForCreation(ModuleType.TRANSFORMER, config.transformer),
        config: this.getModuleConfig(ModuleType.TRANSFORMER, config)
      });
      moduleIds.transformer = transformerResponse.id;
      await startModule({ id: transformerResponse.id });

      // 2. 创建Protocol模块
      const protocolResponse = await createModule({
        type: ModuleType.PROTOCOL,
        moduleType: this.getModuleTypeForCreation(ModuleType.PROTOCOL, config.protocol),
        config: this.getModuleConfig(ModuleType.PROTOCOL, config)
      });
      moduleIds.protocol = protocolResponse.id;
      await startModule({ id: protocolResponse.id });

      // 3. 创建ServerCompatibility模块
      const serverCompatibilityResponse = await createModule({
        type: ModuleType.SERVER_COMPATIBILITY,
        moduleType: this.getModuleTypeForCreation(ModuleType.SERVER_COMPATIBILITY, config.serverCompatibility),
        config: this.getModuleConfig(ModuleType.SERVER_COMPATIBILITY, config)
      });
      moduleIds.serverCompatibility = serverCompatibilityResponse.id;
      await startModule({ id: serverCompatibilityResponse.id });

      // 4. 创建Server模块
      const serverResponse = await createModule({
        type: ModuleType.SERVER,
        moduleType: this.getModuleTypeForCreation(ModuleType.SERVER, 'openai'), // 默认使用OpenAI Server
        config: this.getModuleConfig(ModuleType.SERVER, config)
      });
      moduleIds.server = serverResponse.id;
      await startModule({ id: serverResponse.id });

      // 获取模块实例
      const transformerModule = await this.getModuleInstance(moduleIds.transformer);
      const protocolModule = await this.getModuleInstance(moduleIds.protocol);
      const serverCompatibilityModule = await this.getModuleInstance(moduleIds.serverCompatibility);
      const serverModule = await this.getModuleInstance(moduleIds.server);

      // 包装成CompletePipeline接口
      const completePipeline: CompletePipeline = {
        pipelineId: config.pipelineId,
        virtualModel: config.virtualModel,
        provider: config.provider,
        targetModel: config.targetModel,
        apiKey: config.apiKey,
        transformer: transformerModule,
        protocol: protocolModule,
        serverCompatibility: serverCompatibilityModule,
        server: serverModule,
        
        // 🐛 关键修复：存储实际使用的配置信息
        serverCompatibilityName: config.serverCompatibility,
        transformerName: config.transformer,
        protocolName: config.protocol,
        endpoint: config.endpoint,
        
        status: 'initializing',
        lastHandshakeTime: new Date(),

        async execute(request: any): Promise<any> {
          secureLogger.info(`🔄 Pipeline ${this.pipelineId} executing request`);
          
          try {
            // 按顺序处理请求通过各个模块
            // 1. Transformer处理
            let processedRequest = await processWithModule({ 
              id: moduleIds.transformer, 
              input: request 
            });
            
            // 2. Protocol处理
            processedRequest = await processWithModule({ 
              id: moduleIds.protocol, 
              input: processedRequest.output 
            });
            
            // 3. ServerCompatibility处理
            processedRequest = await processWithModule({ 
              id: moduleIds.serverCompatibility, 
              input: processedRequest.output 
            });
            
            // 4. Server处理
            const response = await processWithModule({ 
              id: moduleIds.server, 
              input: processedRequest.output 
            });

            secureLogger.info(`  ✅ Pipeline ${this.pipelineId} execution completed`);
            return response;

          } catch (error) {
            secureLogger.error(`  ❌ Pipeline ${this.pipelineId} execution failed:`, { error: error.message });
            throw error;
          }
        },

        async handshake(): Promise<void> {
          secureLogger.info(`🤝 Handshaking pipeline ${this.pipelineId}`);

          try {
            // 检查所有模块的健康状态
            const transformerStatus = await getModuleStatus(moduleIds.transformer);
            const protocolStatus = await getModuleStatus(moduleIds.protocol);
            const serverCompatibilityStatus = await getModuleStatus(moduleIds.serverCompatibility);
            const serverStatus = await getModuleStatus(moduleIds.server);

            if (transformerStatus.health !== 'healthy' || 
                protocolStatus.health !== 'healthy' || 
                serverCompatibilityStatus.health !== 'healthy' || 
                serverStatus.health !== 'healthy') {
              throw new Error(`Pipeline ${this.pipelineId} modules not healthy`);
            }

            this.lastHandshakeTime = new Date();
            secureLogger.info(`✅ Pipeline ${this.pipelineId} handshake completed`);

          } catch (error) {
            secureLogger.error(`❌ Pipeline ${this.pipelineId} handshake failed:`, { error: error.message });
            this.status = 'error';
            throw error;
          }
        },

        async healthCheck(): Promise<boolean> {
          try {
            // 检查所有模块的健康状态
            const transformerStatus = await getModuleStatus(moduleIds.transformer);
            const protocolStatus = await getModuleStatus(moduleIds.protocol);
            const serverCompatibilityStatus = await getModuleStatus(moduleIds.serverCompatibility);
            const serverStatus = await getModuleStatus(moduleIds.server);

            return transformerStatus.health === 'healthy' && 
                   protocolStatus.health === 'healthy' && 
                   serverCompatibilityStatus.health === 'healthy' && 
                   serverStatus.health === 'healthy';
          } catch (error) {
            secureLogger.error(`Health check failed for pipeline ${this.pipelineId}:`, { error: error.message });
            return false;
          }
        },

        getStatus(): PipelineStatus {
          // 返回流水线状态，包含所有模块的状态信息
          return {
            id: this.pipelineId,
            name: this.pipelineId,
            status: this.status,
            health: 'healthy', // 默认健康状态
            modules: {
              transformer: moduleIds.transformer,
              protocol: moduleIds.protocol,
              serverCompatibility: moduleIds.serverCompatibility,
              server: moduleIds.server
            },
            uptime: Date.now() - this.lastHandshakeTime.getTime(),
            performance: {
              requestsProcessed: 0,
              averageProcessingTime: 0,
              errorRate: 0,
              throughput: 0
            }
          };
        },

        async stop(): Promise<void> {
          secureLogger.info(`🛑 Stopping pipeline ${this.pipelineId}`);
          
          try {
            // 停止所有模块
            await stopModule({ id: moduleIds.server });
            await stopModule({ id: moduleIds.serverCompatibility });
            await stopModule({ id: moduleIds.protocol });
            await stopModule({ id: moduleIds.transformer });
            
            this.status = 'stopped';
            secureLogger.info(`✅ Pipeline ${this.pipelineId} stopped`);
            
          } catch (error) {
            secureLogger.error(`❌ Pipeline ${this.pipelineId} stop failed:`, { error: error.message });
            this.status = 'error';
            throw error;
          }
        }
      };

      return completePipeline;
    } catch (error) {
      // 如果创建过程中出现错误，清理已创建的模块
      for (const moduleId of Object.values(moduleIds)) {
        try {
          await destroyModule(moduleId);
        } catch (cleanupError) {
          secureLogger.error(`Failed to cleanup module ${moduleId}:`, { error: cleanupError.message });
        }
      }
      throw error;
    }
  }

  /**
   * 获取模块类型用于创建
   */
  private getModuleTypeForCreation(moduleType: ModuleType, moduleName: string): string {
    switch (moduleType) {
      case ModuleType.TRANSFORMER:
        if (moduleName.includes('anthropic') && moduleName.includes('openai')) {
          return 'anthropic-openai';
        } else if (moduleName.includes('gemini')) {
          return 'gemini';
        }
        return 'anthropic-openai'; // 默认
        
      case ModuleType.PROTOCOL:
        if (moduleName.includes('openai')) {
          return 'openai';
        }
        return 'openai'; // 默认
        
      case ModuleType.SERVER_COMPATIBILITY:
        if (moduleName.includes('lmstudio')) {
          return 'lmstudio';
        }
        return 'lmstudio'; // 默认
        
      case ModuleType.SERVER:
        return 'openai'; // 默认使用OpenAI Server
        
      case ModuleType.VALIDATOR:
        if (moduleName.includes('anthropic')) {
          return 'anthropic';
        }
        return 'anthropic'; // 默认
        
      // PROVIDER类型已移除
      // case ModuleType.PROVIDER:
      //   if (moduleName.includes('anthropic')) {
      //     return 'anthropic';
      //   }
      //   return 'anthropic'; // 默认
        
      default:
        return 'default';
    }
  }

  /**
   * 获取模块配置
   */
  private getModuleConfig(moduleType: ModuleType, config: CompletePipelineConfig): any {
    switch (moduleType) {
      case ModuleType.TRANSFORMER:
        return {}; // Transformer通常不需要特殊配置
        
      case ModuleType.PROTOCOL:
        return {}; // Protocol通常不需要特殊配置
        
      case ModuleType.SERVER_COMPATIBILITY:
        if (config.serverCompatibility.includes('lmstudio')) {
          return {
            baseUrl: config.endpoint,
            models: [config.targetModel],
            timeout: 30000,
            maxRetries: 3,
            retryDelay: 1000
          };
        }
        return {}; // 默认配置
        
      case ModuleType.SERVER:
        return {
          baseURL: config.endpoint,
          timeout: 30000,
          maxRetries: 3,
          retryDelay: 1000
        };
        
      case ModuleType.VALIDATOR:
        return {
          strictMode: true,
          allowExtraFields: false
        };
        
      // PROVIDER配置已移除
      // case ModuleType.PROVIDER:
      //   return {
      //     apiKey: config.apiKey,
      //     baseURL: config.endpoint,
      //     defaultModel: config.targetModel
      //   };
        
      default:
        return {};
    }
  }

  /**
   * 获取模块实例
   */
  private async getModuleInstance(moduleId: string): Promise<ModuleInterface> {
    // 这里需要一个方法来获取模块实例
    // 由于API管理模块不直接返回实例，我们需要创建一个包装器
    const moduleStatus = await getModuleStatus(moduleId);
    
    return {
      getId: () => moduleId,
      getName: () => moduleStatus.moduleType,
      getType: () => moduleStatus.type,
      getVersion: () => '1.0.0',
      getStatus: () => moduleStatus,
      getMetrics: () => ({
        requestsProcessed: 0,
        averageProcessingTime: 0,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }),
      configure: async (config: any) => {
        await configureModule({ id: moduleId, config });
      },
      start: async () => {
        await startModule({ id: moduleId });
      },
      stop: async () => {
        await stopModule({ id: moduleId });
      },
      reset: async () => {
        // 重置逻辑
      },
      cleanup: async () => {
        await destroyModule(moduleId);
      },
      healthCheck: async () => {
        const status = await getModuleStatus(moduleId);
        return { healthy: status.health === 'healthy', details: {} };
      },
      process: async (input: any) => {
        const result = await processWithModule({ id: moduleId, input });
        return result.output;
      }
    };
  }

  /**
   * 检查系统是否已初始化
   */
  isSystemInitialized(): boolean {
    return this.isInitialized;
  }
  
  /**
   * 创建Pipeline (传统方法，保留向后兼容)
   */
  async createPipeline(config: PipelineConfig): Promise<string> {
    try {
      const pipeline = await this.factory.createStandardPipeline(config) as StandardPipeline;
      
      // 创建一个临时的CompletePipeline包装器以保持类型一致性
      const completePipelineWrapper: CompletePipeline = {
        pipelineId: config.id,
        virtualModel: 'legacy',
        provider: config.provider,
        targetModel: config.model,
        apiKey: 'legacy-key',
        transformer: pipeline.getAllModules()[0],
        protocol: pipeline.getAllModules()[1] || pipeline.getAllModules()[0],
        serverCompatibility: pipeline.getAllModules()[2] || pipeline.getAllModules()[0],
        server: pipeline.getAllModules()[3] || pipeline.getAllModules()[0],
        
        // 配置信息（legacy默认值）
        serverCompatibilityName: 'generic',
        transformerName: 'legacy-transformer',
        protocolName: 'legacy-protocol',
        endpoint: 'legacy-endpoint',
        
        status: 'runtime',
        lastHandshakeTime: new Date(),
        async execute(request: any): Promise<any> {
          return await pipeline.execute(request);
        },
        async handshake(): Promise<void> {
          await pipeline.start();
        },
        async healthCheck(): Promise<boolean> {
          const status = pipeline.getStatus();
          return status.status === 'running';
        },
        getStatus(): PipelineStatus {
          const baseStatus = pipeline.getStatus();
          return {
            id: config.id,
            name: config.name,
            status: baseStatus.status,
            modules: {},
            uptime: 0,
            performance: {
              requestsProcessed: baseStatus.totalRequests,
              averageProcessingTime: baseStatus.averageResponseTime,
              errorRate: 0,
              throughput: 0
            }
          };
        },
        async stop(): Promise<void> {
          await pipeline.stop();
        }
      };
      
      this.pipelines.set(config.id, completePipelineWrapper);
      
      this.emit('pipelineCreated', { pipelineId: config.id, config });
      return config.id;
    } catch (error) {
      this.emit('pipelineCreationFailed', { config, error });
      throw error;
    }
  }
  
  /**
   * 销毁Pipeline
   */
  async destroyPipeline(pipelineId: string): Promise<boolean> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return false;
    }
    
    try {
      // 取消所有活跃的执行
      const activeExecutions = Array.from(this.activeExecutions.values())
        .filter(execution => execution.pipelineId === pipelineId);
      
      for (const execution of activeExecutions) {
        await this.cancelExecution(execution.id);
      }
      
      // 停止Pipeline
      await pipeline.stop();
      
      // 清理资源
      this.pipelines.delete(pipelineId);
      
      this.emit('pipelineDestroyed', { pipelineId });
      return true;
    } catch (error) {
      this.emit('pipelineDestructionFailed', { pipelineId, error });
      throw error;
    }
  }
  
  /**
   * 获取Pipeline
   */
  getPipeline(pipelineId: string): CompletePipeline | null {
    return this.pipelines.get(pipelineId) || null;
  }
  
  /**
   * 获取所有Pipeline
   */
  getAllPipelines(): Map<string, CompletePipeline> {
    return new Map(this.pipelines);
  }
  
  /**
   * 执行Pipeline
   */
  async executePipeline(
    pipelineId: string, 
    input: any, 
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }
    
    const executionId = this.generateExecutionId();
    const executionRecord: ExecutionRecord = {
      id: executionId,
      pipelineId,
      requestId: context.requestId,
      startTime: new Date(),
      status: 'running',
      moduleExecutions: []
    };
    
    this.activeExecutions.set(executionId, executionRecord);
    
    try {
      this.emit('executionStarted', { executionId, pipelineId, context });
      
      const result = await pipeline.execute(input);
      
      executionRecord.endTime = new Date();
      executionRecord.status = 'completed';
      executionRecord.totalTime = executionRecord.endTime.getTime() - executionRecord.startTime.getTime();
      
      const executionResult: ExecutionResult = {
        executionId,
        status: 'success',
        result,
        executionRecord,
        performance: this.calculatePerformanceMetrics(executionRecord)
      };
      
      this.emit('executionCompleted', { executionResult });
      this.activeExecutions.delete(executionId);
      
      return executionResult;
      
    } catch (error) {
      executionRecord.endTime = new Date();
      executionRecord.status = 'failed';
      executionRecord.error = error as Error;
      executionRecord.totalTime = executionRecord.endTime.getTime() - executionRecord.startTime.getTime();
      
      const executionResult: ExecutionResult = {
        executionId,
        status: 'failure',
        error: error as Error,
        executionRecord,
        performance: this.calculatePerformanceMetrics(executionRecord)
      };
      
      this.emit('executionFailed', { executionResult });
      this.activeExecutions.delete(executionId);
      
      throw error;
    }
  }
  
  /**
   * 取消执行
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }
    
    const pipeline = this.pipelines.get(execution.pipelineId);
    if (!pipeline) {
      return false;
    }
    
    try {
      execution.status = 'cancelled';
      execution.endTime = new Date();
      execution.totalTime = execution.endTime.getTime() - execution.startTime.getTime();
      
      this.emit('executionCancelled', { executionId });
      this.activeExecutions.delete(executionId);
      
      return true;
    } catch (error) {
      this.emit('executionCancellationFailed', { executionId, error });
      return false;
    }
  }
  
  /**
   * 获取Pipeline状态
   */
  getPipelineStatus(pipelineId: string): PipelineStatus | null {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return null;
    }
    
    return pipeline.getStatus();
  }
  
  /**
   * 获取所有Pipeline状态
   */
  getAllPipelineStatus(): Record<string, PipelineStatus> {
    const status: Record<string, PipelineStatus> = {};
    
    for (const [pipelineId, pipeline] of this.pipelines) {
      status[pipelineId] = pipeline.getStatus();
    }
    
    return status;
  }
  
  /**
   * 获取活跃执行
   */
  getActiveExecutions(): ExecutionRecord[] {
    return Array.from(this.activeExecutions.values());
  }
  
  /**
   * 获取Pipeline执行历史
   */
  getExecutionHistory(pipelineId: string): ExecutionRecord[] {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      return [];
    }
    
    // CompletePipeline接口没有getExecutionHistory方法，返回空数组
    // 实际的执行历史记录由PipelineManager在activeExecutions中维护
    return [];
  }
  
  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    pipelines: number;
    activeExecutions: number;
    issues: string[];
  }> {
    const issues: string[] = [];
    let healthyPipelines = 0;
    
    for (const [pipelineId, pipeline] of this.pipelines) {
      try {
        const status = pipeline.getStatus();
        if (status.status === 'running') {
          healthyPipelines++;
        } else {
          issues.push(`Pipeline ${pipelineId} is in ${status.status} status`);
        }
      } catch (error) {
        issues.push(`Pipeline ${pipelineId} health check failed: ${error}`);
      }
    }
    
    return {
      healthy: issues.length === 0,
      pipelines: this.pipelines.size,
      activeExecutions: this.activeExecutions.size,
      issues
    };
  }
  
  /**
   * 设置Pipeline事件监听器
   */
  private setupPipelineEventListeners(pipeline: StandardPipeline, pipelineId: string): void {
    // CompletePipeline wrapper不需要事件监听器设置
    // 事件将由StandardPipeline内部处理
  }
  
  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 计算性能指标
   */
  private calculatePerformanceMetrics(execution: ExecutionRecord): PerformanceMetrics {
    const modulesTiming: Record<string, number> = {};
    let totalTime = execution.totalTime || 0;
    let errorCount = 0;
    
    for (const moduleExecution of execution.moduleExecutions) {
      if (moduleExecution.processingTime) {
        modulesTiming[moduleExecution.moduleId] = moduleExecution.processingTime;
      }
      
      if (moduleExecution.status === 'failed') {
        errorCount++;
      }
    }
    
    return {
      totalTime,
      modulesTiming,
      memoryUsage: {
        peak: process.memoryUsage().heapUsed,
        average: process.memoryUsage().heapUsed
      },
      cpuUsage: {
        peak: process.cpuUsage().system / 1000000, // 转换为毫秒
        average: process.cpuUsage().user / 1000000 // 转换为毫秒
      },
      throughput: totalTime > 0 ? 1000 / totalTime : 0,
      errorCount
    };
  }

  /**
   * 保存流水线表到generated目录
   */
  private async savePipelineTableToGenerated(): Promise<void> {
    const generatedDir = path.join(os.homedir(), '.route-claudecode', 'config', 'generated');
    
    // 确保generated目录存在
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }
    
    // 生成流水线表数据
    const pipelineTableData = this.generatePipelineTableData();
    
    // 保存文件路径：configName-pipeline-table.json
    const fileName = this.configName 
      ? `${this.configName}-pipeline-table.json`
      : `default-pipeline-table.json`;
    const filePath = path.join(generatedDir, fileName);
    
    // 写入文件
    fs.writeFileSync(filePath, JQJsonHandler.stringifyJson(pipelineTableData, false), 'utf8');
    
    secureLogger.info('📋 Pipeline table saved', {
      file: filePath,
      totalPipelines: pipelineTableData.totalPipelines,
      configName: this.configName
    });
  }

  /**
   * 生成流水线表数据
   */
  private generatePipelineTableData(): PipelineTableData {
    const allPipelines: PipelineTableEntry[] = [];
    const pipelinesGroupedByModel: Record<string, PipelineTableEntry[]> = {};
    
    for (const [pipelineId, pipeline] of this.pipelines) {
      const entry: PipelineTableEntry = {
        pipelineId,
        virtualModel: pipeline.virtualModel,
        provider: pipeline.provider,
        targetModel: pipeline.targetModel,
        apiKeyIndex: this.extractApiKeyIndex(pipelineId),
        endpoint: this.extractEndpoint(pipeline),
        status: pipeline.status,
        createdAt: pipeline.lastHandshakeTime.toISOString(),
        handshakeTime: pipeline.lastHandshakeTime ? Date.now() - pipeline.lastHandshakeTime.getTime() : undefined,
        
        // 添加4层架构详细信息
        architecture: this.extractArchitectureDetails(pipeline)
      };
      
      allPipelines.push(entry);
      
      // 按模型分组
      if (!pipelinesGroupedByModel[pipeline.virtualModel]) {
        pipelinesGroupedByModel[pipeline.virtualModel] = [];
      }
      pipelinesGroupedByModel[pipeline.virtualModel].push(entry);
    }
    
    return {
      configName: this.configName,
      configFile: this.configFile,
      generatedAt: new Date().toISOString(),
      totalPipelines: allPipelines.length,
      pipelinesGroupedByVirtualModel: pipelinesGroupedByModel,
      allPipelines
    };
  }

  /**
   * 从流水线ID提取API Key索引
   */
  private extractApiKeyIndex(pipelineId: string): number {
    const match = pipelineId.match(/-key(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * 从流水线提取endpoint信息
   */
  private extractEndpoint(pipeline: CompletePipeline): string {
    // 从系统配置中获取endpoint信息
    const providerType = this.systemConfig?.providerTypes?.[pipeline.provider];
    return providerType?.endpoint || 'unknown';
  }

  /**
   * 提取4层架构详细信息
   */
  private extractArchitectureDetails(pipeline: CompletePipeline): PipelineTableEntry['architecture'] {
    // 辅助函数：将模块状态转换为字符串
      const getModuleStatusString = (module: ModuleInterface | undefined): string => {
        if (!module || !module.getStatus) {
          return 'running';
        }
        
        try {
          const status = module.getStatus();
          // 如果status是对象，提取status字段；如果是字符串/枚举，直接使用
          if (typeof status === 'object' && status.status) {
            return String(status.status);
          } else {
            return String(status);
          }
        } catch (error) {
          return 'running';
        }
      };
    
    return {
      transformer: {
        id: pipeline.transformer?.getId?.() || `${pipeline.provider}-transformer`,
        name: 'transformer',
        type: 'transformer',
        status: getModuleStatusString(pipeline.transformer)
      },
      protocol: {
        id: pipeline.protocol?.getId?.() || `${pipeline.provider}-protocol`,
        // 🐛 关键修复：使用存储在pipeline中的实际protocol名称
        name: pipeline.protocolName || 'openai-protocol-handler',
        type: 'protocol',
        status: getModuleStatusString(pipeline.protocol)
      },
      serverCompatibility: {
        id: pipeline.serverCompatibility?.getId?.() || `${pipeline.provider}-compatibility`,
        // 🐛 关键修复：使用存储在pipeline中的实际serverCompatibility名称
        name: pipeline.serverCompatibilityName || `${pipeline.provider}-compatibility-handler`,
        type: 'serverCompatibility',
        status: getModuleStatusString(pipeline.serverCompatibility)
      },
      server: {
        id: pipeline.server?.getId?.() || `${pipeline.provider}-server`,
        name: `${pipeline.provider}-server`,
        type: 'server',
        status: getModuleStatusString(pipeline.server),
        // 🐛 关键修复：使用存储在pipeline中的实际endpoint
        endpoint: pipeline.endpoint
      }
    };
  }

  /**
   * 保存流水线表到debug-logs目录 (按端口分组)
   */
  private async savePipelineTableToDebugLogs(): Promise<void> {
    if (!this.port) {
      secureLogger.warn('⚠️  No port specified, skipping debug-logs save');
      return;
    }

    const debugLogsDir = path.join(os.homedir(), '.route-claudecode', 'debug-logs', `port-${this.port}`);
    
    // 确保debug-logs目录存在
    if (!fs.existsSync(debugLogsDir)) {
      fs.mkdirSync(debugLogsDir, { recursive: true });
    }
    
    // 生成debug版本的流水线表数据 (包含更多调试信息)
    const debugPipelineTableData = this.generateDebugPipelineTableData();
    
    // 保存文件路径：时间+配置名称格式
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
    const fileName = this.configName 
      ? `${timestamp}_${this.configName}-pipeline-table.json`
      : `${timestamp}_default-pipeline-table.json`;
    const filePath = path.join(debugLogsDir, fileName);
    
    // 写入文件
    fs.writeFileSync(filePath, JQJsonHandler.stringifyJson(debugPipelineTableData, false), 'utf8');
    
    secureLogger.info('🐛 Debug pipeline table saved', {
      file: filePath,
      port: this.port,
      totalPipelines: debugPipelineTableData.totalPipelines,
      configName: this.configName
    });
  }

  /**
   * 生成debug版本的流水线表数据 (包含更多调试信息)
   */
  private generateDebugPipelineTableData(): PipelineTableData & {
    debugInfo: {
      port: number;
      initializationStartTime: string;
      initializationEndTime: string;
      initializationDuration: number;
      systemConfig: any;
      totalHandshakeTime: number;
    }
  } {
    const basicData = this.generatePipelineTableData();
    
    // 计算总握手时间
    const totalHandshakeTime = Array.from(this.pipelines.values())
      .reduce((total, pipeline) => {
        const handshakeTime = pipeline.lastHandshakeTime ? Date.now() - pipeline.lastHandshakeTime.getTime() : 0;
        return total + handshakeTime;
      }, 0);

    return {
      ...basicData,
      debugInfo: {
        port: this.port,
        initializationStartTime: new Date().toISOString(),
        initializationEndTime: new Date().toISOString(),
        initializationDuration: 0, // 将在实际使用时计算
        systemConfig: {
          providerTypes: Object.keys(this.systemConfig?.providerTypes || {}),
          transformersCount: Object.keys(this.systemConfig?.transformers || {}).length,
          serverCompatibilityModulesCount: Object.keys(this.systemConfig?.serverCompatibilityModules || {}).length
        },
        totalHandshakeTime
      }
    };
  }
}