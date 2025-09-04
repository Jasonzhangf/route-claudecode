/**
 * RCC v4.0 配置管理模块 - 统一导出接口
 * 
 * 零接口暴露设计：只导出公开接口，所有内部实现完全隐藏
 * 
 * @author RCC v4.0 Architecture Team
 */

// 导出核心配置预处理器
export { ConfigPreprocessor, ConfigPreprocessResult } from './config-preprocessor';

// 导出类型定义
export { 
  RoutingTable, 
  ProviderInfo, 
  RouteMapping 
} from './routing-table-types';

// 模块元信息（编译时会自动更新）
export const MODULE_INFO = {
  name: 'config',
  version: '4.1.0',
  description: 'RCC v4.0 Configuration Management Module',
  apiVersion: '4.1.0',
  isolationLevel: 'complete'
} as const;