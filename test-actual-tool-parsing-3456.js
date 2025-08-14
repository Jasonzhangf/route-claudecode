#!/usr/bin/env node

const axios = require('axios');

console.log('🧪 测试3456端口的实际工具调用解析');
console.log('=' .repeat(60));

// 测试实际的工具调用 - 模拟真实Claude Code场景
async function testActualToolParsingOn3456() {
  const realClaudeCodeRequest = {
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'user',
        content: [{ 
          type: 'text', 
          text: '现在工具解析错误，你怎么做的单元测试的？请检查日志找出具体问题'
        }]
      }
    ],
    max_tokens: 1000,
    tools: [
      {
        name: 'Bash',
        description: 'Execute bash commands',
        input_schema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The command to execute' },
            description: { type: 'string', description: 'Description of the command' }
          },
          required: ['command']
        }
      },
      {
        name: 'Grep',
        description: 'Search text in files using regex',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern' },
            path: { type: 'string', description: 'File or directory path' },
            output_mode: { type: 'string', description: 'Output mode' }
          },
          required: ['pattern']
        }
      },
      {
        name: 'Read',
        description: 'Read file contents',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to the file' }
          },
          required: ['file_path']
        }
      }
    ]
  };

  console.log('📤 发送实际工具调用请求到3456端口...');
  console.log('🔧 使用工具:', realClaudeCodeRequest.tools.map(t => t.name).join(', '));
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', realClaudeCodeRequest, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 20000
    });

    console.log('✅ 请求成功!');
    console.log(`📊 状态码: ${response.status}`);
    console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
    
    if (response.data.content && response.data.content.length > 0) {
      console.log(`📄 响应内容块: ${response.data.content.length}个`);
      
      response.data.content.forEach((block, index) => {
        console.log(`  [${index}] 类型: ${block.type}`);
        if (block.type === 'tool_use') {
          console.log(`      🔧 工具: ${block.name}`);
          console.log(`      📝 参数: ${JSON.stringify(block.input)}`);
          console.log(`      🆔 ID: ${block.id}`);
        } else if (block.type === 'text') {
          console.log(`      📝 文本: ${block.text?.substring(0, 100)}...`);
        }
      });
      
      // 检查工具调用
      const toolCalls = response.data.content.filter(c => c.type === 'tool_use');
      if (toolCalls.length > 0) {
        console.log(`\n🔧 工具调用解析成功: ${toolCalls.length}个工具调用`);
        toolCalls.forEach((tool, index) => {
          console.log(`  ${index + 1}. ${tool.name}(${JSON.stringify(tool.input)})`);
        });
      }
    }
    
    return { 
      success: true, 
      status: response.status, 
      stopReason: response.data.stop_reason,
      toolCalls: response.data.content?.filter(c => c.type === 'tool_use') || []
    };

  } catch (error) {
    console.log('❌ 请求失败!');
    
    if (error.response) {
      console.log(`📊 状态码: ${error.response.status}`);
      console.log(`❌ 错误信息:`, JSON.stringify(error.response.data, null, 2));
      
      const errorMsg = error.response.data.error?.message || '';
      
      // 检查具体错误类型
      if (errorMsg.includes('Invalid function name')) {
        console.log('💥 确认是Gemini工具名称格式错误!');
        return { success: false, toolNameError: true, error: errorMsg };
      } else if (errorMsg.includes('tool')) {
        console.log('🔧 工具相关错误');
        return { success: false, toolError: true, error: errorMsg };
      } else if (error.response.status === 500) {
        console.log('💥 服务器内部错误');
        return { success: false, serverError: true, error: errorMsg };
      } else {
        console.log('⚠️ 其他类型错误');
        return { success: false, otherError: true, error: errorMsg };
      }
    } else {
      console.log(`❌ 网络错误: ${error.message}`);
      return { success: false, networkError: true, error: error.message };
    }
  }
}

// 检查3456端口的服务状态
async function check3456Status() {
  console.log('🔍 检查3456端口服务状态...');
  
  try {
    const healthResponse = await axios.get('http://localhost:3456/health', { timeout: 5000 });
    console.log('✅ 3456端口服务正常运行');
    console.log(`📊 健康状态: ${healthResponse.status}`);
    return true;
  } catch (error) {
    console.log('❌ 3456端口服务不可用');
    console.log(`❌ 错误: ${error.message}`);
    return false;
  }
}

// 主测试流程
async function runTest() {
  // 1. 检查服务状态
  const serviceOk = await check3456Status();
  if (!serviceOk) {
    console.log('💥 无法连接到3456端口，测试终止');
    return;
  }
  
  // 2. 执行实际工具调用测试
  console.log('\n🧪 执行实际工具调用测试...');
  const testResult = await testActualToolParsingOn3456();
  
  // 3. 总结结果
  console.log('\n' + '='.repeat(60));
  console.log('📋 测试结果总结:');
  
  if (testResult.success) {
    console.log('🎉 工具调用解析完全正常!');
    console.log(`✅ Stop reason: ${testResult.stopReason}`);
    console.log(`🔧 成功解析工具调用: ${testResult.toolCalls.length}个`);
    
    if (testResult.toolCalls.length > 0) {
      console.log('\n📋 解析的工具调用详情:');
      testResult.toolCalls.forEach((tool, index) => {
        console.log(`  ${index + 1}. 🔧 ${tool.name}`);
        console.log(`     📝 参数: ${JSON.stringify(tool.input, null, 6)}`);
      });
    }
  } else if (testResult.toolNameError) {
    console.log('❌ 确认存在Gemini工具名称格式错误');
    console.log('💡 需要在预处理器中添加工具名称格式修复');
  } else if (testResult.toolError) {
    console.log('❌ 存在工具相关的处理错误');
    console.log('💡 需要检查工具调用的格式转换逻辑');
  } else if (testResult.serverError) {
    console.log('❌ 服务器内部错误');
    console.log('💡 需要检查服务器日志和配置');
  } else {
    console.log('⚠️ 其他类型错误，需要进一步调查');
  }
  
  return testResult;
}

// 执行测试
runTest().catch(error => {
  console.error('💥 测试脚本异常:', error);
});