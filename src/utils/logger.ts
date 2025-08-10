/**
 * 临时日志兼容层
 * 为了保持构建兼容性，提供旧日志接口的兼容实现
 * 项目所有者: Jason Zhang
 */

import { getLogger, createErrorTracker, createRequestTracker, type ToolCallError } from '../logging';

// 创建兼容的logger实例 - 延迟初始化以获取正确的端口
let compatLogger: ReturnType<typeof getLogger> | null = null;

function getCompatLogger() {
  if (!compatLogger) {
    // 🔧 修复硬编码：智能获取端口配置，支持多种来源
    const portFromEnv = process.env.RCC_PORT ? parseInt(process.env.RCC_PORT) : null;
    
    // 如果环境变量未设置，尝试从全局默认端口获取
    let port = portFromEnv;
    if (!port) {
      // 检查是否有全局默认端口（由server.ts设置）
      try {
        const { getDefaultPort } = require('../logging/default-port');
        port = getDefaultPort();
      } catch {
        // 如果无法获取默认端口，使用日志专用的备用端口
        port = 3456; // 仅用于日志系统，不影响服务器端口
      }
    }
    
    // 智能初始化logger - 处理manager尚未设置默认端口的情况
    try {
      const { getLogger, setDefaultPort } = require('../logging');
      if (port) {
        // 如果有端口，先设置为默认端口，然后创建logger
        setDefaultPort(port);
        compatLogger = getLogger();
      } else {
        // 仍然没有端口，使用3456作为fallback
        setDefaultPort(3456);
        compatLogger = getLogger(3456);
        console.warn('⚠️  Logger initialized with fallback port 3456 - this is for logging compatibility only');
      }
    } catch (error) {
      console.error('Failed to initialize logger:', error);
      throw error;
    }
  }
  return compatLogger;
}

export const logger = {
  error: (message: string, data?: any, requestId?: string, stage?: string) => {
    const logger = getCompatLogger();
    if (logger) logger.error(message, data, requestId, stage);
  },
  warn: (message: string, data?: any, requestId?: string, stage?: string) => {
    const logger = getCompatLogger();
    if (logger) logger.warn(message, data, requestId, stage);
  },
  info: (message: string, data?: any, requestId?: string, stage?: string) => {
    const logger = getCompatLogger();
    if (logger) logger.info(message, data, requestId, stage);
  },
  debug: (message: string, data?: any, requestId?: string, stage?: string) => {
    const logger = getCompatLogger();
    if (logger) logger.debug(message, data, requestId, stage);
  },
  logFinishReason: (finishReason: string, data?: any, requestId?: string, stage?: string) => {
    const logger = getCompatLogger();
    if (logger) logger.logFinishReason(finishReason, data, requestId, stage);
  },
  logStopReason: (stopReason: string, data?: any, requestId?: string, stage?: string) => {
    const logger = getCompatLogger();
    if (logger) logger.logStopReason(stopReason, data, requestId, stage);
  },
  logDualFinishReason: (originalReason: string, convertedReason: string, provider: string, data?: any, requestId?: string, stage?: string) => {
    const logger = getCompatLogger();
    if (logger) logger.logDualFinishReason(originalReason, convertedReason, provider, data, requestId, stage);
  },
  trace: (requestId: string, stage: string, message: string, data?: any) => {
    const logger = getCompatLogger();
    if (logger) logger.debug(`[TRACE] ${message}`, data, requestId, stage);
  },
  setConfig: (_options: any) => {
    // 兼容旧的setConfig调用，但实际不做任何操作
  },
  setQuietMode: (_enabled: boolean) => {
    // 兼容旧的setQuietMode调用，但实际不做任何操作
  }
};

// PipelineDebugger 兼容类 - 映射到新的日志系统
export class PipelineDebugger {
  private errorTracker: ReturnType<typeof createErrorTracker>;
  private requestTracker: ReturnType<typeof createRequestTracker>;
  private logger: ReturnType<typeof getLogger>;

  constructor(port: number) {
    this.errorTracker = createErrorTracker(port);
    this.requestTracker = createRequestTracker(port);
    this.logger = getLogger(port);
  }

  // 检测工具调用错误
  detectToolCallError(
    text: string, 
    requestId: string, 
    stage: string = 'unknown',
    provider: string = 'unknown',
    model: string = 'unknown'
  ): boolean {
    return this.errorTracker.detectToolCallInText(text, requestId, stage, provider, model);
  }

  // 记录工具调用错误
  logToolCallError(error: ToolCallError): void {
    this.errorTracker.logToolCallError(error);
  }

  // 添加原始流数据
  addRawStreamData(requestId: string, data: string): void {
    this.requestTracker.logStage(requestId, 'raw_stream_data', {
      rawData: data
    });
  }

  // 记录失败
  logFailure(failureData: any): void {
    this.errorTracker.logStandardizedError({
      requestId: failureData.requestId || 'unknown',
      reason: failureData.reason || 'Unknown failure',
      provider: failureData.provider || 'unknown',
      model: failureData.model || 'unknown',
      errorCode: failureData.errorCode || 'PIPELINE_FAILURE',
      key: failureData.key || 'unknown',
      port: failureData.port // 🔧 移除fallback：必须明确指定端口
    });
  }
}

// ToolCallError 兼容类
export class ToolCallErrorClass implements ToolCallError {
  requestId: string;
  errorMessage: string;
  transformationStage: string;
  provider: string;
  model: string;
  context: any;
  port: number;

  constructor(
    errorMessage: string,
    requestId: string,
    transformationStage: string = 'unknown',
    provider: string = 'unknown',
    model: string = 'unknown',
    context: any = {},
    port: number
  ) {
    this.requestId = requestId;
    this.errorMessage = errorMessage;
    this.transformationStage = transformationStage;
    this.provider = provider;
    this.model = model;
    this.context = context;
    this.port = port;
  }
}

// 工厂函数兼容
export function createLogger(_logDir: string, _serverType: string) {
  return logger;
}

// 导出类型和其他兼容接口
export { type ToolCallError };