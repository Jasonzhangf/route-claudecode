#!/usr/bin/env node

const axios = require('axios');

console.log('🧪 简化Gemini验证测试');
console.log('='.repeat(50));

async function testSimpleValidation() {
  const request = {
    model: 'gemini-2.5-flash-lite',
    messages: [{
      role: 'user',
      content: 'List files in the current directory'
    }],
    max_tokens: 100,
    tools: [{
      name: 'list-files',  // 包含连字符，应该被修复为 list_files
      description: 'List directory contents',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        },
        required: ['path']
      }
    }]
  };

  console.log('📤 测试工具名称: "list-files" (应该被修复为 "list_files")');
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('✅ 请求成功');
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    
    if (response.data.content) {
      const toolUse = response.data.content.find(c => c.type === 'tool_use');
      if (toolUse) {
        console.log(`🔧 实际使用的工具名称: "${toolUse.name}"`);
        if (toolUse.name === 'list_files') {
          console.log('✅ 成功！工具名称被正确修复：list-files → list_files');
          return { success: true, fixed: true };
        } else if (toolUse.name === 'list-files') {
          console.log('⚠️ 工具名称未被修复，但请求成功');
          return { success: true, fixed: false };
        }
      }
    }
    
    return { success: true, noTools: true };
    
  } catch (error) {
    console.log('❌ 请求失败');
    if (error.code === 'ECONNABORTED') {
      console.log('⏰ 超时 - 可能服务器在处理过程中遇到问题');
    } else if (error.response) {
      console.log(`📊 状态: ${error.response.status}`);
      console.log(`💬 错误: ${error.response.data?.error?.message || '未知错误'}`);
    } else {
      console.log(`🌐 网络错误: ${error.message}`);
    }
    return { success: false, error: error.message };
  }
}

testSimpleValidation().then(result => {
  console.log('\n' + '='.repeat(50));
  if (result.fixed) {
    console.log('🎉 Gemini工具名称验证和修复功能正常工作！');
  } else if (result.success) {
    console.log('✅ 请求成功，但需要检查是否路由到正确的后端');
  } else {
    console.log('❌ 测试失败，可能需要检查配置或实现');
  }
}).catch(console.error);