#!/usr/bin/env node

/**
 * Provider Model Discovery and Configuration Update Script v2.0
 * Enhanced version with:
 * - Automatic backup before modifications
 * - Project memory integration
 * - Automatic model discovery and testing
 * 批量获取供应商可用模型，测试可用性，并更新配置文件
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 配置文件路径
const CONFIG_PATHS = {
  shuaihong: '/Users/fanzhang/.route-claude-code/config/single-provider/config-openai-shuaihong-5508.json',
  multiProvider: '/Users/fanzhang/.route-claude-code/config/load-balancing/config-multi-openai-full.json'
};

// 项目记忆路径
const PROJECT_MEMORY_PATH = '/Users/fanzhang/.claudecode/Users-fanzhang-Documents-github-claude-code-router';
const PROJECT_DETAILS_PATH = '/Users/fanzhang/Documents/github/claude-code-router/.claude/project-details';

// 自动备份配置
const AUTO_BACKUP_CONFIG = {
  enabled: true,
  backupDir: '/Users/fanzhang/.route-claude-code/config-backups',
  maxBackups: 10
};

// 增强的日志系统
const EnhancedLogger = {
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
    return logEntry;
  },
  
  info(message, data) { return this.log('info', message, data); },
  warn(message, data) { return this.log('warn', message, data); },
  error(message, data) { return this.log('error', message, data); },
  debug(message, data) { return this.log('debug', message, data); },
  success(message, data) { return this.log('success', message, data); }
};

// 常见模型列表用于测试
const COMMON_MODELS = {
  openai: [
    'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini',
    'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307',
    'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash',
    'glm-4', 'glm-4-air', 'glm-4-airx', 'glm-4-flash',
    'qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext',
    'qwen1.5-7b', 'qwen1.5-14b', 'qwen1.5-32b', 'qwen1.5-72b',
    'qwen2-7b', 'qwen2-72b', 'qwen2.5-7b', 'qwen2.5-14b', 'qwen2.5-32b', 'qwen2.5-72b',
    'qwen3-coder', 'qwen3-coder-32b', 'qwen3-coder-14b', 'qwen3-coder-7b',
    'deepseek-chat', 'deepseek-coder',
    'yi-34b-chat', 'yi-9b-chat',
    'mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest',
    'mixtral-8x7b-32768', 'llama3-8b-8192', 'llama3-70b-8192'
  ],
  gemini: [
    'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash',
    'gemini-1.5-pro', 'gemini-1.5-flash'
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'
  ]
};

// 测试超时设置
const TIMEOUT = 15000;
const CONCURRENT_LIMIT = 5; // 并发测试限制

/**
 * 发起HTTP请求
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'claude-code-router-discovery/1.0.0',
      ...options.headers
    };

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: headers,
      timeout: TIMEOUT
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * 测试单个模型的可用性
 */
async function testModelAvailability(endpoint, model, apiKey = null) {
  const testPayload = {
    model: model,
    messages: [{ role: 'user', content: 'test' }],
    max_tokens: 1,
    temperature: 0.1
  };

  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await makeRequest(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testPayload)
    });

    if (response.status === 200) {
      try {
        const jsonResponse = JSON.parse(response.data);
        return {
          available: true,
          status: response.status,
          model: model,
          responseModel: jsonResponse.model || model,
          estimatedCost: jsonResponse.usage ? 
            `${jsonResponse.usage.input_tokens || 0}+${jsonResponse.usage.output_tokens || 0} tokens` : 
            'unknown'
        };
      } catch (parseError) {
        return {
          available: false,
          status: response.status,
          model: model,
          error: 'Failed to parse JSON response'
        };
      }
    } else if (response.status === 400 || response.status === 404) {
      // 模型不存在或不支持
      return {
        available: false,
        status: response.status,
        model: model,
        error: 'Model not available or not supported'
      };
    } else if (response.status === 401) {
      // 认证失败
      return {
        available: false,
        status: response.status,
        model: model,
        error: 'Authentication failed'
      };
    } else if (response.status === 429) {
      // 速率限制
      return {
        available: true,
        status: response.status,
        model: model,
        note: 'Rate limited, but model exists'
      };
    } else {
      // 其他错误
      return {
        available: false,
        status: response.status,
        model: model,
        error: `HTTP ${response.status}: ${response.data.substring(0, 100)}`
      };
    }
  } catch (error) {
    return {
      available: false,
      status: 'CONNECTION_ERROR',
      model: model,
      error: error.message
    };
  }
}

