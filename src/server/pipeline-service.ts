/**
 * Pipeline服务实现
 *
 * 实现了Pipeline业务逻辑，与HTTP服务器解耦
 * 使用接口抽象避免跨模块直接依赖
 */

import { EventEmitter } from 'events';
import {
  IPipelineService,
  IPipelineManager,
  IPipelineFactory,
  IModuleRegistry,
  IPipelineProtocolMatcher,
  ExecutionResult,
  ExecutionContext,
  PipelineStatus,
  ProtocolHandler,
} from '../interfaces/core/pipeline-abstraction';
import { PipelineConfig } from '../interfaces/pipeline/pipeline-framework';

/**
 * Pipeline服务配置
 */
export interface PipelineServiceConfig {
  pipelines: PipelineConfig[];
  debug?: boolean;
  enableHealthChecks?: boolean;
  healthCheckInterval?: number;
}

/**
 * Pipeline协议匹配器实现
 */
class PipelineProtocolMatcher implements IPipelineProtocolMatcher {
  private pipelineManager: IPipelineManager;
  private protocolHandlers: Map<string, ProtocolHandler> = new Map();

  constructor(pipelineManager: IPipelineManager) {
    this.pipelineManager = pipelineManager;
  }

  findPipelineByProtocol(protocol: string, model?: string) {
    const pipelines = this.pipelineManager.getAllPipelines();

    console.log(`🔍 查找协议 '${protocol}' 的管道，模型: ${model || 'N/A'}`);
    console.log(`📊 总管道数: ${pipelines.size}`);

    // 调试：显示所有管道信息
    pipelines.forEach((pipeline, id) => {
      console.log(`📋 管道 ${id}: provider=${pipeline.provider}, model=${pipeline.model}`);
    });

    // 获取协议处理器
    const handler = this.protocolHandlers.get(protocol);
    if (handler && !handler.canHandle(protocol, model)) {
      console.log(`❌ 协议处理器拒绝处理: ${protocol}`);
      return null;
    }

    // 查找匹配的Pipeline
    const candidatePipelines = Array.from(pipelines.values())
      .filter(pipeline => {
        const status = pipeline.getStatus();
        const isHealthy = status.status === 'running' && status.health.healthy;
        console.log(`🏥 管道 ${pipeline.getId()} 健康状态: ${status.status}, 健康: ${status.health.healthy}`);
        return isHealthy;
      })
      .sort((a, b) => {
        // 优先选择更匹配的Pipeline
        const aScore = this.calculateMatchScore(a, protocol, model);
        const bScore = this.calculateMatchScore(b, protocol, model);
        console.log(`📊 管道评分 - ${a.getId()}: ${aScore}, ${b.getId()}: ${bScore}`);
        return bScore - aScore;
      });

    console.log(`🎯 候选管道数: ${candidatePipelines.length}`);
    if (candidatePipelines.length > 0) {
      console.log(`✅ 选择管道: ${candidatePipelines[0].getId()}`);
    } else {
      console.log(`❌ 未找到匹配的管道`);
    }

    return candidatePipelines[0] || null;
  }

  registerProtocolHandler(protocol: string, handler: ProtocolHandler): void {
    this.protocolHandlers.set(protocol, handler);
  }

  getSupportedProtocols(): string[] {
    return Array.from(this.protocolHandlers.keys());
  }

  private calculateMatchScore(pipeline: any, protocol: string, model?: string): number {
    let score = 0;

    console.log(`🧮 计算评分 - 管道: ${pipeline.getId()}, 协议: ${protocol}, 模型: ${model || 'N/A'}`);
    console.log(`📋 管道Provider: ${pipeline.provider}`);

    // 基于provider匹配 - 支持OpenAI兼容协议
    if (pipeline.provider) {
      if (pipeline.provider.includes(protocol)) {
        score += 10;
        console.log(`✅ Provider直接匹配 +10: ${pipeline.provider} 包含 ${protocol}`);
      } else if (
        protocol === 'openai' &&
        (pipeline.provider.includes('lmstudio') ||
          pipeline.provider.includes('openai') ||
          pipeline.provider.includes('compatibility'))
      ) {
        // LM Studio和其他OpenAI兼容服务也匹配openai协议
        score += 8;
        console.log(`✅ OpenAI兼容匹配 +8: ${pipeline.provider} 兼容 ${protocol}`);
      } else if (protocol === 'anthropic' && pipeline.provider.includes('anthropic')) {
        score += 10;
        console.log(`✅ Anthropic匹配 +10: ${pipeline.provider} 包含 ${protocol}`);
      } else {
        console.log(`❌ Provider不匹配: ${pipeline.provider} 不兼容 ${protocol}`);
      }
    } else {
      console.log(`❌ Provider为空`);
    }

    // 基于模型匹配
    if (model && pipeline.model) {
      if (pipeline.model === model) {
        score += 20;
        console.log(`✅ 模型精确匹配 +20: ${pipeline.model} = ${model}`);
      } else if (pipeline.model.includes(model) || model.includes(pipeline.model)) {
        score += 10;
        console.log(`✅ 模型部分匹配 +10: ${pipeline.model} ~ ${model}`);
      } else {
        console.log(`❌ 模型不匹配: ${pipeline.model} ≠ ${model}`);
      }
    } else {
      console.log(`ℹ️ 模型匹配跳过: pipeline.model=${pipeline.model}, request.model=${model}`);
    }

    // 基于健康状态
    const status = pipeline.getStatus();
    if (status.health.healthy) {
      score += 5;
      console.log(`✅ 健康状态 +5`);
    } else {
      console.log(`❌ 不健康状态 +0`);
    }

    // 基于性能指标
    if (status.metrics && status.metrics.averageExecutionTime < 1000) {
      score += 3;
      console.log(`✅ 性能良好 +3`);
    } else {
      console.log(`❌ 性能一般 +0`);
    }

    console.log(`🎯 最终评分: ${score}`);
    return score;
  }
}

