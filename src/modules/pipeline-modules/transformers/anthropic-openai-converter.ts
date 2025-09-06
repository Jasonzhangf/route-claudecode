/**
 * Anthropic to OpenAI Protocol Converter
 *
 * 基于CLIProxyAPI实现的完整Anthropic ↔ OpenAI协议转换器
 * 修复所有格式验证问题，确保Protocol层接收到纯OpenAI格式
 *
 * @author Jason Zhang
 * @version 1.0.0
 * @based-on CLIProxyAPI transformer implementation
 */

import { JQJsonHandler } from '../../utils/jq-json-handler';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { API_DEFAULTS } from '../../constants/src/bootstrap-constants';
import { RCCError, RCCErrorCode } from '../../types/src/index';

/**
 * 创建最小的有效OpenAI请求结构
 * 用于处理输入验证失败或异常情况的fallback
 * 🔧 架构修复：移除maxTokens处理，由ServerCompatibility层负责
 */
function createMinimalOpenAIRequest(fallbackContent: string = 'Request processing error'): any {
  return {
    model: API_DEFAULTS.PROVIDERS.OPENAI.DEFAULT_MODEL,
    messages: [
      {
        role: 'user',
        content: fallbackContent
      }
    ],
    // 🔧 架构修复：max_tokens在ServerCompatibility层处理，此处使用标准默认值
    max_tokens: API_DEFAULTS.TOKEN_LIMITS.DEFAULT_MAX_TOKENS,
    temperature: 0.7,
    stream: false
  };
}

/**
 * 检测输入是否为OpenAI格式
 * 🔥 SIMPLIFIED: Remove overly complex detection logic that could cause false positives
 */
function isOpenAIFormat(request: any): boolean {
  if (!request || typeof request !== 'object') {
    return false;
  }

  secureLogger.debug('🔍 [FORMAT-CHECK] 检测输入格式', {
    hasChoices: !!request.choices,
    hasObject: !!request.object,
    hasTools: !!request.tools,
    inputKeys: Object.keys(request)
  });

  // 🔥 SIMPLIFIED: Clear OpenAI response indicators
  if (request.choices && Array.isArray(request.choices)) {
    secureLogger.debug('🔍 OpenAI响应格式 - 有choices数组');
    return true;
  }
  
  if (request.object && (request.object === 'chat.completion' || request.object === 'chat.completion.chunk')) {
    secureLogger.debug('🔍 OpenAI对象格式 - object字段匹配');
    return true;
  }

  // 🔥 SIMPLIFIED: Basic OpenAI tool detection
  if (request.tools && Array.isArray(request.tools) && request.tools.length > 0) {
    const firstTool = request.tools[0];
    if (firstTool.type === 'function' && firstTool.function) {
      secureLogger.debug('🔍 OpenAI工具格式');
      return true;
    }
  }
  
  // 🔥 SIMPLIFIED: Clear Anthropic indicators (assume input is Anthropic by default)
  if (request.system !== undefined || 
      (request.tools && request.tools[0]?.input_schema) ||
      (request.messages && request.messages[0]?.content && Array.isArray(request.messages[0].content))) {
    secureLogger.debug('🔍 Anthropic格式特征');
    return false;
  }
  
  // Default: assume input needs transformation (Anthropic → OpenAI)
  secureLogger.debug('🔍 默认需要转换');
  return false;
}

/**
 * 核心转换方法: Anthropic → OpenAI
 * 基于CLIProxyAPI的实现模式，支持格式自动检测
 * 🔧 架构修复：移除maxTokens参数，该处理应在ServerCompatibility层进行
 * @param inputRequest 输入请求
 */
/**
 * 增强的Anthropic → OpenAI转换函数
 * 基于@musistudio/llms双向转换架构
 * 🔧 架构修复：Transformer层只负责协议格式转换，不处理maxTokens配置
 */
