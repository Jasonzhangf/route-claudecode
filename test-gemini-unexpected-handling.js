#!/usr/bin/env node
/**
 * 测试Gemini UNEXPECTED_TOOL_CALL处理能力
 * Project owner: Jason Zhang
 */

async function testGeminiUnexpectedHandling() {
  console.log('🔧 测试Gemini UNEXPECTED_TOOL_CALL特殊处理...\n');

  try {
    // 测试1: 模拟UNEXPECTED_TOOL_CALL情况
    console.log('📊 测试1: 模拟UNEXPECTED_TOOL_CALL transformer处理');
    console.log('-'.repeat(50));

    const { GeminiTransformer } = require('./dist/transformers/gemini.js');
    const transformer = new GeminiTransformer();
    
    // 设置providerId
    transformer.setProviderId('test-provider');
    
    // 模拟UNEXPECTED_TOOL_CALL响应
    const mockUnexpectedResponse = {
      candidates: [{
        finishReason: 'UNEXPECTED_TOOL_CALL',
        content: null,  // 空内容模拟异常情况
        // 一些候选对象可能有的字段
        index: 0,
        safetyRatings: []
      }],
      usageMetadata: {
        promptTokenCount: 50,
        candidatesTokenCount: 10,
        totalTokenCount: 60
      }
    };

    console.log('🎯 模拟响应结构:');
    console.log(JSON.stringify(mockUnexpectedResponse, null, 2));

    const result = transformer.transformGeminiToAnthropic(
      mockUnexpectedResponse, 
      'gemini-2.5-flash', 
      'test-request-123'
    );

    console.log('\n✅ Transformer处理结果:');
    console.log('- stop_reason:', result.stop_reason);
    console.log('- content length:', result.content?.length);
    console.log('- content type:', result.content?.[0]?.type);
    console.log('- response includes analysis:', result.content?.[0]?.text?.includes('UNEXPECTED_TOOL_CALL'));
    console.log('- response includes technical details:', result.content?.[0]?.text?.includes('Technical Details'));

    // 测试2: 验证正常响应仍然工作
    console.log('\n📊 测试2: 验证正常文本响应仍然正常处理');
    console.log('-'.repeat(50));

    const normalResponse = {
      candidates: [{
        content: {
          parts: [{ text: '这是一个正常的文本响应。' }]
        },
        finishReason: 'STOP'
      }],
      usageMetadata: {
        promptTokenCount: 20,
        candidatesTokenCount: 15,
        totalTokenCount: 35
      }
    };

    const normalResult = transformer.transformGeminiToAnthropic(
      normalResponse, 
      'gemini-2.5-flash', 
      'test-request-456'
    );

    console.log('✅ 正常响应处理结果:');
    console.log('- stop_reason:', normalResult.stop_reason);
    console.log('- content type:', normalResult.content?.[0]?.type);
    console.log('- text content:', normalResult.content?.[0]?.text);

    // 测试3: 模拟部分内容的UNEXPECTED_TOOL_CALL
    console.log('\n📊 测试3: 模拟部分内容的UNEXPECTED_TOOL_CALL');
    console.log('-'.repeat(50));

    const partialUnexpectedResponse = {
      candidates: [{
        finishReason: 'UNEXPECTED_TOOL_CALL',
        content: {
          parts: [
            { text: 'I need to call a function...' },
            // 部分functionCall信息，但不完整
            { functionCall: { name: 'get_time' } }  // 缺少args
          ]
        }
      }],
      usageMetadata: {
        promptTokenCount: 30,
        candidatesTokenCount: 8,
        totalTokenCount: 38
      }
    };

    const partialResult = transformer.transformGeminiToAnthropic(
      partialUnexpectedResponse, 
      'gemini-2.5-flash', 
      'test-request-789'
    );

    console.log('✅ 部分内容UNEXPECTED_TOOL_CALL处理结果:');
    console.log('- stop_reason:', partialResult.stop_reason);
    console.log('- includes partial structure analysis:', partialResult.content?.[0]?.text?.includes('Detected partial response structure'));
    console.log('- includes function name detection:', partialResult.content?.[0]?.text?.includes('get_time'));

    console.log('\n🎉 所有UNEXPECTED_TOOL_CALL处理测试完成！');
    return true;

  } catch (error) {
    console.error('❌ UNEXPECTED_TOOL_CALL处理测试失败:', error.message);
    console.error('🔍 详细错误:', error.stack);
    return false;
  }
}

testGeminiUnexpectedHandling().catch(console.error);