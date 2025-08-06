/**
 * 统一工具调用检测器
 * 对所有OpenAI兼容输入执行监测，确保滑动窗口检测覆盖所有样本
 */

import { getLogger } from '../logging';
export interface DetectionContext {
  provider: string;
  model: string;
  isStreaming: boolean;
  requestId: string;
}

export interface DetectionResult {
  hasToolCalls: boolean;
  extractedToolCalls: any[];
  cleanedText: string[];
  detectionMethod: string;
  confidence: number;
}

export interface SlidingWindowConfig {
  windowSize: number;
  overlapSize: number;
  minDetectionLength: number;
}

/**
 * 滑动窗口工具调用检测器
 */
export class SlidingWindowDetector {
  private windowConfig: SlidingWindowConfig;
  private logger: ReturnType<typeof getLogger>;

  constructor(config?: Partial<SlidingWindowConfig>, port?: number) {
    this.windowConfig = {
      windowSize: 1000,
      overlapSize: 200,
      minDetectionLength: 10,
      ...config
    };
    this.logger = getLogger(port);
  }

  /**
   * 对文本进行滑动窗口检测
   */
  detectInText(text: string, context: DetectionContext): DetectionResult {
    if (!text || text.length < this.windowConfig.minDetectionLength) {
      return {
        hasToolCalls: false,
        extractedToolCalls: [],
        cleanedText: [text],
        detectionMethod: 'text-too-short',
        confidence: 1.0
      };
    }

    const windows = this.createSlidingWindows(text);
    const allDetections: any[] = [];
    const processedRanges: Array<{start: number, end: number}> = [];

    for (const window of windows) {
      const windowDetection = this.detectInWindow(window.content, window.start, context);
      if (windowDetection.hasToolCalls) {
        // 合并检测结果，避免重复
        for (const toolCall of windowDetection.extractedToolCalls) {
          const adjustedStart = window.start + toolCall.textRange.start;
          const adjustedEnd = window.start + toolCall.textRange.end;
          
          // 检查是否与已处理的范围重叠
          const isOverlapping = processedRanges.some(range => 
            (adjustedStart >= range.start && adjustedStart <= range.end) ||
            (adjustedEnd >= range.start && adjustedEnd <= range.end)
          );

          if (!isOverlapping) {
            allDetections.push({
              ...toolCall,
              textRange: { start: adjustedStart, end: adjustedEnd }
            });
            processedRanges.push({ start: adjustedStart, end: adjustedEnd });
          }
        }
      }
    }

    // 提取清理后的文本
    const cleanedTextParts = this.extractCleanedText(text, processedRanges);

    return {
      hasToolCalls: allDetections.length > 0,
      extractedToolCalls: allDetections,
      cleanedText: cleanedTextParts,
      detectionMethod: 'sliding-window',
      confidence: this.calculateConfidence(allDetections, text.length)
    };
  }

  /**
   * 创建滑动窗口
   */
  private createSlidingWindows(text: string): Array<{content: string, start: number, end: number}> {
    const windows: Array<{content: string, start: number, end: number}> = [];
    const step = this.windowConfig.windowSize - this.windowConfig.overlapSize;

    for (let i = 0; i < text.length; i += step) {
      const end = Math.min(i + this.windowConfig.windowSize, text.length);
      const content = text.slice(i, end);
      
      windows.push({
        content,
        start: i,
        end
      });

      if (end >= text.length) break;
    }

    return windows;
  }

