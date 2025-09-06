/**
 * RCC v4.0 Configuration Module Exports
 *
 * 严格遵循零接口暴露设计原则
 * 只导出ConfigPreprocessor门面和必要类型
 *
 * @version 4.1.0-zero-interface
 * @author Claude - Zero Interface Refactored
 */

// 主要门面接口 - 零接口暴露设计
export { ConfigPreprocessor } from './config-preprocessor';

// 只导出必要的类型定义
export type {
  RoutingTable,
  ProviderInfo,
  RouteMapping,
  ServerInfo as ServerConfig,
  ConfigPreprocessResult
} from './routing-table-types';

// 模块版本信息
export const CONFIG_MODULE_VERSION = '4.1.0-zero-interface';

// 标准模块接口实现 (暂时注释掉，直到创建config-module文件)
// export { ConfigModule, createConfigModule, processConfigFile } from './config-module';
// export type { ConfigModuleInput, ConfigModuleOutput } from './config-module';