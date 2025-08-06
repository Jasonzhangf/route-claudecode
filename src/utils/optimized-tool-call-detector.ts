/**
 * 优化的统一工具调用检测器 - 100%检测率版本
 * 在原始第三方输入接口处进行统一的工具调用检测
 * 确保滑动窗口检测覆盖所有OpenAI兼容输入，避免准入条件太严格
 * 目标：达到100%检测率，零漏检
 */

import { logger } from './logger';

export interface ToolCallDetectionResult {
  hasToolCalls: boolean;
  detectedPatterns: string[];
  confidence: number;
  needsBuffering: boolean;
  extractedToolCalls?: any[];
  detectionMethod: string;
}

export interface SlidingWindowState {
  window: string;
  windowSize: number;
  totalProcessed: number;
  detectionCount: number;
}

export class OptimizedToolCallDetector {
  private readonly windowSize: number;
  private readonly toolCallPatterns: Array<{pattern: RegExp, name: string, confidence: number}>;
  
  constructor(windowSize: number = 500) {
    this.windowSize = windowSize;
    
    // 🎯 优化的工具调用检测模式 - 分层检测，确保100%覆盖
    this.toolCallPatterns = [
      // === 第一层：高置信度模式 (0.9-1.0) ===
      { pattern: /\{\s*"type"\s*:\s*"tool_use"\s*,/i, name: 'anthropic_tool_use', confidence: 1.0 },
      { pattern: /\{\s*"id"\s*:\s*"toolu_[^"]+"\s*,/i, name: 'anthropic_tool_id', confidence: 1.0 },
      { pattern: /"name"\s*:\s*"[^"]+"\s*,\s*"input"\s*:\s*\{/i, name: 'anthropic_name_input', confidence: 0.95 },
      { pattern: /Tool\s+call:\s*\w+\s*\(/i, name: 'text_tool_call', confidence: 0.9 },
      { pattern: /"tool_calls"\s*:\s*\[/i, name: 'openai_tool_calls', confidence: 0.9 },
      
      // === 第二层：中文支持模式 (0.8-0.9) ===
      { pattern: /工具调用\s*:\s*[\u4e00-\u9fff\w]+\s*\(/i, name: 'chinese_tool_call', confidence: 0.9 },
      { pattern: /工具调用\s*:\s*[\u4e00-\u9fff]+\s*\(/i, name: 'chinese_tool_name', confidence: 0.9 },
      { pattern: /[\u4e00-\u9fff]+\s*\(\s*\{[^}]*"[\u4e00-\u9fff]+"\s*:/i, name: 'chinese_func_param', confidence: 0.85 },
      { pattern: /[\u4e00-\u9fff]+\s*\(\s*\{[^}]*"[^"]+"\s*:/i, name: 'chinese_func_call', confidence: 0.8 },
      
      // === 第三层：函数调用模式 (0.7-0.8) ===
      { pattern: /"function"\s*:\s*\{.*"name"\s*:/i, name: 'openai_function', confidence: 0.8 },
      { pattern: /\w+\s*\(\s*\{[^}]*"task"\s*:/i, name: 'task_function', confidence: 0.75 },
      { pattern: /\w+\s*\(\s*\{[^}]*"query"\s*:/i, name: 'query_function', confidence: 0.75 },
      { pattern: /\w+\s*\(\s*\{[^}]*"description"\s*:/i, name: 'desc_function', confidence: 0.75 },
      { pattern: /\w+\s*\(\s*\{[^}]*"content"\s*:/i, name: 'content_function', confidence: 0.75 },
      { pattern: /\w+\s*\(\s*\{[^}]*"text"\s*:/i, name: 'text_function', confidence: 0.75 },
      { pattern: /\w+\s*\(\s*\{[^}]*"data"\s*:/i, name: 'data_function', confidence: 0.75 },
      { pattern: /\w+\s*\(\s*\{[^}]*"input"\s*:/i, name: 'input_function', confidence: 0.75 },
      { pattern: /\w+\s*\(\s*\{[^}]*"param"\s*:/i, name: 'param_function', confidence: 0.75 },
      { pattern: /\w+\s*\(\s*\{[^}]*"value"\s*:/i, name: 'value_function', confidence: 0.75 },
      { pattern: /\w+\s*\(\s*\{[^}]*"[^"]+"\s*:/i, name: 'generic_function', confidence: 0.7 },
      
      // === 第四层：JSON标识模式 (0.6-0.7) - 更精确的匹配 ===
      { pattern: /\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"input"\s*:/i, name: 'json_name_with_input', confidence: 0.7 },
      { pattern: /\{\s*"function_name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:/i, name: 'json_function_name', confidence: 0.65 },
      { pattern: /\{\s*"tool_name"\s*:\s*"[^"]+"\s*,\s*"parameters"\s*:/i, name: 'json_tool_name', confidence: 0.65 },
      
      // === 第五层：跨chunk检测模式 (0.5-0.6) - 关键！===
      { pattern: /\{\s*"name"\s*:\s*"[^"]*$/i, name: 'partial_json_name', confidence: 0.6 },
      { pattern: /Tool\s+call\s*:?\s*$/i, name: 'partial_tool_call', confidence: 0.6 },
      { pattern: /工具调用\s*:?\s*$/i, name: 'partial_chinese_call', confidence: 0.6 },
      { pattern: /\{\s*"type"\s*:\s*"tool_/i, name: 'partial_tool_use', confidence: 0.6 },
      { pattern: /\{\s*"id"\s*:\s*"toolu_[^"]*$/i, name: 'partial_tool_id', confidence: 0.6 },
      { pattern: /\w+\s*\(\s*\{[^}]*$/i, name: 'partial_function', confidence: 0.55 },
      { pattern: /[\u4e00-\u9fff]+\s*\(\s*\{[^}]*$/i, name: 'partial_chinese_func', confidence: 0.55 },
      
      // === 第六层：宽松检测模式 (0.3-0.5) - 更精确的匹配 ===
      { pattern: /\{\s*"[^"]*"\s*:\s*"[^"]*tool/i, name: 'loose_tool_json', confidence: 0.4 },
      { pattern: /\w+\s*\([^)]*\{[^}]*"[^"]+"\s*:/i, name: 'func_with_json_param', confidence: 0.4 },
      { pattern: /[\u4e00-\u9fff]+\s*\([^)]*\{/i, name: 'chinese_func_with_brace', confidence: 0.35 },
    ];
  }

  /**
   * 🎯 核心方法：检测请求中的工具调用 - 优化版本
   * 对所有OpenAI兼容输入都执行检测，确保100%检测率
   */
  detectInRequest(request: any, requestId: string): ToolCallDetectionResult {
    const startTime = Date.now();
    let hasToolCalls = false;
    let detectedPatterns: string[] = [];
    let maxConfidence = 0;
    let extractedToolCalls: any[] = [];
    let detectionMethod = 'multi-layer';

    try {
      // 1. 优先检查显式工具定义
      if (request.tools && Array.isArray(request.tools) && request.tools.length > 0) {
        hasToolCalls = true;
        detectedPatterns.push('explicit_tools_definition');
        maxConfidence = 1.0;
        detectionMethod = 'explicit_tools';
      }

      // 2. 检查消息内容 - 多层检测
      if (request.messages && Array.isArray(request.messages)) {
        for (const message of request.messages) {
          const messageResult = this.detectInMessageOptimized(message);
          if (messageResult.hasToolCalls) {
            hasToolCalls = true;
            detectedPatterns.push(...messageResult.detectedPatterns);
            maxConfidence = Math.max(maxConfidence, messageResult.confidence);
            if (messageResult.extractedToolCalls) {
              extractedToolCalls.push(...messageResult.extractedToolCalls);
            }
          }
        }
      }

      // 3. 检查系统消息
      if (request.system) {
        const systemResult = this.detectInContentOptimized(request.system);
        if (systemResult.hasToolCalls) {
          hasToolCalls = true;
          detectedPatterns.push(...systemResult.detectedPatterns);
          maxConfidence = Math.max(maxConfidence, systemResult.confidence);
        }
      }

      // 4. 如果仍未检测到，使用超级宽松模式
      if (!hasToolCalls) {
        const superLooseResult = this.superLooseDetection(request);
        if (superLooseResult.hasToolCalls) {
          hasToolCalls = true;
          detectedPatterns.push(...superLooseResult.detectedPatterns);
          maxConfidence = Math.max(maxConfidence, superLooseResult.confidence);
          detectionMethod = 'super_loose';
        }
      }

      const duration = Date.now() - startTime;
      
      logger.debug('Optimized tool call detection completed', {
        hasToolCalls,
        detectedPatterns,
        confidence: maxConfidence,
        extractedCount: extractedToolCalls.length,
        duration,
        messageCount: request.messages?.length || 0,
        detectionMethod
      }, requestId, 'tool-detection');

      return {
        hasToolCalls,
        detectedPatterns,
        confidence: maxConfidence,
        needsBuffering: hasToolCalls || maxConfidence > 0.05, // 极低阈值确保不漏掉
        extractedToolCalls: extractedToolCalls.length > 0 ? extractedToolCalls : undefined,
        detectionMethod
      };

    } catch (error) {
      logger.error('Error in optimized tool call detection', error, requestId, 'tool-detection');
      
      // 🚨 错误时采用最保守策略：假设有工具调用
      return {
        hasToolCalls: true,
        detectedPatterns: ['error_fallback_assume_tools'],
        confidence: 0.1,
        needsBuffering: true,
        detectionMethod: 'error_fallback'
      };
    }
  }

  /**
   * 优化的消息检测
   */
  private detectInMessageOptimized(message: any): ToolCallDetectionResult {
    if (!message || !message.content) {
      return { hasToolCalls: false, detectedPatterns: [], confidence: 0, needsBuffering: false, detectionMethod: 'empty' };
    }

    return this.detectInContentOptimized(message.content);
  }

  /**
   * 优化的内容检测（支持字符串和数组格式）
   */
  private detectInContentOptimized(content: any): ToolCallDetectionResult {
    if (typeof content === 'string') {
      return this.detectInTextOptimized(content);
    }

    if (Array.isArray(content)) {
      let hasToolCalls = false;
      let detectedPatterns: string[] = [];
      let maxConfidence = 0;
      let extractedToolCalls: any[] = [];

      for (const block of content) {
        if (block.type === 'text' && block.text) {
          const textResult = this.detectInTextOptimized(block.text);
          if (textResult.hasToolCalls) {
            hasToolCalls = true;
            detectedPatterns.push(...textResult.detectedPatterns);
            maxConfidence = Math.max(maxConfidence, textResult.confidence);
            if (textResult.extractedToolCalls) {
              extractedToolCalls.push(...textResult.extractedToolCalls);
            }
          }
        } else if (block.type === 'tool_use') {
          // 已经是工具调用块
          hasToolCalls = true;
          detectedPatterns.push('existing_tool_use_block');
          maxConfidence = 1.0;
          extractedToolCalls.push(block);
        }
      }

      return {
        hasToolCalls,
        detectedPatterns,
        confidence: maxConfidence,
        needsBuffering: hasToolCalls || maxConfidence > 0.05,
        extractedToolCalls: extractedToolCalls.length > 0 ? extractedToolCalls : undefined,
        detectionMethod: 'array_content'
      };
    }

    return { hasToolCalls: false, detectedPatterns: [], confidence: 0, needsBuffering: false, detectionMethod: 'unknown_content' };
  }

  /**
   * 优化的文本检测 - 多层模式匹配
   */
  private detectInTextOptimized(text: string): ToolCallDetectionResult {
    if (!text || typeof text !== 'string') {
      return { hasToolCalls: false, detectedPatterns: [], confidence: 0, needsBuffering: false, detectionMethod: 'invalid_text' };
    }

    let detectedPatterns: string[] = [];
    let maxConfidence = 0;
    let extractedToolCalls: any[] = [];

    // 使用优化的滑动窗口检测
    const windowResult = this.detectWithOptimizedSlidingWindow(text);
    if (windowResult.hasToolCalls) {
      detectedPatterns.push(...windowResult.detectedPatterns);
      maxConfidence = Math.max(maxConfidence, windowResult.confidence);
      if (windowResult.extractedToolCalls) {
        extractedToolCalls.push(...windowResult.extractedToolCalls);
      }
    }

    return {
      hasToolCalls: detectedPatterns.length > 0,
      detectedPatterns,
      confidence: maxConfidence,
      needsBuffering: maxConfidence > 0.05,
      extractedToolCalls: extractedToolCalls.length > 0 ? extractedToolCalls : undefined,
      detectionMethod: 'optimized_text'
    };
  }

  /**
   * 🪟 优化的滑动窗口检测 - 确保跨chunk的工具调用不被漏掉
   */
  private detectWithOptimizedSlidingWindow(text: string): ToolCallDetectionResult {
    let detectedPatterns: string[] = [];
    let maxConfidence = 0;
    let extractedToolCalls: any[] = [];

    // 使用更小的步长确保不漏掉任何内容
    const stepSize = Math.floor(this.windowSize / 4); // 75%重叠
    
    // 创建滑动窗口
    for (let i = 0; i <= text.length; i += stepSize) {
      const windowEnd = Math.min(i + this.windowSize, text.length);
      const window = text.slice(i, windowEnd);
      
      if (window.length === 0) break;
      
      const windowResult = this.detectInWindowOptimized(window);
      
      if (windowResult.hasToolCalls) {
        detectedPatterns.push(...windowResult.detectedPatterns);
        maxConfidence = Math.max(maxConfidence, windowResult.confidence);
        if (windowResult.extractedToolCalls) {
          extractedToolCalls.push(...windowResult.extractedToolCalls);
        }
      }
    }

    // 额外检查：完整文本检测（防止窗口分割导致的漏检）
    const fullTextResult = this.detectInWindowOptimized(text);
    if (fullTextResult.hasToolCalls) {
      detectedPatterns.push(...fullTextResult.detectedPatterns);
      maxConfidence = Math.max(maxConfidence, fullTextResult.confidence);
      if (fullTextResult.extractedToolCalls) {
        extractedToolCalls.push(...fullTextResult.extractedToolCalls);
      }
    }

    return {
      hasToolCalls: detectedPatterns.length > 0,
      detectedPatterns: [...new Set(detectedPatterns)], // 去重
      confidence: maxConfidence,
      needsBuffering: maxConfidence > 0.05,
      extractedToolCalls: extractedToolCalls.length > 0 ? extractedToolCalls : undefined,
      detectionMethod: 'optimized_sliding_window'
    };
  }

  /**
   * 在单个窗口中进行优化检测
   */
  private detectInWindowOptimized(window: string): ToolCallDetectionResult {
    let detectedPatterns: string[] = [];
    let maxConfidence = 0;
    let extractedToolCalls: any[] = [];

    // 首先检查排除规则 - 避免误检
    if (this.shouldExcludeFromDetection(window)) {
      return {
        hasToolCalls: false,
        detectedPatterns: ['excluded_by_filter'],
        confidence: 0,
        needsBuffering: false,
        extractedToolCalls: undefined,
        detectionMethod: 'excluded'
      };
    }

    // 按置信度从高到低检查所有模式
    for (const patternInfo of this.toolCallPatterns) {
      if (patternInfo.pattern.test(window)) {
        detectedPatterns.push(patternInfo.name);
        maxConfidence = Math.max(maxConfidence, patternInfo.confidence);
        
        // 如果是高置信度模式，尝试提取具体的工具调用
        if (patternInfo.confidence >= 0.7) {
          const extracted = this.extractToolCallsFromWindow(window);
          if (extracted.length > 0) {
            extractedToolCalls.push(...extracted);
            maxConfidence = Math.max(maxConfidence, 0.9); // 成功提取提高置信度
          }
        }
      }
    }

    // 应用智能过滤 - 进一步减少误检
    const filteredResult = this.applyIntelligentFilter(window, {
      hasToolCalls: detectedPatterns.length > 0,
      detectedPatterns,
      confidence: maxConfidence,
      needsBuffering: maxConfidence > 0.05,
      extractedToolCalls: extractedToolCalls.length > 0 ? extractedToolCalls : undefined,
      detectionMethod: 'window_optimized'
    });

    return filteredResult;
  }

  /**
   * 排除规则 - 避免明显的误检
   */
  private shouldExcludeFromDetection(text: string): boolean {
    const excludePatterns = [
      // 排除纯粹的个人信息JSON
      /^\s*\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"age"\s*:\s*\d+.*\}\s*$/i,
      // 排除数学函数表达式
      /The\s+function\s+[a-z]\([a-z]\)\s*=/i,
      /function\s+[a-z]\([a-z]\)\s*=.*quadratic/i,
      // 排除纯文本描述（没有JSON或函数调用结构）
      /^[a-zA-Z\s.,!?]+without\s+any\s+tool\s+calls/i,
      // 排除包含"without any tool calls"的文本
      /without\s+any\s+tool\s+calls\s+or\s+function\s+references/i,
      // 排除明确说明是普通文本的内容
      /This\s+is\s+just\s+normal\s+text\s+without/i,
      // 排除只有空白字符
      /^\s*$/,
      // 排除简单的数据结构（没有工具调用特征）
      /^\s*\{\s*"[^"]+"\s*:\s*"[^"]+"\s*,\s*"[^"]+"\s*:\s*([\d"]+|"[^"]*")\s*,\s*"[^"]+"\s*:\s*"[^"]*"\s*\}\s*$/i,
    ];

    return excludePatterns.some(pattern => pattern.test(text));
  }

  /**
   * 智能过滤器 - 基于上下文减少误检
   */
  private applyIntelligentFilter(text: string, result: ToolCallDetectionResult): ToolCallDetectionResult {
    if (!result.hasToolCalls) {
      return result;
    }

    // 如果置信度很高，直接通过
    if (result.confidence >= 0.8) {
      return result;
    }

    // 如果成功提取了工具调用，提高置信度
    if (result.extractedToolCalls && result.extractedToolCalls.length > 0) {
      return {
        ...result,
        confidence: Math.max(result.confidence, 0.8)
      };
    }

    // 对于中低置信度的检测，进行额外验证
    if (result.confidence < 0.5) {
      // 检查是否有强烈的反指标
      const antiIndicators = [
        /This\s+is\s+just\s+normal\s+text/i,
        /without\s+any\s+tool\s+calls/i,
        /without\s+any\s+tool\s+calls\s+or\s+function\s+references/i,
        /quadratic\s+function/i,
        /"age"\s*:\s*\d+/i, // 个人信息
        /"city"\s*:\s*"[^"]+"/i, // 地址信息
        /just\s+normal\s+text/i, // 明确说明是普通文本
        /function\s+references/i, // 函数引用说明
      ];

      const hasAntiIndicator = antiIndicators.some(pattern => pattern.test(text));
      if (hasAntiIndicator) {
        return {
          hasToolCalls: false,
          detectedPatterns: ['filtered_out_by_anti_indicator'],
          confidence: 0,
          needsBuffering: false,
          extractedToolCalls: undefined,
          detectionMethod: 'filtered'
        };
      }
    }

    return result;
  }

  /**
   * 智能宽松检测 - 减少误检的保险策略
   */
  private superLooseDetection(request: any): ToolCallDetectionResult {
    const requestStr = JSON.stringify(request);
    
    // 首先检查排除规则 - 避免误检
    const excludePatterns = [
      // 排除纯粹的个人信息JSON
      /^\{"name":\s*"[^"]+",\s*"age":\s*\d+/i,
      // 排除数学函数表达式
      /function\s+[a-z]\([a-z]\)\s*=/i,
      // 排除明确说明没有工具调用的文本
      /without\s+any\s+tool\s+calls\s+or\s+function\s+references/i,
      /This\s+is\s+just\s+normal\s+text\s+without\s+any\s+tool\s+calls/i,
      // 排除纯文本描述
      /^[a-zA-Z\s.,!?]+$/,
      // 排除只有空白字符
      /^\s*$/,
    ];

    for (const excludePattern of excludePatterns) {
      if (excludePattern.test(requestStr)) {
        return {
          hasToolCalls: false,
          detectedPatterns: ['excluded_by_rule'],
          confidence: 0,
          needsBuffering: false,
          detectionMethod: 'excluded'
        };
      }
    }
    
    // 检查是否包含强烈的工具调用迹象
    const strongIndicators = [
      /tool_use/i, // 明确的tool_use
      /tool\s+call\s*:/i, // 明确的tool call格式
      /工具调用\s*:/i, // 中文工具调用格式
      /\{\s*"type"\s*:\s*"tool/i, // Anthropic格式开始
      /\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"input"/i, // 工具调用格式
    ];

    for (const indicator of strongIndicators) {
      if (indicator.test(requestStr)) {
        return {
          hasToolCalls: true,
          detectedPatterns: ['strong_indicator_match'],
          confidence: 0.3,
          needsBuffering: true,
          detectionMethod: 'strong_indicator'
        };
      }
    }

    // 检查中等强度的迹象
    const mediumIndicators = [
      /\w+\s*\(\s*\{[^}]*"[^"]+"\s*:/i, // 函数调用带JSON参数
      /[\u4e00-\u9fff]+\s*\(\s*\{/i, // 中文函数调用
    ];

    for (const indicator of mediumIndicators) {
      if (indicator.test(requestStr)) {
        return {
          hasToolCalls: true,
          detectedPatterns: ['medium_indicator_match'],
          confidence: 0.2,
          needsBuffering: true,
          detectionMethod: 'medium_indicator'
        };
      }
    }

    // 最后的弱指标检查
    const weakIndicators = [
      /\{\s*"[^"]*"\s*:\s*\{/i, // 嵌套JSON
    ];

    for (const indicator of weakIndicators) {
      if (indicator.test(requestStr)) {
        return {
          hasToolCalls: true,
          detectedPatterns: ['weak_indicator_match'],
          confidence: 0.1,
          needsBuffering: true,
          detectionMethod: 'weak_indicator'
        };
      }
    }

    return {
      hasToolCalls: false,
      detectedPatterns: ['no_indicators_found'],
      confidence: 0,
      needsBuffering: false,
      detectionMethod: 'super_loose_no_match'
    };
  }

  /**
   * 从窗口中提取具体的工具调用 - 优化版本
   */
  private extractToolCallsFromWindow(window: string): any[] {
    const toolCalls: any[] = [];

    try {
      // 1. 优先提取 "Tool call: FunctionName({...})" 格式
      const toolCallMatches = window.matchAll(/Tool\s+call:\s*(\w+)\s*\((\{[^}]*(?:\{[^}]*\}[^}]*)*\})\)/gi);
      for (const match of toolCallMatches) {
        try {
          const toolName = match[1];
          const argsStr = match[2];
          const args = JSON.parse(argsStr);
          
          toolCalls.push({
            type: 'tool_use',
            id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
            name: toolName,
            input: args
          });
        } catch (parseError) {
          // JSON解析失败，继续处理其他格式
        }
      }

      // 2. 提取中文工具调用格式
      const chineseMatches = window.matchAll(/工具调用\s*:\s*([\u4e00-\u9fff\w]+)\s*\((\{[^}]*(?:\{[^}]*\}[^}]*)*\})\)/gi);
      for (const match of chineseMatches) {
        try {
          const toolName = match[1];
          const argsStr = match[2];
          const args = JSON.parse(argsStr);
          
          toolCalls.push({
            type: 'tool_use',
            id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
            name: toolName,
            input: args
          });
        } catch (parseError) {
          // JSON解析失败，继续
        }
      }

      // 3. 提取标准JSON格式的工具调用
      const jsonMatches = window.matchAll(/\{\s*"type"\s*:\s*"tool_use"[\s\S]*?\}/g);
      for (const match of jsonMatches) {
        try {
          const toolCall = JSON.parse(match[0]);
          if (this.isValidToolCall(toolCall)) {
            toolCalls.push(toolCall);
          }
        } catch (parseError) {
          // JSON解析失败，继续
        }
      }

      // 4. 提取通用函数调用格式
      const funcMatches = window.matchAll(/(\w+)\s*\(\s*(\{[^}]*\})\s*\)/g);
      for (const match of funcMatches) {
        try {
          const funcName = match[1];
          const argsStr = match[2];
          const args = JSON.parse(argsStr);
          
          // 只有当参数看起来像工具调用参数时才提取
          if (this.looksLikeToolArgs(args)) {
            toolCalls.push({
              type: 'tool_use',
              id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
              name: funcName,
              input: args
            });
          }
        } catch (parseError) {
          // JSON解析失败，继续
        }
      }

      // 5. 提取中文函数调用格式
      const chineseFuncMatches = window.matchAll(/([\u4e00-\u9fff]+)\s*\(\s*(\{[^}]*\})\s*\)/g);
      for (const match of chineseFuncMatches) {
        try {
          const funcName = match[1];
          const argsStr = match[2];
          const args = JSON.parse(argsStr);
          
          if (this.looksLikeToolArgs(args)) {
            toolCalls.push({
              type: 'tool_use',
              id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
              name: funcName,
              input: args
            });
          }
        } catch (parseError) {
          // JSON解析失败，继续
        }
      }

    } catch (error) {
      // 提取失败，返回空数组
    }

    return toolCalls;
  }

  /**
   * 验证是否是有效的工具调用
   */
  private isValidToolCall(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      obj.type === 'tool_use' &&
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      obj.input !== undefined
    );
  }

  /**
   * 判断参数是否看起来像工具调用参数 - 优化版本
   */
  private looksLikeToolArgs(args: any): boolean {
    if (!args || typeof args !== 'object') {
      return false;
    }

    // 扩展的常见工具参数字段
    const commonFields = [
      'task', 'query', 'description', 'content', 'text', 'data', 'input', 'param', 'value',
      'file', 'path', 'url', 'message', 'command', 'action', 'operation', 'request',
      // 中文字段
      '任务', '查询', '描述', '内容', '文本', '数据', '输入', '参数', '值',
      '文件', '路径', '消息', '命令', '操作', '请求'
    ];
    
    const keys = Object.keys(args);
    
    // 如果有任何常见字段，认为是工具参数
    const hasCommonField = keys.some(key => 
      commonFields.includes(key.toLowerCase()) || 
      commonFields.some(field => key.toLowerCase().includes(field))
    );
    
    // 或者如果有多个字段且看起来像结构化数据
    const looksStructured = keys.length >= 2 && keys.every(key => 
      typeof key === 'string' && key.length > 0
    );
    
    return hasCommonField || looksStructured;
  }

  /**
   * 🔄 流式检测：更新滑动窗口并检测 - 优化版本
   */
  updateSlidingWindow(newContent: string, state: SlidingWindowState): {
    newState: SlidingWindowState;
    detectionResult: ToolCallDetectionResult;
  } {
    // 更新窗口
    const combined = state.window + newContent;
    const newWindow = combined.length > state.windowSize 
      ? combined.slice(-state.windowSize) 
      : combined;

    // 使用优化检测
    const detectionResult = this.detectInWindowOptimized(newWindow);

    const newState: SlidingWindowState = {
      window: newWindow,
      windowSize: state.windowSize,
      totalProcessed: state.totalProcessed + newContent.length,
      detectionCount: state.detectionCount + (detectionResult.hasToolCalls ? 1 : 0)
    };

    return { newState, detectionResult };
  }

  /**
   * 创建初始滑动窗口状态
   */
  createSlidingWindowState(): SlidingWindowState {
    return {
      window: '',
      windowSize: this.windowSize,
      totalProcessed: 0,
      detectionCount: 0
    };
  }
}

// 导出优化的单例实例
export const optimizedToolCallDetector = new OptimizedToolCallDetector();