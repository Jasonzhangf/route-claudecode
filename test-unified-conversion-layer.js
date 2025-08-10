#!/usr/bin/env node
/**
 * 统一转换层测试脚本
 * 测试流式到非流式转换和集中流式响应模拟功能
 * Project owner: Jason Zhang
 */

const axios = require('axios');

const TEST_CONFIG = {
  baseURL: 'http://localhost:5508',
  timeout: 30000,
  testModel: 'claude-3-5-sonnet-20241022'
};

const TEST_SCENARIOS = [
  {
    name: '非流式工具调用测试',
    request: {
      model: TEST_CONFIG.testModel,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: 'Please write a simple hello world program using the Write tool'
        }
      ],
      tools: [
        {
          name: 'Write',
          description: 'Write content to a file',
          input_schema: {
            type: 'object',
            properties: {
              file_path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['file_path', 'content']
          }
        }
      ],
      stream: false
    },
    expectedFinishReason: 'tool_use',
    testType: 'non-streaming'
  },
  {
    name: '流式工具调用测试',
    request: {
      model: TEST_CONFIG.testModel,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: 'Please create a simple Python script using the Write tool'
        }
      ],
      tools: [
        {
          name: 'Write',
          description: 'Write content to a file',
          input_schema: {
            type: 'object',
            properties: {
              file_path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['file_path', 'content']
          }
        }
      ],
      stream: true
    },
    expectedFinishReason: 'tool_use',
    testType: 'streaming'
  },
  {
    name: '非流式纯文本测试',
    request: {
      model: TEST_CONFIG.testModel,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Say hello in a friendly way'
        }
      ],
      stream: false
    },
    expectedFinishReason: 'end_turn',
    testType: 'non-streaming'
  },
  {
    name: '流式纯文本测试',
    request: {
      model: TEST_CONFIG.testModel,
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Tell me a short joke'
        }
      ],
      stream: true
    },
    expectedFinishReason: 'end_turn',
    testType: 'streaming'
  }
];

