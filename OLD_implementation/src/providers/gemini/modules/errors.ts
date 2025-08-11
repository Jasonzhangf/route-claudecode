/**
 * Gemini专用错误类型定义
 * 项目所有者: Jason Zhang
 * 
 * 职责：
 * - 定义结构化的错误类型
 * - 支持错误阶段识别
 * - 消除string-based错误检测
 */

export abstract class GeminiError extends Error {
  abstract readonly stage: string;
  abstract readonly component: string;
  
  constructor(
    message: string,
    public readonly context?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * 请求转换阶段错误
 */
export class GeminiRequestConversionError extends GeminiError {
  readonly stage = 'request-conversion';
  readonly component = 'GeminiRequestConverter';
  
  constructor(message: string, context?: any) {
    super(`GeminiRequestConverter: ${message}`, context);
  }
}

/**
 * API执行阶段错误
 */
export class GeminiApiExecutionError extends GeminiError {
  readonly stage = 'api-execution';
  readonly component = 'GeminiApiClient';
  
  constructor(message: string, context?: any) {
    super(`GeminiApiClient: ${message}`, context);
  }
}

/**
 * 响应转换阶段错误
 */
export class GeminiResponseConversionError extends GeminiError {
  readonly stage = 'response-conversion';
  readonly component = 'GeminiResponseConverter';
  
  constructor(message: string, context?: any) {
    super(`GeminiResponseConverter: ${message}`, context);
  }
}

/**
 * 流式模拟阶段错误
 */
export class GeminiStreamingSimulationError extends GeminiError {
  readonly stage = 'streaming-simulation';
  readonly component = 'GeminiStreamingSimulator';
  
  constructor(message: string, context?: any) {
    super(`GeminiStreamingSimulator: ${message}`, context);
  }
}

/**
 * 管道协调错误
 */
export class GeminiPipelineCoordinationError extends GeminiError {
  readonly stage = 'pipeline-coordination';
  readonly component = 'GeminiPipelineCoordinator';
  
  constructor(message: string, context?: any) {
    super(`GeminiPipelineCoordinator: ${message}`, context);
  }
}

/**
 * 配置验证错误
 */
export class GeminiConfigurationError extends GeminiError {
  readonly stage = 'configuration';
  readonly component = 'GeminiConfiguration';
  
  constructor(message: string, context?: any) {
    super(`GeminiConfiguration: ${message}`, context);
  }
}

/**
 * 模型验证错误
 */
export class GeminiModelValidationError extends GeminiError {
  readonly stage = 'model-validation';
  readonly component = 'GeminiModelValidator';
  
  constructor(message: string, context?: any) {
    super(`GeminiModelValidation: ${message}`, context);
  }
}

/**
 * 工具调用验证错误
 */
export class GeminiToolCallValidationError extends GeminiError {
  readonly stage = 'tool-validation';
  readonly component = 'GeminiToolValidator';
  
  constructor(message: string, context?: any) {
    super(`GeminiToolValidation: ${message}`, context);
  }
}

/**
 * 错误分类工具
 */
export class GeminiErrorClassifier {
  /**
   * 根据错误类型识别处理阶段
   */
  static identifyStage(error: any): string {
    if (error instanceof GeminiError) {
      return error.stage;
    }
    
    // 对于非结构化错误，返回具体类型信息
    if (error instanceof Error) {
      return `external-error: ${error.constructor.name}`;
    }
    
    return `unknown-error-type: ${typeof error}`;
  }
  
  /**
   * 检查是否为Gemini相关错误
   */
  static isGeminiError(error: any): error is GeminiError {
    return error instanceof GeminiError;
  }
  
  /**
   * 创建错误上下文信息
   */
  static createContext(
    requestId: string,
    additionalContext?: any
  ): any {
    return {
      requestId,
      timestamp: new Date().toISOString(),
      ...additionalContext
    };
  }
}