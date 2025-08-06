/**
 * 修复6689端口的模型名称问题
 * 根据API错误信息调整正确的模型名称
 */

const fs = require('fs').promises;
const path = require('path');

async function fixModelNames() {
  console.log('🔧 修复6689端口模型名称问题...\n');

  const configPath = path.join(process.env.HOME, '.route-claude-code', 'config', 'load-balancing', 'config-multi-openai-full.json');
  
  try {
    // 读取当前配置
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    console.log('📋 当前shuaihong-openai配置:');
    console.log(`模型列表: ${config.providers['shuaihong-openai'].models.join(', ')}`);
    console.log(`默认模型: ${config.providers['shuaihong-openai'].defaultModel}`);
    
    // 根据API错误信息，推测正确的模型名称格式
    const modelMapping = {
      'qwen3-coder': 'qwen/qwen3-coder:free',
      'gpt-4o-mini': 'openai/gpt-4o-mini:free',
      'gemini-2.5-pro': 'google/gemini-2.5-pro:free',
      'gemini-2.5-flash': 'google/gemini-2.5-flash:free'
    };
    
    console.log('\n🔄 建议的模型名称映射:');
    Object.entries(modelMapping).forEach(([old, new_]) => {
      console.log(`  ${old} → ${new_}`);
    });
    
    // 创建修复后的配置
    const fixedConfig = JSON.parse(JSON.stringify(config));
    
    // 更新shuaihong-openai的模型名称
    const shuaihongProvider = fixedConfig.providers['shuaihong-openai'];
    
    // 更新模型列表
    shuaihongProvider.models = shuaihongProvider.models.map(model => 
      modelMapping[model] || model
    );
    
    // 更新默认模型
    if (modelMapping[shuaihongProvider.defaultModel]) {
      shuaihongProvider.defaultModel = modelMapping[shuaihongProvider.defaultModel];
    }
    
    // 更新maxTokens配置
    const newMaxTokens = {};
    Object.entries(shuaihongProvider.maxTokens).forEach(([model, tokens]) => {
      const newModelName = modelMapping[model] || model;
      newMaxTokens[newModelName] = tokens;
    });
    shuaihongProvider.maxTokens = newMaxTokens;
    
    // 更新路由配置中的模型名称
    Object.keys(fixedConfig.routing).forEach(category => {
      const categoryConfig = fixedConfig.routing[category];
      if (categoryConfig.providers) {
        categoryConfig.providers.forEach(providerConfig => {
          if (providerConfig.provider === 'shuaihong-openai' && modelMapping[providerConfig.model]) {
            console.log(`🔄 更新路由 ${category}: ${providerConfig.model} → ${modelMapping[providerConfig.model]}`);
            providerConfig.model = modelMapping[providerConfig.model];
          }
        });
      }
    });
    
    console.log('\n📋 修复后的shuaihong-openai配置:');
    console.log(`模型列表: ${fixedConfig.providers['shuaihong-openai'].models.join(', ')}`);
    console.log(`默认模型: ${fixedConfig.providers['shuaihong-openai'].defaultModel}`);
    
    // 创建备份
    const backupPath = configPath + '.backup.' + Date.now();
    await fs.writeFile(backupPath, configContent);
    console.log(`\n💾 原配置已备份到: ${backupPath}`);
    
    // 写入修复后的配置
    await fs.writeFile(configPath, JSON.stringify(fixedConfig, null, 2));
    console.log(`✅ 配置已更新: ${configPath}`);
    
    console.log('\n🔄 需要重启6689端口服务以应用更改');
    console.log('建议执行: pkill -f "port.*6689" && rcc start --config ~/.route-claude-code/config/load-balancing/config-multi-openai-full.json');
    
  } catch (error) {
    console.log(`❌ 修复失败: ${error.message}`);
  }
}

// 但是先不执行修复，让我们先测试一下正确的模型名称
async function testCorrectModelNames() {
  console.log('🧪 测试正确的模型名称...\n');
  
  const axios = require('axios');
  const endpoint = 'https://ai.shuaihong.fun/v1/chat/completions';
  const apiKey = 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl';
  
  const testModels = [
    'qwen/qwen3-coder:free',
    'openai/gpt-4o-mini:free',
    'google/gemini-2.5-pro:free'
  ];
  
  for (const model of testModels) {
    console.log(`📋 测试模型: ${model}`);
    
    try {
      const response = await axios.post(endpoint, {
        model: model,
        messages: [
          { role: 'user', content: 'Hello' }
        ],
        max_tokens: 10,
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      console.log(`✅ ${model} 可用`);
      console.log(`响应: ${response.data.choices[0].message.content}`);
      
    } catch (error) {
      console.log(`❌ ${model} 不可用`);
      if (error.response && error.response.data) {
        console.log(`错误: ${JSON.stringify(error.response.data)}`);
      } else {
        console.log(`错误: ${error.message}`);
      }
    }
    
    console.log('');
  }
}

// 先测试正确的模型名称
testCorrectModelNames().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('如果上面的测试显示某些模型可用，请运行以下命令应用修复:');
  console.log('node -e "require(\'./fix-6689-model-names.js\').fixModelNames()"');
}).catch(console.error);

// 导出修复函数供外部调用
module.exports = { fixModelNames };