#!/usr/bin/env node
/**
 * OpenAI Provider 3456端口流式工具调用测试
 * 测试流式响应中的工具调用处理
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

class OpenAIStreamingToolsTest {
  constructor() {
    this.baseURL = 'http://localhost:3456';
  }

  /**
   * 测试流式工具调用
   */
  async testStreamingToolCall() {
    console.log('🧪 测试OpenAI Provider流式工具调用');
    console.log('=' .repeat(60));

    const request = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '请帮我计算 42 / 6 的结果，并解释计算过程' }]
        }
      ],
      max_tokens: 300,
      stream: true,
      tools: [
        {
          name: 'calculate',
          description: '数学计算',
          input_schema: {
            type: 'object',
            properties: { 
              expression: { type: 'string', description: '数学表达式' }
            },
            required: ['expression']
          }
        }
      ]
    };

    try {
      console.log('📤 发送流式工具调用请求...');
      
      const response = await axios.post(`${this.baseURL}/v1/messages`, request, {
        headers: { 'Content-Type': 'application/json' },
        responseType: 'stream',
        timeout: 30000
      });

      let chunkCount = 0;
      let events = [];
      let hasMessageStart = false;
      let hasToolUse = false;
      let hasMessageStop = false;
      let toolUseData = null;
      let finishReason = null;

      return new Promise((resolve) => {
        response.data.on('data', (chunk) => {
          chunkCount++;
          const lines = chunk.toString().split('\n');
          
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const event = line.slice(7).trim();
              events.push(event);
              
              if (event === 'message_start') {
                hasMessageStart = true;
                console.log('✅ 收到 message_start 事件');
              } else if (event === 'content_block_start') {
                console.log('✅ 收到 content_block_start 事件');
              } else if (event === 'content_block_delta') {
                // 工具调用内容会在这里
              } else if (event === 'content_block_stop') {
                console.log('✅ 收到 content_block_stop 事件');
              } else if (event === 'message_stop') {
                hasMessageStop = true;
                console.log('✅ 收到 message_stop 事件');
              }
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                // 检查是否包含工具调用
                if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
                  hasToolUse = true;
                  toolUseData = data.content_block;
                  console.log(`🔧 检测到工具调用: ${toolUseData.name}`);
                  console.log(`📝 工具参数: ${JSON.stringify(toolUseData.input)}`);
                }
                
                // 检查finish reason
                if (data.type === 'message_stop' && data.stop_reason) {
                  finishReason = data.stop_reason;
                  console.log(`📋 Finish Reason: ${finishReason}`);
                }
              } catch (e) {
                // 忽略JSON解析错误
              }
            }
          }

          // 限制处理的chunk数量
          if (chunkCount > 200) {
            response.data.destroy();
          }
        });

        response.data.on('end', () => {
          console.log(`\n📊 流式响应统计:`);
          console.log(`- 总chunks: ${chunkCount}`);
          console.log(`- 事件类型: ${[...new Set(events)].join(', ')}`);
          console.log(`- Message Start: ${hasMessageStart}`);
          console.log(`- Tool Use: ${hasToolUse}`);
          console.log(`- Message Stop: ${hasMessageStop}`);
          console.log(`- Finish Reason: ${finishReason}`);

          const isValidStreamingToolCall = 
            hasMessageStart &&
            hasToolUse &&
            hasMessageStop &&
            toolUseData &&
            finishReason === 'tool_use' &&
            chunkCount > 0;

          if (isValidStreamingToolCall) {
            console.log('\n🎉 流式工具调用测试完全通过！');
            resolve({
              status: 'PASS',
              chunkCount,
              events: [...new Set(events)],
              toolUse: toolUseData,
              finishReason
            });
          } else {
            console.log('\n❌ 流式工具调用测试失败');
            resolve({
              status: 'FAIL',
              chunkCount,
              events: [...new Set(events)],
              hasMessageStart,
              hasToolUse,
              hasMessageStop,
              finishReason,
              error: '流式工具调用验证失败'
            });
          }
        });

        response.data.on('error', (error) => {
          console.error('🚨 流式响应错误:', error.message);
          resolve({
            status: 'ERROR',
            error: error.message
          });
        });
      });

    } catch (error) {
      console.error('🚨 流式工具调用测试失败:', error.message);
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }
}

// 运行测试
async function runStreamingToolsTest() {
  const tester = new OpenAIStreamingToolsTest();
  const result = await tester.testStreamingToolCall();
  
  console.log('\n📊 测试结果总结');
  console.log('=' .repeat(40));
  console.log(`状态: ${result.status}`);
  
  if (result.status === 'PASS') {
    console.log(`Chunks: ${result.chunkCount}`);
    console.log(`事件: ${result.events.join(', ')}`);
    console.log(`工具: ${result.toolUse.name}`);
    console.log(`Finish Reason: ${result.finishReason}`);
  } else if (result.error) {
    console.log(`错误: ${result.error}`);
  }
  
  return result;
}

if (require.main === module) {
  runStreamingToolsTest().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runStreamingToolsTest };