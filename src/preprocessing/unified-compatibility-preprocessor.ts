/**
 * 统一兼容性预处理器
 * 将所有AI服务的兼容性处理逻辑整合到预处理阶段
 * 替代原有的补丁系统，提供更清晰的架构
 */

import { getLogger } from '../logging';

interface PreprocessingContext {
  requestId: string;
  provider: string;
  model: string;
  stage: 'input' | 'response' | 'streaming';
  timestamp: number;
  metadata?: any;
}

export interface UnifiedCompatibilityConfig {
  enabled: boolean;
  debugMode: boolean;
  forceAllInputs: boolean;
  performanceTracking: boolean;
  cacheResults: boolean;
  validateFinishReason: boolean;
  strictFinishReasonValidation: boolean;
}

export class UnifiedCompatibilityPreprocessor {
  private logger: ReturnType<typeof getLogger>;
  private config: UnifiedCompatibilityConfig;
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

  constructor(port?: number, config?: Partial<UnifiedCompatibilityConfig>) {
    this.config = {
      enabled: process.env.RCC_UNIFIED_PREPROCESSING !== 'false',
      debugMode: process.env.RCC_PREPROCESSING_DEBUG === 'true',
      forceAllInputs: process.env.RCC_FORCE_ALL_INPUTS === 'true',
      performanceTracking: true,
      cacheResults: process.env.RCC_CACHE_PREPROCESSING === 'true',
      validateFinishReason: true,
      strictFinishReasonValidation: process.env.RCC_STRICT_FINISH_REASON === 'true',
      ...config
    };

    this.logger = getLogger(port);

    if (this.config.debugMode) {
      this.logger.info('UnifiedCompatibilityPreprocessor initialized', {
        config: this.config,
        port
      });
    }
  }

