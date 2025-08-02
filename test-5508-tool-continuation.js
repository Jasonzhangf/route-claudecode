#!/usr/bin/env node

/**
 * 测试5508端口工具调用继续性修复
 * 验证ShuaiHong服务的工具调用是否不再发送message_stop
 */

const http = require('http');

const REQUEST_CONFIG = {
  hostname: 'localhost',
  port: 5508,
  path: '/v1/messages',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'any-string-is-ok',
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14'
  }
};

const TEST_REQUEST = {
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [
    {
      role: 'user',
      content: '请帮我检查LM Studio集成的状态。首先让我查看相关配置和测试文件。'
    }
  ],
  tools: [
    {
      name: 'bash',
      description: '执行bash命令',
      input_schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的bash命令'
          }
        },
        required: ['command']
      }
    }
  ],
  stream: true
};

function makeRequest() {
  return new Promise((resolve, reject) => {
    const req = http.request(REQUEST_CONFIG, (res) => {
      console.log(`状态码: ${res.statusCode}`);
      console.log(`响应头:`, res.headers);
      
      let eventCount = 0;
      let toolUseEvents = [];
      let messageStopReceived = false;
      
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              eventCount++;
              
              console.log(`\n[事件 ${eventCount}] ${data.type || 'unknown'}:`);
              
              if (data.type === 'message_delta' && data.delta) {
                if (data.delta.stop_reason) {
                  console.log(`  停止原因: ${data.delta.stop_reason}`);
                  if (data.delta.stop_reason === 'tool_use') {
                    toolUseEvents.push(eventCount);
                    console.log(`  ✅ 检测到工具调用停止信号`);
                  }
                }
              }
              
              if (data.type === 'message_stop') {
                messageStopReceived = true;
                console.log(`  ❌ 收到message_stop事件 - 对话将被终止`);
              }
              
              if (data.type === 'content_block_start' && data.content_block) {
                if (data.content_block.type === 'tool_use') {
                  console.log(`  🔧 工具调用开始: ${data.content_block.name}`);
                }
              }
              
            } catch (e) {
              // 忽略JSON解析错误
            }
          }
        }
      });
      
      res.on('end', () => {
        console.log(`\n📊 测试结果:`);
        console.log(`  - 总事件数: ${eventCount}`);
        console.log(`  - 工具调用停止事件: ${toolUseEvents.length}`);
        console.log(`  - message_stop接收: ${messageStopReceived ? '是' : '否'}`);
        
        if (toolUseEvents.length > 0 && !messageStopReceived) {
          console.log(`\n✅ 修复成功: 5508端口工具调用后没有发送message_stop`);
          console.log(`   预期行为: 对话应该暂停等待工具结果，而不是终止`);
        } else if (toolUseEvents.length > 0 && messageStopReceived) {
          console.log(`\n❌ 修复失败: 5508端口工具调用后仍然发送了message_stop`);
          console.log(`   问题: 对话被终止，无法继续多轮工具调用`);
        } else {
          console.log(`\n⚠️  未检测到工具调用: 可能需要更具体的请求`);
        }
        
        resolve({
          eventCount,
          toolUseEvents,
          messageStopReceived,
          success: toolUseEvents.length > 0 && !messageStopReceived
        });
      });
    });
    
    req.on('error', (err) => {
      console.error('请求错误:', err);
      reject(err);
    });
    
    req.write(JSON.stringify(TEST_REQUEST));
    req.end();
  });
}

async function runTest() {
  console.log('🧪 开始测试5508端口工具调用继续性修复...');
  console.log('📍 目标端口: 5508 (ShuaiHong服务)');
  console.log('🎯 测试目的: 验证tool_use后不发送message_stop\n');
  
  try {
    const result = await makeRequest();
    
    console.log(`\n${'='.repeat(50)}`);
    if (result.success) {
      console.log('🎉 测试通过: 5508端口工具调用继续性修复成功!');
    } else {
      console.log('⚠️  5508端口测试需要进一步验证');
    }
    console.log(`${'='.repeat(50)}`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runTest();
}

module.exports = { runTest };