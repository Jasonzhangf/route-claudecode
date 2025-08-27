/**
 * 错误分类器
 * 
 * 自动识别和分类各种错误类型，为错误日志管理器提供准确的错误分类
 * 
 * @author RCC v4.0 - Debug System Enhancement
 */

import { ErrorType } from './error-log-manager';
import { secureLogger } from '../utils/secure-logger';

/**
 * 错误模式匹配规则
 */
interface ErrorPattern {
  type: ErrorType;
  patterns: string[];
  stackTracePatterns?: string[];
  priority: number; // 优先级，数字越大优先级越高
}

/**
 * 错误分类结果
 */
export interface ErrorClassification {
  type: ErrorType;
  confidence: number; // 0-1之间，表示分类的置信度
  matchedPattern: string;
  contextHints?: string[];
}

/**
 * 错误分类器
 */
export class ErrorClassifier {
  private patterns: ErrorPattern[] = [
    // Filter错误（最高优先级）
    {
      type: ErrorType.FILTER_ERROR,
      patterns: [
        'Cannot read properties of undefined (reading \'filter\')',
        'Cannot read property \'filter\' of undefined',
        '.filter is not a function',
        'TypeError.*filter.*undefined',
        'filter.*undefined.*reading'
      ],
      priority: 100
    },

    // Socket相关错误
    {
      type: ErrorType.SOCKET_ERROR,
      patterns: [
        'socket hang up',
        'ECONNRESET',
        'ECONNREFUSED',
        'EPIPE',
        'socket timeout',
        'socket closed',
        'connection reset by peer'
      ],
      stackTracePatterns: [
        'at Socket.',
        'at TLSSocket.',
        'net.js',
        'tls.js'
      ],
      priority: 90
    },

    // 超时错误
    {
      type: ErrorType.TIMEOUT_ERROR,
      patterns: [
        'timeout',
        'ETIMEDOUT',
        'request timeout',
        'operation timeout',
        'connection timeout',
        'read timeout',
        'write timeout'
      ],
      priority: 80
    },

    // 连接错误
    {
      type: ErrorType.CONNECTION_ERROR,
      patterns: [
        'ENOTFOUND',
        'EHOSTUNREACH',
        'ENETUNREACH',
        'connection failed',
        'connection error',
        'network error',
        'DNS resolution failed',
        'host not found'
      ],
      priority: 70
    },

    // 认证错误
    {
      type: ErrorType.AUTH_ERROR,
      patterns: [
        'authentication failed',
        'invalid api key',
        'unauthorized',
        'forbidden',
        'invalid_api_key',
        'authentication error',
        'token expired',
        'access denied',
        'HTTP 401',
        'HTTP 403'
      ],
      priority: 85
    },

    // 流水线错误
    {
      type: ErrorType.PIPELINE_ERROR,
      patterns: [
        'pipeline.*failed',
        'pipeline.*error',
        'pipeline.*execution',
        'pipeline.*processing',
        'routing.*failed',
        'router.*error',
        'No pipelines available',
        'pipeline.*blacklist',
        'pipeline.*destroyed'
      ],
      priority: 75
    },

    // 转换错误
    {
      type: ErrorType.TRANSFORM_ERROR,
      patterns: [
        'transform.*failed',
        'transformation.*error',
        'anthropic.*openai.*error',
        'protocol.*conversion',
        'format.*conversion',
        'schema.*validation',
        'invalid.*format',
        'parsing.*failed'
      ],
      stackTracePatterns: [
        'transformer',
        'transform',
        'anthropic-openai'
      ],
      priority: 65
    },

    // 验证错误
    {
      type: ErrorType.VALIDATION_ERROR,
      patterns: [
        'validation.*failed',
        'invalid.*input',
        'schema.*error',
        'parameter.*missing',
        'required.*field',
        'type.*mismatch',
        'format.*invalid',
        'constraint.*violation'
      ],
      priority: 60
    }
  ];

