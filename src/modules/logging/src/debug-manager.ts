/**
 * Debug管理器
 *
 * 负责Debug系统的核心管理功能，包括模块注册、开关控制和记录管理
 *
 * @author Jason Zhang
 */

import { EventEmitter } from 'events';
import { DebugRecord, DebugSession, ModuleDebugInfo, DebugConfig, DebugStatistics } from './types/debug-types';
import { RCCError, ValidationError, TransformError, AuthError, RCCErrorCode } from '../../error-handler';
import { DebugRecorder, DebugRecorderImpl } from './debug-recorder';
import JQJsonHandler from '../../error-handler/src/utils/jq-json-handler';
import { ConsoleLogCapture } from './console-log-capture';
import {
  ModuleInterface,
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
} from '../../interfaces/module/base-module';

/**
 * Transformer数据类型
 */
interface TransformerData {
  model?: string;
  messages?: unknown[];
  tools?: unknown[];
  system?: string;
  [key: string]: unknown;
}

/**
 * 健康检查结果类型
 */
interface HealthCheckResult {
  healthy: boolean;
  details?: unknown;
}

/**
 * 类型守卫函数
 */
function isTransformerData(obj: unknown): obj is TransformerData {
  return obj !== null && typeof obj === 'object';
}

function hasArrayProperty<T extends string>(obj: unknown, prop: T): obj is Record<T, unknown[]> & Record<string, unknown> {
  return obj !== null && typeof obj === 'object' && prop in obj && Array.isArray((obj as any)[prop]);
}

function hasProperty<T extends string>(obj: unknown, prop: T): obj is Record<T, unknown> & Record<string, unknown> {
  return obj !== null && typeof obj === 'object' && prop in obj;
}

function isHealthCheckResult(obj: unknown): obj is HealthCheckResult {
  return obj !== null && typeof obj === 'object' && 'healthy' in obj && typeof (obj as any).healthy === 'boolean';
}

/**
 * Debug管理器接口
 */
export interface DebugManager {
  registerModule(moduleName: string, port: number): void;
  enableDebug(moduleName: string): void;
  disableDebug(moduleName: string): void;
  recordInput(moduleName: string, requestId: string, input: unknown): void;
  recordOutput(moduleName: string, requestId: string, output: unknown): void;
  recordError(moduleName: string, requestId: string, error: RCCError | Error): void;
  createSession(port: number, sessionId?: string): DebugSession;
  endSession(sessionId: string): Promise<void>;
  getStatistics(): DebugStatistics;
  cleanup(): Promise<void>;
  setRequestContext(requestId: string, port?: number): void;
  recordPipelineResponse(requestId: string, pipelineId: string, processingTime: number, response: any, layerOutputs: any[]): void;
}

/**
 * Debug管理器实现
 */
export class DebugManagerImpl extends EventEmitter implements DebugManager, ModuleInterface {
  // ModuleInterface properties
  private moduleId = 'debug-manager';
  private moduleName = 'Debug Manager';
  private moduleVersion = '4.0.0';
  private moduleStatus: ModuleStatus;
  private moduleMetrics: ModuleMetrics;
  private connections = new Map<string, ModuleInterface>();
  private messageListeners = new Set<(sourceModuleId: string, message: unknown, type: string) => void>();
  private isStarted = false;
  private registeredModules: Map<string, ModuleDebugInfo> = new Map();
  private debugEnabled: Map<string, boolean> = new Map();
  private activeSessions: Map<string, DebugSession> = new Map();
  private recorder: DebugRecorder;
  // private replaySystem: ReplaySystem; // Removed: class doesn't exist
  private config: DebugConfig;
  private currentPort: number;
  private startTime: number;
  private consoleCapture: ConsoleLogCapture;

