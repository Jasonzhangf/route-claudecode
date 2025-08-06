/**
 * 测试shuaihong-openai的可用模型
 */

const axios = require('axios');

async function testShuaihongModels() {
  console.log('🧪 测试shuaihong-openai的可用模型...\n');
  
  const endpoint = 'https://ai.shuaihong.fun/v1/chat/completions';
  const apiKey = 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl';
  
  // 尝试各种可能的模型名称格式
  const testModels = [
    // 原始名称
    'qwen3-coder',
    'gpt-4o-mini',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    
    // 带前缀的名称
    'qwen/qwen3-coder',
    'openai/gpt-4o-mini',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    
    // 其他可能的格式
    'qwen-3-coder',
    'gpt-4o',
    'gemini-pro',
    'claude-3-haiku',
    'claude-3-sonnet',
    
    // 常见的开源模型
    'llama-3-8b',
    'llama-3-70b',
    'mixtral-8x7b',
    'yi-34b'
  ];
  
  const workingModels = [];
  const failedModels = [];
  
  for (const model of testModels) {
    console.log(`📋 测试模型: ${model}`);
    
    try {
      const response = await axios.post(endpoint, {
        model: model,
        messages: [
          { role: 'user', content: 'Say "Hello"' }
        ],
        max_tokens: 5,
        stream: false
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      });
      
      console.log(`✅ ${model} 可用`);
      if (response.data && response.data.choices && response.data.choices[0]) {
        console.log(`响应: ${response.data.choices[0].message.content}`);
      }
      workingModels.push(model);
      
    } catch (error) {
      console.log(`❌ ${model} 不可用`);
      if (error.response && error.response.data && error.response.data.error) {
        const errorMsg = error.response.data.error.message;
        console.log(`错误: ${errorMsg.substring(0, 100)}...`);
        failedModels.push({ model, error: errorMsg });
      } else {
        console.log(`错误: ${error.message}`);
        failedModels.push({ model, error: error.message });
      }
    }
    
    console.log('');
    
    // 添加延迟避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果总结:\n');
  
  console.log(`✅ 可用模型 (${workingModels.length}个):`);
  workingModels.forEach(model => {
    console.log(`  - ${model}`);
  });
  
  console.log(`\n❌ 不可用模型 (${failedModels.length}个):`);
  
  // 按错误类型分组
  const errorGroups = {};
  failedModels.forEach(({ model, error }) => {
    const errorType = error.includes('无可用渠道') ? '无可用渠道' :
                     error.includes('timeout') ? '超时' :
                     error.includes('404') ? '模型不存在' :
                     error.includes('401') ? '认证失败' :
                     '其他错误';
    
    if (!errorGroups[errorType]) {
      errorGroups[errorType] = [];
    }
    errorGroups[errorType].push(model);
  });
  
  Object.entries(errorGroups).forEach(([errorType, models]) => {
    console.log(`\n  ${errorType}:`);
    models.forEach(model => {
      console.log(`    - ${model}`);
    });
  });
  
  if (workingModels.length > 0) {
    console.log('\n💡 建议:');
    console.log('1. 更新配置文件，只使用可用的模型');
    console.log('2. 重启6689端口服务');
    console.log('3. 测试streaming功能是否正常');
    
    console.log('\n🔧 推荐的配置更新:');
    console.log('将shuaihong-openai的models字段更新为:');
    console.log(JSON.stringify(workingModels, null, 2));
  } else {
    console.log('\n⚠️  警告: 没有找到任何可用的模型！');
    console.log('可能的原因:');
    console.log('1. API密钥无效或已过期');
    console.log('2. 账户余额不足');
    console.log('3. API服务暂时不可用');
    console.log('4. 网络连接问题');
  }
}

testShuaihongModels().catch(console.error);