/**
 * OpenAI-Compatible Provider Module
 * 统一转换层架构 - 所有OpenAI兼容provider使用统一转换机制
 */

export { OpenAISDKClient, OpenAISDKConfig } from './sdk-client';
export { 
  OpenAIClientFactory, 
  OpenAIClientConfig, 
  ClientType,
  createOpenAIClient 
} from './client-factory';

// 🆕 统一转换层 - 解决重复响应和静默停止问题
// export { 
//   UnifiedConversionOpenAIClient 
// } from './unified-conversion-client';
// export { 
//   UnifiedOpenAIProviderFactory,
//   createUnifiedOpenAIProvider,
//   shouldUseUnifiedConversion,
//   UnifiedProviderFactoryConfig
// } from './unified-factory';

// Legacy clients maintained for fallback
export { OpenAICompatibleClient } from './client';