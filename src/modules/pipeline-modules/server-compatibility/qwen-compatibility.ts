/**
 * Qwen Server Compatibility模块
 * 支持多认证文件的OAuth2 token管理和自动刷新
 * 参考ModelScope的多key轮询机制
 */

import { ModuleInterface, ModuleStatus, ModuleType, ModuleMetrics } from '../../../interfaces/module/base-module';
import { ModuleProcessingContext } from '../../../config/unified-config-manager';
import { EventEmitter } from 'events';
import { secureLogger } from '../../../utils/secure-logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JQJsonHandler } from '../../../utils/jq-json-handler';
export interface QwenAuthConfig {
  access_token: string;
  refresh_token: string;
  resource_url?: string;
  expires_at: number;
  created_at: string;
  account_index: number;
}

export interface QwenCompatibilityConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  models: string[];
  authDir: string;
}

export class QwenCompatibilityModule extends EventEmitter implements ModuleInterface {
  private authCache: Map<string, QwenAuthConfig> = new Map();
  private authDir: string;

  private readonly id: string = 'qwen-compatibility';
  private readonly name: string = 'Qwen Compatibility Module';
  private readonly type: any = 'server-compatibility';
  private readonly version: string = '1.0.0';
  private readonly config: QwenCompatibilityConfig;
  private status: any = 'healthy';
  private isInitialized = false;

  constructor(config: QwenCompatibilityConfig) {
    super();
    this.config = config;
    this.authDir = config.authDir ? config.authDir.replace('~', os.homedir()) : path.join(os.homedir(), '.route-claudecode', 'auth');
    
    console.log(`🔧 初始化Qwen兼容模块: ${config.baseUrl}`);
  }

  // ModuleInterface实现
  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getType(): ModuleType {
    return this.type;
  }

  getVersion(): string {
    return this.version;
  }

  getStatus(): ModuleStatus {
    return {
      id: this.id,
      name: this.name,
      type: ModuleType.SERVER_COMPATIBILITY,
      status: 'running',
      health: this.status,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(`🚀 初始化Qwen兼容模块...`);
    console.log(`   端点: ${this.config.baseUrl}`);
    console.log(`   认证目录: ${this.authDir}`);

    try {
      // 确保认证目录存在
      await fs.mkdir(this.authDir, { recursive: true });

      this.status = 'healthy';
      this.isInitialized = true;

      this.emit('statusChanged', { health: this.status });
      console.log(`✅ Qwen兼容模块初始化完成`);
    } catch (error) {
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });
      console.error(`❌ Qwen兼容模块初始化失败:`, error.message);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    console.log(`▶️ Qwen兼容模块已启动`);
  }

  async stop(): Promise<void> {
    this.status = 'unhealthy';
    this.emit('statusChanged', { health: this.status });
    console.log(`⏹️ Qwen兼容模块已停止`);
  }

  getMetrics(): ModuleMetrics {
    return {
      requestsProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };
  }

  async configure(config: any): Promise<void> {
    // Configuration logic
  }

  async reset(): Promise<void> {
    this.authCache.clear();
  }

  async cleanup(): Promise<void> {
    this.authCache.clear();
  }

  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const startTime = Date.now();

