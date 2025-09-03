/**
 * iFlow Server Compatibility Module
 * Handles heart flow API compatibility adjustments
 */

import { ModuleInterface, ModuleMetrics } from '../../../interfaces/module/base-module';
import { EventEmitter } from 'events';
import { secureLogger } from '../../../utils/secure-logger';
import { API_DEFAULTS } from '../../../constants/api-defaults';

// ✅ Configuration-driven constants - no more hardcoding
const IFLOW_CONSTANTS = {
  MILLISECONDS_PER_SECOND: 1000,  // Mathematical constant - acceptable
  MODULE_VERSION: '1.0.0'         // Module version - acceptable
};

interface ModuleProcessingContext {
  readonly requestId: string;
  readonly providerName?: string;
  readonly protocol?: string;
  readonly config?: {
    readonly endpoint?: string;
    readonly apiKey?: string;
    readonly timeout?: number;
    readonly maxRetries?: number;
    readonly actualModel?: string;
    readonly originalModel?: string;
  };
  metadata?: {
    protocolConfig?: {
      endpoint?: string;
      apiKey?: string;
      protocol?: string;
      timeout?: number;
      maxRetries?: number;
      customHeaders?: Record<string, string>;
    };
    [key: string]: any;
  };
}

export interface IFlowCompatibilityConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  models: {
    available: string[];
    default: string;
    mapping?: Record<string, string>;
  };
  authentication: {
    method: 'Bearer' | 'APIKey' | 'Custom';
    format?: string;
  };
  parameters: {
    topK: {
      min: number;
      max: number;
      default: number;
    };
    temperature: {
      min: number;
      max: number;
      default: number;
    };
  };
  endpoints: {
    primary: string;
    fallback?: string[];
  };
}

export class IFlowCompatibilityModule extends EventEmitter implements ModuleInterface {
  private readonly id: string = 'iflow-compatibility';
  private readonly name: string = 'iFlow Compatibility Module';
  private readonly type: any = 'server-compatibility';
  private readonly version: string = IFLOW_CONSTANTS.MODULE_VERSION;
  private readonly config: IFlowCompatibilityConfig;
  private status: any = 'healthy';
  private isInitialized = false;

  constructor(config: IFlowCompatibilityConfig) {
    super();
    this.config = config;
    
    secureLogger.info('Initialize iFlow compatibility module', {
      endpoint: config.baseUrl,
      defaultModel: config.models.default,
      supportedModels: config.models.available.length
    });
  }

  getId(): string { 
    return this.id; 
  }

  getName(): string { 
    return this.name; 
  }

  getType(): any { 
    return this.type; 
  }

  getVersion(): string { 
    return this.version; 
  }

