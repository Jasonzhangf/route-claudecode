/**
 * Module Management API - 模块管理API
 * 
 * 提供统一的模块实例管理接口
 * 支持创建、启动、停止、配置和处理请求
 * 
 * @author RCC v4.0 Phase 3 API Implementation
 */

import { ModuleInterface, ModuleType } from '../../interfaces/module/base-module';
import { SecureAnthropicToOpenAITransformer } from '../../modules/transformers/secure-anthropic-openai-transformer';
import { SecureGeminiTransformer } from '../../modules/transformers/secure-gemini-transformer';

// Protocol模块
import { OpenAIProtocolModule } from '../../modules/pipeline-modules/protocol/openai-protocol';

// Server-Compatibility模块
import { LMStudioCompatibilityModule } from '../../modules/pipeline-modules/server-compatibility/lmstudio-compatibility';

// Server模块
import { OpenAIServerModule } from '../../modules/pipeline-modules/server/openai-server';

// Validator模块
import { AnthropicInputValidator } from '../../modules/validators/anthropic-input-validator';

// Provider模块
import { AnthropicProtocolHandler } from '../../modules/providers/anthropic-protocol-handler';

// 存储所有模块实例
const moduleInstances = new Map<string, ModuleInterface>();

/**
 * 模块创建请求
 */
export interface CreateModuleRequest {
  type: ModuleType;
  moduleType: string; // 具体的模块类型，如 'anthropic-openai', 'gemini' 等
  config?: any;
}

/**
 * 模块创建响应
 */
export interface CreateModuleResponse {
  id: string;
  type: ModuleType;
  moduleType: string;
  status: 'created';
}

/**
 * 模块启动请求
 */
export interface StartModuleRequest {
  id: string;
}

/**
 * 模块启动响应
 */
export interface StartModuleResponse {
  id: string;
  status: 'started';
}

/**
 * 模块停止请求
 */
export interface StopModuleRequest {
  id: string;
}

/**
 * 模块停止响应
 */
export interface StopModuleResponse {
  id: string;
  status: 'stopped';
}

/**
 * 模块配置请求
 */
export interface ConfigureModuleRequest {
  id: string;
  config: any;
}

/**
 * 模块配置响应
 */
export interface ConfigureModuleResponse {
  id: string;
  status: 'configured';
}

/**
 * 模块处理请求
 */
export interface ProcessModuleRequest {
  id: string;
  input: any;
}

/**
 * 模块处理响应
 */
export interface ProcessModuleResponse {
  output: any;
}

/**
 * 模块状态查询响应
 */
export interface GetModuleStatusResponse {
  id: string;
  type: ModuleType;
  moduleType: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'idle' | 'busy';
  health: 'healthy' | 'degraded' | 'unhealthy';
  uptime?: number;
  lastActivity?: number;
}

/**
 * 创建模块实例
 */
