/**
 * Test command implementation for RCC CLI
 * Tests provider configurations and updates config files
 */

import axios from 'axios';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { GoogleGenAI } from '@google/genai';

interface ModelTestResult {
  model: string;
  available: boolean;
  maxTokens: number | null;
  supportsStreaming: boolean;
  responseTime: number | null;
  finishReason: string | null;
  error: string | null;
}

interface ProviderTestResult {
  providerId: string;
  providerType: string;
  endpoint: string;
  workingKeys: number;
  totalKeys: number;
  models: ModelTestResult[];
  error: string | null;
}

/**
 * 测试Gemini API keys
 */
async function testGeminiApiKeys(apiKeys: string[]): Promise<string[]> {
  const workingKeys: string[] = [];
  
  for (const key of apiKeys) {
    try {
      const genAI = new GoogleGenAI({ apiKey: key });
      
      // Simple health check with gemini-2.5-flash (most stable model)
      const testResponse = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: 'Hi' }]
        }]
      });

      const success = !!(testResponse && testResponse.candidates && testResponse.candidates.length > 0);
      
      if (success) {
        workingKeys.push(key);
      }
    } catch (error) {
      // Key不工作，跳过
    }
  }
  
  return workingKeys;
}

/**
 * 测试单个Gemini模型
 */
