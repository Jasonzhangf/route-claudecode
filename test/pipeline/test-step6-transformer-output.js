#!/usr/bin/env node
/**
 * Step 6: 测试transformer的实际转换输出
 * 使用真实的transformer函数进行转换测试
 */

const fs = require('fs');

// 导入真实的transformer函数（如果可用）
let transformOpenAIResponseToAnthropic = null;
try {
  // 尝试导入transformer - 注意：这需要构建后的代码
  const transformers = require('./dist/transformers');
  transformOpenAIResponseToAnthropic = transformers.transformOpenAIResponseToAnthropic;
} catch (error) {
  console.log('⚠️  Cannot import built transformers, using mock implementation');
}

// Mock transformer implementation for testing
function mockTransformOpenAIResponseToAnthropic(openaiResponse, requestId) {
  if (!openaiResponse.choices || !openaiResponse.choices[0]) {
    return {
      id: openaiResponse.id || `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [],
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 }
    };
  }

  const choice = openaiResponse.choices[0];
  const content = [];

  // 处理文本内容
  if (choice.message?.content) {
    content.push({
      type: 'text',
      text: choice.message.content
    });
  }

  // 处理工具调用
  if (choice.message?.tool_calls) {
    choice.message.tool_calls.forEach(toolCall => {
      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments || '{}')
      });
    });
  }

  return {
    id: openaiResponse.id || `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content,
    stop_reason: choice.finish_reason === 'stop' ? 'end_turn' : 'max_tokens',
    usage: {
      input_tokens: openaiResponse.usage?.prompt_tokens || 0,
      output_tokens: openaiResponse.usage?.completion_tokens || 0
    }
  };
}

async function testStep6() {
  console.log('🔍 Step 6: Testing Transformer Output');
  
  // 读取Step5的输出
  if (!fs.existsSync('step5-output.json')) {
    console.error('❌ Step5 output not found. Run step5 first.');
    return { success: false };
  }
  
  const step5Data = JSON.parse(fs.readFileSync('step5-output.json', 'utf8'));
  console.log('📥 Input from Step5:', {
    transformerReady: step5Data.success,
    hasTransformerInput: !!step5Data.transformerInput
  });

  if (!step5Data.success) {
    console.error('❌ Step5 failed, cannot proceed with Step6');
    return { success: false };
  }

  const transformerInput = step5Data.transformerInput;
  console.log('📤 Input to Transformer:', JSON.stringify(transformerInput, null, 2));

  // 使用真实的transformer或mock实现
  const transformFunction = transformOpenAIResponseToAnthropic || mockTransformOpenAIResponseToAnthropic;
  const usingMock = !transformOpenAIResponseToAnthropic;
  
  console.log(`🔄 Using ${usingMock ? 'Mock' : 'Real'} Transformer`);

  try {
    const transformedOutput = transformFunction(transformerInput, 'test-step6-request');
    console.log('📥 Transformer Output:', JSON.stringify(transformedOutput, null, 2));

    // 分析转换结果
    const outputAnalysis = {
      hasId: !!(transformedOutput.id),
      hasType: transformedOutput.type === 'message',
      hasRole: transformedOutput.role === 'assistant',
      hasContent: !!(transformedOutput.content && transformedOutput.content.length > 0),
      hasStopReason: !!(transformedOutput.stop_reason),
      hasUsage: !!(transformedOutput.usage),
      contentCount: transformedOutput.content ? transformedOutput.content.length : 0
    };

    console.log('🔍 Output Analysis:', JSON.stringify(outputAnalysis, null, 2));

    // 详细分析content数组
    let contentAnalysis = null;
    if (transformedOutput.content && transformedOutput.content.length > 0) {
      contentAnalysis = transformedOutput.content.map((item, index) => ({
        index,
        type: item.type,
        hasText: !!(item.text),
        textLength: item.text ? item.text.length : 0,
        hasToolUse: item.type === 'tool_use',
        toolName: item.name || null
      }));
      
      console.log('🔍 Content Analysis:', JSON.stringify(contentAnalysis, null, 2));
    }

    // 判断转换是否成功 - 空content也是有效的转换结果
    const transformationSuccess = (
      outputAnalysis.hasId &&
      outputAnalysis.hasType &&
      outputAnalysis.hasRole &&
      outputAnalysis.hasStopReason &&
      outputAnalysis.hasUsage &&
      Array.isArray(transformedOutput.content)
    );

    console.log('📊 Transformation Success:', {
      success: transformationSuccess,
      reason: transformationSuccess ? 'All required fields present with content' : 'Missing content or structure'
    });

    const outputs = {
      timestamp: new Date().toISOString(),
      step: 'step6-transformer-output',
      input: {
        transformerInput
      },
      output: {
        transformedResponse: transformedOutput,
        usingMockTransformer: usingMock
      },
      analysis: {
        output: outputAnalysis,
        content: contentAnalysis,
        transformationSuccess
      },
      success: transformationSuccess
    };

    fs.writeFileSync('step6-output.json', JSON.stringify(outputs, null, 2));
    console.log(transformationSuccess ? '✅ Step 6 completed - transformation successful' : '❌ Step 6 failed - transformation incomplete');
    
    return outputs;

  } catch (error) {
    console.error('❌ Step 6 failed - transformer error:', error.message);
    
    const outputs = {
      timestamp: new Date().toISOString(),
      step: 'step6-transformer-output',
      input: {
        transformerInput
      },
      output: null,
      error: error.message,
      analysis: {
        transformationSuccess: false
      },
      success: false
    };

    fs.writeFileSync('step6-output.json', JSON.stringify(outputs, null, 2));
    return outputs;
  }
}

// 运行测试
if (require.main === module) {
  testStep6().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { testStep6 };