#!/usr/bin/env node

/**
 * 快速测试3456端口的工具调用功能
 */

const axios = require('axios');

async function quickTest() {
  console.log('🧪 快速测试3456端口工具调用...');
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: '请读取README.md文件' }],
      tools: [{
        name: 'Read',
        description: 'Read file contents',
        input_schema: {
          type: 'object',
          properties: { file_path: { type: 'string' } },
          required: ['file_path']
        }
      }],
      stream: true
    }, {
      responseType: 'stream',
      timeout: 15000
    });
    
    let hasToolUse = false;
    let hasMessageStop = false;
    
    return new Promise((resolve) => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.event === 'content_block_start' && data.data?.content_block?.type === 'tool_use') {
                console.log('✅ 检测到工具调用');
                hasToolUse = true;
              }
              
              if (data.event === 'message_delta' && data.data?.delta?.stop_reason === 'tool_use') {
                console.log('✅ 收到tool_use stop_reason');
              }
              
              if (data.event === 'message_stop') {
                console.log('❌ 收到message_stop (不应该)');
                hasMessageStop = true;
              }
            } catch (e) {}
          }
        }
      });
      
      response.data.on('end', () => {
        const success = hasToolUse && !hasMessageStop;
        console.log(`\n🎯 测试结果: ${success ? '✅ 成功' : '❌ 失败'}`);
        resolve(success);
      });
      
      setTimeout(() => {
        console.log('⏰ 测试超时');
        resolve(false);
      }, 15000);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return false;
  }
}

quickTest().then(success => process.exit(success ? 0 : 1));