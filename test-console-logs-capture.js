#!/usr/bin/env node

const axios = require('axios');

console.log('🔍 测试控制台输出捕获 - Gemini验证日志');
console.log('='.repeat(60));

async function testWithConsoleCapture() {
  // 故意使用一个更明显的无效Gemini工具名称
  const request = {
    model: 'gemini-2.5-flash-lite',
    messages: [{
      role: 'user',
      content: 'Help me with file operations'
    }],
    max_tokens: 100,
    tools: [
      {
        name: 'File-Reader!@#',  // 明显的无效字符，应该触发验证
        description: 'Read file contents',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' }
          },
          required: ['file_path']
        }
      },
      {
        name: 'System-Info$$$',  // 另一个无效名称
        description: 'Get system information',
        input_schema: {
          type: 'object',
          properties: {
            info_type: { type: 'string' }
          },
          required: ['info_type']
        }
      }
    ]
  };

  console.log('📤 发送包含明显无效工具名称的请求...');
  console.log('🔧 工具: File-Reader!@#, System-Info$$$');
  console.log('💡 这些名称包含Gemini不支持的特殊字符');
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    
    console.log('✅ 请求成功!');
    console.log(`📊 状态: ${response.status}`);
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    
    // 检查工具是否被修复或移除
    if (response.data.content) {
      const toolUse = response.data.content.find(c => c.type === 'tool_use');
      if (toolUse) {
        console.log(`🔧 使用的工具: ${toolUse.name}`);
        console.log('✅ 工具名称可能被自动修复');
      } else {
        console.log('📝 无工具调用 - 可能工具被移除或修复后不满足调用条件');
      }
    }
    
    return { success: true };
    
  } catch (error) {
    if (error.response && error.response.data.error?.message?.includes('Invalid function name')) {
      console.log('🎯 确认：捕获到Gemini工具名称错误！');
      console.log(`💬 错误: ${error.response.data.error.message}`);
      return { success: false, geminiError: true };
    } else {
      console.log(`❌ 其他错误: ${error.response?.data?.error?.message || error.message}`);
      return { success: false, geminiError: false };
    }
  }
}

// 同时检查rcc start进程的输出
console.log('🔍 检查rcc start进程是否有相关输出...');

testWithConsoleCapture().then(result => {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 测试结果:');
  
  if (result.geminiError) {
    console.log('✅ 成功捕获Gemini工具名称验证错误');
    console.log('💡 这证明请求确实到达了Gemini后端');
    console.log('🔧 我们的validateGeminiToolNameIfNeeded方法可能没有被正确调用');
  } else if (result.success) {
    console.log('✅ 请求成功，可能原因:');
    console.log('  1. 🔧 Gemini工具验证成功修复了无效名称');
    console.log('  2. 🔀 请求被路由到了非Gemini后端');
    console.log('  3. ⚠️ 验证逻辑没有被触发');
  } else {
    console.log('❌ 请求失败，但不是预期的Gemini错误');
  }
  
  console.log('\n💡 建议: 如果工具验证正常工作，应该看到以下之一:');
  console.log('  - [GEMINI-VALIDATION] 相关的控制台输出');
  console.log('  - 工具名称被自动修复 (如: File-Reader!@# -> File_Reader)');
  console.log('  - 无效工具被移除');
  
}).catch(console.error);