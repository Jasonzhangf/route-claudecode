/**
 * 统一Preprocessing补丁系统
 * 将原本分散的补丁检测和应用统一到Preprocessing阶段
 * 确保所有输入都经过统一的补丁检测和处理，避免遗漏
 */

import { PatchManager, createPatchManager } from '../patches';
import { getLogger } from '../logging';
import { 
  BasePatch, 
  PatchContext, 
  PatchResult, 
  Provider 
} from '../patches/types';

interface PreprocessingContext {
  requestId: string;
  provider: Provider;
  model: string;
  stage: 'input' | 'response' | 'streaming';
  timestamp: number;
  metadata?: any;
}

export interface UnifiedPatchPreprocessorConfig {
  enabled: boolean;
  debugMode: boolean;
  forceAllInputs: boolean; // 强制所有输入都进入Preprocessing
  bypassConditions: string[]; // 可以绕过的特殊条件
  performanceTracking: boolean;
  cacheResults: boolean;
  validateFinishReason: boolean; // 🆕 控制是否验证finish reason
  strictFinishReasonValidation: boolean; // 🆕 严格模式：遇到unknown就报错
}

export class UnifiedPatchPreprocessor {
  private patchManager: PatchManager;
  private logger: ReturnType<typeof getLogger>;
  private config: UnifiedPatchPreprocessorConfig;
  private processedCache: Map<string, any> = new Map();
  private performanceMetrics = {
    totalProcessed: 0,
    totalDuration: 0,
    byStage: {
      input: { count: 0, duration: 0 },
      response: { count: 0, duration: 0 },
      streaming: { count: 0, duration: 0 }
    }
  };

  constructor(port?: number, config?: Partial<UnifiedPatchPreprocessorConfig>) {
    this.config = {
      enabled: process.env.RCC_UNIFIED_PREPROCESSING !== 'false',
      debugMode: process.env.RCC_PREPROCESSING_DEBUG === 'true',
      forceAllInputs: process.env.RCC_FORCE_ALL_INPUTS === 'true',
      bypassConditions: [],
      performanceTracking: true,
      cacheResults: process.env.RCC_CACHE_PREPROCESSING === 'true',
      // 🎯 强化Tool call检测 - 不可配置关闭，强制启用
      validateFinishReason: true, // 强制启用，忽略环境变量
      strictFinishReasonValidation: process.env.RCC_STRICT_FINISH_REASON === 'true', // 默认关闭
      ...config
    };

    // 🚨 安全检查：确保关键验证不被配置覆盖
    this.config.validateFinishReason = true; // 强制重置为true

    this.logger = getLogger(port);
    this.patchManager = createPatchManager(port);

    if (this.config.debugMode) {
      this.logger.info('UnifiedPatchPreprocessor initialized', {
        config: this.config,
        port
      });
    }
  }

  /**
   * 统一Preprocessing入口：处理输入阶段数据
   * 所有APIRequest都必须经过此处理
   */
  async preprocessInput(
    inputData: any,
    provider: Provider,
    model: string,
    requestId: string
  ): Promise<any> {
    const context: PreprocessingContext = {
      requestId,
      provider,
      model,
      stage: 'input',
      timestamp: Date.now(),
      metadata: inputData.metadata
    };

    return this.processWithUnifiedPipeline(inputData, context);
  }

  /**
   * 统一Preprocessing入口：处理Response阶段数据
   * 所有ProviderResponse都必须经过此处理
   */
  async preprocessResponse(
    responseData: any,
    provider: Provider,
    model: string,
    requestId: string
  ): Promise<any> {
    const context: PreprocessingContext = {
      requestId,
      provider,
      model,
      stage: 'response',
      timestamp: Date.now()
    };

    return this.processWithUnifiedPipeline(responseData, context);
  }

  /**
   * 统一Preprocessing入口：处理Streaming数据块
   * 所有StreamingResponse都必须经过此处理
   */
  async preprocessStreaming(
    chunkData: any,
    provider: Provider,
    model: string,
    requestId: string
  ): Promise<any> {
    const context: PreprocessingContext = {
      requestId,
      provider,
      model,
      stage: 'streaming',
      timestamp: Date.now()
    };

    return this.processWithUnifiedPipeline(chunkData, context);
  }

