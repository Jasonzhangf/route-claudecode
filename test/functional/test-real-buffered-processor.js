#!/usr/bin/env node

/**
 * 直接测试真实的OpenAI buffered processor
 */

const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

// 测试数据
const testData = {
  problematicEvents: [
    {
      id: "chatcmpl-test456",
      object: "chat.completion.chunk",
      created: 1753879500,
      model: "gemini-2.5-flash",
      choices: [{
        index: 0,
        delta: { role: "assistant" },
        finish_reason: null
      }]
    },
    {
      id: "chatcmpl-test456",
      object: "chat.completion.chunk",
      created: 1753879500,
      model: "gemini-2.5-flash",
      choices: [{
        index: 0,
        delta: {
          content: "⏺ Tool call: Bash(git status --porcelain | grep test)\n⏺ Tool call: Bash({\"command\":\"ls -la simple-test.js\"})"
        },
        finish_reason: null
      }]
    },
    {
      id: "chatcmpl-test456", 
      object: "chat.completion.chunk",
      created: 1753879500,
      model: "gemini-2.5-flash",
      choices: [{
        index: 0,
        delta: {},
        finish_reason: "stop"
      }],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 25  
      }
    }
  ]
};

async function testWithRealProcessor() {
  console.log('🧪 Testing with real buffered processor...');
  
  try {
    // 创建测试脚本使用Node.js的require来直接调用编译后的函数
    const testScript = `
const fs = require('fs');

// 读取编译后的代码
const distCode = fs.readFileSync('./dist/cli.js', 'utf8');

// 创建一个简单的环境来执行代码
const mockLogger = {
  debug: (...args) => console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.log('[WARN]', ...args),
  error: (...args) => console.log('[ERROR]', ...args)
};

// 模拟全局环境
global.logger = mockLogger;

// 执行编译后的代码（这会定义所有函数）
eval(distCode);

// 测试数据
const testEvents = ${JSON.stringify(testData.problematicEvents)};

// 调用处理函数 - 需要找到正确的函数名
// 由于代码被编译和混淆，我们需要找到对应的函数
console.log('Available functions:', Object.keys(global).filter(k => typeof global[k] === 'function'));

// 尝试找到buffered processor函数
let processFunction = null;
for (const key of Object.keys(global)) {
  if (typeof global[key] === 'function' && key.includes('processOpenAI') || key.includes('BufferedResponse')) {
    processFunction = global[key];
    console.log('Found potential function:', key);
    break;
  }
}

if (!processFunction) {
  console.log('Could not find processOpenAIBufferedResponse function');
  process.exit(1);
}

try {
  const result = processFunction(testEvents, 'test-req', 'gemini-2.5-flash');
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.log('Function call failed:', error.message);
}
`;

    // 写入并执行测试脚本
    fs.writeFileSync('/tmp/test-real-processor.js', testScript);
    
    const { stdout, stderr } = await execAsync('node /tmp/test-real-processor.js', {
      cwd: process.cwd()
    });
    
    console.log('STDOUT:', stdout);
    if (stderr) {
      console.log('STDERR:', stderr);
    }
    
    // 清理
    fs.unlinkSync('/tmp/test-real-processor.js');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Real Buffered Processor Test');
  console.log('===============================');
  
  await testWithRealProcessor();
}

main().catch(console.error);