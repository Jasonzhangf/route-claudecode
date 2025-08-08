/**
 * 统一配置验证模块
 * 项目所有者: Jason Zhang
 * 
 * 提供零fallback的配置验证，确保所有配置都是明确的
 * 遵循零硬编码、零Fallback、零静默失败原则
 */

import { ProviderConfig } from '@/types';
import { logger } from '@/utils/logger';

/**
 * 配置验证错误类型
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly configField: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * 🚨 严格验证API Key - 零fallback原则
 */
export function validateApiKey(config: ProviderConfig, providerId: string): string {
  const credentials = config.authentication?.credentials;
  if (!credentials) {
    throw new ConfigValidationError(
      `Provider ${providerId} requires authentication credentials - violates zero fallback principle`,
      providerId,
      'authentication.credentials'
    );
  }

  const apiKey = credentials.apiKey || credentials.api_key;
  if (!apiKey) {
    throw new ConfigValidationError(
      `Provider ${providerId} requires valid API key - violates zero fallback principle`,
      providerId,
      'apiKey'
    );
  }

  // 处理数组格式的API key
  const finalApiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
  if (!finalApiKey || typeof finalApiKey !== 'string') {
    throw new ConfigValidationError(
      `Provider ${providerId} API key must be a valid string - violates zero fallback principle`,
      providerId,
      'apiKey'
    );
  }

  // 验证API key格式（基本检查）
  if (finalApiKey === 'dummy-key' || finalApiKey === 'test-key' || finalApiKey.length < 10) {
    throw new ConfigValidationError(
      `Provider ${providerId} has invalid or placeholder API key - violates zero fallback principle`,
      providerId,
      'apiKey'
    );
  }

  return finalApiKey;
}

/**
 * 🚨 严格验证Base URL - 零fallback原则
 */
export function validateBaseURL(config: ProviderConfig, providerId: string): string {
  if (!config.endpoint) {
    throw new ConfigValidationError(
      `Provider ${providerId} requires endpoint configuration - violates zero fallback principle`,
      providerId,
      'endpoint'
    );
  }

  let baseURL = config.endpoint;
  
  // 验证URL格式
  try {
    new URL(baseURL);
  } catch (error) {
    throw new ConfigValidationError(
      `Provider ${providerId} endpoint is not a valid URL: ${baseURL} - violates zero fallback principle`,
      providerId,
      'endpoint'
    );
  }

  // 标准化OpenAI兼容服务的URL
  if (baseURL.includes('/chat/completions')) {
    baseURL = baseURL.replace(/\/chat\/completions.*$/, '');
  }
  
  // 确保以/v1结尾（仅对OpenAI兼容服务）
  if (baseURL.includes('openai') || baseURL.includes('api.openai.com') || 
      baseURL.includes('v1') || baseURL.includes('completions')) {
    if (!baseURL.endsWith('/v1')) {
      // 移除可能的尾随斜杠
      if (baseURL.endsWith('/')) {
        baseURL = baseURL.slice(0, -1);
      }
      // 添加/v1
      baseURL += '/v1';
    }
  }

  return baseURL;
}

/**
 * 🚨 严格验证端口配置 - 零fallback原则
 */
export function validatePortConfiguration(config: ProviderConfig, providerId: string): number {
  // 尝试从endpoint URL提取端口
  try {
    const url = new URL(config.endpoint);
    if (url.port) {
      const port = parseInt(url.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new ConfigValidationError(
          `Provider ${providerId} has invalid port in endpoint: ${url.port} - must be 1-65535`,
          providerId,
          'endpoint.port'
        );
      }
      return port;
    }
  } catch (error) {
    throw new ConfigValidationError(
      `Provider ${providerId} endpoint URL is invalid - cannot extract port`,
      providerId,
      'endpoint'
    );
  }

  // 从环境变量获取
  if (process.env.RCC_PORT) {
    const envPort = parseInt(process.env.RCC_PORT, 10);
    if (isNaN(envPort) || envPort < 1 || envPort > 65535) {
      throw new ConfigValidationError(
        `Environment variable RCC_PORT has invalid value: ${process.env.RCC_PORT} - must be 1-65535`,
        providerId,
        'RCC_PORT'
      );
    }
    return envPort;
  }

  // 检查配置对象中的端口设置
  if (config.port) {
    const configPort = typeof config.port === 'string' ? parseInt(config.port, 10) : config.port;
    if (isNaN(configPort) || configPort < 1 || configPort > 65535) {
      throw new ConfigValidationError(
        `Provider ${providerId} has invalid port configuration: ${config.port} - must be 1-65535`,
        providerId,
        'port'
      );
    }
    return configPort;
  }

  // 零fallback - 必须明确配置端口
  throw new ConfigValidationError(
    `Provider ${providerId} requires explicit port configuration - violates zero fallback principle. ` +
    `Set port in endpoint URL, RCC_PORT environment variable, or config.port`,
    providerId,
    'port'
  );
}

