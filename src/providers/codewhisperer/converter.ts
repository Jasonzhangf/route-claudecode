/**
 * CodeWhisperer Request/Response Converter
 * Based on demo2 implementation with format conversion between Anthropic and CodeWhisperer
 */

import { BaseRequest, BaseResponse, AnthropicRequest } from '@/types';
import { logger } from '@/utils/logger';
import { sessionManager } from '@/session/manager';
import { v4 as uuidv4 } from 'uuid';
import { captureConversionEvent } from './data-capture';

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
    const startTime = Date.now();
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

      // Handle tools if present - Fix from aca415c: read from top-level tools
      if (anthropicReq.tools && Array.isArray(anthropicReq.tools)) {
        cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools = 
          anthropicReq.tools.map((tool: any) => ({
            toolSpecification: {
              name: tool.name,
              description: tool.description,
              inputSchema: {
                json: tool.input_schema
              }
            }
          }));

        logger.debug('Added tools to CodeWhisperer request', {
          toolCount: anthropicReq.tools.length,
          toolNames: anthropicReq.tools.map((t: any) => t.name)
        }, requestId);
      }

      // Handle tool results if present (for multi-turn tool conversations)
      if (request.metadata?.toolResults && request.metadata.toolResults.length > 0) {
        cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.toolResults = 
          request.metadata.toolResults.map((result: any) => ({
            content: [{ text: result.content }],
            status: result.is_error ? 'ERROR' : 'SUCCESS',
            toolUseId: result.tool_use_id
          }));

        logger.debug('Added tool results to CodeWhisperer request', {
          toolResultCount: request.metadata.toolResults.length
        }, requestId);
      }

      // Build conversation history (demo2 style)
      cwRequest.conversationState.history = this.buildConversationHistory(request, requestId);

      logger.trace(requestId, 'converter', 'Request conversion completed', {
        conversationId: cwRequest.conversationState.conversationId,
        historyLength: cwRequest.conversationState.history.length,
        hasTools: !!(request.metadata?.tools?.length),
        hasToolResults: !!(request.metadata?.toolResults?.length)
      });

      // Capture successful request conversion
      captureConversionEvent(requestId, 'request_conversion', {
        originalRequest: request,
        convertedRequest: cwRequest,
        historyLength: cwRequest.conversationState.history.length,
        toolsCount: request.metadata?.tools?.length || 0,
        toolResultsCount: request.metadata?.toolResults?.length || 0,
        timeTaken: Date.now() - startTime
      });

      return cwRequest;
    } catch (error) {
      // Capture conversion failure
      captureConversionEvent(requestId, 'request_conversion', {
        originalRequest: request,
        timeTaken: Date.now() - startTime
      }, { error: error instanceof Error ? error.message : String(error) });
      
      logger.error('Failed to convert request to CodeWhisperer format', error, requestId, 'converter');
      throw new Error(`Request conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build conversation history (demo2 style)
   */
  private buildConversationHistory(request: BaseRequest, requestId: string): any[] {
    const history: any[] = [];
    const messages = request.messages;

    logger.debug('Building conversation history', {
      totalMessages: messages.length,
      hasSystem: !!(request as any).system
    }, requestId);

    // Add system messages as history - Fix from aca415c: proper system message handling
    const anthropicReq = request as AnthropicRequest;
    if (anthropicReq.system) {
      const systemMessages = Array.isArray(anthropicReq.system) ? anthropicReq.system : [{ type: 'text', text: anthropicReq.system }];
      
      for (const sysMsg of systemMessages) {
        const content = this.extractMessageContent(sysMsg.text || sysMsg); // Apply system reminder cleanup
        const userMsg: HistoryUserMessage = {
          userInputMessage: {
            content,
            modelId: request.model, // Use mapped model from routing engine
            origin: 'AI_EDITOR'
          }
        };
        
        const assistantMsg: HistoryAssistantMessage = {
          assistantResponseMessage: {
            content: 'I will follow these instructions.',
            toolUses: []
          }
        };
        
        history.push(userMsg, assistantMsg);
      }
      
      logger.debug('Added system messages to history', {
        systemMessageCount: systemMessages.length
      }, requestId);
    }

    // Add message history (excluding the current/last message)
    for (let i = 0; i < messages.length - 1; i++) {
      const message = messages[i];
      
      if (message.role === 'user') {
        const userMsg: HistoryUserMessage = {
          userInputMessage: {
            content: this.extractMessageContent(message.content),
            modelId: request.model,
            origin: 'AI_EDITOR'
          }
        };
        history.push(userMsg);
        
        // Check if next message is assistant response - Fix from aca415c: proper tool handling in history
        if (i + 1 < messages.length - 1 && messages[i + 1].role === 'assistant') {
          const assistantMessage = messages[i + 1];
          const assistantContentBlocks = Array.isArray(assistantMessage.content) ? assistantMessage.content : [{ type: 'text', text: assistantMessage.content }];
          const toolUses = assistantContentBlocks.filter((b: any) => b.type === 'tool_use').map((b: any) => ({ name: b.name, input: JSON.stringify(b.input) }));
          const assistantContent = this.extractMessageContent(assistantMessage.content);

          const assistantMsg: HistoryAssistantMessage = {
            assistantResponseMessage: {
              content: assistantContent,
              toolUses: toolUses
            }
          };
          history.push(assistantMsg);
          i++; // Skip the assistant message in the next iteration
        }
      }
    }

    logger.debug('Conversation history built', {
      historyEntries: history.length,
      userEntries: history.filter((h, i) => i % 2 === 0).length,
      assistantEntries: history.filter((h, i) => i % 2 === 1).length
    }, requestId);

    return history;
  }

  /**
   * Extract message content from various content formats
   * Includes system reminder cleanup logic from commit aca415c
   */
  private extractMessageContent(content: any): string {
    if (typeof content === 'string') {
      // Strip system reminders to prevent large request bodies (from aca415c fix)
      const reminderEndTag = '</system-reminder>';
      const lastIndex = content.lastIndexOf(reminderEndTag);
      let userMessage = content;

      if (lastIndex !== -1) {
        userMessage = content.substring(lastIndex + reminderEndTag.length).trim();
      }

      if (userMessage.length === 0) {
        return 'answer for user qeustion';  // Demo2 style spelling - preserving exact format
      }
      return userMessage;
    }

    if (Array.isArray(content)) {
      const textParts: string[] = [];
      
      for (const block of content) {
        if (typeof block === 'string') {
          textParts.push(block);
        } else if (block && typeof block === 'object') {
          switch (block.type) {
            case 'text':
              if (block.text) {
                textParts.push(block.text);
              }
              break;
            case 'tool_result':
              if (block.content) {
                if (typeof block.content === 'string') {
                  textParts.push(`Tool result: ${block.content}`);
                } else if (Array.isArray(block.content)) {
                  const resultTexts = block.content
                    .filter((c: any) => c.type === 'text')
                    .map((c: any) => c.text)
                    .join('\n');
                  textParts.push(`Tool result: ${resultTexts}`);
                }
              }
              break;
            // tool_use blocks are handled separately in extractToolUses
          }
        }
      }
      
      return textParts.length > 0 ? textParts.join('\n') : 'Please respond to the user.';
    }

    // Fallback for other content types
    try {
      const contentStr = JSON.stringify(content);
      logger.debug('Using JSON string representation for unknown content type', {
        contentType: typeof content,
        contentPreview: contentStr.slice(0, 200)
      });
      return contentStr.slice(0, 1000); // Limit length
    } catch (error) {
      return 'Please respond to the user.';
    }
  }

  /**
   * Extract tool uses from message content for history
   */
  private extractToolUses(content: any): any[] {
    if (!Array.isArray(content)) {
      return [];
    }

    return content
      .filter(block => block && block.type === 'tool_use')
      .map(block => ({
        name: block.name,
        input: block.input || {},
        id: block.id
      }));
  }

  /**
   * Get profileArn (used by client for initialization)
   */
  getProfileArn(): string {
    return this.profileArn;
  }

  /**
   * Update profileArn if needed
   */
  updateProfileArn(profileArn: string): void {
    if (!profileArn) {
      throw new Error('Invalid profileArn provided');
    }
    this.profileArn = profileArn;
    logger.debug('Updated CodeWhisperer profileArn', { profileArn });
  }
}