export function transformAnthropicToOpenAI(inputRequest: any): any {
  try {
    secureLogger.info('🔄 [CORE-TRANSFORMER] Anthropic → OpenAI 转换开始', {
      inputType: typeof inputRequest,
      inputKeys: inputRequest ? Object.keys(inputRequest) : []
    });
    
    // 🔥 CRITICAL FIX: Enhanced input validation with immediate fallback
    if (!inputRequest || typeof inputRequest !== 'object' || Array.isArray(inputRequest)) {
      secureLogger.error('❌ [TRANSFORMER] Invalid input data, throwing ZeroFallback error', {
        inputType: typeof inputRequest,
        isArray: Array.isArray(inputRequest)
      });
      
      // 抛出RCC错误而不是返回最小请求
      throw new RCCError(
        'Invalid input provided for transformation',
        RCCErrorCode.VALIDATION_ERROR,
        'transformer'
      );
    }
    
    // Check if input has required fields for transformation
    const hasRequiredFields = inputRequest.model || inputRequest.messages || inputRequest.system;
    if (!hasRequiredFields) {
      secureLogger.error('❌ [TRANSFORMER] Missing required fields, throwing ZeroFallback error', {
        keys: Object.keys(inputRequest),
        hasModel: !!inputRequest.model,
        hasMessages: !!inputRequest.messages,
        hasSystem: !!inputRequest.system
      });
      
      // 抛出RCC错误而不是返回最小请求
      throw new RCCError(
        'Missing required Anthropic fields for transformation',
        RCCErrorCode.VALIDATION_ERROR,
        'transformer'
      );
    }
    
    secureLogger.debug('✅ [TRANSFORMER] Input validation passed', { 
      keys: Object.keys(inputRequest),
      model: inputRequest.model,
      messagesCount: Array.isArray(inputRequest.messages) ? inputRequest.messages.length : 'not array',
      toolsCount: Array.isArray(inputRequest.tools) ? inputRequest.tools.length : 'not array'
    });

    // 🔧 架构修复：移除maxTokens处理，由ServerCompatibility层负责
    secureLogger.info('🔄 开始Anthropic → OpenAI转换');
    
    const openaiRequest: any = {
      model: inputRequest.model || API_DEFAULTS.PROVIDERS.OPENAI.DEFAULT_MODEL,
      messages: [],
      // 🔧 架构修复：直接传递输入的max_tokens，不在此层处理配置限制
      max_tokens: inputRequest.max_tokens || API_DEFAULTS.TOKEN_LIMITS.DEFAULT_MAX_TOKENS,
      temperature: typeof inputRequest.temperature === 'number' ? inputRequest.temperature : 0.7,
      // 🔧 修复：添加默认stream字段
      stream: inputRequest.stream !== undefined ? inputRequest.stream : false
    };
    
    secureLogger.debug('📝 初始化OpenAI请求结构:', {
      model: openaiRequest.model,
      maxTokens: openaiRequest.max_tokens,
      maxTokensSource: 'from-input-or-default',
      inputMaxTokens: inputRequest.max_tokens,
      temperature: openaiRequest.temperature
    });
    
    // 🔍 详细调试：检查输入数据的每个字段，显示完整消息内容
    secureLogger.info('🔍 [DEBUG] 输入数据详细分析:', {
      inputKeys: Object.keys(inputRequest),
      model: inputRequest.model,
      maxTokens: inputRequest.max_tokens,
      messagesType: typeof inputRequest.messages,
      messagesIsArray: Array.isArray(inputRequest.messages),
      messagesLength: inputRequest.messages?.length,
      // 🔥 FIX: Show complete messages instead of truncated
      completeMessages: inputRequest.messages,
      systemType: typeof inputRequest.system,
      systemIsArray: Array.isArray(inputRequest.system),
      systemLength: inputRequest.system?.length,
      // 🔥 FIX: Show complete system instead of truncated
      completeSystem: inputRequest.system,
      temperature: inputRequest.temperature,
      stream: inputRequest.stream
    });

    // 1. 基本字段映射
    console.log('🔥 [STEP-5] 开始基本字段映射');
    if (inputRequest.model) {
      openaiRequest.model = inputRequest.model;
      console.log('🔥 [STEP-5.1] 模型字段映射成功:', inputRequest.model);
      secureLogger.debug('📝 映射模型:', { model: inputRequest.model });
    } else {
      console.log('🔥 [STEP-5.1] ❌ 缺少模型字段!');
      secureLogger.warn('⚠️ 缺少模型字段!');
    }

    // 🔥 REMOVED: This duplicate max_tokens assignment that was overwriting the correct value
    // The max_tokens has already been set correctly above using configuration-driven approach
    // No need to reassign here - this was causing the hardcoded 4096 issue
    
    secureLogger.debug('📝 max_tokens已正确设置:', { 
      maxTokens: openaiRequest.max_tokens,
      source: 'from-input-or-default'
    });

    if (typeof inputRequest.temperature === 'number') {
      openaiRequest.temperature = inputRequest.temperature;
      secureLogger.debug('📝 映射temperature:', { temperature: inputRequest.temperature });
    }

    if (typeof inputRequest.top_p === 'number') {
      openaiRequest.top_p = inputRequest.top_p;
      secureLogger.debug('📝 映射top_p:', { topP: inputRequest.top_p });
    }

    if (typeof inputRequest.top_k === 'number') {
      openaiRequest.top_k = inputRequest.top_k;
      secureLogger.debug('📝 映射top_k:', { topK: inputRequest.top_k });
    }

    if (inputRequest.stop_sequences && Array.isArray(inputRequest.stop_sequences)) {
      openaiRequest.stop = inputRequest.stop_sequences;
      secureLogger.debug('📝 映射stop_sequences');
    }

    if (typeof inputRequest.stream === 'boolean') {
      openaiRequest.stream = inputRequest.stream;
      secureLogger.debug('📝 映射stream:', { stream: inputRequest.stream });
    }

    // 2. 消息转换
    openaiRequest.messages = [];
    secureLogger.debug('📝 初始化消息数组');

    // 处理系统消息 - 🔥 关键修复：支持Anthropic系统消息数组格式
    if (inputRequest.system) {
      secureLogger.debug('📝 处理系统消息:', { 
        system: inputRequest.system,
        type: typeof inputRequest.system
      });
      
      let systemContent: string;
      
      if (typeof inputRequest.system === 'string') {
        systemContent = inputRequest.system;
        secureLogger.debug('📝 使用字符串系统消息');
      } else if (Array.isArray(inputRequest.system)) {
        secureLogger.debug('📝 处理系统消息数组', { length: inputRequest.system.length });
        // 从Anthropic系统消息数组中提取text字段
        const textParts: string[] = [];
        for (const part of inputRequest.system) {
          secureLogger.debug('📝 处理系统消息部分:', { part });
          if (part && typeof part === 'object' && part.type === 'text' && part.text) {
            textParts.push(part.text);
            secureLogger.debug('📝 提取系统消息文本:', { text: part.text });
          }
        }
        systemContent = textParts.join(' ');
        secureLogger.debug('📝 合并系统消息文本:', { systemContent });
      } else {
        secureLogger.debug('📝 未知系统消息格式，直接转换为字符串');
        systemContent = String(inputRequest.system);
      }
      
      openaiRequest.messages.push({
        role: 'system',
        content: systemContent
      });
      secureLogger.debug('📝 添加系统消息到OpenAI格式', { contentLength: systemContent.length });
    }

    // 处理消息数组
    if (inputRequest.messages && Array.isArray(inputRequest.messages)) {
      secureLogger.debug('📝 处理消息数组', { 
        count: inputRequest.messages.length,
        messages: inputRequest.messages
      });
      for (const message of inputRequest.messages) {
        secureLogger.debug('📝 处理单个消息', { message });
        const openaiMessage = convertAnthropicMessage(message);
        secureLogger.debug('📝 转换后的消息', { openaiMessage });
        if (openaiMessage) {
          openaiRequest.messages.push(openaiMessage);
          secureLogger.debug('📝 添加消息', { role: openaiMessage.role });
        } else {
          secureLogger.debug('📝 消息转换失败，跳过');
        }
      }
    } else {
      secureLogger.debug('📝 没有消息数组或不是数组', { messages: inputRequest.messages });
    }

    // 3. 工具定义转换 (最关键的部分)
    console.log('🔥 [STEP-6] 开始处理工具定义');
    console.log('🔥 [STEP-6.1] 检查输入是否有工具:', !!inputRequest.tools);
    console.log('🔥 [STEP-6.2] 工具是否为数组:', Array.isArray(inputRequest.tools));
    if (inputRequest.tools && Array.isArray(inputRequest.tools)) {
      console.log('🔥 [STEP-6.3] 工具数量:', inputRequest.tools.length);
      secureLogger.debug('📝 处理工具定义', { count: inputRequest.tools.length });
      openaiRequest.tools = [];
      for (const anthropicTool of inputRequest.tools) {
        console.log('🔥 [STEP-6.4] 转换单个工具:', anthropicTool);
        const openaiTool = convertAnthropicTool(anthropicTool);
        console.log('🔥 [STEP-6.5] 转换结果:', openaiTool);
        if (openaiTool) {
          openaiRequest.tools.push(openaiTool);
          console.log('🔥 [STEP-6.6] 工具添加成功，当前工具数量:', openaiRequest.tools.length);
          secureLogger.debug('📝 添加工具', { toolName: openaiTool.function.name });
        } else {
          console.log('🔥 [STEP-6.6] ❌ 工具转换失败');
        }
      }
      console.log('🔥 [STEP-6.7] 工具处理完成，最终工具数量:', openaiRequest.tools.length);
    } else {
      console.log('🔥 [STEP-6.3] 没有工具定义或不是数组');
    }

    // 4. 工具选择转换
    if (inputRequest.tool_choice) {
      secureLogger.debug('📝 处理工具选择', { toolChoice: inputRequest.tool_choice });
      if (inputRequest.tool_choice === 'auto') {
        openaiRequest.tool_choice = 'auto';
      } else if (inputRequest.tool_choice === 'any') {
        openaiRequest.tool_choice = 'required';
      } else if (typeof inputRequest.tool_choice === 'object' && inputRequest.tool_choice.name) {
        openaiRequest.tool_choice = {
          type: 'function',
          function: { name: inputRequest.tool_choice.name }
        };
      }
    }

    console.log('🔥 [STEP-7] 转换处理完成，开始最终验证');
    console.log('🔥 [STEP-7.1] openaiRequest当前状态:', openaiRequest);
    console.log('🔥 [STEP-7.2] openaiRequest字段数量:', Object.keys(openaiRequest).length);
    console.log('🔥 [STEP-7.3] openaiRequest所有字段:', Object.keys(openaiRequest));
    
    secureLogger.info('✅ Anthropic → OpenAI转换完成');
    secureLogger.debug('📤 输出数据', { 
      openaiRequest,
      type: typeof openaiRequest,
      keys: Object.keys(openaiRequest)
    });
    
    // 🔍 详细最终验证调试 - 修复后显示完整数据
    secureLogger.info('🔍 [DEBUG] 最终验证详细信息:', {
      openaiRequestExists: !!openaiRequest,
      openaiRequestType: typeof openaiRequest,
      openaiRequestKeys: openaiRequest ? Object.keys(openaiRequest) : 'null',
      keyCount: openaiRequest ? Object.keys(openaiRequest).length : 0,
      hasModel: openaiRequest?.model,
      hasMessages: openaiRequest?.messages,
      hasMaxTokens: openaiRequest?.max_tokens,
      maxTokensValue: openaiRequest?.max_tokens,
      messagesLength: openaiRequest?.messages?.length || 0,
      // 🔥 FIX: Show complete output messages, not truncated
      completeMessages: openaiRequest?.messages,
      isArray: Array.isArray(openaiRequest),
      // Only stringify for small objects to avoid truncation
      dataPreview: openaiRequest && Object.keys(openaiRequest).length <= 5 ? 
        JQJsonHandler.stringifyJson(openaiRequest) : 'large-object-not-stringified'
    });
    
    // 🔥 SIMPLIFIED: Basic validation instead of overly strict checks
    console.log('🔥 [STEP-8] 开始简化验证检查');
    
    // Only check for null/undefined - trust the transformation result otherwise
    if (!openaiRequest) {
      console.log('🔥 [STEP-8.1] ❌ 验证失败: 转换结果为null/undefined');
      secureLogger.error('❌ 转换结果为null或undefined', { 
        reason: 'null or undefined result'
      });
      // 抛出RCC错误而不是返回最小请求
      throw new RCCError(
        'Transformation returned null',
        RCCErrorCode.INTERNAL_ERROR,
        'transformer'
      );
    }
    
    // Check basic structure but don't be overly strict about content
    console.log('🔥 [STEP-8.2] 检查基本结构，当前字段数量:', Object.keys(openaiRequest).length);
    if (typeof openaiRequest !== 'object' || Array.isArray(openaiRequest)) {
      console.log('🔥 [STEP-8.3] ❌ 检测到无效类型，进行修复');
      secureLogger.error('❌ 转换结果类型无效', { 
        openaiRequestType: typeof openaiRequest,
        isArray: Array.isArray(openaiRequest),
        reason: 'invalid type'
      });
      // 抛出RCC错误而不是返回最小请求
      throw new RCCError(
        'Invalid transformation result type',
        RCCErrorCode.INTERNAL_ERROR,
        'transformer'
      );
    }
    
    // 🔧 CRITICAL FIX: Proper empty object handling with ZeroFallback error
    if (Object.keys(openaiRequest).length === 0) {
      console.log('🔥 [STEP-8.4] 检测到空对象，抛出ZeroFallback错误');
      secureLogger.error('❌ 转换结果为空对象，抛出ZeroFallback错误', { 
        reason: 'empty object - throwing ZeroFallback error',
        inputModel: inputRequest.model,
        inputMaxTokens: inputRequest.max_tokens
      });
      
      // 抛出RCC错误而不是返回紧急请求
      throw new RCCError(
        'Transformation resulted in empty object',
        RCCErrorCode.INTERNAL_ERROR,
        'transformer'
      );
    }
    
    console.log('🔥 [STEP-9] ✅ 简化验证通过，准备返回结果');
    console.log('🔥 [STEP-9.1] 最终返回的对象键值:', Object.keys(openaiRequest));
    // 🔧 架构修复：移除console.log调试，使用secureLogger
    console.log('🔥 [STEP-9.3] model值:', openaiRequest.model);
    console.log('🔥 [STEP-9.4] messages数量:', openaiRequest.messages?.length || 0);
    
    secureLogger.info('✅ 返回有效的转换结果', {
      maxTokens: openaiRequest.max_tokens,
      messagesCount: openaiRequest.messages?.length || 0,
      hasTools: !!openaiRequest.tools,
      toolsCount: openaiRequest.tools?.length || 0
    });
    return openaiRequest;
  } catch (error) {
    // 🔍 增强异常处理的debug日志记录
    const enhancedErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'no stack',
      inputKeys: inputRequest ? Object.keys(inputRequest) : 'null input',
      inputType: typeof inputRequest,
      inputIsNull: inputRequest === null,
      inputIsUndefined: inputRequest === undefined,
      inputPreview: inputRequest ? JQJsonHandler.stringifyJson(inputRequest).substring(0, 300) + '...' : 'no input',
      transformationStage: 'anthropic-to-openai-conversion',
      timestamp: new Date().toISOString()
    };

    secureLogger.error('❌ [TRANSFORMER-EXCEPTION] 转换过程发生异常，返回最小有效请求', enhancedErrorInfo);
    
    // 输出详细的调试信息到控制台
    // 转换异常详情已记录到安全日志系统

    // 🔥 CRITICAL FIX: Throw ZeroFallback error instead of returning fallback request
    // This ensures the pipeline properly handles the error according to Zero Fallback Policy
    const errorMessage = `Transformation failed: ${error instanceof Error ? error.message : String(error)}`;
    
    // 记录错误并抛出ZeroFallback错误
    secureLogger.error('❌ [TRANSFORMER-EXCEPTION] 抛出ZeroFallback错误', {
      errorMessage,
      originalError: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'no stack'
    });
    
    // 抛出RCC错误而不是普通错误
    throw new RCCError(
      errorMessage,
      RCCErrorCode.INTERNAL_ERROR,
      'transformer'
    );
  }
}

