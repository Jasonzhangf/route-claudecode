/**
 * 模块系统入口文件
 *
 * @author Jason Zhang
 */

// 核心模块实现
export * from './base-module-impl';

// 核心功能模块
export * from './providers';
export * from './validators';
export * from './routing';

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
