#!/usr/bin/env node
/**
 * 🔍 检查工具调用执行阶段的问题
 * 
 * 既然解析正常，检查是否是工具执行阶段的问题
 */

const http = require('http');

console.log('🔍 检查工具调用执行阶段...');

// 测试不同类型的工具调用
const testCases = [
  {
    name: "简单bash命令",
    request: {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: "执行 pwd 命令" }],
      tools: [{
        name: "bash",
        description: "Execute bash commands",
        input_schema: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"]
        }
      }],
      stream: true
    }
  },
  {
    name: "复杂bash命令",
    request: {
      model: "claude-sonnet-4-20250514", 
      max_tokens: 1000,
      messages: [{ role: "user", content: "列出当前目录的所有.js文件" }],
      tools: [{
        name: "bash",
        description: "Execute bash commands", 
        input_schema: {
          type: "object",
          properties: { command: { type: "string" } },
          required: ["command"]
        }
      }],
      stream: true
    }
  }
];

async function testToolCallExecution(testCase) {
  console.log(`\n🧪 测试: ${testCase.name}`);
  console.log('─'.repeat(50));
  
  return new Promise((resolve) => {
    const postData = JSON.stringify(testCase.request);
    
    const options = {
      hostname: '127.0.0.1',
      port: 3456,
      path: '/v1/messages?beta=true',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'text/event-stream'
      }
    };

    const req = http.request(options, (res) => {
      console.log(`📊 状态: ${res.statusCode}`);
      
      let eventCount = 0;
      let toolCallFound = false;
      let toolExecuted = false;
      let errorFound = false;
      let buffer = '';
      
      const timeout = setTimeout(() => {
        console.log(`📊 结果: 事件${eventCount}个, 工具调用${toolCallFound?'✅':'❌'}, 执行${toolExecuted?'✅':'❌'}, 错误${errorFound?'❌':'✅'}`);
        resolve({ toolCallFound, toolExecuted, errorFound, eventCount });
      }, 10000);

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        
        events.forEach(eventData => {
          if (eventData.trim()) {
            eventCount++;
            
            if (eventData.includes('tool_use')) {
              toolCallFound = true;
              console.log(`   🔧 工具调用检测`);
            }
            
            if (eventData.includes('tool_result')) {
              toolExecuted = true;
              console.log(`   ✅ 工具执行结果`);
            }
            
            if (eventData.includes('error') || eventData.includes('Error')) {
              errorFound = true;
              console.log(`   ❌ 发现错误`);
            }
          }
        });
      });

      res.on('end', () => {
        clearTimeout(timeout);
        resolve({ toolCallFound, toolExecuted, errorFound, eventCount });
      });

      res.on('error', (error) => {
        clearTimeout(timeout);
        console.log(`   💥 响应错误: ${error.message}`);
        resolve({ toolCallFound, toolExecuted, errorFound: true, eventCount });
      });
    });

    req.on('error', (error) => {
      console.log(`   💥 请求错误: ${error.message}`);
      resolve({ toolCallFound: false, toolExecuted: false, errorFound: true, eventCount: 0 });
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🚀 开始工具调用执行测试...');
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testCase(testCase);
    results.push({ name: testCase.name, ...result });
  }
  
  console.log('\n📊 测试总结:');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    console.log(`${result.name}:`);
    console.log(`   工具调用: ${result.toolCallFound ? '✅' : '❌'}`);
    console.log(`   工具执行: ${result.toolExecuted ? '✅' : '❌'}`);
    console.log(`   无错误: ${!result.errorFound ? '✅' : '❌'}`);
    console.log(`   事件数: ${result.eventCount}`);
  });
  
  const allPassed = results.every(r => r.toolCallFound && !r.errorFound);
  console.log(`\n🎯 总体状态: ${allPassed ? '✅ 正常' : '⚠️ 有问题'}`);
}

if (require.main === module) {
  main().catch(console.error);
}