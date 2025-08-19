/**
 * DEPRECATED: This file has been replaced by src/modules/routing/core-router.ts
 *
 * ❌ DO NOT USE: This provider router is deprecated
 * ✅ USE INSTEAD: src/modules/routing/core-router.ts - CoreRouter
 *
 * Provider routing functionality is now handled by the CoreRouter with
 * dedicated provider modules for each AI service.
 *
 * @deprecated Use CoreRouter from src/modules/routing/core-router.ts instead
 * @see src/modules/routing/core-router.ts
 */

import { CLIConfig } from './cli-config-manager';

export interface ProviderRouteRequest {
  messages?: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

export interface ProviderRouteResult {
  success: boolean;
  response?: any;
  error?: string;
}

export interface Provider {
  name?: string;
  protocol?: string;
  connection?: {
    endpoint?: string;
    authentication?: {
      credentials?: {
        apiKeys?: string[];
      };
    };
  };
  models?: {
    supported?: string[];
    default?: string;
  };
  priority?: number;
}

export class ProviderRouter {
  /**
   * 路由请求到真实Provider
   */
  static async routeToRealProvider(
    requestBody: ProviderRouteRequest,
    config: CLIConfig,
    requestId: string
  ): Promise<ProviderRouteResult> {
    try {
      // 解析请求内容
      const messages = requestBody?.messages || [];
      const model = requestBody?.model || 'claude-3-5-sonnet-20241022';
      const stream = requestBody?.stream || false;

      console.log(`🎯 [${requestId}] Routing request to real provider:`, {
        model,
        messagesCount: messages.length,
        stream,
      });

      // 获取所有可用的Provider
      const allProviders = this.getAllProviders(config);
      const providerKeys = Object.keys(allProviders);

      console.log(`🔍 [${requestId}] Available providers: ${providerKeys.join(', ')}`);

      if (providerKeys.length === 0) {
        return { success: false, error: 'No providers configured in config file' };
      }

      // 选择Provider (简化：使用第一个可用的Provider)
      const providerKey = providerKeys[0];
      const provider = allProviders[providerKey];

      console.log(`🔗 [${requestId}] Selected provider: ${provider.name} (${provider.protocol})`);

      // 处理模型映射
      const targetModel = this.mapModel(requestBody.model, provider, requestId);
      const updatedRequestBody = { ...requestBody, model: targetModel };

      // 根据Provider类型进行路由
      switch (provider.protocol) {
        case 'openai':
          return await this.routeToOpenAIProvider(provider, updatedRequestBody, requestId);
        case 'gemini':
          return await this.routeToGeminiProvider(provider, updatedRequestBody, requestId);
        default:
          return { success: false, error: `Unsupported provider protocol: ${provider.protocol}` };
      }
    } catch (error) {
      return { success: false, error: `Provider routing error: ${(error as Error).message}` };
    }
  }

  /**
   * 获取所有Provider
   */
  private static getAllProviders(config: CLIConfig): Record<string, Provider> {
    const standardProviders = config.standardProviders || {};
    const serverCompatibilityProviders = config.serverCompatibilityProviders || {};
    return { ...standardProviders, ...serverCompatibilityProviders };
  }

  /**
   * 模型映射逻辑
   */
  private static mapModel(originalModel: string, provider: Provider, requestId: string): string {
    let targetModel = originalModel;

    if (provider.models?.supported && provider.models.supported.length > 0) {
      // 如果Provider指定了支持的模型，使用第一个作为默认模型
      targetModel = provider.models.supported[0];
      console.log(`🎯 [${requestId}] Model mapping: ${originalModel} -> ${targetModel}`);
    } else if (provider.models?.default) {
      targetModel = provider.models.default;
      console.log(`🎯 [${requestId}] Using default model: ${targetModel}`);
    }

    return targetModel;
  }

