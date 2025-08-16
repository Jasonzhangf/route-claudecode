#!/usr/bin/env node

/**
 * RCC Gemini Provider Model Updater
 * 
 * 通过Google Gemini API检查可用模型并更新配置
 * 支持筛选2.5和2.0模型，实现多key轮询和降级策略
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Gemini配置路径
const GEMINI_CONFIG_PATH = '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-google-gemini-v3-5502.json';

// Gemini API配置
const GEMINI_API = {
  endpoint: 'https://generativelanguage.googleapis.com',
  listModelsPath: 'v1beta/models',
  apiKeys: [
    'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4',
    'AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA',
    'AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ'
  ]
};

/**
 * 发送HTTPS请求到Gemini API
 */
function makeGeminiAPIRequest(path, apiKey) {
  return new Promise((resolve, reject) => {
    const url = `${GEMINI_API.endpoint}/${path}?key=${apiKey}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
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
    req.end();
  });
}

/**
 * 获取Gemini可用模型列表
 */
async function fetchGeminiModels() {
  console.log('🔍 获取Gemini可用模型列表...');
  
  for (let i = 0; i < GEMINI_API.apiKeys.length; i++) {
    const apiKey = GEMINI_API.apiKeys[i];
    const keyId = apiKey.substring(-8);
    
    console.log(`🔑 尝试API Key ${i + 1} (${keyId})...`);
    
    try {
      const response = await makeGeminiAPIRequest(GEMINI_API.listModelsPath, apiKey);
      
      if (response.status === 200 && response.data.models) {
        console.log(`✅ API Key ${i + 1}成功，获得${response.data.models.length}个模型`);
        
        const models = response.data.models
          .filter(model => {
            // 只返回支持generateContent的模型
            return model.supportedGenerationMethods && 
                   model.supportedGenerationMethods.includes('generateContent');
          })
          .map(model => ({
            name: model.name.replace('models/', ''),
            displayName: model.displayName,
            description: model.description,
            inputTokenLimit: model.inputTokenLimit,
            outputTokenLimit: model.outputTokenLimit,
            supportedGenerationMethods: model.supportedGenerationMethods,
            temperature: model.temperature,
            topP: model.topP,
            topK: model.topK
          }));
        
        console.log(`📋 支持generateContent的模型: ${models.length}个`);
        return models;
        
      } else if (response.status === 429) {
        console.log(`⚠️ API Key ${i + 1}遇到频率限制(429)，尝试下一个...`);
        continue;
      } else {
        console.log(`❌ API Key ${i + 1}失败: ${response.status}`);
        console.log(`   错误: ${JSON.stringify(response.data).substring(0, 100)}...`);
        continue;
      }
    } catch (error) {
      console.log(`❌ API Key ${i + 1}请求错误: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('所有API Key都无法获取模型列表');
}

/**
 * 筛选2.5和2.0版本的模型
 */
function filterGemini25And20Models(models) {
  console.log('\n🔍 筛选Gemini 2.5和2.0模型...');
  
  const targetModels = models.filter(model => {
    const name = model.name.toLowerCase();
    return name.includes('gemini-2.5') || name.includes('gemini-2.0');
  });
  
  console.log(`📋 找到${targetModels.length}个2.5/2.0版本模型:`);
  targetModels.forEach(model => {
    console.log(`  - ${model.name} (${model.displayName})`);
    console.log(`    输入限制: ${model.inputTokenLimit}, 输出限制: ${model.outputTokenLimit}`);
  });
  
  return targetModels;
}

/**
 * 根据429频率设计轮询策略
 */
function designKeyRotationStrategy(models) {
  console.log('\n🎯 设计多Key轮询策略...');
  
  // 模型分级 (根据复杂度和预期使用频率)
  const modelTiers = {
    premium: models.filter(m => m.name.includes('2.5-pro')),
    standard: models.filter(m => m.name.includes('2.5-flash') || m.name.includes('2.0-flash')),
    basic: models.filter(m => m.name.includes('1.5') || !m.name.includes('2.'))
  };
  
  console.log('📊 模型分级:');
  console.log(`  🏆 Premium层: ${modelTiers.premium.map(m => m.name).join(', ')}`);
  console.log(`  ⚡ Standard层: ${modelTiers.standard.map(m => m.name).join(', ')}`);
  console.log(`  📱 Basic层: ${modelTiers.basic.map(m => m.name).join(', ')}`);
  
  // Key轮询策略配置
  const keyRotationStrategy = {
    strategy: 'intelligent_failover',
    cooldownMs: 5000,
    maxRetriesPerKey: 2,
    rateLimitCooldownMs: 60000,
    keyPriority: [
      {
        keyIndex: 0,
        priority: 'high',
        maxConcurrent: 5,
        allowedTiers: ['premium', 'standard', 'basic']
      },
      {
        keyIndex: 1,
        priority: 'medium', 
        maxConcurrent: 3,
        allowedTiers: ['standard', 'basic']
      },
      {
        keyIndex: 2,
        priority: 'backup',
        maxConcurrent: 2,
        allowedTiers: ['basic']
      }
    ]
  };
  
  console.log('🔄 Key轮询策略:');
  keyRotationStrategy.keyPriority.forEach((config, index) => {
    console.log(`  Key ${index + 1}: ${config.priority}优先级, 最大并发${config.maxConcurrent}, 允许层级[${config.allowedTiers.join(',')}]`);
  });
  
  return { modelTiers, keyRotationStrategy };
}

/**
 * 设计降级模型策略
 */
function designFallbackStrategy(modelTiers) {
  console.log('\n📉 设计降级模型策略...');
  
  const fallbackChains = {
    'gemini-2.5-pro': [
      'gemini-2.5-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro'
    ],
    'gemini-2.5-flash': [
      'gemini-2.0-flash-exp', 
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ],
    'gemini-2.0-flash-exp': [
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ]
  };
  
  console.log('🔄 降级链设计:');
  Object.entries(fallbackChains).forEach(([primary, fallbacks]) => {
    console.log(`  ${primary} → [${fallbacks.join(' → ')}]`);
  });
  
  // 429频率监控配置
  const rateLimitMonitoring = {
    enabled: true,
    windowSizeMinutes: 15,
    maxFailuresBeforeFallback: 3,
    recoveryCheckIntervalMinutes: 5,
    adaptiveCooldown: {
      enabled: true,
      baseCooldownMs: 60000,
      maxCooldownMs: 600000,
      backoffMultiplier: 2.0
    }
  };
  
  console.log('📊 429频率监控:');
  console.log(`  监控窗口: ${rateLimitMonitoring.windowSizeMinutes}分钟`);
  console.log(`  触发降级阈值: ${rateLimitMonitoring.maxFailuresBeforeFallback}次失败`);
  console.log(`  自适应冷却: ${rateLimitMonitoring.adaptiveCooldown.baseCooldownMs}ms起始`);
  
  return { fallbackChains, rateLimitMonitoring };
}

/**
 * 更新Gemini配置文件
 */
function updateGeminiConfig(models, strategies) {
  console.log('\n📝 更新Gemini配置文件...');
  
  // 读取现有配置
  const existingConfig = JSON.parse(fs.readFileSync(GEMINI_CONFIG_PATH, 'utf8'));
  
  // 更新模型列表 (只保留2.5和2.0)
  const modelNames = models.map(m => m.name);
  existingConfig.providers['google-gemini'].models = modelNames;
  
  // 更新maxTokens配置
  const maxTokensConfig = {};
  models.forEach(model => {
    maxTokensConfig[model.name] = Math.min(
      model.inputTokenLimit || 1048576,
      2097152  // 最大限制2M tokens
    );
  });
  existingConfig.providers['google-gemini'].maxTokens = maxTokensConfig;
  
  // 更新Key轮询策略
  existingConfig.sixLayerArchitecture.router.keyRotation = strategies.keyRotationStrategy;
  
  // 添加降级策略配置
  existingConfig.providers['google-gemini'].fallbackStrategy = strategies.fallbackStrategy;
  existingConfig.providers['google-gemini'].rateLimitMonitoring = strategies.fallbackStrategy.rateLimitMonitoring;
  
  // 更新模型分级
  existingConfig.providers['google-gemini'].modelTiers = strategies.modelTiers;
  
  // 更新元数据
  existingConfig.providers['google-gemini'].lastFetched = new Date().toISOString();
  existingConfig.providers['google-gemini'].fetchStats = {
    totalModels: models.length,
    filteredModels: modelNames.length,
    targetVersions: ['2.5', '2.0'],
    lastUpdate: new Date().toISOString()
  };
  
  // 创建备份
  const backupPath = GEMINI_CONFIG_PATH + '.backup-' + Date.now();
  fs.writeFileSync(backupPath, fs.readFileSync(GEMINI_CONFIG_PATH));
  console.log(`📦 创建配置备份: ${backupPath}`);
  
  // 写入更新的配置
  fs.writeFileSync(GEMINI_CONFIG_PATH, JSON.stringify(existingConfig, null, 2));
  console.log(`✅ 配置文件已更新: ${GEMINI_CONFIG_PATH}`);
  
  return existingConfig;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 RCC Gemini Provider Model Updater 开始');
  console.log('═'.repeat(80));
  
  try {
    // 1. 获取可用模型
    const allModels = await fetchGeminiModels();
    
    // 2. 筛选2.5和2.0模型
    const targetModels = filterGemini25And20Models(allModels);
    
    if (targetModels.length === 0) {
      throw new Error('未找到任何Gemini 2.5或2.0版本模型');
    }
    
    // 3. 设计轮询策略
    const { modelTiers, keyRotationStrategy } = designKeyRotationStrategy(targetModels);
    
    // 4. 设计降级策略  
    const fallbackStrategy = designFallbackStrategy(modelTiers);
    
    // 5. 更新配置文件
    const strategies = { keyRotationStrategy, fallbackStrategy, modelTiers };
    const updatedConfig = updateGeminiConfig(targetModels, strategies);
    
    console.log('\n🎯 Gemini Provider更新完成！');
    console.log('═'.repeat(80));
    console.log(`📊 更新摘要:`);
    console.log(`  - 获取模型: ${allModels.length}个`);
    console.log(`  - 筛选目标: ${targetModels.length}个 (2.5/2.0版本)`);
    console.log(`  - 分级策略: Premium(${modelTiers.premium.length}) + Standard(${modelTiers.standard.length}) + Basic(${modelTiers.basic.length})`);
    console.log(`  - Key轮询: 3级智能故障转移`);
    console.log(`  - 降级链: ${Object.keys(fallbackStrategy.fallbackChains).length}条`);
    console.log(`  - 配置文件: 已更新并备份`);
    
  } catch (error) {
    console.log('\n❌ Gemini Provider更新失败:', error.message);
    process.exit(1);
  }
}

// 运行更新器
if (require.main === module) {
  main().catch(console.error);
}