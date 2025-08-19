/**
 * 模块系统入口文件
 *
 * @author Jason Zhang
 */

// 导出存在的模块 - 使用选择性导出避免冲突
export * from './base-module-impl';
export * from './providers';
export * from './validators';

// 选择性导出pipeline-modules，避免与transformers冲突
export { LMStudioPipeline } from './pipeline-modules';

// 选择性导出transformers，避免重复
export { AnthropicToOpenAITransformer } from './transformers/anthropic-to-openai-transformer';

// 注释掉不存在的模块
// export * from './module-registry';
// export * from './module-factory';
// export * from './base-module';
// export * from './module-loader';
// export * from './module-validator';
// export * from './provider-modules';
// export * from './validation-modules';

// 模块版本信息
export const MODULES_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface ModulesModuleInterface {
  version: string;
  registerModule(module: any): void;
  getModule(moduleId: string): any;
}