  /**
   * 🪟 Sliding window tool call detection - Handle various non-standard formats
   */
  private async slidingWindowToolDetection(data: any, context: PreprocessingContext): Promise<{
    hasTools: boolean;
    toolCount: number;
    patterns: string[];
  }> {
    let toolCount = 0;
    const detectedPatterns: string[] = [];

    // 定义滑动窗口大小和重叠
    const windowSize = 500; // 500字符窗口
    const overlap = 100;    // 100字符重叠

    // 收集所有文本Content
    let allText = '';
    if (data.content && Array.isArray(data.content)) {
      allText = data.content
        .filter((block: any) => block.type === 'text' && block.text)
        .map((block: any) => block.text)
        .join(' ');
    } else if (typeof data === 'string') {
      allText = data;
    }

    if (!allText || allText.length === 0) {
      return { hasTools: false, toolCount: 0, patterns: [] };
    }

    // 🪟 滑动窗口扫描
    for (let i = 0; i <= allText.length - windowSize; i += (windowSize - overlap)) {
      const window = allText.substring(i, i + windowSize);
      const windowResult = this.analyzeWindowForTools(window, i);
      
      toolCount += windowResult.toolCount;
      detectedPatterns.push(...windowResult.patterns);

      // 如果窗口太小，直接处理剩余部分
      if (i + windowSize >= allText.length) {
        break;
      }
    }

    // 处理最后一个窗口（如果有剩余）
    if (allText.length > windowSize) {
      const lastWindow = allText.substring(Math.max(0, allText.length - windowSize));
      const lastResult = this.analyzeWindowForTools(lastWindow, allText.length - windowSize);
      toolCount += lastResult.toolCount;
      detectedPatterns.push(...lastResult.patterns);
    }

    return {
      hasTools: toolCount > 0,
      toolCount,
      patterns: [...new Set(detectedPatterns)] // 去重
    };
  }

  /**
   * Analyze tool calls in individual windows
   */
  private analyzeWindowForTools(window: string, offset: number): {
    toolCount: number;
    patterns: string[];
  } {
    let toolCount = 0;
    const patterns: string[] = [];

    // 检测模式1: GLM-4.5Format "Tool call: FunctionName({...})"
    const glmPattern = /Tool\s+call:\s*(\w+)\s*\((\{[^}]*\})\)/gi;
    let match;
    while ((match = glmPattern.exec(window)) !== null) {
      toolCount++;
      patterns.push(`GLM-${match[1]}@${offset + match.index}`);
    }

