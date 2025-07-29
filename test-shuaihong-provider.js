#!/usr/bin/env node

/**
 * Shuaihong Provider专项测试
 * 专门诊断shuaihong-openai provider的gemini-2.5-pro问题
 */

const axios = require('axios');
const fs = require('fs');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// 直接测试shuaihong API
async function testShuaihongDirectly() {
  console.log('🔍 Testing shuaihong API directly...');
  
  const directRequest = {
    model: "gemini-2.5-pro",
    messages: [
      {
        role: "user",
        content: "Hello, this is a test message for shuaihong provider."
      }
    ],
    max_tokens: 100
  };
  
  let startTime;
  try {
    startTime = Date.now();
    const response = await axios.post('https://ai.shuaihong.fun/v1/chat/completions', directRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl'
      },
      timeout: 60000
    });
    
    const endTime = Date.now();
    console.log(`✅ Direct shuaihong API succeeded in ${endTime - startTime}ms`);
    console.log('📊 Response:', {
      id: response.data.id,
      model: response.data.model,
      choices: response.data.choices?.length || 0,
      usage: response.data.usage
    });
    
    return true;
  } catch (error) {
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;
    console.error(`❌ Direct shuaihong API failed after ${duration}ms`);
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    return false;
  }
}

// 通过路由器测试longcontext请求（强制路由到shuaihong）
async function testLongcontextViaRouter() {  
  console.log('🔍 Testing longcontext via router (should route to shuaihong-openai)...');
  
  // 创建longcontext请求（大文本内容 - 确保超过60K tokens）
  // 每个重复大约75个字符，相当于约18-20个tokens，需要重复约3500次才能超过60K tokens
  const longText = 'This is a very long text content that should trigger longcontext routing because it contains a lot of text. '.repeat(3500);
  const longcontextRequest = {
    model: "claude-sonnet-4-20250514", // 原始模型，应该被路由到shuaihong
    max_tokens: 100,
    messages: [
      {
        role: "user", 
        content: `${longText} Please summarize this very long text content. This request should be routed to longcontext category because it exceeds 60K tokens.`
      }
    ]
  };
  
  console.log(`📝 Request content length: ${JSON.stringify(longcontextRequest).length} characters`);
  
  let startTime;
  try {
    startTime = Date.now();
    const response = await axios.post(`${BASE_URL}/v1/messages`, longcontextRequest, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 60000
    });
    
    const endTime = Date.now();
    console.log(`✅ Longcontext via router succeeded in ${endTime - startTime}ms`);
    console.log('📊 Response:', {
      id: response.data.id,
      model: response.data.model,
      role: response.data.role,
      contentLength: JSON.stringify(response.data.content).length
    });
    
    return true;
  } catch (error) {
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;
    console.error(`❌ Longcontext via router failed after ${duration}ms`);
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // 保存错误详情到文件
    const errorLog = {
      timestamp: new Date().toISOString(),
      test: 'longcontext-via-router',
      error: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      },
      request: {
        contentLength: JSON.stringify(longcontextRequest).length,
        originalModel: longcontextRequest.model
      }
    };
    
    const logFile = `/tmp/shuaihong-error-${Date.now()}.log`;
    fs.writeFileSync(logFile, JSON.stringify(errorLog, null, 2));
    console.log(`📄 Error details saved to: ${logFile}`);
    
    return false;
  }
}

// 测试不同的gemini模型
async function testDifferentGeminiModels() {
  console.log('🔍 Testing different gemini models via shuaihong...');
  
  const models = ['gemini-2.5-pro', 'gemini-2.5-flash', 'qwen3-coder'];
  const results = {};
  
  for (const model of models) {
    console.log(`\n🧪 Testing model: ${model}`);
    
    const request = {
      model: model,
      messages: [
        {
          role: "user",
          content: "Hello, please respond briefly."
        }
      ],
      max_tokens: 50
    };
    
    try {
      const startTime = Date.now();
      const response = await axios.post('https://ai.shuaihong.fun/v1/chat/completions', request, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl'
        },
        timeout: 30000
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      results[model] = {
        status: 'success',
        duration: duration,
        responseModel: response.data.model,
        usage: response.data.usage
      };
      
      console.log(`✅ ${model} succeeded in ${duration}ms`);
      
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      results[model] = {
        status: 'failed',
        duration: duration,
        error: error.message,
        statusCode: error.response?.status,
        errorData: error.response?.data
      };
      
      console.log(`❌ ${model} failed in ${duration}ms: ${error.message}`);
    }
  }
  
  return results;
}

async function main() {
  console.log('🔧 Shuaihong Provider专项诊断测试');
  console.log('===================================');
  console.log('');
  
  // 1. 直接测试shuaihong API
  console.log('🎯 Step 1: Direct API Test');
  const directOk = await testShuaihongDirectly();
  console.log('');
  
  // 2. 测试不同的gemini模型
  console.log('🎯 Step 2: Different Models Test');
  const modelResults = await testDifferentGeminiModels();
  console.log('');
  
  // 3. 通过路由器测试longcontext
  console.log('🎯 Step 3: Longcontext via Router Test');
  const routerOk = await testLongcontextViaRouter();
  console.log('');
  
  // 4. 总结结果
  console.log('📋 Test Summary:');
  console.log('================');
  console.log(`Direct shuaihong API: ${directOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`Longcontext via router: ${routerOk ? '✅ OK' : '❌ FAILED'}`);
  console.log('');
  console.log('🤖 Model Test Results:');
  for (const [model, result] of Object.entries(modelResults)) {
    const status = result.status === 'success' ? '✅' : '❌';
    const duration = result.duration || 0;
    console.log(`   ${status} ${model}: ${result.status} (${duration}ms)`);
    if (result.status === 'failed') {
      console.log(`      Error: ${result.error}`);
    }
  }
  
  // 5. 问题诊断
  console.log('');
  console.log('💡 问题诊断:');
  console.log('============');
  
  if (!directOk) {
    console.log('❌ shuaihong API本身有问题，可能是：');
    console.log('   - API key无效或过期');
    console.log('   - 服务器不可用或网络问题');
    console.log('   - 模型不存在或不可用');
  } else if (!routerOk) {
    console.log('❌ 路由器转换有问题，可能是：');
    console.log('   - Anthropic → OpenAI格式转换问题');
    console.log('   - 请求头或参数映射错误');
    console.log('   - 超时或错误处理问题');
  } else {
    console.log('✅ shuaihong provider工作正常');
  }
  
  const hasFailedModels = Object.values(modelResults).some(r => r.status === 'failed');
  if (hasFailedModels) {
    console.log('⚠️  某些gemini模型有问题，建议切换到工作正常的模型');
  }
  
  process.exit((directOk && routerOk) ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}