async function testGeminiModel(apiKey: string, model: string): Promise<ModelTestResult> {
  const result: ModelTestResult = {
    model,
    available: false,
    maxTokens: null,
    supportsStreaming: false,
    responseTime: null,
    finishReason: null,
    error: null
  };

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const startTime = Date.now();
    
    const testResponse = await genAI.models.generateContent({
      model: model,
      contents: [{
        role: 'user',
        parts: [{ text: 'Hi' }]
      }]
    });

    result.available = true;
    result.responseTime = Date.now() - startTime;
    result.finishReason = testResponse.candidates?.[0]?.finishReason || null;
    result.supportsStreaming = true; // Gemini supports streaming
    
    // Set maxTokens based on known model limits
    const geminiTokenLimits: { [key: string]: number } = {
      'gemini-2.5-pro': 2097152,
      'gemini-2.5-flash': 1048576,
      'gemini-2.5-flash-lite': 1048576,
      'gemini-2.0-flash': 1048576,
      'gemini-2.0-flash-exp': 1048576,
      'gemini-1.5-pro': 2097152,
      'gemini-1.5-flash': 1048576,
      'gemini-1.5-flash-8b': 1048576
    };
    
    result.maxTokens = geminiTokenLimits[model] || 131072; // Default fallback

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

/**
 * 获取ModelScope支持的所有模型
 */
async function getModelScopeModels(apiKey: string): Promise<string[]> {
  try {
    const response = await axios.get('https://api-inference.modelscope.cn/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    if (response.data && response.data.data) {
      return response.data.data.map((model: any) => model.id);
    }
    
    return [];
  } catch (error: any) {
    console.log(chalk.yellow(`⚠️  Failed to fetch ModelScope models: ${error.response?.data?.error?.message || error.message}`));
    return [];
  }
}

/**
 * 测试单个模型
 */
async function testModel(apiKey: string, endpoint: string, model: string, providerType: string = 'openai'): Promise<ModelTestResult> {
  // 对于Gemini provider，使用专门的测试逻辑
  if (providerType === 'gemini') {
    return await testGeminiModel(apiKey, model);
  }
  const result: ModelTestResult = {
    model,
    available: false,
    maxTokens: null,
    supportsStreaming: false,
    responseTime: null,
    finishReason: null,
    error: null
  };

  try {
    // 基本可用性测试
    const startTime = Date.now();
    const basicResponse = await axios.post(endpoint, {
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    });

    result.available = true;
    result.responseTime = Date.now() - startTime;
    result.finishReason = basicResponse.data.choices?.[0]?.finish_reason;

    // 测试max_tokens限制 - 扩展到长上下文模型支持
    const tokenLimits = [1000, 10000, 32768, 65536, 131072, 262144, 524288, 1048576, 2097152];
    let maxValidTokens = 10;

    for (const tokens of tokenLimits) {
      try {
        await axios.post(endpoint, {
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: tokens,
          stream: false
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 15000
        });
        
        maxValidTokens = tokens;
      } catch (error) {
        break;
      }
    }

    result.maxTokens = maxValidTokens;

    // 基于模型名称识别已知的长上下文模型并设置合理的maxTokens
    const longContextModels: { [key: string]: number } = {
      'Qwen/Qwen2.5-14B-Instruct-1M': 1048576,
      'Qwen/Qwen2.5-7B-Instruct-1M': 1048576,
      'Qwen/Qwen2.5-72B-Instruct': 131072,
      'Qwen/Qwen3-235B-A22B': 131072,
      'Qwen/Qwen3-235B-A22B-Instruct-2507': 131072,
      'Qwen/Qwen3-Coder-480B-A35B-Instruct': 65536,
      'Qwen/QVQ-72B-Preview': 131072
    };

    if (longContextModels[model]) {
      result.maxTokens = Math.max(result.maxTokens, longContextModels[model]);
    }

    // 测试流式支持
    try {
      const streamResponse = await axios.post(endpoint, {
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
        stream: true
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 15000,
        responseType: 'stream'
      });

      result.supportsStreaming = streamResponse.status === 200;
    } catch (error) {
      // 流式测试失败不影响整体结果
    }

  } catch (error: any) {
    result.error = error.response?.data?.error?.message || error.message;
  }

  return result;
}

/**
 * 测试API密钥
 */
async function testApiKeys(apiKeys: string[], endpoint: string, modelName: string, providerType: string = 'openai'): Promise<string[]> {
  // 对于Gemini provider，使用专门的测试逻辑
  if (providerType === 'gemini') {
    return await testGeminiApiKeys(apiKeys);
  }

  // 对于OpenAI兼容的providers，使用原有逻辑
  const workingKeys: string[] = [];
  
  for (const key of apiKeys) {
    try {
      const response = await axios.post(endpoint, {
        model: modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        timeout: 10000
      });

      if (response.status === 200) {
        workingKeys.push(key);
      }
    } catch (error) {
      // Key不工作，跳过
    }
  }

  return workingKeys;
}

/**
 * 测试单个provider
 */
async function testProvider(providerId: string, providerConfig: any, configPath?: string, specificModel?: string): Promise<ProviderTestResult> {
  console.log(chalk.blue(`\n🔧 Testing provider: ${providerId}`));
  
  const result: ProviderTestResult = {
    providerId,
    providerType: providerConfig.type,
    endpoint: providerConfig.endpoint,
    workingKeys: 0,
    totalKeys: 0,
    models: [],
    error: null
  };

  try {
    // 提取API密钥
    const apiKeys = Array.isArray(providerConfig.authentication?.credentials?.apiKey) 
      ? providerConfig.authentication.credentials.apiKey 
      : [providerConfig.authentication?.credentials?.apiKey].filter(Boolean);

    result.totalKeys = apiKeys.length;

    if (apiKeys.length === 0) {
      result.error = 'No API keys found';
      return result;
    }

    // 测试API密钥
    const modelToTest = specificModel || providerConfig.models?.[0] || 'ZhipuAI/GLM-4.5';
    const workingKeys = await testApiKeys(apiKeys, providerConfig.endpoint, modelToTest, providerConfig.type);
    result.workingKeys = workingKeys.length;

    if (workingKeys.length === 0) {
      result.error = 'No working API keys found';
      return result;
    }

    console.log(chalk.green(`  ✅ ${workingKeys.length}/${apiKeys.length} API keys working`));

    // 确定要测试的模型列表
    let modelsToTest: string[] = [];
    
    if (specificModel) {
      modelsToTest = [specificModel];
    } else {
      // 获取配置中的模型
      modelsToTest = providerConfig.models || [];
      
      // 只测试配置文件中指定的模型，不获取所有可用模型
      if (providerConfig.endpoint?.includes('modelscope.cn') && modelsToTest.length > 0) {
        console.log(chalk.gray(`  📋 Testing ${modelsToTest.length} configured models from ModelScope...`));
      }
    }

    // 测试每个模型
    console.log(chalk.gray(`  🧪 Testing ${modelsToTest.length} models...`));
    
    for (const model of modelsToTest) {
      console.log(chalk.gray(`    Testing ${model}...`));
      const modelResult = await testModel(workingKeys[0], providerConfig.endpoint, model, providerConfig.type);
      result.models.push(modelResult);
      
      if (modelResult.available) {
        console.log(chalk.green(`      ✅ Available (${modelResult.responseTime}ms, max_tokens: ${modelResult.maxTokens})`));
      } else {
        console.log(chalk.red(`      ❌ Failed: ${modelResult.error}`));
      }

      // 实时更新配置文件
      if (configPath) {
        updateSingleModelConfig(configPath, providerId, modelResult);
      }
    }

  } catch (error: any) {
    result.error = error.message;
    console.log(chalk.red(`  ❌ Provider test failed: ${error.message}`));
  }

  return result;
}

/**
 * 实时更新单个模型的配置
 */
function updateSingleModelConfig(configPath: string, providerId: string, modelResult: ModelTestResult): boolean {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const providerConfig = config.providers?.[providerId];
    if (!providerConfig) return false;

    let updated = false;

    // 更新maxTokens信息
    if (modelResult.available && modelResult.maxTokens) {
      if (!providerConfig.maxTokens) {
        providerConfig.maxTokens = {};
      }
      const currentMaxTokens = providerConfig.maxTokens[modelResult.model];
      if (currentMaxTokens !== modelResult.maxTokens) {
        providerConfig.maxTokens[modelResult.model] = modelResult.maxTokens;
        updated = true;
      }
    }

    // 如果模型不可用且在配置中，考虑是否移除（保持原有模型配置）
    // 这里我们保持配置不变，只更新已有模型的信息

    if (updated) {
      // 创建临时备份
      const backupPath = configPath + '.tmp.' + Date.now();
      writeFileSync(backupPath, readFileSync(configPath));
      
      // 写入更新的配置
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green(`      📝 Updated ${modelResult.model} config`));
      
      // 删除临时备份
      require('fs').unlinkSync(backupPath);
    }

    return updated;
  } catch (error: any) {
    console.log(chalk.red(`    ❌ Failed to update config: ${error.message}`));
    return false;
  }
}

