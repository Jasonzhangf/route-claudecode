#!/usr/bin/env node
/**
 * Gemini 基本功能测试脚本
 * 测试恢复后的基本文本响应功能
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5502';

async function testBasicTextResponse() {
  console.log('🧪 测试基本文本响应功能');
  console.log('================================');

  const testRequest = {
    model: 'claude-3-sonnet-20240229',
    messages: [
      {
        role: 'user',
        content: 'Hi, can you say hello back to me?'
      }
    ],
    max_tokens: 100
  };

  try {
    console.log('📤 发送请求:', JSON.stringify({
      model: testRequest.model,
      messageCount: testRequest.messages.length
    }, null, 2));

    const response = await axios.post(`${API_BASE}/v1/messages`, testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });

    console.log('✅ 请求成功！');
    console.log('📊 响应状态:', response.status);
    console.log('📄 响应数据:', JSON.stringify(response.data, null, 2));

    // 验证响应结构
    const { data } = response;
    const checks = {
      hasId: !!data.id,
      hasModel: !!data.model,
      hasContent: !!data.content && Array.isArray(data.content),
      hasStopReason: !!data.stop_reason,
      hasUsage: !!data.usage,
      contentType: data.content?.[0]?.type === 'text',
      contentText: !!data.content?.[0]?.text
    };

    console.log('🔍 结构验证:', checks);

    const allChecksPass = Object.values(checks).every(check => check === true);
    console.log(allChecksPass ? '✅ 所有检查通过' : '❌ 存在结构问题');

    return {
      success: true,
      response: data,
      checks: checks
    };

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('📄 错误响应:', error.response.data);
      console.error('📊 状态码:', error.response.status);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

async function runTest() {
  console.log('🚀 Gemini 基本功能测试开始');
  console.log('测试服务端口: 5502');
  console.log('');

  // 检查服务状态
  try {
    await axios.get(`${API_BASE}/health`, { timeout: 5000 });
    console.log('✅ 服务状态正常');
  } catch (error) {
    console.error('❌ 服务未响应，请确保服务在端口5502运行');
    console.error('启动命令: rcc start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug');
    process.exit(1);
  }

  const result = await testBasicTextResponse();
  
  console.log('');
  console.log('📋 测试总结:');
  console.log('===========');
  console.log('基本文本响应:', result.success ? '✅ 通过' : '❌ 失败');
  
  if (result.success) {
    console.log('🎉 Gemini provider 基本功能已恢复！');
  } else {
    console.log('⚠️ 需要进一步调试');
  }
}

// 运行测试
runTest().catch(console.error);