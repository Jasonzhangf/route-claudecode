#!/usr/bin/env node

const axios = require('axios');

console.log('🚨 强制测试Gemini工具验证功能');
console.log('=' .repeat(60));

async function testForceGeminiValidation() {
  const request = {
    model: 'gemini-2.5-flash-lite', 
    messages: [{
      role: 'user',
      content: 'Please help me run a command to check the logs'
    }],
    max_tokens: 200,
    tools: [
      {
        name: 'Bash',
        description: 'Execute bash commands',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' }
          },
          required: ['command']
        }
      }
    ]
  };

  console.log('📤 发送强制Gemini请求...');
  console.log('🎯 模型: gemini-2.5-flash-lite (应该触发OpenAI transformer的Gemini验证)');
  console.log('🔧 工具: Bash (应该在日志中看到验证消息)');
  
  // 多次尝试确保路由到shuaihong-openai
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`\n🔄 尝试 ${i + 1}/5...`);
      
      const response = await axios.post('http://localhost:3456/v1/messages', request, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });
      
      console.log('✅ 请求成功');
      console.log(`📊 状态: ${response.status}`);
      console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
      
      // 检查是否有工具调用
      if (response.data.content) {
        const toolUse = response.data.content.find(c => c.type === 'tool_use');
        if (toolUse) {
          console.log(`🔧 工具调用成功: ${toolUse.name}`);
        }
      }
      
      // 如果连续成功，说明可能修复了或者路由行为改变了
      if (i >= 2) {
        console.log('✅ 连续成功，可能问题已修复或路由到了其他模型');
        break;
      }
      
    } catch (error) {
      if (error.response && error.response.data.error?.message?.includes('Invalid function name')) {
        console.log(`💥 第 ${i + 1} 次尝试：确认发现工具名称错误！`);
        console.log('🚨 这意味着Gemini验证逻辑被触发了');
        return { success: false, confirmed: true, attempt: i + 1 };
      } else if (error.response) {
        console.log(`❌ 第 ${i + 1} 次尝试：其他错误 - ${error.response.status}`);
        if (i === 0) {
          console.log('💬 错误信息:', error.response.data.error?.message?.substring(0, 200) || '无详细信息');
        }
      } else {
        console.log(`❌ 第 ${i + 1} 次尝试：网络错误 - ${error.message}`);
      }
    }
    
    // 短暂延迟后重试
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { success: true, allAttemptsSucceeded: true };
}

testForceGeminiValidation().then(result => {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 测试结果总结:');
  
  if (result.confirmed) {
    console.log(`✅ 成功！在第 ${result.attempt} 次尝试中触发了Gemini工具验证`);
    console.log('💡 这证明OpenAI transformer的Gemini验证功能正在工作');
  } else if (result.allAttemptsSucceeded) {
    console.log('✅ 所有请求都成功了');
    console.log('💡 可能的原因:');
    console.log('  1. 工具名称验证修复生效了');
    console.log('  2. 请求被路由到了非Gemini模型');
    console.log('  3. shuaihong-openai的Gemini服务暂时正常');
    console.log('📋 建议检查日志中是否有 [OPENAI-TRANSFORMER] Gemini 相关的调试信息');
  }
  
}).catch(error => {
  console.error('💥 测试脚本异常:', error.message);
});