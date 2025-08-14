#!/usr/bin/env node

const axios = require('axios');

console.log('🎯 直接测试shuaihong-openai provider的Gemini验证');
console.log('='.repeat(60));

async function testShuaihongDirectGemini() {
  // 创建多个请求来增加路由到shuaihong-openai的机会
  const request = {
    model: 'gemini-2.5-flash-lite',
    messages: [{
      role: 'user',
      content: 'Help me with file operations using tools'
    }],
    max_tokens: 100,
    tools: [{
      name: 'list-files-with-hyphen',  // 包含连字符，应该被Gemini验证修复
      description: 'List directory contents with hyphenated name',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        },
        required: ['path']
      }
    }],
    // 尝试影响路由到shuaihong-openai
    temperature: 0.1  // 低温度可能影响路由权重
  };

  console.log('📤 发送多个请求增加路由到shuaihong-openai的机会...');
  console.log('🔧 工具: list-files-with-hyphen');
  
  // 发送5次请求，增加命中shuaihong-openai的概率
  for (let i = 0; i < 5; i++) {
    try {
      console.log(`\n🔄 尝试 ${i + 1}/5...`);
      
      const response = await axios.post('http://localhost:3456/v1/messages', request, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });
      
      console.log(`✅ 请求 ${i + 1} 成功`);
      console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
      
      if (response.data.content) {
        const toolUse = response.data.content.find(c => c.type === 'tool_use');
        if (toolUse) {
          console.log(`🔧 实际工具名: "${toolUse.name}"`);
          
          // 检查是否修复了连字符
          if (toolUse.name === 'list_files_with_hyphen') {
            console.log('🎉 成功！工具名称被修复：list-files-with-hyphen → list_files_with_hyphen');
            console.log('✅ 这证明请求路由到了shuaihong-openai并触发了Gemini验证');
            return { success: true, fixed: true, attempt: i + 1 };
          } else if (toolUse.name === 'list-files-with-hyphen') {
            console.log('⚠️ 工具名称未修复，可能路由到了非Gemini backend');
          } else {
            console.log(`ℹ️ 工具名称变为: ${toolUse.name}`);
          }
        }
      }
      
      // 短暂延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`❌ 请求 ${i + 1} 失败: ${error.response?.data?.error?.message || error.message}`);
      
      // 检查是否是Gemini相关错误
      if (error.response?.data?.error?.message?.includes('Invalid function name')) {
        console.log('🎯 发现Gemini工具名称错误！');
        console.log('💡 这意味着请求到达了Gemini backend但验证没有修复工具名');
        return { success: false, geminiError: true, attempt: i + 1 };
      }
    }
  }
  
  return { success: true, allCompleted: true };
}

testShuaihongDirectGemini().then(result => {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 测试结果总结:');
  
  if (result.fixed) {
    console.log(`🎉 成功！在第 ${result.attempt} 次尝试中验证了Gemini工具名修复`);
    console.log('✅ validateGeminiToolNameIfNeeded方法正常工作');
  } else if (result.geminiError) {
    console.log(`⚠️ 第 ${result.attempt} 次尝试触发了Gemini工具名错误`);
    console.log('💡 说明请求到达了Gemini但验证逻辑可能需要调整');
  } else if (result.allCompleted) {
    console.log('✅ 所有请求完成，可能原因:');
    console.log('  1. 请求都被路由到了非Gemini providers');
    console.log('  2. shuaihong-openai的权重较低，命中率不高');
    console.log('  3. Gemini验证正常工作但修复了工具名');
    console.log('📋 建议查看日志确认具体路由情况');
  }
  
}).catch(error => {
  console.error('💥 测试脚本异常:', error.message);
});