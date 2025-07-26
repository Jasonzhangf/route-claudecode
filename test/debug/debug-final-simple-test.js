#!/usr/bin/env node

/**
 * 简化的最终端到端测试
 * 验证集成AWS二进制解析器后的完整路由器功能
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

async function finalSimpleTest() {
  console.log('🎯 简化的最终端到端测试 - 验证AWS二进制解析器修复...\n');

  const requestId = `final-simple-${Date.now()}`;

  try {
    // Test request
    const testRequest = {
      method: 'POST',
      url: 'http://127.0.0.1:3456/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'Authorization': 'Bearer any-string-is-ok'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: 'Say "Hello World" to test the AWS binary parser fix.'
        }],
        stream: true
      })
    };

    console.log('📋 测试配置:');
    console.log(`   URL: ${testRequest.url}`);
    console.log(`   模型: claude-3-5-sonnet-20241022`);
    console.log(`   消息: 测试AWS二进制解析器修復`);

    // Make request
    console.log('\n🚀 发送请求...');
    const response = await fetch(testRequest.url, {
      method: testRequest.method,
      headers: testRequest.headers,
      body: testRequest.body
    });

    console.log(`📡 响应状态: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log('❌ 请求失败:', response.status, response.statusText);
      return false;
    }

    // Read streaming response
    console.log('\n📥 读取流式响应...');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let contentParts = [];
    let eventCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;

      // Parse events
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          eventCount++;
          try {
            const eventData = JSON.parse(line.substring(6));
            if (eventData.type === 'content_block_delta' && 
                eventData.delta && eventData.delta.text) {
              contentParts.push(eventData.delta.text);
              process.stdout.write(eventData.delta.text);
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
    }

    console.log('\n');

    // Analyze results
    const reconstructedMessage = contentParts.join('');
    
    console.log('📊 测试结果:');
    console.log(`   总事件数: ${eventCount}`);
    console.log(`   内容片段数: ${contentParts.length}`);
    console.log(`   重构消息: "${reconstructedMessage}"`);
    console.log(`   消息长度: ${reconstructedMessage.length} 字符`);

    // Save results
    const testResults = {
      timestamp: new Date().toISOString(),
      requestId: requestId,
      success: reconstructedMessage.length > 0,
      totalEvents: eventCount,
      contentParts: contentParts.length,
      reconstructedMessage: reconstructedMessage,
      messageLength: reconstructedMessage.length,
      verification: {
        hasContent: reconstructedMessage.length > 0,
        notEmpty: !reconstructedMessage.includes('Error'),
        reasonableLength: reconstructedMessage.length > 5
      }
    };

    const resultFile = path.join(__dirname, 'debug-output', `final-simple-test-${requestId}.json`);
    if (!fs.existsSync(path.dirname(resultFile))) {
      fs.mkdirSync(path.dirname(resultFile), { recursive: true });
    }
    fs.writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 测试结果已保存: ${resultFile}`);

    // Final verification
    console.log('\n🔍 验证结果:');
    const success = testResults.verification.hasContent && 
                   testResults.verification.notEmpty && 
                   testResults.verification.reasonableLength;

    if (success) {
      console.log('✅ 有内容输出');
      console.log('✅ 非错误响应');
      console.log('✅ 合理消息长度');
      console.log('\n🎉 最终测试成功！');
      console.log('✅ AWS二进制事件流解析器修復验证有效！');
      console.log('✅ CodeWhisperer空响应问题已彻底解决！');
      return true;
    } else {
      console.log('❌ 测试验证失败');
      console.log(`   有内容: ${testResults.verification.hasContent}`);
      console.log(`   非错误: ${testResults.verification.notEmpty}`);
      console.log(`   合理长度: ${testResults.verification.reasonableLength}`);
      return false;
    }

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  finalSimpleTest()
    .then(success => {
      console.log(`\n${success ? '🎊 最终测试通过 - AWS二进制解析器修復成功!' : '❌ 最终测试失败'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { finalSimpleTest };