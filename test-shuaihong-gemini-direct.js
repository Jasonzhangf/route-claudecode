#!/usr/bin/env node

const axios = require('axios');

console.log('🎯 直接测试shuaihong-openai + gemini后端的工具验证');
console.log('='.repeat(60));

async function testShuaihongGeminiDirect() {
  // 构建一个请求，设置特殊的路由标识，确保路由到shuaihong-openai
  const request = {
    model: 'gemini-2.5-flash-lite', 
    messages: [{
      role: 'user',
      content: 'Please help me check system logs using a bash command'
    }],
    max_tokens: 150,
    tools: [
      {
        name: 'Bash',
        description: 'Execute bash commands',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            description: { type: 'string', description: 'Description of what the command does' }
          },
          required: ['command']
        }
      },
      // 添加一个潜在有问题的工具名称来测试验证
      {
        name: 'File-Reader',  // 包含连字符，可能触发Gemini验证
        description: 'Read file contents',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to the file to read' }
          },
          required: ['file_path']
        }
      }
    ],
    // 添加一个提示，尝试影响路由决策
    temperature: 0.3,
    metadata: {
      preferProvider: 'shuaihong-openai'  // 尝试影响路由
    }
  };

  console.log('📤 发送请求到3456端口...');
  console.log('🎯 目标: shuaihong-openai provider + gemini-2.5-flash-lite模型');
  console.log('🔧 工具: Bash, File-Reader (包含连字符，应该触发Gemini验证)');
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 
        'Content-Type': 'application/json',
        'X-Routing-Strategy': 'prefer-provider',
        'X-Preferred-Provider': 'shuaihong-openai'
      },
      timeout: 20000
    });
    
    console.log('✅ 请求成功!');
    console.log(`📊 状态: ${response.status}`);
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    console.log(`🆔 Response ID: ${response.data.id}`);
    
    // 检查是否有工具调用
    if (response.data.content) {
      const toolUse = response.data.content.find(c => c.type === 'tool_use');
      if (toolUse) {
        console.log(`🔧 工具调用成功: ${toolUse.name}`);
        console.log('✅ 这意味着Gemini工具验证正常工作，或者工具名称被成功修复');
      } else {
        console.log('📝 响应包含文本内容，无工具调用');
      }
    }
    
    // 显示部分响应内容
    if (response.data.content?.[0]?.text) {
      const text = response.data.content[0].text;
      console.log('📝 响应内容预览:', text.substring(0, 150) + (text.length > 150 ? '...' : ''));
    }
    
    return { success: true, data: response.data };
    
  } catch (error) {
    console.log('❌ 请求失败');
    
    if (error.response) {
      console.log(`📊 HTTP状态: ${error.response.status}`);
      const errorMsg = error.response.data?.error?.message || '无详细错误信息';
      console.log(`💬 错误信息: ${errorMsg}`);
      
      // 检查是否是Gemini工具验证错误
      if (errorMsg.includes('Invalid function name') || errorMsg.includes('function name')) {
        console.log('🎯 确认：这是Gemini工具名称验证错误！');
        console.log('🔧 File-Reader工具名称包含连字符，被Gemini API拒绝了');
        console.log('✅ 这证明我们成功路由到了有Gemini后端的provider');
        return { success: false, confirmed: true, provider: 'shuaihong-openai' };
      }
      
    } else if (error.code === 'ECONNABORTED') {
      console.log('⏰ 请求超时');
    } else {
      console.log(`🌐 网络错误: ${error.message}`);
    }
    
    return { success: false, error: error.message };
  }
}

testShuaihongGeminiDirect().then(result => {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 测试结果分析:');
  
  if (result.confirmed) {
    console.log('✅ 成功验证：Gemini工具名称验证正在工作！');
    console.log(`🎯 Provider: ${result.provider}`);
    console.log('💡 File-Reader工具名称包含连字符，被Gemini API正确拒绝');
    console.log('🔧 这证明我们的validateGeminiToolNameIfNeeded方法需要进一步测试');
  } else if (result.success) {
    console.log('✅ 请求成功，可能的情况:');
    console.log('  1. Gemini工具名称验证生效，自动修复了File-Reader -> File_Reader');
    console.log('  2. 请求被路由到了非Gemini后端');
    console.log('  3. Gemini API已经接受这种工具名称格式');
    console.log('📋 建议检查日志中的 [GEMINI-VALIDATION] 相关信息');
  } else {
    console.log('❌ 请求失败，但不是预期的Gemini验证错误');
    console.log('💡 可能网络问题或其他配置问题');
  }
  
}).catch(error => {
  console.error('💥 测试脚本异常:', error.message);
});