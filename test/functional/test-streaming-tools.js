#!/usr/bin/env node

/**
 * 测试流式工具调用是否正确处理
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

async function testStreamingTools() {
  console.log('🔍 测试流式工具调用处理\n');
  
  const request = {
    model: "claude-3-5-haiku-20241022",
    max_tokens: 131072,
    stream: true, // 明确指定流式请求
    messages: [
      {
        role: "user",
        content: "请帮我读取文件 /tmp/test.txt"
      }
    ],
    tools: [
      {
        name: "Read",
        description: "读取文件内容",
        input_schema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "文件路径"
            }
          },
          required: ["file_path"]
        }
      }
    ]
  };

  try {
    console.log('📤 发送流式请求到Router (端口3456)...');
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
        'Accept': 'text/event-stream'
      },
      responseType: 'stream',
      timeout: 30000
    });

    console.log('✅ 流式响应开始');
    console.log(`   状态码: ${response.status}`);
    
    let events = [];
    let buffer = '';
    
    // 解析SSE流
    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.slice(7).trim();
          events.push({ type: 'event', value: eventType });
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data);
            events.push({ type: 'data', value: parsed });
          } catch (e) {
            events.push({ type: 'data', value: data });
          }
        }
      }
    });

    // 等待流结束
    await new Promise((resolve, reject) => {
      response.data.on('end', resolve);
      response.data.on('error', reject);
      setTimeout(() => reject(new Error('Stream timeout')), 30000);
    });

    console.log('\n📊 流式事件分析:');
    console.log(`   总事件数: ${events.length}`);
    
    // 分析事件类型
    const eventTypes = {};
    const toolEvents = [];
    const stopEvents = [];
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.type === 'event') {
        eventTypes[event.value] = (eventTypes[event.value] || 0) + 1;
        
        // 检查工具相关事件
        if (event.value.includes('content_block')) {
          const nextEvent = events[i + 1];
          if (nextEvent && nextEvent.type === 'data') {
            toolEvents.push({
              event: event.value,
              data: nextEvent.value
            });
          }
        }
        
        // 检查停止相关事件
        if (event.value.includes('stop') || event.value.includes('delta')) {
          const nextEvent = events[i + 1];
          if (nextEvent && nextEvent.type === 'data') {
            stopEvents.push({
              event: event.value,
              data: nextEvent.value
            });
          }
        }
      }
    }
    
    console.log('\n📋 事件类型统计:');
    Object.entries(eventTypes).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}次`);
    });
    
    console.log('\n🔧 工具调用事件:');
    toolEvents.forEach((evt, idx) => {
      console.log(`   [${idx}] ${evt.event}:`);
      if (evt.data.content_block && evt.data.content_block.type === 'tool_use') {
        console.log(`       工具: ${evt.data.content_block.name}`);
        console.log(`       ID: ${evt.data.content_block.id}`);
        console.log(`       输入: ${JSON.stringify(evt.data.content_block.input)}`);
      }
    });
    
    console.log('\n🛑 停止相关事件:');
    stopEvents.forEach((evt, idx) => {
      console.log(`   [${idx}] ${evt.event}:`);
      if (evt.data.delta && evt.data.delta.stop_reason) {
        console.log(`       ❌ 发现停止原因: ${evt.data.delta.stop_reason}`);
      } else if (evt.event === 'message_stop') {
        console.log(`       ❌ 发现消息停止事件`);
      } else {
        console.log(`       ✅ 无停止信号`);
      }
    });
    
    // 检查是否存在工具调用
    const hasToolCall = toolEvents.some(evt => 
      evt.data.content_block && evt.data.content_block.type === 'tool_use'
    );
    
    // 检查是否存在停止信号
    const hasStopSignal = stopEvents.some(evt => 
      (evt.data.delta && evt.data.delta.stop_reason) || evt.event === 'message_stop'
    );
    
    console.log('\n🎯 测试结果:');
    console.log(`   包含工具调用: ${hasToolCall ? '✅' : '❌'}`);
    console.log(`   包含停止信号: ${hasStopSignal ? '❌ (不应该有)' : '✅ (正确)'}`);
    console.log(`   流式处理正常: ${hasToolCall && !hasStopSignal ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
    }
  }
}

testStreamingTools().catch(console.error);