  /**
   * 在单个窗口中检测工具调用
   */
  private detectInWindow(windowContent: string, windowStart: number, context: DetectionContext): DetectionResult {
    const detections: any[] = [];

    // 检测模式1: JSON格式的tool_use
    const jsonToolCalls = this.detectJSONToolCalls(windowContent, windowStart);
    detections.push(...jsonToolCalls);

    // 检测模式2: "Tool call: FunctionName({...})" 格式
    const textToolCalls = this.detectTextToolCalls(windowContent, windowStart);
    detections.push(...textToolCalls);

    // 检测模式3: 直接函数调用格式 "FunctionName({...})"
    const directToolCalls = this.detectDirectToolCalls(windowContent, windowStart);
    detections.push(...directToolCalls);

    // 检测模式4: 特定模型的格式
    const modelSpecificCalls = this.detectModelSpecificFormats(windowContent, windowStart, context);
    detections.push(...modelSpecificCalls);

    return {
      hasToolCalls: detections.length > 0,
      extractedToolCalls: detections,
      cleanedText: [],
      detectionMethod: 'window-detection',
      confidence: detections.length > 0 ? 0.9 : 0.0
    };
  }

  /**
   * 检测JSON格式的工具调用
   */
  private detectJSONToolCalls(text: string, offset: number): any[] {
    const detections: any[] = [];
    const patterns = [
      /\{\s*"type"\s*:\s*"tool_use"\s*,[\s\S]*?\}/g,
      /\{\s*"id"\s*:\s*"toolu_[^"]+"\s*,[\s\S]*?\}/g,
      /\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"input"\s*:\s*\{[\s\S]*?\}\s*\}/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        try {
          const jsonStr = match[0];
          const parsed = JSON.parse(jsonStr);
          
          if (this.isValidToolCall(parsed)) {
            detections.push({
              type: 'tool_use',
              id: parsed.id || `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
              name: parsed.name,
              input: parsed.input,
              textRange: {
                start: offset + match.index,
                end: offset + match.index + match[0].length
              },
              detectionMethod: 'json-pattern',
              originalText: jsonStr
            });
          }
        } catch (error) {
          // JSON解析失败，继续下一个匹配
        }
      }
    }

    return detections;
  }

  /**
   * 检测文本格式的工具调用
   */
  private detectTextToolCalls(text: string, offset: number): any[] {
    const detections: any[] = [];
    const pattern = /Tool\s+call:\s*(\w+)\s*\((\{[^}]*(?:\{[^}]*\}[^}]*)*\})\)/gi;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        const functionName = match[1];
        const argsStr = match[2];
        const args = JSON.parse(argsStr);
        
        detections.push({
          type: 'tool_use',
          id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          name: functionName,
          input: args,
          textRange: {
            start: offset + match.index,
            end: offset + match.index + match[0].length
          },
          detectionMethod: 'text-pattern',
          originalText: match[0]
        });
      } catch (error) {
        // 参数解析失败，继续下一个匹配
      }
    }

    return detections;
  }

  /**
   * 检测直接函数调用格式
   */
  private detectDirectToolCalls(text: string, offset: number): any[] {
    const detections: any[] = [];
    const pattern = /\b(\w+)\s*\(\s*(\{[^}]*(?:\{[^}]*\}[^}]*)*\})\s*\)/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        const functionName = match[1];
        const argsStr = match[2];
        
        // 排除常见的非工具调用函数
        if (this.isLikelyToolFunction(functionName)) {
          const args = JSON.parse(argsStr);
          
          detections.push({
            type: 'tool_use',
            id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
            name: functionName,
            input: args,
            textRange: {
              start: offset + match.index,
              end: offset + match.index + match[0].length
            },
            detectionMethod: 'direct-pattern',
            originalText: match[0]
          });
        }
      } catch (error) {
        // 参数解析失败，继续下一个匹配
      }
    }

    return detections;
  }

  /**
   * 检测特定模型的格式
   */
  private detectModelSpecificFormats(text: string, offset: number, context: DetectionContext): any[] {
    const detections: any[] = [];
    const modelLower = context.model.toLowerCase();

    // GLM/ZhiPu模型特定格式
    if (modelLower.includes('glm') || modelLower.includes('zhipu')) {
      const glmDetections = this.detectGLMFormat(text, offset);
      detections.push(...glmDetections);
    }

    // Qwen模型特定格式
    if (modelLower.includes('qwen')) {
      const qwenDetections = this.detectQwenFormat(text, offset);
      detections.push(...qwenDetections);
    }

    // DeepSeek模型特定格式
    if (modelLower.includes('deepseek')) {
      const deepseekDetections = this.detectDeepSeekFormat(text, offset);
      detections.push(...deepseekDetections);
    }

    return detections;
  }

  /**
   * GLM模型格式检测
   */
  private detectGLMFormat(text: string, offset: number): any[] {
    // GLM可能使用特殊的工具调用格式
    // 这里可以添加GLM特定的检测逻辑
    return [];
  }

  /**
   * Qwen模型格式检测
   */
  private detectQwenFormat(text: string, offset: number): any[] {
    const detections: any[] = [];
    
    // Qwen可能返回 {"name": "FunctionName", "arguments": "{...}"} 格式
    const pattern = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*"([^"]+)"\s*\}/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        const functionName = match[1];
        const argsStr = match[2].replace(/\\"/g, '"'); // 处理转义引号
        const args = JSON.parse(argsStr);
        
        detections.push({
          type: 'tool_use',
          id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          name: functionName,
          input: args,
          textRange: {
            start: offset + match.index,
            end: offset + match.index + match[0].length
          },
          detectionMethod: 'qwen-pattern',
          originalText: match[0]
        });
      } catch (error) {
        // 解析失败，继续下一个匹配
      }
    }

    return detections;
  }

  /**
   * DeepSeek模型格式检测
   */
  private detectDeepSeekFormat(text: string, offset: number): any[] {
    // DeepSeek特定格式检测逻辑
    return [];
  }

  /**
   * 验证是否是有效的工具调用
   */
  private isValidToolCall(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      (obj.type === 'tool_use' || (obj.name && obj.input !== undefined)) &&
      typeof obj.name === 'string' &&
      obj.input !== undefined
    );
  }

  /**
   * 判断函数名是否可能是工具函数
   */
  private isLikelyToolFunction(functionName: string): boolean {
    // 排除常见的非工具调用函数
    const excludePatterns = [
      /^(console|log|print|debug|info|warn|error)$/i,
      /^(get|set|is|has|can|should|will)$/i,
      /^(if|for|while|switch|case|try|catch|finally)$/i,
      /^(function|class|const|let|var|return)$/i
    ];

    return !excludePatterns.some(pattern => pattern.test(functionName));
  }

  /**
   * 提取清理后的文本
   */
  private extractCleanedText(originalText: string, processedRanges: Array<{start: number, end: number}>): string[] {
    if (processedRanges.length === 0) {
      return [originalText];
    }

    const textParts: string[] = [];
    let lastEnd = 0;

    // 按起始位置排序
    processedRanges.sort((a, b) => a.start - b.start);

    for (const range of processedRanges) {
      // 添加工具调用之前的文本
      if (range.start > lastEnd) {
        const beforeText = originalText.slice(lastEnd, range.start).trim();
        if (beforeText) {
          textParts.push(beforeText);
        }
      }
      lastEnd = Math.max(lastEnd, range.end);
    }

    // 添加最后剩余的文本
    if (lastEnd < originalText.length) {
      const remainingText = originalText.slice(lastEnd).trim();
      if (remainingText) {
        textParts.push(remainingText);
      }
    }

    return textParts.length > 0 ? textParts : [''];
  }

  /**
   * 计算检测置信度
   */
  private calculateConfidence(detections: any[], textLength: number): number {
    if (detections.length === 0) return 0.0;

    let totalConfidence = 0;
    for (const detection of detections) {
      switch (detection.detectionMethod) {
        case 'json-pattern':
          totalConfidence += 0.95;
          break;
        case 'text-pattern':
          totalConfidence += 0.90;
          break;
        case 'direct-pattern':
          totalConfidence += 0.75;
          break;
        case 'qwen-pattern':
          totalConfidence += 0.85;
          break;
        default:
          totalConfidence += 0.70;
      }
    }

    return Math.min(totalConfidence / detections.length, 1.0);
  }
}

/**
 * 统一工具调用检测器
 */
export class UnifiedToolCallDetector {
  private slidingWindowDetector: SlidingWindowDetector;
  private logger: ReturnType<typeof getLogger>;

  constructor(port?: number) {
    this.slidingWindowDetector = new SlidingWindowDetector({
      windowSize: 1000,
      overlapSize: 200,
      minDetectionLength: 10
    }, port);
    this.logger = getLogger(port);
  }

  /**
   * 检测并处理工具调用
   * 对所有OpenAI兼容输入都执行监测，避免准入条件太严格
   */
  async detectAndProcess(data: any, context: DetectionContext): Promise<any> {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const startTime = Date.now();
    
    try {
      // 🎯 宽松准入策略：对所有有内容的响应都进行检测
      if (this.hasTextContent(data)) {
        const processedData = await this.processTextContent(data, context);
        
        const duration = Date.now() - startTime;
        this.logger.debug('Tool call detection completed', {
          duration: `${duration}ms`,
          hasChanges: processedData !== data,
          originalBlocks: this.countContentBlocks(data),
          processedBlocks: this.countContentBlocks(processedData)
        }, context.requestId, 'tool-call-detection');

        return processedData;
      }

      return data;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Tool call detection failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`
      }, context.requestId, 'tool-call-detection');
      
      return data;
    }
  }

  /**
   * 检查是否有文本内容
   */
  private hasTextContent(data: any): boolean {
    if (!data.content || !Array.isArray(data.content)) {
      return false;
    }

    return data.content.some((block: any) => 
      block && block.type === 'text' && block.text && typeof block.text === 'string'
    );
  }

  /**
   * 处理文本内容
   */
  private async processTextContent(data: any, context: DetectionContext): Promise<any> {
    if (!data.content || !Array.isArray(data.content)) {
      return data;
    }

    const processedContent: any[] = [];
    let hasChanges = false;

    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        // 对每个文本块进行滑动窗口检测
        const detection = this.slidingWindowDetector.detectInText(block.text, context);
        
        if (detection.hasToolCalls) {
          hasChanges = true;
          
          // 添加清理后的文本块（如果有）
          for (const cleanText of detection.cleanedText) {
            if (cleanText.trim()) {
              processedContent.push({
                type: 'text',
                text: cleanText
              });
            }
          }
          
          // 添加提取的工具调用
          for (const toolCall of detection.extractedToolCalls) {
            processedContent.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.name,
              input: toolCall.input
            });
          }

          this.logger.debug('Extracted tool calls from text', {
            originalTextLength: block.text.length,
            toolCallsExtracted: detection.extractedToolCalls.length,
            detectionMethod: detection.detectionMethod,
            confidence: detection.confidence
          }, context.requestId, 'tool-call-extraction');
        } else {
          // 没有工具调用，保持原样
          processedContent.push(block);
        }
      } else {
        // 非文本块，保持原样
        processedContent.push(block);
      }
    }

    if (hasChanges) {
      return {
        ...data,
        content: processedContent
      };
    }

    return data;
  }

  /**
   * 计算内容块数量
   */
  private countContentBlocks(data: any): number {
    if (!data?.content || !Array.isArray(data.content)) {
      return 0;
    }
    return data.content.length;
  }

  /**
   * 获取检测统计信息
   */
  getStats(): {
    windowConfig: SlidingWindowConfig,
    detectionMethods: string[]
  } {
    return {
      windowConfig: this.slidingWindowDetector['windowConfig'],
      detectionMethods: [
        'json-pattern',
        'text-pattern', 
        'direct-pattern',
        'qwen-pattern',
        'glm-pattern',
        'deepseek-pattern'
      ]
    };
  }
}