  constructor(config?: Partial<DebugConfig>) {
    super();
    this.startTime = Date.now();

    // Initialize ModuleInterface properties
    this.moduleStatus = {
      id: this.moduleId,
      name: this.moduleName,
      type: ModuleType.DEBUG,
      status: 'stopped',
      health: 'healthy'
    };
    this.moduleMetrics = {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    // 使用正确的debug-logs路径
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    const debugLogsPath = `${homeDir}/.route-claudecode/debug-logs`;
    
    // 默认配置
    this.config = {
      enabled: true,
      maxRecordSize: 10 * 1024 * 1024, // 10MB
      maxSessionDuration: 24 * 60 * 60 * 1000, // 24小时
      retentionDays: 7,
      compressionEnabled: true,
      storageBasePath: debugLogsPath,
      modules: {
        client: { enabled: true, logLevel: 'info' },
        router: { enabled: true, logLevel: 'info' },
        pipeline: { enabled: true, logLevel: 'debug' },
        transformer: { enabled: true, logLevel: 'debug' },
        protocol: { enabled: true, logLevel: 'debug' },
        'server-compatibility': { enabled: true, logLevel: 'debug' },
        server: { enabled: true, logLevel: 'info' },
      },
      ...config,
    };

    this.recorder = new DebugRecorderImpl(this.config);
    // this.replaySystem = new ReplaySystemImpl(this.recorder); // Removed: class doesn't exist
    
    this.consoleCapture = new ConsoleLogCapture(debugLogsPath);

    // 启动清理任务
    this.startCleanupScheduler();

    this.emit('debug-manager-initialized', {
      config: this.config,
      timestamp: Date.now(),
    });
  }

  /**
   * 初始化Debug管理器
   */
  async initialize(port?: number): Promise<void> {
    // 设置当前端口
    if (port !== undefined) {
      this.currentPort = port;
    }
    
    // 启用console日志捕获
    if (this.currentPort !== undefined) {
      this.consoleCapture.enable(this.currentPort);
    }
    
    // 初始化逻辑
    console.log(`Debug manager initialized for port ${this.currentPort !== undefined ? this.currentPort : 'unspecified'}`);
    this.emit('initialized', { port: this.currentPort !== undefined ? this.currentPort : undefined });
  }

  /**
   * 注册模块到Debug系统
   */
  registerModule(moduleName: string, port: number): void {
    if (this.registeredModules.has(moduleName)) {
      console.warn(`Module ${moduleName} is already registered`);
      return;
    }

    const moduleInfo: ModuleDebugInfo = {
      name: moduleName,
      port,
      registeredAt: Date.now(),
    };

    this.registeredModules.set(moduleName, moduleInfo);

    // 应用配置中的默认启用状态
    const moduleConfig = this.config.modules[moduleName];
    this.debugEnabled.set(moduleName, moduleConfig?.enabled ?? true);

    this.emit('module-registered', {
      moduleName,
      port,
      enabled: this.debugEnabled.get(moduleName),
      timestamp: Date.now(),
    });

    console.log(`📦 Debug模块已注册: ${moduleName} (端口: ${port})`);
  }

  /**
   * 启用模块Debug
   */
  enableDebug(moduleName: string): void {
    if (!this.registeredModules.has(moduleName)) {
      throw new Error(`Module ${moduleName} not registered`);
    }

    this.debugEnabled.set(moduleName, true);

    this.emit('debug-enabled', {
      moduleName,
      timestamp: Date.now(),
    });

    console.log(`🔍 Debug已启用: ${moduleName}`);
  }

  /**
   * 禁用模块Debug
   */
  disableDebug(moduleName: string): void {
    this.debugEnabled.set(moduleName, false);

    this.emit('debug-disabled', {
      moduleName,
      timestamp: Date.now(),
    });

    console.log(`🔕 Debug已禁用: ${moduleName}`);
  }

  /**
   * 记录模块输入
   */
  recordInput(moduleName: string, requestId: string, input: unknown): void {
    if (!this.isDebugEnabled(moduleName)) return;

    try {
      // 🔍 对 transformer 模块进行特殊处理
      if (moduleName === 'transformer') {
        console.log(`🔍 [DEBUG-MANAGER] Transformer输入记录 ${requestId}:`, {
          输入类型: typeof input,
          输入是否为空: !input || (typeof input === 'object' && Object.keys(input || {}).length === 0),
          输入字段: input && typeof input === 'object' ? Object.keys(input) : [],
          输入预览: input ? JQJsonHandler.stringifyJson(input).substring(0, 200) + '...' : 'null/undefined',
          原始输入数据: input
        });
        
        // 深度分析输入数据
        if (isTransformerData(input)) {
          const analysis = this.analyzeTransformerData(input, 'input');
          console.log(`🔍 [DEBUG-MANAGER] Transformer输入分析:`, analysis);
        }
      }

      this.recorder.recordModuleInput(moduleName, requestId, input);

      this.emit('input-recorded', {
        moduleName,
        requestId,
        timestamp: Date.now(),
        dataSize: JQJsonHandler.stringifyJson(input).length,
        isTransformer: moduleName === 'transformer',
        enhancedDebugging: moduleName === 'transformer'
      });
    } catch (error) {
      console.error(`记录输入失败 [${moduleName}]:`, error);
    }
  }

  /**
   * 记录模块输出
   */
  recordOutput(moduleName: string, requestId: string, output: unknown): void {
    if (!this.isDebugEnabled(moduleName)) return;

    try {
      // 🔍 对 transformer 模块进行特殊处理
      if (moduleName === 'transformer') {
        console.log(`🔍 [DEBUG-MANAGER] Transformer输出记录 ${requestId}:`, {
          输出类型: typeof output,
          输出是否为空: !output || (typeof output === 'object' && Object.keys(output || {}).length === 0),
          输出字段: output && typeof output === 'object' ? Object.keys(output) : [],
          输出预览: output ? JQJsonHandler.stringifyJson(output).substring(0, 200) + '...' : 'null/undefined',
          原始输出数据: output
        });
        
        // 🔧 修复：深度分析输出数据，正确判断转换是否成功
        if (isTransformerData(output)) {
          const analysis = this.analyzeTransformerData(output, 'output');
          console.log(`🔍 [DEBUG-MANAGER] Transformer输出分析:`, analysis);
          
          // 🔧 修复：检查输出是否为空对象的关键问题
          if (Object.keys(output).length === 0) {
            console.error(`❌ [DEBUG-MANAGER] CRITICAL: Transformer输出为空对象！这是用户反馈的核心问题！`);
          } else if (hasProperty(output, 'model') && hasArrayProperty(output, 'messages')) {
            // 如果有模型和消息字段，说明转换成功
            const toolCount = hasArrayProperty(output, 'tools') ? output.tools.length : 0;
            console.log(`✅ [DEBUG-MANAGER] Transformer转换成功: 模型=${output.model}, 消息数=${output.messages.length}, 工具数=${toolCount}`);
          }
        } else {
          console.error(`❌ [DEBUG-MANAGER] CRITICAL: Transformer输出不是对象或为空！输出类型: ${typeof output}, 值: ${output}`);
        }
      }

      this.recorder.recordModuleOutput(moduleName, requestId, output);

      this.emit('output-recorded', {
        moduleName,
        requestId,
        timestamp: Date.now(),
        dataSize: output ? JQJsonHandler.stringifyJson(output).length : 0,
        isTransformer: moduleName === 'transformer',
        enhancedDebugging: moduleName === 'transformer',
        outputEmpty: moduleName === 'transformer' && (!output || Object.keys(output || {}).length === 0)
      });
    } catch (error) {
      console.error(`记录输出失败 [${moduleName}]:`, error);
    }
  }

  /**
   * 记录模块错误（错误总是记录，不受debug开关影响）
   */
  recordError(moduleName: string, requestId: string, error: RCCError | Error): void {
    try {
      // 如果是RCCError类型，使用专门的记录方法
      if (error instanceof RCCError) {
        // 使用增强的记录方法处理RCCError
        this.recorder.recordModuleError(moduleName, requestId, error);
      } else {
        // 转换为RCCError再记录
        const rccError = new RCCError(error.message, RCCErrorCode.UNKNOWN_ERROR, moduleName);
        this.recorder.recordModuleError(moduleName, requestId, rccError);
      }

      this.emit('error-recorded', {
        moduleName,
        requestId,
        error: error.message,
        errorCode: error instanceof RCCError ? error.code : undefined,
        moduleId: error instanceof RCCError ? error.module : undefined,
        severity: error instanceof RCCError ? (error as any).severity : undefined,
        timestamp: Date.now(),
      });

      if (error instanceof RCCError) {
        console.error(`❌ Debug错误记录 [${moduleName}]: ${error.message} (Code: ${error.code}, Module: ${error.module || 'unknown'}, Severity: ${(error as any).severity})`);
      } else {
        console.error(`❌ Debug错误记录 [${moduleName}]: ${error.message}`);
      }
    } catch (recordError) {
      console.error(`记录错误失败 [${moduleName}]:`, recordError);
    }
  }

  /**
   * 创建Debug会话
   */
  createSession(port?: number, sessionId?: string): DebugSession {
    const now = Date.now();
    const actualPort = port !== undefined ? port : (this.currentPort !== undefined ? this.currentPort : this.getDefaultPort());
    
    // 如果没有提供sessionId，则生成一个新的
    if (!sessionId) {
      const date = new Date(now);
      sessionId = `session-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
    }

    const session: DebugSession = {
      sessionId,
      port: actualPort,
      startTime: now,
      startTimeReadable: this.formatReadableTime(now),
      requestCount: 0,
      errorCount: 0,
      activePipelines: [],
      metadata: {
        version: '4.0.0',
        config: this.config,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    this.activeSessions.set(sessionId, session);
    this.recorder.createSession(actualPort, sessionId);

    this.emit('session-created', {
      sessionId,
      port: actualPort,
      timestamp: now,
    });

    console.log(`🎯 Debug会话已创建: ${sessionId} (端口: ${actualPort})`);
    return session;
  }

  /**
   * 结束Debug会话
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const now = Date.now();
    session.endTime = now;
    session.endTimeReadable = this.formatReadableTime(now);
    session.duration = now - session.startTime;

    try {
      await this.recorder.endSession(sessionId);
      this.activeSessions.delete(sessionId);

      this.emit('session-ended', {
        sessionId,
        duration: session.duration,
        requestCount: session.requestCount,
        errorCount: session.errorCount,
        timestamp: now,
      });

      console.log(`🏁 Debug会话已结束: ${sessionId} (持续: ${session.duration}ms)`);
    } catch (error) {
      console.error(`结束会话失败 [${sessionId}]:`, error);
      throw error;
    }
  }

  /**
   * 获取Debug统计信息
   */
  getStatistics(): DebugStatistics {
    const moduleStats = new Map<
      string,
      {
        recordCount: number;
        errorCount: number;
        averageDuration: number;
      }
    >();

    // 收集模块统计信息
    for (const [moduleName] of this.registeredModules) {
      moduleStats.set(moduleName, {
        recordCount: 0,
        errorCount: 0,
        averageDuration: 0,
      });
    }

    return {
      totalSessions: this.activeSessions.size,
      activeSessions: this.activeSessions.size,
      totalRecords: 0, // 由recorder提供
      totalErrors: 0, // 由recorder提供
      averageResponseTime: 0, // 由recorder提供
      diskUsage: 0, // 由recorder提供
      moduleStatistics: moduleStats,
    };
  }

  /**
   * 获取回放系统
   */
  getReplaySystem(): any {
    // TODO: 实现回放系统
    return null;
  }

  /**
   * 获取记录器
   */
  getRecorder(): DebugRecorder {
    return this.recorder;
  }

  // === ModuleInterface implementation ===
  getId() { return this.moduleId; }
  getName() { return this.moduleName; }
  getType() { return ModuleType.DEBUG; }
  getVersion() { return this.moduleVersion; }
  getStatus() { return { ...this.moduleStatus }; }
  getMetrics() { return { ...this.moduleMetrics }; }
  async configure(config: Record<string, unknown>) { this.moduleStatus.status = 'stopped'; }
  async start() { this.isStarted = true; this.moduleStatus.status = 'running'; }
  async stop() { this.isStarted = false; this.moduleStatus.status = 'stopped'; }
  async process(input: unknown) { this.moduleMetrics.requestsProcessed++; return input; }
  async reset() { this.moduleMetrics = { requestsProcessed: 0, averageProcessingTime: 0, errorRate: 0, memoryUsage: 0, cpuUsage: 0 }; }
  async healthCheck(): Promise<{ healthy: boolean; details: any; }> { return { healthy: this.isStarted, details: { status: this.moduleStatus } }; }
  addConnection(module: ModuleInterface) { this.connections.set(module.getId(), module); }
  removeConnection(moduleId: string) { this.connections.delete(moduleId); }
  getConnection(moduleId: string) { return this.connections.get(moduleId); }
  getConnections() { return Array.from(this.connections.values()); }
  getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error' {
    return this.connections.has(targetModuleId) ? 'connected' : 'disconnected';
  }
  validateConnection(targetModule: ModuleInterface): boolean {
    try {
      return targetModule && typeof targetModule.getId === 'function' && targetModule.getId().length > 0;
    } catch {
      return false;
    }
  }
  async sendToModule(targetModuleId: string, message: unknown, type?: string) { return message; }
  async broadcastToModules(message: unknown, type?: string) { }
  onModuleMessage(listener: (sourceModuleId: string, message: unknown, type: string) => void) { this.messageListeners.add(listener); }
  removeAllListeners(event?: string | symbol) { super.removeAllListeners(event); if (!event) this.messageListeners.clear(); return this; }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('🧹 开始清理Debug系统...');

    // 清理定时器
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      console.log('✅ Debug系统定时器已清理');
    }

    // 结束所有活跃会话
    for (const sessionId of this.activeSessions.keys()) {
      try {
        await this.endSession(sessionId);
      } catch (error) {
        console.error(`清理会话失败 [${sessionId}]:`, error);
      }
    }

    // 清理记录器
    if (this.recorder) {
      await this.recorder.cleanup();
    }

    // 禁用console捕获
    if (this.consoleCapture) {
      this.consoleCapture.disable();
    }

    this.emit('debug-manager-cleanup', {
      timestamp: Date.now(),
      duration: Date.now() - this.startTime,
    });

    console.log('✅ Debug系统清理完成');
  }

  /**
   * 记录流水线响应
   */
  recordPipelineResponse(requestId: string, pipelineId: string, processingTime: number, response: any, layerOutputs: any[]): void {
    try {
      // 使用记录器保存流水线响应
      this.recorder.recordPipelineResponse(requestId, pipelineId, processingTime, response, layerOutputs);

      this.emit('pipeline-response-recorded', {
        requestId,
        pipelineId,
        processingTime,
        timestamp: Date.now(),
      });

      console.log(`📝 流水线响应已记录: ${pipelineId} (处理时间: ${processingTime}ms)`);
    } catch (error) {
      console.error(`记录流水线响应失败 [${requestId}]:`, error);
    }
  }

  /**
   * 设置当前请求上下文（用于console日志关联）
   */
  setRequestContext(requestId: string, port?: number): void {
    if (this.consoleCapture) {
      this.consoleCapture.setCurrentRequestId(requestId, port);
    }
  }

  /**
   * 检查模块是否启用Debug
   */
  private isDebugEnabled(moduleName: string): boolean {
    if (!this.config.enabled) return false;
    return this.debugEnabled.get(moduleName) ?? false;
  }

  /**
   * 格式化可读时间
   */
  private formatReadableTime(timestamp: number): string {
    const date = new Date(timestamp);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${date.toLocaleString('zh-CN', { timeZone: timezone })} ${timezone}`;
  }

  /**
   * 获取默认端口
   * 尝试从环境变量、配置或使用最后的默认值
   */
  private getDefaultPort(): number {
    // 1. 尝试从环境变量获取
    if (process.env.RCC_PORT) {
      const envPort = parseInt(process.env.RCC_PORT);
      if (!isNaN(envPort) && envPort > 0) {
        return envPort;
      }
    }
    
    // 2. 尝试从配置获取
    if (this.config.storageBasePath) {
      // 这里可以从配置路径中读取配置文件获取端口
      // 但为了避免循环依赖，暂时跳过
    }
    
    // 3. 使用默认值并发出警告
    console.warn('⚠️ Debug管理器无法获取动态端口，使用默认端口5506');
    return 5506;
  }

  private cleanupIntervalId: NodeJS.Timeout | null = null;

  /**
   * 启动清理调度器
   */
  private startCleanupScheduler(): void {
    // 每小时检查一次过期记录
    this.cleanupIntervalId = setInterval(
      async () => {
        try {
          await this.recorder.cleanupExpiredRecords();
        } catch (error) {
          console.error('定期清理失败:', error);
        }
      },
      60 * 60 * 1000
    ); // 1小时

    // 清理器在进程退出时停止
    process.once('exit', () => {
      if (this.cleanupIntervalId) {
        clearInterval(this.cleanupIntervalId);
        this.cleanupIntervalId = null;
      }
    });
  }

  /**
   * 深度分析 transformer 数据
   */
  private analyzeTransformerData(data: TransformerData, type: 'input' | 'output'): Record<string, unknown> {
    if (!data || typeof data !== 'object') {
      return {
        format: 'empty',
        isEmpty: true,
        type: typeof data,
        keys: [],
        hasModel: false,
        hasMessages: false,
        hasTools: false,
        messageCount: 0,
        toolCount: 0,
        summary: `${type}为空或不是对象`
      };
    }

    const keys = Object.keys(data);
    const hasModel = hasProperty(data, 'model');
    const hasMessages = hasArrayProperty(data, 'messages');
    const hasTools = hasArrayProperty(data, 'tools');
    const messageCount = hasMessages ? data.messages.length : 0;
    const toolCount = hasTools ? data.tools.length : 0;

    // 检测格式
    let format = 'unknown';
    if (hasMessages) {
      if (hasProperty(data, 'system') || (hasTools && this.hasAnthropicToolFormat(data.tools))) {
        format = 'anthropic';
      } else if (hasTools && this.hasOpenAIToolFormat(data.tools)) {
        format = 'openai';
      } else {
        format = 'chat-completion';
      }
    }

    return {
      format,
      isEmpty: keys.length === 0,
      type: typeof data,
      keys,
      hasModel,
      hasMessages,
      hasTools,
      messageCount,
      toolCount,
      toolFormat: hasTools ? this.analyzeToolFormat(data.tools) : 'none',
      summary: `${type}: ${keys.length}个字段, ${messageCount}条消息, ${toolCount}个工具, 格式=${format}`,
      rawData: data // 保留原始数据用于调试
    };
  }

  /**
   * 检查是否有 Anthropic 工具格式
   */
  private hasAnthropicToolFormat(tools: unknown[]): boolean {
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return false;
    }
    
    const firstTool = tools[0];
    return hasProperty(firstTool, 'name') && hasProperty(firstTool, 'input_schema');
  }

  /**
   * 检查是否有 OpenAI 工具格式
   */
  private hasOpenAIToolFormat(tools: unknown[]): boolean {
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return false;
    }
    
    const firstTool = tools[0];
    return hasProperty(firstTool, 'type') && 
           (firstTool as any).type === 'function' && 
           hasProperty(firstTool, 'function') && 
           hasProperty((firstTool as any).function, 'parameters');
  }

  /**
   * 分析工具格式
   */
  private analyzeToolFormat(tools: unknown[]): string {
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return 'none';
    }

    const firstTool = tools[0];
    
    // OpenAI 格式：{type: "function", function: {name, description, parameters}}
    if (hasProperty(firstTool, 'type') && 
        (firstTool as any).type === 'function' && 
        hasProperty(firstTool, 'function') && 
        hasProperty((firstTool as any).function, 'parameters')) {
      return 'openai';
    }
    
    // Anthropic 格式：{name, description, input_schema}
    if (hasProperty(firstTool, 'name') && hasProperty(firstTool, 'input_schema')) {
      return 'anthropic';
    }
    
    return 'unknown';
  }
}

/**
 * Debug错误类
 */
export class DebugError extends Error {
  constructor(operation: string, message: string) {
    super(`Debug operation failed (${operation}): ${message}`);
    this.name = 'DebugError';
  }
}
