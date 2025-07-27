/**
 * Debug specific parsing - 调试特定解析问题
 * 专门针对工具输入为空的问题进行调试
 */

const axios = require('axios');

async function debugSpecificParsing() {
  console.log('[2025-07-27T09:35:00.000Z] 🔍 开始调试特定解析问题');
  
  try {
    // 非常简单的请求，确保工具输入不为空
    const testRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: 'List files in the /tmp directory using LS tool'
        }
      ],
      tools: [
        {
          name: 'LS',
          description: 'List files and directories in a path',
          input_schema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path to list'
              }
            },
            required: ['path']
          }
        }
      ]
    };
    
    console.log('[' + new Date().toISOString() + '] 📤 发送特定调试请求');
    
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': 'any-string-is-ok'
      },
      timeout: 30000
    });
    
    console.log('[' + new Date().toISOString() + '] ✅ 请求完成');
    console.log('响应状态:', response.status);
    console.log('响应内容:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // 分析每个内容块
    if (response.data && response.data.content) {
      response.data.content.forEach((block, index) => {
        console.log(`\\n=== 内容块 ${index + 1} ===`);
        console.log(`类型: ${block.type}`);
        
        if (block.type === 'tool_use') {
          console.log(`工具名: ${block.name}`);
          console.log(`工具ID: ${block.id}`);
          console.log(`工具输入:`, block.input);
          console.log(`输入是否有效:`, block.input && Object.keys(block.input).length > 0);
          
          if (!block.input || Object.keys(block.input).length === 0) {
            console.log('🚨 检测到工具输入为空的问题！');
          } else {
            console.log('✅ 工具输入正常');
            if (block.input.path) {
              console.log(`  路径参数: ${block.input.path}`);
            }
          }
        } else if (block.type === 'text') {
          console.log(`文本内容: "${block.text}"`);
          if (block.text && block.text.includes('Tool call:')) {
            console.log('🚨 检测到文本中包含工具调用！');
          }
        }
      });
    }
    
    return response.data;
    
  } catch (error) {
    console.error('[' + new Date().toISOString() + '] ❌ 调试请求失败:', error.message);
    throw error;
  }
}

// 运行调试
debugSpecificParsing()
  .then(result => {
    console.log('\\n🔍 调试完成，检查最新日志以查看详细解析过程');
  })
  .catch(error => {
    console.error('调试失败:', error.message);
    process.exit(1);
  });