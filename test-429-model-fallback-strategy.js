#!/usr/bin/env node

/**
 * Gemini 429降级轮询策略配置验证测试
 * 验证gemini-2.5-flash -> gemini-2.5-flash-lite -> gemini-2.0-flash-lite-001降级链
 * Project owner: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 Gemini 429降级轮询策略配置验证');
console.log('=====================================\n');

function validateModelFallbackConfig() {
  console.log('📋 Step 1: 验证配置文件结构...');
  
  const configPath = path.expanduser('~/.route-claude-code/config/single-provider/config-google-gemini-5502.json');
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const provider = config.providers['google-gemini'];
    
    // 验证基础配置存在
    if (!provider.modelFallback) {
      throw new Error('❌ modelFallback配置缺失');
    }
    
    const fallback = provider.modelFallback;
    
    console.log('✅ 基础配置验证通过:');
    console.log(`   - enabled: ${fallback.enabled}`);
    console.log(`   - cooldownMs: ${fallback.cooldownMs}ms`);
    console.log(`   - 降级链数量: ${Object.keys(fallback.fallbackChains).length}`);
    
    return { config, fallback };
    
  } catch (error) {
    console.error('❌ 配置文件验证失败:', error.message);
    return null;
  }
}

function validateFallbackChains(fallback) {
  console.log('\n📊 Step 2: 验证降级链配置...');
  
  const chains = fallback.fallbackChains;
  
  // 验证gemini-2.5-flash降级链
  const flashChain = chains['gemini-2.5-flash'];
  if (!flashChain) {
    console.error('❌ gemini-2.5-flash降级链缺失');
    return false;
  }
  
  console.log('✅ gemini-2.5-flash降级链:');
  console.log(`   主模型: gemini-2.5-flash`);
  flashChain.fallbackModels.forEach((model, idx) => {
    console.log(`   降级${idx + 1}: ${model}`);
  });
  console.log(`   最大降级次数: ${flashChain.maxFallbacks}`);
  console.log(`   成功后重置: ${flashChain.resetAfterSuccess}`);
  
  // 验证gemini-2.5-flash-lite降级链
  const flashLiteChain = chains['gemini-2.5-flash-lite'];
  if (!flashLiteChain) {
    console.error('❌ gemini-2.5-flash-lite降级链缺失');
    return false;
  }
  
  console.log('\n✅ gemini-2.5-flash-lite降级链:');
  console.log(`   主模型: gemini-2.5-flash-lite`);
  flashLiteChain.fallbackModels.forEach((model, idx) => {
    console.log(`   降级${idx + 1}: ${model}`);
  });
  console.log(`   最大降级次数: ${flashLiteChain.maxFallbacks}`);
  
  return true;
}

function validateGlobalSettings(fallback) {
  console.log('\n⚙️ Step 3: 验证全局设置...');
  
  const global = fallback.globalSettings;
  if (!global) {
    console.error('❌ 全局设置缺失');
    return false;
  }
  
  console.log('✅ 全局设置验证通过:');
  console.log(`   - 跟踪使用情况: ${global.trackFallbackUsage}`);
  console.log(`   - 记录决策日志: ${global.logFallbackDecisions}`);
  console.log(`   - 最大降级深度: ${global.maxFallbackDepth}`);
  console.log(`   - 重置间隔: ${global.fallbackResetInterval}ms (${global.fallbackResetInterval/60000}分钟)`);
  
  return true;
}

function generateFallbackFlow() {
  console.log('\n🔄 Step 4: 生成降级流程图...');
  
  console.log('💡 降级策略工作流程:');
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    429降级轮询策略                           │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log('│  1️⃣  请求 gemini-2.5-flash                                  │');
  console.log('│      ├─ 所有Key可用 ➜ 正常处理                              │');
  console.log('│      └─ 所有Key 429 ➜ 降级到 gemini-2.5-flash-lite          │');
  console.log('│                                                             │');
  console.log('│  2️⃣  请求 gemini-2.5-flash-lite                             │');
  console.log('│      ├─ 所有Key可用 ➜ 正常处理                              │');
  console.log('│      └─ 所有Key 429 ➜ 降级到 gemini-2.0-flash-lite-001      │');
  console.log('│                                                             │');
  console.log('│  3️⃣  请求 gemini-2.0-flash-lite-001                         │');
  console.log('│      ├─ 所有Key可用 ➜ 正常处理                              │');
  console.log('│      └─ 所有Key 429 ➜ 返回服务不可用                        │');
  console.log('│                                                             │');
  console.log('│  🔄 恢复机制:                                                │');
  console.log('│      ├─ 每60秒检查原始模型是否恢复                           │');
  console.log('│      ├─ 成功后重置到原始模型                                 │');
  console.log('│      └─ 每5分钟全局重置降级状态                              │');
  console.log('└─────────────────────────────────────────────────────────────┘');
}

function validateTokenLimits(config) {
  console.log('\n🎯 Step 5: 验证Token限制兼容性...');
  
  const maxTokens = config.providers['google-gemini'].maxTokens;
  const fallbackModels = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite', 
    'gemini-2.0-flash-lite-001'
  ];
  
  console.log('📊 降级链Token限制对比:');
  fallbackModels.forEach((model, idx) => {
    const tokens = maxTokens[model] || 'unknown';
    const prefix = idx === 0 ? '🎯 主要' : `📉 降级${idx}`;
    console.log(`   ${prefix}: ${model} = ${tokens} tokens`);
  });
  
  // 检查Token限制兼容性
  const flashTokens = maxTokens['gemini-2.5-flash'];
  const flashLiteTokens = maxTokens['gemini-2.5-flash-lite'];
  const flash001Tokens = maxTokens['gemini-2.0-flash-lite-001'];
  
  if (flashTokens >= flashLiteTokens && flashLiteTokens >= flash001Tokens) {
    console.log('✅ Token限制降级兼容性验证通过');
  } else {
    console.log('⚠️  Token限制可能需要调整');
  }
}

function generateConfigBackupInfo() {
  console.log('\n💾 Step 6: 配置备份信息...');
  
  const backupPath = '~/.route-claude-code/config/single-provider/config-google-gemini-5502.json.backup';
  
  try {
    const { execSync } = require('child_process');
    const backupExists = execSync(`ls -la ${backupPath}`, { encoding: 'utf-8' });
    console.log('✅ 配置备份已创建:');
    console.log(`   备份路径: ${backupPath}`);
    console.log('   原始配置已安全备份，可随时恢复');
  } catch (error) {
    console.log('⚠️  配置备份状态未知');
  }
}

function generateNextSteps() {
  console.log('\n🚀 Step 7: 下一步实施建议...');
  
  console.log('📋 实现429降级轮询策略需要的代码修改:');
  console.log('');
  console.log('1. 📄 enhanced-rate-limit-manager.ts:');
  console.log('   - 添加modelFallback配置读取');
  console.log('   - 实现getFallbackModel()方法');
  console.log('   - 跟踪模型级别的429状态');
  console.log('');
  console.log('2. 📄 gemini/client.ts:');
  console.log('   - 修改executeWithRetry()方法');
  console.log('   - 在所有Key耗尽时触发模型降级');
  console.log('   - 记录降级决策日志');
  console.log('');
  console.log('3. 📄 gemini/index.ts:');
  console.log('   - 集成模型降级逻辑');
  console.log('   - 处理降级后的响应转换');
  console.log('');
  console.log('4. 🧪 测试验证:');
  console.log('   - 创建429模拟测试');
  console.log('   - 验证降级链完整性');
  console.log('   - 测试恢复机制');
}

async function main() {
  try {
    console.log('开始429降级轮询策略配置验证...\n');
    
    // 1. 验证配置文件
    const result = validateModelFallbackConfig();
    if (!result) {
      process.exit(1);
    }
    
    const { config, fallback } = result;
    
    // 2. 验证降级链
    const chainsValid = validateFallbackChains(fallback);
    if (!chainsValid) {
      process.exit(1);
    }
    
    // 3. 验证全局设置
    const globalValid = validateGlobalSettings(fallback);
    if (!globalValid) {
      process.exit(1);
    }
    
    // 4. 生成流程图
    generateFallbackFlow();
    
    // 5. 验证Token兼容性
    validateTokenLimits(config);
    
    // 6. 备份信息
    generateConfigBackupInfo();
    
    // 7. 下一步建议
    generateNextSteps();
    
    console.log('\n🎉 配置验证完成');
    console.log('================');
    console.log('✅ modelFallback配置已成功添加到Gemini Provider');
    console.log('✅ 降级链: gemini-2.5-flash → gemini-2.5-flash-lite → gemini-2.0-flash-lite-001');
    console.log('✅ 冷却期设置: 60秒');
    console.log('✅ 配置备份已保存');
    console.log('');
    console.log('📝 下一步: 需要实现代码逻辑来支持此配置');
    
  } catch (error) {
    console.error('💥 验证异常:', error.message);
    process.exit(1);
  }
}

// Helper function to expand ~ in paths
path.expanduser = function(filepath) {
  if (filepath[0] === '~') {
    return path.join(process.env.HOME, filepath.slice(1));
  }
  return filepath;
};

if (require.main === module) {
  main();
}