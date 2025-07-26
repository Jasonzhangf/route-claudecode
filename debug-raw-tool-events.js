#!/usr/bin/env node

/**
 * Debug CodeWhisperer 原始工具事件 - 直接调用我们的API并添加详细日志
 */

const axios = require('axios');

async function testRawToolEvents() {
  console.log('🔍 测试CodeWhisperer原始工具事件...\n');
  
  const request = {
    model: "claude-3-5-haiku-20241022",
    max_tokens: 131072, // 128K tokens
    messages: [
      {
        role: "user",
        content: "Could you help me read the file /tmp/test.txt?"
      }
    ],
    tools: [
      {
        name: "Read",
        description: "Reads a file from the local filesystem",
        input_schema: {
          type: "object",
          properties: {
            file_path: {
              description: "The absolute path to the file to read",
              type: "string"
            }
          },
          required: ["file_path"]
        }
      }
    ]
  };

  try {
    console.log('📤 发送请求到路由器...');
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer any-key'
      }
    });

    console.log('✅ 响应状态:', response.status);
    console.log('📊 响应内容:');
    console.log(JSON.stringify(response.data, null, 2));

    // 检查日志
    console.log('\n📋 检查调试日志...');
    const fs = require('fs');
    try {
      const logContent = fs.readFileSync('/tmp/ccr-debug.log', 'utf8');
      const lines = logContent.split('\n');
      
      console.log('\n🔍 查找工具相关的日志...');
      let foundToolLogs = false;
      for (let i = lines.length - 200; i < lines.length; i++) {
        if (i >= 0 && lines[i]) {
          const line = lines[i];
          if (line.includes('tool') || line.includes('Tool') || 
              line.includes('assistantResponseEvent') || 
              line.includes('content_block_start') ||
              line.includes('content_block_delta') ||
              line.includes('toolUse')) {
            console.log(`[${i}] ${line}`);
            foundToolLogs = true;
          }
        }
      }
      
      if (!foundToolLogs) {
        console.log('⚠️  没有找到工具相关的日志，显示最后50行：');
        for (let i = Math.max(0, lines.length - 50); i < lines.length; i++) {
          if (lines[i]) {
            console.log(`[${i}] ${lines[i]}`);
          }
        }
      }
    } catch (error) {
      console.log('⚠️  无法读取日志文件:', error.message);
    }

  } catch (error) {
    console.error('❌ 请求失败:', error.response?.data || error.message);
  }
}

testRawToolEvents().catch(console.error);