async function testNonStreamingRequest(scenario) {
  console.log(`\n🧪 测试场景: ${scenario.name}`);
  console.log(`📋 测试类型: 非流式请求`);
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(`${TEST_CONFIG.baseURL}/v1/messages`, scenario.request, {
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    const result = response.data;
    
    console.log(`✅ 请求成功 (${duration}ms)`);
    console.log(`📊 状态码: ${response.status}`);
    console.log(`🎯 Finish Reason: ${result.stop_reason}`);
    console.log(`🔧 模型: ${result.model}`);
    console.log(`📝 内容块数量: ${result.content?.length || 0}`);
    
    if (result.content) {
      const toolUseBlocks = result.content.filter(block => block.type === 'tool_use');
      const textBlocks = result.content.filter(block => block.type === 'text');
      console.log(`🛠️  工具调用数量: ${toolUseBlocks.length}`);
      console.log(`📄 文本块数量: ${textBlocks.length}`);
      
      if (toolUseBlocks.length > 0) {
        console.log(`🔍 工具调用详情:`);
        toolUseBlocks.forEach((tool, index) => {
          console.log(`   ${index + 1}. ${tool.name} (ID: ${tool.id})`);
        });
      }
    }
    
    // 验证finish reason一致性
    if (result.stop_reason === scenario.expectedFinishReason) {
      console.log(`✅ Finish reason验证通过: ${result.stop_reason}`);
    } else {
      console.log(`❌ Finish reason验证失败: 期望 ${scenario.expectedFinishReason}, 实际 ${result.stop_reason}`);
    }
    
    return {
      success: true,
      duration,
      finishReason: result.stop_reason,
      toolCount: result.content?.filter(b => b.type === 'tool_use').length || 0
    };
    
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    if (error.response) {
      console.log(`📊 错误状态码: ${error.response.status}`);
      console.log(`📄 错误详情: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

async function testStreamingRequest(scenario) {
  console.log(`\n🧪 测试场景: ${scenario.name}`);
  console.log(`📋 测试类型: 流式请求`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    let chunkCount = 0;
    let finishReason = null;
    let toolCallCount = 0;
    let textLength = 0;
    
    const eventSource = new (require('eventsource'))(`${TEST_CONFIG.baseURL}/v1/messages`, {
      method: 'POST',
      body: JSON.stringify(scenario.request),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      }
    });
    
    eventSource.onopen = () => {
      console.log(`🔗 流式连接已建立`);
    };
    
    eventSource.onmessage = (event) => {
      chunkCount++;
      
      try {
        const data = JSON.parse(event.data);
        
        if (data.event === 'message_start') {
          console.log(`🚀 消息开始`);
        } else if (data.event === 'content_block_start' && data.data?.content_block?.type === 'tool_use') {
          toolCallCount++;
          console.log(`🛠️  工具调用开始: ${data.data.content_block.name}`);
        } else if (data.event === 'content_block_delta' && data.data?.delta?.text) {
          textLength += data.data.delta.text.length;
        } else if (data.event === 'message_delta' && data.data?.delta?.stop_reason) {
          finishReason = data.data.delta.stop_reason;
          console.log(`🏁 Finish reason: ${finishReason}`);
        } else if (data.event === 'message_stop') {
          console.log(`✅ 消息完成`);
        }
        
        if (chunkCount % 10 === 0) {
          console.log(`📊 已接收 ${chunkCount} 个数据块...`);
        }
        
      } catch (parseError) {
        console.log(`⚠️  数据解析错误: ${parseError.message}`);
      }
    };
    
    eventSource.onerror = (error) => {
      const duration = Date.now() - startTime;
      console.log(`❌ 流式请求错误: ${error.message || error}`);
      eventSource.close();
      
      resolve({
        success: false,
        error: error.message || 'Stream error',
        duration,
        chunkCount
      });
    };
    
    // 设置超时
    const timeout = setTimeout(() => {
      const duration = Date.now() - startTime;
      console.log(`✅ 流式请求完成 (${duration}ms)`);
      console.log(`📊 总数据块: ${chunkCount}`);
      console.log(`🛠️  工具调用数量: ${toolCallCount}`);
      console.log(`📄 文本长度: ${textLength}`);
      console.log(`🎯 Finish Reason: ${finishReason}`);
      
      eventSource.close();
      
      // 验证finish reason一致性
      if (finishReason === scenario.expectedFinishReason) {
        console.log(`✅ Finish reason验证通过: ${finishReason}`);
      } else {
        console.log(`❌ Finish reason验证失败: 期望 ${scenario.expectedFinishReason}, 实际 ${finishReason}`);
      }
      
      resolve({
        success: true,
        duration,
        chunkCount,
        finishReason,
        toolCount: toolCallCount,
        textLength
      });
    }, TEST_CONFIG.timeout);
    
    // 清理超时
    eventSource.onclose = () => {
      clearTimeout(timeout);
    };
  });
}

async function testHealthCheck() {
  console.log(`\n🏥 健康检查测试`);
  
  try {
    const response = await axios.get(`${TEST_CONFIG.baseURL}/health`, {
      timeout: 5000
    });
    
    console.log(`✅ 健康检查通过`);
    console.log(`📊 健康提供商: ${response.data.healthy}/${response.data.total}`);
    console.log(`📋 提供商状态:`);
    
    Object.entries(response.data.providers || {}).forEach(([name, status]) => {
      console.log(`   ${status ? '✅' : '❌'} ${name}`);
    });
    
    return { success: true };
    
  } catch (error) {
    console.log(`❌ 健康检查失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log(`🧪 统一转换层测试开始`);
  console.log(`🌐 测试地址: ${TEST_CONFIG.baseURL}`);
  console.log(`🤖 测试模型: ${TEST_CONFIG.testModel}`);
  console.log(`⏱️  超时时间: ${TEST_CONFIG.timeout}ms`);
  
  const results = {};
  
  // 健康检查
  results.health = await testHealthCheck();
  if (!results.health.success) {
    console.log(`\n❌ 健康检查失败，跳过其他测试`);
    return results;
  }
  
  // 运行所有测试场景
  for (const scenario of TEST_SCENARIOS) {
    if (scenario.testType === 'non-streaming') {
      results[scenario.name] = await testNonStreamingRequest(scenario);
    } else {
      results[scenario.name] = await testStreamingRequest(scenario);
    }
    
    // 每个测试间隔2秒
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 总结
  console.log(`\n📊 测试结果总结`);
  console.log(`==================`);
  
  const testResults = Object.entries(results).filter(([key]) => key !== 'health');
  const successCount = testResults.filter(([, result]) => result.success).length;
  const totalTests = testResults.length;
  
  console.log(`✅ 成功: ${successCount}/${totalTests}`);
  console.log(`❌ 失败: ${totalTests - successCount}/${totalTests}`);
  
  testResults.forEach(([name, result]) => {
    if (result.success) {
      console.log(`   ✅ ${name} (${result.duration}ms)`);
      if (result.finishReason) {
        console.log(`      🎯 Finish reason: ${result.finishReason}`);
      }
      if (result.toolCount > 0) {
        console.log(`      🛠️  工具调用: ${result.toolCount}`);
      }
    } else {
      console.log(`   ❌ ${name}: ${result.error}`);
    }
  });
  
  console.log(`\n🎯 统一转换层测试完成`);
  
  return results;
}

// 如果直接运行此脚本
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testNonStreamingRequest,
  testStreamingRequest,
  testHealthCheck,
  TEST_SCENARIOS,
  TEST_CONFIG
};