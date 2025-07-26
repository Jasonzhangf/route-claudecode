#!/usr/bin/env node
/**
 * Step 3: 测试转换模块
 * 使用Step2的输出，单独测试transformer功能
 */

const fs = require('fs');

// 模拟transformer函数测试
function testTransformAnthropicToOpenAI(anthropicRequest) {
  console.log('🔄 Testing Anthropic to OpenAI transformation');
  
  // 模拟转换逻辑（基于实际transformer的逻辑）
  const openaiRequest = {
    model: anthropicRequest.model,
    messages: anthropicRequest.messages,
    max_tokens: anthropicRequest.max_tokens || 4096,
    temperature: anthropicRequest.temperature,
    stream: anthropicRequest.stream || false
  };
  
  // 处理system消息
  if (anthropicRequest.system) {
    openaiRequest.messages.unshift({
      role: 'system',
      content: anthropicRequest.system
    });
  }
  
  // 处理tools
  if (anthropicRequest.tools) {
    openaiRequest.tools = anthropicRequest.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.input_schema || {}
      }
    }));
  }
  
  return openaiRequest;
}

function testTransformOpenAIResponseToAnthropic(openaiResponse) {
  console.log('🔄 Testing OpenAI to Anthropic response transformation');
  
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

async function testStep3() {
  console.log('🔍 Step 3: Testing Transformation Logic');
  
  // 读取Step2的输出
  if (!fs.existsSync('step2-output.json')) {
    console.error('❌ Step2 output not found. Run step2 first.');
    return { success: false };
  }
  
  const step2Data = JSON.parse(fs.readFileSync('step2-output.json', 'utf8'));
  console.log('📥 Input from Step2:', {
    model: step2Data.input.model,
    routingSuccess: step2Data.success
  });
  
  // 测试 Anthropic -> OpenAI 转换
  console.log('\n=== Testing Anthropic to OpenAI Transform ===');
  const anthropicRequest = step2Data.input;
  console.log('📥 Anthropic Request:', JSON.stringify(anthropicRequest, null, 2));
  
  const openaiRequest = testTransformAnthropicToOpenAI(anthropicRequest);
  console.log('📤 OpenAI Request:', JSON.stringify(openaiRequest, null, 2));
  
  // 创建模拟的OpenAI响应来测试反向转换
  console.log('\n=== Testing OpenAI to Anthropic Response Transform ===');
  const mockOpenAIResponse = {
    id: 'chatcmpl-test123',
    object: 'chat.completion',
    created: Date.now(),
    model: step2Data.actualModel || 'gpt-4o',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello! This is a test response.'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 8,
      total_tokens: 18
    }
  };
  
  console.log('📥 Mock OpenAI Response:', JSON.stringify(mockOpenAIResponse, null, 2));
  
  const anthropicResponse = testTransformOpenAIResponseToAnthropic(mockOpenAIResponse);
  console.log('📤 Anthropic Response:', JSON.stringify(anthropicResponse, null, 2));
  
  // 验证转换结果
  const hasContent = anthropicResponse.content && anthropicResponse.content.length > 0;
  const hasTextContent = hasContent && anthropicResponse.content[0].type === 'text' && anthropicResponse.content[0].text;
  
  console.log('\n📊 Transformation Verification:', {
    hasContent,
    hasTextContent,
    contentLength: hasTextContent ? anthropicResponse.content[0].text.length : 0,
    outputTokens: anthropicResponse.usage.output_tokens
  });
  
  const outputs = {
    timestamp: new Date().toISOString(),
    step: 'step3-transformation',
    input: {
      anthropicRequest,
      mockOpenAIResponse
    },
    output: {
      openaiRequest,
      anthropicResponse
    },
    verification: {
      hasContent,
      hasTextContent,
      contentLength: hasTextContent ? anthropicResponse.content[0].text.length : 0
    },
    success: hasTextContent
  };
  
  fs.writeFileSync('step3-output.json', JSON.stringify(outputs, null, 2));
  console.log(hasTextContent ? '✅ Step 3 completed' : '❌ Step 3 failed - no text content');
  
  return outputs;
}

// 运行测试
if (require.main === module) {
  testStep3().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { testStep3 };