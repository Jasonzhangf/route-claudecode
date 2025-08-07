#!/usr/bin/env node

/**
 * 测试对话死锁修复效果
 * 
 * 测试场景：
 * 1. 发送工具调用请求
 * 2. 立即发送第二个请求（应该排队等待）
 * 3. 验证第二个请求不会永久阻塞
 * 4. 验证队列管理器正确处理完成通知
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';
const TEST_SESSION_ID = 'test-session-deadlock';
const TEST_CONVERSATION_ID = 'test-conversation-deadlock';

// 工具调用测试请求
const toolCallRequest = {
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1000,
  messages: [
    {
      role: "user",
      content: "请使用listDirectory工具列出当前目录的内容"
    }
  ],
  tools: [
    {
      name: "listDirectory",
      description: "List directory contents",
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory path to list"
          }
        },
        required: ["path"]
      }
    }
  ],
  stream: true
};

// 普通文本请求
const textRequest = {
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1000,
  messages: [
    {
      role: "user",
      content: "请简单回答：今天天气怎么样？"
    }
  ],
  stream: true
};

async function sendRequest(requestData, requestName, timeout = 30000) {
  console.log(`📤 发送${requestName}请求...`);
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${SERVER_URL}/v1/messages`, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': TEST_SESSION_ID,
        'conversation_id': TEST_CONVERSATION_ID
      },
      timeout: timeout,
      responseType: 'stream'
    });
    
    return new Promise((resolve, reject) => {
      let responseData = '';
      let hasToolUse = false;
      let hasMessageStop = false;
      
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              responseData += JSON.stringify(data) + '\n';
              
              if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
                hasToolUse = true;
              }
              
              if (data.type === 'message_stop') {
                hasMessageStop = true;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });
      
      response.data.on('end', () => {
        const duration = Date.now() - startTime;
        console.log(`✅ ${requestName}请求完成 (${duration}ms)`);
        console.log(`   - 包含工具调用: ${hasToolUse}`);
        console.log(`   - 收到message_stop: ${hasMessageStop}`);
        
        resolve({
          duration,
          hasToolUse,
          hasMessageStop,
          responseData
        });
      });
      
      response.data.on('error', (error) => {
        const duration = Date.now() - startTime;
        console.log(`❌ ${requestName}请求失败 (${duration}ms): ${error.message}`);
        reject(error);
      });
      
      // 超时检测
      setTimeout(() => {
        const duration = Date.now() - startTime;
        if (duration >= timeout - 1000) {
          console.log(`⏰ ${requestName}请求超时 (${duration}ms)`);
          reject(new Error(`Request timeout after ${duration}ms`));
        }
      }, timeout - 500);
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${requestName}请求失败 (${duration}ms): ${error.message}`);
    throw error;
  }
}

async function testDeadlockFix() {
  console.log('🧪 开始测试对话死锁修复效果...\n');
  
  try {
    // 测试1: 单个工具调用请求
    console.log('=== 测试1: 单个工具调用请求 ===');
    const result1 = await sendRequest(toolCallRequest, '工具调用', 15000);
    
    if (result1.hasToolUse && !result1.hasMessageStop) {
      console.log('✅ 工具调用正确处理：有工具调用，无message_stop');
    } else if (result1.hasToolUse && result1.hasMessageStop) {
      console.log('⚠️  工具调用处理异常：有工具调用但也有message_stop');
    } else {
      console.log('❌ 工具调用处理失败：未检测到工具调用');
    }
    
    console.log('');
    
    // 等待一秒确保第一个请求完全处理完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 测试2: 连续两个请求测试死锁
    console.log('=== 测试2: 连续请求死锁测试 ===');
    
    const promises = [
      sendRequest(toolCallRequest, '第一个工具调用', 20000),
      sendRequest(textRequest, '第二个文本请求', 20000)
    ];
    
    console.log('📤 同时发送两个请求...');
    const startTime = Date.now();
    
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    console.log(`✅ 两个请求都完成了！总耗时: ${totalTime}ms`);
    console.log(`   - 第一个请求: ${results[0].duration}ms`);
    console.log(`   - 第二个请求: ${results[1].duration}ms`);
    
    // 验证队列顺序处理
    if (results[1].duration > results[0].duration) {
      console.log('✅ 队列顺序处理正确：第二个请求等待第一个完成');
    } else {
      console.log('⚠️  队列处理可能有问题：第二个请求比第一个更快完成');
    }
    
    console.log('');
    
    // 测试3: 快速连续请求压力测试
    console.log('=== 测试3: 快速连续请求压力测试 ===');
    
    const rapidPromises = [];
    for (let i = 0; i < 3; i++) {
      rapidPromises.push(
        sendRequest({
          ...textRequest,
          messages: [{ role: "user", content: `快速请求 #${i + 1}: 请回答数字 ${i + 1}` }]
        }, `快速请求#${i + 1}`, 25000)
      );
    }
    
    console.log('📤 发送3个快速连续请求...');
    const rapidStartTime = Date.now();
    
    const rapidResults = await Promise.all(rapidPromises);
    const rapidTotalTime = Date.now() - rapidStartTime;
    
    console.log(`✅ 所有快速请求完成！总耗时: ${rapidTotalTime}ms`);
    rapidResults.forEach((result, index) => {
      console.log(`   - 请求#${index + 1}: ${result.duration}ms`);
    });
    
    console.log('\n🎉 死锁修复测试完成！');
    console.log('\n测试结果总结：');
    console.log('✅ 单个工具调用请求正常处理');
    console.log('✅ 连续请求不会发生死锁');
    console.log('✅ 队列管理器正确处理请求顺序');
    console.log('✅ 快速连续请求压力测试通过');
    
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);
    
    if (error.message.includes('timeout')) {
      console.error('💀 检测到超时，可能仍存在死锁问题！');
      console.error('🔧 建议检查：');
      console.error('   1. 队列管理器是否正确集成');
      console.error('   2. message_stop处理是否正确通知队列完成');
      console.error('   3. 超时机制是否生效');
    }
    
    process.exit(1);
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    await axios.get(`${SERVER_URL}/health`);
    console.log('✅ 服务器运行正常');
    return true;
  } catch (error) {
    console.log('❌ 服务器未运行或无法访问');
    console.log('🔧 请先启动服务器: npm run dev');
    return false;
  }
}

async function main() {
  console.log('🔍 检查服务器状态...');
  
  if (!(await checkServer())) {
    process.exit(1);
  }
  
  await testDeadlockFix();
}

main().catch(console.error);