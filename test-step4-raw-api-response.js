#!/usr/bin/env node
/**
 * Step 4: 测试真实的第三方API响应
 * 直接调用第三方API，验证其返回的原始数据
 */

const axios = require('axios');
const fs = require('fs');

async function testStep4() {
  console.log('🔍 Step 4: Testing Raw API Response');
  
  // 读取Step2的输出
  if (!fs.existsSync('step2-output.json')) {
    console.error('❌ Step2 output not found. Run step2 first.');
    return { success: false };
  }
  
  const step2Data = JSON.parse(fs.readFileSync('step2-output.json', 'utf8'));
  console.log('📥 Input from Step2:', {
    targetModel: step2Data.actualModel,
    routingSuccess: step2Data.success
  });

  // 构建直接API调用
  const apiEndpoint = 'https://ai.shuaihong.fun/v1/chat/completions';
  const targetModel = step2Data.actualModel || 'gemini-2.5-flash';
  
  const directRequest = {
    model: targetModel,
    messages: [
      { role: 'user', content: 'Hello, this is a direct API test.' }
    ],
    max_tokens: 262144,
    temperature: 0.7,
    stream: false
  };

  console.log('📤 Direct API Request:', JSON.stringify(directRequest, null, 2));

  try {
    const response = await axios.post(apiEndpoint, directRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl'
      },
      timeout: 30000
    });

    console.log('📥 Raw API Response Status:', response.status);
    console.log('📥 Raw API Response Data:', JSON.stringify(response.data, null, 2));

    // 分析响应内容
    const hasValidStructure = response.data && response.data.choices && response.data.choices.length > 0;
    const hasContent = hasValidStructure && response.data.choices[0].message && response.data.choices[0].message.content;
    const contentLength = hasContent ? response.data.choices[0].message.content.length : 0;

    console.log('📊 Response Analysis:', {
      hasValidStructure,
      hasContent,
      contentLength,
      messageContent: hasContent ? response.data.choices[0].message.content : null
    });

    const outputs = {
      timestamp: new Date().toISOString(),
      step: 'step4-raw-api-response',
      input: {
        endpoint: apiEndpoint,
        model: targetModel,
        request: directRequest
      },
      output: {
        status: response.status,
        data: response.data
      },
      analysis: {
        hasValidStructure,
        hasContent,
        contentLength
      },
      success: hasContent
    };

    fs.writeFileSync('step4-output.json', JSON.stringify(outputs, null, 2));
    console.log(hasContent ? '✅ Step 4 completed - API returned content' : '❌ Step 4 failed - no content returned');
    
    return outputs;

  } catch (error) {
    console.error('❌ Step 4 failed - API call error:', error.response?.data || error.message);
    
    const outputs = {
      timestamp: new Date().toISOString(),
      step: 'step4-raw-api-response',
      input: {
        endpoint: apiEndpoint,
        model: targetModel,
        request: directRequest
      },
      output: null,
      error: error.response?.data || error.message,
      analysis: {
        hasValidStructure: false,
        hasContent: false,
        contentLength: 0
      },
      success: false
    };

    fs.writeFileSync('step4-output.json', JSON.stringify(outputs, null, 2));
    return outputs;
  }
}

// 运行测试
if (require.main === module) {
  testStep4().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { testStep4 };