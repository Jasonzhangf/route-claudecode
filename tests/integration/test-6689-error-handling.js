/**
 * 测试6689端口的错误处理修复
 * 验证404错误和其他API错误是否正确显示在控制台
 */

const axios = require('axios');

async function test6689ErrorHandling() {
  console.log('🧪 测试6689端口错误处理修复...\n');

  const port = 6689;
  const baseUrl = `http://localhost:${port}`;

  // 测试用例
  const testCases = [
    {
      name: '正常请求测试',
      request: {
        model: 'qwen3-coder',
        messages: [
          { role: 'user', content: 'Hello, this is a test message.' }
        ],
        stream: false
      },
      expectError: false
    },
    {
      name: '无效模型测试 (可能触发404)',
      request: {
        model: 'invalid-model-name-that-does-not-exist',
        messages: [
          { role: 'user', content: 'Test with invalid model' }
        ],
        stream: false
      },
      expectError: true
    },
    {
      name: '流式请求测试',
      request: {
        model: 'qwen3-coder',
        messages: [
          { role: 'user', content: 'Hello, this is a streaming test.' }
        ],
        stream: true
      },
      expectError: false
    },
    {
      name: '流式请求 + 无效模型测试',
      request: {
        model: 'another-invalid-model',
        messages: [
          { role: 'user', content: 'Streaming test with invalid model' }
        ],
        stream: true
      },
      expectError: true
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 ${testCase.name}:`);
    
    try {
      const response = await axios.post(`${baseUrl}/v1/chat/completions`, testCase.request, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (testCase.expectError) {
        console.log('  ⚠️  预期错误但请求成功了');
        console.log(`  状态: ${response.status}`);
      } else {
        console.log('  ✅ 请求成功');
        console.log(`  状态: ${response.status}`);
        if (testCase.request.stream) {
          console.log('  📡 流式响应接收完成');
        } else {
          console.log(`  📝 响应长度: ${JSON.stringify(response.data).length} 字符`);
        }
      }
    } catch (error) {
      if (testCase.expectError) {
        console.log('  ✅ 预期的错误发生了');
        console.log(`  错误状态: ${error.response?.status || 'N/A'}`);
        console.log(`  错误信息: ${error.message}`);
        
        // 检查是否有详细的错误响应
        if (error.response?.data) {
          console.log(`  服务器响应: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
        }
      } else {
        console.log('  ❌ 意外错误');
        console.log(`  错误状态: ${error.response?.status || 'N/A'}`);
        console.log(`  错误信息: ${error.message}`);
      }
    }
    
    console.log('');
    
    // 等待一下，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('🎯 测试总结:');
  console.log('✅ 检查控制台是否有详细的错误信息输出');
  console.log('✅ 验证404和其他API错误是否立即抛出');
  console.log('✅ 确认错误信息包含状态码、提供商、端点等详细信息');
  
  console.log('\n📋 如果修复成功，你应该看到:');
  console.log('1. 🚨 [provider-name] CRITICAL API ERROR 或类似的控制台错误输出');
  console.log('2. 详细的错误信息，包括状态码、错误消息、提供商名称等');
  console.log('3. 404错误应该立即失败，不会进行重试');
}

// 运行测试
test6689ErrorHandling().catch(console.error);