#!/usr/bin/env node

/**
 * 简化的Anthropic工具调用死锁测试
 * 专门测试之前遇到的死锁场景
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';

// 使用与之前测试相同的工具调用请求
const toolCallRequest = {
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1000,
  messages: [
    {
      role: "user", 
      content: "请使用listDirectory工具查看当前目录内容"
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

async function testSingleRequest() {
  console.log('🧪 测试单个Anthropic工具调用请求...');
  
  const startTime = Date.now();
  let hasToolUse = false;
  let hasMessageStop = false;
  let eventCount = 0;
  
  try {
    const response = await axios.post(`${SERVER_URL}/v1/messages`, toolCallRequest, {
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': 'test-session',
        'conversation_id': 'test-conversation'
      },
      timeout: 15000,
      responseType: 'stream'
    });
    
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              eventCount++;
              
              console.log(`📨 事件 #${eventCount}: ${data.type}`);
              
              if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
                hasToolUse = true;
                console.log('🔧 检测到工具调用开始');
              }
              
              if (data.type === 'message_stop') {
                hasMessageStop = true;
                console.log('🛑 检测到message_stop事件');
              }
              
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      });
      
      response.data.on('end', () => {
        const duration = Date.now() - startTime;
        console.log(`✅ 请求完成，耗时: ${duration}ms`);
        console.log(`📊 统计信息:`);
        console.log(`   - 总事件数: ${eventCount}`);
        console.log(`   - 包含工具调用: ${hasToolUse}`);
        console.log(`   - 收到message_stop: ${hasMessageStop}`);
        
        // 验证修复效果
        if (hasToolUse && !hasMessageStop) {
          console.log('✅ 修复成功：工具调用场景下正确跳过了message_stop');
        } else if (hasToolUse && hasMessageStop) {
          console.log('⚠️  可能的问题：工具调用场景下仍然发送了message_stop');
        } else if (!hasToolUse) {
          console.log('❌ 测试失败：未检测到工具调用');
        }
        
        resolve({ duration, hasToolUse, hasMessageStop, eventCount });
      });
      
      response.data.on('error', (error) => {
        const duration = Date.now() - startTime;
        console.log(`❌ 请求失败 (${duration}ms): ${error.message}`);
        reject(error);
      });
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ 请求异常 (${duration}ms): ${error.message}`);
    
    if (error.code === 'ECONNABORTED') {
      console.log('💀 请求超时！可能存在死锁问题');
    }
    
    throw error;
  }
}

async function testConsecutiveRequests() {
  console.log('\n🧪 测试连续请求（死锁场景）...');
  
  const request1Promise = testSingleRequest();
  
  // 等待100ms后发送第二个请求
  setTimeout(async () => {
    console.log('\n📤 发送第二个请求...');
    try {
      await testSingleRequest();
    } catch (error) {
      console.log('❌ 第二个请求失败:', error.message);
    }
  }, 100);
  
  try {
    await request1Promise;
    console.log('✅ 第一个请求成功完成');
  } catch (error) {
    console.log('❌ 第一个请求失败:', error.message);
  }
}

async function main() {
  console.log('🔍 Anthropic工具调用死锁修复测试\n');
  
  try {
    // 检查服务器
    await axios.get(`${SERVER_URL}/health`);
    console.log('✅ 服务器运行正常\n');
  } catch (error) {
    console.log('❌ 服务器未运行，请先启动: npm run dev');
    process.exit(1);
  }
  
  try {
    // 测试单个请求
    await testSingleRequest();
    
    // 等待2秒
    console.log('\n⏳ 等待2秒后测试连续请求...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 测试连续请求
    await testConsecutiveRequests();
    
    console.log('\n🎉 所有测试完成！');
    
  } catch (error) {
    console.error('\n💀 测试失败:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);