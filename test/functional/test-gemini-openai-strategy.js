#!/usr/bin/env node
/**
 * Test: Gemini使用OpenAI缓冲流式策略
 * Purpose: 验证Gemini provider使用OpenAI风格的缓冲处理而非直接流式策略
 * Expected: 正确的token计算和事件输出
 */

const http = require('http');

console.log('🧪 Testing Gemini OpenAI buffered strategy...');

async function testGeminiOpenAIStrategy() {
  return new Promise((resolve) => {
    console.log('\n🌐 Testing Gemini via API with OpenAI strategy...');
    
    const requestData = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      messages: [
        {
          role: "user", 
          content: "请写一段关于人工智能发展的详细介绍，包含深度学习、大语言模型等重要概念。要求内容丰富，至少500字。这是一个长上下文测试，目的是触发longcontext路由类别，从而使用google-gemini provider。"
        }
      ],
      max_tokens: 1000,
      stream: true
    });

    const options = {
      hostname: '0.0.0.0',
      port: 8888,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData),
        'x-api-key': 'test-key'
      },
      timeout: 45000
    };

    const req = http.request(options, (res) => {
      let data = '';
      let eventCount = 0;
      let contentReceived = '';
      let outputTokens = 0;
      let finalUsage = null;
      let isUsingGemini = false;
      let strategyUsed = 'unknown';

      console.log('📡 Response status:', res.statusCode);

      res.on('data', (chunk) => {
        data += chunk.toString();
        
        // Parse streaming events
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.startsWith('event: ') && line.includes('content_block_delta')) {
            eventCount++;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              
              // Check for content
              if (eventData.delta && eventData.delta.text) {
                contentReceived += eventData.delta.text;
              }
              
              // Check for usage info
              if (eventData.usage && eventData.usage.output_tokens) {
                outputTokens = eventData.usage.output_tokens;
                finalUsage = eventData.usage;
              }
              
              // Check if this is from Gemini (model name in message_start)
              if (eventData.message && eventData.message.model) {
                if (eventData.message.model.includes('gemini')) {
                  isUsingGemini = true;
                }
              }
            } catch (e) {
              // Ignore parse errors for streaming data
            }
          }
        }
      });

      res.on('end', () => {
        console.log('📊 Test results:', {
          statusCode: res.statusCode,
          eventCount: eventCount,
          contentLength: contentReceived.length,
          outputTokens: outputTokens,
          hasContent: contentReceived.length > 0,
          isUsingGemini: isUsingGemini,
          finalUsage: finalUsage
        });
        
        // Success criteria:
        // 1. Status 200
        // 2. Events received
        // 3. Content received
        // 4. Output tokens > 0 (indicating proper processing)
        if (res.statusCode === 200 && 
            eventCount > 0 && 
            contentReceived.length > 0 && 
            outputTokens > 0) {
          console.log('✅ Gemini OpenAI strategy test PASSED');
          console.log(`📈 Key metrics: ${eventCount} events, ${contentReceived.length} chars, ${outputTokens} tokens`);
          resolve(true);
        } else {
          console.log('❌ Gemini OpenAI strategy test FAILED');
          console.log('❗ Issues found:');
          if (res.statusCode !== 200) console.log(`  - Bad status: ${res.statusCode}`);
          if (eventCount === 0) console.log('  - No events received');
          if (contentReceived.length === 0) console.log('  - No content received');
          if (outputTokens === 0) console.log('  - Zero output tokens (main issue)');
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Request error:', error.code);
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('⏰ Request timeout');
      req.destroy();
      resolve(false);
    });

    req.write(requestData);
    req.end();
  });
}

// Main test execution
async function runTest() {
  const startTime = Date.now();
  
  console.log('🏁 Starting Gemini OpenAI strategy test...\n');
  
  // Wait a moment for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const testPassed = await testGeminiOpenAIStrategy();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log('\n📋 Test Summary:');
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`🔧 Gemini OpenAI Strategy: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (testPassed) {
    console.log('\n🎉 EXCELLENT: Gemini is now using OpenAI buffered strategy!');
    console.log('📈 This should resolve the outputTokens=0 issue');
    process.exit(0);
  } else {
    console.log('\n❌ FAILED: Gemini OpenAI strategy needs more work');
    console.log('💡 Check server logs for detailed processing information');
    process.exit(1);
  }
}

runTest().catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});