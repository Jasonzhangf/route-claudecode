#!/usr/bin/env node

/**
 * CodeWhisperer API调用分析工具
 * 分析空响应问题的根本原因
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const { homedir } = require('os');

async function analyzeCodeWhispererAPI() {
  console.log('🔍 CodeWhisperer API调用分析...\n');

  try {
    // 1. 检查token状态
    console.log('Step 1: 检查Token状态');
    await checkTokenStatus();

    // 2. 分析最近的API调用
    console.log('\nStep 2: 分析最近的API调用');
    await analyzeRecentAPICalls();

    // 3. 测试直接API调用
    console.log('\nStep 3: 测试直接API调用');
    await testDirectAPICall();

    // 4. 对比demo2实现
    console.log('\nStep 4: 对比demo2实现');
    await compareDemoImplementation();

  } catch (error) {
    console.error('❌ 分析失败:', error.message);
  }
}

async function checkTokenStatus() {
  // 检查Kiro token文件
  const tokenPath = path.join(homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  
  if (!fs.existsSync(tokenPath)) {
    console.log('❌ Token文件不存在:', tokenPath);
    return;
  }

  try {
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    console.log('✅ Token文件存在');
    console.log('   文件路径:', tokenPath);
    console.log('   Token长度:', tokenData.accessToken ? tokenData.accessToken.length : 'N/A');
    console.log('   过期时间:', tokenData.expiresAt || 'N/A');
    
    // 检查是否过期
    if (tokenData.expiresAt) {
      const expireTime = new Date(tokenData.expiresAt);
      const now = new Date();
      const isExpired = expireTime <= now;
      console.log('   是否过期:', isExpired ? '❌ 已过期' : '✅ 有效');
      
      if (isExpired) {
        console.log('   过期时间差:', Math.round((now - expireTime) / 1000 / 60), '分钟前过期');
      } else {
        console.log('   剩余时间:', Math.round((expireTime - now) / 1000 / 60), '分钟');
      }
    }
  } catch (error) {
    console.log('❌ Token文件解析失败:', error.message);
  }
}

async function analyzeRecentAPICalls() {
  // 分析日志文件中的API调用
  const logPath = '/tmp/ccr-output.log';
  
  if (!fs.existsSync(logPath)) {
    console.log('❌ 日志文件不存在:', logPath);
    return;
  }

  try {
    const logContent = fs.readFileSync(logPath, 'utf8');
    const lines = logContent.split('\n');
    
    // 提取CodeWhisperer相关的日志
    const codewhispererLogs = lines.filter(line => 
      line.includes('CodeWhisperer') || 
      line.includes('provider') ||
      line.includes('converter') ||
      line.includes('eventCount') ||
      line.includes('output_tokens')
    );

    console.log(`📊 找到${codewhispererLogs.length}条相关日志:`);
    
    // 分析最近的几条关键日志
    const recentLogs = codewhispererLogs.slice(-10);
    recentLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log.substring(0, 100)}...`);
    });

    // 查找关键指标
    const tokenFailures = codewhispererLogs.filter(line => line.includes('token validation failed')).length;
    const successfulCalls = codewhispererLogs.filter(line => line.includes('Request completed successfully')).length;
    const zeroTokens = codewhispererLogs.filter(line => line.includes('output_tokens":0')).length;
    const zeroEvents = codewhispererLogs.filter(line => line.includes('eventCount":0')).length;

    console.log('\n📈 关键指标统计:');
    console.log('   Token验证失败:', tokenFailures, '次');
    console.log('   成功的API调用:', successfulCalls, '次');
    console.log('   零输出Token:', zeroTokens, '次');
    console.log('   零事件数量:', zeroEvents, '次');

  } catch (error) {
    console.log('❌ 日志分析失败:', error.message);
  }
}

async function testDirectAPICall() {
  console.log('🧪 准备直接测试CodeWhisperer API调用...');
  
  // 创建测试请求
  const testRequest = {
    "conversationState": {
      "chatTriggerType": "MANUAL",
      "conversationId": "test-" + Date.now(),
      "currentMessage": {
        "userInputMessage": {
          "content": "Hello, please respond with a simple greeting",
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

  // 保存测试请求
  const testDir = path.join(__dirname, 'debug-output');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const requestFile = path.join(testDir, 'direct-api-test-request.json');
  fs.writeFileSync(requestFile, JSON.stringify(testRequest, null, 2));
  console.log('📝 测试请求已保存:', requestFile);

  // 读取token
  const tokenPath = path.join(homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  
  if (!fs.existsSync(tokenPath)) {
    console.log('❌ 无法进行直接测试，Token文件不存在');
    return;
  }

  try {
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    const token = tokenData.accessToken;

    console.log('🚀 发送直接API请求到CodeWhisperer...');

    // 使用Node.js内置模块发送请求
    const https = require('https');
    const requestBody = JSON.stringify(testRequest);

    const options = {
      hostname: 'codewhisperer.us-east-1.amazonaws.com',
      path: '/conversation',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'User-Agent': 'Claude-Code-Router-Debug/2.0.0'
      }
    };

    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = Buffer.alloc(0);
        
        console.log('📊 响应状态:', res.statusCode);
        console.log('📋 响应头:', JSON.stringify(res.headers, null, 2));
        
        res.on('data', (chunk) => {
          data = Buffer.concat([data, chunk]);
          console.log('📦 收到数据块:', chunk.length, 'bytes');
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

    console.log('✅ API调用完成');
    console.log('   响应大小:', response.data.length, 'bytes');
    
    // 保存原始响应
    const responseFile = path.join(testDir, 'direct-api-test-response.bin');
    fs.writeFileSync(responseFile, response.data);
    console.log('💾 原始响应已保存:', responseFile);

    // 尝试解析响应
    console.log('\n🔍 尝试解析响应...');
    await tryParseResponse(response.data, testDir);

  } catch (error) {
    console.log('❌ 直接API测试失败:', error.message);
    if (error.code === 'ENOTFOUND') {
      console.log('   网络错误：无法连接到CodeWhisperer服务');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('   连接被拒绝：可能是认证问题');
    }
  }
}

async function tryParseResponse(binaryData, outputDir) {
  if (binaryData.length === 0) {
    console.log('❌ 响应为空，没有数据可解析');
    return;
  }

  try {
    // 尝试多种解析方法
    console.log('方法1: 直接解析为文本');
    const textData = binaryData.toString('utf8');
    console.log('   文本内容 (前200字符):', textData.substring(0, 200));
    
    // 保存文本版本
    const textFile = path.join(outputDir, 'direct-api-test-response.txt');
    fs.writeFileSync(textFile, textData);
    console.log('   文本响应已保存:', textFile);

    // 检查是否是SSE格式
    if (textData.includes('event:') && textData.includes('data:')) {
      console.log('✅ 检测到SSE格式响应');
      parseSSEResponse(textData, outputDir);
    } else if (textData.trim().startsWith('{')) {
      console.log('✅ 检测到JSON格式响应');
      try {
        const jsonData = JSON.parse(textData);
        console.log('   JSON内容:', JSON.stringify(jsonData, null, 2));
      } catch (e) {
        console.log('❌ JSON解析失败:', e.message);
      }
    } else {
      console.log('⚠️ 未知响应格式');
      console.log('   响应开头:', textData.substring(0, 50));
      console.log('   响应长度:', textData.length);
    }

  } catch (error) {
    console.log('❌ 响应解析失败:', error.message);
  }
}

function parseSSEResponse(sseText, outputDir) {
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

  console.log(`📨 解析出 ${events.length} 个SSE事件:`);
  events.forEach((event, index) => {
    console.log(`   ${index + 1}. ${event.event} - ${JSON.stringify(event.data).substring(0, 50)}...`);
  });

  // 保存解析后的事件
  const eventsFile = path.join(outputDir, 'direct-api-test-events.json');
  fs.writeFileSync(eventsFile, JSON.stringify(events, null, 2));
  console.log('📋 SSE事件已保存:', eventsFile);

  return events;
}

async function compareDemoImplementation() {
  const demo2Path = path.join(__dirname, '../examples/demo2');
  
  if (!fs.existsSync(demo2Path)) {
    console.log('❌ demo2目录不存在，无法对比');
    return;
  }

  console.log('📚 对比demo2实现差异...');
  
  // 检查关键文件
  const keyFiles = [
    'src/client/codewhisperer-client.ts',
    'src/parsers/sse-parser.ts',
    'src/auth/codewhisperer-auth.ts'
  ];

  keyFiles.forEach(file => {
    const fullPath = path.join(demo2Path, file);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ 找到参考文件: ${file}`);
    } else {
      console.log(`❌ 参考文件不存在: ${file}`);
    }
  });

  console.log('\n💡 建议对比要点:');
  console.log('   1. Token获取和使用方式');
  console.log('   2. API请求构建和发送');
  console.log('   3. 二进制响应解析逻辑'); 
  console.log('   4. SSE事件处理机制');
}

// 运行分析
if (require.main === module) {
  analyzeCodeWhispererAPI().catch(console.error);
}

module.exports = { analyzeCodeWhispererAPI };