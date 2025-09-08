/**
 * Static Module Registry
 * 
 * 静态编译时模块注册 - 解决transformer模块动态扫描问题
 */

import { ModuleInterface, ModuleType, ModuleRegistration } from './module-interface';
import { secureLogger } from '../../error-handler/src/utils/secure-logger';
import { RCCError, RCCErrorCode } from '../../types/src/index';

// Static imports for all modules - complete replacement of dynamic scanning
import { SecureAnthropicToOpenAITransformer } from '../../pipeline-modules/transformers/secure-anthropic-openai-transformer';
import { SecureGeminiTransformer } from '../../pipeline-modules/transformers/secure-gemini-transformer';
import { GeminiProtocolModule } from '../../pipeline-modules/protocol/gemini-protocol';
import { OpenAIServerModule } from '../../pipeline-modules/server/openai-server';
import { IFlowCompatibilityModule } from '../../pipeline-modules/server-compatibility/iflow-compatibility';
import { LMStudioCompatibilityModule } from '../../pipeline-modules/server-compatibility/lmstudio-compatibility';
import { OllamaCompatibilityModule } from '../../pipeline-modules/server-compatibility/ollama-compatibility';
import { QwenCompatibilityModule } from '../../pipeline-modules/server-compatibility/qwen-compatibility';
import { VLLMCompatibilityModule } from '../../pipeline-modules/server-compatibility/vllm-compatibility';

export class StaticModuleRegistry {
  private registeredModules: Map<string, ModuleRegistration> = new Map();
  private modulesByType: Map<ModuleType, ModuleRegistration[]> = new Map();
  
  constructor() {
    console.error('🔥🔥🔥 [CRITICAL DEBUG] StaticModuleRegistry 构造函数被调用! 🔥🔥🔥');
    console.log('🚀 StaticModuleRegistry: 开始初始化静态模块注册表...');
    Object.values(ModuleType).forEach(type => {
      this.modulesByType.set(type, []);
    });
    console.log('🔧 StaticModuleRegistry: 开始注册所有静态模块...');
    console.error('🔥🔥🔥 [CRITICAL DEBUG] 即将调用registerStaticModules() 🔥🔥🔥');
    this.registerStaticModules();
    console.error('🔥🔥🔥 [CRITICAL DEBUG] StaticModuleRegistry 构造函数完成! 🔥🔥🔥');
  }
  
  private registerStaticModules(): void {
    console.log('📋 StaticModuleRegistry: registerStaticModules 被调用');
    secureLogger.info('Static module registration started', { registryType: 'static' });
    
    // Register all module types to completely replace dynamic scanning
    console.log('🔧 StaticModuleRegistry: 即将注册各类型模块...');
    this.registerTransformers();
    this.registerProtocols();
    this.registerServers();
    this.registerServerCompatibility();
    
    const stats = this.getRegistryStats();
    secureLogger.info('Static module registration completed', stats);
  }

  private registerTransformers(): void {
    console.log('🔧 StaticModuleRegistry: 开始注册Transformer模块...');
    
    try {
      const anthropicReg: ModuleRegistration = {
        id: 'transformer_anthropic_openai_static',
        name: 'SecureAnthropicToOpenAI',
        className: 'SecureAnthropicToOpenAITransformer',
        type: ModuleType.TRANSFORMER,
        version: '4.0.0',
        filePath: 'static_import',
        module: new SecureAnthropicToOpenAITransformer(),
        isActive: true,
        registeredAt: new Date()
      };
      console.log('🔧 StaticModuleRegistry: 即将注册Anthropic Transformer...');
      this.addRegistration(anthropicReg);
      console.log('✅ StaticModuleRegistry: Anthropic Transformer注册成功');
    
      const geminiReg: ModuleRegistration = {
        id: 'transformer_gemini_static',
        name: 'SecureGeminiTransformer', 
        className: 'SecureGeminiTransformer',
        type: ModuleType.TRANSFORMER,
        version: '4.0.0',
        filePath: 'static_import',
        module: new SecureGeminiTransformer(),
        isActive: true,
        registeredAt: new Date()
      };
      console.log('🔧 StaticModuleRegistry: 即将注册Gemini Transformer...');
      this.addRegistration(geminiReg);
      console.log('✅ StaticModuleRegistry: Gemini Transformer注册成功');
      
      console.log('✅ StaticModuleRegistry: 所有Transformer模块注册完成，数量: 2');
      secureLogger.debug('Transformers registered', { count: 2 });
    } catch (error) {
      console.error('❌ StaticModuleRegistry: Transformer注册失败:', error);
      throw error;
    }
  }

  private registerProtocols(): void {
    const geminiProtocolReg: ModuleRegistration = {
      id: 'protocol_gemini_static',
      name: 'GeminiProtocol',
      className: 'GeminiProtocolModule',
      type: ModuleType.PROTOCOL,
      version: '4.0.0',
      filePath: 'static_import',
      module: new GeminiProtocolModule(),
      isActive: true,
      registeredAt: new Date()
    };
    this.addRegistration(geminiProtocolReg);
    
    secureLogger.debug('Protocols registered', { count: 1 });
  }

  private registerServers(): void {
    // Proper OpenAI server configuration
    const defaultServerConfig = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      skipAuthentication: true, // Skip authentication during assembly
      authMethod: 'bearer' as const,
      enableResponseValidation: false,
      requestTimeoutMs: 30000,
      maxConcurrentRequests: 10
    };

    const openaiServerReg: ModuleRegistration = {
      id: 'server_openai_static',
      name: 'OpenAIServer',
      className: 'OpenAIServerModule',
      type: ModuleType.SERVER,
      version: '4.0.0',
      filePath: 'static_import',
      module: new OpenAIServerModule(defaultServerConfig),
      isActive: true,
      registeredAt: new Date()
    };
    this.addRegistration(openaiServerReg);
    
