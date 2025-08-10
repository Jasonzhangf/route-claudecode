#!/usr/bin/env node

/**
 * 直接测试LMStudio客户端工具解析功能
 * 绕过路由层，直接调用LMStudioClient
 */

const path = require('path');

async function testLMStudioClientDirect() {
  console.log('🧪 直接测试LMStudio客户端工具解析功能...\n');
  
  try {
    // 动态导入LMStudioClient
    const { LMStudioClient } = await import(path.join(process.cwd(), 'dist/providers/lmstudio/client.js'));
    
    console.log('✅ LMStudioClient 导入成功');
    
    const config = {
      type: 'lmstudio',
      endpoint: 'http://localhost:1234/v1/chat/completions',
      forceNonStreaming: true,
      authentication: {
        type: 'none'
      },
      models: ['gpt-oss-20b-mlx'],
      port: 5506
    };
    
    const client = new LMStudioClient(config, 'test-lmstudio');
    console.log('✅ LMStudioClient 创建成功');
    
    const testRequest = {
      model: 'gpt-oss-20b-mlx',
      messages: [{ role: 'user', content: 'Create a file named test.txt with content "Hello World"' }],
      max_tokens: 200,
      stream: false,
      metadata: {
        requestId: 'direct-test-1',
        tools: [{
          type: 'function',
          function: {
            name: 'create_file',
            description: 'Create a file with specified content',
            parameters: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                content: { type: 'string' }
              },
              required: ['filename', 'content']
            }
          }
        }]
      },
      tools: [{
        type: 'function',
        function: {
          name: 'create_file',
          description: 'Create a file with specified content',
          parameters: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['filename', 'content']
          }
        }
      }]
    };
    
    console.log('🚀 发送直接请求到LMStudio客户端...');
    console.log('📝 请求包含工具:', testRequest.metadata.tools.length);
    
    const response = await client.sendRequest(testRequest);
    
    console.log('\n📦 响应分析:');
    console.log('- 响应类型:', typeof response);
    console.log('- 有choices:', !!response.choices);
    console.log('- choices数量:', response.choices?.length || 0);
    
    if (response.choices && response.choices.length > 0) {
      const message = response.choices[0].message;
      console.log('- 消息内容长度:', message.content?.length || 0);
      console.log('- 有tool_calls:', !!message.tool_calls);
      console.log('- tool_calls数量:', message.tool_calls?.length || 0);
      console.log('- finish_reason:', response.choices[0].finish_reason);
      
      if (message.content) {
        console.log('\n📝 响应内容预览:');
        console.log(message.content.substring(0, 300) + '...');
      }
      
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log('\n🎯 检测到工具调用:');
        message.tool_calls.forEach((toolCall, index) => {
          console.log(`  工具${index + 1}:`, {
            id: toolCall.id,
            name: toolCall.function?.name,
            arguments: toolCall.function?.arguments?.substring(0, 100) + '...'
          });
        });
        console.log('✅ 工具解析成功！');
        return true;
      } else {
        console.log('❌ 未检测到工具调用');
        return false;
      }
    } else {
      console.log('❌ 响应格式异常，无choices');
      return false;
    }
    
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    console.log('🔍 错误详情:', error.stack?.substring(0, 500));
    return false;
  }
}

// 运行测试
testLMStudioClientDirect().then((success) => {
  console.log(`\n🏁 直接客户端测试完成，结果: ${success ? '成功' : '失败'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.log('\n❌ 测试过程出错:', error.message);
  process.exit(1);
});