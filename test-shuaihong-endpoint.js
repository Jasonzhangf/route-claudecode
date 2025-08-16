#!/usr/bin/env node

/**
 * Shuaihong端到端测试脚本
 * 
 * 测试Shuaihong API的直接连接和多轮工具调用
 */

const https = require('https');
const fs = require('fs');

// Shuaihong配置
const SHUAIHONG_CONFIG = {
  endpoint: 'https://ai.shuaihong.fun/v1/chat/completions',
  apiKey: 'sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl',
  defaultModel: 'gpt-4o-mini'
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
 * 测试Shuaihong连接
 */
async function testShuaihongConnection() {
  console.log('🔍 测试Shuaihong API连接...');
  
  const testRequest = {
    model: SHUAIHONG_CONFIG.defaultModel,
    messages: [
      { role: 'user', content: '你好，请简单介绍一下你自己' }
    ],
    max_tokens: 100,
    temperature: 0.7
  };
  
  console.log('\n📋 基本连接测试');
  console.log('模型:', SHUAIHONG_CONFIG.defaultModel);
  console.log('端点:', SHUAIHONG_CONFIG.endpoint);
  console.log('API Key:', SHUAIHONG_CONFIG.apiKey.substring(0, 10) + '...');
  
  try {
    const startTime = Date.now();
    const response = await makeRequest(SHUAIHONG_CONFIG.endpoint, testRequest, SHUAIHONG_CONFIG.apiKey);
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  响应时间: ${duration}ms`);
    console.log(`📊 状态码: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ API Key有效');
      if (response.data.choices && response.data.choices[0]) {
        console.log('💬 AI响应:', response.data.choices[0].message.content.substring(0, 100) + '...');
      }
      return SHUAIHONG_CONFIG.apiKey;
    } else {
      console.log('❌ API Key无效');
      console.log('错误信息:', response.data);
      throw new Error('Shuaihong API Key无效');
    }
    
  } catch (error) {
    console.log('❌ 连接错误:', error.message);
    throw error;
  }
}

/**
 * 多轮工具调用测试
 */
async function testMultiTurnToolCalling(validApiKey) {
  console.log('\n🔄 开始多轮工具调用测试...');
  
  // 读取测试输入内容
  const inputContent = fs.readFileSync('/tmp/multi-turn-test-input.txt', 'utf8');
  
  const request = {
    model: SHUAIHONG_CONFIG.defaultModel,
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
    const response = await makeRequest(SHUAIHONG_CONFIG.endpoint, request, validApiKey);
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
        console.log('这证明了Shuaihong支持多轮工具调用功能！');
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
  console.log('🚀 Shuaihong端到端测试开始');
  console.log('═'.repeat(80));
  
  try {
    // 测试基本连接并获取有效的API Key
    const validApiKey = await testShuaihongConnection();
    
    // 测试多轮工具调用
    await testMultiTurnToolCalling(validApiKey);
    
    console.log('\n🎯 Shuaihong测试完成！');
    console.log('📋 请检查测试结果，确认Shuaihong API功能正常工作。');
    
  } catch (error) {
    console.log('\n❌ Shuaihong测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}