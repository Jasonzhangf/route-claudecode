#!/usr/bin/env node

/**
 * Longcontext路由诊断测试
 * 专门测试longcontext类别的路由和API调用问题
 */

const axios = require('axios');
const fs = require('fs');

const TEST_PORT = 3457;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// 创建一个大文本内容来触发longcontext路由
const createLongContextMessage = () => {
  const longText = 'A'.repeat(80000); // 80K字符，应该触发longcontext类别
  return {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `Here is a very long text that should trigger longcontext routing: ${longText}. Please summarize this text.`
      }
    ]
  };
};

// 创建普通请求作为对比
const createNormalMessage = () => {
  return {
    model: "claude-sonnet-4-20250514", 
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: "Hello, this is a normal short message."
      }
    ]
  };
};

async function testRouterStatus() {
  console.log('🔍 Testing router status...');
  try {
    const response = await axios.get(`${BASE_URL}/status`);
    console.log('✅ Router status:', response.data);
    
    const longcontextConfig = response.data.routing?.routing?.longcontext;
    console.log('📋 Longcontext routing config:', longcontextConfig);
    
    return true;
  } catch (error) {
    console.error('❌ Router status check failed:', error.message);
    return false;
  }
}

async function testLongcontextRouting() {
  console.log('\\n🧪 Testing longcontext routing...');
  
  const longMessage = createLongContextMessage();
  const logFile = `/tmp/longcontext-test-${Date.now()}.log`;
  let startTime;
  
  console.log(`📝 Request content length: ${JSON.stringify(longMessage).length} characters`);
  console.log(`📄 Log file: ${logFile}`);
  
  try {
    startTime = Date.now();
    console.log('🚀 Sending longcontext request...');
    
    const response = await axios.post(`${BASE_URL}/v1/messages`, longMessage, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 60000, // 60秒超时
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Longcontext request succeeded in ${duration}ms`);
    console.log('📊 Response data:', {
      id: response.data.id,
      model: response.data.model,
      role: response.data.role,
      contentLength: JSON.stringify(response.data.content).length
    });
    
    // 保存测试结果
    const testResult = {
      timestamp: new Date().toISOString(),
      test: 'longcontext-routing',
      status: 'success',
      duration: duration,
      request: {
        model: longMessage.model,
        contentLength: JSON.stringify(longMessage).length
      },
      response: {
        id: response.data.id,
        model: response.data.model,
        role: response.data.role,
        contentLength: JSON.stringify(response.data.content).length
      }
    };
    
    fs.writeFileSync(logFile, JSON.stringify(testResult, null, 2));
    console.log(`✅ Test result saved to ${logFile}`);
    
    return true;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;
    
    console.error(`❌ Longcontext request failed after ${duration}ms`);
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // 保存错误结果
    const errorResult = {
      timestamp: new Date().toISOString(),
      test: 'longcontext-routing',
      status: 'failed', 
      duration: duration,
      error: {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      },
      request: {
        model: longMessage.model,
        contentLength: JSON.stringify(longMessage).length
      }
    };
    
    fs.writeFileSync(logFile, JSON.stringify(errorResult, null, 2));
    console.log(`📄 Error result saved to ${logFile}`);
    
    return false;
  }
}

async function testNormalRouting() {
  console.log('\\n🧪 Testing normal message routing (for comparison)...');
  
  const normalMessage = createNormalMessage();
  let startTime;
  
  try {
    startTime = Date.now();
    console.log('🚀 Sending normal request...');
    
    const response = await axios.post(`${BASE_URL}/v1/messages`, normalMessage, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000, // 30秒超时
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Normal request succeeded in ${duration}ms`);
    console.log('📊 Response data:', {
      id: response.data.id,
      model: response.data.model,
      role: response.data.role,
      contentLength: JSON.stringify(response.data.content).length
    });
    
    return true;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = startTime ? endTime - startTime : 0;
    
    console.error(`❌ Normal request failed after ${duration}ms`);
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    return false;
  }
}

async function main() {
  console.log('🔧 Longcontext路由诊断测试');
  console.log('================================');
  console.log(`🌐 Testing against: ${BASE_URL}`);
  console.log('');
  
  // 1. 检查路由器状态
  const statusOk = await testRouterStatus();
  if (!statusOk) {
    console.log('❌ Router not available, exiting...');
    process.exit(1);
  }
  
  // 2. 测试普通请求（对比）
  const normalOk = await testNormalRouting();
  
  // 3. 测试longcontext请求
  const longcontextOk = await testLongcontextRouting();
  
  // 4. 总结结果
  console.log('\\n📋 Test Summary:');
  console.log('================');
  console.log(`Router Status: ${statusOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`Normal Request: ${normalOk ? '✅ OK' : '❌ FAILED'}`);
  console.log(`Longcontext Request: ${longcontextOk ? '✅ OK' : '❌ FAILED'}`);
  
  if (longcontextOk) {
    console.log('\\n🎉 Longcontext routing is working correctly!');
  } else {
    console.log('\\n❌ Longcontext routing has issues - check logs for details');
    console.log('💡 Possible causes:');
    console.log('   - anthropic-test provider endpoint issues');  
    console.log('   - API key authentication problems');
    console.log('   - Network timeout or connectivity issues');
    console.log('   - Provider service unavailable');
  }
  
  process.exit(longcontextOk ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}