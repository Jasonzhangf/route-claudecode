#!/usr/bin/env node

/**
 * 真实场景验证测试
 * 模拟实际Claude Code使用场景的多轮对话
 * 项目所有者: Jason Zhang
 */

async function verifyRealScenario() {
  console.log('🎯 验证真实多轮会话场景...\n');

  const baseUrl = 'http://127.0.0.1:3456';
  const sessionId = `real-scenario-${Date.now()}`;
  
  console.log(`会话ID: ${sessionId}`);

  const scenario = [
    {
      turn: 1,
      role: 'user',
      message: 'Hello, I need help with implementing a function to calculate fibonacci numbers.',
      expectation: '响应应该提供fibonacci实现或询问具体需求'
    },
    {
      turn: 2,
      role: 'user', 
      message: 'I want it to be iterative, not recursive. Can you show me the code?',
      expectation: '应该基于第一轮的context，提供iterative实现'
    },
    {
      turn: 3,
      role: 'user',
      message: 'Thanks! Now can you explain how the algorithm works step by step?',
      expectation: '应该解释刚才提供的算法，体现对前面代码的记忆'
    }
  ];

  const results = [];

  try {
    for (const step of scenario) {
      console.log(`\n第${step.turn}轮：`);
      console.log(`用户: ${step.message}`);
      
      const response = await sendMessage(baseUrl, sessionId, step.message);
      const responsePreview = response.substring(0, 100);
      
      console.log(`助手: ${responsePreview}${response.length > 100 ? '...' : ''}`);
      console.log(`长度: ${response.length} 字符`);
      
      // 基本验证：非空响应
      const hasResponse = response.length > 20;
      console.log(`响应状态: ${hasResponse ? '✅' : '❌'}`);
      
      results.push({
        turn: step.turn,
        message: step.message,
        response: response,
        responseLength: response.length,
        hasResponse: hasResponse,
        expectation: step.expectation
      });

      await sleep(1500);
    }

    // 分析整体会话质量
    console.log('\n📊 会话质量分析:');
    const allResponded = results.every(r => r.hasResponse);
    const avgLength = results.reduce((sum, r) => sum + r.responseLength, 0) / results.length;
    
    console.log(`所有轮次响应: ${allResponded ? '✅' : '❌'}`);
    console.log(`平均响应长度: ${Math.round(avgLength)} 字符`);
    
    // 检查上下文连贯性（简单的关键词检查）
    const turn2HasContext = results[1].response.toLowerCase().includes('iterative') || 
                           results[1].response.toLowerCase().includes('fibonacci');
    const turn3HasContext = results[2].response.toLowerCase().includes('algorithm') ||
                           results[2].response.toLowerCase().includes('step') ||
                           results[2].response.toLowerCase().includes('fibonacci');
    
    console.log(`第2轮上下文: ${turn2HasContext ? '✅' : '❌'}`);
    console.log(`第3轮上下文: ${turn3HasContext ? '✅' : '❌'}`);
    
    const contextuality = turn2HasContext && turn3HasContext;
    const overall = allResponded && contextuality && avgLength > 50;
    
    console.log(`\n总体评估: ${overall ? '✅ 多轮会话质量良好' : '❌ 多轮会话存在问题'}`);
    
    // 保存结果
    const testResults = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      scenario: 'fibonacci_implementation',
      turns: results.length,
      allResponded: allResponded,
      averageLength: avgLength,
      contextuality: contextuality,
      overall: overall,
      conversation: results
    };

    const fs = require('fs');
    const path = require('path');
    const resultFile = path.join(__dirname, 'debug', 'debug-output', `real-scenario-${sessionId}.json`);
    const resultDir = path.dirname(resultFile);
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }
    fs.writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 验证结果已保存: ${resultFile}`);

    return overall;

  } catch (error) {
    console.error('\n❌ 验证失败:', error.message);
    return false;
  }
}

async function sendMessage(baseUrl, sessionId, message) {
  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'Authorization': 'Bearer test-key',
      'x-session-id': sessionId
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 400,
      messages: [{ role: 'user', content: message }],
      stream: true
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const eventData = JSON.parse(line.substring(6));
          if (eventData.type === 'content_block_delta' && eventData.delta && eventData.delta.text) {
            fullResponse += eventData.delta.text;
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }

  return fullResponse;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  verifyRealScenario()
    .then(success => {
      console.log(`\n${success ? '✅ 真实场景验证通过' : '❌ 真实场景验证失败'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { verifyRealScenario };