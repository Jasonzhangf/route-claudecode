/**
 * LM Studio Complete Pipeline
 *
 * 按照RCC v4.0四层架构设计的完整LM Studio流水线
 * Transformer → Protocol → Server-Compatibility → Server
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import {
  PipelineFramework,
  PipelineSpec,
  ExecutionRecord,
  ModuleInterface,
} from '../../interfaces/pipeline/pipeline-framework';

// 导入四层模块
import { SecureAnthropicToOpenAITransformer } from '../transformers/secure-anthropic-openai-transformer';
import { OpenAIProtocolModule } from './protocol/openai-protocol';
import { LMStudioCompatibilityModule } from './server-compatibility/lmstudio-compatibility';
import { OpenAIServerModule } from './server/openai-server';
import { getSafeMaxTokens, validateMaxTokens } from '../../constants/api-defaults';

/**
 * LM Studio流水线配置
 */
export interface LMStudioPipelineConfig {
  id: string;
  name: string;
  lmstudioEndpoint: string;
  lmstudioApiKey?: string;
  timeout: number;
  maxRetries: number;
  supportedModels: string[];
  targetModel?: string; // 目标模型名
  maxTokens?: number; // 用户配置的maxTokens限制
}

/**
 * 流水线执行结果
 */
export interface PipelineExecutionResult {
  success: boolean;
  result?: any;
  error?: Error;
  executionTime: number;
  moduleResults: Record<string, any>;
}

/**
 * LM Studio完整流水线实现
 */
export class LMStudioPipeline extends EventEmitter {
  readonly id: string;
  private readonly name: string;
  private readonly config: LMStudioPipelineConfig;

  // 四层模块
  private transformerModule: SecureAnthropicToOpenAITransformer;
  private protocolModule: OpenAIProtocolModule;
  private compatibilityModule: LMStudioCompatibilityModule;
  private serverModule: OpenAIServerModule;
  private targetModel: string = ''; // 目标模型名

  private modules: ModuleInterface[] = [];
  private isInitialized = false;
  private executionHistory: ExecutionRecord[] = [];

  constructor(config: LMStudioPipelineConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.config = config;

    console.log(`🔧 构建LM Studio流水线: ${config.name}`);
    this.initializeModules();
  }

  /**
   * 初始化四层模块
   */
  private initializeModules(): void {
    // 设置目标模型
    this.targetModel = this.config.targetModel || '';

    // 1. Transformer模块 - 传递用户的maxTokens配置
    const userMaxTokens = this.config.maxTokens;
    const safeMaxTokens = getSafeMaxTokens(userMaxTokens, 'lmstudio');
    
    this.transformerModule = new SecureAnthropicToOpenAITransformer({
      // 关键：将用户的maxTokens配置作为apiMaxTokens传递
      apiMaxTokens: safeMaxTokens,
      defaultMaxTokens: safeMaxTokens,
      strictValidation: true,
      logSecurityEvents: true,
    });

    // 2. Protocol模块
    this.protocolModule = new OpenAIProtocolModule();

    // 3. Server-Compatibility模块（LM Studio）
    this.compatibilityModule = new LMStudioCompatibilityModule({
      baseUrl: this.config.lmstudioEndpoint,
      apiKey: this.config.lmstudioApiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: 1000,
      models: this.config.supportedModels,
    });

    // 4. Server模块（使用LM Studio端点的OpenAI SDK）
    this.serverModule = new OpenAIServerModule({
      baseURL: this.config.lmstudioEndpoint,
      apiKey: this.config.lmstudioApiKey || 'lm-studio',
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: 1000,
    });

    // 注册所有模块 - 使用类型断言来兼容接口差异
    this.modules = [
      this.transformerModule as any,
      this.protocolModule as any,
      this.compatibilityModule as any,
      this.serverModule as any,
    ];

    // 设置模块事件监听
    this.setupModuleEventListeners();
  }

  /**
   * 设置模块事件监听器
   */
  private setupModuleEventListeners(): void {
    for (const module of this.modules) {
      module.on('statusChanged', data => {
        this.emit('moduleStatusChanged', {
          moduleId: module.getId(),
          ...data,
        });
      });

      module.on('error', data => {
        this.emit('moduleError', {
          moduleId: module.getId(),
          ...data,
        });
      });
    }
  }

  // PipelineFramework接口实现

  get spec(): PipelineSpec {
    return {
      id: this.id,
      name: this.name,
      description: `LM Studio完整流水线 - 四层架构实现`,
      version: '1.0.0',
      provider: 'lmstudio',
      model: 'auto',
      modules: this.modules.map(module => ({ id: module.getId() })),
      configuration: {
        parallel: false,
        failFast: true,
        retryPolicy: {
          maxRetries: this.config.maxRetries,
          backoffMultiplier: 1.5,
        },
      },
      metadata: {
        author: 'RCC v4.0',
        created: Date.now(),
        tags: ['lmstudio', 'four-layer-architecture'],
      },
    };
  }

  /**
   * 启动流水线
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(`🚀 启动LM Studio流水线: ${this.name}`);

    try {
      // 按顺序启动所有模块
      for (const module of this.modules) {
        await module.start();
        console.log(`  ✅ ${module.getName()} 已启动`);
      }

      this.isInitialized = true;
      this.emit('pipelineStarted', { pipelineId: this.id });
      console.log(`✅ LM Studio流水线启动完成`);
    } catch (error) {
      console.error(`❌ LM Studio流水线启动失败:`, error);
      throw error;
    }
  }

  /**
   * 停止流水线
   */
  async stop(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    console.log(`⏹️ 停止LM Studio流水线: ${this.name}`);

    try {
      // 按相反顺序停止所有模块
      for (let i = this.modules.length - 1; i >= 0; i--) {
        await this.modules[i].stop();
        console.log(`  ⏹️ ${this.modules[i].getName()} 已停止`);
      }

      this.isInitialized = false;
      this.emit('pipelineStopped', { pipelineId: this.id });
      console.log(`✅ LM Studio流水线停止完成`);
    } catch (error) {
      console.error(`❌ LM Studio流水线停止失败:`, error);
      throw error;
    }
  }