    secureLogger.debug('Servers registered', { count: 1 });
  }

  private registerServerCompatibility(): void {
    // Default config for IFlow compatibility
    const iflowConfig = {
      baseUrl: 'http://localhost:1234/v1',
      timeout: 30000,
      maxRetries: 3,
      models: { available: ['default'], default: 'default' },
      authentication: { method: 'Bearer' as const },
      parameters: {
        topK: { min: 1, max: 100, default: 40 },
        temperature: { min: 0, max: 2, default: 0.7 }
      },
      endpoints: { primary: '/v1/chat/completions', health: '/v1/models' }
    };

    // Default config for LMStudio compatibility  
    const lmstudioConfig = {
      baseUrl: 'http://localhost:1234/v1',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      models: ['default'],
      enableRequestProcessing: true,
      enableResponseProcessing: true,
      concurrencyLimit: 10
    };

    // Default config for Ollama compatibility
    const ollamaConfig = {
      baseUrl: 'http://localhost:11434/v1',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      models: ['default'],
      features: {
        chat: true,
        embedding: false,
        streaming: true
      }
    };

    // Default config for Qwen compatibility
    const qwenConfig = {
      baseUrl: 'https://portal.qwen.ai/v1',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      models: ['default'],
      authentication: { method: 'Bearer' as const }
    };

    // Default config for VLLM compatibility
    const vllmConfig = {
      baseUrl: 'http://localhost:8000/v1',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      models: ['default'],
      features: {
        chat: true,
        streaming: true,
        parallel: true
      },
      vllmSpecific: {
        tensorParallelSize: 1,
        gpuMemoryUtilization: 0.9
      }
    };
    
    // Register IFlow compatibility with specific config
    const iflowReg: ModuleRegistration = {
      id: 'server_compatibility_iflow_static',
      name: 'iflowCompatibility',
      className: 'IFlowCompatibilityModule',
      type: ModuleType.SERVER_COMPATIBILITY,
      version: '4.0.0',
      filePath: 'static_import',
      module: new IFlowCompatibilityModule(iflowConfig),
      isActive: true,
      registeredAt: new Date()
    };
    this.addRegistration(iflowReg);

    // Register LMStudio compatibility with specific config
    const lmstudioReg: ModuleRegistration = {
      id: 'server_compatibility_lmstudio_static',
      name: 'lmstudioCompatibility',
      className: 'LMStudioCompatibilityModule',
      type: ModuleType.SERVER_COMPATIBILITY,
      version: '4.0.0',
      filePath: 'static_import',
      module: new LMStudioCompatibilityModule(lmstudioConfig),
      isActive: true,
      registeredAt: new Date()
    };
    this.addRegistration(lmstudioReg);

    // Register Ollama compatibility with specific config
    const ollamaReg: ModuleRegistration = {
      id: 'server_compatibility_ollama_static',
      name: 'ollamaCompatibility',
      className: 'OllamaCompatibilityModule',
      type: ModuleType.SERVER_COMPATIBILITY,
      version: '4.0.0',
      filePath: 'static_import',
      module: new OllamaCompatibilityModule(ollamaConfig),
      isActive: true,
      registeredAt: new Date()
    };
    this.addRegistration(ollamaReg);

    // Register Qwen compatibility with specific config
    const qwenReg: ModuleRegistration = {
      id: 'server_compatibility_qwen_static',
      name: 'qwenCompatibility',
      className: 'QwenCompatibilityModule',
      type: ModuleType.SERVER_COMPATIBILITY,
      version: '4.0.0',
      filePath: 'static_import',
      module: new QwenCompatibilityModule(qwenConfig),
      isActive: true,
      registeredAt: new Date()
    };
    this.addRegistration(qwenReg);

    // Register VLLM compatibility with specific config
    const vllmReg: ModuleRegistration = {
      id: 'server_compatibility_vllm_static',
      name: 'vllmCompatibility',
      className: 'VLLMCompatibilityModule',
      type: ModuleType.SERVER_COMPATIBILITY,
      version: '4.0.0',
      filePath: 'static_import',
      module: new VLLMCompatibilityModule(vllmConfig),
      isActive: true,
      registeredAt: new Date()
    };
    this.addRegistration(vllmReg);
    
    secureLogger.debug('Server compatibility modules registered', { count: 5 });
  }

  
  private addRegistration(registration: ModuleRegistration): void {
    this.registeredModules.set(registration.id, registration);
    const typeModules = this.modulesByType.get(registration.type) || [];
    typeModules.push(registration);
    this.modulesByType.set(registration.type, typeModules);
  }
  
  getModulesByType(type: ModuleType): ModuleRegistration[] {
    return this.modulesByType.get(type) || [];
  }
  
  async createModuleInstance(registration: ModuleRegistration, config: any): Promise<ModuleInterface> {
    if (registration.module) {
      return registration.module;
    }
    throw new RCCError(
      `Static module instance not found: ${registration.name}`,
      RCCErrorCode.MODULE_NOT_FOUND,
      'static-module-registry',
      {}
    );
  }
  
  getRegistryStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalModules: this.registeredModules.size,
      modulesByType: {},
      registryType: 'static'
    };
    
    for (const [type, modules] of this.modulesByType.entries()) {
      stats.modulesByType[type] = modules.length;
    }
    
    return stats;
  }
  
  async scanAndRegisterModules(): Promise<void> {
    // Static registration doesn't need scanning
    secureLogger.debug('Static registration mode - no scanning needed', { 
      totalModules: this.registeredModules.size 
    });
  }
}