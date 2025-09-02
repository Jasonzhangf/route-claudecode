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
import { secureLogger } from '../../utils/secure-logger';
import { API_DEFAULTS } from '../../constants/api-defaults';

/**
 * 创建最小的有效OpenAI请求结构
 * 用于处理输入验证失败或异常情况的fallback
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
    max_tokens: 4096,
    temperature: 0.7,
    stream: false
  };
}

/**
 * 检测输入是否为OpenAI格式
 */
function isOpenAIFormat(request: any): boolean {
  secureLogger.debug('🔍 [FORMAT-CHECK] 开始检测输入格式', {
    hasChoices: !!request.choices,
    hasObject: !!request.object,
    hasTools: !!request.tools,
    toolsLength: request.tools ? request.tools.length : 0,
    firstToolType: request.tools?.[0]?.type,
    inputKeys: request ? Object.keys(request) : []
  });

  // 检查是否为OpenAI响应格式（最明确的标识）
  if (request.choices && Array.isArray(request.choices)) {
    secureLogger.debug('🔍 检测到OpenAI响应格式 - choices数组存在');
    return true;
  }
  
  // 检查是否为OpenAI格式的其他特征
  if (request.object && (request.object === 'chat.completion' || request.object === 'chat.completion.chunk')) {
    secureLogger.debug('🔍 检测到OpenAI对象格式 - object字段匹配');
    return true;
  }

  // 检查是否为OpenAI请求格式（工具）- 更严格的检查
  if (request.tools && Array.isArray(request.tools) && request.tools.length > 0) {
    const firstTool = request.tools[0];
    
    // OpenAI格式: {type: "function", function: {name, description, parameters}}
    if (firstTool.type === 'function' && firstTool.function && firstTool.function.parameters) {
      secureLogger.debug('🔍 检测到OpenAI工具格式 - type=function且有parameters');
      return true;
    }
  }
  
  // 🔥 关键修复：检查Anthropic特有字段，如果存在说明是Anthropic格式
  if (request.system !== undefined || 
      (request.messages && request.messages[0]?.content && Array.isArray(request.messages[0].content)) ||
      (request.tools && request.tools[0]?.input_schema)) {
    secureLogger.debug('🔍 检测到Anthropic特有字段，不是OpenAI格式');
    return false;
  }
  
  secureLogger.debug('🔍 输入不是OpenAI格式，需要转换');
  return false;
}

/**
 * 核心转换方法: Anthropic → OpenAI
 * 基于CLIProxyAPI的实现模式，支持格式自动检测
 * @param inputRequest 输入请求
 * @param maxTokens 可选的最大tokens限制
 */
/**
 * 增强的Anthropic → OpenAI转换函数
 * 基于@musistudio/llms双向转换架构
 */
