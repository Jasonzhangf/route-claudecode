#!/usr/bin/env node
/**
 * OpenAI Provider核心功能测试
 * 专注于工具调用、响应和finish reason传递
 */

const axios = require('axios');

class OpenAICoreTest {
  constructor() {
    this.baseURL = 'http://localhost:3456';
  }

  /**
   * 测试1: 基本工具调用和finish reason
   */
  async testBasicToolCall() {
    console.log('🧪 测试1: 基本工具调用和finish reason');
    console.log('-'.repeat(50));

    const request = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '请计算 15 + 27' }]
        }
      ],
      max_tokens: 200,
      tools: [
        {
          name: 'calculate',
          description: '执行数学计算',
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
      const response = await axios.post(`${this.baseURL}/v1/messages`, request, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      console.log(`✅ 响应状态: ${response.status}`);
      console.log(`📋 Stop Reason: ${response.data.stop_reason}`);
      console.log(`🔧 Content Blocks: ${response.data.content.length}`);
      
      const toolCalls = response.data.content.filter(c => c.type === 'tool_use');
      const textBlocks = response.data.content.filter(c => c.type === 'text');
      
      console.log(`🛠️  工具调用数量: ${toolCalls.length}`);
      console.log(`📝 文本块数量: ${textBlocks.length}`);
      
      if (toolCalls.length > 0) {
        toolCalls.forEach((tool, index) => {
          console.log(`   工具${index + 1}: ${tool.name} - ${JSON.stringify(tool.input)}`);
        });
      }

      // 验证finish reason
      const expectedFinishReason = toolCalls.length > 0 ? 'tool_use' : 'end_turn';
      const isFinishReasonCorrect = response.data.stop_reason === expectedFinishReason;
      
      console.log(`🎯 Finish Reason验证: ${isFinishReasonCorrect ? '✅ 正确' : '❌ 错误'}`);
      console.log(`   期望: ${expectedFinishReason}, 实际: ${response.data.stop_reason}`);

      return {
        success: true,
        stopReason: response.data.stop_reason,
        toolCallsCount: toolCalls.length,
        finishReasonCorrect: isFinishReasonCorrect
      };

    } catch (error) {
      console.error('❌ 测试失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 测试2: 流式工具调用
   */
  async testStreamingToolCall() {
    console.log('\n🧪 测试2: 流式工具调用');
    console.log('-'.repeat(50));

    const request = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '请计算 42 / 6' }]
        }
      ],
      max_tokens: 200,
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
      let finishReason = null;
      let toolData = null;

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
                console.log('📨 收到 message_start');
              } else if (event === 'content_block_start') {
                console.log('🔧 收到 content_block_start');
              } else if (event === 'message_stop') {
                hasMessageStop = true;
                console.log('🛑 收到 message_stop');
              }
            } else if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'content_block_start' && data.content_block?.type === 'tool_use') {
                  hasToolUse = true;
                  toolData = data.content_block;
                  console.log(`🛠️  检测到工具调用: ${toolData.name}`);
                }
                
                if (data.type === 'message_delta' && data.delta?.stop_reason) {
                  finishReason = data.delta.stop_reason;
                  console.log(`📋 Finish Reason: ${finishReason}`);
                }
              } catch (e) {
                // 忽略JSON解析错误
              }
            }
          }

          if (chunkCount > 100) {
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

          const isValid = hasMessageStart && hasToolUse && hasMessageStop && finishReason === 'tool_use';
          
          console.log(`🎯 流式工具调用验证: ${isValid ? '✅ 通过' : '❌ 失败'}`);

          resolve({
            success: isValid,
            chunkCount,
            events: [...new Set(events)],
            hasMessageStart,
            hasToolUse,
            hasMessageStop,
            finishReason,
            toolData
          });
        });

        response.data.on('error', (error) => {
          console.error('🚨 流式响应错误:', error.message);
          resolve({ success: false, error: error.message });
        });
      });

    } catch (error) {
      console.error('❌ 流式测试失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 测试3: 工具调用结果处理
   */
  async testToolResultHandling() {
    console.log('\n🧪 测试3: 工具调用结果处理');
    console.log('-'.repeat(50));

    // 第一步：发起工具调用
    const toolCallRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: '请计算 25 * 8' }]
        }
      ],
      max_tokens: 200,
      tools: [
        {
          name: 'calculate',
          description: '数学计算',
          input_schema: {
            type: 'object',
            properties: { expression: { type: 'string' } },
            required: ['expression']
          }
        }
      ]
    };

    try {
      console.log('📤 第一步：发起工具调用');
      const toolResponse = await axios.post(`${this.baseURL}/v1/messages`, toolCallRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      console.log(`✅ 工具调用响应: ${toolResponse.data.stop_reason}`);
      
      const toolCall = toolResponse.data.content.find(c => c.type === 'tool_use');
      if (!toolCall) {
        throw new Error('未找到工具调用');
      }

      console.log(`🔧 工具: ${toolCall.name}, 参数: ${JSON.stringify(toolCall.input)}`);

      // 第二步：发送工具结果
      const resultRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: '请计算 25 * 8' }]
          },
          {
            role: 'assistant',
            content: toolResponse.data.content
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content: '200'
              }
            ]
          }
        ],
        max_tokens: 200
      };

      console.log('📥 第二步：发送工具结果');
      const finalResponse = await axios.post(`${this.baseURL}/v1/messages`, resultRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      console.log(`✅ 最终响应: ${finalResponse.data.stop_reason}`);
      
      const finalText = finalResponse.data.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('');
      
      console.log(`💬 最终回复: ${finalText.substring(0, 100)}...`);

      const isValid = toolResponse.data.stop_reason === 'tool_use' && 
                     finalResponse.data.stop_reason === 'end_turn';

      console.log(`🎯 工具结果处理验证: ${isValid ? '✅ 通过' : '❌ 失败'}`);

      return {
        success: isValid,
        toolCallStopReason: toolResponse.data.stop_reason,
        finalStopReason: finalResponse.data.stop_reason,
        toolCall: toolCall,
        finalText: finalText.substring(0, 200)
      };

    } catch (error) {
      console.error('❌ 工具结果处理测试失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 OpenAI Provider核心功能测试');
    console.log('='.repeat(60));
    console.log(`测试时间: ${new Date().toISOString()}`);
    console.log(`测试端口: 3456`);

    const results = {
      basicToolCall: await this.testBasicToolCall(),
      streamingToolCall: await this.testStreamingToolCall(),
      toolResultHandling: await this.testToolResultHandling()
    };

    console.log('\n📊 测试结果总结');
    console.log('='.repeat(60));
    
    let passedTests = 0;
    let totalTests = 3;

    Object.entries(results).forEach(([testName, result]) => {
      const status = result.success ? '✅ 通过' : '❌ 失败';
      console.log(`${testName}: ${status}`);
      if (result.success) passedTests++;
      if (result.error) {
        console.log(`  错误: ${result.error}`);
      }
    });

    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    console.log(`\n🎯 总体结果: ${passedTests}/${totalTests} 通过 (${successRate}%)`);
    
    if (passedTests === totalTests) {
      console.log('🎉 所有核心功能测试通过！');
    } else {
      console.log('⚠️  部分测试失败，需要修复');
    }

    return results;
  }
}

// 运行测试
async function runCoreTests() {
  const tester = new OpenAICoreTest();
  return await tester.runAllTests();
}

if (require.main === module) {
  runCoreTests().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runCoreTests };