#!/usr/bin/env node

/**
 * RCC ModelScope Provider Model Updater
 * 
 * 通过ModelScope API检查可用模型并更新配置
 * 支持获取真实的max_tokens限制，修正配置文件中的错误值
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { JQJsonHandler } = require('../src/utils/jq-json-handler');

const MODELSCOPE_CONFIG_PATH = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/modelscope-v4-5508.json';

const MODELSCOPE_API = {
  endpoint: 'https://api-inference.modelscope.cn',
  listModelsPath: 'v1/models',
  chatCompletionsPath: 'v1/chat/completions',
  apiKeys: [
    'ms-cc2f461b-8228-427f-99aa-1d44fab73e67',
    'ms-7d6c4fdb-4bf1-40b3-9ec6-ddea16f6702b', 
    'ms-7af85c83-5871-43bb-9e2f-fc099ef08baf',
    'ms-9215edc2-dc63-4a33-9f53-e6a6080ec795'
  ]
};

function makeModelScopeAPIRequest(path, apiKey, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = `${MODELSCOPE_API.endpoint}/${path}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JQJsonHandler.parseJsonString(data);
          resolve({ 
            status: res.statusCode, 
            data: response,
            headers: res.headers
          });
        } catch (error) {
          resolve({ 
            status: res.statusCode, 
            data: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JQJsonHandler.stringifyJson(data));
    }
    
    req.end();
  });
}

async function fetchModelScopeModels() {
  for (let i = 0; i < MODELSCOPE_API.apiKeys.length; i++) {
    const apiKey = MODELSCOPE_API.apiKeys[i];
    
    try {
      const response = await makeModelScopeAPIRequest(MODELSCOPE_API.listModelsPath, apiKey);
      
      if (response.status === 200 && response.data.data) {
        const models = response.data.data
          .filter(model => {
            return model.id && (
              model.id.includes('Qwen') || 
              model.id.includes('qwen') ||
              model.id.includes('ChatGLM') ||
              model.id.includes('Baichuan')
            );
          })
          .map(model => ({
            id: model.id,
            object: model.object,
            created: model.created,
            owned_by: model.owned_by
          }));
        
        return models;
        
      } else if (response.status === 429) {
        continue;
      } else {
        continue;
      }
    } catch (error) {
      continue;
    }
  }
  
  throw new Error('所有API Key都无法获取模型列表');
}

async function testModelMaxTokens(modelId, apiKey) {
  const testValues = [524288, 262144, 131072, 65536, 32000, 16384, 8192, 4096, 2048, 1024];
  
  for (const maxTokens of testValues) {
    try {
      const testData = {
        model: modelId,
        messages: [
          {
            role: "user",
            content: "测试消息，用于验证max_tokens限制"
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.1
      };
      
      const response = await makeModelScopeAPIRequest(
        MODELSCOPE_API.chatCompletionsPath, 
        apiKey, 
        'POST', 
        testData
      );
      
      if (response.status === 200) {
        return maxTokens;
      } else if (response.status === 400 && response.data.error && 
                 response.data.error.message && 
                 response.data.error.message.includes('max_tokens')) {
        continue;
      } else {
        continue;
      }
    } catch (error) {
      continue;
    }
  }
  
  return 1024;
}

async function testAllModelsMaxTokens() {
  const targetModels = [
    'Qwen/Qwen3-Coder-480B-A35B-Instruct'
  ];
  
  const modelLimits = {};
  
  for (const modelId of targetModels) {
    let maxTokens = null;
    for (const apiKey of MODELSCOPE_API.apiKeys) {
      try {
        maxTokens = await testModelMaxTokens(modelId, apiKey);
        if (maxTokens) {
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (maxTokens) {
      modelLimits[modelId] = maxTokens;
    } else {
      modelLimits[modelId] = 8192;
    }
  }
  
  return modelLimits;
}

function updateModelScopeConfig(modelLimits) {
  const existingConfig = JQJsonHandler.parseJsonString(fs.readFileSync(MODELSCOPE_CONFIG_PATH, 'utf8'));
  
  if (!existingConfig.serverCompatibilityProviders) {
    existingConfig.serverCompatibilityProviders = {};
  }
  
  if (!existingConfig.serverCompatibilityProviders['modelscope-primary']) {
    existingConfig.serverCompatibilityProviders['modelscope-primary'] = {};
  }
  
  if (!existingConfig.serverCompatibilityProviders['modelscope-primary'].models) {
    existingConfig.serverCompatibilityProviders['modelscope-primary'].models = {};
  }
  
  existingConfig.serverCompatibilityProviders['modelscope-primary'].models.maxTokens = modelLimits;
  
  if (existingConfig.modules && existingConfig.modules.transformers) {
    for (const transformer of existingConfig.modules.transformers) {
      if (transformer.id === 'anthropic-to-openai-transformer') {
        const apiMaxTokens = Math.min(...Object.values(modelLimits));
        transformer.config.apiMaxTokens = apiMaxTokens;
        transformer.config.modelMaxTokens = modelLimits;
        break;
      }
    }
  }
  
  existingConfig.lastUpdated = new Date().toISOString();
  existingConfig.updateStats = {
    modelsTested: Object.keys(modelLimits).length,
    maxTokensUpdated: true,
    updateMethod: 'provider-updater',
    lastUpdate: new Date().toISOString()
  };
  
  const backupPath = MODELSCOPE_CONFIG_PATH + '.backup-' + Date.now();
  fs.writeFileSync(backupPath, fs.readFileSync(MODELSCOPE_CONFIG_PATH));
  
  fs.writeFileSync(MODELSCOPE_CONFIG_PATH, JQJsonHandler.stringifyJson(existingConfig, true));
  
  return existingConfig;
}

async function main() {
  try {
    try {
      await fetchModelScopeModels();
    } catch (error) {
      // 继续进行max_tokens测试
    }
    
    const modelLimits = await testAllModelsMaxTokens();
    
    if (Object.keys(modelLimits).length === 0) {
      throw new Error('无法获取任何模型的max_tokens限制');
    }
    
    const updatedConfig = updateModelScopeConfig(modelLimits);
    
    return {
      success: true,
      modelLimits: modelLimits,
      apiLimit: Math.min(...Object.values(modelLimits))
    };
    
  } catch (error) {
    throw error;
  }
}

if (require.main === module) {
  main()
    .then(result => {
      if (result.success) {
        process.exit(0);
      }
    })
    .catch(error => {
      process.exit(1);
    });
}

module.exports = { main };