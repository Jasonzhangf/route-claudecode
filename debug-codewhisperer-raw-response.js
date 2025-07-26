#!/usr/bin/env node

/**
 * 调试CodeWhisperer的原始响应
 * 直接调用CodeWhisperer API并分析原始响应
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 获取token
function getToken() {
  try {
    const tokenPath = path.join(require('os').homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    return tokenData.accessToken;
  } catch (error) {
    console.error('❌ 无法获取token:', error.message);
    process.exit(1);
  }
}

// 构建CodeWhisperer请求（基于demo2的逻辑）
function buildCodeWhispererRequest() {
  return {
    "conversationState": {
      "chatTriggerType": "MANUAL",
      "conversationId": "test-conversation-" + Date.now(),
      "currentMessage": {
        "userInputMessage": {
          "content": "Hello, can you help me with a simple task?",
          "modelId": "CLAUDE_SONNET_4_20250514_V1_0",
          "origin": "AI_EDITOR",
          "userInputMessageContext": {}
        }
      },
      "history": []
    },
    "profileArn": "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK"
  };
}

async function testCodeWhispererDirect() {
  console.log('🔍 直接测试CodeWhisperer API...\n');
  
  const token = getToken();
  const request = buildCodeWhispererRequest();
  
  console.log('📤 发送请求到CodeWhisperer:');
  console.log(JSON.stringify(request, null, 2));
  
  try {
    const response = await axios.post(
      'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
      request,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );
    
    console.log('\n📥 CodeWhisperer响应:');
    console.log(`状态码: ${response.status}`);
    console.log(`响应头:`, response.headers);
    
    const responseBuffer = Buffer.from(response.data);
    console.log(`响应长度: ${responseBuffer.length} bytes`);
    console.log(`响应预览 (hex): ${responseBuffer.toString('hex').substring(0, 200)}...`);
    console.log(`响应预览 (utf8): ${responseBuffer.toString('utf8').substring(0, 500)}...`);
    
    // 保存原始响应
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawFilename = `debug-codewhisperer-raw-${timestamp}.bin`;
    fs.writeFileSync(rawFilename, responseBuffer);
    console.log(`\n💾 原始响应已保存到: ${rawFilename}`);
    
    // 尝试解析事件
    console.log('\n🔍 尝试解析事件...');
    try {
      // 使用我们的解析器
      const { parseEvents, parseNonStreamingResponse } = require('./src/providers/codewhisperer/parser.ts');
      
      const events = parseEvents(responseBuffer);
      console.log(`解析到 ${events.length} 个事件:`);
      
      events.forEach((event, i) => {
        console.log(`  [${i}] ${event.Event}:`, JSON.stringify(event.Data, null, 2));
      });
      
      const contexts = parseNonStreamingResponse(responseBuffer, 'debug-test');
      console.log(`\n解析到 ${contexts.length} 个context:`);
      contexts.forEach((context, i) => {
        console.log(`  [${i}]`, JSON.stringify(context, null, 2));
      });
      
    } catch (parseError) {
      console.error('❌ 解析失败:', parseError.message);
    }
    
    return responseBuffer;
    
  } catch (error) {
    console.error('❌ CodeWhisperer请求失败:', error.message);
    if (error.response) {
      console.error(`状态码: ${error.response.status}`);
      console.error(`响应数据:`, error.response.data);
    }
    return null;
  }
}

async function compareWithDemo2Parser() {
  console.log('\n🔍 与demo2解析器对比...');
  
  // 检查是否有demo2的parser
  const demo2ParserPath = path.join('examples', 'demo2', 'parser');
  if (fs.existsSync(demo2ParserPath)) {
    console.log('✅ 找到demo2解析器目录');
    
    // 列出parser目录的文件
    const parserFiles = fs.readdirSync(demo2ParserPath);
    console.log('Parser文件:', parserFiles);
    
    // 如果有Go文件，显示其内容
    const goFiles = parserFiles.filter(f => f.endsWith('.go'));
    if (goFiles.length > 0) {
      console.log(`\n📄 Demo2解析器实现 (${goFiles[0]}):`);
      const parserContent = fs.readFileSync(path.join(demo2ParserPath, goFiles[0]), 'utf8');
      console.log(parserContent.substring(0, 1000) + '...');
    }
  } else {
    console.log('❌ 未找到demo2解析器目录');
  }
}

async function main() {
  console.log('🚀 CodeWhisperer原始响应调试\n');
  
  // 直接测试CodeWhisperer
  const rawResponse = await testCodeWhispererDirect();
  
  // 与demo2解析器对比
  await compareWithDemo2Parser();
  
  console.log('\n✨ 调试完成!');
}

main().catch(console.error);