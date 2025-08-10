/**
 * 工具调用解析失败日志记录器
 * 将工具调用解析失败的详细信息记录到数据库
 * Project Owner: Jason Zhang
 */

import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

export interface ToolParsingFailure {
  timestamp: string;
  requestId: string;
  provider: string;
  model: string;
  endpoint: string;
  failureType: 'parsing_error' | 'format_mismatch' | 'missing_tool_calls' | 'invalid_json' | 'text_instead_of_tools';
  originalResponse: any;
  expectedFormat: 'openai' | 'anthropic' | 'custom';
  errorMessage: string;
  responseAnalysis: {
    hasToolCalls: boolean;
    hasContent: boolean;
    contentLength: number;
    contentPreview: string;
    finishReason: string;
    toolCallPatterns?: string[];
  };
  debugInfo: {
    requestTools: any[];
    responseStructure: any;
    parsingAttempts: string[];
  };
}

export class ToolParsingFailureLogger {
  private dbPath: string;
  private failures: ToolParsingFailure[] = [];
  private maxRecords: number = 1000; // 最多保存1000条记录

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'database', 'tool-parsing-failures.json');
    this.loadExistingFailures();
  }

  /**
   * 记录工具调用解析失败
   */
  async logFailure(
    requestId: string,
    provider: string,
    model: string,
    endpoint: string,
    originalResponse: any,
    errorDetails: {
      failureType: ToolParsingFailure['failureType'];
      errorMessage: string;
      expectedFormat: ToolParsingFailure['expectedFormat'];
      requestTools?: any[];
      parsingAttempts?: string[];
    }
  ): Promise<void> {
    
    const failure: ToolParsingFailure = {
      timestamp: new Date().toISOString(),
      requestId,
      provider,
      model,
      endpoint,
      failureType: errorDetails.failureType,
      originalResponse: this.sanitizeResponse(originalResponse),
      expectedFormat: errorDetails.expectedFormat,
      errorMessage: errorDetails.errorMessage,
      responseAnalysis: this.analyzeResponse(originalResponse),
      debugInfo: {
        requestTools: errorDetails.requestTools || [],
        responseStructure: this.analyzeStructure(originalResponse),
        parsingAttempts: errorDetails.parsingAttempts || []
      }
    };

    // 添加到内存中的失败记录
    this.failures.unshift(failure); // 最新的在前面
    
    // 保持记录数量限制
    if (this.failures.length > this.maxRecords) {
      this.failures = this.failures.slice(0, this.maxRecords);
    }

    // 持久化到文件
    await this.saveFailures();

    // 记录到系统日志
    logger.error('🚨 [TOOL-PARSING] Tool call parsing failed', {
      requestId,
      provider,
      model,
      failureType: errorDetails.failureType,
      errorMessage: errorDetails.errorMessage,
      responseAnalysis: failure.responseAnalysis,
      dbPath: this.dbPath
    }, requestId, 'tool-parsing-failure');

    // 如果是特定类型的失败，发出警告
    if (errorDetails.failureType === 'text_instead_of_tools') {
      logger.warn('🔧 [TOOL-PARSING] Provider returned tool calls as text - preprocessor needed', {
        provider,
        model,
        contentPreview: failure.responseAnalysis.contentPreview,
        requestId
      });
    }
  }

  /**
   * 分析响应内容
   */
  private analyzeResponse(response: any): ToolParsingFailure['responseAnalysis'] {
    const analysis: ToolParsingFailure['responseAnalysis'] = {
      hasToolCalls: false,
      hasContent: false,
      contentLength: 0,
      contentPreview: '',
      finishReason: 'unknown'
    };

    // 检查OpenAI格式
    if (response?.choices?.[0]) {
      const choice = response.choices[0];
      analysis.finishReason = choice.finish_reason || 'unknown';
      
      if (choice.message) {
        analysis.hasToolCalls = !!(choice.message.tool_calls && choice.message.tool_calls.length > 0);
        analysis.hasContent = !!choice.message.content;
        analysis.contentLength = choice.message.content?.length || 0;
        analysis.contentPreview = choice.message.content?.substring(0, 200) || '';
        
        // 检查文本内容中是否包含工具调用模式
        if (analysis.hasContent && !analysis.hasToolCalls) {
          analysis.toolCallPatterns = this.detectToolCallPatterns(choice.message.content);
        }
      }
    }
    
    // 检查Anthropic格式
    else if (response?.content) {
      analysis.finishReason = response.stop_reason || 'unknown';
      analysis.hasContent = Array.isArray(response.content) && response.content.length > 0;
      
      if (analysis.hasContent) {
        const textContent = response.content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join(' ');
        
        analysis.contentLength = textContent.length;
        analysis.contentPreview = textContent.substring(0, 200);
        analysis.hasToolCalls = response.content.some((block: any) => block.type === 'tool_use');
        
        if (analysis.hasContent && !analysis.hasToolCalls) {
          analysis.toolCallPatterns = this.detectToolCallPatterns(textContent);
        }
      }
    }

    return analysis;
  }

  /**
   * 检测文本内容中的工具调用模式
   */
  private detectToolCallPatterns(content: string): string[] {
    const patterns = [
      { name: 'function_call', regex: /function_call\s*\(/gi },
      { name: 'tool_call', regex: /tool_call\s*\(/gi },
      { name: 'json_function', regex: /\{\s*"name"\s*:\s*"[\w_]+"/gi },
      { name: 'search_call', regex: /search\s*\(/gi },
      { name: 'generate_call', regex: /generate\s*\(/gi },
      { name: 'action_format', regex: /Action:\s*[\w_]+/gi },
      { name: 'tool_use_block', regex: /<tool_use>/gi }
    ];

    const foundPatterns: string[] = [];
    
    patterns.forEach(pattern => {
      if (pattern.regex.test(content)) {
        foundPatterns.push(pattern.name);
      }
    });

    return foundPatterns;
  }

  /**
   * 分析响应结构
   */
  private analyzeStructure(response: any): any {
    if (!response || typeof response !== 'object') {
      return { type: typeof response, structure: 'primitive' };
    }

    const structure: any = {
      type: 'object',
      keys: Object.keys(response),
      hasChoices: !!response.choices,
      hasContent: !!response.content,
      hasUsage: !!response.usage
    };

    if (response.choices && Array.isArray(response.choices)) {
      structure.choicesCount = response.choices.length;
      if (response.choices[0]) {
        structure.firstChoice = {
          hasMessage: !!response.choices[0].message,
          hasToolCalls: !!(response.choices[0].message?.tool_calls?.length),
          finishReason: response.choices[0].finish_reason
        };
      }
    }

    return structure;
  }

  /**
   * 清理响应内容（移除敏感信息）
   */
  private sanitizeResponse(response: any): any {
    if (!response) return response;
    
    // 创建深拷贝
    const sanitized = JSON.parse(JSON.stringify(response));
    
    // 限制内容长度以节省存储空间
    if (sanitized?.choices?.[0]?.message?.content) {
      const content = sanitized.choices[0].message.content;
      if (content.length > 1000) {
        sanitized.choices[0].message.content = content.substring(0, 1000) + '... [truncated]';
      }
    }
    
    return sanitized;
  }

  /**
   * 加载现有的失败记录
   */
  private loadExistingFailures(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf8');
        this.failures = JSON.parse(data);
        
        // 🔧 安全调用logger：如果logger未初始化则使用console
        this.safeLog('debug', 'Loaded existing tool parsing failure records', {
          recordCount: this.failures.length,
          dbPath: this.dbPath
        });
      }
    } catch (error) {
      // 🔧 安全调用logger：如果logger未初始化则使用console
      this.safeLog('error', 'Failed to load tool parsing failure records', error);
      this.failures = [];
    }
  }

  /**
   * 安全的日志记录 - 如果logger未初始化则降级使用console
   */
  private safeLog(level: 'debug' | 'error', message: string, data?: any): void {
    try {
      if (level === 'debug') {
        logger.debug(message, data);
      } else {
        logger.error(message, data);
      }
    } catch {
      // Logger未初始化，降级使用console
      if (level === 'debug') {
        console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
      } else {
        console.error(`[ERROR] ${message}`, data);
      }
    }
  }

  /**
   * 保存失败记录到文件
   */
  private async saveFailures(): Promise<void> {
    try {
      // 确保目录存在
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 保存到文件
      fs.writeFileSync(this.dbPath, JSON.stringify(this.failures, null, 2), 'utf8');
      
      // 🔧 安全调用logger
      this.safeLog('debug', 'Saved tool parsing failure records', {
        recordCount: this.failures.length,
        dbPath: this.dbPath
      });
    } catch (error) {
      // 🔧 安全调用logger
      this.safeLog('error', 'Failed to save tool parsing failure records', error);
    }
  }

  /**
   * 获取失败统计信息
   */
  getStats(): {
    totalFailures: number;
    recentFailures: number; // 最近24小时
    failuresByType: Record<string, number>;
    failuresByProvider: Record<string, number>;
    topFailedModels: Array<{ model: string; count: number }>;
  } {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentFailures = this.failures.filter(f => 
      new Date(f.timestamp) > oneDayAgo
    );

    const failuresByType: Record<string, number> = {};
    const failuresByProvider: Record<string, number> = {};
    const modelCounts: Record<string, number> = {};

    this.failures.forEach(failure => {
      failuresByType[failure.failureType] = (failuresByType[failure.failureType] || 0) + 1;
      failuresByProvider[failure.provider] = (failuresByProvider[failure.provider] || 0) + 1;
      modelCounts[failure.model] = (modelCounts[failure.model] || 0) + 1;
    });

    const topFailedModels = Object.entries(modelCounts)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalFailures: this.failures.length,
      recentFailures: recentFailures.length,
      failuresByType,
      failuresByProvider,
      topFailedModels
    };
  }

  /**
   * 获取特定provider的失败记录
   */
  getFailuresForProvider(provider: string, limit: number = 50): ToolParsingFailure[] {
    return this.failures
      .filter(f => f.provider === provider)
      .slice(0, limit);
  }

  /**
   * 获取最近的失败记录
   */
  getRecentFailures(hours: number = 24, limit: number = 100): ToolParsingFailure[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.failures
      .filter(f => new Date(f.timestamp) > cutoff)
      .slice(0, limit);
  }

  /**
   * 清理旧记录
   */
  cleanup(olderThanDays: number = 30): void {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const originalCount = this.failures.length;
    
    this.failures = this.failures.filter(f => new Date(f.timestamp) > cutoff);
    
    if (this.failures.length !== originalCount) {
      this.saveFailures();
      logger.info('Cleaned up old tool parsing failure records', {
        removed: originalCount - this.failures.length,
        remaining: this.failures.length
      });
    }
  }
}

// 🔧 修复过早初始化：延迟初始化全局单例
let _globalInstance: ToolParsingFailureLogger | null = null;

/**
 * 获取全局单例实例 - 延迟初始化避免过早调用logger
 */
export function getToolParsingFailureLogger(): ToolParsingFailureLogger {
  if (!_globalInstance) {
    _globalInstance = new ToolParsingFailureLogger();
  }
  return _globalInstance;
}

// 兼容旧的导出方式
export const toolParsingFailureLogger = {
  get instance() {
    return getToolParsingFailureLogger();
  }
};

export default ToolParsingFailureLogger;