/**
 * 修复6689端口配置，使用可用的模型
 */

const fs = require('fs').promises;
const path = require('path');

async function fixConfig() {
  console.log('🔧 修复6689端口配置...\n');

  const configPath = path.join(process.env.HOME, '.route-claude-code', 'config', 'load-balancing', 'config-multi-openai-full.json');
  
  try {
    // 读取当前配置
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    console.log('📋 当前问题:');
    console.log('- qwen3-coder 模型超时不可用');
    console.log('- 导致6689端口反复出现streaming错误');
    
    // 创建备份
    const backupPath = configPath + '.backup.' + Date.now();
    await fs.writeFile(backupPath, configContent);
    console.log(`\n💾 原配置已备份到: ${path.basename(backupPath)}`);
    
    // 修复配置
    const fixedConfig = JSON.parse(JSON.stringify(config));
    
    // 更新shuaihong-openai提供商
    const shuaihongProvider = fixedConfig.providers['shuaihong-openai'];
    
    // 使用测试确认可用的模型
    const workingModels = ['gpt-4o-mini', 'gemini-2.5-pro', 'gemini-2.5-flash'];
    
    console.log('\n🔄 更新shuaihong-openai配置:');
    console.log(`原模型: ${shuaihongProvider.models.join(', ')}`);
    console.log(`新模型: ${workingModels.join(', ')}`);
    
    shuaihongProvider.models = workingModels;
    shuaihongProvider.defaultModel = 'gpt-4o-mini'; // 使用最稳定的模型作为默认
    
    // 更新maxTokens配置
    shuaihongProvider.maxTokens = {
      'gpt-4o-mini': 131072,
      'gemini-2.5-pro': 131072,
      'gemini-2.5-flash': 131072
    };
    
    // 更新路由配置，将所有使用qwen3-coder的地方改为gpt-4o-mini
    console.log('\n🔄 更新路由配置:');
    Object.keys(fixedConfig.routing).forEach(category => {
      const categoryConfig = fixedConfig.routing[category];
      if (categoryConfig.providers) {
        categoryConfig.providers.forEach(providerConfig => {
          if (providerConfig.provider === 'shuaihong-openai') {
            if (providerConfig.model === 'qwen3-coder') {
              console.log(`  ${category}: qwen3-coder → gpt-4o-mini`);
              providerConfig.model = 'gpt-4o-mini';
            }
            // 保持其他模型不变，如果它们是可用的
            if (providerConfig.model === 'gemini-2.5-pro' || providerConfig.model === 'gemini-2.5-flash') {
              console.log(`  ${category}: 保持 ${providerConfig.model}`);
            }
          }
        });
      }
    });
    
    // 写入修复后的配置
    await fs.writeFile(configPath, JSON.stringify(fixedConfig, null, 2));
    console.log(`\n✅ 配置已更新: ${configPath}`);
    
    console.log('\n📋 修复总结:');
    console.log('✅ 移除了不可用的qwen3-coder模型');
    console.log('✅ 使用经过测试的可用模型');
    console.log('✅ 更新了所有相关的路由配置');
    console.log('✅ 设置gpt-4o-mini为默认模型（最稳定）');
    
    console.log('\n🔄 下一步操作:');
    console.log('1. 重启6689端口服务:');
    console.log('   pkill -f "port.*6689"');
    console.log('   rcc start --config ~/.route-claude-code/config/load-balancing/config-multi-openai-full.json --debug &');
    console.log('');
    console.log('2. 测试修复效果:');
    console.log('   curl -X POST http://localhost:6689/v1/chat/completions \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"model":"claude-3-haiku","messages":[{"role":"user","content":"Hello"}],"stream":true}\'');
    
  } catch (error) {
    console.log(`❌ 修复失败: ${error.message}`);
  }
}

fixConfig().catch(console.error);