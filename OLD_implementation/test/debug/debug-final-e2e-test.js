#!/usr/bin/env node

/**
 * 最终端到端测试
 * 验证集成AWS二进制解析器后的完整路由器功能
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const { DebugNodeDataCapture } = require('./debug-node-data-capture');

async function finalE2ETest() {
  console.log('🎯 最终端到端测试 - 验证AWS二进制解析器修复...\n');

  const debug = new DebugNodeDataCapture();
  const requestId = `final-e2e-${Date.now()}`;

  try {
    // Create a test request mimicking Claude Code
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
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: 'Hello, this is a test to verify the AWS binary parser fix works correctly.'
        }],
        stream: true
      })
    };

    console.log('📋 测试请求配置:');
    console.log(`   方法: ${testRequest.method}`);
    console.log(`   URL: ${testRequest.url}`);
    console.log(`   模型: claude-3-5-sonnet-20241022`);
    console.log(`   消息: 测试AWS二进制解析器修復`);

    // Capture initial request
    debug.captureNodeData('final-e2e-request', requestId, testRequest, null, {
      stage: 'initial_request',
      timestamp: new Date().toISOString()
    });

    // Make the request using fetch
    console.log('\n🚀 发送请求到路由器...');
    const response = await fetch(testRequest.url, {
      method: testRequest.method,
      headers: testRequest.headers,
      body: testRequest.body
    });

    console.log(`📡 响应状态: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Capture response headers
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    debug.captureNodeData('final-e2e-response-headers', requestId, responseHeaders, null, {
      stage: 'response_headers',
      status: response.status,
      statusText: response.statusText
    });

    // Read streaming response
    console.log('\n📥 读取流式响应...');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let eventCount = 0;
    let contentEvents = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;

      // Parse SSE events
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          eventCount++;
          try {
            const eventData = JSON.parse(line.substring(6));
            if (eventData.type === 'content_block_delta' && 
                eventData.delta && eventData.delta.text) {
              contentEvents.push({
                event: eventCount,
                text: eventData.delta.text,
                timestamp: new Date().toISOString()
              });
              console.log(`   事件 ${eventCount}: "${eventData.delta.text}"`);
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
    }

    // Capture final response
    debug.captureNodeData('final-e2e-full-response', requestId, {
      fullResponse,
      eventCount,
      contentEvents
    }, null, {
      stage: 'final_response',
      responseLength: fullResponse.length
    });

    // Reconstruct message
    const reconstructedMessage = contentEvents.map(e => e.text).join('');
    
    console.log('\n📊 测试结果:');
    console.log(`   总事件数: ${eventCount}`);
    console.log(`   内容事件数: ${contentEvents.length}`);
    console.log(`   重构消息长度: ${reconstructedMessage.length} 字符`);
    console.log(`   消息预览: "${reconstructedMessage.substring(0, 100)}${reconstructedMessage.length > 100 ? '...' : ''}"`);

    // Verification
    console.log('\n🔍 验证结果:');
    
    const hasContent = reconstructedMessage.length > 0;
    const isNotEmpty = !reconstructedMessage.includes('Error parsing response');
    const hasReasonableLength = reconstructedMessage.length > 10;
    
    console.log(`   ✅ 有内容: ${hasContent}`);
    console.log(`   ✅ 非错误响应: ${isNotEmpty}`);
    console.log(`   ✅ 合理长度: ${hasReasonableLength}`);

    // Save comprehensive test results
    const testResults = {
      timestamp: new Date().toISOString(),
      requestId: requestId,
      testRequest: testRequest,
      responseStatus: response.status,
      responseHeaders: responseHeaders,
      totalEvents: eventCount,
      contentEvents: contentEvents.length,
      reconstructedMessage: reconstructedMessage,
      messageLength: reconstructedMessage.length,
      fullResponse: fullResponse,
      success: hasContent && isNotEmpty && hasReasonableLength,
      verification: {
        hasContent,
        isNotEmpty,
        hasReasonableLength
      }
    };

    const resultFile = path.join(__dirname, 'debug-output', `final-e2e-test-${requestId}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 完整测试结果已保存: ${resultFile}`);

    // Final verdict
    if (testResults.success) {
      console.log('\n🎉 最终端到端测试成功！');
      console.log('✅ AWS二进制事件流解析器修復已验证有效！');
      console.log('✅ CodeWhisperer空响应问题已解决！');
      return true;
    } else {
      console.log('\n❌ 最终端到端测试失败');
      console.log('❌ 需要进一步调试');
      return false;
    }

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    
    debug.captureNodeData('final-e2e-error', requestId, null, error.message, {
      stage: 'error',
      errorType: error.constructor.name,
      stack: error.stack
    });

    return false;
  }
}

// 运行测试
if (require.main === module) {
  finalE2ETest()
    .then(success => {
      console.log(`\n${success ? '✅ 最终测试通过 - 修复验证成功!' : '❌ 最终测试失败'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { finalE2ETest };