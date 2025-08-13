/**
 * V3.0 Real OpenAI Client Factory
 * Creates and manages OpenAI-compatible clients using real API calls
 * Based on demo3 pattern with axios for HTTP requests
 * 
 * Project owner: Jason Zhang
 */

import { Provider, BaseRequest, BaseResponse } from '../../types/index.js';

export function createOpenAIClient(config: any, id: string): Provider {
  console.log(`🔧 V3 Creating real OpenAI client for ${id}`);
  
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
          messages: request.messages,
          max_tokens: request.max_tokens,
          stream: request.stream || false
        };

        // Add tools if present - LM Studio requires type to be 'function'
        if (request.tools?.length > 0) {
          openAIRequest.tools = request.tools.map(tool => ({
            type: 'function',  // LM Studio requires this to be exactly 'function'
            function: {
              name: tool.name || tool.function?.name,
              description: tool.description || tool.function?.description,
              parameters: tool.input_schema || tool.function?.parameters
            }
          }));
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
        
        // Handle text response
        if (data.choices?.[0]?.message?.content) {
          content.push({
            type: 'text',
            text: data.choices[0].message.content
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
    }
  };
}

function mapFinishReason(openAIReason: string | undefined): string {
  switch (openAIReason) {
    case 'stop': return 'end_turn';
    case 'length': return 'max_tokens';
    case 'tool_calls': return 'tool_use';
    default: return 'end_turn';
  }
}