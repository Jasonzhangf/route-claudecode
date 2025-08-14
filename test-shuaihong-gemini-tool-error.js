#!/usr/bin/env node

const axios = require('axios');

console.log('🧪 测试ShuaiHong Gemini工具调用错误复现');

// 模拟可能导致工具名称错误的请求
async function testGeminiToolError() {
  const testData = {
    model: 'gemini-2.5-flash-lite', // 使用导致错误的模型
    messages: [
      {
        role: 'user',
        content: 'Please help me list files in current directory'
      }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'Bash',
          description: 'Execute bash commands',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string' },
              description: { type: 'string' }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'LS',
          description: 'List files and directories',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' }
            },
            required: ['path']
          }
        }
      }
    ],
    max_tokens: 100,
    stream: false
  };

  console.log('📥 发送Gemini工具调用测试请求:');
  console.log('Model:', testData.model);
  console.log('Tools:', testData.tools.map(t => t.function.name).join(', '));

  try {
    const response = await axios.post('http://localhost:5508/v1/messages', testData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 10000
    });

    console.log('✅ 响应成功! Status:', response.status);
    console.log('✅ 响应数据:', JSON.stringify(response.data, null, 2));
    
    return { success: true, status: response.status, data: response.data };
  } catch (error) {
    console.log('❌ 请求失败!');
    
    if (error.response) {
      console.log('❌ Status:', error.response.status);
      console.log('❌ Error:', JSON.stringify(error.response.data, null, 2));
      
      // 检查是否是工具名称格式错误
      const errorMsg = error.response.data.error?.message || '';
      if (errorMsg.includes('Invalid function name')) {
        console.log('💥 确认是Gemini工具名称格式错误!');
        
        // 提取错误的工具名称信息
        const toolNameErrors = errorMsg.match(/tools\[(\d+)\]\.function_declarations\[(\d+)\]\.name/g);
        if (toolNameErrors) {
          console.log('🔍 错误的工具索引:', toolNameErrors);
        }
        
        return { success: false, toolNameError: true, error: errorMsg };
      } else {
        console.log('⚠️ 其他类型的错误');
        return { success: false, toolNameError: false, error: errorMsg };
      }
    } else {
      console.log('❌ Network error:', error.message);
      return { success: false, networkError: true, error: error.message };
    }
  }
}

// 测试可能被转换错误的工具名称
async function testPotentialToolNameIssues() {
  console.log('\n🔍 分析可能的工具名称转换问题...');
  
  // 可能的问题：
  console.log('可能的问题源头:');
  console.log('1. 工具名称在转换过程中被修改');
  console.log('2. 预处理器添加了前缀或后缀');
  console.log('3. 格式转换时引入了非法字符');
  console.log('4. 重复的工具或无效的工具定义');
  
  return testGeminiToolError();
}

// 运行测试
testPotentialToolNameIssues().then(result => {
  console.log('\n🔍 测试结果总结:');
  if (result.success) {
    console.log('✅ Gemini工具调用成功，没有名称格式错误');
  } else if (result.toolNameError) {
    console.log('❌ 确认存在Gemini工具名称格式错误');
    console.log('💡 需要在预处理器中添加工具名称格式修复');
  } else if (result.networkError) {
    console.log('⚠️ 网络错误，无法完成测试');
  } else {
    console.log('⚠️ 其他类型错误，非工具名称格式问题');
  }
}).catch(error => {
  console.error('💥 测试脚本异常:', error.message);
});