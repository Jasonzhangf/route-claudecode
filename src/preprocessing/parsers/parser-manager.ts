/**
 * 格式解析器管理器
 * 统一管理所有格式解析器，提供自动格式检测和解析
 */

import { BaseFormatParser, ParseResult, ParsingContext } from './base-parser';
// import { AnthropicFormatParser } from './anthropic-parser';
import { OpenAIFormatParser } from './openai-parser';
import { GeminiFormatParser } from './gemini-parser';

export interface ParserManagerConfig {
  enabledParsers: string[];
  fallbackParser?: string;
  strictMode: boolean; // 严格模式：不允许任何fallback
  debugMode: boolean;
}

export class FormatParserManager {
  private parsers: Map<string, BaseFormatParser> = new Map();
  private config: ParserManagerConfig;

  constructor(config?: Partial<ParserManagerConfig>) {
    this.config = {
      enabledParsers: ['anthropic', 'openai', 'gemini'],
      strictMode: true, // 默认启用严格模式
      debugMode: process.env.RCC_PARSER_DEBUG === 'true',
      ...config
    };

    // 🚨 强制严格模式，不允许配置覆盖
    this.config.strictMode = true;
    this.config.fallbackParser = undefined; // 强制移除fallback

    this.initializeParsers();
  }

  /**
   * 初始化所有解析器
   */
  private initializeParsers(): void {
    // 注册所有可用的解析器
    const availableParsers = {
      // anthropic: () => new AnthropicFormatParser(),
      openai: () => new OpenAIFormatParser(),
      gemini: () => new GeminiFormatParser()
    };

    for (const parserName of this.config.enabledParsers) {
      if (availableParsers[parserName as keyof typeof availableParsers]) {
        try {
          const parser = availableParsers[parserName as keyof typeof availableParsers]();
          this.parsers.set(parserName, parser);
          
          if (this.config.debugMode) {
            console.log(`✅ [PARSER-MANAGER] Registered parser: ${parserName}`);
          }
        } catch (error) {
          console.error(`❌ [PARSER-MANAGER] Failed to register parser: ${parserName}`, {
            error: error instanceof Error ? error.message : String(error)
          });
          
          // 严格模式下，解析器注册失败应该抛出错误
          if (this.config.strictMode) {
            throw new Error(`Failed to register parser ${parserName}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      } else {
        const error = `Unknown parser: ${parserName}`;
        console.error(`❌ [PARSER-MANAGER] ${error}`);
        
        if (this.config.strictMode) {
          throw new Error(error);
        }
      }
    }

    if (this.parsers.size === 0) {
      throw new Error('No parsers registered - system cannot function');
    }

    console.log(`🎯 [PARSER-MANAGER] Initialized with ${this.parsers.size} parsers:`, 
      Array.from(this.parsers.keys())
    );
  }

  /**
   * 自动检测格式并解析工具调用
   */
  parseToolCalls(data: any, context: ParsingContext): ParseResult {
    if (!data) {
      throw new Error('Data is null or undefined - cannot parse tool calls');
    }

    const detectedParser = this.detectFormat(data, context);
    
    if (!detectedParser) {
      // 严格模式下不允许无法检测格式
      if (this.config.strictMode) {
        throw new Error(`Unable to detect format for data - no parser can handle this format. Available parsers: ${Array.from(this.parsers.keys()).join(', ')}`);
      }
      
      // 非严格模式返回空结果（但我们强制使用严格模式）
      return {
        hasTools: false,
        toolCount: 0,
        toolCalls: [],
        confidence: 0
      };
    }

    if (this.config.debugMode) {
      console.log(`🎯 [PARSER-MANAGER] Using parser: ${detectedParser.constructor.name}`, {
        requestId: context.requestId
      });
    }

    try {
      const result = detectedParser.parseToolCalls(data, context);
      
      // 验证解析结果
      if (!result) {
        throw new Error(`Parser ${detectedParser.constructor.name} returned null result`);
      }

      return result;
    } catch (error) {
      console.error(`❌ [PARSER-MANAGER] Parser ${detectedParser.constructor.name} failed:`, {
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId
      });
      
      // 严格模式下解析失败应该抛出错误
      if (this.config.strictMode) {
        throw error;
      }
      
      // 非严格模式返回空结果（但我们强制使用严格模式）
      return {
        hasTools: false,
        toolCount: 0,
        toolCalls: [],
        confidence: 0
      };
    }
  }

  /**
   * 获取finish reason
   */
  getFinishReason(data: any, context: ParsingContext): string | undefined {
    if (!data) {
      return undefined;
    }

    const detectedParser = this.detectFormat(data, context);
    
    if (!detectedParser) {
      if (this.config.strictMode) {
        throw new Error('Unable to detect format for finish reason extraction');
      }
      return undefined;
    }

    try {
      return detectedParser.getFinishReason(data, context);
    } catch (error) {
      console.error(`❌ [PARSER-MANAGER] Failed to get finish reason:`, {
        parser: detectedParser.constructor.name,
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId
      });
      
      if (this.config.strictMode) {
        throw error;
      }
      
      return undefined;
    }
  }

  /**
   * 修复finish reason
   */
  fixFinishReason(data: any, targetReason: string, context: ParsingContext): any {
    if (!data) {
      throw new Error('Data is null or undefined - cannot fix finish reason');
    }

    if (!targetReason) {
      throw new Error('Target reason is required - violates zero fallback principle');
    }

    const detectedParser = this.detectFormat(data, context);
    
    if (!detectedParser) {
      throw new Error('Unable to detect format for finish reason fixing');
    }

    try {
      return detectedParser.fixFinishReason(data, targetReason, context);
    } catch (error) {
      console.error(`❌ [PARSER-MANAGER] Failed to fix finish reason:`, {
        parser: detectedParser.constructor.name,
        targetReason,
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId
      });
      
      throw error; // 修复失败必须抛出错误
    }
  }

  /**
   * 自动检测数据格式
   */
  private detectFormat(data: any, context: ParsingContext): BaseFormatParser | null {
    const detectionResults: Array<{ parser: BaseFormatParser; canParse: boolean; name: string }> = [];

    // 测试所有解析器
    for (const [name, parser] of this.parsers.entries()) {
      try {
        const canParse = parser.canParse(data, context);
        detectionResults.push({ parser, canParse, name });
        
        if (this.config.debugMode) {
          console.log(`🔍 [PARSER-MANAGER] ${name} parser detection: ${canParse}`, {
            requestId: context.requestId
          });
        }
      } catch (error) {
        console.warn(`⚠️ [PARSER-MANAGER] ${name} parser detection failed:`, {
          error: error instanceof Error ? error.message : String(error),
          requestId: context.requestId
        });
        detectionResults.push({ parser, canParse: false, name });
      }
    }

    // 找到能够解析的解析器
    const capableParsers = detectionResults.filter(result => result.canParse);

    if (capableParsers.length === 0) {
      console.warn(`⚠️ [PARSER-MANAGER] No parser can handle this format`, {
        availableParsers: Array.from(this.parsers.keys()),
        requestId: context.requestId,
        dataKeys: typeof data === 'object' ? Object.keys(data) : 'not-object'
      });
      return null;
    }

    if (capableParsers.length > 1) {
      console.warn(`⚠️ [PARSER-MANAGER] Multiple parsers can handle this format:`, {
        parsers: capableParsers.map(p => p.name),
        requestId: context.requestId
      });
      
      // 使用第一个匹配的解析器
      return capableParsers[0].parser;
    }

    // 只有一个解析器匹配，使用它
    const selectedParser = capableParsers[0];
    
    if (this.config.debugMode) {
      console.log(`✅ [PARSER-MANAGER] Selected parser: ${selectedParser.name}`, {
        requestId: context.requestId
      });
    }

    return selectedParser.parser;
  }

  /**
   * 获取所有注册的解析器
   */
  getRegisteredParsers(): string[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * 获取解析器统计信息
   */
  getStats(): {
    totalParsers: number;
    enabledParsers: string[];
    config: ParserManagerConfig;
  } {
    return {
      totalParsers: this.parsers.size,
      enabledParsers: Array.from(this.parsers.keys()),
      config: this.config
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ParserManagerConfig>): void {
    // 保护关键配置不被覆盖
    const protectedConfig = {
      ...this.config,
      ...newConfig,
      strictMode: true, // 强制严格模式
      fallbackParser: undefined // 强制移除fallback
    };

    this.config = protectedConfig;
    
    console.log(`🔧 [PARSER-MANAGER] Config updated`, {
      newConfig: protectedConfig
    });
  }
}

// 单例模式：全局解析器管理器实例
let globalParserManager: FormatParserManager | null = null;

/**
 * 获取全局解析器管理器实例
 */
export function getParserManager(config?: Partial<ParserManagerConfig>): FormatParserManager {
  if (!globalParserManager) {
    globalParserManager = new FormatParserManager(config);
  }
  
  return globalParserManager;
}

/**
 * 重置全局解析器管理器
 */
export function resetParserManager(): void {
  globalParserManager = null;
}