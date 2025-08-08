/**
 * CodeWhisperer Provider Main Entry - 重构版本
 * 使用统一架构：Transformer + Session + Provider
 * 项目所有者: Jason Zhang
 */

// 🎯 重构后的核心导出 - 遵循OpenAI架构模式
export { 
  CodeWhispererUnifiedClient, 
  CodeWhispererUnifiedConfig,
  createCodeWhispererUnifiedClient 
} from './unified-client';

// 🔄 Transformer导出
export { 
  CodeWhispererTransformer,
  createCodeWhispererTransformer 
} from '@/transformers/codewhisperer';

// 🔧 基础组件导出（保持向后兼容）
export { CodeWhispererAuth } from './auth';
export { CodeWhispererRequest, CodeWhispererResponse } from '@/transformers/codewhisperer';

// 🗑️ 传统组件标记为弃用（将在v3.0中移除）
/** @deprecated 使用 CodeWhispererUnifiedClient 替代 */
export { EnhancedCodeWhispererClient } from './enhanced-client';
/** @deprecated 使用统一transformer架构替代 */
export { CodeWhispererConverter } from './converter';
/** @deprecated 使用统一parser系统替代 */
export { CodeWhispererParser } from './parser';
/** @deprecated 使用unified-client替代 */
export { CodeWhispererClient } from './client';
/** @deprecated 使用unified-client替代 */
export { CodeWhispererProvider } from './adapter';

// 🔧 配置管理相关
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

// 🔄 配置迁移工具（临时保留）
export { CodeWhispererConfigMigrator, type LegacyCodeWhispererConfig } from './config-migration';
export { BackwardCompatibleCodeWhispererClient } from './backward-compatible-client';

// 🛠️ 便捷函数
export { createCodeWhispererConfig, getDefaultModelMapping } from './types';