  /**
   * 对错误进行分类
   */
  public classify(
    errorMessage: string,
    stackTrace?: string,
    context?: Record<string, any>
  ): ErrorClassification {
    const normalizedMessage = errorMessage.toLowerCase();
    const normalizedStack = stackTrace?.toLowerCase() || '';

    let bestMatch: ErrorClassification | null = null;
    let highestScore = 0;

    for (const pattern of this.patterns) {
      const score = this.calculateMatchScore(
        pattern,
        normalizedMessage,
        normalizedStack,
        context
      );

      if (score > highestScore) {
        highestScore = score;
        
        // 找到匹配的具体模式
        const matchedPattern = pattern.patterns.find(p => 
          this.testPattern(p, normalizedMessage)
        ) || pattern.patterns[0];

        bestMatch = {
          type: pattern.type,
          confidence: Math.min(score / 100, 1), // 标准化为0-1
          matchedPattern,
          contextHints: this.generateContextHints(pattern.type, context)
        };
      }
    }

    // 如果没有匹配，返回未知错误类型
    if (!bestMatch || bestMatch.confidence < 0.1) {
      return {
        type: ErrorType.UNKNOWN_ERROR,
        confidence: 0.1,
        matchedPattern: 'no_pattern_matched',
        contextHints: ['Consider adding new error patterns for this error type']
      };
    }

    return bestMatch;
  }

  /**
   * 计算模式匹配分数
   */
  private calculateMatchScore(
    pattern: ErrorPattern,
    message: string,
    stackTrace: string,
    context?: Record<string, any>
  ): number {
    let score = 0;

    // 检查消息模式匹配
    for (const messagePattern of pattern.patterns) {
      if (this.testPattern(messagePattern, message)) {
        score += pattern.priority;
        // 精确匹配给予额外分数
        if (message.includes(messagePattern.toLowerCase())) {
          score += 10;
        }
        break; // 只需要匹配一个模式
      }
    }

    // 检查堆栈跟踪模式
    if (pattern.stackTracePatterns && stackTrace) {
      for (const stackPattern of pattern.stackTracePatterns) {
        if (stackTrace.includes(stackPattern.toLowerCase())) {
          score += 15;
          break;
        }
      }
    }

    // 根据上下文信息调整分数
    if (context) {
      score += this.calculateContextScore(pattern.type, context);
    }

    return score;
  }

  /**
   * 测试模式是否匹配
   */
  private testPattern(pattern: string, text: string): boolean {
    if (pattern.includes('.*') || pattern.includes('\\')) {
      // 处理正则表达式模式
      const regex = new RegExp(pattern, 'i');
      const isMatched = regex.test(text);
      
      if (!isMatched) {
        secureLogger.debug('Regex pattern did not match', {
          pattern,
          text: text.substring(0, 100),
          regexTest: false
        });
      }
      
      return isMatched;
    }
    
    // 简单字符串包含匹配
    return text.includes(pattern.toLowerCase());
  }

  /**
   * 计算上下文相关分数
   */
  private calculateContextScore(errorType: ErrorType, context: Record<string, any>): number {
    let contextScore = 0;

    switch (errorType) {
      case ErrorType.PIPELINE_ERROR:
        if (context.pipelineId || context.layerName) {
          contextScore += 10;
        }
        break;
        
      case ErrorType.AUTH_ERROR:
        if (context.endpoint?.includes('auth') || context.statusCode === 401 || context.statusCode === 403) {
          contextScore += 15;
        }
        break;
        
      case ErrorType.CONNECTION_ERROR:
        if (context.endpoint || context.provider) {
          contextScore += 8;
        }
        break;
        
      case ErrorType.TIMEOUT_ERROR:
        if (context.timeout || context.responseTime) {
          contextScore += 10;
        }
        break;
        
      case ErrorType.TRANSFORM_ERROR:
        if (context.layerName?.includes('transform') || context.protocol) {
          contextScore += 12;
        }
        break;
        
      case ErrorType.FILTER_ERROR:
        if (context.layerName || context.availablePipelines !== undefined) {
          contextScore += 20;
        }
        break;
    }

    return contextScore;
  }

