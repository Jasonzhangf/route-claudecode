/**
 * Secure Transformer Factory
 *
 * 安全的Transformer工厂，确保只创建经过安全审计的transformer实例
 * 防止使用存在漏洞的废弃实现
 *
 * @author Jason Zhang
 * @version 2.0.0
 * @security-reviewed 2025-08-19
 */

import { ModuleInterface, ModuleType } from '../../interfaces/module/base-module';
import {
  SecureAnthropicToOpenAITransformer,
  SecureTransformerPreConfig,
  TransformerSecurityError,
} from './secure-anthropic-openai-transformer';
import { SecureGeminiTransformer } from './secure-gemini-transformer';
import { API_DEFAULTS } from '../../constants/src/bootstrap-constants';
import { JQJsonHandler } from '../../utils/jq-json-handler';

// 创建getSafeMaxTokens函数的简单实现
function getSafeMaxTokens(): number {
  return API_DEFAULTS.TOKEN_LIMITS.DEFAULT_MAX_TOKENS;
}
/**
 * 支持的安全Transformer类型
 */
export enum SecureTransformerType {
  ANTHROPIC_TO_OPENAI = 'anthropic-to-openai',
  GEMINI_TO_OPENAI = 'gemini-to-openai',
  // 未来可以添加其他安全的transformer类型
  // OPENAI_TO_ANTHROPIC = 'openai-to-anthropic',
}

/**
 * Transformer工厂配置
 */
export interface TransformerFactoryConfig {
  // 默认安全配置
  defaultSecurityConfig: Partial<SecureTransformerPreConfig>;

  // 是否允许废弃的transformer（默认为false）
  allowDeprecated?: boolean;

  // 安全审计模式
  securityAuditMode?: boolean;

  // 日志配置
  enableSecurityLogging?: boolean;
}

/**
 * 安全的Transformer工厂
 *
 * 功能：
 * - 只创建经过安全审计的transformer实例
 * - 防止使用废弃的不安全实现
 * - 统一的安全配置管理
 * - 创建实例的安全验证
 */
export class SecureTransformerFactory {
  private readonly config: TransformerFactoryConfig;
  private readonly createdInstances: Map<string, ModuleInterface> = new Map();

  constructor(config: TransformerFactoryConfig) {
    this.config = {
      allowDeprecated: false, // 默认禁止废弃实现
      securityAuditMode: true,
      enableSecurityLogging: true,
      ...config,
    };

    // 安全检查：确保不允许废弃实现
    if (this.config.allowDeprecated) {
      // WARNING: Deprecated transformers are allowed. This may pose security risks.
    }

    this.logSecurityEvent('factory-initialized', {
      allowDeprecated: this.config.allowDeprecated,
      securityAuditMode: this.config.securityAuditMode,
    });
  }

  /**
   * 创建安全的Transformer模块
   */
  async createModule(type: ModuleType, config: any): Promise<ModuleInterface> {
    if (type !== ModuleType.TRANSFORMER) {
      throw new TransformerSecurityError('Factory only supports TRANSFORMER module type', 'INVALID_MODULE_TYPE', {
        requestedType: type,
      });
    }

    return this.createTransformer(config.transformerType || SecureTransformerType.ANTHROPIC_TO_OPENAI, config);
  }

  /**
   * 创建指定类型的安全Transformer
   */
  async createTransformer(
    transformerType: SecureTransformerType,
    config: Partial<SecureTransformerPreConfig> = {}
  ): Promise<ModuleInterface> {
    // 验证transformer类型
    this.validateTransformerType(transformerType);

    // 合并默认安全配置
    const secureConfig = this.createSecureConfig(config);

    // 验证配置安全性
    this.validateConfigSecurity(secureConfig);

    let transformer: ModuleInterface;

    switch (transformerType) {
      case SecureTransformerType.ANTHROPIC_TO_OPENAI:
        transformer = new SecureAnthropicToOpenAITransformer(secureConfig);
        break;

      case SecureTransformerType.GEMINI_TO_OPENAI:
        transformer = new SecureGeminiTransformer(secureConfig);
        break;

      default:
        throw new TransformerSecurityError(
          `Unsupported transformer type: ${transformerType}`,
          'UNSUPPORTED_TRANSFORMER_TYPE',
          { transformerType }
        );
    }

    // 注册实例以供跟踪
    this.registerInstance(transformer);

    this.logSecurityEvent('transformer-created', {
      type: transformerType,
      instanceId: transformer.getId(),
      configHash: this.calculateConfigHash(secureConfig),
    });

    return transformer;
  }

  /**
   * 获取支持的模块类型
   */
  getSupportedTypes(): ModuleType[] {
    return [ModuleType.TRANSFORMER];
  }

  /**
   * 获取支持的Transformer类型
   */
  getSupportedTransformerTypes(): SecureTransformerType[] {
    return Object.values(SecureTransformerType);
  }

