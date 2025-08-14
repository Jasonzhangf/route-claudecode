#!/usr/bin/env node

const axios = require('axios');

console.log('🚨 测试OpenAI流程中的Gemini工具调用错误 - 3456端口');
console.log('=' .repeat(70));

async function testOpenAIGeminiToolError() {
  const request = {
    model: 'gemini-2.5-flash-lite', // 通过OpenAI兼容接口的Gemini模型
    messages: [{
      role: 'user',
      content: 'Please help me check the logs for any errors'
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

  console.log('📤 发送请求到3456端口混合配置...');
  console.log('🎯 模型: gemini-2.5-flash-lite (通过shuaihong-openai provider)');
  console.log('🔧 工具: Bash, Grep (Anthropic格式)');
  console.log('💡 预期: OpenAI流程处理，可能出现15个工具名称格式错误');
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000
    });
    
    console.log('✅ 请求成功！');
    console.log(`📊 状态: ${response.status}`);
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    
    if (response.data.content) {
      const toolUse = response.data.content.find(c => c.type === 'tool_use');
      if (toolUse) {
        console.log(`🔧 发现工具调用: ${toolUse.name}`);
      }
    }
    
    return { success: true, status: response.status };
    
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      const errorMsg = errorData.error?.message || '';
      
      console.log('❌ 请求失败！');
      console.log(`📊 状态码: ${status}`);
      
      if (errorMsg.includes('Invalid function name')) {
        console.log('💥 确认！发现OpenAI流程中的工具名称格式错误！');
        console.log('🔍 这就是用户反馈的实际解析失败问题');
        
        // 分析工具名称错误数量
        const toolErrors = errorMsg.match(/tools\[\d+\]\.function_declarations\[\d+\]\.name/g);
        if (toolErrors) {
          console.log(`📈 错误工具数量: ${toolErrors.length}`);
        }
        
        // 显示部分错误信息
        console.log('💬 错误信息片段:');
        console.log(errorMsg.substring(0, 400) + '...');
        
        return { 
          success: false, 
          confirmed: true, 
          toolNameError: true,
          errorCount: toolErrors?.length || 0,
          error: errorMsg 
        };
      } else {
        console.log('⚠️ 其他错误类型');
        console.log('💬 错误信息:', errorMsg.substring(0, 200));
        return { success: false, otherError: true, error: errorMsg };
      }
    } else {
      console.log('❌ 网络错误:', error.message);
      return { success: false, networkError: true, error: error.message };
    }
  }
}

testOpenAIGeminiToolError().then(result => {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 测试结果总结:');
  
  if (result.success) {
    console.log('❓ 未复现工具名称错误，可能：');
    console.log('  1. 路由到了其他非Gemini模型');
    console.log('  2. 工具转换已修复'); 
    console.log('  3. 条件不满足触发错误的场景');
  } else if (result.confirmed && result.toolNameError) {
    console.log('✅ 成功复现！确认OpenAI流程中的工具名称格式问题');
    console.log(`📊 受影响工具数量: ${result.errorCount}`);
    console.log('💡 问题确认: OpenAI兼容流程在处理Anthropic工具格式时出错');
    console.log('🔧 需要修复: OpenAI transformer的工具格式转换逻辑');
  } else if (result.networkError) {
    console.log('⚠️ 网络错误，无法连接3456端口服务');
    console.log('💡 请确认混合配置服务已启动');
  } else {
    console.log('⚠️ 发现其他类型错误，需要进一步分析');
  }
  
}).catch(error => {
  console.error('💥 测试脚本异常:', error.message);
});