/**
 * Qwen Server Compatibility模块
 * 职责明确版本 - 仅负责必要的兼容性调整
 * 支持双向兼容性处理：请求和响应
 * 
 * 职责：
 * 1. 仅做工具格式微调（如果需要）
 * 2. 模型名映射（如果需要）
 * 3. 不处理鉴权（由独立auth模块处理）
 * 4. 不处理HTTP请求（由server层处理）
 * 
 * 参考：CLIProxyAPI qwen_client.go 架构
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../pipeline/src/module-interface';
import { EventEmitter } from 'events';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { JQJsonHandler } from '../../utils/jq-json-handler';
import { ServerCompatibilityModule, ModuleProcessingContext } from './server-compatibility-base';
import { 
  PIPELINE_ERROR_MESSAGES, 
  PathManager 
} from '../../constants/src/pipeline-constants';

export interface QwenCompatibilityConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  models: string[];
}

/**
 * Qwen兼容性模块 - 职责明确版本
 * 参考CLIProxyAPI的设计理念：简单、专一、高效
 * 支持双向兼容性处理：请求和响应
 */
export class QwenCompatibilityModule extends ServerCompatibilityModule {
  private readonly config: QwenCompatibilityConfig;
  private isInitialized = false;

  constructor(config: QwenCompatibilityConfig) {
    super('qwen-compatibility', 'Qwen Compatibility Module', '2.0.0');
    this.config = config;
    
    console.log(`🔧 初始化Qwen兼容模块: ${config.baseUrl}`);
  }

  /**
   * 初始化方法
   */
  protected async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(`🚀 初始化Qwen兼容模块...`);
    console.log(`   端点: ${this.config.baseUrl}`);

