/**
 * Secure Transformers Module Exports
 *
 * 只导出经过安全审计的transformer实现
 * 废弃的不安全实现不会被导出
 *
 * @author Jason Zhang
 * @version 2.0.0
 * @security-reviewed 2025-08-19
 */

// ============================================================================
// 安全的Transformer实现
// ============================================================================

export {
  SecureAnthropicToOpenAITransformer,
  SecureTransformerConfig,
  TransformerSecurityError,
  TransformerValidationError,
  AnthropicRequest,
  OpenAIRequest,
  OpenAIResponse,
  AnthropicResponse,
} from './secure-anthropic-openai-transformer';

export {
  SecureTransformerFactory,
  SecureTransformerType,
  TransformerFactoryConfig,
  createSecureTransformerFactory,
  getGlobalTransformerFactory,
  resetGlobalTransformerFactory,
} from './transformer-factory';

// ============================================================================
// 废弃警告和迁移指南
// ============================================================================

/**
 * ⚠️ 重要安全通知 ⚠️
 *
 * 以下transformer实现已被废弃，因为存在严重的安全漏洞：
 *
 * - AnthropicToOpenAITransformer (src/modules/transformers/anthropic-to-openai-transformer.ts)
 * - AnthropicToOpenAITransformer (src/modules/pipeline-modules/transformer/anthropic-to-openai.ts)
 *
 * 安全问题包括：
 * - 不安全的JSON解析可能导致代码注入
 * - 缺乏输入验证和边界检查
 * - 硬编码配置值
 * - 资源使用无控制
 * - 信息泄露风险
 *
 * 迁移到安全实现：
 *
 * ```typescript
 * // ❌ 不要使用废弃的实现
 * import { AnthropicToOpenAITransformer } from './anthropic-to-openai-transformer';
 *
 * // ✅ 使用新的安全实现
 * import {
 *   SecureAnthropicToOpenAITransformer,
 *   createSecureTransformerFactory
 * } from '@/modules/transformers';
 *
 * // 推荐使用工厂模式
 * const factory = createSecureTransformerFactory({
 *   defaultSecurityConfig: {
 *     apiMaxTokens: 8192,
 *     processingTimeoutMs: 30000,
 *     strictValidation: true
 *   }
 * });
 *
 * const transformer = await factory.createTransformer(
 *   SecureTransformerType.ANTHROPIC_TO_OPENAI
 * );
 *
 * await transformer.start();
 * const result = await transformer.process(request);
 * ```
 */

// ============================================================================
// 类型守卫和工具函数
// ============================================================================

/**
 * 检查是否为安全的transformer实例
 */
export function isSecureTransformer(transformer: any): boolean {
  return transformer && transformer.constructor.name === 'SecureAnthropicToOpenAITransformer';
}

/**
 * 验证transformer配置的安全性
 */
export function validateSecurityConfig(config: any): config is SecureTransformerConfig {
  try {
    return (
      typeof config === 'object' &&
      config !== null &&
      typeof config.apiMaxTokens === 'number' &&
      config.apiMaxTokens > 0 &&
      config.apiMaxTokens <= 100000 &&
      typeof config.processingTimeoutMs === 'number' &&
      config.processingTimeoutMs >= 1000 &&
      config.processingTimeoutMs <= 300000
    );
  } catch {
    return false;
  }
}

/**
 * 创建默认的安全配置
 */
export function createDefaultSecurityConfig(): SecureTransformerConfig {
  return {
    preserveToolCalls: true,
    mapSystemMessage: true,
    defaultMaxTokens: 4096,
    maxMessageCount: 50,
    maxMessageSize: 10 * 1024,
    maxContentLength: 100 * 1024,
    maxToolsCount: 20,
    processingTimeoutMs: 30000,
    apiMaxTokens: 8192,
    modelMaxTokens: new Map(),
    strictValidation: true,
    sanitizeInputs: true,
    logSecurityEvents: true,
  };
}

// ============================================================================
// 安全常量
// ============================================================================

/**
 * 安全限制常量
 */
export const SECURITY_LIMITS = {
  MAX_API_TOKENS: 100000,
  MIN_PROCESSING_TIMEOUT: 1000,
  MAX_PROCESSING_TIMEOUT: 300000,
  MAX_MESSAGE_COUNT: 1000,
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB
  MAX_CONTENT_LENGTH: 10 * 1024 * 1024, // 10MB
  MAX_TOOLS_COUNT: 100,
} as const;

/**
 * 支持的安全transformer版本
 */
export const SUPPORTED_SECURE_VERSIONS = ['2.0.0'] as const;

/**
 * 废弃的transformer标识符
 */
export const DEPRECATED_TRANSFORMER_IDS = [
  'anthropic-to-openai-transformer',
  'anthropic-to-openai', // pipeline版本
] as const;

// ============================================================================
// 重新导入接口以确保类型一致性
// ============================================================================

import { SecureTransformerConfig } from './secure-anthropic-openai-transformer';