/**
 * 更新配置文件 (批量更新，保留作为备用)
 */
function updateConfigFile(configPath: string, testResults: ProviderTestResult[]): boolean {
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    let updated = false;

    for (const providerResult of testResults) {
      const providerConfig = config.providers?.[providerResult.providerId];
      if (!providerConfig) continue;

      // 更新models列表（只包含可用的模型）
      const availableModels = providerResult.models
        .filter(m => m.available)
        .map(m => m.model);

      if (availableModels.length > 0) {
        const currentModels = providerConfig.models || [];
        const newModels = [...new Set([...currentModels, ...availableModels])];
        
        if (JSON.stringify(currentModels.sort()) !== JSON.stringify(newModels.sort())) {
          providerConfig.models = newModels;
          updated = true;
          console.log(chalk.blue(`    📝 Updated models list for ${providerResult.providerId}`));
        }
      }

      // 更新maxTokens配置
      if (!providerConfig.maxTokens) {
        providerConfig.maxTokens = {};
      }

      for (const modelResult of providerResult.models) {
        if (modelResult.available && modelResult.maxTokens) {
          const currentMaxTokens = providerConfig.maxTokens[modelResult.model];
          if (!currentMaxTokens || currentMaxTokens !== modelResult.maxTokens) {
            providerConfig.maxTokens[modelResult.model] = modelResult.maxTokens;
            updated = true;
            console.log(chalk.blue(`    📝 Updated maxTokens for ${modelResult.model}: ${modelResult.maxTokens}`));
          }
        }
      }
    }

    if (updated) {
      // 创建备份
      const backupPath = configPath + '.backup.' + Date.now();
      writeFileSync(backupPath, readFileSync(configPath));
      console.log(chalk.gray(`    💾 Backup created: ${backupPath}`));

      // 写入更新的配置
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(chalk.green(`    ✅ Configuration updated: ${configPath}`));
    }

    return updated;
  } catch (error: any) {
    console.log(chalk.red(`    ❌ Failed to update config: ${error.message}`));
    return false;
  }
}

