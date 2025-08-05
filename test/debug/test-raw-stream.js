#!/usr/bin/env node

/**
 * 测试原始SSE流数据
 * 查看实际的流事件内容
 */

const http = require('http');

async function testRawStream() {
  console.log('\n🔍 检查原始SSE流数据...\n');

  const testRequest = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [
      {
        role: "user", 
        content: "请帮我创建一个简单的todo项目：学习编程"
      }
    ],
    tools: [
      {
        name: "TodoWrite", 
        description: "Create todo items",
        input_schema: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string" },
                  status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  id: { type: "string" }
                },
                required: ["content", "status", "priority", "id"]
              }
            }
          },
          required: ["todos"]
        }
      }
    ],
    stream: true
  };

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(testRequest);
    
    const options = {
      hostname: 'localhost',
      port: 5507,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'x-api-key': 'test-key'
      }
    };

    console.log(`📡 发送请求到 http://localhost:5507/v1/messages`);

    const req = http.request(options, (res) => {
      console.log(`📊 响应状态: ${res.statusCode}`);

      let rawData = '';
      let lineCount = 0;

      res.on('data', (chunk) => {
        rawData += chunk;
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            lineCount++;
            console.log(`[${lineCount}] ${line}`);
            
            // 特别检查包含stop_reason的行
            if (line.includes('stop_reason')) {
              console.log(`🔴 发现包含stop_reason的行: ${line}`);
            }
            
            // 特别检查message_delta和message_stop
            if (line.includes('message_delta') || line.includes('message_stop')) {
              console.log(`🎯 重要事件: ${line}`);
            }
          }
        }
      });

      res.on('end', () => {
        console.log('\n📋 原始流数据分析完成');
        console.log(`总行数: ${lineCount}`);
        console.log(`原始数据长度: ${rawData.length} bytes`);
        
        // 保存原始数据
        const fs = require('fs');
        fs.writeFileSync('/tmp/raw-stream-data.txt', rawData);
        console.log('💾 原始数据已保存到 /tmp/raw-stream-data.txt');
        
        resolve({
          statusCode: res.statusCode,
          lineCount,
          rawDataLength: rawData.length
        });
      });
    });

    req.on('error', (err) => {
      console.error('❌ 请求错误:', err.message);
      reject(err);
    });

    req.setTimeout(30000);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    const result = await testRawStream();
    console.log('\n📊 原始流测试结果:', result);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}