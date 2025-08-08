#!/usr/bin/env node
/**
 * OpenAI Provider 3456端口工具调用结果处理测试
 * 测试完整的工具调用流程：调用 -> 结果 -> 最终响应
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

class OpenAIToolResultTest {
  constructor() {
    this.baseURL = 'http://localhost:3456';
  }

  /**
   * 测试完整的工具调用结果处理流程
   */
  async testToolCallResultHandling() {
    console.log('🧪 测试OpenAI Provider工具调用结果处理');
    console.log('=' .repeat(60));

    try {
      // 第一步：发起工具调用
      console.log('\n📤 第一步：发起工具调用请求');
      const toolCallRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: '请计算 25 * 8 的结果' }]
          }
        ],
        max_tokens: 200,
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

      const toolCallResponse = await axios.post(`${this.baseURL}/v1/messages`, toolCallRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      console.log('✅ 工具调用响应接收成功');
      console.log(`📋 Stop Reason: ${toolCallResponse.data.stop_reason}`);
      
      // 提取工具调用信息
      const toolUse = toolCallResponse.data.content.find(c => c.type === 'tool_use');
      if (!toolUse) {
        throw new Error('未找到工具调用');
      }

      console.log(`🔧 工具名称: ${toolUse.name}`);
      console.log(`📝 工具参数: ${JSON.stringify(toolUse.input)}`);
      console.log(`🆔 工具ID: ${toolUse.id}`);

      // 第二步：模拟工具执行并返回结果
      console.log('\n📥 第二步：发送工具执行结果');
      const toolResult = {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: '计算结果: 25 * 8 = 200'
          }
        ]
      };

      const resultRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: '请计算 25 * 8 的结果' }]
          },
          {
            role: 'assistant',
            content: toolCallResponse.data.content
          },
          toolResult
        ],
        max_tokens: 200
      };

      const finalResponse = await axios.post(`${this.baseURL}/v1/messages`, resultRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      console.log('✅ 工具结果处理响应接收成功');
      console.log(`📋 Stop Reason: ${finalResponse.data.stop_reason}`);
      
      const finalText = this.extractTextContent(finalResponse.data);
      console.log(`💬 最终响应: ${finalText}`);

      // 验证完整流程
      const isValidFlow = 
        toolCallResponse.data.stop_reason === 'tool_use' &&
        toolUse &&
        finalResponse.data.stop_reason === 'end_turn' &&
        finalText.length > 0;

      if (isValidFlow) {
        console.log('\n🎉 工具调用结果处理流程完全正确！');
        return {
          status: 'PASS',
          toolCall: {
            name: toolUse.name,
            input: toolUse.input,
            id: toolUse.id
          },
          finalResponse: finalText,
          stopReasons: {
            toolCall: toolCallResponse.data.stop_reason,
            final: finalResponse.data.stop_reason
          }
        };
      } else {
        console.log('\n❌ 工具调用结果处理流程存在问题');
        return {
          status: 'FAIL',
          error: '流程验证失败'
        };
      }

    } catch (error) {
      console.error('🚨 工具调用结果处理测试失败:', error.message);
      return {
        status: 'ERROR',
        error: error.message
      };
    }
  }

  /**
   * 提取文本内容
   */
  extractTextContent(response) {
    const textBlocks = response.content.filter(c => c.type === 'text');
    return textBlocks.map(c => c.text).join('');
  }
}

// 运行测试
async function runToolResultTest() {
  const tester = new OpenAIToolResultTest();
  const result = await tester.testToolCallResultHandling();
  
  console.log('\n📊 测试结果总结');
  console.log('=' .repeat(40));
  console.log(`状态: ${result.status}`);
  
  if (result.status === 'PASS') {
    console.log(`工具调用: ${result.toolCall.name}`);
    console.log(`工具参数: ${JSON.stringify(result.toolCall.input)}`);
    console.log(`Stop Reasons: ${result.stopReasons.toolCall} -> ${result.stopReasons.final}`);
  } else if (result.error) {
    console.log(`错误: ${result.error}`);
  }
  
  return result;
}

if (require.main === module) {
  runToolResultTest().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runToolResultTest };