#!/usr/bin/env node

const axios = require('axios');

console.log('🚨 调试实际的工具解析失败 - 基于用户反馈的真实问题');
console.log('=' .repeat(70));

// 创建一个简单的请求来复现15个工具名称格式错误
async function reproduceToolParsingFailure() {
  
  // 使用简单的单工具测试，避免复杂格式问题
  const testRequest = {
    model: 'gemini-2.5-flash-lite', // 使用会引发错误的Gemini模型
    messages: [{
      role: 'user', 
      content: 'Please help me check system status'
    }],
    max_tokens: 100,
    tools: [{
      name: 'Bash',
      description: 'Execute bash commands',  
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' }
        },
        required: ['command']
      }
    }]
  };

  console.log('📤 发送测试请求到3456端口...');
  console.log('🎯 目标: 复现工具名称格式错误');
  console.log(`📋 模型: ${testRequest.model}`);
  console.log(`🔧 工具: ${testRequest.tools[0].name}`);

  try {
    const response = await axios.post('http://localhost:3456/v1/messages', testRequest, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    console.log('✅ 请求成功 - 工具解析正常');
    console.log(`📊 状态: ${response.status}`);
    return { success: true, status: response.status };

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      const errorMsg = errorData.error?.message || '';
      
      console.log('❌ 请求失败 - 发现错误!');
      console.log(`📊 状态码: ${status}`);
      
      if (errorMsg.includes('Invalid function name')) {
        console.log('💥 确认！这就是用户说的工具解析失败！');
        console.log('🔍 错误详情:');
        
        // 提取工具名称错误信息
        const toolErrors = errorMsg.match(/tools\[\d+\]\.function_declarations\[\d+\]\.name/g);
        if (toolErrors) {
          console.log(`📈 发现 ${toolErrors.length} 个工具名称格式错误`);
          console.log('🔧 受影响的工具索引:', toolErrors.slice(0, 5).join(', ') + (toolErrors.length > 5 ? '...' : ''));
        }
        
        return { 
          success: false, 
          confirmed: true, 
          toolNameError: true,
          affectedToolsCount: toolErrors?.length || 0,
          error: errorMsg.substring(0, 500) + '...'
        };
      } else {
        console.log('⚠️ 其他类型错误');
        return { success: false, confirmed: false, error: errorMsg };
      }
    } else {
      console.log('❌ 网络错误:', error.message);
      return { success: false, networkError: true, error: error.message };
    }
  }
}

// 执行调试测试
reproduceToolParsingFailure().then(result => {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 调试结果总结:');
  
  if (result.success) {
    console.log('❓ 未复现工具解析失败 - 可能已修复或条件不同');
  } else if (result.confirmed && result.toolNameError) {
    console.log('✅ 成功复现！确认存在工具名称格式错误');  
    console.log(`📊 受影响工具数量: ${result.affectedToolsCount}`);
    console.log('💡 这确实是用户报告的实际解析失败问题');
    console.log('🚨 需要在Gemini转换中修复工具名称格式问题');
  } else {
    console.log('⚠️ 发现其他错误，需要进一步分析');
  }
  
}).catch(error => {
  console.error('💥 调试脚本异常:', error.message);
});