/**
 * 🚨 严格验证默认模型 - 零fallback原则
 */
export function validateDefaultModel(config: ProviderConfig, providerId: string): string {
  if (!config.defaultModel) {
    throw new ConfigValidationError(
      `Provider ${providerId} requires explicit defaultModel configuration - violates zero fallback principle`,
      providerId,
      'defaultModel'
    );
  }

  const model = config.defaultModel;
  if (typeof model !== 'string' || model.length === 0) {
    throw new ConfigValidationError(
      `Provider ${providerId} defaultModel must be a non-empty string - violates zero fallback principle`,
      providerId,
      'defaultModel'
    );
  }

  // 检查常见的fallback模型名
  const fallbackModels = ['gpt-3.5-turbo', 'claude-3-haiku', 'default', 'fallback', 'unknown'];
  if (fallbackModels.includes(model.toLowerCase())) {
    logger.warn(`Provider ${providerId} is using a common fallback model: ${model}`, {
      providerId,
      model,
      suggestion: 'Consider using a more specific model name'
    });
  }

  return model;
}

/**
 * 验证SDK选项配置
 */
export function validateSDKOptions(options: any = {}): Required<{
  timeout: number;
  maxRetries: number;
  defaultHeaders: Record<string, string>;
}> {
  const timeout = typeof options.timeout === 'number' ? options.timeout : 60000;
  const maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : 3;
  const defaultHeaders = options.defaultHeaders || {};

  // 验证超时时间
  if (timeout < 1000 || timeout > 600000) { // 1秒到10分钟
    throw new ConfigValidationError(
      `SDK timeout must be between 1000ms and 600000ms, got: ${timeout}`,
      'sdk',
      'timeout'
    );
  }

  // 验证重试次数
  if (maxRetries < 0 || maxRetries > 10) {
    throw new ConfigValidationError(
      `SDK maxRetries must be between 0 and 10, got: ${maxRetries}`,
      'sdk',
      'maxRetries'
    );
  }

  // 验证headers格式
  if (typeof defaultHeaders !== 'object' || Array.isArray(defaultHeaders)) {
    throw new ConfigValidationError(
      `SDK defaultHeaders must be an object, got: ${typeof defaultHeaders}`,
      'sdk',
      'defaultHeaders'
    );
  }

  return {
    timeout,
    maxRetries,
    defaultHeaders: {
      'User-Agent': `claude-code-router/2.8.0`,
      ...defaultHeaders
    }
  };
}

/**
 * 综合配置验证 - 一次性验证所有必需配置
 */
export interface ValidatedConfig {
  apiKey: string;
  baseURL: string;
  port: number;
  defaultModel: string;
  sdkOptions: ReturnType<typeof validateSDKOptions>;
  httpOptions?: {
    timeout?: number;
    maxRetries?: number;
    defaultHeaders?: Record<string, string>;
  };
}

export function validateProviderConfig(
  config: ProviderConfig, 
  providerId: string,
  sdkOptions?: any
): ValidatedConfig {
  logger.info(`Validating configuration for provider: ${providerId}`, {
    providerId,
    hasEndpoint: !!config.endpoint,
    hasAuth: !!config.authentication,
    hasDefaultModel: !!config.defaultModel
  });

  try {
    const validatedConfig: ValidatedConfig = {
      apiKey: validateApiKey(config, providerId),
      baseURL: validateBaseURL(config, providerId),
      port: validatePortConfiguration(config, providerId),
      defaultModel: validateDefaultModel(config, providerId),
      sdkOptions: validateSDKOptions(sdkOptions),
      httpOptions: sdkOptions // Pass through httpOptions as-is
    };

    logger.info(`Configuration validation passed for provider: ${providerId}`, {
      providerId,
      baseURL: validatedConfig.baseURL,
      hasApiKey: !!validatedConfig.apiKey,
      port: validatedConfig.port,
      defaultModel: validatedConfig.defaultModel,
      timeout: validatedConfig.sdkOptions.timeout,
      maxRetries: validatedConfig.sdkOptions.maxRetries
    });

    return validatedConfig;

  } catch (error) {
    logger.error(`Configuration validation failed for provider: ${providerId}`, {
      providerId,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof ConfigValidationError ? error.name : 'Unknown'
    });
    
    throw error;
  }
}