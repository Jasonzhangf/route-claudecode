/**
 * CodeWhisperer Request/Response Converter
 * Based on demo2 implementation with format conversion between Anthropic and CodeWhisperer
 */

import { BaseRequest, BaseResponse } from '@/types';
import { logger } from '@/utils/logger';
import { sessionManager } from '@/session/manager';
import { v4 as uuidv4 } from 'uuid';

// CodeWhisperer API types (from demo2)
export interface CodeWhispererRequest {
  conversationState: {
    chatTriggerType: string;
    conversationId: string;
    currentMessage: {
      userInputMessage: {
        content: string;
        modelId: string;
        origin: string;
        userInputMessageContext: {
          toolResults?: Array<{
            content: Array<{ text: string }>;
            status: string;
            toolUseId: string;
          }>;
          tools?: Array<{
            toolSpecification: {
              name: string;
              description: string;
              inputSchema: {
                json: Record<string, any>;
              };
            };
          }>;
        };
      };
    };
    history: any[];
  };
  profileArn: string;
}

export interface HistoryUserMessage {
  userInputMessage: {
    content: string;
    modelId: string;
    origin: string;
  };
}

export interface HistoryAssistantMessage {
  assistantResponseMessage: {
    content: string;
    toolUses: any[];
  };
}

// Model mapping from demo2
const MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3-5-haiku-20241022': 'CLAUDE_3_7_SONNET_20250219_V1_0',
  'claude-3-5-sonnet-20241022': 'CLAUDE_3_7_SONNET_20250219_V1_0',
  'claude-3-opus-20240229': 'CLAUDE_3_7_SONNET_20250219_V1_0'
};

export class CodeWhispererConverter {
  private profileArn: string;

  constructor(profileArn?: string) {
    this.profileArn = profileArn || 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK';
  }

  /**
   * Convert BaseRequest to CodeWhisperer format
   */
  convertRequest(request: BaseRequest, requestId: string): CodeWhispererRequest {
    try {
      logger.trace(requestId, 'converter', 'Converting request to CodeWhisperer format', {
        model: request.model,
        messageCount: request.messages.length
      });

      // Generate new conversation ID each time (like demo2 - more reliable for history handling)
      const providerConversationId = uuidv4();
      const sessionId = request.metadata?.sessionId;

      logger.debug('Generated new conversation ID for CodeWhisperer (demo2 style)', {
        sessionId,
        providerConversationId,
        reason: 'Each request gets fresh conversation ID with history in request body'
      }, requestId);

      const cwRequest: CodeWhispererRequest = {
        conversationState: {
          chatTriggerType: 'MANUAL',
          conversationId: providerConversationId,
          currentMessage: {
            userInputMessage: {
              content: this.extractMessageContent(request.messages[request.messages.length - 1].content),
              modelId: this.mapModel(request.model, request.metadata?.targetModel),
              origin: 'AI_EDITOR',
              userInputMessageContext: {}
            }
          },
          history: []
        },
        profileArn: this.profileArn
      };

      // Add tools if present
      if (request.metadata?.tools && Array.isArray(request.metadata.tools)) {
        cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools = 
          this.convertTools(request.metadata.tools);
      }

      // Build conversation history
      this.buildHistory(cwRequest, request, requestId);

      logger.trace(requestId, 'converter', 'Request converted successfully', {
        conversationId: cwRequest.conversationState.conversationId,
        modelId: cwRequest.conversationState.currentMessage.userInputMessage.modelId,
        hasTools: !!cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools?.length,
        historyLength: cwRequest.conversationState.history.length
      });

      return cwRequest;
    } catch (error) {
      logger.error('Failed to convert request', error, requestId, 'converter');
      throw error;
    }
  }

  /**
   * Map model names to CodeWhisperer internal format
   * NOTE: targetModel from routing contains the final API model name, 
   * but CodeWhisperer needs its internal model format
   */
  private mapModel(originalModel: string, targetModel?: string): string {
    // Determine which model to use for mapping
    const modelToMap = targetModel || originalModel;
    
    // If targetModel is provided (from routing), we need to map it to CodeWhisperer format
    if (targetModel) {
      // For CodeWhisperer provider, targetModel should be a CodeWhisperer model ID
      // Check if it's already in CodeWhisperer format
      if (targetModel.startsWith('CLAUDE_')) {
        logger.debug(`Target model is already in CodeWhisperer format: ${targetModel}`, {
          originalModel,
          targetModel
        });
        return targetModel;
      }
      
      // If targetModel is not in CodeWhisperer format, treat it as original model name
      logger.debug(`Target model '${targetModel}' not in CodeWhisperer format, mapping from original model`, {
        originalModel,
        targetModel,
        note: 'This case indicates routing config may have wrong model format for CodeWhisperer'
      });
    }
    
    // Map from Anthropic model names to CodeWhisperer format
    const mapped = MODEL_MAP[modelToMap];
    if (!mapped) {
      logger.warn(`Unknown model '${modelToMap}', using default CodeWhisperer model`, { 
        originalModel,
        targetModel,
        modelToMap
      });
      return MODEL_MAP['claude-sonnet-4-20250514'];
    }
    
    logger.debug(`Model mapped to CodeWhisperer format: ${modelToMap} -> ${mapped}`, {
      originalModel,
      targetModel,
      modelToMap,
      mapped
    });
    
    return mapped;
  }