export function transformAnthropicToOpenAI(inputRequest: any, maxTokens?: number): any {
  try {
    secureLogger.info('🔄 [TRANSFORMER] 开始转换过程');
    secureLogger.debug('📥 输入数据验证:', { 
      type: typeof inputRequest,
      isNull: inputRequest === null,
      isUndefined: inputRequest === undefined,
      isObject: typeof inputRequest === 'object' && !Array.isArray(inputRequest),
      hasKeys: inputRequest ? Object.keys(inputRequest).length > 0 : false
    });
    
    // 🔥 CRITICAL FIX: Enhanced input validation with immediate fallback
    if (!inputRequest || typeof inputRequest !== 'object' || Array.isArray(inputRequest)) {
      secureLogger.error('❌ [TRANSFORMER] Invalid input data, creating minimal OpenAI request', {
        inputType: typeof inputRequest,
        isArray: Array.isArray(inputRequest)
      });
      
      return createMinimalOpenAIRequest('Invalid input provided');
    }
    
    // Check if input has required fields for transformation
    const hasRequiredFields = inputRequest.model || inputRequest.messages || inputRequest.system;
    if (!hasRequiredFields) {
      secureLogger.error('❌ [TRANSFORMER] Missing required fields, creating minimal request', {
        keys: Object.keys(inputRequest),
        hasModel: !!inputRequest.model,
        hasMessages: !!inputRequest.messages,
        hasSystem: !!inputRequest.system
      });
      
      return createMinimalOpenAIRequest('Missing required Anthropic fields');
    }
    
    secureLogger.debug('✅ [TRANSFORMER] Input validation passed', { 
      keys: Object.keys(inputRequest),
      model: inputRequest.model,
      messagesCount: Array.isArray(inputRequest.messages) ? inputRequest.messages.length : 'not array',
      toolsCount: Array.isArray(inputRequest.tools) ? inputRequest.tools.length : 'not array'
    });

    // 🔥 ENHANCED: Start with validated base structure instead of empty object
    secureLogger.info('🔄 开始Anthropic → OpenAI转换');
    const openaiRequest: any = {
      model: inputRequest.model || API_DEFAULTS.PROVIDERS.OPENAI.DEFAULT_MODEL,
      messages: [],
      max_tokens: maxTokens ? Math.min(inputRequest.max_tokens || 4096, maxTokens) : (inputRequest.max_tokens || 4096),
      temperature: typeof inputRequest.temperature === 'number' ? inputRequest.temperature : 0.7
    };
    
    secureLogger.debug('📝 初始化OpenAI请求结构:', {
      model: openaiRequest.model,
      maxTokens: openaiRequest.max_tokens,
      temperature: openaiRequest.temperature
    });
    
    // 🔍 详细调试：检查输入数据的每个字段
    secureLogger.info('🔍 [DEBUG] 输入数据详细分析:', {
      inputKeys: Object.keys(inputRequest),
      model: inputRequest.model,
      maxTokens: inputRequest.max_tokens,
      messagesType: typeof inputRequest.messages,
      messagesIsArray: Array.isArray(inputRequest.messages),
      messagesLength: inputRequest.messages?.length,
      systemType: typeof inputRequest.system,
      systemIsArray: Array.isArray(inputRequest.system),
      systemLength: inputRequest.system?.length,
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

    if (typeof inputRequest.max_tokens === 'number') {
      // 应用maxTokens限制
      openaiRequest.max_tokens = maxTokens 
        ? Math.min(inputRequest.max_tokens, maxTokens)
        : inputRequest.max_tokens;
      secureLogger.debug('📝 映射max_tokens:', { maxTokens: openaiRequest.max_tokens });
    } else {
      openaiRequest.max_tokens = 4096;
      secureLogger.debug('📝 设置默认max_tokens:', { maxTokens: openaiRequest.max_tokens });
    }

    if (typeof inputRequest.temperature === 'number') {
      openaiRequest.temperature = inputRequest.temperature;
      secureLogger.debug('📝 映射temperature:', { temperature: inputRequest.temperature });
    }

    if (typeof inputRequest.top_p === 'number') {
      openaiRequest.top_p = inputRequest.top_p;
      secureLogger.debug('📝 映射top_p:', { topP: inputRequest.top_p });
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
    
    // 🔍 详细最终验证调试
    secureLogger.info('🔍 [DEBUG] 最终验证详细信息:', {
      openaiRequestExists: !!openaiRequest,
      openaiRequestType: typeof openaiRequest,
      openaiRequestKeys: openaiRequest ? Object.keys(openaiRequest) : 'null',
      keyCount: openaiRequest ? Object.keys(openaiRequest).length : 0,
      hasModel: openaiRequest?.model,
      hasMessages: openaiRequest?.messages,
      hasMaxTokens: openaiRequest?.max_tokens,
      messagesLength: openaiRequest?.messages?.length || 0,
      isArray: Array.isArray(openaiRequest),
      stringified: JSON.stringify(openaiRequest)
    });
    
    // 最终验证
    console.log('🔥 [STEP-8] 开始最终验证检查');
    if (!openaiRequest || typeof openaiRequest !== 'object') {
      console.log('🔥 [STEP-8.1] ❌ 验证失败: 不是有效对象');
      secureLogger.error('❌ 转换结果无效', { 
        openaiRequest,
        reason: 'not object or null'
      });
      return inputRequest;
    }
    
    console.log('🔥 [STEP-8.2] 检查是否为空对象，当前字段数量:', Object.keys(openaiRequest).length);
    if (Object.keys(openaiRequest).length === 0) {
      console.log('🔥 [STEP-8.3] ❌ 检测到空对象，进行紧急修复');
      secureLogger.error('❌ 转换结果为空对象，进行紧急修复', { 
        inputRequest,
        reason: 'zero keys',
        debugInfo: 'Emergency fallback - creating minimal OpenAI request'
      });
      
      // 🚨 紧急修复：当openaiRequest为空时，创建最小的有效OpenAI请求
      const emergencyOpenAIRequest: any = {
        model: inputRequest.model || API_DEFAULTS.PROVIDERS.OPENAI.DEFAULT_MODEL,
        messages: [],
        max_tokens: inputRequest.max_tokens || 4096,
        temperature: inputRequest.temperature || 0
      };
      
      // 复制系统消息
      if (inputRequest.system) {
        let systemContent: string;
        if (typeof inputRequest.system === 'string') {
          systemContent = inputRequest.system;
        } else if (Array.isArray(inputRequest.system)) {
          const textParts: string[] = [];
          for (const part of inputRequest.system) {
            if (part && typeof part === 'object' && part.type === 'text' && part.text) {
              textParts.push(part.text);
            }
          }
          systemContent = textParts.join(' ');
        } else {
          systemContent = String(inputRequest.system);
        }
        emergencyOpenAIRequest.messages.push({
          role: 'system',
          content: systemContent
        });
      }
      
      // 复制用户消息
      if (inputRequest.messages && Array.isArray(inputRequest.messages)) {
        for (const message of inputRequest.messages) {
          if (message && message.role && message.content) {
            if (typeof message.content === 'string') {
              emergencyOpenAIRequest.messages.push({
                role: message.role,
                content: message.content
              });
            } else if (Array.isArray(message.content)) {
              // 提取text内容
              const textContent = message.content
                .filter((part: any) => part.type === 'text' && part.text)
                .map((part: any) => part.text)
                .join(' ');
              if (textContent) {
                emergencyOpenAIRequest.messages.push({
                  role: message.role,
                  content: textContent
                });
              }
            }
          }
        }
      }
      
      console.log('🔥 [EMERGENCY-FIX] 创建的紧急修复请求:', JSON.stringify(emergencyOpenAIRequest, null, 2));
      secureLogger.info('🚨 使用紧急修复的OpenAI请求', {
        messageCount: emergencyOpenAIRequest.messages.length,
        model: emergencyOpenAIRequest.model
      });
      
      return emergencyOpenAIRequest;
    }
    
    console.log('🔥 [STEP-9] ✅ 验证通过，准备返回结果');
    console.log('🔥 [STEP-9.1] 最终返回的对象:', JSON.stringify(openaiRequest, null, 2));
    secureLogger.info('✅ 返回有效的转换结果');
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
      inputPreview: inputRequest ? JSON.stringify(inputRequest).substring(0, 300) + '...' : 'no input',
      transformationStage: 'anthropic-to-openai-conversion',
      timestamp: new Date().toISOString()
    };

    secureLogger.error('❌ [TRANSFORMER-EXCEPTION] 转换过程发生异常，返回最小有效请求', enhancedErrorInfo);
    
    // 输出详细的调试信息到控制台
    console.error('🔍 [TRANSFORMER-DEBUG] 异常详情:', {
      '异常类型': error instanceof Error ? error.constructor.name : typeof error,
      '异常消息': error instanceof Error ? error.message : String(error),
      '输入数据状态': {
        类型: typeof inputRequest,
        为空: !inputRequest,
        键数量: inputRequest && typeof inputRequest === 'object' ? Object.keys(inputRequest).length : 0,
        主要字段: inputRequest && typeof inputRequest === 'object' ? Object.keys(inputRequest).slice(0, 10) : []
      },
      '转换上下文': {
        模块: 'anthropic-openai-converter',
        阶段: 'anthropic-to-openai-conversion',
        时间戳: new Date().toISOString()
      }
    });

    // 🔥 CRITICAL FIX: Return valid OpenAI request instead of debug object
    // This ensures the pipeline can continue processing instead of failing
    const errorMessage = `Transformation failed: ${error instanceof Error ? error.message : String(error)}`;
    const fallbackRequest = createMinimalOpenAIRequest(errorMessage);
    
    // 记录fallback请求的生成
    secureLogger.info('🔧 [TRANSFORMER-FALLBACK] 生成fallback请求', {
      fallbackRequest,
      originalErrorMessage: errorMessage,
      fallbackKeys: Object.keys(fallbackRequest)
    });
    
    console.log('🔧 [TRANSFORMER-DEBUG] Fallback请求已生成:', JSON.stringify(fallbackRequest, null, 2));
    
    return fallbackRequest;
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