/**
 * 执行测试命令
 */
export async function executeTestCommand(provider?: string, model?: string, options: any = {}): Promise<void> {
  console.log(chalk.cyan('🧪 RCC Provider Testing Tool'));
  console.log('============================\n');

  // 确定配置文件路径
  const configPaths: string[] = [];
  
  if (options.config) {
    configPaths.push(resolve(options.config));
  } else {
    // 默认配置文件
    const baseConfigDir = join(homedir(), '.route-claude-code');
    const defaultConfigs = [
      join(baseConfigDir, 'config.json'),
      join(baseConfigDir, 'config.release.json')
    ];
    
    for (const configPath of defaultConfigs) {
      if (existsSync(configPath)) {
        configPaths.push(configPath);
      }
    }
  }

  if (configPaths.length === 0) {
    console.error(chalk.red('❌ No configuration files found'));
    console.error(chalk.gray('   Please specify --config or ensure config.json/config.release.json exist'));
    process.exit(1);
  }

  console.log(chalk.blue(`📁 Testing configurations:`));
  configPaths.forEach(path => console.log(chalk.gray(`   ${path}`)));
  console.log('');

  // 处理每个配置文件
  for (const configPath of configPaths) {
    console.log(chalk.cyan(`\n📄 Processing: ${configPath}`));
    console.log('='.repeat(50));

    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      const testResults: ProviderTestResult[] = [];

      // 确定要测试的providers
      const providersToTest = provider 
        ? [provider]
        : Object.keys(config.providers || {});

      if (providersToTest.length === 0) {
        console.log(chalk.yellow('⚠️  No providers found to test'));
        continue;
      }

      // 测试每个provider
      for (const providerId of providersToTest) {
        const providerConfig = config.providers?.[providerId];
        if (!providerConfig) {
          console.log(chalk.red(`❌ Provider '${providerId}' not found in configuration`));
          continue;
        }

        const result = await testProvider(providerId, providerConfig, configPath, model);
        testResults.push(result);
      }

      // 更新配置文件
      console.log(chalk.blue('\n📝 Updating configuration...'));
      const updated = updateConfigFile(configPath, testResults);

      // 输出测试总结
      console.log(chalk.cyan('\n📊 Test Summary:'));
      console.log('================');
      
      for (const result of testResults) {
        console.log(chalk.blue(`\n🔧 ${result.providerId} (${result.providerType}):`));
        console.log(`   Endpoint: ${result.endpoint}`);
        console.log(`   API Keys: ${result.workingKeys}/${result.totalKeys} working`);
        console.log(`   Models tested: ${result.models.length}`);
        
        const availableModels = result.models.filter(m => m.available);
        console.log(`   Available models: ${availableModels.length}`);
        
        if (availableModels.length > 0) {
          console.log(chalk.green('   ✅ Available models:'));
          availableModels.forEach(m => {
            console.log(chalk.gray(`      • ${m.model} (max_tokens: ${m.maxTokens}, streaming: ${m.supportsStreaming ? 'yes' : 'no'})`));
          });
        }
        
        const failedModels = result.models.filter(m => !m.available);
        if (failedModels.length > 0) {
          console.log(chalk.red('   ❌ Failed models:'));
          failedModels.forEach(m => {
            console.log(chalk.gray(`      • ${m.model}: ${m.error}`));
          });
        }
      }

      if (updated) {
        console.log(chalk.green(`\n✅ Configuration file updated successfully`));
      } else {
        console.log(chalk.gray(`\nℹ️  No configuration changes needed`));
      }

    } catch (error: any) {
      console.error(chalk.red(`❌ Failed to process ${configPath}:`), error.message);
    }
  }

  console.log(chalk.cyan('\n🎉 Testing completed!'));
}