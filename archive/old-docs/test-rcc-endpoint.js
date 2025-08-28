#!/usr/bin/env node

/**
 * RCC v4.0 端到端测试脚本
 * 
 * 测试OpenAI兼容接口与LM Studio的集成
 */

const http = require('http');
const fs = require('fs');

// 测试配置
const LM_STUDIO_URL = 'http://localhost:1234/v1/chat/completions';
const TEST_REQUESTS = [
  {
    name: '基本对话测试',
    model: 'gpt-oss-20b-mlx',
    messages: [
      { role: 'user', content: '你好，请简单介绍一下你自己' }
    ],
    max_tokens: 100,
    temperature: 0.7
  },
  {
    name: '工具调用测试',
    model: 'gpt-oss-20b-mlx',
    messages: [
      { role: 'user', content: '请列出本地文件，并总结本项目情况保存为summary.md' }
    ],
    max_tokens: 200,
    temperature: 0.5,
    tools: [
      {
        type: 'function',
        function: {
          name: 'list_files',
          description: '列出指定目录下的文件',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: '要列出的目录路径'
              }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'save_file',
          description: '保存内容到文件',
          parameters: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: '文件名'
              },
              content: {
                type: 'string',
                description: '文件内容'
              }
            },
            required: ['filename', 'content']
          }
        }
      }
    ],
    tool_choice: 'auto'
  }
];

/**
 * 发送HTTP请求
 */
function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer lm-studio'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, data: response });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 测试LM Studio连接
 */
async function testLMStudioConnection() {
  console.log('🔍 测试LM Studio连接...');
  
  for (const testCase of TEST_REQUESTS) {
    console.log(`\n📋 ${testCase.name}`);
    console.log('请求内容:', JSON.stringify(testCase, null, 2));
    
    try {
      const startTime = Date.now();
      const response = await makeRequest(LM_STUDIO_URL, testCase);
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  响应时间: ${duration}ms`);
      console.log(`📊 状态码: ${response.status}`);
      
      if (response.status === 200) {
        console.log('✅ 请求成功');
        if (response.data.choices && response.data.choices[0]) {
          console.log('💬 AI响应:', response.data.choices[0].message.content);
          
          // 检查工具调用
          if (response.data.choices[0].message.tool_calls) {
            console.log('🔧 工具调用:', JSON.stringify(response.data.choices[0].message.tool_calls, null, 2));
          }
        }
      } else {
        console.log('❌ 请求失败');
        console.log('错误信息:', response.data);
      }
      
    } catch (error) {
      console.log('❌ 连接错误:', error.message);
    }
    
    console.log('─'.repeat(60));
  }
}

/**
 * 创建测试输入文件
 */
function createTestInputFile() {
  const testInput = `请列出本地文件，并总结本项目情况保存为summary.md

这是一个用于测试RCC v4.0的多轮对话输入。

请执行以下步骤：
1. 使用list_files工具列出当前目录的文件
2. 分析项目结构和内容
3. 生成项目总结
4. 使用save_file工具保存为summary.md

开始执行。`;

  fs.writeFileSync('/tmp/test-input.txt', testInput);
  console.log('📝 测试输入文件已创建: /tmp/test-input.txt');
  return '/tmp/test-input.txt';
}

/**
 * 模拟文件重定向输入测试
 */
async function simulateFileRedirectTest() {
  console.log('\n🔄 开始文件重定向模拟测试...');
  
  const inputFile = createTestInputFile();
  const inputContent = fs.readFileSync(inputFile, 'utf8');
  
  const request = {
    model: 'gpt-oss-20b-mlx',
    messages: [
      { role: 'user', content: inputContent }
    ],
    max_tokens: 500,
    temperature: 0.3,
    tools: [
      {
        type: 'function',
        function: {
          name: 'list_files',
          description: '列出指定目录下的文件',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: '要列出的目录路径'
              }
            },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'save_file',
          description: '保存内容到文件',
          parameters: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: '文件名'
              },
              content: {
                type: 'string',
                description: '文件内容'
              }
            },
            required: ['filename', 'content']
          }
        }
      }
    ],
    tool_choice: 'auto'
  };
  
  console.log('📤 发送多轮工具调用请求...');
  try {
    const response = await makeRequest(LM_STUDIO_URL, request);
    
    if (response.status === 200 && response.data.choices) {
      const message = response.data.choices[0].message;
      console.log('✅ 文件重定向测试成功');
      console.log('🤖 AI响应:', message.content);
      
      if (message.tool_calls) {
        console.log('🔧 触发的工具调用:');
        message.tool_calls.forEach((call, index) => {
          console.log(`  ${index + 1}. ${call.function.name}(${JSON.stringify(call.function.arguments)})`);
        });
      }
    } else {
      console.log('❌ 文件重定向测试失败');
      console.log('响应:', response.data);
    }
  } catch (error) {
    console.log('❌ 文件重定向测试错误:', error.message);
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🚀 RCC v4.0 OpenAI端到端测试开始');
  console.log('═'.repeat(80));
  
  // 测试LM Studio基本连接
  await testLMStudioConnection();
  
  // 测试文件重定向场景
  await simulateFileRedirectTest();
  
  console.log('\n🎯 测试完成！');
  console.log('📋 请检查测试结果，确认所有功能正常工作。');
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}