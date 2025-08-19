/**
 * 工具模块入口文件
 *
 * @author Jason Zhang
 */

export * from './architecture-validator';
export { ProviderConfigValidator } from './provider-config-validator';
export * from './provider-performance-optimizer';
export { V4ConfigValidator } from './v4-config-validator';

// 模块版本信息
export const TOOLS_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface ToolsModuleInterface {
  version: string;
  validateArchitecture(): Promise<boolean>;
  validateProviderConfig(config: any): Promise<boolean>;
  optimizeProviderPerformance(config: any): Promise<any>;
  validateV4Config(config: any): Promise<boolean>;
}
