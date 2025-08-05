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
 * 保存到项目记忆
 */
async function saveToProjectMemory(title, content, metadata = {}) {
  try {
    if (!fs.existsSync(PROJECT_MEMORY_PATH)) {
      fs.mkdirSync(PROJECT_MEMORY_PATH, { recursive: true });
    }
    
    const timestamp = new Date().toISOString();
    const filename = `${timestamp.replace(/[:.]/g, '-')}-model-discovery-${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    const memoryPath = path.join(PROJECT_MEMORY_PATH, filename);
    
    const memoryContent = `# ${title}

**时间**: ${timestamp}
**脚本版本**: v2.0
**类型**: 模型发现和配置更新

## 执行摘要
${content.summary}

## 详细结果
${content.details}

## 配置更新
${content.configUpdates}

## 发现的问题
${content.issues}

## 建议后续操作
${content.recommendations}

---
*自动生成 by Claude Code Router Model Discovery Script v2.0*
`;
    
    fs.writeFileSync(memoryPath, memoryContent, 'utf8');
    
    EnhancedLogger.success('已保存到项目记忆', {
      title,
      memoryPath,
      timestamp
    });
    
    return memoryPath;
  } catch (error) {
    EnhancedLogger.warn('保存项目记忆失败', { error: error.message });
    return null;
  }
}

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
      'User-Agent': 'claude-code-router-discovery/2.0.0',
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
 * 自动备份配置文件 (增强版)
 */
async function backupConfigFile(configPath) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(AUTO_BACKUP_CONFIG.backupDir, timestamp);
    const backupFilename = path.basename(configPath);
    const backupPath = path.join(backupDir, backupFilename);
    
    // 创建备份目录
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // 复制配置文件
    fs.copyFileSync(configPath, backupPath);
    
    EnhancedLogger.success('配置文件备份完成', {
      originalPath: configPath,
      backupPath: backupPath,
      timestamp: new Date().toISOString()
    });
    
    return backupPath;
  } catch (error) {
    throw new Error(`Failed to backup config file ${configPath}: ${error.message}`);
  }
}

/**
 * 更新配置文件 (增强版)
 */
async function updateConfig(configPath, originalConfig, providerUpdates) {
  try {
    let updated = false;
    const changes = [];
    
    // 更新providers配置
    for (const [providerId, updates] of Object.entries(providerUpdates)) {
      if (originalConfig.providers && originalConfig.providers[providerId]) {
        const provider = originalConfig.providers[providerId];
        const providerChanges = {
          providerId,
          changes: []
        };
        
        if (updates.models && updates.models.length > 0) {
          const oldModels = provider.models || [];
          const newModels = updates.models;
          
          providerChanges.changes.push({
            type: 'models',
            old: oldModels,
            new: newModels,
            added: newModels.filter(m => !oldModels.includes(m)),
            removed: oldModels.filter(m => !newModels.includes(m))
          });
          
          provider.models = newModels;
          updated = true;
        }
        
        if (updates.defaultModel) {
          const oldDefault = provider.defaultModel;
          const newDefault = updates.defaultModel;
          
          if (oldDefault !== newDefault) {
            providerChanges.changes.push({
              type: 'defaultModel',
              old: oldDefault,
              new: newDefault
            });
            
            provider.defaultModel = newDefault;
            updated = true;
          }
        }
        
        if (updates.maxTokens) {
          const oldMaxTokens = { ...provider.maxTokens };
          provider.maxTokens = { ...provider.maxTokens, ...updates.maxTokens };
          
          const tokenChanges = {};
          for (const [model, tokens] of Object.entries(updates.maxTokens)) {
            if (oldMaxTokens[model] !== tokens) {
              tokenChanges[model] = {
                old: oldMaxTokens[model],
                new: tokens
              };
            }
          }
          
          if (Object.keys(tokenChanges).length > 0) {
            providerChanges.changes.push({
              type: 'maxTokens',
              changes: tokenChanges
            });
            updated = true;
          }
        }
        
        if (providerChanges.changes.length > 0) {
          changes.push(providerChanges);
        }
      }
    }
    
    if (updated) {
      // 自动备份
      const backupPath = await backupConfigFile(configPath);
      
      // 写入更新后的配置
      fs.writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));
      
      EnhancedLogger.success('配置文件更新完成', {
        configPath,
        backupPath,
        changes,
        timestamp: new Date().toISOString()
      });
      
      return {
        updated: true,
        backupPath,
        changes
      };
    } else {
      EnhancedLogger.info('配置文件无需更新', { configPath });
      return {
        updated: false,
        changes: []
      };
    }
  } catch (error) {
    throw new Error(`Failed to update config ${configPath}: ${error.message}`);
  }
}

/**
 * 发现供应商的可用模型
 */
async function discoverProviderModels(providerConfig, providerId) {
  EnhancedLogger.info(`开始发现 ${providerId} 的可用模型...`);
  
  const endpoint = providerConfig.endpoint;
  const providerType = providerConfig.type;
  const apiKey = providerConfig.authentication?.credentials?.apiKey;
  const actualApiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
  
  EnhancedLogger.debug('供应商配置信息', {
    endpoint,
    providerType,
    hasAuth: !!actualApiKey
  });
  
  // 获取测试模型列表
  const modelsToTest = COMMON_MODELS[providerType] || COMMON_MODELS.openai;
  
  EnhancedLogger.info(`开始并发测试...`, {
    modelCount: modelsToTest.length,
    concurrentLimit: CONCURRENT_LIMIT
  });
  
  // 测试模型可用性
  const results = await testModelsConcurrently(endpoint, modelsToTest, actualApiKey);
  
  // 分析结果
  const availableModels = results
    .filter(r => r.available || r.note === 'Rate limited, but model exists')
    .map(r => r.model);
    
  const unavailableModels = results
    .filter(r => !r.available && r.note !== 'Rate limited, but model exists')
    .map(r => ({ model: r.model, error: r.error, status: r.status }));
  
  EnhancedLogger.info('模型可用性测试完成', {
    available: availableModels.length,
    unavailable: unavailableModels.length,
    totalTested: results.length
  });
  
  // 显示可用模型
  if (availableModels.length > 0) {
    EnhancedLogger.success('可用模型列表', availableModels);
  }
  
  // 显示不可用模型（只显示前10个）
  if (unavailableModels.length > 0) {
    EnhancedLogger.warn('不可用模型 (显示前10个)', unavailableModels.slice(0, 10));
    
    if (unavailableModels.length > 10) {
      EnhancedLogger.info(`还有 ${unavailableModels.length - 10} 个不可用模型`);
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
 * 自动测试可用模型
 */
async function testAvailableModels(configPath, providerResults) {
  EnhancedLogger.info('开始自动测试可用模型...');
  
  const testResults = {};
  
  for (const [providerId, result] of Object.entries(providerResults)) {
    if (result.availableModels && result.availableModels.length > 0) {
      EnhancedLogger.info(`测试 ${providerId} 的可用模型...`);
      
      const providerTestResults = {
        successful: 0,
        failed: 0,
        details: []
      };
      
      // 测试前3个可用模型
      const modelsToTest = result.availableModels.slice(0, Math.min(3, result.availableModels.length));
      
      for (const model of modelsToTest) {
        try {
          const testPayload = {
            model: model,
            messages: [{ role: 'user', content: 'What is 2+2? Answer with just the number.' }],
            max_tokens: 10,
            temperature: 0.1
          };
          
          const apiKey = result.config?.authentication?.credentials?.apiKey;
          const actualApiKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
          
          const response = await makeRequest(result.endpoint, {
            method: 'POST',
            headers: actualApiKey ? { 'Authorization': `Bearer ${actualApiKey}` } : {},
            body: JSON.stringify(testPayload)
          });
          
          if (response.status === 200) {
            const jsonResponse = JSON.parse(response.data);
            const answer = jsonResponse.choices?.[0]?.message?.content || 'No response';
            
            providerTestResults.successful++;
            providerTestResults.details.push({
              model,
              status: 'SUCCESS',
              answer: answer.trim(),
              usage: jsonResponse.usage || 'unknown'
            });
            
            EnhancedLogger.success(`${model} 测试成功`, { answer: answer.trim() });
          } else {
            providerTestResults.failed++;
            providerTestResults.details.push({
              model,
              status: 'FAILED',
              error: `HTTP ${response.status}`
            });
            
            EnhancedLogger.warn(`${model} 测试失败`, { status: response.status });
          }
          
          // 模型间延迟
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          providerTestResults.failed++;
          providerTestResults.details.push({
            model,
            status: 'ERROR',
            error: error.message
          });
          
          EnhancedLogger.error(`${model} 测试异常`, { error: error.message });
        }
      }
      
      testResults[providerId] = providerTestResults;
      
      EnhancedLogger.info(`${providerId} 模型测试完成`, {
        successful: providerTestResults.successful,
        failed: providerTestResults.failed,
        total: modelsToTest.length
      });
    }
  }
  
  return testResults;
}

/**
 * 主函数
 */
async function main() {
  const startTime = new Date();
  EnhancedLogger.success('Provider Model Discovery and Configuration Update Script v2.0 启动');
  EnhancedLogger.info('脚本特性', {
    features: [
      '自动配置备份',
      '项目记忆集成', 
      '自动模型发现和测试',
      '增强的日志系统'
    ]
  });
  
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
    
    EnhancedLogger.info('使用配置', {
      configName,
      configPath
    });
    
    // 加载配置
    EnhancedLogger.info('加载配置文件...');
    const config = loadProviderConfig(configPath);
    
    // 发现所有供应商的可用模型
    const allResults = {};
    
    for (const [providerId, providerConfig] of Object.entries(config.providers || {})) {
      try {
        const result = await discoverProviderModels(providerConfig, providerId);
        allResults[providerId] = result;
      } catch (error) {
        EnhancedLogger.error(`处理供应商 ${providerId} 时出错`, { error: error.message });
        allResults[providerId] = {
          providerId,
          error: error.message
        };
      }
    }
    
    // 显示汇总信息
    EnhancedLogger.info('汇总信息:');
    Object.values(allResults).forEach(result => {
      if (result.summary) {
        EnhancedLogger.info(`${result.providerId}: ${result.summary.available}/${result.summary.totalTested} 模型可用`);
        if (result.summary.suggestedDefaultModel) {
          EnhancedLogger.info(`推荐默认模型: ${result.summary.suggestedDefaultModel}`);
        }
      } else if (result.error) {
        EnhancedLogger.error(`${result.providerId}: 测试失败 - ${result.error}`);
      }
    });
    
    // 自动测试可用模型
    const testResults = await testAvailableModels(configPath, allResults);
    
    // 询问用户是否要更新配置
    EnhancedLogger.info('准备更新配置文件...');
    
    // 收集所有更新
    const providerUpdates = {};
    Object.values(allResults).forEach(result => {
      if (result.updates && result.availableModels.length > 0) {
        providerUpdates[result.providerId] = result.updates;
      }
    });
    
    // 更新配置文件
    const updateResult = await updateConfig(configPath, config, providerUpdates);
    
    if (updateResult.updated) {
      EnhancedLogger.success('配置更新完成！');
      EnhancedLogger.info('建议:', {
        suggestions: [
          '重启路由服务以应用新配置',
          '测试更新后的模型可用性',
          '如有问题，可使用备份文件恢复'
        ]
      });
    } else {
      EnhancedLogger.info('配置文件无需更新');
    }
    
    // 生成项目记忆
    const endTime = new Date();
    const executionTime = (endTime - startTime) / 1000;
    
    const memoryContent = {
      summary: `脚本在 ${executionTime.toFixed(2)} 秒内完成，测试了 ${Object.keys(allResults).length} 个供应商，发现 ${Object.values(allResults).filter(r => r.summary).reduce((sum, r) => sum + r.summary.available, 0)} 个可用模型。`,
      details: `\n### 供应商测试结果\n${Object.entries(allResults).map(([id, result]) => {
        if (result.summary) {
          return `- **${id}**: ${result.summary.available}/${result.summary.totalTested} 模型可用，推荐默认模型: ${result.summary.suggestedDefaultModel}`;
        } else {
          return `- **${id}**: 测试失败 - ${result.error}`;
        }
      }).join('\n')}\n\n### 模型测试结果\n${Object.entries(testResults).map(([id, results]) => `\n- **${id}**: ${results.successful}/${results.successful + results.failed} 模型测试成功`).join('')}`,
      configUpdates: updateResult.updated ? `\n### 配置文件更新\n- 备份路径: ${updateResult.backupPath}\n- 更改内容: ${updateResult.changes.length} 个供应商被更新\n- 详细更改: ${JSON.stringify(updateResult.changes, null, 2)}` : '无配置更新',
      issues: `${Object.values(allResults).filter(r => !r.summary).length} 个供应商测试失败`,
      recommendations: '1. 重启路由服务以应用新配置\n2. 定期运行此脚本保持配置最新\n3. 监控模型可用性变化\n4. 根据业务需求调整权重配置'
    };
    
    await saveToProjectMemory(
      `模型发现和配置更新报告 - ${configName}`,
      memoryContent,
      {
        configName,
        executionTime,
        providersTested: Object.keys(allResults).length,
        availableModels: Object.values(allResults).filter(r => r.summary).reduce((sum, r) => sum + r.summary.available, 0),
        configUpdated: updateResult.updated
      }
    );
    
    EnhancedLogger.success('脚本执行完成！', {
      executionTime: `${executionTime.toFixed(2)}s`,
      memorySaved: true
    });
    
  } catch (error) {
    EnhancedLogger.error('脚本执行失败', { error: error.message });
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    EnhancedLogger.error('脚本执行失败', { error: error.message });
    process.exit(1);
  });
}

module.exports = {
  discoverProviderModels,
  testModelAvailability,
  updateConfig,
  loadProviderConfig,
  backupConfigFile,
  saveToProjectMemory,
  testAvailableModels
};