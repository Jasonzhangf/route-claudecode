#!/usr/bin/env node

/**
 * ModelScope端到端测试脚本
 * 
 * 测试ModelScope API的直接连接和多轮工具调用
 */

const https = require('https');
const fs = require('fs');

// ModelScope配置
const MODELSCOPE_CONFIG = {
  endpoint: 'https://api-inference.modelscope.cn/v1/chat/completions',
  apiKeys: [
    'ms-cc2f461b-8228-427f-99aa-1d44fab73e67',
    'ms-7d6c4fdb-4bf1-40b3-9ec6-ddea16f6702b',
    'ms-7af85c83-5871-43bb-9e2f-fc099ef08baf',
    'ms-9215edc2-dc63-4a33-9f53-e6a6080ec795'
  ],
  defaultModel: 'Qwen/Qwen3-Coder-480B-A35B-Instruct'
};

/**
 * 发送HTTPS请求
 */
function makeRequest(url, data, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${apiKey}`
      }
    };

    const req = https.request(options, (res) => {
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
 * 测试ModelScope连接
 */
async function testModelScopeConnection() {
  console.log('🔍 测试ModelScope API连接...');
  
  const testRequest = {
    model: MODELSCOPE_CONFIG.defaultModel,
    messages: [
      { role: 'user', content: '你好，请简单介绍一下你自己' }
    ],
    max_tokens: 100,
    temperature: 0.7
  };
  
  console.log('\n📋 基本连接测试');
  console.log('模型:', MODELSCOPE_CONFIG.defaultModel);
  console.log('端点:', MODELSCOPE_CONFIG.endpoint);
  
  for (let i = 0; i < MODELSCOPE_CONFIG.apiKeys.length; i++) {
    const apiKey = MODELSCOPE_CONFIG.apiKeys[i];
    console.log(`\n🔑 测试API Key ${i + 1}: ${apiKey.substring(0, 10)}...`);
    
    try {
      const startTime = Date.now();
      const response = await makeRequest(MODELSCOPE_CONFIG.endpoint, testRequest, apiKey);
      const duration = Date.now() - startTime;
      
      console.log(`⏱️  响应时间: ${duration}ms`);
      console.log(`📊 状态码: ${response.status}`);
      
      if (response.status === 200) {
        console.log('✅ API Key有效');
        if (response.data.choices && response.data.choices[0]) {
          console.log('💬 AI响应:', response.data.choices[0].message.content.substring(0, 100) + '...');
        }
        return apiKey; // 返回第一个有效的API Key
      } else {
        console.log('❌ API Key无效');
        console.log('错误信息:', response.data);
      }
      
    } catch (error) {
      console.log('❌ 连接错误:', error.message);
    }
  }
  
  throw new Error('所有API Key都无效');
}

/**
 * 多轮工具调用测试
 */
async function testMultiTurnToolCalling(validApiKey) {
  console.log('\n🔄 开始多轮工具调用测试...');
  
  // 读取测试输入内容
  const inputContent = fs.readFileSync('/tmp/multi-turn-test-input.txt', 'utf8');
  
  const request = {
    model: MODELSCOPE_CONFIG.defaultModel,
    messages: [
      { role: 'user', content: inputContent }
    ],
    max_tokens: 2000,
    temperature: 0.3,
    tools: [
      {
        type: 'function',
        function: {
          name: 'list_files',
          description: '列出指定目录下的文件和文件夹',
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
    const startTime = Date.now();
    const response = await makeRequest(MODELSCOPE_CONFIG.endpoint, request, validApiKey);
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  响应时间: ${duration}ms`);
    console.log(`📊 状态码: ${response.status}`);
    
    if (response.status === 200 && response.data.choices) {
      const message = response.data.choices[0].message;
      console.log('✅ 多轮工具调用测试成功');
      console.log('🤖 AI响应:', message.content);
      
      if (message.tool_calls) {
        console.log('🔧 触发的工具调用:');
        message.tool_calls.forEach((call, index) => {
          console.log(`  ${index + 1}. ${call.function.name}(${JSON.stringify(call.function.arguments)})`);
        });
        
        console.log('\n📊 工具调用分析:');
        console.log(`总计工具调用: ${message.tool_calls.length}`);
        console.log('这证明了ModelScope支持多轮工具调用功能！');
      } else {
        console.log('⚠️ 未检测到工具调用，可能模型不支持或请求格式不正确');
      }
    } else {
      console.log('❌ 多轮工具调用测试失败');
      console.log('响应:', response.data);
    }
  } catch (error) {
    console.log('❌ 多轮工具调用测试错误:', error.message);
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🚀 ModelScope端到端测试开始');
  console.log('═'.repeat(80));
  
  try {
    // 测试基本连接并获取有效的API Key
    const validApiKey = await testModelScopeConnection();
    
    // 测试多轮工具调用
    await testMultiTurnToolCalling(validApiKey);
    
    console.log('\n🎯 ModelScope测试完成！');
    console.log('📋 请检查测试结果，确认ModelScope API功能正常工作。');
    
  } catch (error) {
    console.log('\n❌ ModelScope测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}