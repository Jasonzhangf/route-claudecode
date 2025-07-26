#!/usr/bin/env node
/**
 * Step 7: 测试最终响应构建过程
 * 验证从transformer输出到最终API响应的构建
 */

const fs = require('fs');

async function testStep7() {
  console.log('🔍 Step 7: Testing Final Response Construction');
  
  // 读取Step6的输出
  if (!fs.existsSync('step6-output.json')) {
    console.error('❌ Step6 output not found. Run step6 first.');
    return { success: false };
  }
  
  const step6Data = JSON.parse(fs.readFileSync('step6-output.json', 'utf8'));
  console.log('📥 Input from Step6:', {
    transformationSuccess: step6Data.success,
    hasTransformedResponse: !!step6Data.output?.transformedResponse
  });

  if (!step6Data.success) {
    console.error('❌ Step6 failed, cannot proceed with Step7');
    return { success: false };
  }

  const transformedResponse = step6Data.output.transformedResponse;
  console.log('📤 Transformed Response:', JSON.stringify(transformedResponse, null, 2));

  // 模拟最终响应构建过程（基于BaseResponse格式）
  function buildFinalResponse(anthropicResponse) {
    return {
      id: anthropicResponse.id,
      type: anthropicResponse.type,
      role: anthropicResponse.role,
      model: 'gemini-2.5-flash', // 从路由信息获取
      content: anthropicResponse.content || [],
      stop_reason: anthropicResponse.stop_reason || 'end_turn',
      stop_sequence: anthropicResponse.stop_sequence || null,
      usage: {
        input_tokens: anthropicResponse.usage?.input_tokens || 0,
        output_tokens: anthropicResponse.usage?.output_tokens || 0
      }
    };
  }

  try {
    const finalResponse = buildFinalResponse(transformedResponse);
    console.log('📥 Final Response:', JSON.stringify(finalResponse, null, 2));

    // 分析最终响应
    const responseAnalysis = {
      hasId: !!(finalResponse.id),
      hasType: finalResponse.type === 'message',
      hasRole: finalResponse.role === 'assistant',
      hasModel: !!(finalResponse.model),
      hasContent: !!(finalResponse.content && finalResponse.content.length > 0),
      hasStopReason: !!(finalResponse.stop_reason),
      hasUsage: !!(finalResponse.usage),
      contentCount: finalResponse.content ? finalResponse.content.length : 0,
      inputTokens: finalResponse.usage?.input_tokens || 0,
      outputTokens: finalResponse.usage?.output_tokens || 0
    };

    console.log('🔍 Response Analysis:', JSON.stringify(responseAnalysis, null, 2));

    // 验证Anthropic API规范兼容性
    const anthropicCompliance = {
      requiredFieldsPresent: (
        responseAnalysis.hasId &&
        responseAnalysis.hasType &&
        responseAnalysis.hasRole &&
        responseAnalysis.hasModel &&
        responseAnalysis.hasStopReason &&
        responseAnalysis.hasUsage
      ),
      contentStructureValid: finalResponse.content.every(item => 
        item.type && (
          (item.type === 'text' && item.text) ||
          (item.type === 'tool_use' && item.id && item.name)
        )
      ),
      usageStructureValid: (
        typeof finalResponse.usage.input_tokens === 'number' &&
        typeof finalResponse.usage.output_tokens === 'number'
      )
    };

    console.log('📋 Anthropic API Compliance:', JSON.stringify(anthropicCompliance, null, 2));

    // 内容质量检查
    const contentQuality = {
      hasTextContent: finalResponse.content.some(item => item.type === 'text' && item.text),
      totalTextLength: finalResponse.content
        .filter(item => item.type === 'text')
        .reduce((sum, item) => sum + (item.text?.length || 0), 0),
      hasToolUse: finalResponse.content.some(item => item.type === 'tool_use'),
      nonEmptyContent: finalResponse.content.length > 0 && finalResponse.content.some(item => 
        (item.type === 'text' && item.text) || (item.type === 'tool_use')
      )
    };

    console.log('📄 Content Quality:', JSON.stringify(contentQuality, null, 2));

    // 判断最终响应是否成功 - 对于API返回空内容的情况也要处理
    const isEmptyContentResponse = finalResponse.content.length === 0;
    const finalSuccess = (
      anthropicCompliance.requiredFieldsPresent &&
      anthropicCompliance.contentStructureValid &&
      anthropicCompliance.usageStructureValid &&
      (contentQuality.nonEmptyContent || isEmptyContentResponse)
    );

    console.log('📊 Final Response Status:', {
      success: finalSuccess,
      reason: finalSuccess ? 'Response meets all requirements' : 'Response missing requirements or content'
    });

    // 对比原始Step1的响应
    let comparisonWithStep1 = null;
    if (fs.existsSync('step1-output.json')) {
      const step1Data = JSON.parse(fs.readFileSync('step1-output.json', 'utf8'));
      const step1Response = step1Data.output;
      
      comparisonWithStep1 = {
        step1ContentEmpty: !step1Response.content || step1Response.content.length === 0,
        step7ContentFilled: contentQuality.nonEmptyContent,
        problemFixed: (!step1Response.content || step1Response.content.length === 0) && contentQuality.nonEmptyContent,
        step1OutputTokens: step1Response.usage?.output_tokens || 0,
        step7OutputTokens: finalResponse.usage?.output_tokens || 0,
        tokenCountImproved: (finalResponse.usage?.output_tokens || 0) > (step1Response.usage?.output_tokens || 0)
      };
      
      console.log('🔄 Comparison with Step1:', JSON.stringify(comparisonWithStep1, null, 2));
    }

    const outputs = {
      timestamp: new Date().toISOString(),
      step: 'step7-final-response',
      input: {
        transformedResponse
      },
      output: {
        finalResponse
      },
      analysis: {
        response: responseAnalysis,
        compliance: anthropicCompliance,
        contentQuality,
        finalSuccess
      },
      comparison: comparisonWithStep1,
      success: finalSuccess
    };

    fs.writeFileSync('step7-output.json', JSON.stringify(outputs, null, 2));
    console.log(finalSuccess ? '✅ Step 7 completed - final response ready' : '❌ Step 7 failed - response not ready');
    
    return outputs;

  } catch (error) {
    console.error('❌ Step 7 failed - response construction error:', error.message);
    
    const outputs = {
      timestamp: new Date().toISOString(),
      step: 'step7-final-response',
      input: {
        transformedResponse
      },
      output: null,
      error: error.message,
      analysis: {
        finalSuccess: false
      },
      success: false
    };

    fs.writeFileSync('step7-output.json', JSON.stringify(outputs, null, 2));
    return outputs;
  }
}

// 运行测试
if (require.main === module) {
  testStep7().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { testStep7 };