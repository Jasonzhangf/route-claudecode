#!/usr/bin/env node
/**
 * 🔍 快速测试工具调用流程
 */

const http = require('http');

console.log('🔍 快速测试工具调用流程...');

const request = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  messages: [
    {
      role: "user", 
      content: "请帮我列出当前目录的文件"
    }
  ],
  tools: [
    {
      name: "bash",
      description: "Execute bash commands",
      input_schema: {
        type: "object",
        properties: {
          command: { type: "string" }
        },
        required: ["command"]
      }
    }
  ],
  stream: true
};

const postData = JSON.stringify(request);

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
  console.log(`状态码: ${res.statusCode}`);
  
  let eventCount = 0;
  let toolCallFound = false;
  let messageStopFound = false;
  let toolUseStopFound = false;
  
  res.on('data', (chunk) => {
    const data = chunk.toString();
    const events = data.split('\n\n');
    
    events.forEach(eventData => {
      if (eventData.trim()) {
        eventCount++;
        console.log(`事件 ${eventCount}: ${eventData.substring(0, 100)}...`);
        
        if (eventData.includes('tool_use')) {
          toolCallFound = true;
          console.log('  ✅ 发现工具调用');
        }
        
        if (eventData.includes('message_stop')) {
          messageStopFound = true;
          console.log('  ⚠️ 发现message_stop');
        }
        
        if (eventData.includes('stop_reason') && eventData.includes('tool_use')) {
          toolUseStopFound = true;
          console.log('  ✅ 发现tool_use stop_reason');
        }
      }
    });
  });
  
  res.on('end', () => {
    console.log('\n📊 测试结果:');
    console.log(`总事件数: ${eventCount}`);
    console.log(`工具调用: ${toolCallFound ? '✅' : '❌'}`);
    console.log(`tool_use stop_reason: ${toolUseStopFound ? '✅' : '❌'}`);
    console.log(`message_stop: ${messageStopFound ? '❌ 不应该出现' : '✅ 正确跳过'}`);
    
    if (toolCallFound && toolUseStopFound && !messageStopFound) {
      console.log('\n🎉 修复成功！工具调用后没有发送message_stop');
    } else if (messageStopFound) {
      console.log('\n⚠️ 仍然发送了message_stop，修复可能需要服务器重启');
    }
  });
  
  res.on('error', (err) => {
    console.error('响应错误:', err);
  });
});

req.on('error', (err) => {
  console.error('请求错误:', err);
});

req.write(postData);
req.end();

// 15秒后超时
setTimeout(() => {
  console.log('\n⏰ 测试超时');
  process.exit(0);
}, 15000);