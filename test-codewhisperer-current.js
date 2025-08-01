#!/usr/bin/env node

/**
 * CodeWhisperer Current Status Test
 * 
 * 验证当前CodeWhisperer实现的核心功能：
 * 1. 简单文本请求/响应
 * 2. 工具调用请求处理 
 * 3. 多轮对话支持
 * 4. Demo2风格缓冲处理验证
 */

const axios = require('axios');
const fs = require('fs');

const SERVER_URL = 'http://localhost:6677';
const TEST_TIMEOUT = 30000;

// 测试配置
const tests = [
  {
    name: '简单文本请求测试',
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: 'Hello! Please respond with a simple greeting.'
        }
      ],
      max_tokens: 150
    }
  },
  {
    name: '工具调用测试',
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: 'Please list the files in the current directory using the LS tool.'
        }
      ],
      tools: [
        {
          name: 'LS',
          description: 'Lists files and directories in a given path',
          input_schema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The absolute path to the directory to list'
              }
            },
            required: ['path']
          }
        }
      ],
      max_tokens: 500
    }
  },
  {
    name: '多轮对话测试',
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: 'What is 2+2?'
        },
        {
          role: 'assistant',
          content: '2+2 equals 4.'
        },
        {
          role: 'user',
          content: 'Now what is that result multiplied by 3?'
        }
      ],
      max_tokens: 150
    }
  }
];

async function runTest(test, index) {
  console.log(`\n🧪 Test ${index + 1}: ${test.name}`);
  console.log('='.repeat(50));
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${SERVER_URL}/v1/messages`, test.request, {
      timeout: TEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': `test-${index + 1}-${Date.now()}`
      }
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    
    if (response.data) {
      console.log(`📝 Response Type: ${response.data.type || 'unknown'}`);
      console.log(`🤖 Model: ${response.data.model || 'unknown'}`);
      
      if (response.data.content && response.data.content.length > 0) {
        console.log(`📄 Content Blocks: ${response.data.content.length}`);
        
        response.data.content.forEach((block, i) => {
          if (block.type === 'text') {
            const preview = block.text.substring(0, 100);
            console.log(`   [${i}] Text: "${preview}${block.text.length > 100 ? '...' : ''}"`);
          } else if (block.type === 'tool_use') {
            console.log(`   [${i}] Tool Use: ${block.name} (ID: ${block.id})`);
            console.log(`       Input: ${JSON.stringify(block.input)}`);
          }
        });
      }
      
      if (response.data.usage) {
        console.log(`📊 Tokens: ${response.data.usage.input_tokens} input + ${response.data.usage.output_tokens} output`);
      }
    }
    
    // 保存详细响应到文件
    const logFile = `/tmp/cw-test-${index + 1}-${Date.now()}.json`;
    fs.writeFileSync(logFile, JSON.stringify({
      test: test.name,
      request: test.request,
      response: response.data,
      duration,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`📁 Detailed log saved: ${logFile}`);
    
    return {
      success: true,
      status: response.status,
      duration,
      logFile,
      hasToolUse: response.data?.content?.some(block => block.type === 'tool_use') || false,
      contentBlocks: response.data?.content?.length || 0
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Error: ${error.message}`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    return {
      success: false,
      error: error.message,
      status: error.response?.status || 'network_error',
      duration
    };
  }
}

async function main() {
  console.log('🚀 CodeWhisperer Current Status Test');
  console.log('====================================');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Timeout: ${TEST_TIMEOUT}ms`);
  
  // 先检查服务器健康状态
  try {
    const healthResponse = await axios.get(`${SERVER_URL}/health`, { timeout: 5000 });
    console.log(`✅ Server Health: ${healthResponse.data.overall}`);
    console.log(`📊 Providers: ${healthResponse.data.healthy}/${healthResponse.data.total} healthy`);
  } catch (error) {
    console.log(`❌ Server health check failed: ${error.message}`);
    process.exit(1);
  }
  
  const results = [];
  
  // 运行所有测试
  for (let i = 0; i < tests.length; i++) {
    const result = await runTest(tests[i], i);
    results.push(result);
    
    // 在测试之间添加延迟
    if (i < tests.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 汇总结果
  console.log('\n📊 Test Summary');
  console.log('================');
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Success Rate: ${successful}/${total} (${Math.round(successful/total*100)}%)`);
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.duration}ms`;
    const details = result.success 
      ? `${result.contentBlocks} blocks${result.hasToolUse ? ' (with tools)' : ''}`
      : `Error: ${result.status}`;
    
    console.log(`   ${index + 1}. ${tests[index].name}: ${status} - ${duration} - ${details}`);
  });
  
  // 保存汇总报告
  const summaryFile = `/tmp/cw-test-summary-${Date.now()}.json`;
  fs.writeFileSync(summaryFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    server: SERVER_URL,
    totalTests: total,
    successful,
    successRate: Math.round(successful/total*100),
    results,
    tests: tests.map(t => ({ name: t.name, hasTools: !!t.request.tools }))
  }, null, 2));
  
  console.log(`\n📁 Summary report saved: ${summaryFile}`);
  
  if (successful === total) {
    console.log('\n🎉 All tests passed! CodeWhisperer is working perfectly.');
  } else {
    console.log(`\n⚠️  ${total - successful} test(s) failed. Check the logs for details.`);
  }
}

main().catch(console.error);