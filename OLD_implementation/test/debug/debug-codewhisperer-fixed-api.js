#!/usr/bin/env node

/**
 * 修复后的CodeWhisperer API测试
 * 使用正确的端点和格式
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const { homedir } = require('os');

async function testFixedCodeWhispererAPI() {
  console.log('🔧 使用正确端点测试CodeWhisperer API...\n');

  // 读取token
  const tokenPath = path.join(homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  
  if (!fs.existsSync(tokenPath)) {
    console.log('❌ Token文件不存在');
    return;
  }

  try {
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const token = tokenData.accessToken;

    // 创建正确的测试请求
    const testRequest = {
      "conversationState": {
        "chatTriggerType": "MANUAL",
        "conversationId": "test-fixed-" + Date.now(),
        "currentMessage": {
          "userInputMessage": {
            "content": "Hello, please respond with: API working correctly!",
            "modelId": "CLAUDE_SONNET_4_20250514_V1_0",
            "origin": "AI_EDITOR",
            "userInputMessageContext": {
              "toolResults": [],
              "tools": []
            }
          }
        },
        "history": []
      },
      "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK"
    };

    console.log('🚀 测试1: 非流式请求');
    await testNonStreamingRequest(token, testRequest);

    console.log('\n🚀 测试2: 流式请求');
    await testStreamingRequest(token, testRequest);

  } catch (error) {
    console.error('❌ 总体测试失败:', error.message);
  }
}

async function testNonStreamingRequest(token, testRequest) {
  const https = require('https');
  const requestBody = JSON.stringify(testRequest);

  const options = {
    hostname: 'codewhisperer.us-east-1.amazonaws.com',
    path: '/generateAssistantResponse',  // 正确的端点
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestBody),
      'User-Agent': 'Claude-Code-Router-Fixed/2.0.0'
    }
  };

  try {
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = Buffer.alloc(0);
        
        console.log('   响应状态:', res.statusCode);
        
        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });

        res.on('error', reject);
      });

      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    console.log('   响应大小:', response.data.length, 'bytes');
    
    if (response.data.length > 0) {
      const textData = response.data.toString('utf8');
      console.log('   响应内容 (前200字符):', textData.substring(0, 200));
      
      // 保存响应
      const outputDir = path.join(__dirname, 'debug-output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(outputDir, 'fixed-non-streaming-response.txt'), textData);
      console.log('   ✅ 非流式响应已保存');
    } else {
      console.log('   ❌ 响应为空');
    }

  } catch (error) {
    console.log('   ❌ 非流式请求失败:', error.message);
  }
}

async function testStreamingRequest(token, testRequest) {
  const https = require('https');
  const requestBody = JSON.stringify(testRequest);

  const options = {
    hostname: 'codewhisperer.us-east-1.amazonaws.com',
    path: '/generateAssistantResponse',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',  // 流式请求头
      'Content-Length': Buffer.byteLength(requestBody),
      'User-Agent': 'Claude-Code-Router-Fixed/2.0.0'
    }
  };

  try {
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = Buffer.alloc(0);
        
        console.log('   响应状态:', res.statusCode);
        console.log('   Content-Type:', res.headers['content-type']);
        
        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
          console.log('   收到数据块:', chunk.length, 'bytes');
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });

        res.on('error', reject);
      });

      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });

    console.log('   总响应大小:', response.data.length, 'bytes');
    
    if (response.data.length > 0) {
      const textData = response.data.toString('utf8');
      console.log('   响应类型:', response.headers['content-type']);
      
      // 保存响应
      const outputDir = path.join(__dirname, 'debug-output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(outputDir, 'fixed-streaming-response.bin'), response.data);
      fs.writeFileSync(path.join(outputDir, 'fixed-streaming-response.txt'), textData);
      
      console.log('   ✅ 流式响应已保存');
      
      // 尝试解析SSE
      if (textData.includes('event:') && textData.includes('data:')) {
        console.log('   📨 检测到SSE格式，解析中...');
        const events = parseSSEResponse(textData);
        console.log(`   📊 解析出 ${events.length} 个事件`);
        
        let hasContent = false;
        events.forEach((event, index) => {
          if (event.data && typeof event.data === 'object' && event.data.contentBlockDelta) {
            hasContent = true;
            console.log(`   ${index + 1}. ${event.event}: "${event.data.contentBlockDelta.delta.text || ''}"`);
          } else {
            console.log(`   ${index + 1}. ${event.event}: ${JSON.stringify(event.data).substring(0, 50)}...`);
          }
        });
        
        if (hasContent) {
          console.log('   ✅ 发现文本内容!');
        } else {
          console.log('   ❌ 未发现文本内容');
        }
      }
      
    } else {
      console.log('   ❌ 流式响应为空');
    }

  } catch (error) {
    console.log('   ❌ 流式请求失败:', error.message);
  }
}

function parseSSEResponse(sseText) {
  const events = [];
  const lines = sseText.split('\n');
  let currentEvent = null;

  for (let line of lines) {
    line = line.trim();
    
    if (line.startsWith('event:')) {
      if (currentEvent) {
        events.push(currentEvent);
      }
      currentEvent = {
        event: line.substring(6).trim(),
        data: null
      };
    } else if (line.startsWith('data:')) {
      if (currentEvent) {
        const dataStr = line.substring(5).trim();
        try {
          currentEvent.data = JSON.parse(dataStr);
        } catch (e) {
          currentEvent.data = dataStr;
        }
      }
    } else if (line === '' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    }
  }

  if (currentEvent) {
    events.push(currentEvent);
  }

  return events;
}

// 运行测试
if (require.main === module) {
  testFixedCodeWhispererAPI().catch(console.error);
}

module.exports = { testFixedCodeWhispererAPI };