export async function createModule(request: CreateModuleRequest): Promise<CreateModuleResponse> {
  const id = `${request.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  let module: ModuleInterface;
  
  switch (request.type) {
    case ModuleType.TRANSFORMER:
      switch (request.moduleType) {
        case 'anthropic-openai':
          module = new SecureAnthropicToOpenAITransformer();
          break;
        case 'gemini':
          module = new SecureGeminiTransformer();
          break;
        default:
          throw new Error(`Unsupported transformer module type: ${request.moduleType}`);
      }
      break;
      
    case ModuleType.PROTOCOL:
      switch (request.moduleType) {
        case 'openai':
          module = new OpenAIProtocolModule();
          break;
        default:
          throw new Error(`Unsupported protocol module type: ${request.moduleType}`);
      }
      break;
      
    case ModuleType.SERVER_COMPATIBILITY:
      switch (request.moduleType) {
        case 'lmstudio':
          if (!request.config) {
            throw new Error('LMStudio compatibility module requires config');
          }
          module = new LMStudioCompatibilityModule(request.config);
          break;
        default:
          throw new Error(`Unsupported server compatibility module type: ${request.moduleType}`);
      }
      break;
      
    case ModuleType.SERVER:
      switch (request.moduleType) {
        case 'openai':
          if (!request.config) {
            throw new Error('OpenAI server module requires config');
          }
          module = new OpenAIServerModule(request.config);
          break;
        default:
          throw new Error(`Unsupported server module type: ${request.moduleType}`);
      }
      break;
      
    case ModuleType.VALIDATOR:
      switch (request.moduleType) {
        case 'anthropic':
          module = new AnthropicInputValidator(request.config || {});
          break;
        default:
          throw new Error(`Unsupported validator module type: ${request.moduleType}`);
      }
      break;
      
    default:
      throw new Error(`Unsupported module type: ${request.type}`);
  }
  
  // 存储实例
  moduleInstances.set(id, module);
  
  return {
    id,
    type: request.type,
    moduleType: request.moduleType,
    status: 'created'
  };
}

/**
 * 启动模块实例
 */
export async function startModule(request: StartModuleRequest): Promise<StartModuleResponse> {
  const module = moduleInstances.get(request.id);
  if (!module) {
    throw new Error(`Module instance not found: ${request.id}`);
  }
  
  await module.start();
  
  return {
    id: request.id,
    status: 'started'
  };
}

/**
 * 停止模块实例
 */
export async function stopModule(request: StopModuleRequest): Promise<StopModuleResponse> {
  const module = moduleInstances.get(request.id);
  if (!module) {
    throw new Error(`Module instance not found: ${request.id}`);
  }
  
  await module.stop();
  
  return {
    id: request.id,
    status: 'stopped'
  };
}

/**
 * 配置模块实例
 */
export async function configureModule(request: ConfigureModuleRequest): Promise<ConfigureModuleResponse> {
  const module = moduleInstances.get(request.id);
  if (!module) {
    throw new Error(`Module instance not found: ${request.id}`);
  }
  
  await module.configure(request.config);
  
  return {
    id: request.id,
    status: 'configured'
  };
}

/**
 * 处理请求
 */
export async function processWithModule(request: ProcessModuleRequest): Promise<ProcessModuleResponse> {
  const module = moduleInstances.get(request.id);
  if (!module) {
    throw new Error(`Module instance not found: ${request.id}`);
  }
  
  const output = await module.process(request.input);
  
  return {
    output
  };
}

/**
 * 获取模块状态
 */
export async function getModuleStatus(id: string): Promise<GetModuleStatusResponse> {
  const module = moduleInstances.get(id);
  if (!module) {
    throw new Error(`Module instance not found: ${id}`);
  }
  
  const status = module.getStatus();
  
  return {
    id,
    type: status.type,
    moduleType: module.getName(),
    status: status.status,
    health: status.health,
    uptime: status.lastActivity ? Date.now() - status.lastActivity.getTime() : undefined,
    lastActivity: status.lastActivity ? status.lastActivity.getTime() : undefined
  };
}

/**
 * 销毁模块实例
 */
export async function destroyModule(id: string): Promise<void> {
  const module = moduleInstances.get(id);
  if (!module) {
    throw new Error(`Module instance not found: ${id}`);
  }
  
  // 停止实例
  await module.stop();
  
  // 清理资源
  await module.cleanup();
  
  // 从存储中移除
  moduleInstances.delete(id);
}

/**
 * 获取所有模块状态
 */
export async function getAllModulesStatus(): Promise<GetModuleStatusResponse[]> {
  const statuses: GetModuleStatusResponse[] = [];
  
  for (const [id, module] of moduleInstances) {
    try {
      const status = module.getStatus();
      statuses.push({
        id,
        type: status.type,
        moduleType: module.getName(),
        status: status.status,
        health: status.health,
        uptime: status.lastActivity ? Date.now() - status.lastActivity.getTime() : undefined,
        lastActivity: status.lastActivity ? status.lastActivity.getTime() : undefined
      });
    } catch (error) {
      // 如果获取状态失败，添加错误状态
      statuses.push({
        id,
        type: ModuleType.TRANSFORMER, // 默认类型
        moduleType: 'unknown',
        status: 'error',
        health: 'unhealthy'
      });
    }
  }
  
  return statuses;
}