  /**
   * 验证流水线
   */
  async validate(): Promise<boolean> {
    try {
      // 检查所有模块状态
      for (const module of this.modules) {
        const status = module.getStatus();
        if (status.health !== 'healthy') {
          console.warn(`模块 ${module.getName()} 状态不健康: ${status.health}`);
          return false;
        }
      }

      // 验证LM Studio连接
      const healthCheck = await this.compatibilityModule.healthCheck();
      if (!healthCheck.healthy) {
        console.warn(`LM Studio连接不健康: ${healthCheck.details}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('流水线验证失败:', error);
      return false;
    }
  }

  /**
   * 执行完整的四层流水线处理
   */
  async execute(input: any): Promise<PipelineExecutionResult> {
    if (!this.isInitialized) {
      throw new Error('流水线未初始化');
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const moduleResults: Record<string, any> = {};

    console.log(`🔄 执行LM Studio四层流水线: ${executionId}`);

    try {
      let currentInput = input;

      // 第1层: Transformer - Anthropic → OpenAI
      console.log(`  📝 第1层: Transformer (Anthropic → OpenAI)`);
      const transformerResult = await this.transformerModule.process(currentInput);
      moduleResults['transformer'] = transformerResult;
      currentInput = transformerResult;

      // 第2层: Protocol - 流式控制
      console.log(`  🌐 第2层: Protocol (流式控制)`);
      const protocolResult = await this.protocolModule.process(currentInput);
      moduleResults['protocol'] = protocolResult;
      currentInput = protocolResult;

      // 第3层: Server-Compatibility - LM Studio兼容
      console.log(`  🔧 第3层: Server-Compatibility (LM Studio兼容)`);
      const compatibilityResult = await this.compatibilityModule.process(currentInput);
      moduleResults['compatibility'] = compatibilityResult;
      currentInput = compatibilityResult;

      // 第4层: Server - 实际API调用
      console.log(`  🌐 第4层: Server (API调用)`);
      const serverResult = await this.serverModule.process(currentInput);
      moduleResults['server'] = serverResult;

      const executionTime = Date.now() - startTime;
      console.log(`✅ LM Studio流水线执行完成 (${executionTime}ms)`);

      const result: PipelineExecutionResult = {
        success: true,
        result: serverResult,
        executionTime,
        moduleResults,
      };

      this.emit('pipelineExecutionCompleted', {
        executionId,
        result,
        duration: executionTime,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`❌ LM Studio流水线执行失败 (${executionTime}ms):`, error);

      const result: PipelineExecutionResult = {
        success: false,
        error: error as Error,
        executionTime,
        moduleResults,
      };

      this.emit('pipelineExecutionFailed', {
        executionId,
        error,
        duration: executionTime,
      });

      throw error;
    }
  }

  /**
   * 处理Anthropic请求并返回Anthropic格式响应
   */
  async processAnthropicRequest(anthropicRequest: any): Promise<any> {
    const result = await this.execute(anthropicRequest);

    if (!result.success) {
      throw result.error;
    }

    // 将OpenAI响应转换回Anthropic格式
    console.log(`🔄 开始响应格式转换: OpenAI → Anthropic`);
    const anthropicResponse = await this.transformerModule.process(result.result);
    console.log(`✅ 响应格式转换完成`);
    return anthropicResponse;
  }

  /**
   * 获取流水线状态
   */
  getStatus(): any {
    const moduleStatuses = this.modules.map(module => ({
      id: module.getId(),
      name: module.getName(),
      status: module.getStatus(),
    }));

    return {
      id: this.id,
      name: this.name,
      initialized: this.isInitialized,
      modules: moduleStatuses,
      executionCount: this.executionHistory.length,
      lastExecution: this.executionHistory.length > 0 ? this.executionHistory[this.executionHistory.length - 1] : null,
    };
  }

  /**
   * 销毁流水线
   */
  async destroy(): Promise<void> {
    await this.stop();
    this.modules = [];
    this.executionHistory = [];
    this.removeAllListeners();
    console.log(`🗑️ LM Studio流水线已销毁: ${this.name}`);
  }

  // 其他必需的接口实现
  addModule(module: ModuleInterface): void {
    throw new Error('LM Studio流水线模块顺序是固定的');
    return;
  }
  removeModule(moduleId: string): void {
    throw new Error('LM Studio流水线模块顺序是固定的');
  }
  getModule(moduleId: string): ModuleInterface | null {
    return this.modules.find(m => m.getId() === moduleId) || null;
  }
  getAllModules(): ModuleInterface[] {
    return [...this.modules];
  }
  setModuleOrder(moduleIds: string[]): void {
    throw new Error('LM Studio流水线模块顺序是固定的');
  }
  executeModule(moduleId: string, input: any): Promise<any> {
    throw new Error('使用execute方法执行完整流水线');
  }
  getExecutionHistory(): ExecutionRecord[] {
    return [...this.executionHistory];
  }
  async reset(): Promise<void> {
    this.executionHistory = [];
    for (const module of this.modules) {
      if ('reset' in module && typeof module.reset === 'function') {
        await (module as any).reset();
      }
    }
  }
}
