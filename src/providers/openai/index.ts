/**
 * OpenAI-Compatible Provider Module
 * 遵循六层清晰架构和零硬编码原则
 * 项目所有者: Jason Zhang
 */

// 🎯 统一客户端实现 - 消除重复代码
export { UnifiedOpenAIClient } from './unified-client';
export { 
  OpenAIClientFactory, 
  OpenAIClientConfig, 
  createOpenAIClient 
} from './client-factory';

// 🔧 工具模块
export { OpenAICompatibleClient } from './client';