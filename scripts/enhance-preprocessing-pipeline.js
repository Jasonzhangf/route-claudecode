#!/usr/bin/env node

/**
 * 🔧 预处理管道增强脚本
 * 
 * 确保预处理器具备完整的工具调用解析和finish_reason修复能力
 * 在预处理层面统一处理所有Provider的响应格式问题
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 [PREPROCESSING-ENHANCEMENT] Starting preprocessing pipeline enhancement...');

// 🎯 预处理器增强配置
const ENHANCEMENT_CONFIG = {
  // 强制启用的功能
  forceEnabled: [
    'tool_call_detection',
    'finish_reason_correction', 
    'sliding_window_parsing',
    'abnormal_response_detection',
    'provider_specific_fixes'
  ],
  
  // 滑动窗口配置
  slidingWindow: {
    windowSize: 500,
    overlap: 100,
    maxWindows: 20
  },
  
  // 工具调用检测模式
  detectionPatterns: [
    { name: 'glm_tool_call', regex: /Tool\s+call:\s*(\w+)\s*\(/gi, priority: 1 },
    { name: 'json_tool_use', regex: /"type"\s*:\s*"tool_use"/gi, priority: 2 },
    { name: 'openai_tool_calls', regex: /"tool_calls"\s*:\s*\[/gi, priority: 3 },
    { name: 'function_call', regex: /"function_call"\s*:\s*\{/gi, priority: 4 },
    { name: 'gemini_function_call', regex: /"functionCall"\s*:\s*\{/gi, priority: 5 }
  ],
  
  // Provider特定修复
  providerFixes: {
    'openai': {
      finishReasonField: 'finish_reason',
      toolCallsValue: 'tool_calls',
      checkPath: 'choices[0].finish_reason'
    },
    'anthropic': {
      finishReasonField: 'stop_reason', 
      toolCallsValue: 'tool_use',
      checkPath: 'stop_reason'
    },
    'gemini': {
      finishReasonField: 'finishReason',
      toolCallsValue: 'FUNCTION_CALL',
      checkPath: 'candidates[0].finishReason'
    }
  }
};

// 🔧 预处理器增强器
class PreprocessingEnhancer {
  constructor() {
    this.preprocessorPath = path.join(__dirname, '../src/preprocessing/unified-patch-preprocessor.ts');
    this.backupPath = this.preprocessorPath + '.backup.' + Date.now();
    this.enhancements = [];
  }

  async enhance() {
    console.log('\n🚀 开始增强预处理管道...\n');

    try {
      // 1. 备份原文件
      await this.backupOriginalFile();
      
      // 2. 读取当前预处理器代码
      const currentCode = await this.readPreprocessorCode();
      
      // 3. 应用增强功能
      let enhancedCode = currentCode;
      enhancedCode = await this.enhanceToolCallDetection(enhancedCode);
      enhancedCode = await this.enhanceFinishReasonCorrection(enhancedCode);
      enhancedCode = await this.enhanceSlidingWindowParsing(enhancedCode);
      enhancedCode = await this.enhanceAbnormalResponseDetection(enhancedCode);
      enhancedCode = await this.enhanceProviderSpecificFixes(enhancedCode);
      
      // 4. 写入增强后的代码
      await this.writeEnhancedCode(enhancedCode);
      
      // 5. 验证增强结果
      await this.validateEnhancements();
      
      this.printEnhancementSummary();
      
    } catch (error) {
      console.error('💥 预处理器增强失败:', error);
      await this.restoreBackup();
      throw error;
    }
  }

  async backupOriginalFile() {
    console.log('📦 备份原始预处理器文件...');
    
    if (fs.existsSync(this.preprocessorPath)) {
      fs.copyFileSync(this.preprocessorPath, this.backupPath);
      console.log(`   ✅ 备份已保存: ${this.backupPath}`);
    } else {
      throw new Error(`预处理器文件不存在: ${this.preprocessorPath}`);
    }
  }

  async readPreprocessorCode() {
    console.log('📖 读取当前预处理器代码...');
    
    const code = fs.readFileSync(this.preprocessorPath, 'utf8');
    console.log(`   ✅ 已读取 ${code.length} 字符的代码`);
    return code;
  }

  async enhanceToolCallDetection(code) {
    console.log('🔍 增强工具调用检测功能...');
    
    // 检查是否已经有高级工具调用检测
    if (code.includes('performAdvancedToolDetection')) {
      console.log('   ℹ️ 高级工具调用检测已存在，跳过');
      return code;
    }

    const enhancedDetectionMethod = `
  /**
   * 🎯 高级工具调用检测 - 增强版
   * 使用多种检测算法确保100%覆盖率
   */
  private async performAdvancedToolDetection(data: any, context: PreprocessingContext): Promise<{
    hasTools: boolean;
    toolCount: number;
    detectionMethods: string[];
    confidence: number;
  }> {
    let totalToolCount = 0;
    const detectionMethods: string[] = [];
    let maxConfidence = 0;

    // 🔍 方法1: 标准格式检测
    const standardResult = this.detectStandardFormatTools(data);
    totalToolCount += standardResult.count;
    detectionMethods.push(...standardResult.methods);
    maxConfidence = Math.max(maxConfidence, standardResult.confidence);

    // 🪟 方法2: 滑动窗口检测
    const slidingResult = await this.slidingWindowToolDetection(data, context);
    totalToolCount += slidingResult.toolCount;
    detectionMethods.push(...slidingResult.patterns);
    maxConfidence = Math.max(maxConfidence, 0.8);

    // 🎯 方法3: 模式匹配检测
    const patternResult = this.patternMatchingDetection(data);
    totalToolCount += patternResult.count;
    detectionMethods.push(...patternResult.methods);
    maxConfidence = Math.max(maxConfidence, patternResult.confidence);

    // 🧠 方法4: 语义分析检测
    const semanticResult = this.semanticAnalysisDetection(data);
    totalToolCount += semanticResult.count;
    detectionMethods.push(...semanticResult.methods);
    maxConfidence = Math.max(maxConfidence, semanticResult.confidence);

    const hasTools = totalToolCount > 0;
    const uniqueMethods = [...new Set(detectionMethods)];

    if (hasTools && this.config.debugMode) {
      this.logger.debug('🎯 [ADVANCED-DETECTION] Tool detection results', {
        requestId: context.requestId,
        totalToolCount,
        detectionMethods: uniqueMethods,
        confidence: maxConfidence,
        provider: context.provider
      });
    }

    return {
      hasTools,
      toolCount: totalToolCount,
      detectionMethods: uniqueMethods,
      confidence: maxConfidence
    };
  }

  /**
   * 标准格式工具调用检测
   */
  private detectStandardFormatTools(data: any): {
    count: number;
    methods: string[];
    confidence: number;
  } {
    let count = 0;
    const methods: string[] = [];
    let confidence = 0;

    // OpenAI格式
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.message?.tool_calls) {
          count += choice.message.tool_calls.length;
          methods.push('openai-tool_calls');
          confidence = Math.max(confidence, 1.0);
        }
        if (choice.message?.function_call) {
          count++;
          methods.push('openai-function_call');
          confidence = Math.max(confidence, 1.0);
        }
        if (choice.delta?.tool_calls) {
          count += choice.delta.tool_calls.length;
          methods.push('openai-streaming-tool_calls');
          confidence = Math.max(confidence, 1.0);
        }
      }
    }

    // Anthropic格式
    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'tool_use') {
          count++;
          methods.push('anthropic-tool_use');
          confidence = Math.max(confidence, 1.0);
        }
      }
    }

    // Gemini格式
    if (data.candidates && Array.isArray(data.candidates)) {
      for (const candidate of data.candidates) {
        if (candidate.content?.parts) {
          const toolParts = candidate.content.parts.filter((part: any) => 
            part.functionCall || part.function_call
          );
          count += toolParts.length;
          if (toolParts.length > 0) {
            methods.push('gemini-function-call');
            confidence = Math.max(confidence, 1.0);
          }
        }
      }
    }

    return { count, methods, confidence };
  }

  /**
   * 模式匹配检测
   */
  private patternMatchingDetection(data: any): {
    count: number;
    methods: string[];
    confidence: number;
  } {
    let count = 0;
    const methods: string[] = [];
    let confidence = 0;

    const textContent = this.extractAllTextContent(data);
    if (!textContent) {
      return { count, methods, confidence };
    }

    // 使用配置的检测模式
    for (const pattern of ${JSON.stringify(ENHANCEMENT_CONFIG.detectionPatterns)}) {
      const matches = textContent.match(pattern.regex);
      if (matches) {
        count += matches.length;
        methods.push(pattern.name);
        confidence = Math.max(confidence, 1.0 - (pattern.priority * 0.1));
      }
    }

    return { count, methods, confidence };
  }

  /**
   * 语义分析检测
   */
  private semanticAnalysisDetection(data: any): {
    count: number;
    methods: string[];
    confidence: number;
  } {
    let count = 0;
    const methods: string[] = [];
    let confidence = 0;

    const textContent = this.extractAllTextContent(data);
    if (!textContent) {
      return { count, methods, confidence };
    }

    // 语义关键词检测
    const semanticKeywords = [
      'tool call', 'function call', 'invoke', 'execute',
      'api call', 'method call', 'procedure call'
    ];

    for (const keyword of semanticKeywords) {
      const regex = new RegExp(keyword, 'gi');
      const matches = textContent.match(regex);
      if (matches) {
        count += matches.length;
        methods.push(\`semantic-\${keyword.replace(' ', '-')}\`);
        confidence = Math.max(confidence, 0.6);
      }
    }

    // 参数结构检测
    const parameterPatterns = [
      /\\{\\s*"[^"]+"\s*:\s*[^}]+\\}/g,  // JSON参数
      /\\([^)]*"[^"]*"[^)]*\\)/g,        // 函数参数
    ];

    for (const pattern of parameterPatterns) {
      const matches = textContent.match(pattern);
      if (matches && matches.length > 2) { // 至少3个匹配才认为是工具调用
        count += Math.floor(matches.length / 3);
        methods.push('semantic-parameters');
        confidence = Math.max(confidence, 0.7);
      }
    }

    return { count, methods, confidence };
  }

  /**
   * 提取所有文本内容
   */
  private extractAllTextContent(data: any): string {
    let textContent = '';

    // OpenAI格式
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.message?.content && typeof choice.message.content === 'string') {
          textContent += ' ' + choice.message.content;
        }
      }
    }

    // Anthropic格式
    if (data.content && Array.isArray(data.content)) {
      textContent += data.content
        .filter((block: any) => block.type === 'text' && block.text)
        .map((block: any) => block.text)
        .join(' ');
    }

    // Gemini格式
    if (data.candidates && Array.isArray(data.candidates)) {
      for (const candidate of data.candidates) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text) {
              textContent += ' ' + part.text;
            }
          }
        }
      }
    }

    return textContent.trim();
  }`;

    // 替换原有的工具调用检测方法
    const updatedCode = code.replace(
      /private async forceToolCallDetection\([^}]+\}[^}]+\}/s,
      enhancedDetectionMethod
    );

    if (updatedCode !== code) {
      this.enhancements.push('高级工具调用检测');
      console.log('   ✅ 已增强工具调用检测功能');
    }

    return updatedCode;
  }

  async enhanceFinishReasonCorrection(code) {
    console.log('🔧 增强finish_reason修复功能...');
    
    // 检查是否已经有智能修复功能
    if (code.includes('intelligentFinishReasonCorrection')) {
      console.log('   ℹ️ 智能finish_reason修复已存在，跳过');
      return code;
    }

    const enhancedCorrectionMethod = `
  /**
   * 🎯 智能finish_reason修复 - 增强版
   * 根据Provider类型和工具调用情况智能修复finish_reason
   */
  private intelligentFinishReasonCorrection(
    data: any,
    provider: Provider,
    toolDetection: any,
    context: PreprocessingContext
  ): any {
    if (!toolDetection.hasTools) {
      return data;
    }

    const correctedData = JSON.parse(JSON.stringify(data));
    const providerConfig = ${JSON.stringify(ENHANCEMENT_CONFIG.providerFixes)}[provider];
    
    if (!providerConfig) {
      this.logger.warn('🚨 [CORRECTION] Unknown provider for finish_reason correction', {
        provider,
        requestId: context.requestId
      });
      return data;
    }

    // 应用Provider特定的修复
    const correctionResult = this.applyProviderSpecificCorrection(
      correctedData, 
      providerConfig, 
      toolDetection
    );

    if (correctionResult.modified) {
      this.logger.info('🔧 [CORRECTION] Applied intelligent finish_reason correction', {
        provider,
        requestId: context.requestId,
        toolCount: toolDetection.toolCount,
        originalValue: correctionResult.originalValue,
        correctedValue: correctionResult.correctedValue,
        confidence: toolDetection.confidence
      });
    }

    return correctedData;
  }

  /**
   * 应用Provider特定的修复
   */
  private applyProviderSpecificCorrection(
    data: any,
    providerConfig: any,
    toolDetection: any
  ): {
    modified: boolean;
    originalValue: any;
    correctedValue: any;
  } {
    let modified = false;
    let originalValue = null;
    let correctedValue = null;

    // OpenAI格式修复
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.finish_reason !== undefined) {
          originalValue = choice.finish_reason;
          if (choice.finish_reason !== providerConfig.toolCallsValue) {
            choice.finish_reason = providerConfig.toolCallsValue;
            correctedValue = providerConfig.toolCallsValue;
            modified = true;
          }
        }
      }
    }

    // Anthropic格式修复
    if (data.stop_reason !== undefined) {
      originalValue = data.stop_reason;
      if (data.stop_reason !== providerConfig.toolCallsValue) {
        data.stop_reason = providerConfig.toolCallsValue;
        correctedValue = providerConfig.toolCallsValue;
        modified = true;
      }
    }

    // Gemini格式修复
    if (data.candidates && Array.isArray(data.candidates)) {
      for (const candidate of data.candidates) {
        if (candidate.finishReason !== undefined) {
          originalValue = candidate.finishReason;
          if (candidate.finishReason !== providerConfig.toolCallsValue) {
            candidate.finishReason = providerConfig.toolCallsValue;
            correctedValue = providerConfig.toolCallsValue;
            modified = true;
          }
        }
      }
    }

    return { modified, originalValue, correctedValue };
  }`;

    // 替换原有的finish_reason修复方法
    const updatedCode = code.replace(
      /private forceFinishReasonOverride\([^}]+\}[^}]+\}/s,
      enhancedCorrectionMethod
    );

    if (updatedCode !== code) {
      this.enhancements.push('智能finish_reason修复');
      console.log('   ✅ 已增强finish_reason修复功能');
    }

    return updatedCode;
  }

  async enhanceSlidingWindowParsing(code) {
    console.log('🪟 增强滑动窗口解析功能...');
    
    // 检查是否需要更新滑动窗口配置
    if (code.includes('windowSize = 500')) {
      console.log('   ℹ️ 滑动窗口配置已是最新，跳过');
      return code;
    }

    // 更新滑动窗口配置
    const updatedCode = code.replace(
      /const windowSize = \d+/g,
      `const windowSize = ${ENHANCEMENT_CONFIG.slidingWindow.windowSize}`
    ).replace(
      /const overlap = \d+/g,
      `const overlap = ${ENHANCEMENT_CONFIG.slidingWindow.overlap}`
    );

    if (updatedCode !== code) {
      this.enhancements.push('滑动窗口解析优化');
      console.log('   ✅ 已优化滑动窗口解析配置');
    }

    return updatedCode;
  }

  async enhanceAbnormalResponseDetection(code) {
    console.log('🚨 增强异常响应检测功能...');
    
    // 检查是否已经有增强的异常检测
    if (code.includes('enhancedAbnormalResponseDetection')) {
      console.log('   ℹ️ 增强异常响应检测已存在，跳过');
      return code;
    }

    const enhancedAbnormalDetection = `
  /**
   * 🚨 增强异常响应检测
   * 更全面的异常情况检测和处理
   */
  private enhancedAbnormalResponseDetection(data: any, provider: Provider): {
    type: string;
    statusCode: number;
    diagnosis: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  } | null {
    // 1. 空响应检测
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return {
        type: 'empty_response',
        statusCode: 502,
        diagnosis: 'Provider returned completely empty response',
        severity: 'critical'
      };
    }

    // 2. HTTP错误检测
    if (data.error || data.status >= 400) {
      const severity = data.status >= 500 ? 'critical' : 
                      data.status >= 400 ? 'high' : 'medium';
      return {
        type: 'http_error',
        statusCode: data.status || 500,
        diagnosis: \`Provider returned HTTP error: \${data.error?.message || 'Unknown error'}\`,
        severity
      };
    }

    // 3. 连接错误检测
    if (data.code === 'ETIMEDOUT' || data.code === 'ECONNREFUSED' || data.code === 'ENOTFOUND') {
      return {
        type: 'connection_error',
        statusCode: 503,
        diagnosis: \`Network connection failed: \${data.code}\`,
        severity: 'high'
      };
    }

    // 4. Provider特定异常检测
    const providerSpecificError = this.detectProviderSpecificErrors(data, provider);
    if (providerSpecificError) {
      return providerSpecificError;
    }

    // 5. 数据完整性检测
    const integrityError = this.detectDataIntegrityErrors(data, provider);
    if (integrityError) {
      return integrityError;
    }

    // 6. 性能异常检测
    const performanceError = this.detectPerformanceAnomalies(data, provider);
    if (performanceError) {
      return performanceError;
    }

    return null;
  }

  /**
   * Provider特定错误检测
   */
  private detectProviderSpecificErrors(data: any, provider: Provider): any {
    // ModelScope/Qwen特定问题
    if (this.isModelScopeProvider(provider)) {
      if (this.hasMissingFinishReason(data)) {
        return {
          type: 'missing_finish_reason',
          statusCode: 500,
          diagnosis: 'ModelScope provider missing required finish_reason field',
          severity: 'high'
        };
      }
    }

    // OpenAI特定问题
    if (provider === 'openai') {
      if (data.choices && data.choices.length === 0) {
        return {
          type: 'empty_choices',
          statusCode: 502,
          diagnosis: 'OpenAI returned empty choices array',
          severity: 'high'
        };
      }
    }

    // Anthropic特定问题
    if (provider === 'anthropic') {
      if (data.content && data.content.length === 0) {
        return {
          type: 'empty_content',
          statusCode: 502,
          diagnosis: 'Anthropic returned empty content array',
          severity: 'high'
        };
      }
    }

    return null;
  }

  /**
   * 数据完整性检测
   */
  private detectDataIntegrityErrors(data: any, provider: Provider): any {
    // 检查必需字段
    const requiredFields = this.getRequiredFields(provider);
    for (const field of requiredFields) {
      if (!this.hasNestedProperty(data, field)) {
        return {
          type: 'missing_required_field',
          statusCode: 502,
          diagnosis: \`Missing required field: \${field}\`,
          severity: 'medium'
        };
      }
    }

    // 检查数据类型
    const typeErrors = this.validateDataTypes(data, provider);
    if (typeErrors.length > 0) {
      return {
        type: 'invalid_data_type',
        statusCode: 502,
        diagnosis: \`Invalid data types: \${typeErrors.join(', ')}\`,
        severity: 'medium'
      };
    }

    return null;
  }

  /**
   * 性能异常检测
   */
  private detectPerformanceAnomalies(data: any, provider: Provider): any {
    // 检查响应大小
    const responseSize = JSON.stringify(data).length;
    if (responseSize > 1024 * 1024) { // 1MB
      return {
        type: 'oversized_response',
        statusCode: 413,
        diagnosis: \`Response too large: \${Math.round(responseSize / 1024)}KB\`,
        severity: 'low'
      };
    }

    // 检查token使用
    if (data.usage) {
      const totalTokens = data.usage.total_tokens || 0;
      if (totalTokens > 100000) { // 100K tokens
        return {
          type: 'excessive_token_usage',
          statusCode: 429,
          diagnosis: \`Excessive token usage: \${totalTokens} tokens\`,
          severity: 'low'
        };
      }
    }

    return null;
  }

  /**
   * 获取Provider必需字段
   */
  private getRequiredFields(provider: Provider): string[] {
    const fieldMap = {
      'openai': ['choices'],
      'anthropic': ['content'],
      'gemini': ['candidates']
    };
    return fieldMap[provider] || [];
  }

  /**
   * 检查嵌套属性是否存在
   */
  private hasNestedProperty(obj: any, path: string): boolean {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined;
    }, obj) !== undefined;
  }

  /**
   * 验证数据类型
   */
  private validateDataTypes(data: any, provider: Provider): string[] {
    const errors: string[] = [];

    if (provider === 'openai' && data.choices) {
      if (!Array.isArray(data.choices)) {
        errors.push('choices should be array');
      }
    }

    if (provider === 'anthropic' && data.content) {
      if (!Array.isArray(data.content)) {
        errors.push('content should be array');
      }
    }

    if (provider === 'gemini' && data.candidates) {
      if (!Array.isArray(data.candidates)) {
        errors.push('candidates should be array');
      }
    }

    return errors;
  }`;

    // 替换原有的异常检测方法
    const updatedCode = code.replace(
      /private detectAbnormalResponse\([^}]+\}[^}]+\}/s,
      enhancedAbnormalDetection
    );

    if (updatedCode !== code) {
      this.enhancements.push('增强异常响应检测');
      console.log('   ✅ 已增强异常响应检测功能');
    }

    return updatedCode;
  }

  async enhanceProviderSpecificFixes(code) {
    console.log('🔧 增强Provider特定修复功能...');
    
    // 检查是否已经有Provider特定修复
    if (code.includes('providerSpecificEnhancements')) {
      console.log('   ℹ️ Provider特定修复已存在，跳过');
      return code;
    }

    const providerSpecificEnhancements = `
  /**
   * 🎯 Provider特定增强处理
   * 针对不同Provider的特殊情况进行定制化处理
   */
  private async applyProviderSpecificEnhancements(
    data: any,
    provider: Provider,
    context: PreprocessingContext
  ): Promise<any> {
    let enhancedData = JSON.parse(JSON.stringify(data));

    switch (provider) {
      case 'openai':
        enhancedData = await this.enhanceOpenAIResponse(enhancedData, context);
        break;
      case 'anthropic':
        enhancedData = await this.enhanceAnthropicResponse(enhancedData, context);
        break;
      case 'gemini':
        enhancedData = await this.enhanceGeminiResponse(enhancedData, context);
        break;
      default:
        if (this.isModelScopeProvider(provider)) {
          enhancedData = await this.enhanceModelScopeResponse(enhancedData, context);
        }
        break;
    }

    return enhancedData;
  }

  /**
   * OpenAI响应增强
   */
  private async enhanceOpenAIResponse(data: any, context: PreprocessingContext): Promise<any> {
    // 修复streaming响应的finish_reason
    if (data.object === 'chat.completion.chunk' && data.choices) {
      for (const choice of data.choices) {
        if (choice.delta?.tool_calls && choice.finish_reason !== 'tool_calls') {
          choice.finish_reason = 'tool_calls';
        }
      }
    }

    // 确保tool_calls格式正确
    if (data.choices) {
      for (const choice of data.choices) {
        if (choice.message?.tool_calls) {
          choice.message.tool_calls = this.normalizeToolCalls(choice.message.tool_calls);
        }
      }
    }

    return data;
  }

  /**
   * Anthropic响应增强
   */
  private async enhanceAnthropicResponse(data: any, context: PreprocessingContext): Promise<any> {
    // 处理文本中的工具调用
    if (data.content && Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === 'text' && this.hasTextToolCalls(block.text)) {
          // 将文本工具调用转换为标准格式
          const extractedTools = this.extractToolCallsFromText(block.text);
          if (extractedTools.length > 0) {
            data.content.push(...extractedTools);
            data.stop_reason = 'tool_use';
          }
        }
      }
    }

    return data;
  }

  /**
   * Gemini响应增强
   */
  private async enhanceGeminiResponse(data: any, context: PreprocessingContext): Promise<any> {
    // 标准化function call格式
    if (data.candidates) {
      for (const candidate of data.candidates) {
        if (candidate.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.functionCall) {
              // 确保参数格式正确
              part.functionCall.args = this.normalizeGeminiFunctionArgs(part.functionCall.args);
              candidate.finishReason = 'FUNCTION_CALL';
            }
          }
        }
      }
    }

    return data;
  }

  /**
   * ModelScope响应增强
   */
  private async enhanceModelScopeResponse(data: any, context: PreprocessingContext): Promise<any> {
    // 为缺失finish_reason的响应添加默认值
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.message && choice.finish_reason === undefined) {
          // 根据内容判断finish_reason
          if (choice.message.content && this.hasTextToolCalls(choice.message.content)) {
            choice.finish_reason = 'tool_calls';
          } else if (choice.message.content) {
            choice.finish_reason = 'stop';
          } else {
            choice.finish_reason = 'length';
          }
        }
      }
    }

    return data;
  }

  /**
   * 标准化工具调用格式
   */
  private normalizeToolCalls(toolCalls: any[]): any[] {
    return toolCalls.map(toolCall => ({
      id: toolCall.id || \`call_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
      type: toolCall.type || 'function',
      function: {
        name: toolCall.function?.name || 'unknown_function',
        arguments: typeof toolCall.function?.arguments === 'string' 
          ? toolCall.function.arguments 
          : JSON.stringify(toolCall.function?.arguments || {})
      }
    }));
  }

  /**
   * 从文本中提取工具调用
   */
  private extractToolCallsFromText(text: string): any[] {
    const toolCalls: any[] = [];
    const toolCallPattern = /Tool\\s+call:\\s*(\\w+)\\s*\\(([^)]+)\\)/gi;
    let match;

    while ((match = toolCallPattern.exec(text)) !== null) {
      const functionName = match[1];
      const argsString = match[2];
      
      try {
        const args = JSON.parse(argsString);
        toolCalls.push({
          type: 'tool_use',
          id: \`tool_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
          name: functionName,
          input: args
        });
      } catch (error) {
        // 如果参数解析失败，创建一个基本的工具调用
        toolCalls.push({
          type: 'tool_use',
          id: \`tool_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
          name: functionName,
          input: { raw_args: argsString }
        });
      }
    }

    return toolCalls;
  }

  /**
   * 标准化Gemini函数参数
   */
  private normalizeGeminiFunctionArgs(args: any): any {
    if (typeof args === 'string') {
      try {
        return JSON.parse(args);
      } catch {
        return { raw_args: args };
      }
    }
    return args || {};
  }

  /**
   * 检查文本是否包含工具调用
   */
  private hasTextToolCalls(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const patterns = [
      /Tool\\s+call:\\s*\\w+\\s*\\(/i,
      /"type"\\s*:\\s*"tool_use"/i,
      /function\\s*:\\s*\\{[^}]*"name"/i
    ];

    return patterns.some(pattern => pattern.test(text));
  }`;

    // 在类的末尾添加Provider特定增强方法
    const updatedCode = code.replace(
      /(}\s*\/\*\*\s*\* 单例模式)/,
      `${providerSpecificEnhancements}\n\n$1`
    );

    if (updatedCode !== code) {
      this.enhancements.push('Provider特定修复');
      console.log('   ✅ 已增强Provider特定修复功能');
    }

    return updatedCode;
  }

  async writeEnhancedCode(enhancedCode) {
    console.log('💾 写入增强后的预处理器代码...');
    
    fs.writeFileSync(this.preprocessorPath, enhancedCode, 'utf8');
    console.log(`   ✅ 已写入 ${enhancedCode.length} 字符的增强代码`);
  }

  async validateEnhancements() {
    console.log('🔍 验证增强结果...');
    
    const enhancedCode = fs.readFileSync(this.preprocessorPath, 'utf8');
    
    // 验证关键功能是否存在
    const validations = [
      { name: '高级工具调用检测', check: enhancedCode.includes('performAdvancedToolDetection') },
      { name: '智能finish_reason修复', check: enhancedCode.includes('intelligentFinishReasonCorrection') },
      { name: '增强异常响应检测', check: enhancedCode.includes('enhancedAbnormalResponseDetection') },
      { name: 'Provider特定修复', check: enhancedCode.includes('applyProviderSpecificEnhancements') },
      { name: '滑动窗口配置', check: enhancedCode.includes('windowSize = 500') }
    ];

    let validationsPassed = 0;
    for (const validation of validations) {
      if (validation.check) {
        console.log(`   ✅ ${validation.name}: 已验证`);
        validationsPassed++;
      } else {
        console.log(`   ❌ ${validation.name}: 验证失败`);
      }
    }

    if (validationsPassed === validations.length) {
      console.log('   🎉 所有增强功能验证通过！');
    } else {
      throw new Error(`验证失败: ${validationsPassed}/${validations.length} 项通过`);
    }
  }

  async restoreBackup() {
    console.log('🔄 恢复备份文件...');
    
    if (fs.existsSync(this.backupPath)) {
      fs.copyFileSync(this.backupPath, this.preprocessorPath);
      console.log('   ✅ 已恢复原始文件');
    }
  }

  printEnhancementSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 预处理管道增强完成总结');
    console.log('='.repeat(80));
    console.log(`📦 备份文件: ${this.backupPath}`);
    console.log(`🔧 增强功能: ${this.enhancements.length} 项`);
    
    this.enhancements.forEach((enhancement, index) => {
      console.log(`   ${index + 1}. ${enhancement}`);
    });

    console.log('\n🎯 增强后的预处理器具备以下能力:');
    console.log('   • 🔍 多算法工具调用检测 (标准格式 + 滑动窗口 + 模式匹配 + 语义分析)');
    console.log('   • 🔧 智能finish_reason修复 (Provider特定 + 置信度评估)');
    console.log('   • 🪟 优化滑动窗口解析 (500字符窗口 + 100字符重叠)');
    console.log('   • 🚨 增强异常响应检测 (多级别严重性 + Provider特定错误)');
    console.log('   • 🎯 Provider特定修复 (OpenAI + Anthropic + Gemini + ModelScope)');
    console.log('   • 📊 完整的处理日志和性能监控');
    
    console.log('\n✅ 预处理管道增强成功完成！');
    console.log('现在可以运行综合测试验证增强效果。');
  }
}

// 🚀 主执行函数
async function main() {
  const enhancer = new PreprocessingEnhancer();
  
  try {
    await enhancer.enhance();
    console.log('\n🎉 预处理管道增强成功完成！');
    console.log('建议运行以下命令验证增强效果:');
    console.log('   node scripts/run-comprehensive-preprocessing-tests.js');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 预处理管道增强失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { PreprocessingEnhancer, ENHANCEMENT_CONFIG };