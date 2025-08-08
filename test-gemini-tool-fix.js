#!/usr/bin/env node

/**
 * Gemini工具调用修复验证脚本
 * 测试和修复GeminiTransformer tool处理问题
 * 
 * 问题：GeminiTransformer: Invalid tool at index 0: missing function
 * 原因：工具定义格式不匹配
 */

const axios = require('axios');

// 测试配置
const BASE_URL = 'http://localhost:5502';
const TEST_TIMEOUT = 30000;

console.log('🧪 Gemini工具调用修复验证测试');
console.log('=====================================\n');

async function testBasicConnection() {
  console.log('📡 Step 1: 基础连接测试...');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ 健康检查成功:', response.data);
    return true;
  } catch (error) {
    console.error('❌ 健康检查失败:', error.message);
    return false;
  }
}

async function testSimpleTextRequest() {
  console.log('\n📝 Step 2: 简单文本请求测试...');
  
  const request = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "user", content: "Hello, how are you?" }
    ],
    max_tokens: 100
  };

  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      timeout: TEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ 简单文本请求成功');
    console.log('响应内容:', response.data.content?.[0]?.text?.substring(0, 100) + '...');
    return true;
  } catch (error) {
    console.error('❌ 简单文本请求失败:', error.response?.data || error.message);
    return false;
  }
}

async function testProblematicToolCall() {
  console.log('\n🔧 Step 3: 问题工具调用测试（期望失败）...');
  
  const request = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "user", content: "What's the weather like?" }
    ],
    tools: [
      {
        // 问题：缺少function属性 
        name: "get_weather",
        description: "Get weather information",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" }
          }
        }
      }
    ],
    max_tokens: 100
  };

  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      timeout: TEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('⚠️  问题工具调用意外成功');
    return false;
  } catch (error) {
    console.log('✅ 确认问题存在:', error.response?.data?.error?.message || error.message);
    return true;
  }
}

async function testCorrectToolCall() {
  console.log('\n🛠️  Step 4: 正确格式工具调用测试...');
  
  const request = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "user", content: "What's the weather like in Beijing?" }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather information",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string", description: "City name" }
            },
            required: ["location"]
          }
        }
      }
    ],
    max_tokens: 100
  };

  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      timeout: TEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('✅ 正确格式工具调用成功');
    console.log('响应类型:', response.data.content?.[0]?.type);
    
    if (response.data.content?.[0]?.type === 'tool_use') {
      console.log('🎯 工具调用响应正确');
      console.log('工具名:', response.data.content?.[0]?.name);
      console.log('工具参数:', JSON.stringify(response.data.content?.[0]?.input, null, 2));
    }
    
    return true;
  } catch (error) {
    console.error('❌ 正确格式工具调用失败:', error.response?.data || error.message);
    return false;
  }
}

async function main() {
  const results = {
    healthCheck: false,
    simpleText: false,
    problematicTool: false,
    correctTool: false
  };

  try {
    // 运行所有测试
    results.healthCheck = await testBasicConnection();
    if (results.healthCheck) {
      results.simpleText = await testSimpleTextRequest();
      results.problematicTool = await testProblematicToolCall();
      results.correctTool = await testCorrectToolCall();
    }

    // 输出测试结果摘要
    console.log('\n📊 测试结果摘要');
    console.log('==================');
    console.log(`🏥 健康检查: ${results.healthCheck ? '✅ 通过' : '❌ 失败'}`);
    console.log(`📝 简单文本: ${results.simpleText ? '✅ 通过' : '❌ 失败'}`);
    console.log(`🔧 问题工具: ${results.problematicTool ? '✅ 确认问题' : '❌ 未能确认'}`);
    console.log(`🛠️  正确工具: ${results.correctTool ? '✅ 通过' : '❌ 失败'}`);

    // 诊断结论
    console.log('\n🔍 诊断结论');
    console.log('================');
    if (results.problematicTool && !results.correctTool) {
      console.log('📋 问题确认: 工具定义格式错误导致转换失败');
      console.log('🔧 修复方案: 确保所有工具定义包含正确的function结构');
      console.log('📖 正确格式: { type: "function", function: { name, description, parameters } }');
    } else if (results.correctTool) {
      console.log('✅ 系统正常: 正确格式的工具调用可以成功处理');
      console.log('⚠️  注意事项: 确保客户端发送正确格式的工具定义');
    } else {
      console.log('❌ 系统异常: 需要进一步排查Gemini Provider问题');
    }

  } catch (error) {
    console.error('💥 测试异常:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}