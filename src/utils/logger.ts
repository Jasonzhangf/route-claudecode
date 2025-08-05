/**
 * 临时日志兼容层
 * 为了保持构建兼容性，提供旧日志接口的兼容实现
 * 项目所有者: Jason Zhang
 */

import { getLogger, createErrorTracker, createRequestTracker, type ToolCallError } from '../logging';

// 创建兼容的logger实例 - 使用更安静的配置
const compatLogger = getLogger();

export const logger = {
  error: (message: string, data?: any, requestId?: string, stage?: string) => {
    compatLogger.error(message, data, requestId, stage);
  },
  warn: (message: string, data?: any, requestId?: string, stage?: string) => {
    compatLogger.warn(message, data, requestId, stage);
  },
  info: (message: string, data?: any, requestId?: string, stage?: string) => {
    compatLogger.info(message, data, requestId, stage);
  },
  debug: (message: string, data?: any, requestId?: string, stage?: string) => {
    compatLogger.debug(message, data, requestId, stage);
  },
  logFinishReason: (finishReason: string, data?: any, requestId?: string, stage?: string) => {
    compatLogger.logFinishReason(finishReason, data, requestId, stage);
  },
  logStopReason: (stopReason: string, data?: any, requestId?: string, stage?: string) => {
    compatLogger.logStopReason(stopReason, data, requestId, stage);
  },
  trace: (requestId: string, stage: string, message: string, data?: any) => {
    compatLogger.debug(`[TRACE] ${message}`, data, requestId, stage);
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

  constructor(port: number = 3456) {
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
      port: failureData.port || 3456
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
    port: number = 3456
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