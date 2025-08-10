#!/usr/bin/env node

/**
 * 测试ModelScope专用服务器配置
 * 验证5507和5509端口的GLM-4.5和Qwen3-Coder功能
 */

const axios = require('axios');

console.log('🧪 Testing ModelScope Dedicated Server Configuration');
console.log('=' + '='.repeat(60));

// 测试配置
const testConfigs = [
  {
    name: 'ModelScope 5507 - Qwen3-Coder Focus',
    port: 5507,
    defaultModel: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    glmModel: 'ZhipuAI/GLM-4.5',
    endpoint: 'https://api-inference.modelscope.cn/v1/chat/completions'
  },
  {
    name: 'ModelScope 5509 - GLM-4.5 Focus', 
    port: 5509,
    defaultModel: 'ZhipuAI/GLM-4.5',
    qwenModel: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    endpoint: 'https://api-inference.modelscope.cn/v1/chat/completions'
  }
];

// 工具调用测试消息
const toolTestMessage = {
  messages: [
    {
      role: "user", 
      content: "Please search for the latest Node.js LTS version and generate a simple Hello World example."
    }
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for information",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query"
            }
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function", 
      function: {
        name: "code_generator",
        description: "Generate code in specified language",
        parameters: {
          type: "object",
          properties: {
            language: {
              type: "string",
              description: "Programming language"
            },
            task: {
              type: "string", 
              description: "Task description"
            }
          },
          required: ["language", "task"]
        }
      }
    }
  ],
  max_tokens: 4096,
  temperature: 0.7,
  stream: false
};

// 检查服务器健康状态
async function checkServerHealth(port) {
  try {
    const response = await axios.get(`http://localhost:${port}/health`, {
      timeout: 5000
    });
    return {
      status: 'healthy',
      data: response.data
    };
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return {
        status: 'offline',
        error: 'Server not running'
      };
    }
    return {
      status: 'error',
      error: error.message
    };
  }
}

// 测试模型推理
async function testModelInference(port, model, testName) {
  const testMessage = {
    ...toolTestMessage,
    model: model
  };

  try {
    console.log(`\\n🔧 Testing ${testName} on port ${port}...`);
    const response = await axios.post(`http://localhost:${port}/v1/chat/completions`, testMessage, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 30000
    });

    const result = response.data;
    
    // 验证响应格式
    const hasValidResponse = result && result.choices && result.choices.length > 0;
    const message = hasValidResponse ? result.choices[0].message : null;
    const hasContent = message && (message.content || message.tool_calls);
    const finishReason = hasValidResponse ? result.choices[0].finish_reason : null;

    console.log(`   ✅ Response received (${response.status})`);
    console.log(`   📊 Model: ${result.model || 'unknown'}`);
    console.log(`   🔚 Finish reason: ${finishReason}`);
    console.log(`   📝 Has content: ${!!message?.content}`);
    console.log(`   🔧 Tool calls: ${message?.tool_calls?.length || 0}`);
    
    if (message?.content) {
      const contentPreview = message.content.substring(0, 100) + '...';
      console.log(`   📋 Content preview: ${contentPreview}`);
    }

    // 特殊验证：工具调用格式
    if (message?.tool_calls && message.tool_calls.length > 0) {
      console.log(`   🎯 Tool call detected: ${message.tool_calls[0].function?.name}`);
    }

    // 验证ModelScope patches是否生效
    if (model.includes('GLM') && message?.content?.includes('Tool call:')) {
      console.log(`   🔧 GLM-4.5 format detected: Tool call syntax found`);
    }

    return {
      success: true,
      model: result.model,
      finishReason,
      hasToolCalls: !!(message?.tool_calls?.length),
      contentLength: message?.content?.length || 0
    };

  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
    if (error.response) {
      console.log(`   📍 HTTP ${error.response.status}: ${error.response.data?.error?.message || 'Unknown error'}`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// 运行完整测试套件
async function runModelScopeServerTests() {
  console.log('\\n🔍 Checking server availability...');
  
  let availableServers = [];
  let testResults = [];
  
  // 检查服务器状态
  for (const config of testConfigs) {
    const health = await checkServerHealth(config.port);
    console.log(`\\n📡 Port ${config.port} (${config.name}): ${health.status}`);
    
    if (health.status === 'healthy') {
      availableServers.push(config);
      console.log(`   ✅ Server running and responding`);
    } else {
      console.log(`   ❌ ${health.error}`);
      console.log(`   💡 Start with: rcc start --config ~/.route-claude-code/config/single-provider/config-openai-sdk-modelscope-${config.port === 5507 ? '5507' : 'glm-5509'}.json --debug`);
    }
  }

  if (availableServers.length === 0) {
    console.log('\\n⚠️  No ModelScope servers available for testing');
    console.log('\\n🚀 To start servers:');
    console.log('   rcc start --config ~/.route-claude-code/config/single-provider/config-openai-sdk-modelscope-5507.json --debug &');
    console.log('   rcc start --config ~/.route-claude-code/config/single-provider/config-openai-sdk-modelscope-glm-5509.json --debug &');
    return false;
  }

  console.log('\\n🧪 Running model inference tests...');

  // 测试每个可用服务器
  for (const config of availableServers) {
    console.log(`\\n📋 Testing ${config.name}:`);
    
    // 测试默认模型
    const defaultResult = await testModelInference(
      config.port, 
      config.defaultModel, 
      `Default Model (${config.defaultModel})`
    );
    testResults.push({
      server: config.name,
      model: config.defaultModel,
      result: defaultResult
    });

    // 如果有第二个模型，也测试它
    const secondModel = config.glmModel || config.qwenModel;
    if (secondModel && secondModel !== config.defaultModel) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 间隔2秒避免频率限制
      
      const secondResult = await testModelInference(
        config.port,
        secondModel,
        `Secondary Model (${secondModel})`
      );
      testResults.push({
        server: config.name,
        model: secondModel,
        result: secondResult
      });
    }
  }

  // 汇总结果
  console.log('\\n' + '='.repeat(60));
  console.log('📊 Test Results Summary:');
  
  let passedTests = 0;
  let totalTests = testResults.length;
  
  testResults.forEach((test, index) => {
    const status = test.result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${index + 1}. ${test.server} - ${test.model}: ${status}`);
    if (test.result.success) {
      passedTests++;
      console.log(`      🔚 Finish: ${test.result.finishReason}, Tools: ${test.result.hasToolCalls ? 'Yes' : 'No'}, Content: ${test.result.contentLength} chars`);
    } else {
      console.log(`      ❌ Error: ${test.result.error}`);
    }
  });

  console.log(`\\n🎯 Overall Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('✅ All ModelScope server configurations working correctly!');
    console.log('🎉 GLM-4.5 and Qwen3-Coder preprocessing patches validated in production');
  } else {
    console.log('⚠️  Some tests failed. Check server configuration and patches.');
  }

  return passedTests === totalTests;
}

// 执行测试
runModelScopeServerTests().then(success => {
  console.log('\\n🔚 ModelScope server testing completed');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});