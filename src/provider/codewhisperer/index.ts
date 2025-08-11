/**
 * CodeWhisperer Provider Main Entry
 * 集成增强认证管理器和智能重试机制
 * 基于 AIClient-2-API 的优秀架构设计
 * 项目所有者: Jason Zhang
 */

export * from './types';
export * from './auth';
export * from './converter';
export * from './parser';
export * from './client';
export * from './adapter';

// 增强功能导出 (避免重复导出)
export { 
  CredentialSource, 
  AuthMethod, 
  DEFAULT_RETRY_CONFIG, 
  DEFAULT_REGION_CONFIG, 
  DEFAULT_CREDENTIAL_CONFIG,
  type TokenData as EnhancedTokenData,
  type KiroAuthConfig,
  type CredentialConfig,
  type RetryConfig,
  type RegionConfig
} from './enhanced-auth-config';
export { EnhancedCodeWhispererAuth } from './enhanced-auth-manager';
export { CredentialManager } from './credential-manager';
export { RetryManager, type RetryableError } from './retry-manager';
export { EnhancedCodeWhispererClient } from './enhanced-client';

// 便捷导出主要类
export { CodeWhispererAuth } from './auth';
export { CodeWhispererConverter } from './converter';
export { CodeWhispererParser } from './parser';
export { CodeWhispererClient } from './client';
export { CodeWhispererProvider } from './adapter';

// 配置迁移工具
export { CodeWhispererConfigMigrator, type LegacyCodeWhispererConfig } from './config-migration';
export { BackwardCompatibleCodeWhispererClient } from './backward-compatible-client';

// 便捷导出配置函数
export { createCodeWhispererConfig, getDefaultModelMapping } from './types';