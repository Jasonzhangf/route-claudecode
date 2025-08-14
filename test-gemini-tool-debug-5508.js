#!/usr/bin/env node

const axios = require('axios');

console.log('🧪 测试5508端口Gemini工具名称调试功能');
console.log('=' .repeat(60));

async function testGeminiToolDebug() {
  const request = {
    model: 'gemini-2.5-flash-lite', // 使用会导致工具名称错误的Gemini模型
    messages: [{
      role: 'user',
      content: 'Please help me check the logs'
    }],
    max_tokens: 100,
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
      },
      {
        name: 'Grep', 
        description: 'Search text in files',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern' }
          },
          required: ['pattern']
        }
      }
    ]
  };

  console.log('📤 发送测试请求到5508端口...');
  console.log('🎯 模型: gemini-2.5-flash-lite');
  console.log('🔧 工具: Bash, Grep');
  
  try {
    const response = await axios.post('http://localhost:5508/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    
    console.log('✅ 请求成功！工具名称验证通过');
    console.log(`📊 状态: ${response.status}`);
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    
    return { success: true, status: response.status };
    
  } catch (error) {
    if (error.response) {
      const errorMsg = error.response.data.error?.message || '';
      console.log('❌ 请求失败');  
      console.log(`📊 状态: ${error.response.status}`);
      console.log('🔍 错误信息:', errorMsg.substring(0, 300));
      
      if (errorMsg.includes('Invalid function name')) {
        console.log('🚨 确认！工具名称格式错误');
        return { success: false, toolNameError: true, error: errorMsg };
      } else {
        return { success: false, otherError: true, error: errorMsg };
      }
    } else {
      console.log('❌ 网络错误:', error.message);
      return { success: false, networkError: true, error: error.message };
    }
  }
}

testGeminiToolDebug().then(result => {
  console.log('\n📋 测试结果:');
  
  if (result.success) {
    console.log('✅ 工具调用成功，名称验证通过');
  } else if (result.toolNameError) {
    console.log('❌ 发现工具名称格式错误');
    console.log('💡 检查服务日志中的 [GEMINI-TOOL-DEBUG] 和 [GEMINI-TOOL-ERROR] 信息');
  } else {
    console.log('⚠️ 其他类型错误');
  }
  
}).catch(error => {
  console.error('💥 测试脚本异常:', error.message);
});