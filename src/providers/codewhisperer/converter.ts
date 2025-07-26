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

      // Get provider-specific conversation ID from session manager
      const sessionId = request.metadata?.sessionId;
      const providerConversationId = sessionId 
        ? sessionManager.getProviderConversationId(sessionId, 'codewhisperer')
        : uuidv4();

      logger.debug('Using conversation ID for CodeWhisperer', {
        sessionId,
        providerConversationId
      }, requestId);

      const cwRequest: CodeWhispererRequest = {
        conversationState: {
          chatTriggerType: 'MANUAL',
          conversationId: providerConversationId,
          currentMessage: {
            userInputMessage: {
              content: this.extractMessageContent(request.messages[request.messages.length - 1].content),
              modelId: this.mapModel(request.model),
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
   * Map model names from Anthropic to CodeWhisperer format
   */
  private mapModel(model: string): string {
    const mapped = MODEL_MAP[model];
    if (!mapped) {
      logger.warn(`Unknown model ${model}, using default`, { model });
      return MODEL_MAP['claude-sonnet-4-20250514'];
    }
    return mapped;
  }

  /**
   * Extract text content from message content (string or array)
   */
  private extractMessageContent(content: any): string {
    if (typeof content === 'string') {
      return content || 'answer for user question';
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
          }
        }
      });

      return texts.length > 0 ? texts.join('\n') : 'answer for user question';
    }

    // Fallback for unknown content format
    try {
      return JSON.stringify(content);
    } catch {
      return 'answer for user question';
    }
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
   * Build conversation history for CodeWhisperer
   */
  private buildHistory(cwRequest: CodeWhispererRequest, request: BaseRequest, requestId: string): void {
    const history: any[] = [];
    const modelId = cwRequest.conversationState.currentMessage.userInputMessage.modelId;
    const sessionId = request.metadata?.sessionId;

    // Add system messages as history
    if (request.metadata?.system && Array.isArray(request.metadata.system)) {
      const assistantDefaultMsg: HistoryAssistantMessage = {
        assistantResponseMessage: {
          content: 'I will follow these instructions',
          toolUses: []
        }
      };

      request.metadata.system.forEach((sysMsg: any) => {
        const userMsg: HistoryUserMessage = {
          userInputMessage: {
            content: sysMsg.text || sysMsg,
            modelId,
            origin: 'AI_EDITOR'
          }
        };
        history.push(userMsg);
        history.push(assistantDefaultMsg);
      });
    }

    // Get conversation history from session manager if available
    if (sessionId) {
      const sessionHistory = sessionManager.getConversationHistory(sessionId, 20); // Limit to last 20 messages
      
      logger.debug('Retrieved session history', {
        sessionId,
        sessionHistoryLength: sessionHistory.length
      }, requestId);

      // Convert session history to CodeWhisperer format (exclude the current message which is being processed)
      for (let i = 0; i < sessionHistory.length - 1; i++) {
        const historyMessage = sessionHistory[i];
        
        if (historyMessage.role === 'user') {
          const userMsg: HistoryUserMessage = {
            userInputMessage: {
              content: typeof historyMessage.content === 'string' 
                ? historyMessage.content 
                : this.extractMessageContent(historyMessage.content),
              modelId,
              origin: 'AI_EDITOR'
            }
          };
          history.push(userMsg);

          // Check if next message is assistant response
          if (i + 1 < sessionHistory.length - 1 && sessionHistory[i + 1].role === 'assistant') {
            const assistantMsg: HistoryAssistantMessage = {
              assistantResponseMessage: {
                content: typeof sessionHistory[i + 1].content === 'string'
                  ? sessionHistory[i + 1].content as string
                  : this.extractMessageContent(sessionHistory[i + 1].content),
                toolUses: []
              }
            };
            history.push(assistantMsg);
            i++; // Skip the processed assistant message
          }
        }
      }
    } else {
      // Fallback: use current request messages (legacy behavior)
      logger.debug('No session ID, using request messages for history', {}, requestId);
      
      for (let i = 0; i < request.messages.length - 1; i++) {
        const message = request.messages[i];
        
        if (message.role === 'user') {
          const userMsg: HistoryUserMessage = {
            userInputMessage: {
              content: this.extractMessageContent(message.content),
              modelId,
              origin: 'AI_EDITOR'
            }
          };
          history.push(userMsg);

          // Check if next message is assistant response
          if (i + 1 < request.messages.length - 1 && request.messages[i + 1].role === 'assistant') {
            const assistantMsg: HistoryAssistantMessage = {
              assistantResponseMessage: {
                content: this.extractMessageContent(request.messages[i + 1].content),
                toolUses: []
              }
            };
            history.push(assistantMsg);
            i++; // Skip the processed assistant message
          }
        }
      }
    }

    cwRequest.conversationState.history = history;
    
    logger.debug('Built conversation history', { 
      historyLength: history.length,
      systemMessages: request.metadata?.system?.length || 0,
      regularMessages: request.messages.length - 1
    }, requestId, 'converter');
  }

  /**
   * Update profile ARN
   */
  updateProfileArn(profileArn: string): void {
    this.profileArn = profileArn;
    logger.info('Updated CodeWhisperer profile ARN', { profileArn });
  }
}