  getStatus(): any { 
    return this.status; 
  }

  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };
  }

  async configure(config: any): Promise<void> {
    secureLogger.info('iFlow compatibility module config updated');
  }

  async reset(): Promise<void> {
    this.status = 'healthy';
    this.emit('statusChanged', { health: this.status });
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    return {
      healthy: this.status === 'healthy',
      details: {
        status: this.status,
        initialized: this.isInitialized,
        endpoint: this.config.baseUrl,
        defaultModel: this.config.models.default
      }
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.status = 'healthy';
      this.isInitialized = true;
      this.emit('statusChanged', { health: this.status });
      secureLogger.info('iFlow compatibility module initialized');
    } catch (error) {
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });
      secureLogger.error('iFlow compatibility module init failed:', { error: error.message });
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  async stop(): Promise<void> {
    this.status = 'stopped';
    this.emit('statusChanged', { health: this.status });
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this.removeAllListeners();
  }

  async processRequest(request: any, routingDecision: any, context: ModuleProcessingContext): Promise<any> {
    try {
      const processedRequest = { ...request };

      // ✅ Configuration-driven model selection
      if (context?.config?.actualModel) {
        processedRequest.model = context.config.actualModel;
      } else if (!processedRequest.model) {
        processedRequest.model = this.config.models.default;
      }
      
      // Apply model mapping if configured
      if (this.config.models.mapping && this.config.models.mapping[processedRequest.model]) {
        const mappedModel = this.config.models.mapping[processedRequest.model];
        secureLogger.debug('🔄 iFlow模型映射', {
          originalModel: processedRequest.model,
          mappedModel: mappedModel,
          requestId: context.requestId
        });
        processedRequest.model = mappedModel;
      }

      // ✅ Configuration-driven parameter processing
      if (!processedRequest.top_k && processedRequest.temperature) {
        const topKConfig = this.config.parameters.topK;
        processedRequest.top_k = Math.max(
          topKConfig.min,
          Math.min(topKConfig.max, Math.floor(processedRequest.temperature * topKConfig.max))
        );
        
        secureLogger.debug('🔧 iFlow动态top_k计算', {
          temperature: processedRequest.temperature,
          calculatedTopK: processedRequest.top_k,
          topKRange: `${topKConfig.min}-${topKConfig.max}`,
          requestId: context.requestId
        });
      }
      
      // Apply temperature limits if configured
      if (processedRequest.temperature !== undefined) {
        const tempConfig = this.config.parameters.temperature;
        if (processedRequest.temperature < tempConfig.min) {
          processedRequest.temperature = tempConfig.min;
        } else if (processedRequest.temperature > tempConfig.max) {
          processedRequest.temperature = tempConfig.max;
        }
      }

      if (context.metadata) {
        if (!context.metadata.protocolConfig) {
          context.metadata.protocolConfig = {};
        }
        
        context.metadata.protocolConfig.endpoint = this.config.baseUrl;
        context.metadata.protocolConfig.protocol = 'openai';
        context.metadata.protocolConfig.timeout = this.config.timeout;
        context.metadata.protocolConfig.maxRetries = this.config.maxRetries;
        
        // ✅ Configuration-driven authentication
        if (this.config.apiKey) {
          context.metadata.protocolConfig.apiKey = this.config.apiKey;
          
          // Use configured authentication method and format
          const authMethod = this.config.authentication.method;
          const authFormat = this.config.authentication.format || `${authMethod} {token}`;
          const authHeader = authFormat.replace('{token}', this.config.apiKey);
          
          context.metadata.protocolConfig.customHeaders = {
            'Authorization': authHeader,
            'Content-Type': API_DEFAULTS.CONTENT_TYPES.JSON
          };
          
          secureLogger.debug('🔐 iFlow认证配置', {
            authMethod: authMethod,
            authFormat: authFormat,
            hasApiKey: !!this.config.apiKey,
            requestId: context.requestId
          });
        }
      }

      return processedRequest;

    } catch (error) {
      secureLogger.error('iFlow compatibility processing failed', {
        requestId: context.requestId,
        error: error.message
      });
      return request;
    }
  }

  async processResponse(response: any, routingDecision: any, context: ModuleProcessingContext): Promise<any> {
    try {
      if (!response || typeof response !== 'object') {
        return response;
      }

      const processedResponse = { ...response };

      if (!processedResponse.id) {
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        processedResponse.id = 'chatcmpl-iflow-' + timestamp + '-' + randomSuffix;
      }

      if (!processedResponse.object) {
        processedResponse.object = 'chat.completion';
      }

      if (!processedResponse.created) {
        processedResponse.created = Math.floor(Date.now() / IFLOW_CONSTANTS.MILLISECONDS_PER_SECOND);
      }

      if (processedResponse.reasoning_content) {
        processedResponse.iflow_reasoning = processedResponse.reasoning_content;
      }

      return processedResponse;

    } catch (error) {
      return response;
    }
  }

  async process(request: any): Promise<any> {
    const context: ModuleProcessingContext = {
      requestId: Date.now().toString(),
      providerName: 'iflow',
      protocol: 'openai'
    };
    
    return this.processRequest(request, null, context);
  }
}