/**
 * Pipeline服务实现
 */
export class PipelineService extends EventEmitter implements IPipelineService {
  private pipelineManager: IPipelineManager;
  private pipelineFactory: IPipelineFactory;
  private moduleRegistry: IModuleRegistry;
  private protocolMatcher: IPipelineProtocolMatcher;
  private config: PipelineServiceConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private isStarted = false;

  constructor(
    pipelineManager: IPipelineManager,
    pipelineFactory: IPipelineFactory,
    moduleRegistry: IModuleRegistry,
    config: PipelineServiceConfig
  ) {
    super();

    this.pipelineManager = pipelineManager;
    this.pipelineFactory = pipelineFactory;
    this.moduleRegistry = moduleRegistry;
    this.config = config;
    this.protocolMatcher = new PipelineProtocolMatcher(pipelineManager);

    this.setupPipelineManagerEvents();
    this.registerDefaultProtocolHandlers();
  }

  /**
   * 启动Pipeline服务
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Pipeline service is already started');
    }

    try {
      await this.initializePipelines(this.config.pipelines);

      if (this.config.enableHealthChecks !== false) {
        this.startHealthChecks();
      }

      this.isStarted = true;
      this.emit('started', {
        pipelineCount: this.config.pipelines.length,
        timestamp: new Date(),
      });

      console.log(`🎯 Pipeline Service started with ${this.config.pipelines.length} pipelines`);
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 停止Pipeline服务
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = undefined;
      }

      await this.cleanupPipelines();

      this.isStarted = false;
      this.emit('stopped', { timestamp: new Date() });

      console.log('🛑 Pipeline Service stopped');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 初始化所有Pipeline
   */
  async initializePipelines(configs: PipelineConfig[]): Promise<void> {
    console.log(`🔧 Initializing ${configs.length} pipelines...`);

    const results = await Promise.allSettled(
      configs.map(async config => {
        try {
          const pipelineId = await this.pipelineManager.createPipeline(config);
          const pipeline = this.pipelineManager.getPipeline(pipelineId);

          if (pipeline) {
            await pipeline.start();
            console.log(`✅ Pipeline ${config.name} (${pipelineId}) initialized successfully`);
            return { success: true, pipelineId, config };
          } else {
            throw new Error(`Failed to retrieve created pipeline: ${pipelineId}`);
          }
        } catch (error) {
          console.error(`❌ Failed to initialize pipeline ${config.name}:`, error);
          return { success: false, config, error };
        }
      })
    );

    // 统计结果
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    if (failed > 0) {
      console.warn(`⚠️ ${failed} pipelines failed to initialize`);
    }

    if (successful === 0) {
      throw new Error('No pipelines were successfully initialized');
    }
  }

