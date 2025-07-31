#!/usr/bin/env node
/**
 * Step 5: 测试transformer接收到的真实数据
 * 验证数据从API响应到transformer的传递过程
 */

const fs = require('fs');

async function testStep5() {
  console.log('🔍 Step 5: Testing Transformer Input Data');
  
  // 读取Step4的输出
  if (!fs.existsSync('step4-output.json')) {
    console.error('❌ Step4 output not found. Run step4 first.');
    return { success: false };
  }
  
  const step4Data = JSON.parse(fs.readFileSync('step4-output.json', 'utf8'));
  console.log('📥 Input from Step4:', {
    apiSuccess: step4Data.success,
    hasContent: step4Data.analysis?.hasContent
  });

  let rawApiResponse;
  if (!step4Data.success) {
    console.log('⚠️  Step4 failed - using mock data for testing transformer input');
    // 创建模拟的OpenAI API响应用于测试
    rawApiResponse = {
      id: 'chatcmpl-mock123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gemini-2.5-flash',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'This is a mock response for testing transformer input processing.'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 12,
        total_tokens: 27
      }
    };
  } else {
    rawApiResponse = step4Data.output.data;
  }
  console.log('📤 Raw API Response to Transformer:', JSON.stringify(rawApiResponse, null, 2));

  // 分析transformer应该接收到的数据结构
  const dataStructureAnalysis = {
    hasId: !!(rawApiResponse.id),
    hasObject: !!(rawApiResponse.object),
    hasModel: !!(rawApiResponse.model),
    hasChoices: !!(rawApiResponse.choices && rawApiResponse.choices.length > 0),
    hasUsage: !!(rawApiResponse.usage),
    choicesCount: rawApiResponse.choices ? rawApiResponse.choices.length : 0
  };

  console.log('🔍 Data Structure Analysis:', JSON.stringify(dataStructureAnalysis, null, 2));

  // 详细分析第一个choice
  let choiceAnalysis = null;
  if (rawApiResponse.choices && rawApiResponse.choices.length > 0) {
    const firstChoice = rawApiResponse.choices[0];
    choiceAnalysis = {
      hasIndex: typeof firstChoice.index !== 'undefined',
      hasMessage: !!(firstChoice.message),
      hasFinishReason: !!(firstChoice.finish_reason),
      messageRole: firstChoice.message?.role,
      messageContent: firstChoice.message?.content,
      messageContentLength: firstChoice.message?.content?.length || 0,
      hasToolCalls: !!(firstChoice.message?.tool_calls && firstChoice.message.tool_calls.length > 0)
    };
    
    console.log('🔍 Choice Analysis:', JSON.stringify(choiceAnalysis, null, 2));
  }

  // 使用量分析
  let usageAnalysis = null;
  if (rawApiResponse.usage) {
    usageAnalysis = {
      hasPromptTokens: typeof rawApiResponse.usage.prompt_tokens !== 'undefined',
      hasCompletionTokens: typeof rawApiResponse.usage.completion_tokens !== 'undefined',
      hasTotalTokens: typeof rawApiResponse.usage.total_tokens !== 'undefined',
      promptTokens: rawApiResponse.usage.prompt_tokens,
      completionTokens: rawApiResponse.usage.completion_tokens,
      totalTokens: rawApiResponse.usage.total_tokens
    };
    
    console.log('🔍 Usage Analysis:', JSON.stringify(usageAnalysis, null, 2));
  }

  // 判断数据是否适合transformer处理
  const isTransformerReady = (
    dataStructureAnalysis.hasChoices &&
    choiceAnalysis &&
    choiceAnalysis.hasMessage &&
    typeof choiceAnalysis.messageContent !== 'undefined'
  );

  console.log('📊 Transformer Readiness:', {
    isReady: isTransformerReady,
    reason: isTransformerReady ? 'Data structure is complete' : 'Missing required fields'
  });

  const outputs = {
    timestamp: new Date().toISOString(),
    step: 'step5-transformer-input',
    input: {
      rawApiResponse
    },
    analysis: {
      dataStructure: dataStructureAnalysis,
      choice: choiceAnalysis,
      usage: usageAnalysis,
      isTransformerReady
    },
    transformerInput: rawApiResponse, // This is what transformer should receive
    success: isTransformerReady
  };

  fs.writeFileSync('step5-output.json', JSON.stringify(outputs, null, 2));
  console.log(isTransformerReady ? '✅ Step 5 completed - data ready for transformer' : '❌ Step 5 failed - data not suitable for transformer');
  
  return outputs;
}

// 运行测试
if (require.main === module) {
  testStep5().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { testStep5 };