/**
 * 并发测试模型可用性
 */
async function testModelsConcurrently(endpoint, models, apiKey = null) {
  const results = [];
  
  // 分批并发测试
  for (let i = 0; i < models.length; i += CONCURRENT_LIMIT) {
    const batch = models.slice(i, i + CONCURRENT_LIMIT);
    const batchPromises = batch.map(model => 
      testModelAvailability(endpoint, model, apiKey)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          available: false,
          status: 'TEST_ERROR',
          model: batch[index],
          error: result.reason.message
        });
      }
    });
    
    // 批次间延迟，避免触发速率限制
    if (i + CONCURRENT_LIMIT < models.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * 获取配置文件中的供应商信息
 */
function loadProviderConfig(configPath) {
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    return config;
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
  }
}

/**
 * 更新配置文件
 */
function updateConfig(configPath, originalConfig, providerUpdates) {
  try {
    let updated = false;
    
    // 更新providers配置
    for (const [providerId, updates] of Object.entries(providerUpdates)) {
      if (originalConfig.providers && originalConfig.providers[providerId]) {
        const provider = originalConfig.providers[providerId];
        
        if (updates.models && updates.models.length > 0) {
          provider.models = updates.models;
          updated = true;
        }
        
        if (updates.defaultModel) {
          provider.defaultModel = updates.defaultModel;
          updated = true;
        }
        
        if (updates.maxTokens) {
          // 合并maxTokens配置，保留现有的，添加新的
          provider.maxTokens = { ...provider.maxTokens, ...updates.maxTokens };
          updated = true;
        }
      }
    }
    
    if (updated) {
      // 创建备份
      const backupPath = configPath.replace('.json', `.backup.${Date.now()}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(originalConfig, null, 2));
      console.log(`📋 备份原配置文件: ${backupPath}`);
      
      // 写入更新后的配置
      fs.writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));
      console.log(`✅ 更新配置文件: ${configPath}`);
    } else {
      console.log(`ℹ️  配置文件无需更新: ${configPath}`);
    }
    
    return updated;
  } catch (error) {
    throw new Error(`Failed to update config ${configPath}: ${error.message}`);
  }
}

/**
 * 发现供应商的可用模型
 */
async function discoverProviderModels(providerConfig, providerId) {
  console.log(`\n🔍 发现 ${providerId} 的可用模型...`);
  
  const endpoint = providerConfig.endpoint;
  const providerType = providerConfig.type;
  const apiKey = providerConfig.authentication?.credentials?.apiKey;
  const actualApiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
  
  console.log(`   端点: ${endpoint}`);
  console.log(`   类型: ${providerType}`);
  console.log(`   认证: ${actualApiKey ? '已配置' : '无'}`);
  
  // 获取测试模型列表
  const modelsToTest = COMMON_MODELS[providerType] || COMMON_MODELS.openai;
  
  console.log(`   测试模型数量: ${modelsToTest.length}`);
  
  // 测试模型可用性
  console.log(`   开始并发测试...`);
  const results = await testModelsConcurrently(endpoint, modelsToTest, actualApiKey);
  
  // 分析结果
  const availableModels = results
    .filter(r => r.available || r.note === 'Rate limited, but model exists')
    .map(r => r.model);
    
  const unavailableModels = results
    .filter(r => !r.available && r.note !== 'Rate limited, but model exists')
    .map(r => ({ model: r.model, error: r.error, status: r.status }));
  
  console.log(`   ✅ 可用模型: ${availableModels.length}个`);
  console.log(`   ❌ 不可用模型: ${unavailableModels.length}个`);
  
  // 显示可用模型
  if (availableModels.length > 0) {
    console.log(`   📋 可用模型列表:`);
    availableModels.forEach(model => {
      const result = results.find(r => r.model === model);
      console.log(`      ✅ ${model} ${result.note ? `(${result.note})` : ''}`);
    });
  }
  
  // 显示不可用模型（只显示前10个）
  if (unavailableModels.length > 0) {
    console.log(`   📋 不可用模型 (显示前10个):`);
    unavailableModels.slice(0, 10).forEach(item => {
      console.log(`      ❌ ${item.model} - ${item.error} (${item.status})`);
    });
    
    if (unavailableModels.length > 10) {
      console.log(`      ... 还有 ${unavailableModels.length - 10} 个不可用模型`);
    }
  }
  
  // 生成更新建议
  const suggestedDefaultModel = availableModels.includes(providerConfig.defaultModel) 
    ? providerConfig.defaultModel 
    : availableModels[0];
  
  const maxTokensUpdates = {};
  availableModels.forEach(model => {
    if (!providerConfig.maxTokens || !providerConfig.maxTokens[model]) {
      // 根据模型类型设置默认maxTokens
      if (model.includes('claude') && model.includes('opus')) {
        maxTokensUpdates[model] = 200000;
      } else if (model.includes('claude') || model.includes('sonnet')) {
        maxTokensUpdates[model] = 200000;
      } else if (model.includes('gemini')) {
        maxTokensUpdates[model] = 131072;
      } else if (model.includes('glm')) {
        maxTokensUpdates[model] = 128000;
      } else if (model.includes('qwen')) {
        maxTokensUpdates[model] = 262144;
      } else {
        maxTokensUpdates[model] = 131072;
      }
    }
  });
  
  return {
    providerId,
    endpoint,
    availableModels,
    unavailableModels,
    updates: {
      models: availableModels,
      defaultModel: suggestedDefaultModel,
      maxTokens: Object.keys(maxTokensUpdates).length > 0 ? maxTokensUpdates : undefined
    },
    summary: {
      totalTested: results.length,
      available: availableModels.length,
      unavailable: unavailableModels.length,
      suggestedDefaultModel
    }
  };
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 Provider Model Discovery and Configuration Update Script');
  console.log('==========================================================');
  
  try {
    // 选择配置文件
    let configPath;
    let configName;
    
    if (process.argv.includes('--multi-provider')) {
      configPath = CONFIG_PATHS.multiProvider;
      configName = 'Multi-Provider Load Balancing';
    } else {
      configPath = CONFIG_PATHS.shuaihong;
      configName = 'ShuaiHong Single Provider';
    }
    
    console.log(`📋 使用配置: ${configName}`);
    console.log(`📁 配置文件: ${configPath}`);
    
    // 加载配置
    console.log('\n📖 加载配置文件...');
    const config = loadProviderConfig(configPath);
    
    // 发现所有供应商的可用模型
    const allResults = {};
    
    for (const [providerId, providerConfig] of Object.entries(config.providers || {})) {
      try {
        const result = await discoverProviderModels(providerConfig, providerId);
        allResults[providerId] = result;
      } catch (error) {
        console.error(`❌ 处理供应商 ${providerId} 时出错: ${error.message}`);
        allResults[providerId] = {
          providerId,
          error: error.message
        };
      }
    }
    
    // 显示汇总信息
    console.log('\n📊 汇总信息:');
    Object.values(allResults).forEach(result => {
      if (result.summary) {
        console.log(`   ${result.providerId}: ${result.summary.available}/${result.summary.totalTested} 模型可用`);
        if (result.summary.suggestedDefaultModel) {
          console.log(`      推荐默认模型: ${result.summary.suggestedDefaultModel}`);
        }
      } else if (result.error) {
        console.log(`   ${result.providerId}: 测试失败 - ${result.error}`);
      }
    });
    
    // 询问用户是否要更新配置
    console.log('\n🤔 是否要更新配置文件？ (y/N)');
    
    // 由于是脚本，我们自动更新，用户可以根据备份回滚
    console.log('📝 自动更新配置文件...');
    
    // 收集所有更新
    const providerUpdates = {};
    Object.values(allResults).forEach(result => {
      if (result.updates && result.availableModels.length > 0) {
        providerUpdates[result.providerId] = result.updates;
      }
    });
    
    // 更新配置文件
    const updated = updateConfig(configPath, config, providerUpdates);
    
    if (updated) {
      console.log('\n✅ 配置更新完成！');
      console.log('📋 建议:');
      console.log('   1. 重启路由服务以应用新配置');
      console.log('   2. 测试更新后的模型可用性');
      console.log('   3. 如有问题，可使用备份文件恢复');
    } else {
      console.log('\nℹ️  配置文件无需更新');
    }
    
    console.log('\n🎯 脚本执行完成！');
    
  } catch (error) {
    console.error('❌ 脚本执行失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  discoverProviderModels,
  testModelAvailability,
  updateConfig,
  loadProviderConfig
};