    // 检测模式2: JSONFormat {"type": "tool_use", ...}
    const jsonPattern = /\{\s*"type"\s*:\s*"tool_use"[^}]*\}/gi;
    while ((match = jsonPattern.exec(window)) !== null) {
      toolCount++;
      patterns.push(`JSON-tool_use@${offset + match.index}`);
    }

    // 检测模式3: 直接函数调用Format "functionName({...})"
    const funcPattern = /(\w+)\s*\(\s*\{[^}]*"[^"]*"\s*:[^}]*\}/gi;
    while ((match = funcPattern.exec(window)) !== null) {
      // 排除常见的非Tool call模式
      const funcName = match[1].toLowerCase();
      if (!['console', 'json', 'object', 'array', 'string', 'math'].includes(funcName)) {
        toolCount++;
        patterns.push(`FUNC-${match[1]}@${offset + match.index}`);
      }
    }

    // 检测模式4: OpenAI函数调用Format
    const openaiPattern = /"function_call"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/gi;
    while ((match = openaiPattern.exec(window)) !== null) {
      toolCount++;
      patterns.push(`OPENAI-${match[1]}@${offset + match.index}`);
    }

    return { toolCount, patterns };
  }

  /**
   * 核心统一处理流水线
   * 集成所有补丁检测和应用逻辑
   */
  private async processWithUnifiedPipeline(
    data: any,
    context: PreprocessingContext
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // 性能跟踪开始
      if (this.config.performanceTracking) {
        this.performanceMetrics.totalProcessed++;
        this.performanceMetrics.byStage[context.stage].count++;
      }

      // 1. Preprocessing检查：是否启用
      if (!this.config.enabled) {
        if (this.config.debugMode) {
          this.logger.debug('UnifiedPatchPreprocessor disabled, skipping', {
            requestId: context.requestId
          });
        }
        return data;
      }

      // 2. 缓存检查（可选优化）
      if (this.config.cacheResults) {
        const cacheKey = this.generateCacheKey(data, context);
        const cached = this.processedCache.get(cacheKey);
        if (cached) {
          this.logger.debug('[TRACE] Cache hit for preprocessing', {
            requestId: context.requestId,
            cacheKey
          });
          return cached;
        }
      }

      // 3. 放宽准入条件 - 强制所有Response都进入Preprocessing
      const shouldProcess = this.config.forceAllInputs || 
                           context.stage === 'response' ||  // 所有Response都进入Preprocessing 
                           this.shouldProcess(data, context);
      
      if (shouldProcess) {
        // 构建补丁上下文
        const patchContext: PatchContext = {
          provider: context.provider,
          model: context.model,
          requestId: context.requestId,
          timestamp: context.timestamp
        };

        // 应用对应类型的补丁
        let processedData = data;
        
        if (context.stage === 'input') {
          processedData = await this.patchManager.applyRequestPatches(
            data, 
            context.provider, 
            context.model
          );
        } else if (context.stage === 'response') {
          // 🔧 CRITICAL FIX: ShuaiHong/ModelScope format compatibility patch
          data = await this.applyShuaiHongFormatPatch(data, context);
          
          // 🎯 Force tool call detection and finish reason override
          const toolDetectionResult = await this.forceToolCallDetection(data, context);
          
          if (toolDetectionResult.hasTools) {
            // Force override finish_reason
            data = this.forceFinishReasonOverride(data, 'tool_calls', context);
            console.log(`🔧 [PREPROCESSING] Forced finish_reason override for ${toolDetectionResult.toolCount} tools`);
          }

          // 🚨 CRITICAL: Detect unknown finish reason in preprocessing stage (强制启用)
          this.validateFinishReason(data, context);
          
          processedData = await this.patchManager.applyResponsePatches(
            data, 
            context.provider, 
            context.model, 
            context.requestId
          );
        } else if (context.stage === 'streaming') {
          processedData = await this.patchManager.applyStreamingPatches(
            data, 
            context.provider, 
            context.model, 
            context.requestId
          );
        }

        // 4. 缓存结果（如果启用）
        if (this.config.cacheResults && processedData !== data) {
          const cacheKey = this.generateCacheKey(data, context);
          this.processedCache.set(cacheKey, processedData);
          
          // 限制缓存大小
          if (this.processedCache.size > 1000) {
            const firstKey = this.processedCache.keys().next().value;
            if (firstKey !== undefined) {
              this.processedCache.delete(firstKey);
            }
          }
        }

        // 5. 性能跟踪和调试日志
        const duration = Date.now() - startTime;
        if (this.config.performanceTracking) {
          this.performanceMetrics.totalDuration += duration;
          this.performanceMetrics.byStage[context.stage].duration += duration;
        }

        if (this.config.debugMode && processedData !== data) {
          this.logger.debug('UnifiedPatchPreprocessor applied changes', {
            requestId: context.requestId,
            stage: context.stage,
            provider: context.provider,
            model: context.model,
            duration: `${duration}ms`,
            dataChanged: true
          });
        }

        return processedData;
      }

      // 6. 数据未处理的情况
      if (this.config.debugMode) {
        this.logger.debug('[TRACE] Data bypassed UnifiedPatchPreprocessor', {
          requestId: context.requestId,
          stage: context.stage,
          reason: 'No matching conditions'
        });
      }

      return data;

    } catch (error) {
      // 统一错误处理：补丁失败不应该阻断主流程
      this.logger.error('UnifiedPatchPreprocessor error', {
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId,
        stage: context.stage,
        provider: context.provider,
        model: context.model
      });

      // 返回原始数据，确保系统继续运行
      return data;
    }
  }

  /**
   * 🎯 Force tool call detection - Cannot be disabled by configuration
   * 使用滑动窗口解析各种不规范Format
   */
  private async forceToolCallDetection(data: any, context: PreprocessingContext): Promise<{
    hasTools: boolean;
    toolCount: number;
  }> {
    let hasTools = false;
    let toolCount = 0;

    // 🪟 Sliding window parsing mechanism - 检测各种不规范的Tool callFormat
    if (data && typeof data === 'object') {
      const slidingWindowResult = await this.slidingWindowToolDetection(data, context);
      hasTools = slidingWindowResult.hasTools;
      toolCount = slidingWindowResult.toolCount;

      if (hasTools && this.config.debugMode) {
        this.logger.debug(`🪟 [SLIDING-WINDOW] Detected ${toolCount} tools using sliding window analysis`, {
          requestId: context.requestId,
          patterns: slidingWindowResult.patterns
        });
      }
    }

    // 1. 检查AnthropicFormat的Tool call
    if (data.content && Array.isArray(data.content)) {
      const directToolCalls = data.content.filter((block: any) => block.type === 'tool_use');
      toolCount += directToolCalls.length;

      // 检查Text format tool calls
      const textBlocks = data.content.filter((block: any) => block.type === 'text');
      for (const block of textBlocks) {
        if (block.text && this.hasTextToolCallsSimplified(block.text)) {
          toolCount++;
        }
      }
    }

    // 2. Check OpenAI format tool calls
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.message?.tool_calls) {
          toolCount += choice.message.tool_calls.length;
        }
        if (choice.message?.function_call) {
          toolCount++;
        }
      }
    }

    // 3. 检查GeminiFormat的Tool call
    if (data.candidates && Array.isArray(data.candidates)) {
      for (const candidate of data.candidates) {
        if (candidate.content?.parts) {
          const toolParts = candidate.content.parts.filter((part: any) => 
            part.functionCall || part.function_call
          );
          toolCount += toolParts.length;
        }
      }
    }

    hasTools = toolCount > 0;

    if (hasTools) {
      console.log(`🔍 [PREPROCESSING] Tool detection result: ${toolCount} tools found in ${context.provider} response`);
    }

    return { hasTools, toolCount };
  }

  /**
   * Simplified text tool call detection
   */
  private hasTextToolCallsSimplified(text: string): boolean {
    const simpleToolPatterns = [
      /Tool\s+call:\s*\w+\s*\(/i,  // GLM-4.5Format
      /"type"\s*:\s*"tool_use"/i,   // JSONFormat
      /"name"\s*:\s*"\w+"/i         // 工具名称
    ];

    return simpleToolPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Solve OpenAI response missing choices error and tool call parsing issue
   */
  private async applyShuaiHongFormatPatch(
    data: any, 
    context: PreprocessingContext
  ): Promise<any> {
    // Handle ShuaiHong/ModelScope format responses
    if (data.message && typeof data.message === 'string') return data.message;
    if (data.text) return data.text;
    if (data.response) return data.response;
    if (data.output) return data.output;
    
    // Try to extract from nested objects
    if (data.result && data.result.content) return data.result.content;
    if (data.data && data.data.content) return data.data.content;
    
    // LM Studio special handling: Parse embedded tool calls in content
    const isLMStudio = context.provider.includes('lmstudio') || context.provider.includes('LMStudio');
    
    if (isLMStudio) {
      // Handle both OpenAI format (choices array) and Anthropic format (content array)
      let textContent = '';
      let isOpenAIFormat = false;
      
      // Check for OpenAI format first
      if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
        const choice = data.choices[0];
        textContent = choice.message?.content;
        isOpenAIFormat = true;
      }
      // Check for Anthropic format
      else if (data.content && Array.isArray(data.content)) {
        const textBlock = data.content.find((block: any) => block.type === 'text');
        textContent = textBlock?.text;
        isOpenAIFormat = false;
      }
      
      if (typeof textContent === 'string' && textContent.length > 0) {
        // Try to parse LM Studio format tool calls
        const lmstudioToolCalls = this.parseLMStudioToolCalls(textContent, context);
        
        if (lmstudioToolCalls.length > 0) {
          console.log(`🔧 [PREPROCESSING] Parsed ${lmstudioToolCalls.length} LM Studio tool calls (${isOpenAIFormat ? 'OpenAI' : 'Anthropic'} format)`);
          
          // Remove tool call markers from content
          let newContent = textContent;
          const lmstudioPattern = /<\|start\|>assistant<\|channel\|>commentary to=functions\.[^<]*\s*<\|constrain\|>[^<]*<\|message\|>\{[^}]*\}/g;
          newContent = newContent.replace(lmstudioPattern, '').trim();
          
          if (isOpenAIFormat) {
            // Return OpenAI format
            const choice = data.choices[0];
            const fixedData = {
              ...data,
              choices: [{
                ...choice,
                message: {
                  ...choice.message,
                  content: newContent || null,
                  tool_calls: lmstudioToolCalls
                },
                finish_reason: 'tool_calls'
              }]
            };
            
            return fixedData;
          } else {
            // Return Anthropic format with tool_use blocks
            const toolUseBlocks = lmstudioToolCalls.map(toolCall => ({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments)
            }));
            
            const newContentBlocks = [];
            if (newContent) {
              newContentBlocks.push({
                type: 'text',
                text: newContent
              });
            }
            newContentBlocks.push(...toolUseBlocks);
            
            const fixedData = {
              ...data,
              content: newContentBlocks,
              stop_reason: 'tool_use'
            };
            
            return fixedData;
          }
        }
      }
    }
    
    return data;
  }

  /**
   * Extract tool calls from non-standard response
   */
  private extractToolCalls(data: any): any[] | null {
    // Check standard locations
    if (data.tool_calls && Array.isArray(data.tool_calls)) {
      return data.tool_calls;
    }
    
    // Check nested locations
    if (data.message && data.message.tool_calls) {
      return data.message.tool_calls;
    }
    
    // 检查其他可能的位置
    if (data.function_calls) {
      return data.function_calls;
    }
    
    return null;
  }

  /**
   * Extract finish_reason from non-standard response
   */
  private extractFinishReason(data: any): string {
    // Try multiple possible finish_reason fields
    if (data.finish_reason) return data.finish_reason;
    if (data.stop_reason) return data.stop_reason;
    if (data.finishReason) return data.finishReason;
    if (data.status) return data.status;
    
    // Check nested locations
    if (data.result && data.result.finish_reason) return data.result.finish_reason;
    if (data.choices && data.choices[0] && data.choices[0].finish_reason) {
      return data.choices[0].finish_reason;
    }
    
    // 如果有Tool call相关Content，返回tool_calls
    if (this.extractToolCalls(data)) {
      return 'tool_calls';
    }
    
    // 默认为stop
    return 'stop';
  }

  /**
   * 解析LM StudioFormat的Tool call
   */
  private parseLMStudioToolCalls(content: string, context: PreprocessingContext): any[] {
    const toolCalls: any[] = [];
    
    // LM StudioFormat: <|start|>assistant<|channel|>commentary to=functions.FunctionName <|constrain|>JSON<|message|>{"param":"value"}
    const lmstudioPattern = /<\|start\|>assistant<\|channel\|>commentary to=functions\.(\w+)\s*<\|constrain\|>(?:JSON|json)<\|message\|>(\{[^}]*\})/g;
    
    let match;
    while ((match = lmstudioPattern.exec(content)) !== null) {
      try {
        const functionName = match[1];
        const argsJson = match[2];
        const args = JSON.parse(argsJson);
        
        const toolCall = {
          id: `call_${Date.now()}_${toolCalls.length}`,
          type: 'function',
          function: {
            name: functionName,
            arguments: JSON.stringify(args)
          }
        };
        
        toolCalls.push(toolCall);
        
        this.logger.info('Parsed LM Studio tool call', {
          functionName,
          args,
          provider: context.provider,
          model: context.model,
          requestId: context.requestId
        }, context.requestId, 'preprocessing');
      } catch (error) {
        this.logger.error('Failed to parse LM Studio tool call', {
          error: error instanceof Error ? error.message : String(error),
          match: match[0],
          provider: context.provider,
          model: context.model,
          requestId: context.requestId
        }, context.requestId, 'preprocessing');
      }
    }
    
    return toolCalls;
  }

  /**
   * 🎯 强制finish reason覆盖
   */
  private forceFinishReasonOverride(
    data: any, 
    targetReason: string, 
    context: PreprocessingContext
  ): any {
    const originalData = JSON.parse(JSON.stringify(data)); // 深拷贝

    // 根据不同Format进行覆盖
    if (data.choices && Array.isArray(data.choices)) {
      // OpenAIFormat
      for (const choice of data.choices) {
        const originalReason = choice.finish_reason;
        choice.finish_reason = targetReason;
        console.log(`🔧 [PREPROCESSING] OpenAI format finish_reason: ${originalReason} -> ${targetReason}`);
      }
    }

    if (data.stop_reason !== undefined) {
      // AnthropicFormat
      const originalReason = data.stop_reason;
      data.stop_reason = targetReason === 'tool_calls' ? 'tool_use' : targetReason;
      console.log(`🔧 [PREPROCESSING] Anthropic format stop_reason: ${originalReason} -> ${data.stop_reason}`);
    }

    return data;
  }

  /**
   * 🚨 CRITICAL: 验证Response有效性 - 在Preprocessing阶段捕获异常Response
   * 按照用户要求：先检查是否为非Normal response，如果是则返回错误码和描述
   * 只有Only process finish_reason for normal cases like HTTP 200
   */
  private validateFinishReason(data: any, context: PreprocessingContext): void {
    // 1️⃣ 首先检查是否为非正常的APIResponse
    const abnormalResponse = this.detectAbnormalResponse(data, context);
    if (abnormalResponse) {
      // 根据用户要求：Abnormal response directly throws API error，包含错误码和500字以内描述
      const errorCode = abnormalResponse.statusCode || 500;
      const errorMessage = this.generateErrorMessage(abnormalResponse, context);
      
      this.logger.error('🚨 [PREPROCESSING] Abnormal API response detected - RETURNING API ERROR', {
        errorCode,
        errorMessage: errorMessage.slice(0, 500),
        provider: context.provider,
        model: context.model,
        requestId: context.requestId,
        abnormalType: abnormalResponse.type,
        stage: 'preprocessing-validation',
        action: 'RETURN_API_ERROR'
      }, context.requestId, 'preprocessing');
      
      // 抛出结构化的Provider错误
      const error = new Error(errorMessage) as any;
      error.statusCode = errorCode;
      error.provider = context.provider;
      error.model = context.model;
      error.requestId = context.requestId;
      error.stage = 'provider';
      error.timestamp = new Date().toISOString();
      error.details = {
        diagnostics: abnormalResponse.diagnosis
      };
      
      throw error;
    }
    
    // 2️⃣ 对于HTTP 200等正常情况，检查finish_reason
    this.validateNormalResponseFinishReason(data, context);
  }

  /**
   * Detect abnormal API responses
   * Based on user diagnosis: ModelScope not sending finish_reason field situation
   */
  private detectAbnormalResponse(data: any, context: PreprocessingContext): {
    type: string;
    statusCode: number;
    diagnosis: string;
  } | null {
    // 检查ModelScope特定的异常情况：stream结束但没有finish_reason
    if (this.isModelScopeProvider(context.provider) && this.isStreamingEndWithoutFinishReason(data, context)) {
      return {
        type: 'missing_finish_reason',
        statusCode: 500,
        diagnosis: 'Silent failure detected and fixed'
      };
    }
    
    // 检查空Response或无效ResponseFormat
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return {
        type: 'empty_response',
        statusCode: 502,
        diagnosis: 'Provider returned empty response'
      };
    }
    
    // 检查HTTP错误Response
    if (data.error || data.status >= 400) {
      return {
        type: 'http_error',
        statusCode: data.status || 500,
        diagnosis: 'Provider returned HTTP error response'
      };
    }
    
    // 检查timeout或connection错误
    if (data.code === 'ETIMEDOUT' || data.code === 'ECONNREFUSED') {
      return {
        type: 'connection_error',
        statusCode: 503,
        diagnosis: 'Provider connection or timeout error'
      };
    }
    
    return null;
  }

  /**
   * Detect if provider is ModelScope type
   */
  private isModelScopeProvider(provider: string): boolean {
    return Boolean(provider && (
      provider.toLowerCase().includes('modelscope') || 
      provider.toLowerCase().includes('qwen') ||
      provider.includes('openai-key2')  // 根据错误信息中的provider名
    ));
  }

  /**
   * Detect if stream ends but finish_reason is missing
   * 基于诊断测试发现：ModelScope返回message_delta但delta为空对象
   */
  private isStreamingEndWithoutFinishReason(data: any, context: PreprocessingContext): boolean {
    // 检查OpenAIFormatResponse中的空finish_reason
    if (data && typeof data === 'object' && 'choices' in data) {
      const choices = data.choices;
      if (Array.isArray(choices) && choices.length > 0) {
        const choice = choices[0];
        // 如果有message但没有finish_reason，且usage表明已完成，则判定为异常
        if (choice.message && !choice.finish_reason && data.usage?.output_tokens > 0) {
          return true;
        }
      }
    }
    
    // 检查流事件Format：message_delta但delta为空
    if (data && data.type === 'message_delta' && data.delta && Object.keys(data.delta).length === 0) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate friendly error message (limited to 500 characters)
   */
  private generateErrorMessage(abnormalResponse: any, context: PreprocessingContext): string {
    const baseMessage = `Provider returned unknown finish reason, indicating connection or API issue.`;
    const details = `Provider: ${context.provider}, Model: ${context.model}`;
    
    switch (abnormalResponse.type) {
      case 'missing_finish_reason':
        return `${baseMessage} ${details}. The provider completed the response but failed to send proper completion status. This typically indicates a provider API compatibility issue or temporary service disruption.`;
      
      case 'empty_response':
        return `${baseMessage} ${details}. Provider returned empty response, indicating connection timeout or service unavailability.`;
      
      case 'http_error':
        return `${baseMessage} ${details}. Provider returned HTTP error ${abnormalResponse.statusCode}.`;
      
      case 'connection_error':
        return `${baseMessage} ${details}. Network connection failed or timed out.`;
      
      default:
        return `${baseMessage} ${details}. Unexpected provider response format detected.`;
    }
  }

  /**
   * Validate finish_reason in normal response (original logic remains unchanged)
   */
  private validateNormalResponseFinishReason(data: any, context: PreprocessingContext): void {
    // 检查OpenAIFormat的Response
    if (data && typeof data === 'object' && 'choices' in data) {
      const choices = data.choices;
      if (Array.isArray(choices) && choices.length > 0) {
        const finishReason = choices[0].finish_reason;
        
        // Record original finish reason
        this.logger.info('🔍 [PREPROCESSING] Raw finish_reason detected', {
          originalFinishReason: finishReason,
          provider: context.provider,
          model: context.model,
          requestId: context.requestId,
          stage: 'preprocessing-validation',
          timestamp: new Date().toISOString()
        }, context.requestId, 'preprocessing');
        
        // For normal responses, only process when explicitly "unknown"
        if (finishReason === 'unknown') {
          if (this.config.strictFinishReasonValidation) {
            const error = new Error(`Provider returned explicit unknown finish_reason. Provider: ${context.provider}, Model: ${context.model}`);
            this.logger.error('🚨 [PREPROCESSING] Explicit unknown finish_reason in normal response', {
              originalFinishReason: finishReason,
              provider: context.provider,
              model: context.model,
              requestId: context.requestId,
              error: error.message,
              strictMode: true
            }, context.requestId, 'preprocessing');
            throw error;
          }
        }
        
        // Record valid finish reason
        this.logger.debug('✅ [PREPROCESSING] Valid finish_reason confirmed', {
          finishReason,
          provider: context.provider,
          model: context.model,
          requestId: context.requestId
        }, context.requestId, 'preprocessing');
      }
    }
  }

  /**
   * Smart detection: Determine if data needs processing
   */
  private shouldProcess(data: any, context: PreprocessingContext): boolean {
    // 如果强制处理所有输入，直接返回true
    if (this.config.forceAllInputs) {
      return true;
    }

    // Check bypass conditions
    for (const bypass of this.config.bypassConditions) {
      if (this.matchesCondition(data, context, bypass)) {
        return false;
      }
    }

    // 基本检测规则：
    // 1. 输入阶段：检查是否包含需要处理的Format
    // 2. Response阶段：检查是否包含Tool call或特殊Format
    // 3. Streaming阶段：检查是否包含需要修复的数据块

    switch (context.stage) {
      case 'input':
        return this.detectInputProcessingNeeded(data, context);
      case 'response':
        return this.detectResponseProcessingNeeded(data, context);
      case 'streaming':
        return this.detectStreamingProcessingNeeded(data, context);
      default:
        return false;
    }
  }

  /**
   * Detect if input needs preprocessing
   */
  private detectInputProcessingNeeded(data: any, context: PreprocessingContext): boolean {
    // 检查是否包含Tool call相关的Content
    if (data && typeof data === 'object') {
      // 检查 tools Field
      if (data.tools && Array.isArray(data.tools)) {
        return true;
      }

      // Check if messages contain tool call content
      if (data.messages && Array.isArray(data.messages)) {
        return data.messages.some((msg: any) => {
          if (typeof msg.content === 'string') {
            return /tool_use|Tool call|function/i.test(msg.content);
          }
          return false;
        });
      }
    }

    return false;
  }

  /**
   * Detect if response needs preprocessing
   */
  private detectResponseProcessingNeeded(data: any, context: PreprocessingContext): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check if text format tool calls are included
    if (data.content && Array.isArray(data.content)) {
      return data.content.some((block: any) => {
        if (block.type === 'text' && typeof block.text === 'string') {
          return /Tool call:|tool_use|function_call/i.test(block.text);
        }
        return false;
      });
    }

    // Check OpenAI format tool calls
    if (data.choices && Array.isArray(data.choices)) {
      return data.choices.some((choice: any) => {
        return choice.message && (choice.message.tool_calls || choice.message.function_call);
      });
    }

    // 检查GeminiFormat
    if (data.candidates && Array.isArray(data.candidates)) {
      return true; // GeminiResponse都需要Format修复
    }

    return false;
  }

  /**
   * Detect if streaming data needs preprocessing
   */
  private detectStreamingProcessingNeeded(data: any, context: PreprocessingContext): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check tool calls in streaming events
    if (data.event && data.data) {
      const eventType = data.event;
      const eventData = data.data;

      if (eventType === 'content_block_start' && eventData.content_block?.type === 'tool_use') {
        return true;
      }

      if (eventType === 'content_block_delta' && eventData.delta?.text) {
        return /Tool call:|tool_use/i.test(eventData.delta.text);
      }
    }

    return false;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(data: any, context: PreprocessingContext): string {
    const dataHash = JSON.stringify(data).substring(0, 100);
    return `${context.stage}-${context.provider}-${context.model}-${dataHash}`;
  }

  /**
   * 检查是否匹配特定条件
   */
  private matchesCondition(data: any, context: PreprocessingContext, condition: string): boolean {
    // 简单的条件匹配逻辑，可以根据需要扩展
    if (condition === 'no-tools' && !data.tools) {
      return true;
    }

    if (condition.startsWith('provider:')) {
      const providerName = condition.split(':')[1];
      return context.provider === providerName;
    }

    if (condition.startsWith('model:')) {
      const modelName = condition.split(':')[1];
      return context.model.includes(modelName);
    }

    return false;
  }

  /**
   * 获取性能统计
   */
  getPerformanceMetrics() {
    const avgDuration = this.performanceMetrics.totalProcessed > 0 
      ? this.performanceMetrics.totalDuration / this.performanceMetrics.totalProcessed 
      : 0;

    return {
      ...this.performanceMetrics,
      averageDuration: Math.round(avgDuration * 100) / 100,
      cacheSize: this.processedCache.size,
      config: this.config
    };
  }

  /**
   * 获取补丁管理器统计
   */
  getPatchManagerStats() {
    return this.patchManager.getStats();
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.processedCache.clear();
    this.logger.info('UnifiedPatchPreprocessor cache cleared');
  }

  /**
   * 重置性能指标
   */
  resetMetrics() {
    this.performanceMetrics = {
      totalProcessed: 0,
      totalDuration: 0,
      byStage: {
        input: { count: 0, duration: 0 },
        response: { count: 0, duration: 0 },
        streaming: { count: 0, duration: 0 }
      }
    };
    this.logger.info('UnifiedPatchPreprocessor metrics reset');
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<UnifiedPatchPreprocessorConfig>) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('UnifiedPatchPreprocessor config updated', { newConfig });
  }
}

// 单例模式：全局统一Preprocessing器实例
const preprocessorInstances = new Map<number | string, UnifiedPatchPreprocessor>();

/**
 * 获取或创建统一Preprocessing器实例
 */
export function getUnifiedPatchPreprocessor(
  port?: number, 
  config?: Partial<UnifiedPatchPreprocessorConfig>
): UnifiedPatchPreprocessor {
  const key = port || 'default';
  
  if (!preprocessorInstances.has(key)) {
    preprocessorInstances.set(key, new UnifiedPatchPreprocessor(port, config));
  }

  return preprocessorInstances.get(key)!;
}

/**
 * 创建新的统一Preprocessing器实例
 */
export function createUnifiedPatchPreprocessor(
  port?: number,
  config?: Partial<UnifiedPatchPreprocessorConfig>
): UnifiedPatchPreprocessor {
  const key = port || 'default';
  const instance = new UnifiedPatchPreprocessor(port, config);
  preprocessorInstances.set(key, instance);
  return instance;
}

/**
 * 重置统一Preprocessing器实例
 */
export function resetUnifiedPatchPreprocessor(port?: number) {
  const key = port || 'default';
  if (preprocessorInstances.has(key)) {
    preprocessorInstances.delete(key);
  }
}