  /**
   * 清理所有Pipeline
   */
  async cleanupPipelines(): Promise<void> {
    const pipelines = this.pipelineManager.getAllPipelines();

    const cleanupPromises = Array.from(pipelines.entries()).map(async ([pipelineId, pipeline]) => {
      try {
        await pipeline.stop();
        await this.pipelineManager.destroyPipeline(pipelineId);
        console.log(`🧹 Pipeline ${pipelineId} cleaned up`);
      } catch (error) {
        console.error(`❌ Failed to cleanup pipeline ${pipelineId}:`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
  }

  /**
   * 处理请求
   */
  async handleRequest(protocol: string, input: any, context: ExecutionContext): Promise<ExecutionResult> {
    // 查找合适的Pipeline
    const pipeline = this.protocolMatcher.findPipelineByProtocol(protocol, input.model);
    if (!pipeline) {
      throw new Error(`No available ${protocol} pipeline found`);
    }

    // 获取协议处理器进行请求转换
    const handler = this.protocolMatcher.getSupportedProtocols().includes(protocol)
      ? this.getProtocolHandler(protocol)
      : null;

    let transformedInput = input;
    if (handler && handler.transformRequest) {
      transformedInput = handler.transformRequest(input);
    }

    // 执行Pipeline
    const result = await this.pipelineManager.executePipeline(pipeline.getId(), transformedInput, {
      ...context,
      metadata: {
        ...context.metadata,
        protocol,
        originalInput: input,
        pipelineProvider: pipeline.provider,
        pipelineModel: pipeline.model,
      },
    });

    // 转换响应
    if (handler && handler.transformResponse) {
      result.result = handler.transformResponse(result.result);
    }

    return result;
  }

  /**
   * 获取Pipeline管理器
   */
  getPipelineManager(): IPipelineManager {
    return this.pipelineManager;
  }

  /**
   * 获取协议匹配器
   */
  getProtocolMatcher(): IPipelineProtocolMatcher {
    return this.protocolMatcher;
  }

  /**
   * 获取服务状态
   */
  getStatus(): any {
    const pipelineStatuses = this.pipelineManager.getAllPipelineStatus();

    return {
      started: this.isStarted,
      pipelineCount: Object.keys(pipelineStatuses).length,
      healthyPipelines: Object.values(pipelineStatuses).filter(p => p.health.healthy).length,
      pipelines: pipelineStatuses,
      protocols: this.protocolMatcher.getSupportedProtocols(),
      uptime: this.isStarted ? Date.now() - this.getStartTime() : 0,
    };
  }

  /**
   * 检查服务健康状态
   */
  isHealthy(): boolean {
    if (!this.isStarted) {
      return false;
    }

    const statuses = Object.values(this.pipelineManager.getAllPipelineStatus());
    const healthyCount = statuses.filter(status => status.health.healthy).length;

    return healthyCount > 0; // 至少有一个健康的Pipeline
  }

  /**
   * 设置Pipeline管理器事件监听
   */
  private setupPipelineManagerEvents(): void {
    this.pipelineManager.on('executionStarted', data => {
      if (this.config.debug) {
        console.log(`🏃 Pipeline execution started: ${data.pipelineId} (${data.executionId})`);
      }
      this.emit('executionStarted', data);
    });

    this.pipelineManager.on('executionCompleted', data => {
      if (this.config.debug) {
        console.log(
          `✅ Pipeline execution completed: ${data.executionResult.executionId} in ${data.executionResult.performance.totalTime}ms`
        );
      }
      this.emit('executionCompleted', data);
    });

    this.pipelineManager.on('executionFailed', data => {
      console.error(`❌ Pipeline execution failed: ${data.executionResult.executionId}`, data.executionResult.error);
      this.emit('executionFailed', data);
    });
  }

  /**
   * 注册默认协议处理器
   */
  private registerDefaultProtocolHandlers(): void {
    // Anthropic协议处理器
    this.protocolMatcher.registerProtocolHandler('anthropic', {
      canHandle: (protocol, model) => protocol === 'anthropic',
      getPriority: () => 10,
      transformRequest: input => {
        // 确保Anthropic格式正确
        if (!input.messages) {
          throw new Error('Invalid Anthropic request: missing messages');
        }
        return input;
      },
      transformResponse: output => output,
    });

    // OpenAI协议处理器
    this.protocolMatcher.registerProtocolHandler('openai', {
      canHandle: (protocol, model) => protocol === 'openai',
      getPriority: () => 10,
      transformRequest: input => {
        // 确保OpenAI格式正确
        if (!input.messages) {
          throw new Error('Invalid OpenAI request: missing messages');
        }
        return input;
      },
      transformResponse: output => output,
    });

    // Gemini协议处理器
    this.protocolMatcher.registerProtocolHandler('gemini', {
      canHandle: (protocol, model) => protocol === 'gemini',
      getPriority: () => 10,
      transformRequest: input => {
        // 确保Gemini格式正确
        if (!input.contents && !input.messages) {
          throw new Error('Invalid Gemini request: missing contents or messages');
        }
        return input;
      },
      transformResponse: output => output,
    });
  }

  /**
   * 获取协议处理器
   */
  private getProtocolHandler(protocol: string): ProtocolHandler | null {
    // 这里应该从protocolMatcher获取，但需要扩展接口
    // 暂时返回null，实际实现需要重构protocolMatcher
    return null;
  }

  /**
   * 启动健康检查
   */
  private startHealthChecks(): void {
    const interval = this.config.healthCheckInterval || 30000; // 30秒

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, interval);
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    const pipelines = this.pipelineManager.getAllPipelines();

    pipelines.forEach(async (pipeline, pipelineId) => {
      try {
        const status = pipeline.getStatus();

        // 检查Pipeline是否响应
        if (status.status === 'running') {
          // 可以添加ping检查等
          this.emit('healthCheckPassed', { pipelineId, status });
        } else {
          this.emit('healthCheckFailed', { pipelineId, status, reason: 'Pipeline not running' });
        }
      } catch (error) {
        this.emit('healthCheckFailed', { pipelineId, error });
      }
    });
  }

  /**
   * 获取启动时间
   */
  private getStartTime(): number {
    // 这里应该记录实际的启动时间
    // 为了简化，返回当前时间减去一个估计值
    return Date.now() - 60000; // 假设1分钟前启动
  }
}
