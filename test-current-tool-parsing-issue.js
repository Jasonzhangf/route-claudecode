#!/usr/bin/env node

const axios = require('axios');

console.log('🧪 测试当前工具解析问题');
console.log('=' .repeat(60));

// 基于你提供的问题描述和错误信息创建测试
async function testCurrentToolParsingIssue() {
  console.log('\n📤 测试工具调用解析 - 使用实际的Claude Code工具');
  
  const testRequest = {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user', 
        content: [{ 
          type: 'text', 
          text: '请帮我查看/tmp/ccr-dev.log的最后100行，检查最近的错误'
        }]
      }
    ],
    max_tokens: 500,
    tools: [
      {
        name: 'Bash',
        description: 'Execute bash commands',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The command to execute' },
            description: { type: 'string', description: 'Description of what this command does' }
          },
          required: ['command']
        }
      }
    ]
  };

  try {
    console.log('📋 请求详情:');
    console.log(`- 模型: ${testRequest.model}`);
    console.log(`- 工具: ${testRequest.tools.map(t => t.name).join(', ')}`);
    console.log(`- 消息: ${testRequest.messages[0].content[0].text.substring(0, 50)}...`);
    
    const response = await axios.post('http://localhost:3456/v1/messages', testRequest, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });

    console.log('\n✅ 请求成功!');
    console.log(`📊 状态码: ${response.status}`);
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    
    // 检查响应格式
    if (response.data.content) {
      console.log(`📄 内容块数量: ${response.data.content.length}`);
      
      response.data.content.forEach((block, index) => {
        console.log(`  [${index}] 类型: ${block.type}`);
        if (block.type === 'text') {
          console.log(`      文本: ${block.text?.substring(0, 100)}...`);
        } else if (block.type === 'tool_use') {
          console.log(`      工具: ${block.name}`);
          console.log(`      参数: ${JSON.stringify(block.input)}`);
          console.log(`      ID: ${block.id}`);
        }
      });
      
      // 检查是否有工具调用
      const toolUse = response.data.content.find(c => c.type === 'tool_use');
      if (toolUse) {
        console.log('\n🔧 工具调用检测:');
        console.log(`✅ 发现工具调用: ${toolUse.name}`);
        console.log(`📝 参数格式: ${JSON.stringify(toolUse.input, null, 2)}`);
        
        // 验证工具调用格式是否正确
        const isValidToolCall = toolUse.type === 'tool_use' && 
                               toolUse.name && 
                               toolUse.input && 
                               toolUse.id;
        
        console.log(`✅ 格式验证: ${isValidToolCall ? '通过' : '失败'}`);
        
        if (isValidToolCall) {
          console.log('\n🎉 工具调用格式完全正确！');
          return {
            status: 'PASS',
            toolCall: toolUse,
            response: response.data
          };
        } else {
          console.log('\n❌ 工具调用格式有问题！');
          return {
            status: 'FAIL',
            issue: 'INVALID_TOOL_FORMAT',
            toolCall: toolUse,
            response: response.data
          };
        }
      } else {
        console.log('\n⚠️ 没有检测到工具调用');
        return {
          status: 'FAIL',
          issue: 'NO_TOOL_CALL',
          response: response.data
        };
      }
    } else {
      console.log('\n❌ 响应没有内容');
      return {
        status: 'FAIL',
        issue: 'NO_CONTENT',
        response: response.data
      };
    }

  } catch (error) {
    console.log('\n❌ 请求失败!');
    
    if (error.response) {
      console.log(`📊 状态码: ${error.response.status}`);
      console.log(`❌ 错误详情:`, JSON.stringify(error.response.data, null, 2));
      
      const errorMsg = error.response.data.error?.message || '';
      
      // 检查具体错误类型
      if (errorMsg.includes('Invalid function name')) {
        console.log('💥 确认是Gemini工具名称格式错误!');
        return { status: 'FAIL', issue: 'GEMINI_TOOL_NAME_ERROR', error: errorMsg };
      } else if (errorMsg.includes('tool')) {
        console.log('🔧 工具相关错误');
        return { status: 'FAIL', issue: 'TOOL_ERROR', error: errorMsg };
      } else {
        console.log('⚠️ 其他类型错误');
        return { status: 'FAIL', issue: 'OTHER_ERROR', error: errorMsg };
      }
    } else {
      console.log(`❌ 网络错误: ${error.message}`);
      return { status: 'FAIL', issue: 'NETWORK_ERROR', error: error.message };
    }
  }
}

// 运行测试
testCurrentToolParsingIssue().then(result => {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 测试结果总结:');
  console.log(`📊 状态: ${result.status}`);
  
  if (result.status === 'PASS') {
    console.log('✅ 工具调用解析正常工作');
    console.log(`🔧 成功调用工具: ${result.toolCall.name}`);
    console.log(`📝 参数: ${JSON.stringify(result.toolCall.input)}`);
  } else {
    console.log(`❌ 发现问题: ${result.issue}`);
    
    switch (result.issue) {
      case 'GEMINI_TOOL_NAME_ERROR':
        console.log('💡 需要修复Gemini API工具名称格式问题');
        break;
      case 'INVALID_TOOL_FORMAT':
        console.log('💡 需要修复工具调用格式问题');
        break;
      case 'NO_TOOL_CALL':
        console.log('💡 工具调用没有被正确生成');
        break;
      case 'NO_CONTENT':
        console.log('💡 响应内容为空，可能是静默失败');
        break;
      case 'TOOL_ERROR':
        console.log('💡 存在工具相关的处理错误');
        break;
      default:
        console.log('💡 需要进一步调查错误原因');
    }
  }
}).catch(error => {
  console.error('💥 测试脚本异常:', error);
});