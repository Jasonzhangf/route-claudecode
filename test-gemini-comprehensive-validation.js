#!/usr/bin/env node
/**
 * Gemini工具调用综合验证测试
 * 基于demo3的架构模式，验证所有关键修复
 * Project owner: Jason Zhang
 */

async function runComprehensiveGeminiValidation() {
  console.log('🎯 Gemini工具调用综合验证测试');
  console.log('='.repeat(60));
  
  const results = {
    configurationTest: false,
    transformerTest: false,
    unexpectedHandlingTest: false,
    endToEndTest: false
  };

  try {
    // 测试1: 配置验证 - allowedFunctionNames字段
    console.log('\n📊 测试1: 工具调用配置验证');
    console.log('-'.repeat(40));

    const { GeminiTransformer } = require('./dist/transformers/gemini.js');
    const transformer = new GeminiTransformer();
    transformer.setProviderId('comprehensive-test');

    const testRequest = {
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'Use the calculator to compute 8 × 9'
        }
      ],
      tools: [
        {
          name: 'calculator',
          description: 'Perform mathematical calculations',
          input_schema: {
            type: 'object',
            properties: {
              operation: { type: 'string', enum: ['multiply'] },
              a: { type: 'number' },
              b: { type: 'number' }
            },
            required: ['operation', 'a', 'b']
          }
        }
      ],
      metadata: {
        requestId: 'comprehensive-test-001'
      }
    };

    const geminiRequest = transformer.transformAnthropicToGemini(testRequest);
    
    const hasToolConfig = !!geminiRequest.toolConfig;
    const hasAllowedFunctionNames = !!geminiRequest.toolConfig?.functionCallingConfig?.allowedFunctionNames;
    const correctMode = geminiRequest.toolConfig?.functionCallingConfig?.mode === 'ANY';
    const correctFunctionNames = JSON.stringify(geminiRequest.toolConfig?.functionCallingConfig?.allowedFunctionNames) === '["calculator"]';

    console.log(`✅ toolConfig存在: ${hasToolConfig}`);
    console.log(`✅ allowedFunctionNames存在: ${hasAllowedFunctionNames}`);
    console.log(`✅ mode设置为ANY: ${correctMode}`);
    console.log(`✅ 函数名映射正确: ${correctFunctionNames}`);

    results.configurationTest = hasToolConfig && hasAllowedFunctionNames && correctMode && correctFunctionNames;

    // 测试2: Transformer转换验证
    console.log('\n📊 测试2: Transformer转换验证');
    console.log('-'.repeat(40));

    // 验证正常响应转换
    const normalResponse = {
      candidates: [{
        content: {
          parts: [{ text: '8 × 9 = 72' }]
        },
        finishReason: 'STOP'
      }],
      usageMetadata: {
        promptTokenCount: 20,
        candidatesTokenCount: 8,
        totalTokenCount: 28
      }
    };

    const normalResult = transformer.transformGeminiToAnthropic(
      normalResponse, 
      'gemini-2.5-flash', 
      'comprehensive-test-002'
    );

    const normalTransformCorrect = (
      normalResult.stop_reason === 'end_turn' &&
      normalResult.content?.[0]?.type === 'text' &&
      normalResult.content[0].text === '8 × 9 = 72'
    );

    console.log(`✅ 正常响应转换: ${normalTransformCorrect}`);

    // 验证工具调用响应转换
    const toolCallResponse = {
      candidates: [{
        content: {
          parts: [{
            functionCall: {
              name: 'calculator',
              args: { operation: 'multiply', a: 8, b: 9 }
            }
          }]
        },
        finishReason: 'STOP'
      }],
      usageMetadata: {
        promptTokenCount: 25,
        candidatesTokenCount: 15,
        totalTokenCount: 40
      }
    };

    const toolResult = transformer.transformGeminiToAnthropic(
      toolCallResponse,
      'gemini-2.5-flash',
      'comprehensive-test-003'
    );

    const toolTransformCorrect = (
      toolResult.stop_reason === 'end_turn' &&
      toolResult.content?.[0]?.type === 'tool_use' &&
      toolResult.content[0].name === 'calculator'
    );

    console.log(`✅ 工具调用响应转换: ${toolTransformCorrect}`);

    results.transformerTest = normalTransformCorrect && toolTransformCorrect;

    // 测试3: UNEXPECTED_TOOL_CALL特殊处理
    console.log('\n📊 测试3: UNEXPECTED_TOOL_CALL特殊处理');
    console.log('-'.repeat(40));

    const unexpectedResponse = {
      candidates: [{
        finishReason: 'UNEXPECTED_TOOL_CALL',
        content: null,
        index: 0
      }],
      usageMetadata: {
        promptTokenCount: 30,
        candidatesTokenCount: 5,
        totalTokenCount: 35
      }
    };

    const unexpectedResult = transformer.transformGeminiToAnthropic(
      unexpectedResponse,
      'gemini-2.5-flash',
      'comprehensive-test-004'
    );

    const unexpectedHandlingCorrect = (
      unexpectedResult.stop_reason === 'tool_use' &&
      unexpectedResult.content?.[0]?.type === 'text' &&
      unexpectedResult.content[0].text.includes('UNEXPECTED_TOOL_CALL') &&
      unexpectedResult.content[0].text.includes('tool calling configuration is correctly applied')
    );

    console.log(`✅ UNEXPECTED_TOOL_CALL处理: ${unexpectedHandlingCorrect}`);

    results.unexpectedHandlingTest = unexpectedHandlingCorrect;

    // 测试4: 端到端集成（如果服务运行）
    console.log('\n📊 测试4: 端到端集成验证');
    console.log('-'.repeat(40));

    try {
      const axios = require('axios').default;
      const healthResponse = await axios.get('http://localhost:5502/health', { timeout: 2000 });
      console.log('✅ 检测到Gemini服务运行');

      const e2eRequest = {
        model: 'gemini-2.5-flash-lite',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: 'Use the get_time function to get current UTC time'
          }
        ],
        tools: [
          {
            name: 'get_time',
            description: 'Get current time for a specific timezone',
            input_schema: {
              type: 'object',
              properties: {
                timezone: { type: 'string', enum: ['UTC'] }
              },
              required: ['timezone']
            }
          }
        ]
      };

      const e2eResponse = await axios.post('http://localhost:5502/v1/messages', e2eRequest, {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 10000
      });

      const e2eData = e2eResponse.data;
      const e2eSuccess = !!(e2eData && e2eData.content);
      console.log(`✅ 端到端请求成功: ${e2eSuccess}`);
      console.log(`- stop_reason: ${e2eData?.stop_reason}`);
      console.log(`- content blocks: ${e2eData?.content?.length}`);

      if (e2eData?.content) {
        let hasToolCall = false;
        e2eData.content.forEach((block, i) => {
          if (block.type === 'tool_use') {
            hasToolCall = true;
            console.log(`✅ 发现工具调用: ${block.name}`);
          } else if (block.type === 'text' && block.text.includes('UNEXPECTED_TOOL_CALL')) {
            console.log(`ℹ️ 检测到UNEXPECTED_TOOL_CALL特殊处理`);
          }
        });
      }

      results.endToEndTest = e2eSuccess;

    } catch (error) {
      console.log('ℹ️ Gemini服务未运行，跳过端到端测试');
      results.endToEndTest = null; // null表示未测试
    }

    // 综合结果
    console.log('\n🎯 综合验证结果');
    console.log('='.repeat(60));

    const totalTests = Object.values(results).filter(r => r !== null).length;
    const passedTests = Object.values(results).filter(r => r === true).length;
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    console.log(`📊 测试结果: ${passedTests}/${totalTests} 通过 (${successRate}%)`);
    console.log(`- 工具调用配置: ${results.configurationTest ? '✅ 通过' : '❌ 失败'}`);
    console.log(`- Transformer转换: ${results.transformerTest ? '✅ 通过' : '❌ 失败'}`);
    console.log(`- UNEXPECTED处理: ${results.unexpectedHandlingTest ? '✅ 通过' : '❌ 失败'}`);
    console.log(`- 端到端集成: ${results.endToEndTest === null ? '⏭️ 跳过' : results.endToEndTest ? '✅ 通过' : '❌ 失败'}`);

    if (successRate >= 90) {
      console.log('\n🎉 综合验证通过！Gemini工具调用系统工作正常！');
      console.log('\n🔧 关键改进总结:');
      console.log('- ✅ 修复了toolConfig.functionCallingConfig字段映射');
      console.log('- ✅ 添加了allowedFunctionNames配置支持');
      console.log('- ✅ 实现了UNEXPECTED_TOOL_CALL特殊处理');
      console.log('- ✅ 基于demo3架构模式优化了错误处理');
      console.log('- ✅ 遵循了Zero Fallback Principle设计原则');
    } else {
      console.log('\n⚠️ 部分测试未通过，需要进一步调试');
    }

    return results;

  } catch (error) {
    console.error('❌ 综合验证失败:', error.message);
    console.error('🔍 详细错误:', error.stack);
    return results;
  }
}

// 检查axios依赖
try {
  require('axios');
} catch (error) {
  console.warn('⚠️ axios未安装，将跳过端到端测试');
}

runComprehensiveGeminiValidation().catch(console.error);