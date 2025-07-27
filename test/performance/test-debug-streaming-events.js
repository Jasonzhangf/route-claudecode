#!/usr/bin/env node

/**
 * 调试流式事件数据结构
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

async function debugStreamingEvents() {
  console.log('🔍 调试流式事件数据结构...\n');
  
  const request = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 131072,
    stream: true,
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
    const response = await axios.post('http://127.0.0.1:3456/v1/messages?beta=true', request, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': 'Bearer test-key',
        'anthropic-beta': 'claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
      },
      responseType: 'stream',
      timeout: 30000
    });

    let buffer = '';
    let eventCount = 0;
    
    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.slice(7).trim();
          console.log(`\n📋 Event ${++eventCount}: ${eventType}`);
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data);
            console.log('📦 Data:', JSON.stringify(parsed, null, 2));
            
            // 检查是否为工具调用相关数据
            if (parsed.content_block?.type === 'tool_use') {
              console.log('🔧 工具调用开始:', parsed.content_block.name);
            } else if (parsed.delta?.type === 'input_json_delta') {
              console.log('📝 工具参数:', parsed.delta.partial_json);
            } else if (parsed.delta?.text) {
              console.log('💬 文本内容:', parsed.delta.text);
            }
          } catch (e) {
            console.log('📦 Raw Data:', data);
          }
        }
      }
    });

    response.data.on('end', () => {
      console.log(`\n✅ 流式响应结束，共${eventCount}个事件`);
    });

    await new Promise((resolve, reject) => {
      response.data.on('end', resolve);
      response.data.on('error', reject);
      setTimeout(() => reject(new Error('Timeout')), 30000);
    });

  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

debugStreamingEvents().catch(console.error);