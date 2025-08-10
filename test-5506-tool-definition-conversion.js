#!/usr/bin/env node

/**
 * 测试5506端口的工具定义格式转换问题
 * 验证Anthropic到OpenAI的工具定义转换是否正确
 */

const http = require('http');

// 模拟真实Claude Code会话中的工具定义（Anthropic格式）
const anthropicToolsRequest = {
  model: 'claude-3-5-haiku-20241022',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '请列出本地文件' }
      ]
    }
  ],
  max_tokens: 500,
  tools: [
    {
      name: "LS",
      description: "Lists files and directories in a given path",
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The absolute path to the directory to list"
          }
        },
        required: ["path"]
      }
    }
  ]
};

async function testToolDefinitionConversion() {
  console.log('🔍 测试5506端口工具定义转换问题');
  console.log('==========================================');
  
  console.log('\n📋 发送Anthropic格式的工具定义请求...');
  console.log('工具定义格式:', JSON.stringify(anthropicToolsRequest.tools[0], null, 2));

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(anthropicToolsRequest);
    
    const req = http.request({
      hostname: 'localhost',
      port: 5506,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer test-key'
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n📊 响应状态码: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            console.log('✅ 工具定义转换成功');
            console.log('响应预览:', JSON.stringify({
              id: response.id,
              role: response.role,
              stop_reason: response.stop_reason,
              content_blocks: response.content?.length || 0
            }, null, 2));
          } else {
            console.log('❌ 工具定义转换失败');
            if (response.error) {
              console.log('错误信息:', response.error.message);
              
              // 检查是否是工具格式错误
              if (response.error.message.includes('Invalid discriminator value') || 
                  response.error.message.includes('Expected \'function\'')) {
                console.log('\n🚨 确认问题：工具定义缺少type="function"字段！');
                console.log('这表明Anthropic到OpenAI的工具格式转换没有正确应用。');
              }
            }
          }
          
          resolve({
            success: res.statusCode === 200,
            response,
            statusCode: res.statusCode
          });
          
        } catch (err) {
          console.log('❌ 响应解析失败:', err.message);
          console.log('原始响应:', data);
          resolve({
            success: false,
            parseError: err.message,
            rawData: data,
            statusCode: res.statusCode
          });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ 请求失败:', err.message);
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log('❌ 请求超时');
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const result = await testToolDefinitionConversion();
    
    console.log('\n🎯 测试结果分析');
    console.log('==========================================');
    
    if (result.success) {
      console.log('✅ 工具定义转换正常工作');
      console.log('Transformer层成功将Anthropic工具格式转换为OpenAI兼容格式');
    } else {
      console.log('❌ 发现工具定义转换问题');
      console.log('需要检查以下组件：');
      console.log('1. OpenAI Transformer中的convertAnthropicToolsToOpenAI方法');
      console.log('2. 六层架构中的Transformer层调用');
      console.log('3. 工具定义在请求流水线中的传递路径');
      
      if (result.response?.error?.message?.includes('Expected \'function\'')) {
        console.log('\n🔧 具体修复建议：');
        console.log('工具定义转换失败，Anthropic格式的工具定义直接发送到了LMStudio');
        console.log('需要确保Transformer层的工具转换逻辑正确应用到实际请求');
      }
    }
    
  } catch (error) {
    console.error('测试执行失败:', error.message);
  }
}

if (require.main === module) {
  main();
}