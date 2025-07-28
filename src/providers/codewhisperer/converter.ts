/**
 * CodeWhisperer Request/Response Converter
 * Based on demo2 implementation with format conversion between Anthropic and CodeWhisperer
 */

import { BaseRequest, BaseResponse, AnthropicRequest } from '@/types';
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

// No model mapping needed - routing engine handles model selection
// CodeWhisperer converter should use the model name provided by routing engine directly

export class CodeWhispererConverter {
  private profileArn: string;

  constructor(profileArn?: string) {
    if (!profileArn) {
      throw new Error('CodeWhisperer profileArn is required but not provided');
    }
    this.profileArn = profileArn;
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
              modelId: request.model, // Use model name directly from routing engine
              origin: 'AI_EDITOR',
              userInputMessageContext: {}
            }
          },
          history: []
        },
        profileArn: this.profileArn
      };

      const anthropicReq = request as AnthropicRequest;

      // Add tools if present
      if (anthropicReq.tools && Array.isArray(anthropicReq.tools)) {
        cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools = 
          this.convertTools(anthropicReq.tools);
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
   * Extract text content from message content (string or array)
   */
  private extractMessageContent(content: any): string {
    if (typeof content === 'string') {
      const reminderEndTag = '</system-reminder>';
      const lastIndex = content.lastIndexOf(reminderEndTag);
      let userMessage = content;

      if (lastIndex !== -1) {
        userMessage = content.substring(lastIndex + reminderEndTag.length).trim();
      }

      if (userMessage.length === 0) {
        return 'answer for user qeustion';  // 完全模仿demo2的拼写错误
      }
      return userMessage;
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
    const anthropicReq = request as AnthropicRequest;
    const modelId = cwRequest.conversationState.currentMessage.userInputMessage.modelId;
    const hasSystemMessages = anthropicReq.system && Array.isArray(anthropicReq.system) && anthropicReq.system.length > 0;
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
          systemMessageCount: anthropicReq.system?.length
        }, requestId);
        
        anthropicReq.system!.forEach((sysMsg: any, index: number) => {
          const content = this.extractMessageContent(sysMsg.text || sysMsg);
          const userMsg: HistoryUserMessage = {
            userInputMessage: {
              content,
              modelId: cwRequest.conversationState.currentMessage.userInputMessage.modelId, // Use the mapped modelId
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
                modelId: cwRequest.conversationState.currentMessage.userInputMessage.modelId, // Use the mapped modelId
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
              const assistantContentBlocks = Array.isArray(request.messages[i + 1].content) ? request.messages[i + 1].content : [{ type: 'text', text: request.messages[i + 1].content }];
              const toolUses = assistantContentBlocks.filter((b: any) => b.type === 'tool_use').map((b: any) => ({ name: b.name, input: JSON.stringify(b.input) }));
              const assistantContent = this.extractMessageContent(request.messages[i + 1].content);

              const assistantMsg: HistoryAssistantMessage = {
                assistantResponseMessage: {
                  content: assistantContent,
                  toolUses: toolUses
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