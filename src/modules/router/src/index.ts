/**
 * RCC v4.0 路由器模块 - 统一导出接口
 * 
 * 零接口暴露设计：只导出公开接口，所有内部实现完全隐藏
 * 
 * @author RCC v4.0 Architecture Team
 */

// 导出核心路由预处理器
export { RouterPreprocessor, RouterPreprocessResult, PipelineConfig, PipelineLayer } from './router-preprocessor';

// 模块元信息（编译时会自动更新）
export const MODULE_INFO = {
  name: 'router',
  version: '4.1.0',
  description: 'RCC v4.0 Router Management Module',
  apiVersion: '4.1.0',
  isolationLevel: 'complete'
} as const;