  /**
   * 生成上下文提示
   */
  private generateContextHints(errorType: ErrorType, context?: Record<string, any>): string[] {
    const hints: string[] = [];

    if (!context) return hints;

    switch (errorType) {
      case ErrorType.FILTER_ERROR:
        hints.push('Check array initialization and null safety in pipeline code');
        if (context.layerName) {
          hints.push(`Error occurred in layer: ${context.layerName}`);
        }
        break;

      case ErrorType.SOCKET_ERROR:
        hints.push('Check network connectivity and provider endpoint availability');
        if (context.provider) {
          hints.push(`Provider involved: ${context.provider}`);
        }
        break;

      case ErrorType.TIMEOUT_ERROR:
        hints.push('Consider increasing timeout values or optimizing request size');
        if (context.timeout) {
          hints.push(`Current timeout: ${context.timeout}ms`);
        }
        break;

      case ErrorType.AUTH_ERROR:
        hints.push('Verify API keys and authentication configuration');
        if (context.provider) {
          hints.push(`Check ${context.provider} API credentials`);
        }
        break;

      case ErrorType.PIPELINE_ERROR:
        hints.push('Review pipeline configuration and health status');
        if (context.pipelineId) {
          hints.push(`Consider blacklisting pipeline: ${context.pipelineId}`);
        }
        break;

      case ErrorType.CONNECTION_ERROR:
        hints.push('Check provider endpoint URL and network connectivity');
        if (context.endpoint) {
          hints.push(`Endpoint: ${context.endpoint}`);
        }
        break;

      case ErrorType.TRANSFORM_ERROR:
        hints.push('Review protocol transformation and schema validation');
        if (context.protocol) {
          hints.push(`Protocol: ${context.protocol}`);
        }
        break;

      case ErrorType.VALIDATION_ERROR:
        hints.push('Check request format and required parameters');
        break;

      case ErrorType.UNKNOWN_ERROR:
        hints.push('Consider adding error patterns for better classification');
        if (context.layerName) {
          hints.push(`Layer: ${context.layerName}`);
        }
        break;
    }

    return hints;
  }

  /**
   * 添加自定义错误模式
   */
  public addCustomPattern(
    type: ErrorType,
    patterns: string[],
    priority: number = 50,
    stackTracePatterns?: string[]
  ): void {
    this.patterns.push({
      type,
      patterns,
      stackTracePatterns,
      priority
    });

    // 按优先级排序
    this.patterns.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取所有支持的错误类型
   */
  public getSupportedErrorTypes(): ErrorType[] {
    return Object.values(ErrorType);
  }

  /**
   * 获取错误类型的描述
   */
  public getErrorTypeDescription(type: ErrorType): string {
    const descriptions: Record<ErrorType, string> = {
      [ErrorType.FILTER_ERROR]: 'Array filter method called on undefined or null values',
      [ErrorType.SOCKET_ERROR]: 'Network socket connection issues',
      [ErrorType.TIMEOUT_ERROR]: 'Request or operation timeout errors',
      [ErrorType.PIPELINE_ERROR]: 'Pipeline execution and routing failures',
      [ErrorType.CONNECTION_ERROR]: 'Network connectivity and DNS resolution issues',
      [ErrorType.TRANSFORM_ERROR]: 'Data transformation and protocol conversion errors',
      [ErrorType.AUTH_ERROR]: 'Authentication and authorization failures',
      [ErrorType.VALIDATION_ERROR]: 'Input validation and schema verification errors',
      [ErrorType.UNKNOWN_ERROR]: 'Unclassified or unrecognized errors'
    };

    return descriptions[type] || 'Unknown error type';
  }
}

// 导出单例实例
export const errorClassifier = new ErrorClassifier();