/**
 * 统一预处理补丁系统
 * 将原本分散的补丁检测和应用统一到预处理阶段
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

interface UnifiedPatchPreprocessorConfig {
  enabled: boolean;
  debugMode: boolean;
  forceAllInputs: boolean; // 强制所有输入都进入预处理
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
      // 🎯 强化工具调用检测 - 不可配置关闭，强制启用
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
   * 统一预处理入口：处理输入阶段数据
   * 所有API请求都必须经过此处理
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
   * 统一预处理入口：处理响应阶段数据
   * 所有Provider响应都必须经过此处理
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
   * 统一预处理入口：处理流式数据块
   * 所有流式响应都必须经过此处理
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
   * 🪟 滑动窗口工具调用检测 - 处理各种不规范格式
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

    // 收集所有文本内容
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
   * 分析单个窗口中的工具调用
   */
  private analyzeWindowForTools(window: string, offset: number): {
    toolCount: number;
    patterns: string[];
  } {
    let toolCount = 0;
    const patterns: string[] = [];

    // 检测模式1: GLM-4.5格式 "Tool call: FunctionName({...})"
    const glmPattern = /Tool\s+call:\s*(\w+)\s*\((\{[^}]*\})\)/gi;
    let match;
    while ((match = glmPattern.exec(window)) !== null) {
      toolCount++;
      patterns.push(`GLM-${match[1]}@${offset + match.index}`);
    }

    // 检测模式2: JSON格式 {"type": "tool_use", ...}
    const jsonPattern = /\{\s*"type"\s*:\s*"tool_use"[^}]*\}/gi;
    while ((match = jsonPattern.exec(window)) !== null) {
      toolCount++;
      patterns.push(`JSON-tool_use@${offset + match.index}`);
    }

    // 检测模式3: 直接函数调用格式 "functionName({...})"
    const funcPattern = /(\w+)\s*\(\s*\{[^}]*"[^"]*"\s*:[^}]*\}/gi;
    while ((match = funcPattern.exec(window)) !== null) {
      // 排除常见的非工具调用模式
      const funcName = match[1].toLowerCase();
      if (!['console', 'json', 'object', 'array', 'string', 'math'].includes(funcName)) {
        toolCount++;
        patterns.push(`FUNC-${match[1]}@${offset + match.index}`);
      }
    }

    // 检测模式4: OpenAI函数调用格式
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

      // 1. 预处理检查：是否启用
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

      // 3. 放宽准入条件 - 强制所有响应都进入预处理
      const shouldProcess = this.config.forceAllInputs || 
                           context.stage === 'response' ||  // 所有响应都进入预处理 
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
          // 🔧 CRITICAL FIX: ShuaiHong/ModelScope格式兼容性补丁
          data = await this.applyShuaiHongFormatPatch(data, context);
          
          // 🎯 强制工具调用检测和finish reason覆盖
          const toolDetectionResult = await this.forceToolCallDetection(data, context);
          
          if (toolDetectionResult.hasTools) {
            // 强制覆盖finish_reason
            data = this.forceFinishReasonOverride(data, 'tool_calls', context);
            console.log(`🔧 [PREPROCESSING] Forced finish_reason override for ${toolDetectionResult.toolCount} tools`);
          }

          // 🚨 CRITICAL: 在预处理阶段检测unknown finish reason (强制启用)
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
   * 🎯 强制工具调用检测 - 不可配置关闭
   * 使用滑动窗口解析各种不规范格式
   */
  private async forceToolCallDetection(data: any, context: PreprocessingContext): Promise<{
    hasTools: boolean;
    toolCount: number;
  }> {
    let hasTools = false;
    let toolCount = 0;

    // 🪟 滑动窗口解析机制 - 检测各种不规范的工具调用格式
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

    // 1. 检查Anthropic格式的工具调用
    if (data.content && Array.isArray(data.content)) {
      const directToolCalls = data.content.filter((block: any) => block.type === 'tool_use');
      toolCount += directToolCalls.length;

      // 检查文本格式的工具调用
      const textBlocks = data.content.filter((block: any) => block.type === 'text');
      for (const block of textBlocks) {
        if (block.text && this.hasTextToolCallsSimplified(block.text)) {
          toolCount++;
        }
      }
    }

    // 2. 检查OpenAI格式的工具调用
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

    // 3. 检查Gemini格式的工具调用
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
   * 简化的文本工具调用检测
   */
  private hasTextToolCallsSimplified(text: string): boolean {
    const simpleToolPatterns = [
      /Tool\s+call:\s*\w+\s*\(/i,  // GLM-4.5格式
      /"type"\s*:\s*"tool_use"/i,   // JSON格式
      /"name"\s*:\s*"\w+"/i         // 工具名称
    ];

    return simpleToolPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 🔧 CRITICAL FIX: ShuaiHong/ModelScope格式兼容性补丁
   * 解决 "OpenAI response missing choices" 错误
   */
  private async applyShuaiHongFormatPatch(
    data: any, 
    context: PreprocessingContext
  ): Promise<any> {
    // 基于模型匹配而不是Provider，更精确
    const targetModels = [
      'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-pro', 'gemini-flash',
      'glm-4.5', 'glm-4-plus', 'glm-4', 
      'DeepSeek-V3', 'deepseek-v3',
      'claude-4-sonnet', 'claude-3-sonnet',
      'ZhipuAI/GLM-4.5', 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
      'gpt-oss-20b-mlx', 'gpt-oss', 'qwen3-30b', 'glm-4.5-air', // LMStudio models
      'unsloth', 'gguf', 'mlx' // LMStudio format indicators
    ];
    
    // 检查模型名称是否匹配
    const isTargetModel = targetModels.some(model => 
      context.model.toLowerCase().includes(model.toLowerCase()) ||
      model.toLowerCase().includes(context.model.toLowerCase())
    );
    
    if (!isTargetModel) {
      // 对于非OpenAI原生Provider，也可能需要格式修复，放宽检查
      const isOpenAICompatible = context.provider.includes('openai') && 
                                !context.provider.includes('anthropic');
      const isLMStudio = context.provider.includes('lmstudio');
      
      if (!isOpenAICompatible && !isLMStudio) {
        return data;
      }
    }

    // 检查是否缺少choices字段（核心问题）
    if (data && typeof data === 'object' && !data.choices) {
      const originalData = JSON.stringify(data).substring(0, 200);
      
      console.log(`🔧 [PREPROCESSING] Applying format patch for missing choices field`);
      console.log(`📍 [MODEL-MATCH] ${context.model} on ${context.provider}`);
      
      this.logger.info('OpenAI format compatibility patch applied', {
        provider: context.provider,
        model: context.model,
        requestId: context.requestId,
        originalDataPreview: originalData,
        issue: 'missing_choices_field',
        patchType: 'openai_compatibility_fix'
      });

      // 构造标准OpenAI格式响应
      const fixedData = {
        id: data.id || `msg_${Date.now()}_${context.requestId.slice(-8)}`,
        object: 'chat.completion',
        created: data.created || Math.floor(Date.now() / 1000),
        model: context.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: this.extractContent(data) || '',
            tool_calls: this.extractToolCalls(data) || null
          },
          finish_reason: this.extractFinishReason(data) || 'stop'
        }],
        usage: data.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };

      // 如果有工具调用但没有内容，设置content为null
      if (fixedData.choices[0].message.tool_calls && !fixedData.choices[0].message.content) {
        (fixedData.choices[0].message as any).content = null;
      }

      console.log(`✅ [PREPROCESSING] ShuaiHong format patch applied successfully`);
      return fixedData;
    }

    // 检查choices存在但格式不完整的情况
    if (data && data.choices && Array.isArray(data.choices)) {
      let needsFix = false;
      const fixedChoices = data.choices.map((choice: any) => {
        if (!choice.message) {
          needsFix = true;
          return {
            ...choice,
            index: choice.index || 0,
            message: {
              role: 'assistant',
              content: choice.content || choice.text || '',
              tool_calls: choice.tool_calls || null
            },
            finish_reason: choice.finish_reason || 'stop'
          };
        }
        return choice;
      });

      if (needsFix) {
        console.log(`🔧 [PREPROCESSING] Fixing incomplete choices format for ${context.provider}`);
        return {
          ...data,
          choices: fixedChoices
        };
      }
    }

    // 数据格式正常，直接返回
    return data;
  }

  /**
   * 从非标准响应中提取内容
   */
  private extractContent(data: any): string | null {
    // 尝试多种可能的内容字段
    if (data.content) return data.content;
    if (data.message && typeof data.message === 'string') return data.message;
    if (data.text) return data.text;
    if (data.response) return data.response;
    if (data.output) return data.output;
    
    // 尝试从嵌套对象中提取
    if (data.result && data.result.content) return data.result.content;
    if (data.data && data.data.content) return data.data.content;
    
    return null;
  }

  /**
   * 从非标准响应中提取工具调用
   */
  private extractToolCalls(data: any): any[] | null {
    // 检查标准位置
    if (data.tool_calls && Array.isArray(data.tool_calls)) {
      return data.tool_calls;
    }
    
    // 检查嵌套位置
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
   * 从非标准响应中提取finish_reason
   */
  private extractFinishReason(data: any): string {
    // 尝试多种可能的finish_reason字段
    if (data.finish_reason) return data.finish_reason;
    if (data.stop_reason) return data.stop_reason;
    if (data.finishReason) return data.finishReason;
    if (data.status) return data.status;
    
    // 检查嵌套位置
    if (data.result && data.result.finish_reason) return data.result.finish_reason;
    if (data.choices && data.choices[0] && data.choices[0].finish_reason) {
      return data.choices[0].finish_reason;
    }
    
    // 如果有工具调用相关内容，返回tool_calls
    if (this.extractToolCalls(data)) {
      return 'tool_calls';
    }
    
    // 默认为stop
    return 'stop';
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

    // 根据不同格式进行覆盖
    if (data.choices && Array.isArray(data.choices)) {
      // OpenAI格式
      for (const choice of data.choices) {
        const originalReason = choice.finish_reason;
        choice.finish_reason = targetReason;
        console.log(`🔧 [PREPROCESSING] OpenAI format finish_reason: ${originalReason} -> ${targetReason}`);
      }
    }

    if (data.stop_reason !== undefined) {
      // Anthropic格式
      const originalReason = data.stop_reason;
      data.stop_reason = targetReason === 'tool_calls' ? 'tool_use' : targetReason;
      console.log(`🔧 [PREPROCESSING] Anthropic format stop_reason: ${originalReason} -> ${data.stop_reason}`);
    }

    return data;
  }

  /**
   * 🚨 CRITICAL: 验证响应有效性 - 在预处理阶段捕获异常响应
   * 按照用户要求：先检查是否为非正常响应，如果是则返回错误码和描述
   * 只有HTTP 200等正常情况才进行finish_reason处理
   */
  private validateFinishReason(data: any, context: PreprocessingContext): void {
    // 1️⃣ 首先检查是否为非正常的API响应
    const abnormalResponse = this.detectAbnormalResponse(data, context);
    if (abnormalResponse) {
      // 根据用户要求：非正常响应直接抛出API错误，包含错误码和500字以内描述
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
   * 检测非正常的API响应
   * 根据用户诊断结果：ModelScope不发送finish_reason字段的情况
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
    
    // 检查空响应或无效响应格式
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return {
        type: 'empty_response',
        statusCode: 502,
        diagnosis: 'Provider returned empty response'
      };
    }
    
    // 检查HTTP错误响应
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
   * 检测是否为ModelScope类型的provider
   */
  private isModelScopeProvider(provider: string): boolean {
    return Boolean(provider && (
      provider.toLowerCase().includes('modelscope') || 
      provider.toLowerCase().includes('qwen') ||
      provider.includes('openai-key2')  // 根据错误信息中的provider名
    ));
  }

  /**
   * 检测是否为流结束但缺少finish_reason的情况
   * 基于诊断测试发现：ModelScope返回message_delta但delta为空对象
   */
  private isStreamingEndWithoutFinishReason(data: any, context: PreprocessingContext): boolean {
    // 检查OpenAI格式响应中的空finish_reason
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
    
    // 检查流事件格式：message_delta但delta为空
    if (data && data.type === 'message_delta' && data.delta && Object.keys(data.delta).length === 0) {
      return true;
    }
    
    return false;
  }

  /**
   * 生成友好的错误信息（限制500字以内）
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
   * 验证正常响应中的finish_reason（原有逻辑保持不变）
   */
  private validateNormalResponseFinishReason(data: any, context: PreprocessingContext): void {
    // 检查OpenAI格式的响应
    if (data && typeof data === 'object' && 'choices' in data) {
      const choices = data.choices;
      if (Array.isArray(choices) && choices.length > 0) {
        const finishReason = choices[0].finish_reason;
        
        // 记录原始finish reason
        this.logger.info('🔍 [PREPROCESSING] Raw finish_reason detected', {
          originalFinishReason: finishReason,
          provider: context.provider,
          model: context.model,
          requestId: context.requestId,
          stage: 'preprocessing-validation',
          timestamp: new Date().toISOString()
        }, context.requestId, 'preprocessing');
        
        // 对于正常响应，只有明确为'unknown'时才处理
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
        
        // 记录有效的finish reason
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
   * 智能检测：判断数据是否需要处理
   */
  private shouldProcess(data: any, context: PreprocessingContext): boolean {
    // 如果强制处理所有输入，直接返回true
    if (this.config.forceAllInputs) {
      return true;
    }

    // 检查绕过条件
    for (const bypass of this.config.bypassConditions) {
      if (this.matchesCondition(data, context, bypass)) {
        return false;
      }
    }

    // 基本检测规则：
    // 1. 输入阶段：检查是否包含需要处理的格式
    // 2. 响应阶段：检查是否包含工具调用或特殊格式
    // 3. 流式阶段：检查是否包含需要修复的数据块

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
   * 检测输入是否需要预处理
   */
  private detectInputProcessingNeeded(data: any, context: PreprocessingContext): boolean {
    // 检查是否包含工具调用相关的内容
    if (data && typeof data === 'object') {
      // 检查 tools 字段
      if (data.tools && Array.isArray(data.tools)) {
        return true;
      }

      // 检查消息中是否包含工具调用内容
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
   * 检测响应是否需要预处理
   */
  private detectResponseProcessingNeeded(data: any, context: PreprocessingContext): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // 检查是否包含文本格式的工具调用
    if (data.content && Array.isArray(data.content)) {
      return data.content.some((block: any) => {
        if (block.type === 'text' && typeof block.text === 'string') {
          return /Tool call:|tool_use|function_call/i.test(block.text);
        }
        return false;
      });
    }

    // 检查OpenAI格式的工具调用
    if (data.choices && Array.isArray(data.choices)) {
      return data.choices.some((choice: any) => {
        return choice.message && (choice.message.tool_calls || choice.message.function_call);
      });
    }

    // 检查Gemini格式
    if (data.candidates && Array.isArray(data.candidates)) {
      return true; // Gemini响应都需要格式修复
    }

    return false;
  }

  /**
   * 检测流式数据是否需要预处理
   */
  private detectStreamingProcessingNeeded(data: any, context: PreprocessingContext): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // 检查流式事件中的工具调用
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

// 单例模式：全局统一预处理器实例
const preprocessorInstances = new Map<number | string, UnifiedPatchPreprocessor>();

/**
 * 获取或创建统一预处理器实例
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
 * 创建新的统一预处理器实例
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
 * 重置统一预处理器实例
 */
export function resetUnifiedPatchPreprocessor(port?: number) {
  const key = port || 'default';
  if (preprocessorInstances.has(key)) {
    preprocessorInstances.delete(key);
  }
}