  /**
   * 统一预处理入口：处理输入阶段数据
   */
  async preprocessInput(
    inputData: any,
    provider: string,
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
   */
  async preprocessResponse(
    responseData: any,
    provider: string,
    model: string,
    requestId: string
  ): Promise<any> {
    const context: PreprocessingContext = {
      requestId,
      provider,
      model,
      stage: 'response',
      timestamp: Date.now(),
      metadata: responseData.metadata
    };

    return this.processWithUnifiedPipeline(responseData, context);
  }

  /**
   * 统一预处理入口：处理流式数据块
   */
  async preprocessStreaming(
    chunkData: any,
    provider: string,
    model: string,
    requestId: string
  ): Promise<any> {
    const context: PreprocessingContext = {
      requestId,
      provider,
      model,
      stage: 'streaming',
      timestamp: Date.now(),
      metadata: chunkData.metadata
    };

    return this.processWithUnifiedPipeline(chunkData, context);
  }

  /**
   * 统一处理管道
   */
  private async processWithUnifiedPipeline(
    data: any,
    context: PreprocessingContext
  ): Promise<any> {
    const startTime = Date.now();
    let processedData = data;

    try {
      // 性能追踪
      if (this.config.performanceTracking) {
        this.performanceMetrics.totalProcessed++;
        this.performanceMetrics.byStage[context.stage].count++;
      }

      // 1. 检查是否启用
      if (!this.config.enabled) {
        if (this.config.debugMode) {
          this.logger.debug('UnifiedCompatibilityPreprocessor disabled, skipping', {
            requestId: context.requestId,
            provider: context.provider,
            model: context.model
          });
        }
        return data;
      }

      // 2. 缓存检查
      const cacheKey = this.generateCacheKey(data, context);
      if (this.config.cacheResults && this.processedCache.has(cacheKey)) {
        if (this.config.debugMode) {
          this.logger.debug('Using cached result', { cacheKey });
        }
        return this.processedCache.get(cacheKey);
      }

      // 3. 根据阶段进行不同的处理
      if (context.stage === 'response') {
        // 响应阶段处理
        processedData = await this.processResponse(data, context);
      } else if (context.stage === 'input') {
        // 输入阶段处理
        processedData = await this.processInput(data, context);
      } else if (context.stage === 'streaming') {
        // 流式处理
        processedData = await this.processStreaming(data, context);
      }

      // 4. 缓存结果
      if (this.config.cacheResults) {
        this.processedCache.set(cacheKey, processedData);
      }

      return processedData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('UnifiedCompatibilityPreprocessor processing failed', {
        error: errorMessage,
        requestId: context.requestId,
        provider: context.provider,
        model: context.model,
        stage: context.stage
      }, context.requestId, 'preprocessing');
      
      // 发生错误时返回原始数据
      return data;
    } finally {
      // 性能统计
      const duration = Date.now() - startTime;
      if (this.config.performanceTracking) {
        this.performanceMetrics.totalDuration += duration;
        this.performanceMetrics.byStage[context.stage].duration += duration;
      }
    }
  }

  /**
   * 处理响应数据
   */
  private async processResponse(data: any, context: PreprocessingContext): Promise<any> {
    let processedData = data;

    // 1. OpenAI兼容性处理 (ModelScope, ShuaiHong, LMStudio等)
    if (this.isOpenAICompatibleProvider(context.provider)) {
      processedData = await this.processOpenAICompatibleResponse(processedData, context);
    }

    // 2. Gemini格式修复
    if (this.isGeminiProvider(context.provider)) {
      processedData = await this.processGeminiResponse(processedData, context);
    }

    // 3. Anthropic工具调用文本修复
    if (this.needsAnthropicToolTextFix(processedData, context)) {
      processedData = await this.processAnthropicToolTextFix(processedData, context);
    }

    // 4. 强制工具调用检测和finish reason修复
    const toolDetectionResult = await this.forceToolCallDetection(processedData, context);
    if (toolDetectionResult.hasTools) {
      processedData = this.forceFinishReasonOverride(processedData, 'tool_calls', context);
      console.log(`🔧 [COMPATIBILITY] Forced finish_reason override for ${toolDetectionResult.toolCount} tools`);
    }

    // 5. 验证响应有效性
    if (this.config.validateFinishReason) {
      this.validateFinishReason(processedData, context);
    }

    return processedData;
  }

  /**
   * 处理输入数据
   */
  private async processInput(data: any, context: PreprocessingContext): Promise<any> {
    let processedData = data;

    // 1. ModelScope请求格式修复
    if (this.isModelScopeCompatible(context.provider, context.model)) {
      processedData = await this.processModelScopeRequest(processedData, context);
    }

    // 2. Gemini请求格式修复
    if (this.isGeminiProvider(context.provider)) {
      processedData = await this.processGeminiRequest(processedData, context);
    }

    // 3. 工具定义标准化
    if (processedData.tools && Array.isArray(processedData.tools)) {
      processedData.tools = this.standardizeToolDefinitions(processedData.tools, context);
    }

    return processedData;
  }

  /**
   * 处理流式数据
   */
  private async processStreaming(data: any, context: PreprocessingContext): Promise<any> {
    let processedData = data;

    // 流式数据中的工具调用检测
    if (this.hasStreamingToolCalls(data)) {
      processedData = await this.processStreamingToolCalls(processedData, context);
    }

    return processedData;
  }

  // ====================
  // OpenAI兼容性处理
  // ====================

  /**
   * 处理OpenAI兼容服务的响应格式问题
   */
  private async processOpenAICompatibleResponse(data: any, context: PreprocessingContext): Promise<any> {
    // ModelScope/ShuaiHong格式修复：解决"OpenAI response missing choices"错误
    if (data && typeof data === 'object' && !data.choices) {
      console.log(`🔧 [COMPATIBILITY] Applying OpenAI format patch for missing choices field`);
      console.log(`📍 [MODEL-MATCH] ${context.model} on ${context.provider}`);

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

      return fixedData;
    }

    // LMStudio特殊处理：解析嵌入的工具调用文本
    if (this.isLMStudioProvider(context.provider)) {
      return await this.processLMStudioResponse(data, context);
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
        console.log(`🔧 [COMPATIBILITY] Fixing incomplete choices format for ${context.provider}`);
        return {
          ...data,
          choices: fixedChoices
        };
      }
    }

    return data;
  }