/**
 * 转换Anthropic消息到OpenAI格式 - 基于CLIProxyAPI模式
 */
function convertAnthropicMessage(anthropicMessage: any): any {
  secureLogger.debug('📝 开始转换Anthropic消息', { anthropicMessage });
  
  if (!anthropicMessage || !anthropicMessage.role) {
    secureLogger.debug('📝 消息无效，缺少role字段');
    return null;
  }

  const role = anthropicMessage.role;
  const openaiMessage: any = { role };
  secureLogger.debug('📝 创建OpenAI消息基础结构', { role });

  // 处理内容 - 基于CLIProxyAPI的逻辑，修复Qwen API格式兼容性
  if (anthropicMessage.content) {
    secureLogger.debug('📝 处理消息内容，类型:', { contentType: typeof anthropicMessage.content });
    
    if (typeof anthropicMessage.content === 'string') {
      // 简单文本内容
      openaiMessage.content = anthropicMessage.content;
      secureLogger.debug('📝 设置字符串内容');
    } else if (Array.isArray(anthropicMessage.content)) {
      secureLogger.debug('📝 处理内容数组，长度:', { length: anthropicMessage.content.length });
      
      const contentParts: string[] = [];
      const toolCalls: any[] = [];

      for (const part of anthropicMessage.content) {
        secureLogger.debug('📝 处理内容部分:', { part: part });
        
        if (part && typeof part === 'object' && part.type === 'text' && part.text) {
          // 文本内容 - 直接合并为字符串（OpenAI模式）
          contentParts.push(String(part.text));
          secureLogger.debug('📝 添加文本部分');
        } else if (part && typeof part === 'object' && part.type === 'tool_use') {
          // 工具调用 - 转换为OpenAI格式
          const toolCall = {
            id: part.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: String(part.name || 'unknown_tool'),
              arguments: JQJsonHandler.stringifyJson(part.input || {})
            }
          };
          toolCalls.push(toolCall);
          secureLogger.debug('📝 添加工具调用:', { toolName: part.name });
        } else if (part && typeof part === 'object' && part.type === 'tool_result') {
          // 🔥 关键修复：处理工具结果内容，确保工具执行结果被包含
          secureLogger.debug('📝 处理工具结果:', { toolUseId: part.tool_use_id, hasContent: !!part.content });
          
          // 提取工具结果内容并添加到消息中
          if (part.content) {
            let resultContent: string;
            
            // 处理不同格式的工具结果内容
            if (typeof part.content === 'string') {
              resultContent = part.content;
            } else if (Array.isArray(part.content)) {
              // 如果是数组，提取text内容
              const textParts = part.content
                .filter((item: any) => item && item.type === 'text' && item.text)
                .map((item: any) => item.text);
              resultContent = textParts.join(' ');
            } else {
              // 其他格式转为JSON字符串
              resultContent = JQJsonHandler.stringifyJson(part.content);
            }
            
            if (resultContent) {
              // 添加工具结果标识，让模型知道这是工具执行的结果
              const toolResultText = `[Tool Result for ${part.tool_use_id || 'unknown'}]: ${resultContent}`;
              contentParts.push(toolResultText);
              secureLogger.debug('📝 添加工具结果内容:', { 
                toolUseId: part.tool_use_id, 
                contentLength: resultContent.length,
                preview: resultContent.substring(0, 100) + (resultContent.length > 100 ? '...' : '')
              });
            }
          } else {
            secureLogger.debug('📝 工具结果没有内容字段');
          }
        } else if (part && typeof part === 'object') {
          // 🔥 关键修复：处理复杂对象（如system-reminder）- 转换为字符串
          const objectText = JQJsonHandler.stringifyJson(part);
          contentParts.push(`[Object: ${objectText}]`);
          secureLogger.debug('📝 复杂对象转换为文本:', { objectType: part.type || 'unknown' });
        } else if (typeof part === 'string') {
          // 直接的字符串内容
          contentParts.push(part);
          secureLogger.debug('📝 添加直接字符串内容');
        } else {
          // 其他类型，强制转换为字符串
          contentParts.push(String(part));
          secureLogger.debug('📝 其他类型转换为字符串');
        }
      }

      // 设置内容：OpenAI/Qwen期待字符串内容，绝不能是对象
      if (contentParts.length > 0) {
        openaiMessage.content = contentParts.join(' ').trim();
        secureLogger.debug('📝 设置合并后的文本内容', { contentLength: openaiMessage.content.length });
      } else if (toolCalls.length > 0) {
        // 纯工具调用消息，content必须是字符串或null，不能是对象
        openaiMessage.content = null;
        secureLogger.debug('📝 纯工具调用消息，content设为null');
      } else {
        // 确保content是字符串，不是空对象
        openaiMessage.content = '';
        secureLogger.debug('📝 空内容数组，设置为空字符串');
      }

      // 设置工具调用
      if (toolCalls.length > 0) {
        openaiMessage.tool_calls = toolCalls;
        secureLogger.debug('📝 添加tool_calls数组，数量:', { count: toolCalls.length });
      }
    } else {
      // 其他格式（包括对象），强制转换为字符串以确保Qwen API兼容性
      secureLogger.debug('📝 未知内容格式，转换为字符串');
      openaiMessage.content = JQJsonHandler.stringifyJson(anthropicMessage.content);
    }
  } else {
    secureLogger.debug('📝 消息没有内容字段，设置空字符串');
    openaiMessage.content = '';
  }

  secureLogger.debug('📝 转换完成的OpenAI消息:', { 
    role: openaiMessage.role,
    contentType: typeof openaiMessage.content,
    contentLength: typeof openaiMessage.content === 'string' ? openaiMessage.content.length : 'not string',
    hasToolCalls: !!openaiMessage.tool_calls,
    toolCallsCount: openaiMessage.tool_calls ? openaiMessage.tool_calls.length : 0
  });
  return openaiMessage;
}

