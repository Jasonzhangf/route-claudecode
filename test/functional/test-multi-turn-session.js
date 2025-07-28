#!/usr/bin/env node

/**
 * 多轮会话功能测试
 * 验证会话管理和上下文保持功能
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

async function testMultiTurnSession() {
  console.log('🧪 测试多轮会话功能...\n');

  const baseUrl = 'http://127.0.0.1:3456';
  const sessionId = `test-session-${Date.now()}`;
  
  console.log(`📋 会话配置:`);
  console.log(`   基础URL: ${baseUrl}`);
  console.log(`   会话ID: ${sessionId}`);
  console.log(`   模型: claude-3-5-sonnet-20241022`);

  const conversations = [
    {
      turn: 1,
      message: "我的名字是张三，请记住我的名字。",
      expectsInResponse: ["张三"]
    },
    {
      turn: 2, 
      message: "你还记得我的名字吗？",
      expectsInResponse: ["张三"]
    },
    {
      turn: 3,
      message: "我喜欢吃苹果。现在告诉我，我的名字和我喜欢吃什么？",
      expectsInResponse: ["张三", "苹果"]
    }
  ];

  const results = [];

  try {
    for (const conversation of conversations) {
      console.log(`\n💬 第 ${conversation.turn} 轮对话:`);
      console.log(`   用户: ${conversation.message}`);

      const requestBody = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: conversation.message
        }],
        stream: true
      };

      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'Authorization': 'Bearer test-key',
        'x-session-id': sessionId  // 关键：传递会话ID
      };

      console.log(`   请求头包含会话ID: ${sessionId}`);

      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 读取流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';
      let eventCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            eventCount++;
            try {
              const eventData = JSON.parse(line.substring(6));
              if (eventData.type === 'content_block_delta' &&
                  eventData.delta && eventData.delta.text) {
                assistantResponse += eventData.delta.text;
                process.stdout.write(eventData.delta.text);
              }
            } catch (e) {
              // 忽略非JSON数据
            }
          }
        }
      }

      console.log('\n');

      // 验证响应是否包含期望的内容
      const turnResult = {
        turn: conversation.turn,
        userMessage: conversation.message,
        assistantResponse: assistantResponse,
        eventCount: eventCount,
        expectations: conversation.expectsInResponse,
        passed: true,
        missingExpectations: []
      };

      for (const expectation of conversation.expectsInResponse) {
        if (!assistantResponse.includes(expectation)) {
          turnResult.passed = false;
          turnResult.missingExpectations.push(expectation);
        }
      }

      results.push(turnResult);

      console.log(`   助手: ${assistantResponse}`);
      console.log(`   事件数: ${eventCount}`);
      console.log(`   验证: ${turnResult.passed ? '✅ 通过' : '❌ 失败'}`);
      
      if (!turnResult.passed) {
        console.log(`   缺失期望内容: ${turnResult.missingExpectations.join(', ')}`);
      }

      // 短暂延迟，模拟真实对话间隔
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 分析测试结果
    console.log('\n📊 测试结果分析:');
    const passedTurns = results.filter(r => r.passed).length;
    const totalTurns = results.length;
    
    console.log(`   总对话轮数: ${totalTurns}`);
    console.log(`   通过轮数: ${passedTurns}`);
    console.log(`   通过率: ${Math.round(passedTurns / totalTurns * 100)}%`);

    // 保存详细结果
    const testResults = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      totalTurns: totalTurns,
      passedTurns: passedTurns,
      passRate: passedTurns / totalTurns,
      conversations: results,
      success: passedTurns === totalTurns
    };

    const resultFile = path.join(__dirname, 'debug', 'debug-output', `multi-turn-test-${sessionId}.json`);
    const resultDir = path.dirname(resultFile);
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }
    fs.writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 详细结果已保存: ${resultFile}`);

    // 最终判断
    if (testResults.success) {
      console.log('\n🎉 多轮会话测试成功！');
      console.log('✅ 会话上下文正确保持');
      console.log('✅ 历史信息正确记忆');
      console.log('✅ 跨请求状态管理正常');
      return true;
    } else {
      console.log('\n❌ 多轮会话测试失败');
      console.log('❌ 会话管理存在问题');
      console.log(`❌ ${totalTurns - passedTurns} 轮对话未通过验证`);
      return false;
    }

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testMultiTurnSession()
    .then(success => {
      console.log(`\n${success ? '✅ 多轮会话功能正常' : '❌ 多轮会话功能异常'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { testMultiTurnSession };