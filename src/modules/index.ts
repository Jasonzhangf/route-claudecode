/**
 * 模块系统 - 零接口暴露门面
 *
 * 严格遵循零接口暴露设计原则，只导出最必要的模块接口
 *
 * @version 4.0.0-zero-interface
 * @author Jason Zhang - Zero Interface Refactored
 */

// 核心模块适配器 - 只导出公共接口
export type { ModuleInterface, ModuleType } from '../interfaces/module/base-module';

// Transformers - 选择性导出避免冲突
export {
  SecureAnthropicToOpenAITransformer,
  SecureTransformerFactory,
  createSecureTransformerFactory,
  getGlobalTransformerFactory,
  resetGlobalTransformerFactory,
  isSecureTransformer,
  validateSecurityConfig,
  createDefaultSecurityConfig,
  SECURITY_LIMITS,
  SUPPORTED_SECURE_VERSIONS,
  DEPRECATED_TRANSFORMER_IDS
} from './transformers';

// Pipeline模块系统 - 选择性导出避免冲突
export {
  // LMStudioPipeline, // REMOVED - 违背模块化架构设计
  OpenAIProtocolModule,
  LMStudioCompatibilityModule,
  OllamaCompatibilityModule,
  VLLMCompatibilityModule,
  OpenAIServerModule
} from './pipeline-modules';

// Transformer模块
export * from './transformer';

// Protocol模块
export * from './protocol';

// Server Compatibility模块
export * from './server-compatibility';

// 模块版本信息
export const MODULES_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface ModulesModuleInterface {
  version: string;
  registerModule(module: any): void;
  getModule(moduleId: string): any;
}

// ModuleInterface implementation for architecture compliance
import { SimpleModuleAdapter, ModuleType } from '../interfaces/module/base-module';
export const modulesModuleAdapter = new SimpleModuleAdapter(
  'modules-module',
  'Core Modules System',
  ModuleType.PIPELINE,
  MODULES_MODULE_VERSION
);