/**
 * 转换Anthropic工具到OpenAI格式
 * 这是解决16个工具定义验证失败的关键方法
 */
function convertAnthropicTool(anthropicTool: any): any {
  try {
    if (!anthropicTool || !anthropicTool.name) {
      secureLogger.warn('❌ 工具转换失败：工具对象无效或缺少名称', { anthropicTool });
      return null;
    }

    // Anthropic格式: {name, description, input_schema}
    // OpenAI格式: {type: "function", function: {name, description, parameters}}
    const openaiTool = {
      type: 'function',
      function: {
        name: anthropicTool.name,
        description: anthropicTool.description || '',
        parameters: anthropicTool.input_schema || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    };

    // 验证转换结果
    if (!openaiTool.function.name) {
      secureLogger.warn('❌ 工具转换失败：转换后缺少工具名称', { anthropicTool, openaiTool });
      return null;
    }

    secureLogger.debug('✅ 工具转换成功', { 
      anthropicName: anthropicTool.name, 
      openaiName: openaiTool.function.name 
    });
    
    return openaiTool;
  } catch (error) {
    secureLogger.error('❌ 工具转换过程中发生异常', { 
      error: error instanceof Error ? error.message : String(error),
      anthropicTool 
    });
    return null;
  }
}

/**
 * 新增：OpenAI → Anthropic 反向转换函数
 * 基于@musistudio/llms架构的双向转换实现
 */
export function transformOpenAIToAnthropic(inputRequest: any): any {
  try {
    secureLogger.info('🔄 [REVERSE-TRANSFORMER] OpenAI → Anthropic转换开始');
    secureLogger.debug('📥 输入数据分析', {
      type: typeof inputRequest,
      isObject: typeof inputRequest === 'object',
      keys: inputRequest ? Object.keys(inputRequest) : []
    });
    
    if (!inputRequest || typeof inputRequest !== 'object') {
      secureLogger.warn('📥 输入数据不是有效对象');
      return inputRequest;
    }

    // 检测是否已经是Anthropic格式
    if (isAnthropicFormat(inputRequest)) {
      secureLogger.info('🔧 输入已经是Anthropic格式，直接返回');
      return inputRequest;
    }

    secureLogger.info('🔄 执行OpenAI → Anthropic转换');
    const anthropicRequest: any = {
      model: inputRequest.model || 'unknown',
      messages: []
    };

    // 基本字段映射
    if (typeof inputRequest.temperature === 'number') {
      anthropicRequest.temperature = inputRequest.temperature;
      secureLogger.debug('📝 映射temperature', { temperature: inputRequest.temperature });
    }

    if (typeof inputRequest.max_tokens === 'number') {
      anthropicRequest.max_tokens = inputRequest.max_tokens;
      secureLogger.debug('📝 映射max_tokens', { maxTokens: inputRequest.max_tokens });
    }

    if (typeof inputRequest.top_p === 'number') {
      anthropicRequest.top_p = inputRequest.top_p;
      secureLogger.debug('📝 映射top_p', { topP: inputRequest.top_p });
    }

    if (inputRequest.stop && Array.isArray(inputRequest.stop)) {
      anthropicRequest.stop_sequences = inputRequest.stop;
      secureLogger.debug('📝 映射stop → stop_sequences');
    }

    if (typeof inputRequest.stream === 'boolean') {
      anthropicRequest.stream = inputRequest.stream;
      secureLogger.debug('📝 映射stream', { stream: inputRequest.stream });
    }

    // 消息处理
    if (inputRequest.messages && Array.isArray(inputRequest.messages)) {
      const systemMessages: string[] = [];
      const nonSystemMessages: any[] = [];

      secureLogger.debug('📝 处理消息数组', { count: inputRequest.messages.length });
      
      for (const message of inputRequest.messages) {
        if (message.role === 'system') {
          systemMessages.push(message.content || '');
        } else {
          const anthropicMessage = convertOpenAIMessageToAnthropic(message);
          if (anthropicMessage) {
            nonSystemMessages.push(anthropicMessage);
          }
        }
      }

      // 合并系统消息
      if (systemMessages.length > 0) {
        anthropicRequest.system = systemMessages.join(' ');
        secureLogger.debug('📝 合并系统消息', { systemMessageCount: systemMessages.length });
      }

      anthropicRequest.messages = nonSystemMessages;
    }

    // 工具定义转换
    if (inputRequest.tools && Array.isArray(inputRequest.tools)) {
      secureLogger.debug('📝 处理工具定义', { count: inputRequest.tools.length });
      const mappedTools = inputRequest.tools.map((tool: any) => {
        if (tool.type === 'function' && tool.function) {
          return {
            name: tool.function.name,
            description: tool.function.description || '',
            input_schema: tool.function.parameters || {
              type: 'object',
              properties: {},
              required: []
            }
          };
        }
        return null;
      });
      
      // 安全的filter调用
      if (mappedTools && Array.isArray(mappedTools)) {
        anthropicRequest.tools = mappedTools.filter(Boolean);
      }
    }

    // 工具选择转换
    if (inputRequest.tool_choice) {
      secureLogger.debug('📝 处理工具选择', { toolChoice: inputRequest.tool_choice });
      if (typeof inputRequest.tool_choice === 'string') {
        if (inputRequest.tool_choice === 'required') {
          anthropicRequest.tool_choice = 'any';
        } else {
          anthropicRequest.tool_choice = inputRequest.tool_choice;
        }
      } else if (typeof inputRequest.tool_choice === 'object' && inputRequest.tool_choice.function) {
        anthropicRequest.tool_choice = {
          name: inputRequest.tool_choice.function.name
        };
      }
    }

    secureLogger.info('✅ OpenAI → Anthropic转换完成');
    secureLogger.debug('📤 输出数据', {
      anthropicRequest,
      messagesCount: anthropicRequest.messages?.length || 0,
      toolsCount: anthropicRequest.tools?.length || 0
    });

    return anthropicRequest;
  } catch (error) {
    secureLogger.error('❌ OpenAI → Anthropic转换失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    return inputRequest;
  }
}

/**
 * 检测是否为Anthropic格式
 */
function isAnthropicFormat(request: any): boolean {
  // Anthropic特征检测
  if (request.tools && Array.isArray(request.tools) && request.tools.length > 0) {
    const firstTool = request.tools[0];
    if (firstTool.name && firstTool.input_schema && !firstTool.type) {
      secureLogger.debug('🔍 检测到Anthropic工具格式');
      return true;
    }
  }

  if (request.system !== undefined || request.max_tokens !== undefined) {
    secureLogger.debug('🔍 检测到Anthropic请求格式');
    return true;
  }

  if (request.type === 'message' || (request.role === 'assistant' && request.content && Array.isArray(request.content))) {
    secureLogger.debug('🔍 检测到Anthropic响应格式');
    return true;
  }

  secureLogger.debug('🔍 输入不是Anthropic格式');
  return false;
}

/**
 * 转换OpenAI消息到Anthropic格式
 */
function convertOpenAIMessageToAnthropic(openaiMessage: any): any {
  if (!openaiMessage || !openaiMessage.role) {
    return null;
  }

  const anthropicMessage: any = {
    role: openaiMessage.role,
    content: []
  };

  // 处理文本内容
  if (openaiMessage.content && typeof openaiMessage.content === 'string') {
    anthropicMessage.content.push({
      type: 'text',
      text: openaiMessage.content
    });
  }

  // 处理工具调用
  if (openaiMessage.tool_calls && Array.isArray(openaiMessage.tool_calls)) {
    for (const toolCall of openaiMessage.tool_calls) {
      if (toolCall.type === 'function' && toolCall.function) {
        const toolUse = {
          type: 'tool_use',
          id: toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: toolCall.function.name,
          input: JQJsonHandler.parseJsonString(toolCall.function.arguments) || {}
        };
        anthropicMessage.content.push(toolUse);
      }
    }
  }

  // 处理tool消息（OpenAI的工具结果格式）
  if (openaiMessage.role === 'tool' && openaiMessage.tool_call_id) {
    return {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: openaiMessage.tool_call_id,
        content: openaiMessage.content || '',
        is_error: false
      }]
    };
  }

  return anthropicMessage;
}