  /**
   * LMStudio响应处理
   */
  private async processLMStudioResponse(data: any, context: PreprocessingContext): Promise<any> {
    // 处理OpenAI和Anthropic两种格式
    let textContent = '';
    let isOpenAIFormat = false;

    // 检查OpenAI格式
    if (data.choices && Array.isArray(data.choices) && data.choices.length > 0) {
      const choice = data.choices[0];
      textContent = choice.message?.content;
      isOpenAIFormat = true;
    }
    // 检查Anthropic格式  
    else if (data.content && Array.isArray(data.content)) {
      const textBlock = data.content.find((block: any) => block.type === 'text');
      textContent = textBlock?.text;
      isOpenAIFormat = false;
    }

    if (typeof textContent === 'string' && textContent.length > 0) {
      const lmstudioToolCalls = this.parseLMStudioToolCalls(textContent, context);

      if (lmstudioToolCalls.length > 0) {
        console.log(`🔧 [COMPATIBILITY] Parsed ${lmstudioToolCalls.length} LMStudio tool calls (${isOpenAIFormat ? 'OpenAI' : 'Anthropic'} format)`);

        // 清理工具调用标记
        let newContent = textContent;
        const lmstudioPattern = /<\|start\|>assistant<\|channel\|>commentary to=functions\.[^<]*\s*<\|constrain\|>[^<]*<\|message\|>\{[^}]*\}/g;
        newContent = newContent.replace(lmstudioPattern, '').trim();

        if (isOpenAIFormat) {
          // 返回OpenAI格式
          const choice = data.choices[0];
          return {
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
        } else {
          // 返回Anthropic格式
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

          return {
            ...data,
            content: newContentBlocks,
            stop_reason: 'tool_use'
          };
        }
      }
    }

    return data;
  }

  /**
   * ModelScope请求格式处理
   */
  private async processModelScopeRequest(data: any, context: PreprocessingContext): Promise<any> {
    if (!data) return data;

    let patchedRequest = { ...data };

    // 确保消息格式正确，特殊处理GLM-4.5和Qwen3-Coder
    if (patchedRequest.messages && Array.isArray(patchedRequest.messages)) {
      patchedRequest.messages = patchedRequest.messages.map((msg: any) => ({
        role: msg.role,
        content: this.ensureStringContentForModelScope(msg.content, context.model)
      }));

      // GLM-4.5特殊处理
      if (this.isGLMModel(context.model)) {
        patchedRequest = this.applyGLMSpecificPatches(patchedRequest, context);
      } 
      // Qwen3-Coder特殊处理
      else if (this.isQwen3CoderModel(context.model)) {
        patchedRequest = this.applyQwen3CoderSpecificPatches(patchedRequest, context);
      }

      // 构建prompt字符串作为备用
      const promptText = this.buildPromptFromMessages(patchedRequest.messages);
      if (promptText) {
        patchedRequest.prompt = promptText;
      }
    }

    // 确保必要参数
    if (!patchedRequest.max_tokens) {
      patchedRequest.max_tokens = 4096;
    }
    if (typeof patchedRequest.temperature === 'undefined') {
      patchedRequest.temperature = 0.7;
    }
    if (typeof patchedRequest.stream === 'undefined') {
      patchedRequest.stream = true;
    }

    return patchedRequest;
  }

  // ====================
  // Gemini格式处理
  // ====================

