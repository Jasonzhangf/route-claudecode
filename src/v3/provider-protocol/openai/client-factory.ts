/**
 * V3.0 Real OpenAI Client Factory - Fixed Streaming Architecture
 * 强制转换流式请求为非流式请求到Provider，然后模拟流式响应返回
 * 
 * Project owner: Jason Zhang
 */

import { Provider, BaseRequest, BaseResponse } from '../../types/index.js';

export function createOpenAIClient(config: any, id: string): Provider {
  console.log(`🔧 V3 Creating real OpenAI client for ${id}`);
  console.log('🔧 OpenAI client config:', JSON.stringify(config, null, 2));
  
  return {
    name: config.name || `OpenAI ${id}`,
    
    async isHealthy(): Promise<boolean> {
      try {
        const timeoutMs = config.timeout || 120000; // Default to 120 seconds
        const response = await fetch(`${config.endpoint.replace('/v1/chat/completions', '')}/v1/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(config.authentication?.type === 'bearer' && config.authentication?.credentials?.apiKey 
              ? { 'Authorization': `Bearer ${config.authentication.credentials.apiKey}` }
              : {})
          },
          signal: AbortSignal.timeout(timeoutMs)
        });
        return response.ok;
      } catch (error) {
        console.error(`OpenAI client health check failed for ${id}:`, error);
        return false;
      }
    },
    
    async sendRequest(request: BaseRequest): Promise<BaseResponse> {
      try {
        // Convert Anthropic format to OpenAI format
        const openAIRequest: any = {
          model: request.metadata?.targetModel || request.model,
          messages: convertAnthropicMessagesToOpenAI(request.messages),
          max_tokens: request.max_tokens,
          stream: false // Force non-streaming for regular requests
        };

        // Add tools if present - assume they are already in OpenAI format from preprocessor
        if (request.tools?.length > 0) {
          openAIRequest.tools = request.tools;
        }

        console.log(`🔧 OpenAI request to ${id}:`, JSON.stringify(openAIRequest, null, 2));

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        // Add authentication if configured
        if (config.authentication?.type === 'bearer' && config.authentication?.credentials?.apiKey) {
          headers['Authorization'] = `Bearer ${config.authentication.credentials.apiKey}`;
        }

        const timeoutMs = config.timeout || 120000; // Default to 120 seconds
        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(openAIRequest),
          signal: AbortSignal.timeout(timeoutMs)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ OpenAI API error for ${id}: ${response.status} ${response.statusText}`);
          console.error(`❌ Error response: ${errorText}`);
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data: any = await response.json();
        console.log(`✅ OpenAI response from ${id}:`, JSON.stringify(data, null, 2));
        
        // Convert OpenAI format back to Anthropic format
        const content: any[] = [];
        
        // Handle text response - LM Studio may put content in reasoning field
        const textContent = data.choices?.[0]?.message?.content || 
                           data.choices?.[0]?.message?.reasoning || '';
        if (textContent) {
          content.push({
            type: 'text',
            text: textContent
          });
        }
        
        // Handle tool calls
        if (data.choices?.[0]?.message?.tool_calls) {
          for (const toolCall of data.choices[0].message.tool_calls) {
            content.push({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments)
            });
          }
        }
        
        return {
          id: data.id || `msg-openai-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: content.length > 0 ? content : [{
            type: 'text',
            text: 'No response content from OpenAI API'
          }],
          model: request.model, // Keep original model name for client
          stop_reason: mapFinishReason(data.choices?.[0]?.finish_reason),
          usage: {
            input_tokens: data.usage?.prompt_tokens || 0,
            output_tokens: data.usage?.completion_tokens || 0
          }
        };
      } catch (error) {
        console.error(`OpenAI client request failed for ${id}:`, error);
        // Return error response in Anthropic format
        return {
          id: `msg-openai-error-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          model: request.model,
          stop_reason: 'error',
          usage: {
            input_tokens: 0,
            output_tokens: 0
          }
        };
      }
    },

    async *sendStreamRequest(request: BaseRequest): AsyncIterable<any> {
      const openAIRequest: any = {
        model: request.metadata?.targetModel || request.model,
        messages: convertAnthropicMessagesToOpenAI(request.messages),
        max_tokens: request.max_tokens,
        stream: true // Force streaming for stream requests
      };

      // Add tools if present - assume they are already in OpenAI format from preprocessor
      if (request.tools?.length > 0) {
        openAIRequest.tools = request.tools;
      }

      console.log(`🔧 OpenAI streaming request to ${id}:`, JSON.stringify(openAIRequest, null, 2));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (config.authentication?.type === 'bearer' && config.authentication?.credentials?.apiKey) {
        headers['Authorization'] = `Bearer ${config.authentication.credentials.apiKey}`;
      }

      const timeoutMs = config.timeout || 120000;
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(openAIRequest),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenAI streaming API error for ${id}: ${response.status} ${response.statusText}`);
        console.error(`❌ Error response: ${errorText}`);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      yield* streamingParser(response, id);
    }
  };
}

async function* streamingParser(response: Response, id: string): AsyncIterable<any> {
  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            
            // Convert OpenAI streaming format to Anthropic format
            if (data.choices?.[0]?.delta) {
              const delta = data.choices[0].delta;
              
              if (delta.content) {
                yield {
                  type: 'content_block_delta',
                  index: 0,
                  delta: {
                    type: 'text_delta',
                    text: delta.content
                  }
                };
              }
              
              if (delta.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function?.name) {
                    yield {
                      type: 'content_block_start',
                      index: 0,
                      content_block: {
                        type: 'tool_use',
                        id: toolCall.id,
                        name: toolCall.function.name
                      }
                    };
                  }
                  
                  if (toolCall.function?.arguments) {
                    yield {
                      type: 'content_block_delta',
                      index: 0,
                      delta: {
                        type: 'input_json_delta',
                        partial_json: toolCall.function.arguments
                      }
                    };
                  }
                }
              }
            }
            
            if (data.choices?.[0]?.finish_reason) {
              yield {
                type: 'message_delta',
                delta: {
                  stop_reason: mapFinishReason(data.choices[0].finish_reason)
                }
              };
            }
          } catch (parseError) {
            console.error(`Failed to parse streaming data for ${id}:`, parseError);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function mapFinishReason(openAIReason: string | undefined): string {
  switch (openAIReason) {
    case 'stop': return 'end_turn';
    case 'length': return 'max_tokens';
    case 'tool_calls': return 'tool_use';
    default: return 'end_turn';
  }
}

function convertAnthropicMessagesToOpenAI(messages: any[]): any[] {
  return messages.map(message => {
    // Handle standard user/assistant messages
    if (typeof message.content === 'string') {
      return message;
    }

    // Handle messages with content array
    if (Array.isArray(message.content)) {
      // Check for tool_use content in assistant messages
      const hasToolUse = message.content.some((item: any) => item.type === 'tool_use');
      if (hasToolUse && message.role === 'assistant') {
        // Convert Anthropic tool_use to OpenAI tool_calls format
        const toolCalls: any[] = [];
        let textContent = '';

        for (const contentItem of message.content) {
          if (contentItem.type === 'tool_use') {
            toolCalls.push({
              id: contentItem.id,
              type: 'function',
              function: {
                name: contentItem.name,
                arguments: JSON.stringify(contentItem.input)
              }
            });
          } else if (contentItem.type === 'text') {
            textContent += contentItem.text;
          }
        }

        return {
          ...message,
          content: textContent || null,
          tool_calls: toolCalls
        };
      }

      // Check for tool_result content in user messages
      const hasToolResult = message.content.some((item: any) => item.type === 'tool_result');
      if (hasToolResult) {
        // Convert tool_result to plain text for LM Studio compatibility
        const textParts: string[] = [];
        
        for (const contentItem of message.content) {
          if (contentItem.type === 'tool_result') {
            textParts.push(`Tool result from ${contentItem.tool_use_id}:\n${contentItem.content}`);
          } else if (contentItem.type === 'text') {
            textParts.push(contentItem.text);
          } else {
            textParts.push(JSON.stringify(contentItem));
          }
        }

        return {
          ...message,
          content: textParts.join('\n\n')
        };
      }

      // Handle other content arrays (text, image_url, etc.)
      const textParts: string[] = [];
      for (const contentItem of message.content) {
        if (contentItem.type === 'text') {
          textParts.push(contentItem.text);
        } else {
          textParts.push(JSON.stringify(contentItem));
        }
      }

      if (textParts.length > 0) {
        return {
          ...message,
          content: textParts.join('\n\n')
        };
      }

      return {
        ...message,
        content: message.content
      };
    }

    return message;
  });
}