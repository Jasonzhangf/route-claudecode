/**
 * Debug buffer detailed - 详细缓冲调试
 * 通过添加额外的日志输出来调试缓冲处理过程
 */

const fs = require('fs');
const axios = require('axios');

async function debugBufferDetailed() {
  console.log('[2025-07-27T09:40:00.000Z] 🔍 开始详细缓冲调试');
  
  // 获取当前日志文件大小作为基准
  const logFile = '/Users/fanzhang/.claude-code-router/logs/ccr-2025-07-27.log';
  const initialSize = fs.statSync(logFile).size;
  console.log(`初始日志文件大小: ${initialSize} bytes`);
  
  try {
    // 发送请求
    const testRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      stream: false,  // 明确指定非流式
      messages: [
        {
          role: 'user',
          content: 'Use LS tool to list files in /tmp directory'
        }
      ],
      tools: [
        {
          name: 'LS',
          description: 'List directory contents',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path' }
            },
            required: ['path']
          }
        }
      ]
    };
    
    console.log('[' + new Date().toISOString() + '] 📤 发送详细调试请求 (非流式)');
    
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': 'any-string-is-ok'
      },
      timeout: 30000
    });
    
    console.log('[' + new Date().toISOString() + '] ✅ 请求完成');
    
    // 等待日志写入
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 获取新的日志内容
    const finalSize = fs.statSync(logFile).size;
    const newLogData = fs.readFileSync(logFile, 'utf8').slice(initialSize);
    
    console.log(`\\n📋 新增日志内容 (${finalSize - initialSize} bytes):`);
    console.log('=' .repeat(80));
    console.log(newLogData);
    console.log('=' .repeat(80));
    
    console.log('\\n📊 响应分析:');
    console.log('响应状态:', response.status);
    console.log('内容块数量:', response.data.content ? response.data.content.length : 0);
    
    if (response.data.content) {
      response.data.content.forEach((block, index) => {
        console.log(`\\n内容块 ${index + 1}:`);
        console.log(`  类型: ${block.type}`);
        if (block.type === 'tool_use') {
          console.log(`  工具: ${block.name}`);
          console.log(`  输入:`, JSON.stringify(block.input));
          console.log(`  输入为空:`, !block.input || Object.keys(block.input).length === 0);
        } else if (block.type === 'text') {
          console.log(`  文本: "${block.text}"`);
        }
      });
    }
    
    // 检查日志中是否有缓冲处理的痕迹
    if (newLogData.includes('Using buffered processing')) {
      console.log('\\n✅ 发现缓冲处理日志');
    } else {
      console.log('\\n❌ 未发现缓冲处理日志 - 可能未使用缓冲处理！');
    }
    
    if (newLogData.includes('Failed to parse')) {
      console.log('\\n🚨 发现解析失败日志');
    }
    
    return response.data;
    
  } catch (error) {
    console.error('[' + new Date().toISOString() + '] ❌ 详细调试失败:', error.message);
    throw error;
  }
}

// 运行详细调试
debugBufferDetailed()
  .then(() => {
    console.log('\\n🔍 详细缓冲调试完成');
  })
  .catch(error => {
    console.error('详细调试失败:', error.message);
    process.exit(1);
  });