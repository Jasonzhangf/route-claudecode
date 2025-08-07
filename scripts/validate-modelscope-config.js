#!/usr/bin/env node

/**
 * ModelScope配置验证和自动更新脚本
 * 在启动时测试API限制并更新配置文件
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, '../config/config-openai-sdk-modelscope-5507.json');

// ModelScope API配置
const MODELSCOPE_ENDPOINT = 'https://api-inference.modelscope.cn/v1/chat/completions';
const TEST_MESSAGE = [{ role: 'user', content: 'Hi' }];

/**
 * 测试单个模型的参数限制
 */
async function testModelLimits(apiKey, model) {
  console.log(`\n🔍 Testing limits for model: ${model}`);
  
  const results = {
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
    const basicResponse = await axios.post(MODELSCOPE_ENDPOINT, {
      model,
      messages: TEST_MESSAGE,
      max_tokens: 50,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    });

    results.responseTime = Date.now() - startTime;
    results.finishReason = basicResponse.data.choices?.[0]?.finish_reason;
    
    console.log(`  ✅ Basic test passed (${results.responseTime}ms)`);
    console.log(`  📝 Finish reason: ${results.finishReason}`);

    // 测试max_tokens限制
    const maxTokensTests = [1000, 10000, 32768, 65536, 131072];
    let maxValidTokens = 50;

    for (const tokens of maxTokensTests) {
      try {
        await axios.post(MODELSCOPE_ENDPOINT, {
          model,
          messages: TEST_MESSAGE,
          max_tokens: tokens,
          stream: false
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 10000
        });
        
        maxValidTokens = tokens;
        console.log(`  ✅ max_tokens ${tokens} - OK`);
      } catch (error) {
        console.log(`  ❌ max_tokens ${tokens} - Failed: ${error.response?.data?.error?.message || error.message}`);
        break;
      }
    }

    results.maxTokens = maxValidTokens;

    // 测试流式响应
    try {
      const streamResponse = await axios.post(MODELSCOPE_ENDPOINT, {
        model,
        messages: TEST_MESSAGE,
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

      results.supportsStreaming = streamResponse.status === 200;
      console.log(`  ✅ Streaming support: ${results.supportsStreaming}`);
    } catch (error) {
      console.log(`  ❌ Streaming test failed: ${error.response?.data?.error?.message || error.message}`);
    }

  } catch (error) {
    results.error = error.response?.data?.error?.message || error.message;
    console.log(`  ❌ Model test failed: ${results.error}`);
  }

  return results;
}

/**
 * 测试所有API密钥
 */
async function testApiKeys(apiKeys, model) {
  console.log(`\n🔑 Testing ${apiKeys.length} API keys...`);
  
  const workingKeys = [];
  
  for (let i = 0; i < apiKeys.length; i++) {
    const key = apiKeys[i];
    const keyId = key.substring(0, 10) + '...';
    
    try {
      const response = await axios.post(MODELSCOPE_ENDPOINT, {
        model,
        messages: TEST_MESSAGE,
        max_tokens: 10,
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
        console.log(`  ✅ Key ${i + 1} (${keyId}) - Working`);
      }
    } catch (error) {
      console.log(`  ❌ Key ${i + 1} (${keyId}) - Failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  return workingKeys;
}

/**
 * 更新配置文件
 */
function updateConfig(config, testResults) {
  console.log('\n📝 Updating configuration...');
  
  let updated = false;

  // 更新maxTokens
  for (const result of testResults) {
    if (result.maxTokens && config.providers) {
      for (const [providerId, provider] of Object.entries(config.providers)) {
        if (provider.maxTokens && provider.maxTokens[result.model]) {
          const currentMax = provider.maxTokens[result.model];
          if (currentMax !== result.maxTokens) {
            console.log(`  🔧 Updating ${result.model} maxTokens: ${currentMax} → ${result.maxTokens}`);
            provider.maxTokens[result.model] = result.maxTokens;
            updated = true;
          }
        }
      }
    }
  }

  // 移除不工作的API密钥（可选，这里只记录）
  const workingKeyCount = testResults.find(r => r.workingKeys)?.workingKeys?.length || 0;
  if (workingKeyCount > 0) {
    console.log(`  ℹ️  Found ${workingKeyCount} working API keys`);
  }

  return updated;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 ModelScope Configuration Validator');
  console.log('=====================================');

  // 读取配置文件
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ Configuration file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  console.log(`📁 Loaded config: ${CONFIG_PATH}`);

  // 提取ModelScope provider配置
  const modelScopeProviders = Object.entries(config.providers || {})
    .filter(([id, provider]) => provider.endpoint?.includes('modelscope.cn'));

  if (modelScopeProviders.length === 0) {
    console.log('ℹ️  No ModelScope providers found in configuration');
    return;
  }

  const testResults = [];

  // 测试每个ModelScope provider
  for (const [providerId, provider] of modelScopeProviders) {
    console.log(`\n🔧 Testing provider: ${providerId}`);
    
    const apiKeys = Array.isArray(provider.authentication?.credentials?.apiKey) 
      ? provider.authentication.credentials.apiKey 
      : [provider.authentication?.credentials?.apiKey].filter(Boolean);

    if (apiKeys.length === 0) {
      console.log('  ❌ No API keys found');
      continue;
    }

    // 测试API密钥
    const workingKeys = await testApiKeys(apiKeys, provider.models?.[0] || 'ZhipuAI/GLM-4.5');
    
    if (workingKeys.length === 0) {
      console.log('  ❌ No working API keys found');
      continue;
    }

    // 测试每个模型
    const models = provider.models || [];
    for (const model of models) {
      const result = await testModelLimits(workingKeys[0], model);
      result.workingKeys = workingKeys;
      testResults.push(result);
    }
  }

  // 更新配置文件
  const configUpdated = updateConfig(config, testResults);

  if (configUpdated) {
    // 备份原配置
    const backupPath = CONFIG_PATH + '.backup.' + Date.now();
    fs.writeFileSync(backupPath, fs.readFileSync(CONFIG_PATH));
    console.log(`  💾 Backup created: ${backupPath}`);

    // 写入更新的配置
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`  ✅ Configuration updated: ${CONFIG_PATH}`);
  } else {
    console.log('  ℹ️  No configuration changes needed');
  }

  // 输出测试总结
  console.log('\n📊 Test Summary:');
  console.log('================');
  
  for (const result of testResults) {
    console.log(`\n🤖 ${result.model}:`);
    console.log(`  Max Tokens: ${result.maxTokens || 'Unknown'}`);
    console.log(`  Streaming: ${result.supportsStreaming ? 'Yes' : 'No'}`);
    console.log(`  Response Time: ${result.responseTime || 'N/A'}ms`);
    console.log(`  Finish Reason: ${result.finishReason || 'N/A'}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  console.log('\n✅ Validation complete!');
}

// 运行脚本
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testModelLimits, testApiKeys, updateConfig };