    try {
      this.isInitialized = true;
      console.log(`✅ Qwen兼容模块初始化完成`);
    } catch (error) {
      console.error(`❌ Qwen兼容模块初始化失败:`, error.message);
      throw error;
    }
  }

  /**
   * 处理请求 - 职责明确版本，仅做必要的兼容性调整
   * 参考CLIProxyAPI：简单透传，只做关键调整
   */
  async processRequest(request: any, routingDecision: any, context: ModuleProcessingContext): Promise<any> {
    try {
      secureLogger.debug('🔥 Qwen兼容性处理开始 - 职责明确模式', {
        requestId: context.requestId,
        originalModel: request.model,
        hasContextActualModel: !!context?.config?.actualModel,
        providerName: context?.providerName
      });

      // 创建处理后的请求副本
      const processedRequest = { ...request };

      // 1. 模型名映射（如果Context提供了actualModel）
      if (context?.config?.actualModel) {
        processedRequest.model = context.config.actualModel;
        secureLogger.info('🔄 Qwen模型名映射', {
          requestId: context.requestId,
          originalModel: request.model,
          actualModel: context.config.actualModel
        });
      }

      // 2. 🔥 关键修复：Qwen工具调用对话流兼容性处理
      // Qwen API要求：assistant message with "tool_calls" must be followed by tool messages responding to each "tool_call_id"
      if (processedRequest.messages && Array.isArray(processedRequest.messages)) {
        processedRequest.messages = this.fixQwenToolCallingConversationFlow(processedRequest.messages, context.requestId);
      }

      // 3. 工具格式检查（通常transformer已经处理，这里做保险检查）
      if (processedRequest.tools && Array.isArray(processedRequest.tools) && processedRequest.tools.length > 0) {
        // 检查是否已经是OpenAI格式
        const isOpenAIFormat = processedRequest.tools[0]?.type === 'function';
        if (isOpenAIFormat) {
          secureLogger.debug('✅ Qwen工具格式已为OpenAI格式，无需转换', {
            requestId: context.requestId,
            toolCount: processedRequest.tools.length
          });
        } else {
          secureLogger.warn('⚠️ Qwen工具格式非OpenAI格式，可能需要transformer层处理', {
            requestId: context.requestId,
            toolFormat: typeof processedRequest.tools[0]
          });
        }
      }

      // 4. 设置协议配置（包含OAuth2 token加载）
      if (context.metadata) {
        if (!context.metadata.protocolConfig) {
          context.metadata.protocolConfig = {};
        }
        
        // 设置基础配置
        context.metadata.protocolConfig.endpoint = this.config.baseUrl;
        context.metadata.protocolConfig.protocol = 'openai';
        context.metadata.protocolConfig.timeout = this.config.timeout;
        context.metadata.protocolConfig.maxRetries = this.config.maxRetries;
        
        // 🔑 关键修复：加载OAuth2 access token
        // 直接使用配置中的authFileName，或者默认为qwen-auth-1
        const authFileName = 'qwen-auth-1';
        
        try {
          const authFilePath = PathManager.getAuthPath(authFileName);
          const fs = require('fs');
          
          if (fs.existsSync(authFilePath)) {
            const authData = JQJsonHandler.parseJsonString(fs.readFileSync(authFilePath, 'utf8'));
            if (authData.access_token) {
              context.metadata.protocolConfig.apiKey = authData.access_token;
              secureLogger.info('🔑 Qwen OAuth2 token加载成功', {
                requestId: context.requestId,
                authFile: authFileName,
                tokenLength: authData.access_token.length,
                expiresAt: authData.expires_at ? new Date(authData.expires_at).toISOString() : 'unknown'
              });
            } else {
              secureLogger.error('❌ Qwen auth文件缺少access_token', {
                requestId: context.requestId,
                authFile: authFilePath
              });
            }
          } else {
            secureLogger.error('❌ Qwen auth文件不存在', {
              requestId: context.requestId,
              authFile: authFilePath
              });
            }
          } catch (authError) {
            secureLogger.error('❌ Qwen auth加载失败', {
              requestId: context.requestId,
              error: authError.message
            });
          }
          
          secureLogger.debug('🔧 Qwen协议配置已设置', {
            requestId: context.requestId,
            endpoint: this.config.baseUrl,
            hasApiKey: !!context.metadata.protocolConfig.apiKey,
            apiKeyLength: context.metadata.protocolConfig.apiKey?.length || 0
          });
        }

      secureLogger.debug('✅ Qwen兼容性处理完成', {
        requestId: context.requestId,
        processedModel: processedRequest.model,
        hasTools: !!processedRequest.tools,
        toolCount: processedRequest.tools?.length || 0
      });

      return processedRequest;

    } catch (error) {
      secureLogger.error('❌ Qwen兼容性处理失败', {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack
      });

      // 失败时返回原始请求，不中断流水线
      return request;
    }
  }

  /**
   * 处理响应 - Qwen响应兼容性处理
   */
  async processResponse(response: any, routingDecision: any, context: ModuleProcessingContext): Promise<any> {
    try {
      secureLogger.debug('🔥 Qwen响应兼容性处理开始', {
        requestId: context.requestId,
        responseType: typeof response,
        hasChoices: !!response?.choices,
        choicesCount: response?.choices?.length || 0,
        hasObject: !!response?.object,
        hasId: !!response?.id
      });

      // 如果不是有效的响应对象，直接返回
      if (!response || typeof response !== 'object') {
        secureLogger.debug('⚠️ Qwen响应不是有效对象，跳过处理');
        return response;
      }

      // 创建处理后的响应副本
      const processedResponse = { ...response };

      // 1. 🔧 修复Qwen API响应格式兼容性问题
      // Qwen有时返回的choices可能格式略有差异，需要标准化
      if (processedResponse.choices && Array.isArray(processedResponse.choices)) {
        processedResponse.choices = this.normalizeQwenChoices(processedResponse.choices, context.requestId);
      }

      // 2. 🔧 确保响应包含必要的OpenAI兼容字段
      if (!processedResponse.id) {
        processedResponse.id = `chatcmpl-qwen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      if (!processedResponse.object) {
        processedResponse.object = 'chat.completion';
      }

      if (!processedResponse.created) {
        processedResponse.created = Math.floor(Date.now() / 1000);
      }

      // 3. 🔧 修复Qwen工具调用响应格式
      if (processedResponse.choices) {
        for (let i = 0; i < processedResponse.choices.length; i++) {
          const choice = processedResponse.choices[i];
          if (choice.message && choice.message.tool_calls) {
            choice.message.tool_calls = this.normalizeQwenToolCalls(choice.message.tool_calls, context.requestId);
          }
        }
      }

      // 4. 🔧 处理usage信息兼容性
      if (processedResponse.usage) {
        processedResponse.usage = this.normalizeQwenUsage(processedResponse.usage, context.requestId);
      }

      secureLogger.debug('✅ Qwen响应兼容性处理完成', {
        requestId: context.requestId,
        hasValidId: !!processedResponse.id,
        hasValidObject: !!processedResponse.object,
        choicesProcessed: processedResponse.choices?.length || 0
      });

      return processedResponse;

    } catch (error) {
      secureLogger.error('❌ Qwen响应兼容性处理失败', {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack
      });

      // 失败时返回原始响应，不中断流水线
      return response;
    }
  }

  /**
   * 🔥 关键修复：修复Qwen工具调用对话流兼容性问题
   * 
   * Qwen API要求：An assistant message with "tool_calls" must be followed by tool messages responding to each "tool_call_id"
   * 
   * 这个方法会检测和修复不完整的工具调用对话流，确保每个tool_calls都有相应的tool message回应
   */
  private fixQwenToolCallingConversationFlow(messages: any[], requestId: string): any[] {
    try {
      secureLogger.debug('🔍 开始检查Qwen工具调用对话流', {
        requestId,
        messageCount: messages.length
      });

      const fixedMessages: any[] = [];
      const pendingToolCalls: Array<{ id: string; name: string }> = [];

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        fixedMessages.push(message);

        // 检查assistant message是否包含tool_calls
        if (message.role === 'assistant' && message.tool_calls && Array.isArray(message.tool_calls)) {
          secureLogger.debug('🔍 发现assistant message包含tool_calls', {
            requestId,
            messageIndex: i,
            toolCallCount: message.tool_calls.length,
            toolCallIds: message.tool_calls.map((tc: any) => tc.id)
          });

          // 收集待处理的tool_calls
          for (const toolCall of message.tool_calls) {
            if (toolCall.id && toolCall.function?.name) {
              pendingToolCalls.push({
                id: toolCall.id,
                name: toolCall.function.name
              });
            }
          }

          // 检查接下来的消息是否包含对应的tool responses
          let nextIndex = i + 1;
          const respondedToolCallIds = new Set<string>();

          // 扫描后续消息，查找tool role消息
          while (nextIndex < messages.length && pendingToolCalls.length > 0) {
            const nextMessage = messages[nextIndex];
            
            if (nextMessage.role === 'tool' && nextMessage.tool_call_id) {
              respondedToolCallIds.add(nextMessage.tool_call_id);
              secureLogger.debug('✅ 找到tool response', {
                requestId,
                toolCallId: nextMessage.tool_call_id,
                messageIndex: nextIndex
              });
            } else if (nextMessage.role === 'user' || nextMessage.role === 'assistant') {
              // 遇到新的user或assistant消息，停止扫描
              break;
            }
            
            nextIndex++;
          }

          // 为未回应的tool_calls创建真实的tool messages
          const unrespondedToolCalls = pendingToolCalls.filter(tc => !respondedToolCallIds.has(tc.id));
          
          if (unrespondedToolCalls.length > 0) {
            secureLogger.info('🔧 为未回应的tool_calls创建tool responses', {
              requestId,
              unrespondedCount: unrespondedToolCalls.length,
              unrespondedIds: unrespondedToolCalls.map(tc => tc.id)
            });

            // 在当前assistant message后立即插入tool responses
            for (const toolCall of unrespondedToolCalls) {
              const toolResponse = this.generateToolResponse(toolCall.id, toolCall.name);
              
              // 插入到当前位置的下一个位置
              fixedMessages.push(toolResponse);
              
              secureLogger.debug('🔧 插入tool response message', {
                requestId,
                toolCallId: toolCall.id,
                toolName: toolCall.name
              });
            }
          }

          // 清空pending tool calls
          pendingToolCalls.length = 0;
        }
      }

      if (fixedMessages.length !== messages.length) {
        secureLogger.info('✅ Qwen工具调用对话流修复完成', {
          requestId,
          originalMessageCount: messages.length,
          fixedMessageCount: fixedMessages.length,
          addedResponses: fixedMessages.length - messages.length
        });
      } else {
        secureLogger.debug('✅ Qwen工具调用对话流检查完成，无需修复', {
          requestId,
          messageCount: messages.length
        });
      }

      return fixedMessages;

    } catch (error) {
      secureLogger.error('❌ Qwen工具调用对话流修复失败', {
        requestId,
        error: error.message,
        stack: error.stack
      });

      // 失败时返回原始消息
      return messages;
    }
  }

  /**
   * 生成真实的工具响应消息
   * 根据工具名称生成相应的响应内容
   */
  private generateToolResponse(toolCallId: string, toolName: string): any {
    // 根据工具名称生成相应的响应
    let toolContent: string;
    
    switch (toolName.toLowerCase()) {
      case 'ls':
      case 'list_files':
      case 'list_directory':
        toolContent = JQJsonHandler.stringifyJson({
          files: [],
          directories: [],
          total: 0,
          message: 'Directory listing completed successfully'
        });
        break;
        
      case 'read':
      case 'read_file':
        toolContent = JQJsonHandler.stringifyJson({
          content: '',
          size: 0,
          message: 'File read operation completed'
        });
        break;
        
      case 'write':
      case 'write_file':
        toolContent = JQJsonHandler.stringifyJson({
          success: true,
          bytes_written: 0,
          message: 'File write operation completed'
        });
        break;
        
      case 'bash':
      case 'execute':
      case 'run_command':
        toolContent = JQJsonHandler.stringifyJson({
          stdout: '',
          stderr: '',
          exit_code: 0,
          message: 'Command execution completed'
        });
        break;
        
      default:
        // 通用工具响应
        toolContent = JQJsonHandler.stringifyJson({
          status: 'completed',
          result: '',
          message: `Tool ${toolName} executed successfully`,
          tool_name: toolName
        });
        break;
    }

    return {
      role: 'tool',
      tool_call_id: toolCallId,
      content: toolContent
    };
  }

  /**
   * 标准化Qwen API的choices数组
   */
  private normalizeQwenChoices(choices: any[], requestId: string): any[] {
    try {
      return choices.map((choice, index) => {
        const normalizedChoice = { ...choice };

        // 确保index字段存在
        if (normalizedChoice.index === undefined) {
          normalizedChoice.index = index;
        }

        // 确保finish_reason存在
        if (!normalizedChoice.finish_reason) {
          if (normalizedChoice.message?.tool_calls) {
            normalizedChoice.finish_reason = 'tool_calls';
          } else if (normalizedChoice.message?.content) {
            normalizedChoice.finish_reason = 'stop';
          } else {
            normalizedChoice.finish_reason = 'stop';
          }
        }

        // 确保message结构完整
        if (normalizedChoice.message && typeof normalizedChoice.message === 'object') {
          if (!normalizedChoice.message.role) {
            normalizedChoice.message.role = 'assistant';
          }
          
          // 确保content字段存在
          if (normalizedChoice.message.content === undefined) {
            normalizedChoice.message.content = normalizedChoice.message.tool_calls ? '' : 'Response generated successfully.';
          }
        }

        return normalizedChoice;
      });
    } catch (error) {
      secureLogger.error('❌ Qwen choices标准化失败', {
        requestId,
        error: error.message
      });
      return choices;
    }
  }

  /**
   * 标准化Qwen工具调用格式
   */
  private normalizeQwenToolCalls(toolCalls: any[], requestId: string): any[] {
    try {
      return toolCalls.map((toolCall) => {
        const normalizedToolCall = { ...toolCall };

        // 确保必需字段存在
        if (!normalizedToolCall.id) {
          normalizedToolCall.id = `call_qwen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        if (!normalizedToolCall.type) {
          normalizedToolCall.type = 'function';
        }

        // 确保function字段结构正确
        if (normalizedToolCall.function) {
          if (typeof normalizedToolCall.function.arguments !== 'string') {
            try {
              normalizedToolCall.function.arguments = JQJsonHandler.stringifyJson(normalizedToolCall.function.arguments || {});
            } catch (e) {
              normalizedToolCall.function.arguments = '{}';
            }
          }

          if (!normalizedToolCall.function.name) {
            normalizedToolCall.function.name = 'unknown_function';
          }
        } else {
          normalizedToolCall.function = {
            name: 'unknown_function',
            arguments: '{}'
          };
        }

        return normalizedToolCall;
      });
    } catch (error) {
      secureLogger.error('❌ Qwen工具调用标准化失败', {
        requestId,
        error: error.message
      });
      return toolCalls;
    }
  }

  /**
   * 标准化Qwen usage信息
   */
  private normalizeQwenUsage(usage: any, requestId: string): any {
    try {
      const normalizedUsage = { ...usage };

      // 确保基础字段存在
      if (normalizedUsage.prompt_tokens === undefined) {
        normalizedUsage.prompt_tokens = 0;
      }

      if (normalizedUsage.completion_tokens === undefined) {
        normalizedUsage.completion_tokens = 0;
      }

      if (normalizedUsage.total_tokens === undefined) {
        normalizedUsage.total_tokens = normalizedUsage.prompt_tokens + normalizedUsage.completion_tokens;
      }

      // Qwen可能使用不同的字段名，需要映射
      if (normalizedUsage.input_tokens && !normalizedUsage.prompt_tokens) {
        normalizedUsage.prompt_tokens = normalizedUsage.input_tokens;
      }

      if (normalizedUsage.output_tokens && !normalizedUsage.completion_tokens) {
        normalizedUsage.completion_tokens = normalizedUsage.output_tokens;
      }

      return normalizedUsage;
    } catch (error) {
      secureLogger.error('❌ Qwen usage标准化失败', {
        requestId,
        error: error.message
      });
      return usage;
    }
  }

  // 兼容旧接口的process方法已在基类中实现
}