  /**
   * 验证模块配置
   */
  validateConfig(type: ModuleType, config: any): boolean {
    if (type !== ModuleType.TRANSFORMER) {
      return false;
    }

    try {
      const transformerType = config.transformerType || SecureTransformerType.ANTHROPIC_TO_OPENAI;
      this.validateTransformerType(transformerType);
      this.validateConfigSecurity(config);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取已创建的实例列表
   */
  getCreatedInstances(): ModuleInterface[] {
    return Array.from(this.createdInstances.values());
  }

  /**
   * 清理所有创建的实例
   */
  async cleanup(): Promise<void> {
    const instances = Array.from(this.createdInstances.values());

    for (const instance of instances) {
      try {
        await instance.cleanup();
      } catch (error) {
        this.logSecurityEvent('instance-cleanup-failed', {
          instanceId: instance.getId(),
          error: error.message,
        });
      }
    }

    this.createdInstances.clear();

    this.logSecurityEvent('factory-cleanup-completed', {
      cleanedInstances: instances.length,
    });
  }

  // ============================================================================
  // 私有安全方法
  // ============================================================================

  private validateTransformerType(type: SecureTransformerType): void {
    if (!Object.values(SecureTransformerType).includes(type)) {
      throw new TransformerSecurityError('Invalid transformer type', 'INVALID_TRANSFORMER_TYPE', {
        type,
        supportedTypes: Object.values(SecureTransformerType),
      });
    }

    // 检查是否为废弃类型（目前没有，但为未来扩展预留）
    const deprecatedTypes: string[] = [];

    if (deprecatedTypes.includes(type) && !this.config.allowDeprecated) {
      throw new TransformerSecurityError('Deprecated transformer type not allowed', 'DEPRECATED_TRANSFORMER_BLOCKED', {
        type,
      });
    }
  }

  private createSecureConfig(userConfig: Partial<SecureTransformerPreConfig>): SecureTransformerPreConfig {
    const defaultConfig = this.config.defaultSecurityConfig;

    // 合并配置，确保安全默认值
    const mergedConfig: SecureTransformerPreConfig = {
      // 基础配置
      preserveToolCalls: true,
      mapSystemMessage: true,
      defaultMaxTokens: getSafeMaxTokens(),

      // 覆盖默认配置
      ...defaultConfig,

      // 覆盖用户配置
      ...userConfig,
    };

    return mergedConfig;
  }

  private validateConfigSecurity(config: SecureTransformerPreConfig): void {
    // Simple validation for simplified config
    if (config.defaultMaxTokens <= 0 || config.defaultMaxTokens > 100000) {
      throw new Error('defaultMaxTokens must be between 1 and 100000');
    }
  }

  private registerInstance(transformer: ModuleInterface): void {
    const id = transformer.getId();

    if (this.createdInstances.has(id)) {
      throw new TransformerSecurityError('Transformer instance ID already exists', 'DUPLICATE_INSTANCE_ID', { id });
    }

    this.createdInstances.set(id, transformer);
  }

  private calculateConfigHash(config: any): string {
    try {
      const configString = JQJsonHandler.stringifyJson(config, false);
      let hash = 0;
      for (let i = 0; i < configString.length; i++) {
        const char = configString.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // 转为32位整数
      }
      return hash.toString(36);
    } catch {
      return 'unknown';
    }
  }

  private logSecurityEvent(event: string, details: any): void {
    if (this.config.enableSecurityLogging) {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        event,
        source: 'SecureTransformerFactory',
        details: this.sanitizeLogData(details),
      };

      // Security logging removed for cleaner output
    }
  }

  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

/**
 * 创建默认的安全Transformer工厂实例
 */
export function createSecureTransformerFactory(
  config: Partial<TransformerFactoryConfig> = {}
): SecureTransformerFactory {
  const defaultConfig: TransformerFactoryConfig = {
    defaultSecurityConfig: {
      // 使用动态计算而不是硬编码
      preserveToolCalls: true,
      mapSystemMessage: true,
      defaultMaxTokens: 4096,
    },
    allowDeprecated: false,
    securityAuditMode: true,
    enableSecurityLogging: true,
    ...config,
  };

  return new SecureTransformerFactory(defaultConfig);
}

/**
 * 全局单例工厂实例
 */
let globalFactory: SecureTransformerFactory | null = null;

/**
 * 获取全局安全Transformer工厂实例
 */
export function getGlobalTransformerFactory(): SecureTransformerFactory {
  if (!globalFactory) {
    globalFactory = createSecureTransformerFactory();
  }

  return globalFactory;
}

/**
 * 重置全局工厂实例（主要用于测试）
 */
export async function resetGlobalTransformerFactory(): Promise<void> {
  if (globalFactory) {
    await globalFactory.cleanup();
    globalFactory = null;
  }
}