    try {
      // 简单的健康检查：确保认证目录存在
      await fs.access(this.authDir);
      const responseTime = Date.now() - startTime;

      this.status = 'healthy';
      this.emit('statusChanged', { health: this.status });

      return { healthy: true, details: { responseTime, authDir: this.authDir } };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.status = 'unhealthy';
      this.emit('statusChanged', { health: this.status });

      return { healthy: false, details: { responseTime, error: error.message } };
    }
  }

  /**
   * 处理请求 - 核心功能 (与pipeline兼容的接口)
   */
  async process(request: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Qwen兼容模块未初始化');
    }

    const startTime = Date.now();
    console.log(`🔄 Qwen兼容处理: ${request.model}`);

    try {
      // 调用原有的处理逻辑
      const result = await this.processRequest(request, null, { requestId: Date.now().toString() });
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Qwen兼容处理完成 (${processingTime}ms)`);

      this.emit('requestProcessed', {
        processingTime,
        success: true,
        model: request.model,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Qwen兼容处理失败 (${processingTime}ms):`, error.message);

      this.emit('requestProcessed', {
        processingTime,
        success: false,
        error: error.message,
        model: request.model,
      });

      throw error;
    }
  }

  async processRequest(request: any, routingDecision: any, context: ModuleProcessingContext): Promise<any> {
    try {
      // 🎯 Architecture Engineer设计：从Context获取认证文件信息
      // Context应该包含authFileName，但当前调用方还未更新，使用默认值
      const authFileName = context?.config?.apiKey || context?.metadata?.authFileName || 'qwen-auth-1';
      
      secureLogger.debug('🔥🔥 Qwen兼容性处理开始 - Context模式', {
        requestId: context.requestId,
        authFileName,
        pipelineId: routingDecision?.selectedPipeline || 'unknown',
        originalModel: request.model,
        hasContextActualModel: !!context?.config?.actualModel,
        contextActualModel: context?.config?.actualModel,
        providerName: context?.providerName,
        serverCompatibility: context?.config?.serverCompatibility
      });

      // 获取有效的OAuth2 token
      const authConfig = await this.getValidAuthConfig(authFileName);
      
      // 🎯 Architecture Engineer设计：使用Context传递配置，避免污染API数据
      const processedRequest = { ...request };

      // 🔧 模型名映射：从Context获取actualModel而不是__internal
      // 注意：Context应该通过上层传递下来，这里暂时使用request.model
      // TODO: 需要修改调用方传递ModuleProcessingContext
      if (context?.config?.actualModel) {
        processedRequest.model = context.config.actualModel;
        secureLogger.info('🔥🔥 Qwen模型名映射成功 - Context传递', {
          requestId: context.requestId,
          originalModel: request.model,
          actualModel: context.config.actualModel,
          finalRequestModel: processedRequest.model
        });
      } else {
        secureLogger.warn('🚨🚨 Qwen模型名映射失败 - Context中没有actualModel', {
          requestId: context.requestId,
          originalModel: request.model,
          hasContext: !!context,
          hasContextConfig: !!context?.config,
          finalRequestModel: processedRequest.model
        });
      }

      // 🔧 Qwen工具格式转换：完整的Anthropic → OpenAI转换（基于ModelScope模式）
      if (processedRequest.tools && Array.isArray(processedRequest.tools) && processedRequest.tools.length > 0) {
        try {
          if (this.isAnthropicToolsFormat(processedRequest.tools)) {
            processedRequest.tools = this.convertAnthropicToOpenAI(processedRequest.tools);
            secureLogger.info('🔄 Qwen: Anthropic → OpenAI 工具格式转换完成', {
              requestId: context.requestId,
              originalCount: request.tools?.length || 0,
              convertedCount: processedRequest.tools.length
            });
          } else if (this.isOpenAIToolsFormat(processedRequest.tools)) {
            secureLogger.debug('⚡ Qwen: 已为OpenAI格式，无需转换', {
              requestId: context.requestId,
              toolsCount: processedRequest.tools.length
            });
          } else {
            // 尝试修复不完整的OpenAI格式
            processedRequest.tools = this.fixIncompleteOpenAIFormat(processedRequest.tools);
            secureLogger.info('🔧 Qwen: 修复不完整的OpenAI工具格式', {
              requestId: context.requestId,
              toolsCount: processedRequest.tools.length
            });
          }
        } catch (error) {
          secureLogger.error('Qwen工具格式转换失败', {
            requestId: context.requestId,
            error: error.message,
            toolsCount: processedRequest.tools.length
          });
          throw new Error(`Qwen工具格式转换失败: ${error.message}`);
        }
      }

      // 🔥🔥 关键修复：注入Qwen特定的HTTP配置到Context
      // 参考CLIProxyAPI的成功实现，设置正确的HTTP头部和认证
      
      // 🚨 ULTRA DEBUG：检查context结构
      secureLogger.info('🚨 [QWEN-ULTRA-DEBUG] Context结构检查', {
        requestId: context.requestId,
        hasContext: !!context,
        hasMetadata: !!context?.metadata,
        hasProtocolConfig: !!context?.metadata?.protocolConfig,
        metadataKeys: context?.metadata ? Object.keys(context.metadata) : 'no-metadata',
        protocolConfigKeys: context?.metadata?.protocolConfig ? Object.keys(context.metadata.protocolConfig) : 'no-protocol-config'
      });
      
      if (context.metadata) {
        secureLogger.info('🚨 [QWEN-ULTRA-DEBUG] metadata存在，检查protocolConfig', {
          requestId: context.requestId,
          metadataType: typeof context.metadata,
          hasProtocolConfig: !!context.metadata.protocolConfig,
          protocolConfigType: typeof context.metadata.protocolConfig
        });
        
        // 🔧 关键修复：确保protocolConfig存在
        if (!context.metadata.protocolConfig) {
          secureLogger.warn('🚨 [QWEN-FIX] protocolConfig不存在，创建默认配置', {
            requestId: context.requestId
          });
          context.metadata.protocolConfig = {
            endpoint: 'https://portal.qwen.ai/v1',
            apiKey: '',
            protocol: 'openai',
            timeout: 120000,
            maxRetries: 3
          };
        }
        
        // 注入Qwen OAuth2 token到apiKey配置
        if (context.metadata.protocolConfig) {
          secureLogger.info('🚨 [QWEN-ULTRA-DEBUG] protocolConfig存在，开始注入', {
            requestId: context.requestId,
            originalApiKey: context.metadata.protocolConfig.apiKey,
            newToken: authConfig.access_token.substring(0, 20) + '...'
          });
          
          context.metadata.protocolConfig.apiKey = authConfig.access_token;
          
          // 🔑 注入Qwen特定的HTTP头部 - 参考CLIProxyAPI
          const qwenHeaders = {
            'User-Agent': 'google-api-nodejs-client/9.15.1',
            'X-Goog-Api-Client': 'gl-node/22.17.0',
            'Client-Metadata': 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI',
            'Accept': 'application/json'
          };
          
          context.metadata.protocolConfig.customHeaders = qwenHeaders;
          
          // 🔥🔥 详细调试：验证HTTP头部注入
          secureLogger.info('🔥🔥 [QWEN-DEBUG] HTTP头部详细注入验证', {
            requestId: context.requestId,
            'before_injection': !!context.metadata.protocolConfig.customHeaders,
            'qwen_headers_object': qwenHeaders,
            'injected_headers': context.metadata.protocolConfig.customHeaders,
            'headers_match': JQJsonHandler.stringifyJson(context.metadata.protocolConfig.customHeaders) === JQJsonHandler.stringifyJson(qwenHeaders),
            'context_metadata_exists': !!context.metadata,
            'protocolConfig_exists': !!context.metadata.protocolConfig
          });

          // 🚨 ULTRA DEBUG: 验证注入后的对象完整性
          secureLogger.info('🚨 [QWEN-INJECT-VERIFY] 注入后完整验证', {
            requestId: context.requestId,
            'protocolConfig_after_injection': {
              'hasApiKey': !!context.metadata.protocolConfig.apiKey,
              'hasCustomHeaders': !!context.metadata.protocolConfig.customHeaders,
              'customHeadersType': typeof context.metadata.protocolConfig.customHeaders,
              'customHeadersKeys': context.metadata.protocolConfig.customHeaders ? Object.keys(context.metadata.protocolConfig.customHeaders) : 'no-keys',
              'customHeadersAsString': context.metadata.protocolConfig.customHeaders ? JQJsonHandler.stringifyJson(context.metadata.protocolConfig.customHeaders) : 'no-custom-headers'
            }
          });

          // 🌐 修正端点URL - 根据resource_url或使用默认端点
          if (authConfig.resource_url && authConfig.resource_url.trim() !== '') {
            context.metadata.protocolConfig.endpoint = `https://${authConfig.resource_url}/v1`;
          } else {
            context.metadata.protocolConfig.endpoint = 'https://portal.qwen.ai/v1';
          }

          secureLogger.info('🔥🔥 Qwen HTTP配置注入完成', {
            requestId: context.requestId,
            authFileName,
            hasToken: !!authConfig.access_token,
            endpoint: context.metadata.protocolConfig.endpoint,
            customHeaders: Object.keys(context.metadata.protocolConfig.customHeaders),
            resourceUrl: authConfig.resource_url
          });
        } else {
          secureLogger.error('🚨 [QWEN-ULTRA-DEBUG] protocolConfig不存在！', {
            requestId: context.requestId,
            metadataKeys: Object.keys(context.metadata),
            protocolConfig: context.metadata.protocolConfig
          });
        }
      } else {
        secureLogger.error('🚨 [QWEN-ULTRA-DEBUG] metadata不存在！', {
          requestId: context.requestId,
          contextKeys: Object.keys(context),
          metadata: context.metadata
        });
      }

      secureLogger.info('🔥🔥 Qwen OAuth2认证注入完成', {
        requestId: context.requestId,
        authFileName,
        hasToken: !!authConfig.access_token,
        endpoint: authConfig.resource_url,
        resourceUrl: authConfig.resource_url ? `https://${authConfig.resource_url}/v1/chat/completions` : undefined,
        model: processedRequest.model,
        finalModel: processedRequest.model,
        hasModelField: 'model' in processedRequest,
        requestKeys: Object.keys(processedRequest)
      });

      return processedRequest;

    } catch (error) {
      secureLogger.error('Qwen兼容性处理失败', {
        requestId: context.requestId,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Qwen OAuth2认证失败: ${error.message}`);
    }
  }

  /**
   * 获取有效的认证配置（支持自动刷新）
   */
  private async getValidAuthConfig(authFileName: string): Promise<QwenAuthConfig> {
    // 检查缓存
    const cached = this.authCache.get(authFileName);
    if (cached && Date.now() < cached.expires_at - 30000) { // 提前30秒刷新
      return cached;
    }

    // 从文件读取
    const authFilePath = path.join(this.authDir, `${authFileName}.json`);
    
    try {
      const fileContent = await fs.readFile(authFilePath, 'utf-8');
      const authConfig: QwenAuthConfig = JSON.parse(fileContent);

      // 检查是否需要刷新token
      if (Date.now() > authConfig.expires_at - 30000) {
        secureLogger.info('Qwen token即将过期，开始刷新', {
          authFileName,
          expiresAt: new Date(authConfig.expires_at).toISOString()
        });

        const refreshedConfig = await this.refreshAuthConfig(authConfig);
        await this.saveAuthConfig(authFileName, refreshedConfig);
        
        // 更新缓存
        this.authCache.set(authFileName, refreshedConfig);
        return refreshedConfig;
      }

      // 更新缓存
      this.authCache.set(authFileName, authConfig);
      return authConfig;

    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`认证文件不存在: ${authFileName}.json，请运行: rcc4 auth qwen ${authFileName.split('-').pop()}`);
      }
      throw new Error(`读取认证文件失败: ${error.message}`);
    }
  }

  /**
   * 刷新OAuth2 token
   */
  private async refreshAuthConfig(authConfig: QwenAuthConfig): Promise<QwenAuthConfig> {
    try {
      const response = await fetch('https://chat.qwen.ai/api/v1/oauth2/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'RCC4-Qwen-Client/1.0'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: authConfig.refresh_token,
          client_id: 'f0304373b74a44d2b584a3fb70ca9e56'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        secureLogger.error('Qwen token刷新失败', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        if (response.status === 400) {
          throw new Error(`Refresh token已过期，请重新认证: rcc4 auth qwen ${authConfig.account_index}`);
        }
        
        throw new Error(`Token刷新失败: ${response.status} ${response.statusText}`);
      }

      const tokenData = await response.json();

      const refreshedConfig: QwenAuthConfig = {
        ...authConfig,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || authConfig.refresh_token,
        resource_url: tokenData.resource_url || authConfig.resource_url,
        expires_at: Date.now() + (tokenData.expires_in * 1000)
      };

      secureLogger.info('Qwen token刷新成功', {
        accountIndex: authConfig.account_index,
        newExpiresAt: new Date(refreshedConfig.expires_at).toISOString(),
        hasNewResourceUrl: !!tokenData.resource_url
      });

      return refreshedConfig;

    } catch (error) {
      secureLogger.error('Qwen token刷新异常', {
        accountIndex: authConfig.account_index,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 保存刷新后的认证配置
   */
  private async saveAuthConfig(authFileName: string, authConfig: QwenAuthConfig): Promise<void> {
    const authFilePath = path.join(this.authDir, `${authFileName}.json`);
    
    try {
      await fs.writeFile(authFilePath, JQJsonHandler.stringifyJson(authConfig, false));
      secureLogger.debug('Qwen认证配置已更新', {
        authFileName,
        filePath: authFilePath
      });
    } catch (error) {
      secureLogger.warn('保存Qwen认证配置失败', {
        authFileName,
        error: error.message
      });
    }
  }

  /**
   * 清除认证缓存
   */
  clearCache(): void {
    this.authCache.clear();
    secureLogger.debug('Qwen认证缓存已清除');
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus(): any {
    const status = {};
    for (const [fileName, config] of this.authCache.entries()) {
      status[fileName] = {
        accountIndex: config.account_index,
        expiresAt: new Date(config.expires_at).toISOString(),
        isValid: Date.now() < config.expires_at - 30000,
        hasResourceUrl: !!config.resource_url
      };
    }
    return status;
  }

  // ============================================================================
  // 工具格式转换方法（基于ModelScope模式）
  // ============================================================================

  /**
   * 检查是否为Anthropic工具格式
   */
  private isAnthropicToolsFormat(tools: any[]): boolean {
    return tools.every(tool => 
      tool &&
      typeof tool.name === 'string' &&
      typeof tool.description === 'string' &&
      tool.input_schema &&
      typeof tool.input_schema === 'object' &&
      !tool.type && // OpenAI格式会有type: 'function'
      !tool.function // OpenAI格式会有function字段
    );
  }

  /**
   * 检查是否为OpenAI工具格式
   */
  private isOpenAIToolsFormat(tools: any[]): boolean {
    return tools.every(tool =>
      tool &&
      tool.type === 'function' &&
      tool.function &&
      typeof tool.function.name === 'string' &&
      typeof tool.function.description === 'string' &&
      tool.function.parameters &&
      typeof tool.function.parameters === 'object'
    );
  }

  /**
   * 转换Anthropic工具格式为OpenAI格式
   */
  private convertAnthropicToOpenAI(tools: any[]): any[] {
    const convertedTools: any[] = [];

    for (const [index, tool] of tools.entries()) {
      try {
        if (!this.isValidAnthropicTool(tool)) {
          throw new Error(`工具${index}不符合Anthropic格式: ${tool?.name || 'unknown'}`);
        }

        const openaiTool = {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description || '',
            parameters: {
              type: tool.input_schema.type || 'object',
              properties: tool.input_schema.properties || {},
              required: tool.input_schema.required || []
            }
          }
        };

        convertedTools.push(openaiTool);
        
        secureLogger.debug('✅ Qwen工具转换成功', {
          toolName: tool.name,
          index
        });

      } catch (error) {
        secureLogger.error('Qwen单个工具转换失败', {
          error: error.message,
          toolIndex: index,
          toolName: tool?.name
        });
        throw new Error(`工具转换失败(${index}): ${error.message}`);
      }
    }

    return convertedTools;
  }

  /**
   * 修复不完整的OpenAI格式工具
   */
  private fixIncompleteOpenAIFormat(tools: any[]): any[] {
    return tools.map((tool: any, index: number) => {
      if (tool && typeof tool === 'object') {
        // 确保工具对象格式正确
        const fixedTool = {
          type: tool.type || 'function',
          function: tool.function || {}
        };
        
        // 确保function有必需字段
        if (!fixedTool.function.name) {
          fixedTool.function.name = tool.name || `tool_${index}`;
        }
        if (!fixedTool.function.description) {
          fixedTool.function.description = tool.description || '';
        }
        if (!fixedTool.function.parameters) {
          fixedTool.function.parameters = tool.parameters || tool.input_schema || {};
        }
        
        return fixedTool;
      }
      return tool;
    }).filter(tool => tool !== null && tool !== undefined);
  }

  /**
   * 验证Anthropic工具
   */
  private isValidAnthropicTool(tool: any): boolean {
    return tool &&
           typeof tool.name === 'string' &&
           tool.name.length > 0 &&
           typeof tool.description === 'string' &&
           tool.input_schema &&
           typeof tool.input_schema === 'object';
  }

}