  /**
   * 路由到OpenAI兼容Provider
   */
  private static async routeToOpenAIProvider(
    provider: Provider,
    requestBody: ProviderRouteRequest,
    requestId: string
  ): Promise<ProviderRouteResult> {
    try {
      const { default: fetch } = await import('node-fetch');

      // 获取API密钥
      const apiKeys = provider.connection?.authentication?.credentials?.apiKeys || [];
      if (apiKeys.length === 0) {
        return { success: false, error: 'No API keys configured for OpenAI provider' };
      }

      const apiKey = apiKeys[0]; // 简化：使用第一个密钥
      const endpoint = provider.connection?.endpoint;

      if (!endpoint) {
        return { success: false, error: 'No endpoint configured for OpenAI provider' };
      }

      console.log(`🚀 [${requestId}] Making OpenAI API call to: ${endpoint}`);

      // 转换请求格式
      const openaiRequest = {
        model: requestBody.model || 'gpt-3.5-turbo',
        messages: requestBody.messages || [],
        stream: false, // 简化：不支持流式
        max_tokens: requestBody.max_tokens || 1000,
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(openaiRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `OpenAI API error: ${response.status} ${errorText}` };
      }

      const data = (await response.json()) as any;

      // 转换为Anthropic格式
      const anthropicResponse = this.convertToAnthropicFormat(data, requestBody, 'openai');

      console.log(`✅ [${requestId}] OpenAI provider response successful`);
      return { success: true, response: anthropicResponse };
    } catch (error) {
      return { success: false, error: `OpenAI provider error: ${(error as Error).message}` };
    }
  }

  /**
   * 路由到Gemini Provider
   */
  private static async routeToGeminiProvider(
    provider: Provider,
    requestBody: ProviderRouteRequest,
    requestId: string
  ): Promise<ProviderRouteResult> {
    try {
      const { default: fetch } = await import('node-fetch');

      // 获取API密钥
      const apiKeys = provider.connection?.authentication?.credentials?.apiKeys || [];
      if (apiKeys.length === 0) {
        return { success: false, error: 'No API keys configured for Gemini provider' };
      }

      const apiKey = apiKeys[0]; // 简化：使用第一个密钥
      const endpoint = provider.connection?.endpoint;

      if (!endpoint) {
        return { success: false, error: 'No endpoint configured for Gemini provider' };
      }

      console.log(`🚀 [${requestId}] Making Gemini API call to: ${endpoint}`);

      // 转换请求格式为Gemini格式
      const messages = requestBody.messages || [];
      const userMessage = messages.find(m => m.role === 'user')?.content || '测试消息';

      const geminiRequest = {
        contents: [
          {
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          maxOutputTokens: requestBody.max_tokens || 1000,
          temperature: requestBody.temperature || 0.7,
        },
      };

      const response = await fetch(`${endpoint}/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Gemini API error: ${response.status} ${errorText}` };
      }

      const data = (await response.json()) as any;

      // 转换为Anthropic格式
      const anthropicResponse = this.convertToAnthropicFormat(data, requestBody, 'gemini');

      console.log(`✅ [${requestId}] Gemini provider response successful`);
      return { success: true, response: anthropicResponse };
    } catch (error) {
      return { success: false, error: `Gemini provider error: ${(error as Error).message}` };
    }
  }

  /**
   * 转换Provider响应为Anthropic格式
   */
  private static convertToAnthropicFormat(
    data: any,
    originalRequest: ProviderRouteRequest,
    providerType: 'openai' | 'gemini'
  ): any {
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;

    if (providerType === 'openai') {
      content = data.choices?.[0]?.message?.content || '🤖 OpenAI Provider响应成功但内容为空';
      inputTokens = data.usage?.prompt_tokens || 0;
      outputTokens = data.usage?.completion_tokens || 0;
    } else if (providerType === 'gemini') {
      content = data.candidates?.[0]?.content?.parts?.[0]?.text || '🤖 Gemini Provider响应成功但内容为空';
      inputTokens = data.usageMetadata?.promptTokenCount || 0;
      outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    }

    return {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
      model: originalRequest.model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
    };
  }
}