  /**
   * Extract text content from message content (string or array)
   */
  private extractMessageContent(content: any): string {
    if (typeof content === 'string') {
      if (content.length === 0) {
        return 'answer for user qeustion';  // 完全模仿demo2的拼写错误
      }
      return content;
    }

    if (Array.isArray(content)) {
      const texts: string[] = [];
      
      content.forEach((block: any) => {
        if (block && typeof block === 'object') {
          switch (block.type) {
            case 'text':
              if (block.text) texts.push(block.text);
              break;
            case 'tool_result':
              if (block.content) {
                texts.push(typeof block.content === 'string' ? block.content : JSON.stringify(block.content));
              }
              break;
            case 'tool_use':
              // 处理工具调用 - 将其转换为文本描述
              if (block.name) {
                const toolCall = `Tool call: ${block.name}`;
                if (block.input) {
                  texts.push(`${toolCall}(${JSON.stringify(block.input)})`);
                } else {
                  texts.push(toolCall);
                }
              }
              break;
          }
        }
      });

      if (texts.length === 0) {
        return 'answer for user qeustion';  // 完全模仿demo2的拼写错误
      }
      return texts.join('\n');
    }

    // Fallback for unknown content format - 完全模仿demo2
    return 'answer for user qeustion';  // 完全模仿demo2的拼写错误
  }

  /**
   * Convert Anthropic tools to CodeWhisperer format
   */
  private convertTools(tools: any[]): any[] {
    return tools.map(tool => ({
      toolSpecification: {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          json: tool.input_schema || {}
        }
      }
    }));
  }

  /**
   * Build conversation history for CodeWhisperer (following demo2 logic exactly)
   */
  private buildHistory(cwRequest: CodeWhispererRequest, request: BaseRequest, requestId: string): void {
    const modelId = cwRequest.conversationState.currentMessage.userInputMessage.modelId;
    const hasSystemMessages = request.metadata?.system && Array.isArray(request.metadata.system) && request.metadata.system.length > 0;
    const hasMultipleMessages = request.messages.length > 1;

    logger.debug('History building analysis (demo2 style)', {
      totalMessages: request.messages.length,
      hasSystemMessages,
      systemMessageCount: hasSystemMessages ? request.metadata?.system?.length : 0,
      hasMultipleMessages,
      shouldBuildHistory: hasSystemMessages || hasMultipleMessages
    }, requestId);

    // Following demo2 logic: only build history if there are system messages OR multiple regular messages
    if (hasSystemMessages || hasMultipleMessages) {
      const history: any[] = [];
      
      // First add system messages as history (like demo2)
      const assistantDefaultMsg: HistoryAssistantMessage = {
        assistantResponseMessage: {
          content: 'I will follow these instructions',
          toolUses: []
        }
      };

      if (hasSystemMessages) {
        logger.debug('Processing system messages', {
          systemMessageCount: request.metadata?.system?.length
        }, requestId);
        
        request.metadata!.system!.forEach((sysMsg: any, index: number) => {
          const content = sysMsg.text || sysMsg;
          const userMsg: HistoryUserMessage = {
            userInputMessage: {
              content,
              modelId,
              origin: 'AI_EDITOR'
            }
          };
          history.push(userMsg);
          history.push(assistantDefaultMsg);
          
          logger.debug(`Added system message ${index}`, {
            content: typeof content === 'string' ? content.substring(0, 50) : 'complex',
            historyLength: history.length
          }, requestId);
        });
      }

      // Then process regular message history (like demo2)
      if (hasMultipleMessages) {
        logger.debug('Building history from request messages (demo2 style)', {
          totalMessages: request.messages.length,
          historyMessages: request.messages.length - 1
        }, requestId);

        for (let i = 0; i < request.messages.length - 1; i++) {
          const message = request.messages[i];
          
          logger.debug(`Processing history message ${i}`, {
            role: message.role,
            contentPreview: typeof message.content === 'string' 
              ? message.content.substring(0, 50) 
              : 'complex_content'
          }, requestId);
          
          if (message.role === 'user') {
            const content = this.extractMessageContent(message.content);
            const userMsg: HistoryUserMessage = {
              userInputMessage: {
                content,
                modelId,
                origin: 'AI_EDITOR'
              }
            };
            history.push(userMsg);
            
            logger.debug(`Added user history message ${i}`, {
              contentLength: content.length,
              historyLength: history.length
            }, requestId);

            // Check if next message is assistant response (like demo2)
            if (i + 1 < request.messages.length - 1 && request.messages[i + 1].role === 'assistant') {
              const assistantContent = this.extractMessageContent(request.messages[i + 1].content);
              const assistantMsg: HistoryAssistantMessage = {
                assistantResponseMessage: {
                  content: assistantContent,
                  toolUses: []
                }
              };
              history.push(assistantMsg);
              i++; // Skip the processed assistant message
              
              logger.debug(`Added assistant history message ${i}`, {
                contentLength: assistantContent.length,
                historyLength: history.length
              }, requestId);
            }
          }
        }
      }

      cwRequest.conversationState.history = history;
      
      logger.debug('Built conversation history', { 
        historyLength: history.length,
        systemMessages: hasSystemMessages ? request.metadata?.system?.length : 0,
        regularMessages: hasMultipleMessages ? request.messages.length - 1 : 0
      }, requestId, 'converter');
    } else {
      // No history needed for single message without system messages (like demo2)
      cwRequest.conversationState.history = [];
      logger.debug('No history needed - single message without system messages (demo2 style)', {}, requestId);
    }
  }

  /**
   * Update profile ARN
   */
  updateProfileArn(profileArn: string): void {
    this.profileArn = profileArn;
    logger.info('Updated CodeWhisperer profile ARN', { profileArn });
  }
}