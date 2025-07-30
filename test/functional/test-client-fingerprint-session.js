#!/usr/bin/env node

/**
 * 客户端指纹会话识别测试
 * 测试基于客户端特征的多轮会话识别功能，模拟Claude Code的行为
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

async function testClientFingerprintSession() {
  console.log('🔍 测试客户端指纹会话识别功能...\n');

  const baseUrl = 'http://127.0.0.1:3456';
  
  // 模拟Claude Code的headers（不包含session ID）
  const claudeCodeHeaders = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'Authorization': 'Bearer ${ANTHROPIC_API_KEY}',
    'x-app': 'cli',
    'user-agent': 'claude-cli/1.0.56 (external, cli)',
    'x-stainless-package-version': '0.55.1',
    'x-stainless-os': 'MacOS',
    'x-stainless-arch': 'arm64',
    'x-stainless-runtime': 'node',
    'x-stainless-runtime-version': 'v22.16.0',
    'anthropic-dangerous-direct-browser-access': 'true'
  };

  console.log('📋 测试配置:');
  console.log(`   基础URL: ${baseUrl}`);
  console.log(`   模拟客户端: Claude Code CLI`);
  console.log(`   测试方式: 不发送session headers，依赖客户端指纹识别`);

  const testMessages = [
    {
      turn: 1,
      content: "Hello, I'm testing multi-turn conversation without session headers. Please remember that my name is Alice.",
      expectedBehavior: "应该创建新会话并记住Alice这个名字"
    },
    {
      turn: 2,
      content: "What is my name that I just told you?",
      expectedBehavior: "应该能够识别同一会话并回答Alice"
    },
    {
      turn: 3,
      content: "Can you create a simple greeting for me using my name?",
      expectedBehavior: "应该继续使用之前会话中的Alice这个名字"
    }
  ];

  const results = [];

  try {
    console.log('\n🔄 开始多轮对话测试...\n');

    for (const testMessage of testMessages) {
      console.log(`🔹 第 ${testMessage.turn} 轮对话:`);
      console.log(`   消息: ${testMessage.content}`);
      console.log(`   期望: ${testMessage.expectedBehavior}`);

      const response = await sendMessage(baseUrl, claudeCodeHeaders, testMessage.content);
      
      const responseStr = String(response || '');
      console.log(`   响应长度: ${responseStr.length} 字符`);
      console.log(`   响应预览: ${responseStr.substring(0, 100)}...`);

      results.push({
        turn: testMessage.turn,
        message: testMessage.content,
        response: responseStr,
        responseLength: responseStr.length,
        expectedBehavior: testMessage.expectedBehavior
      });

      // 短暂延迟模拟用户思考时间
      await sleep(2000);
    }

    // 分析结果
    console.log('\n📊 测试结果分析:');
    
    const turn1Response = String(results[0].response || '');
    const turn2Response = String(results[1].response || '');
    const turn3Response = String(results[2].response || '');

    // 检查是否保持了会话上下文
    const mentionsAliceInTurn2 = turn2Response.toLowerCase().includes('alice');
    const mentionsAliceInTurn3 = turn3Response.toLowerCase().includes('alice');
    const hasGreetingInTurn3 = turn3Response.toLowerCase().includes('hello') || 
                               turn3Response.toLowerCase().includes('hi') || 
                               turn3Response.toLowerCase().includes('greeting');

    console.log(`   第1轮响应包含确认: ${turn1Response.length > 10}`);
    console.log(`   第2轮响应提到Alice: ${mentionsAliceInTurn2}`);
    console.log(`   第3轮响应提到Alice: ${mentionsAliceInTurn3}`);
    console.log(`   第3轮响应包含问候: ${hasGreetingInTurn3}`);

    const contextPreservation = mentionsAliceInTurn2 && mentionsAliceInTurn3;
    const functionalityWorking = contextPreservation && hasGreetingInTurn3;

    console.log(`\n🎯 会话上下文保持: ${contextPreservation ? '✅ 成功' : '❌ 失败'}`);
    console.log(`🎯 整体功能状态: ${functionalityWorking ? '✅ 正常' : '❌ 异常'}`);

    // 保存测试结果
    const testResults = {
      timestamp: new Date().toISOString(),
      testType: 'client-fingerprint-session',
      clientType: 'claude-code-cli-simulation',
      totalTurns: testMessages.length,
      contextPreservation: contextPreservation,
      functionalityWorking: functionalityWorking,
      turns: results,
      analysis: {
        mentionsAliceInTurn2,
        mentionsAliceInTurn3,
        hasGreetingInTurn3
      }
    };

    const resultFile = path.join(__dirname, 'debug', 'debug-output', `client-fingerprint-session-${Date.now()}.json`);
    const resultDir = path.dirname(resultFile);
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }
    fs.writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 详细结果已保存: ${resultFile}`);

    if (functionalityWorking) {
      console.log('\n🎉 客户端指纹会话识别测试成功！');
      console.log('✅ Claude Code多轮对话问题已解决');
      console.log('✅ 无需session headers即可维持会话状态');
      console.log('✅ 基于客户端特征的指纹识别工作正常');
      return true;
    } else {
      console.log('\n❌ 客户端指纹会话识别测试失败');
      console.log('❌ 多轮对话上下文未能正确保持');
      return false;
    }

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    return false;
  }
}

async function sendMessage(baseUrl, headers, message) {
  const requestBody = {
    model: 'claude-3-5-haiku-20241022', // Use background category to route to working provider
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: message
    }],
    stream: false
  };

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || data.content || JSON.stringify(data);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
if (require.main === module) {
  testClientFingerprintSession()
    .then(success => {
      console.log(`\n${success ? '🎊 客户端指纹会话识别功能正常!' : '❌ 客户端指纹会话识别功能异常'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { testClientFingerprintSession };