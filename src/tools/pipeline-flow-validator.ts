/**
 * 流水线流程验证工具
 * 
 * 验证完整的请求处理流程从输入到HTTP发出前的所有阶段
 * 六层架构：Router → Transformer → Protocol → ServerCompatibility → Server
 * 
 * @author Pipeline Validation System
 */

import { ValidationLogger } from '../utils/validation-logger';
import { RCCError } from '../types';
import { PIPELINE_DEFAULTS } from '../constants/pipeline-defaults';

interface AnthropicRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface OpenAIRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
      };
    };
  }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface ProcessingContext {
  requestId: string;
  pipelineId: string;
  metadata?: Record<string, any>;
}

interface HttpRequestConfig {
  method: string;
  url: string;
  headers: Record<string, string>;
  data: any;
  timeout: number;
}

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  processingTime: number;
  stageResults: Record<string, any>;
}

export class PipelineFlowValidator {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  /**
   * 验证完整的流水线处理流程
   */
  async validateCompleteFlow(input: AnthropicRequest, context: ProcessingContext): Promise<ValidationResult> {
    const startTime = Date.now();
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
      processingTime: 0,
      stageResults: {}
    };

    try {
      ValidationLogger.info('🔍 Starting pipeline flow validation', {
        requestId: context.requestId,
        pipelineId: context.pipelineId,
        model: input.model
      });

      // Stage 1: Router Layer Validation
      const routerResult = await this.validateRouterLayer(input, context);
      result.stageResults.router = routerResult;
      if (!routerResult.valid) {
        result.errors.push(...routerResult.errors);
        result.success = false;
      }

      // Stage 2: Transformer Layer Validation  
      const transformerResult = await this.validateTransformerLayer(routerResult.request, context);
      result.stageResults.transformer = transformerResult;
      if (!transformerResult.valid) {
        result.errors.push(...transformerResult.errors);
        result.success = false;
      }

      // Stage 3: Protocol Layer Validation
      const protocolResult = await this.validateProtocolLayer(transformerResult.request, context);
      result.stageResults.protocol = protocolResult;
      if (!protocolResult.valid) {
        result.errors.push(...protocolResult.errors);
        result.success = false;
      }

      // Stage 4: ServerCompatibility Layer Validation
      const compatibilityResult = await this.validateServerCompatibilityLayer(protocolResult.request, context);
      result.stageResults.compatibility = compatibilityResult;
      if (!compatibilityResult.valid) {
        result.errors.push(...compatibilityResult.errors);
        result.success = false;
      }

      // Stage 5: Server Layer Validation
      const serverResult = await this.validateServerLayer(compatibilityResult.request, context);
      result.stageResults.server = serverResult;
      if (!serverResult.valid) {
        result.errors.push(...serverResult.errors);
        result.success = false;
      }

      result.processingTime = Date.now() - startTime;

      if (result.success) {
        ValidationLogger.info('✅ Pipeline flow validation completed successfully', {
          requestId: context.requestId,
          processingTime: result.processingTime,
          totalStages: 5
        });
      } else {
        ValidationLogger.error('❌ Pipeline flow validation failed', {
          requestId: context.requestId,
          errorCount: result.errors.length,
          errors: result.errors
        });
      }

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(`Pipeline validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.processingTime = Date.now() - startTime;

      ValidationLogger.error('💥 Pipeline flow validation exception', {
        requestId: context.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: result.processingTime
      });

      return result;
    }
  }

  /**
   * 验证Router层处理
   */
  private async validateRouterLayer(input: AnthropicRequest, context: ProcessingContext): Promise<{
    valid: boolean;
    errors: string[];
    request: AnthropicRequest;
    provider: string;
    model: string;
  }> {
    const errors: string[] = [];
    
    try {
      const [provider, model] = this.parseProviderFromPipelineId(context.pipelineId);
      
      if (!provider || !model) {
        errors.push('Invalid pipeline ID format - cannot extract provider and model');
      }

      return {
        valid: errors.length === 0,
        errors,
        request: { ...input, model },
        provider,
        model
      };
    } catch (error) {
      errors.push(`Router layer validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors,
        request: input,
        provider: '',
        model: ''
      };
    }
  }

  /**
   * 验证Transformer层处理 - Anthropic到OpenAI格式转换
   */
  private async validateTransformerLayer(input: AnthropicRequest, context: ProcessingContext): Promise<{
    valid: boolean;
    errors: string[];
    request: OpenAIRequest;
  }> {
    const errors: string[] = [];
    
    try {
      const openaiRequest: OpenAIRequest = {
        model: input.model,
        messages: input.messages,
        max_tokens: input.max_tokens,
        temperature: input.temperature,
        stream: input.stream || false
      };

      // 验证工具调用格式转换
      if (input.tools && input.tools.length > 0) {
        openaiRequest.tools = input.tools.map(tool => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema
          }
        }));

        if (!openaiRequest.tools.every(tool => tool.type === 'function')) {
          errors.push('Tool format conversion failed - invalid tool type');
        }
      }

      // 验证消息格式
      if (!openaiRequest.messages || openaiRequest.messages.length === 0) {
        errors.push('Message array is empty or invalid');
      }

      return {
        valid: errors.length === 0,
        errors,
        request: openaiRequest
      };
    } catch (error) {
      errors.push(`Transformer layer validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors,
        request: {} as OpenAIRequest
      };
    }
  }

  /**
   * 验证Protocol层处理 - OpenAI格式处理和端点配置
   */
  private async validateProtocolLayer(input: OpenAIRequest, context: ProcessingContext): Promise<{
    valid: boolean;
    errors: string[];
    request: OpenAIRequest & { endpoint: string };
  }> {
    const errors: string[] = [];
    
    try {
      const provider = context.pipelineId.split('-')[0] || '';
      const endpoint = this.getProviderEndpoint(provider);

      if (!endpoint) {
        errors.push(`No endpoint configured for provider: ${provider}`);
      }

      // 验证OpenAI格式完整性
      if (!input.model) {
        errors.push('Model field is missing');
      }

      if (!input.messages || !Array.isArray(input.messages)) {
        errors.push('Messages field is missing or invalid');
      }

      return {
        valid: errors.length === 0,
        errors,
        request: { ...input, endpoint: endpoint || '' }
      };
    } catch (error) {
      errors.push(`Protocol layer validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors,
        request: { ...input, endpoint: '' }
      };
    }
  }

  /**
   * 验证ServerCompatibility层处理 - Provider特定调整
   */
  private async validateServerCompatibilityLayer(
    input: OpenAIRequest & { endpoint: string },
    context: ProcessingContext
  ): Promise<{
    valid: boolean;
    errors: string[];
    request: OpenAIRequest & { endpoint: string; adjustments: string[] };
  }> {
    const errors: string[] = [];
    const adjustments: string[] = [];
    let adjustedRequest = { ...input };
    
    try {
      const provider = context.pipelineId.split('-')[0];

      // 应用Provider特定调整并验证
      switch (provider) {
        case 'qwen':
          if (adjustedRequest.temperature && adjustedRequest.temperature > PIPELINE_DEFAULTS.PROVIDER_LIMITS.QWEN.MAX_TEMPERATURE) {
            adjustedRequest.temperature = PIPELINE_DEFAULTS.PROVIDER_LIMITS.QWEN.MAX_TEMPERATURE;
            adjustments.push('temperature_clamped_to_qwen_limit');
          }
          break;

        case 'lmstudio':
          if (adjustedRequest.stream && PIPELINE_DEFAULTS.PROVIDER_LIMITS.LMSTUDIO.FORCE_STREAM_OFF) {
            adjustedRequest.stream = false;
            adjustments.push('stream_disabled_for_lmstudio');
          }
          break;

        case 'modelscope':
          if (adjustedRequest.model && adjustedRequest.model.includes('qwen')) {
            const originalModel = adjustedRequest.model;
            adjustedRequest.model = adjustedRequest.model.replace('qwen', 'qwen-max');
            adjustments.push(`model_mapped_from_${originalModel}`);
          }
          break;
      }

      return {
        valid: errors.length === 0,
        errors,
        request: { ...adjustedRequest, adjustments }
      };
    } catch (error) {
      errors.push(`ServerCompatibility layer validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors,
        request: { ...input, adjustments: [] }
      };
    }
  }

  /**
   * 验证Server层处理 - HTTP请求构建
   */
  private async validateServerLayer(
    input: OpenAIRequest & { endpoint: string; adjustments: string[] },
    context: ProcessingContext
  ): Promise<{
    valid: boolean;
    errors: string[];
    httpConfig: HttpRequestConfig;
  }> {
    const errors: string[] = [];
    
    try {
      const provider = context.pipelineId.split('-')[0] || '';
      const apiKey = this.getProviderApiKey(provider);

      if (!apiKey) {
        errors.push(`No API key configured for provider: ${provider}`);
      }

      if (!input.endpoint) {
        errors.push('Endpoint is missing from input');
      }

      const { endpoint, adjustments, ...requestData } = input;
      
      const httpConfig: HttpRequestConfig = {
        method: PIPELINE_DEFAULTS.HTTP_CONFIG.METHOD,
        url: `${endpoint || ''}${PIPELINE_DEFAULTS.PROVIDER_ENDPOINTS.QWEN.CHAT_PATH}`,
        headers: {
          'Content-Type': PIPELINE_DEFAULTS.HTTP_CONFIG.HEADERS.CONTENT_TYPE,
          'Authorization': `Bearer ${apiKey || 'missing-api-key'}`,
          'User-Agent': PIPELINE_DEFAULTS.HTTP_CONFIG.HEADERS.USER_AGENT
        },
        data: requestData,
        timeout: PIPELINE_DEFAULTS.HTTP_CONFIG.TIMEOUT
      };

      // 验证HTTP配置完整性
      if (!httpConfig.url.startsWith('http')) {
        errors.push('Invalid HTTP URL format');
      }

      if (!httpConfig.headers['Authorization']) {
        errors.push('Authorization header is missing');
      }

      return {
        valid: errors.length === 0,
        errors,
        httpConfig
      };
    } catch (error) {
      errors.push(`Server layer validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        valid: false,
        errors,
        httpConfig: {} as HttpRequestConfig
      };
    }
  }

  /**
   * 从Pipeline ID解析Provider和Model
   */
  private parseProviderFromPipelineId(pipelineId: string): [string, string] {
    const parts = pipelineId.split(PIPELINE_DEFAULTS.PIPELINE_ID_FORMAT.SEPARATOR);
    if (parts.length < 2) {
      throw new RCCError(`Invalid pipeline ID format: ${pipelineId}`, 'INVALID_PIPELINE_ID');
    }
    const provider = parts[0] || '';
    const model = parts.slice(1, -1).join(PIPELINE_DEFAULTS.PIPELINE_ID_FORMAT.SEPARATOR) || '';
    return [provider, model];
  }

  /**
   * 获取Provider端点配置
   */
  private getProviderEndpoint(provider: string): string | null {
    const configAny = this.config as any;
    const providersArray = this.config.providers || configAny.Providers;
    
    const providerConfig = providersArray?.find((p: any) => p.name === provider);
    return providerConfig?.baseURL || providerConfig?.api_base_url || null;
  }

  /**
   * 获取Provider API密钥
   */
  private getProviderApiKey(provider: string): string | null {
    const configAny = this.config as any;
    const providersArray = this.config.providers || configAny.Providers;
    
    const providerConfig = providersArray?.find((p: any) => p.name === provider);
    return providerConfig?.apiKey || providerConfig?.api_key || null;
  }
}

export default PipelineFlowValidator;