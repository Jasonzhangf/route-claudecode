#!/usr/bin/env node

/**
 * Debug工具事件解析 - 查看CodeWhisperer返回的工具相关事件
 */

const axios = require('axios');

async function testToolEvents() {
  console.log('🔍 测试工具事件解析...\n');
  
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
    
    // 分析内容
    if (response.data.content) {
      console.log('\n📋 内容分析:');
      response.data.content.forEach((item, index) => {
        console.log(`  [${index}] 类型: ${item.type}`);
        if (item.type === 'text') {
          console.log(`      文本: "${item.text.substring(0, 100)}..."`);
        } else if (item.type === 'tool_use') {
          console.log(`      工具: ${item.name}`);
          console.log(`      ID: ${item.id}`);
          console.log(`      输入: ${JSON.stringify(item.input)}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ 请求失败:', error.response?.data || error.message);
  }
}

testToolEvents().catch(console.error);