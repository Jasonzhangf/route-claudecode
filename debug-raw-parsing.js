/**
 * Debug raw parsing - 调试原始解析过程
 * 检查CodeWhisperer原始响应的解析逻辑
 */

const axios = require('axios');

async function debugRawParsing() {
  console.log('[2025-07-27T09:30:00.000Z] 🔍 开始调试原始解析过程');
  
  try {
    // 简单的工具调用请求
    const testRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: 'Use the Read tool to read the file /Users/fanzhang/.claude-code-router/logs/ccr-2025-07-27.log and tell me its size'
        }
      ],
      tools: [
        {
          name: 'Read',
          description: 'Read file contents',
          input_schema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Path to file to read'
              }
            },
            required: ['file_path']
          }
        }
      ]
    };
    
    console.log('[' + new Date().toISOString() + '] 📤 发送调试请求');
    
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': 'any-string-is-ok',
        'x-debug-parsing': 'true'  // 特殊header触发详细日志
      },
      timeout: 30000
    });
    
    console.log('[' + new Date().toISOString() + '] ✅ 请求完成');
    console.log('响应状态:', response.status);
    console.log('响应内容:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // 分析响应中的工具调用
    if (response.data && response.data.content) {
      response.data.content.forEach((block, index) => {
        console.log(`\\n内容块 ${index + 1}: ${block.type}`);
        if (block.type === 'tool_use') {
          console.log(`  工具名: ${block.name}`);
          console.log(`  工具ID: ${block.id}`);
          console.log(`  工具输入:`, JSON.stringify(block.input, null, 2));
          
          // 检查输入是否有效
          if (!block.input || Object.keys(block.input).length === 0) {
            console.log('  ⚠️ 工具输入为空或无效！');
          } else {
            console.log('  ✅ 工具输入解析正常');
          }
        }
      });
    }
    
    console.log('\\n📋 检查最新的开发日志以查看详细解析过程...');
    console.log('日志文件: ~/.claude-code-router/logs/ccr-dev-*.log');
    
  } catch (error) {
    console.error('[' + new Date().toISOString() + '] ❌ 调试请求失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行调试
debugRawParsing();