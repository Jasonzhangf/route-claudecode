#!/usr/bin/env node

const axios = require('axios');

async function monitor400Errors() {
  console.log('📡 Monitoring for CodeWhisperer 400 Errors...');
  console.log('This will continuously test different scenarios to catch 400 errors');
  console.log('Press Ctrl+C to stop\n');

  let testCount = 0;
  let errorCount = 0;
  let error400Count = 0;

  const testScenarios = [
    {
      name: 'Simple text',
      request: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false
      }
    },
    {
      name: 'Long content',
      request: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{ 
          role: 'user', 
          content: 'This is a longer message that might trigger different behavior. '.repeat(50)
        }],
        stream: false
      }
    },
    {
      name: 'With tools',
      request: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'Write hello to a file' }],
        tools: [{
          name: 'Write',
          description: 'Write content to a file',
          input_schema: {
            type: 'object',
            properties: {
              file_path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['file_path', 'content']
          }
        }],
        stream: false
      }
    },
    {
      name: 'Multi-turn conversation',
      request: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi! How can I help you?' },
          { role: 'user', content: 'What is 2+2?' }
        ],
        stream: false
      }
    },
    {
      name: 'Streaming request',
      request: {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Count from 1 to 5' }],
        stream: true
      }
    }
  ];

  const runTest = async () => {
    const scenario = testScenarios[testCount % testScenarios.length];
    testCount++;
    
    const timestamp = new Date().toISOString();
    
    try {
      const startTime = Date.now();
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
        'anthropic-version': '2023-06-01'
      };
      
      if (scenario.request.stream) {
        headers['Accept'] = 'text/event-stream';
      }
      
      const response = await axios.post('http://127.0.0.1:3456/v1/messages', scenario.request, {
        headers,
        timeout: 30000,
        responseType: scenario.request.stream ? 'stream' : 'json'
      });

      const duration = Date.now() - startTime;
      
      if (scenario.request.stream) {
        // For streaming, just check if we got a response
        console.log(`✅ [${timestamp}] Test ${testCount} (${scenario.name}) - SUCCESS (${duration}ms) - Stream started`);
        response.data.destroy(); // Close stream
      } else {
        console.log(`✅ [${timestamp}] Test ${testCount} (${scenario.name}) - SUCCESS (${duration}ms)`);
      }
      
    } catch (error) {
      errorCount++;
      
      console.log(`❌ [${timestamp}] Test ${testCount} (${scenario.name}) - FAILED`);
      
      if (error.response) {
        console.log(`   HTTP ${error.response.status}: ${error.response.statusText}`);
        
        if (error.response.status === 400) {
          error400Count++;
          console.log('   🚨 400 BAD REQUEST DETECTED!');
          console.log(`   Request: ${JSON.stringify(scenario.request, null, 2)}`);
          
          if (error.response.data) {
            console.log(`   Error Response: ${JSON.stringify(error.response.data, null, 2)}`);
          }
          
          // 分析可能的原因
          console.log('   🔍 Possible causes:');
          if (scenario.request.messages && scenario.request.messages.length > 1) {
            console.log('   - Multi-turn conversation handling issue');
          }
          if (scenario.request.tools) {
            console.log('   - Tool specification problem');
          }
          if (scenario.request.stream) {
            console.log('   - Streaming request format issue');
          }
          if (JSON.stringify(scenario.request).length > 10000) {
            console.log('   - Request size too large');
          }
        }
      } else if (error.code === 'ECONNREFUSED') {
        console.log('   Server not running');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('   Request timeout');
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
    
    console.log(`   Stats: ${testCount - errorCount}/${testCount} success, ${error400Count} 400-errors\n`);
  };

  // 立即运行第一次测试
  await runTest();
  
  // 然后每5秒运行一次
  const interval = setInterval(runTest, 5000);
  
  // 优雅退出
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n📊 Final Statistics:');
    console.log(`   Total tests: ${testCount}`);
    console.log(`   Successes: ${testCount - errorCount}`);
    console.log(`   Total errors: ${errorCount}`);
    console.log(`   400 errors: ${error400Count}`);
    console.log(`   Success rate: ${((testCount - errorCount)/testCount*100).toFixed(1)}%`);
    console.log(`   400 error rate: ${(error400Count/testCount*100).toFixed(1)}%`);
    process.exit(0);
  });
}

monitor400Errors().catch(console.error);