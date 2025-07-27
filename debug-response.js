#!/usr/bin/env node

const axios = require('axios');

async function debugResponse() {
  const request = {
    model: "claude-3-5-haiku-20241022",
    max_tokens: 131072,
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
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 60000
    });

    console.log('🔍 完整响应调试:');
    console.log('原始响应数据:', JSON.stringify(response.data, null, 2));
    console.log('\n检查 stop_reason 字段:');
    console.log('stop_reason 值:', response.data.stop_reason);
    console.log('stop_reason 类型:', typeof response.data.stop_reason);
    console.log('stop_reason === undefined:', response.data.stop_reason === undefined);
    console.log('stop_reason === null:', response.data.stop_reason === null);
    console.log('stop_reason in response.data:', 'stop_reason' in response.data);

  } catch (error) {
    console.error('请求失败:', error.message);
  }
}

debugResponse();