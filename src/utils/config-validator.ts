/**
 * 配置验证器 - 启动时验证和修正配置
 */

import axios from 'axios';
import { logger } from './logger';

interface ModelTestResult {
  model: string;
  maxTokens: number | null;
  supportsStreaming: boolean;
  responseTime: number | null;
  finishReason: string | null;
  error: string | null;
}

interface ProviderConfig {
  type: string;
  endpoint: string;
  authentication: {
    credentials: {
      apiKey: string | string[];
    };
  };
  models: string[];
  maxTokens: Record<string, number>;
}

/**
 * 测试ModelScope模型的参数限制
 */
async function testModelScopeModel(apiKey: string, model: string): Promise<ModelTestResult> {
  const endpoint = 'https://api-inference.modelscope.cn/v1/chat/completions';
  const testMessage = [{ role: 'user', content: 'Hi' }];
  
  const result: ModelTestResult = {
    model,
    maxTokens: null,
    supportsStreaming: false,
    responseTime: null,
    finishReason: null,
    error: null
  };

  try {
    // 测试基本功能
    const startTime = Date.now();
    const basicResponse = await axios.post(endpoint, {
      model,
      messages: testMessage,
      max_tokens: 50,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 15000
    });

    result.responseTime = Date.now() - startTime;
    result.finishReason = basicResponse.data.choices?.[0]?.finish_reason;
    
    logger.debug(`Model ${model} basic test passed`, {
      responseTime: result.responseTime,
      finishReason: result.finishReason
    });

    // 测试max_tokens限制 - 二分查找最大值
    let maxValidTokens = await findMaxTokens(apiKey, model, endpoint, testMessage);
    result.maxTokens = maxValidTokens;

    // 测试流式响应
    try {
      const streamResponse = await axios.post(endpoint, {
        model,
        messages: testMessage,
        max_tokens: 20,
        stream: true
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000,
        responseType: 'stream'
      });

      result.supportsStreaming = streamResponse.status === 200;
    } catch (error: any) {
      logger.warn(`Streaming test failed for ${model}`, { error: error.message });
    }

  } catch (error: any) {
    result.error = error.response?.data?.error?.message || error.message;
    logger.error(`Model test failed for ${model}`, { error: result.error });
  }

  return result;
}

/**
 * 使用二分查找找到最大token限制
 */
async function findMaxTokens(apiKey: string, model: string, endpoint: string, testMessage: any[]): Promise<number> {
  const testValues = [1000, 10000, 32768, 65536, 131072];
  let maxValid = 50;

  for (const tokens of testValues) {
    try {
      await axios.post(endpoint, {
        model,
        messages: testMessage,
        max_tokens: tokens,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000
      });
      
      maxValid = tokens;
      logger.debug(`max_tokens ${tokens} test passed for ${model}`);
    } catch (error) {
      logger.debug(`max_tokens ${tokens} test failed for ${model}`, {
        error: (error as any).response?.data?.error?.message || (error as any).message
      });
      break;
    }
  }

  return maxValid;
}

/**
 * 验证并更新配置
 */
export async function validateAndUpdateConfig(config: any): Promise<boolean> {
  logger.info('Starting configuration validation...');
  
  let configUpdated = false;
  
  // 查找ModelScope providers
  const modelScopeProviders = Object.entries(config.providers || {})
    .filter(([id, provider]: [string, any]) => 
      provider.endpoint?.includes('modelscope.cn')
    );

  if (modelScopeProviders.length === 0) {
    logger.info('No ModelScope providers found, skipping validation');
    return false;
  }

  for (const [providerId, provider] of modelScopeProviders) {
    logger.info(`Validating provider: ${providerId}`);
    
    const providerConfig = provider as ProviderConfig;
    const apiKeys = Array.isArray(providerConfig.authentication?.credentials?.apiKey) 
      ? providerConfig.authentication.credentials.apiKey 
      : [providerConfig.authentication?.credentials?.apiKey].filter(Boolean);

    if (apiKeys.length === 0) {
      logger.warn(`No API keys found for provider ${providerId}`);
      continue;
    }

    // 使用第一个API密钥进行测试
    const testApiKey = apiKeys[0];
    
    // 测试每个模型
    const models = providerConfig.models || [];
    for (const model of models) {
      logger.info(`Testing model: ${model}`);
      
      const testResult = await testModelScopeModel(testApiKey, model);
      
      if (testResult.error) {
        logger.error(`Model ${model} validation failed`, { error: testResult.error });
        continue;
      }

      // 更新maxTokens配置
      if (testResult.maxTokens && providerConfig.maxTokens) {
        const currentMaxTokens = providerConfig.maxTokens[model];
        if (currentMaxTokens && currentMaxTokens !== testResult.maxTokens) {
          logger.info(`Updating maxTokens for ${model}`, {
            from: currentMaxTokens,
            to: testResult.maxTokens
          });
          
          providerConfig.maxTokens[model] = testResult.maxTokens;
          configUpdated = true;
        }
      }

      logger.info(`Model ${model} validation completed`, {
        maxTokens: testResult.maxTokens,
        supportsStreaming: testResult.supportsStreaming,
        responseTime: testResult.responseTime,
        finishReason: testResult.finishReason
      });
    }
  }

  if (configUpdated) {
    logger.info('Configuration updated based on validation results');
  } else {
    logger.info('No configuration changes needed');
  }

  return configUpdated;
}

/**
 * 快速健康检查 - 只测试基本连接
 */
export async function quickHealthCheck(config: any): Promise<boolean> {
  logger.info('Performing quick health check...');
  
  const modelScopeProviders = Object.entries(config.providers || {})
    .filter(([id, provider]: [string, any]) => 
      provider.endpoint?.includes('modelscope.cn')
    );

  if (modelScopeProviders.length === 0) {
    return true; // 没有ModelScope provider，跳过检查
  }

  for (const [providerId, provider] of modelScopeProviders) {
    const providerConfig = provider as ProviderConfig;
    const apiKeys = Array.isArray(providerConfig.authentication?.credentials?.apiKey) 
      ? providerConfig.authentication.credentials.apiKey 
      : [providerConfig.authentication?.credentials?.apiKey].filter(Boolean);

    if (apiKeys.length === 0) continue;

    try {
      const response = await axios.post('https://api-inference.modelscope.cn/v1/chat/completions', {
        model: providerConfig.models?.[0] || 'ZhipuAI/GLM-4.5',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeys[0]}`
        },
        timeout: 10000
      });

      if (response.status === 200) {
        logger.info(`Health check passed for provider ${providerId}`);
        return true;
      }
    } catch (error) {
      logger.warn(`Health check failed for provider ${providerId}`, {
        error: (error as any).response?.data?.error?.message || (error as any).message
      });
    }
  }

  return false;
}