  /**
   * Gemini响应格式修复
   */
  private async processGeminiResponse(data: any, context: PreprocessingContext): Promise<any> {
    // 如果已经是标准格式，直接返回
    if (data.choices && Array.isArray(data.choices)) {
      return data;
    }

    const fixedData: any = {
      id: data.id || `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: context.model,
      choices: []
    };

    // 处理candidates字段
    if (data.candidates && Array.isArray(data.candidates)) {
      fixedData.choices = data.candidates.map((candidate: any, index: number) => {
        const choice: any = {
          index,
          message: {
            role: 'assistant',
            content: ''
          },
          finish_reason: this.mapGeminiFinishReason(candidate.finishReason)
        };

        // 处理content
        if (candidate.content && candidate.content.parts) {
          const textParts = candidate.content.parts
            .filter((part: any) => part.text)
            .map((part: any) => part.text);
          
          choice.message.content = textParts.join('\n');

          // 处理function calls
          const functionCalls = candidate.content.parts
            .filter((part: any) => part.functionCall);
          
          if (functionCalls.length > 0) {
            choice.message.tool_calls = functionCalls.map((part: any) => ({
              id: `call_${Math.random().toString(36).substr(2, 9)}`,
              type: 'function',
              function: {
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args || {})
              }
            }));
            choice.finish_reason = 'tool_calls';
          }
        }

        return choice;
      });
    }

    // 处理usage信息
    if (data.usageMetadata) {
      fixedData.usage = {
        prompt_tokens: data.usageMetadata.promptTokenCount || 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata.totalTokenCount || 0
      };
    }

    return fixedData;
  }

  /**
   * Gemini请求格式处理
   */
  private async processGeminiRequest(data: any, context: PreprocessingContext): Promise<any> {
    // Gemini请求格式转换逻辑
    return data; // TODO: 实现Gemini请求格式转换
  }

  // ====================
  // Anthropic工具调用文本修复
  // ====================

  /**
   * Anthropic工具调用文本修复
   */
  private async processAnthropicToolTextFix(data: any, context: PreprocessingContext): Promise<any> {
    if (!data.content || !Array.isArray(data.content)) {
      return data;
    }

    const fixedContent: any[] = [];
    let extractedToolCalls = 0;

    // 收集所有文本块到缓冲区进行批量处理
    const textBuffer: string[] = [];
    const nonTextBlocks: any[] = [];

    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        textBuffer.push(block.text);
      } else {
        nonTextBlocks.push(block);
      }
    }

    // 批量处理文本内容
    if (textBuffer.length > 0) {
      const combinedText = textBuffer.join('\n');
      const { textParts, toolCalls } = this.extractToolCallsFromText(combinedText);

      // 添加清理后的文本
      if (textParts.length > 0) {
        const cleanText = textParts.join('\n').trim();
        if (cleanText) {
          fixedContent.push({
            type: 'text',
            text: cleanText
          });
        }
      }

      // 添加提取的工具调用
      fixedContent.push(...toolCalls);
      extractedToolCalls += toolCalls.length;
    }

    // 添加非文本块
    fixedContent.push(...nonTextBlocks);

    const result = {
      ...data,
      content: fixedContent
    };

    // 更新finish reason
    if (extractedToolCalls > 0) {
      result.stop_reason = 'tool_use';
      console.log(`🔧 [COMPATIBILITY] Extracted ${extractedToolCalls} tool calls from text content`);
    }

    return result;
  }

  // ====================
  // 工具调用检测和修复
  // ====================

  /**
   * 强制工具调用检测
   */
  private async forceToolCallDetection(data: any, context: PreprocessingContext): Promise<{
    hasTools: boolean;
    toolCount: number;
  }> {
    let hasTools = false;
    let toolCount = 0;

    // 1. 检查Anthropic格式的工具调用
    if (data.content && Array.isArray(data.content)) {
      const directToolCalls = data.content.filter((block: any) => block.type === 'tool_use');
      toolCount += directToolCalls.length;

      // 检查文本格式的工具调用
      const textBlocks = data.content.filter((block: any) => block.type === 'text');
      for (const block of textBlocks) {
        if (block.text && this.hasTextToolCallsSimplified(block.text)) {
          hasTools = true;
        }
      }
    }

    // 2. 检查OpenAI格式的工具调用
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.message?.tool_calls) {
          toolCount += choice.message.tool_calls.length;
          hasTools = true;
        }
        
        if (choice.message?.content && this.hasTextToolCallsSimplified(choice.message.content)) {
          hasTools = true;
        }
      }
    }

    // 3. 检查Gemini格式的工具调用
    if (data.candidates && Array.isArray(data.candidates)) {
      for (const candidate of data.candidates) {
        if (candidate.content?.parts) {
          const functionCalls = candidate.content.parts.filter((part: any) => part.functionCall);
          toolCount += functionCalls.length;
          hasTools = hasTools || functionCalls.length > 0;
        }
      }
    }

    hasTools = hasTools || toolCount > 0;

    return { hasTools, toolCount };
  }

  /**
   * 强制finish reason覆盖
   */
  private forceFinishReasonOverride(data: any, targetReason: string, context: PreprocessingContext): any {
    const result = { ...data };

    // OpenAI格式
    if (data.choices && Array.isArray(data.choices)) {
      result.choices = data.choices.map((choice: any) => ({
        ...choice,
        finish_reason: targetReason
      }));
    }

    // Anthropic格式
    if (data.stop_reason !== undefined) {
      result.stop_reason = targetReason === 'tool_calls' ? 'tool_use' : targetReason;
    }

    return result;
  }

  // ====================
  // 辅助方法
  // ====================

  /**
   * 检查是否为OpenAI兼容Provider
   */
  private isOpenAICompatibleProvider(provider: string): boolean {
    return provider.includes('openai') || 
           provider.includes('lmstudio') ||
           provider.includes('modelscope') ||
           provider.includes('shuaihong') ||
           provider.includes('deepseek');
  }

  /**
   * 检查是否为LMStudio Provider
   */
  private isLMStudioProvider(provider: string): boolean {
    return provider.includes('lmstudio') || provider.includes('LMStudio');
  }

  /**
   * 检查是否为Gemini Provider
   */
  private isGeminiProvider(provider: string): boolean {
    return provider.includes('gemini') || provider.includes('palm') || provider.includes('bison');
  }

  /**
   * 检查是否需要Anthropic工具文本修复
   */
  private needsAnthropicToolTextFix(data: any, context: PreprocessingContext): boolean {
    if (!data.content || !Array.isArray(data.content)) {
      return false;
    }

    return data.content.some((block: any) => {
      if (block.type !== 'text' || !block.text) {
        return false;
      }

      // 检查是否包含工具调用文本模式
      const toolCallPatterns = [
        /\{\s*"type"\s*:\s*"tool_use"\s*,/i,
        /\{\s*"id"\s*:\s*"toolu_[^"]+"\s*,/i,
        /"name"\s*:\s*"[^"]+"\s*,\s*"input"\s*:\s*\{/i,
        /Tool\s+call:\s*\w+\s*\(\s*\{[^}]*"[^"]*":[^}]*\}/i,
        /\w+\s*\(\s*\{\s*"[^"]+"\s*:\s*"[^"]*"/i
      ];

      return toolCallPatterns.some(pattern => pattern.test(block.text));
    });
  }

  /**
   * 检查是否为ModelScope兼容的provider/model组合
   */
  private isModelScopeCompatible(provider: string, model: string): boolean {
    if (provider.includes('modelscope') || provider.includes('shuaihong')) {
      return true;
    }

    const modelLower = model.toLowerCase();
    return modelLower.includes('qwen') || 
           modelLower.includes('glm') || 
           modelLower.includes('zhipuai') ||
           modelLower.includes('coder');
  }

  /**
   * 检查是否为GLM模型
   */
  private isGLMModel(model: string): boolean {
    const modelLower = model.toLowerCase();
    return modelLower.includes('glm') || modelLower.includes('zhipuai');
  }

  /**
   * 检查是否为Qwen3-Coder模型
   */
  private isQwen3CoderModel(model: string): boolean {
    const modelLower = model.toLowerCase();
    return modelLower.includes('qwen3') ||
           modelLower.includes('coder') ||
           modelLower.includes('480b');
  }

  /**
   * 解析LMStudio工具调用格式
   */
  private parseLMStudioToolCalls(content: string, context: PreprocessingContext): any[] {
    const toolCalls: any[] = [];
    
    const lmstudioPattern = /<\|start\|>assistant<\|channel\|>commentary to=functions\.(\w+)\s*<\|constrain\|>(?:JSON|json)<\|message\|>(\{[^}]*\})/g;
    
    let match;
    while ((match = lmstudioPattern.exec(content)) !== null) {
      try {
        const functionName = match[1];
        const argsJson = match[2];
        const args = JSON.parse(argsJson);
        
        toolCalls.push({
          id: `call_${Date.now()}_${toolCalls.length}`,
          type: 'function',
          function: {
            name: functionName,
            arguments: JSON.stringify(args)
          }
        });
      } catch (error) {
        console.warn('Failed to parse LMStudio tool call:', error);
      }
    }
    
    return toolCalls;
  }

  /**
   * 从文本中提取工具调用
   */
  private extractToolCallsFromText(text: string): { textParts: string[], toolCalls: any[] } {
    const textParts: string[] = [];
    const toolCalls: any[] = [];

    // 1. GLM-4.5格式：Tool call: FunctionName({...})
    const glmPattern = /Tool\s+call:\s*(\w+)\s*\((\{[^}]*\})\)/gi;
    let match;
    while ((match = glmPattern.exec(text)) !== null) {
      try {
        const toolName = match[1];
        const jsonStr = match[2];
        const args = JSON.parse(jsonStr);
        
        toolCalls.push({
          type: 'tool_use',
          id: `toolu_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          name: toolName,
          input: args
        });
      } catch (error) {
        console.warn('Failed to parse GLM tool call:', match[2]);
      }
    }

    // 2. JSON格式：{"type": "tool_use", ...}
    const jsonPattern = /\{\s*"type"\s*:\s*"tool_use"[^}]*\}/gi;
    while ((match = jsonPattern.exec(text)) !== null) {
      try {
        const toolCallJson = JSON.parse(match[0]);
        if (this.isValidToolCall(toolCallJson)) {
          toolCalls.push({
            type: 'tool_use',
            id: toolCallJson.id,
            name: toolCallJson.name,
            input: toolCallJson.input
          });
        }
      } catch (error) {
        console.warn('Failed to parse JSON tool call:', match[0].substring(0, 50));
      }
    }

    // 清理文本内容
    if (toolCalls.length > 0) {
      let cleanedText = text;
      cleanedText = cleanedText.replace(/Tool\s+call:\s*\w+\s*\([^)]*\)/gi, '');
      cleanedText = cleanedText.replace(/\{\s*"type"\s*:\s*"tool_use"[^}]*\}/gi, '');
      cleanedText = cleanedText.replace(/\n\s*\n/g, '\n').trim();
      
      if (cleanedText && cleanedText.length > 10) {
        textParts.push(cleanedText);
      }
    } else {
      textParts.push(text);
    }

    return { textParts, toolCalls };
  }

  /**
   * 简化的文本工具调用检测
   */
  private hasTextToolCallsSimplified(text: string): boolean {
    const patterns = [
      /Tool\s+call:\s*\w+\s*\(/i,
      /"type"\s*:\s*"tool_use"/i,
      /"name"\s*:\s*"\w+"/i
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * 验证是否为有效的工具调用
   */
  private isValidToolCall(obj: any): boolean {
    return obj &&
           typeof obj === 'object' &&
           obj.type === 'tool_use' &&
           typeof obj.id === 'string' &&
           typeof obj.name === 'string' &&
           obj.input !== undefined;
  }

  /**
   * 标准化工具定义
   */
  private standardizeToolDefinitions(tools: any[], context: PreprocessingContext): any[] {
    return tools.map((tool: any) => ({
      type: 'function', // 确保有type字段
      ...tool,
      function: {
        ...tool.function,
        description: tool.function?.description || `Function: ${tool.function?.name || 'unknown'}`
      }
    }));
  }

  /**
   * 检查流式数据中是否有工具调用
   */
  private hasStreamingToolCalls(data: any): boolean {
    return data?.event && data?.data && (
      data.event.includes('tool') ||
      data.data.tool_calls ||
      data.data.function_call
    );
  }

  /**
   * 处理流式工具调用
   */
  private async processStreamingToolCalls(data: any, context: PreprocessingContext): Promise<any> {
    // TODO: 实现流式工具调用处理
    return data;
  }

  /**
   * 从非标准响应中提取内容
   */
  private extractContent(data: any): string | null {
    if (data.content) return data.content;
    if (data.message && typeof data.message === 'string') return data.message;
    if (data.text) return data.text;
    if (data.response) return data.response;
    if (data.output) return data.output;
    if (data.result?.content) return data.result.content;
    if (data.data?.content) return data.data.content;
    return null;
  }

  /**
   * 从非标准响应中提取工具调用
   */
  private extractToolCalls(data: any): any[] | null {
    if (data.tool_calls && Array.isArray(data.tool_calls)) return data.tool_calls;
    if (data.message?.tool_calls) return data.message.tool_calls;
    if (data.choices?.[0]?.message?.tool_calls) return data.choices[0].message.tool_calls;
    return null;
  }

  /**
   * 从非标准响应中提取finish_reason
   */
  private extractFinishReason(data: any): string {
    if (data.finish_reason) return data.finish_reason;
    if (data.stop_reason) return data.stop_reason;
    if (data.finishReason) return data.finishReason;
    if (data.status) return data.status;
    if (data.result?.finish_reason) return data.result.finish_reason;
    if (data.choices?.[0]?.finish_reason) return data.choices[0].finish_reason;
    if (this.extractToolCalls(data)) return 'tool_calls';
    return 'stop';
  }

  /**
   * 映射Gemini finish reason
   */
  private mapGeminiFinishReason(geminiReason: string): string {
    const reasonMap: Record<string, string> = {
      'STOP': 'stop',
      'MAX_TOKENS': 'length',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter',
      'OTHER': 'stop'
    };
    return reasonMap[geminiReason] || 'stop';
  }

  /**
   * 确保ModelScope内容为字符串格式
   */
  private ensureStringContentForModelScope(content: any, model: string): string {
    if (typeof content === 'string') return content;
    
    if (Array.isArray(content)) {
      return content.map(block => {
        if (block.type === 'text' && block.text) return block.text;
        if (block.type === 'tool_use') {
          return this.convertToolUseToModelScopeFormat(block, model);
        }
        return '';
      }).filter(text => text.trim()).join('\n');
    }

    if (typeof content === 'object' && content !== null) {
      if (content.text) return content.text;
      return JSON.stringify(content);
    }

    return String(content);
  }

  /**
   * 转换工具调用为ModelScope格式
   */
  private convertToolUseToModelScopeFormat(toolBlock: any, model: string): string {
    if (this.isGLMModel(model)) {
      const functionName = toolBlock.name || 'unknown';
      const inputData = JSON.stringify(toolBlock.input || {});
      return `Tool call: ${functionName}(${inputData})`;
    } else if (this.isQwen3CoderModel(model)) {
      return JSON.stringify({
        type: 'tool_use',
        name: toolBlock.name,
        input: toolBlock.input
      });
    }
    return JSON.stringify(toolBlock);
  }

  /**
   * 应用GLM特定的补丁
   */
  private applyGLMSpecificPatches(request: any, context: PreprocessingContext): any {
    const patchedRequest = { ...request };
    
    if (!patchedRequest.temperature) {
      patchedRequest.temperature = 0.8;
    }
    
    if (patchedRequest.tools && Array.isArray(patchedRequest.tools)) {
      patchedRequest.tools = patchedRequest.tools.map((tool: any) => ({
        ...tool,
        function: {
          ...tool.function,
          description: tool.function?.description || `Function: ${tool.function?.name || 'unknown'}`
        }
      }));
    }

    return patchedRequest;
  }

  /**
   * 应用Qwen3-Coder特定的补丁
   */
  private applyQwen3CoderSpecificPatches(request: any, context: PreprocessingContext): any {
    const patchedRequest = { ...request };
    
    if (!patchedRequest.temperature) {
      patchedRequest.temperature = 0.7;
    }
    
    if (patchedRequest.messages && Array.isArray(patchedRequest.messages)) {
      patchedRequest.messages = patchedRequest.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        ...(msg.role === 'system' && { name: 'system' })
      }));
    }

    return patchedRequest;
  }

  /**
   * 从消息构建prompt字符串
   */
  private buildPromptFromMessages(messages: any[]): string {
    if (!Array.isArray(messages) || messages.length === 0) return '';

    return messages.map(msg => {
      const role = msg.role;
      const content = msg.content;
      
      switch (role) {
        case 'system': return `System: ${content}`;
        case 'user': return `User: ${content}`;
        case 'assistant': return `Assistant: ${content}`;
        default: return `${role}: ${content}`;
      }
    }).join('\n\n');
  }

  /**
   * 验证finish reason
   */
  private validateFinishReason(data: any, context: PreprocessingContext): void {
    // 检查异常响应
    const abnormalResponse = this.detectAbnormalResponse(data, context);
    if (abnormalResponse) {
      const errorCode = abnormalResponse.statusCode || 500;
      const errorMessage = this.generateErrorMessage(abnormalResponse, context);
      
      this.logger.error('Abnormal API response detected', {
        error: errorMessage,
        errorCode,
        abnormalResponse,
        provider: context.provider,
        model: context.model,
        requestId: context.requestId
      }, context.requestId, 'preprocessing');

      if (this.config.strictFinishReasonValidation) {
        throw new Error(`${errorMessage} (Error Code: ${errorCode})`);
      }
      return;
    }

    // 验证正常响应的finish_reason
    this.validateNormalResponseFinishReason(data, context);
  }

  /**
   * 检测异常API响应
   */
  private detectAbnormalResponse(data: any, context: PreprocessingContext): any {
    if (data?.error) {
      return {
        type: 'api_error',
        statusCode: data.error.status || 500,
        message: data.error.message || 'API Error'
      };
    }
    
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return {
        type: 'empty_response',
        statusCode: 502,
        message: 'Empty or invalid response'
      };
    }
    
    if (data.status >= 400) {
      return {
        type: 'http_error',
        statusCode: data.status,
        message: data.message || 'HTTP Error'
      };
    }
    
    return null;
  }

  /**
   * 生成错误消息
   */
  private generateErrorMessage(abnormalResponse: any, context: PreprocessingContext): string {
    const baseMessage = `Provider returned unknown finish reason, indicating connection or API issue.`;
    const details = [
      `Provider: ${context.provider}`,
      `Model: ${context.model}`,
      `Type: ${abnormalResponse.type}`,
      `Status: ${abnormalResponse.statusCode}`
    ].join(', ');
    
    const fullMessage = `${baseMessage} Details: ${details}`;
    return fullMessage.length > 500 ? fullMessage.substring(0, 497) + '...' : fullMessage;
  }

  /**
   * 验证正常响应的finish_reason
   */
  private validateNormalResponseFinishReason(data: any, context: PreprocessingContext): void {
    if (data && typeof data === 'object' && 'choices' in data) {
      const choices = data.choices;
      if (Array.isArray(choices) && choices.length > 0) {
        const finishReason = choices[0].finish_reason;
        
        this.logger.info('Raw finish_reason detected', {
          originalFinishReason: finishReason,
          provider: context.provider,
          model: context.model,
          requestId: context.requestId,
          hasChoices: true,
          timestamp: new Date().toISOString()
        }, context.requestId, 'preprocessing');
        
        if (finishReason === 'unknown' && this.config.strictFinishReasonValidation) {
          const error = new Error(`Provider returned explicit unknown finish_reason. Provider: ${context.provider}, Model: ${context.model}`);
          this.logger.error('Strict finish_reason validation failed', {
            finishReason,
            provider: context.provider,
            model: context.model,
            requestId: context.requestId
          }, context.requestId, 'preprocessing');
          throw error;
        }
      }
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(data: any, context: PreprocessingContext): string {
    const dataHash = this.hashObject(data);
    return `${context.provider}-${context.model}-${context.stage}-${dataHash}`;
  }

  /**
   * 简单的对象哈希
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.processedCache.clear();
    this.performanceMetrics = {
      totalProcessed: 0,
      totalDuration: 0,
      byStage: {
        input: { count: 0, duration: 0 },
        response: { count: 0, duration: 0 },
        streaming: { count: 0, duration: 0 }
      }
    };
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }
}

// 单例模式
const preprocessorInstances = new Map<number | string, UnifiedCompatibilityPreprocessor>();

/**
 * 获取或创建统一兼容性预处理器实例
 */
export function getUnifiedCompatibilityPreprocessor(
  port?: number, 
  config?: Partial<UnifiedCompatibilityConfig>
): UnifiedCompatibilityPreprocessor {
  const key = port || 'default';
  if (!preprocessorInstances.has(key)) {
    preprocessorInstances.set(key, new UnifiedCompatibilityPreprocessor(port, config));
  }
  return preprocessorInstances.get(key)!;
}

/**
 * 创建新的统一兼容性预处理器实例
 */
export function createUnifiedCompatibilityPreprocessor(
  port?: number,
  config?: Partial<UnifiedCompatibilityConfig>
): UnifiedCompatibilityPreprocessor {
  const key = port || 'default';
  const instance = new UnifiedCompatibilityPreprocessor(port, config);
  preprocessorInstances.set(key, instance);
  return instance;
}

/**
 * 重置统一兼容性预处理器实例
 */
export function resetUnifiedCompatibilityPreprocessor(port?: number) {
  const key = port || 'default';
  if (preprocessorInstances.has(key)) {
    preprocessorInstances.get(key)!.cleanup();
    preprocessorInstances.delete(key);
  }
}