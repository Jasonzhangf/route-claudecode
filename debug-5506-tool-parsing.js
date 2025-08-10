#!/usr/bin/env node

/**
 * 诊断5506端口LMStudio工具调用解析失败问题
 * 专门检查LMStudio provider的工具调用处理和解析逻辑
 */

const axios = require('axios');

console.log('🔍 Debugging 5506 Port Tool Call Parsing Issues');
console.log('=' + '='.repeat(60));

// 测试工具调用请求
const toolTestRequest = {
  model: "gpt-oss-20b-mlx",
  messages: [
    {
      role: "user",
      content: "Please search for the current weather in Tokyo and then generate a simple weather report."
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
        name: "generate_report",
        description: "Generate a formatted report",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Report title"
            },
            data: {
              type: "object",
              description: "Report data"
            }
          },
          required: ["title", "data"]
        }
      }
    }
  ],
  tool_choice: "auto",
  max_tokens: 2000,
  temperature: 0.7,
  stream: false
};

// 检查5506服务器状态
async function check5506ServerHealth() {
  console.log('\n🔍 Checking 5506 Server Health...');
  
  try {
    const healthResponse = await axios.get('http://localhost:5506/health', {
      timeout: 5000
    });
    
    console.log('   ✅ Server is running');
    console.log('   📊 Health data:', JSON.stringify(healthResponse.data, null, 2));
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('   ❌ Server not running on port 5506');
      console.log('   💡 Start with: rcc start --config ~/.route-claude-code/config/single-provider/config-openai-lmstudio-5506.json --debug');
    } else {
      console.log('   ❌ Health check failed:', error.message);
    }
    return false;
  }
}

// 检查底层LMStudio服务器状态
async function checkLMStudioServer() {
  console.log('\n🖥️  Checking LM Studio Server (localhost:1234)...');
  
  try {
    // 检查模型列表
    const modelsResponse = await axios.get('http://localhost:1234/v1/models', {
      timeout: 5000
    });
    
    console.log('   ✅ LM Studio server is running');
    console.log('   📋 Available models:', modelsResponse.data.data?.map(m => m.id) || []);
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('   ❌ LM Studio server not running on localhost:1234');
      console.log('   💡 Please start LM Studio and load a model');
    } else {
      console.log('   ❌ LM Studio check failed:', error.message);
    }
    return false;
  }
}

// 测试工具调用请求
async function testToolCallRequest() {
  console.log('\n🔧 Testing Tool Call Request...');
  
  try {
    console.log('   📤 Sending tool call request...');
    console.log('   🔧 Request tools:', toolTestRequest.tools.map(t => t.function.name));
    
    const startTime = Date.now();
    const response = await axios.post('http://localhost:5506/v1/chat/completions', toolTestRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 30000
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`   ✅ Response received (${response.status}) in ${responseTime}ms`);
    
    // 分析响应结构
    const result = response.data;
    console.log('   📊 Response analysis:');
    console.log(`      Model: ${result.model || 'unknown'}`);
    console.log(`      Choices: ${result.choices?.length || 0}`);
    
    if (result.choices && result.choices.length > 0) {
      const choice = result.choices[0];
      console.log(`      Finish reason: ${choice.finish_reason}`);
      console.log(`      Has message: ${!!choice.message}`);
      console.log(`      Message role: ${choice.message?.role}`);
      console.log(`      Has content: ${!!choice.message?.content}`);
      console.log(`      Tool calls: ${choice.message?.tool_calls?.length || 0}`);
      
      // 详细分析工具调用
      if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
        console.log('\n   🔧 Tool Call Analysis:');
        choice.message.tool_calls.forEach((toolCall, index) => {
          console.log(`      Tool ${index + 1}:`);
          console.log(`         ID: ${toolCall.id}`);
          console.log(`         Type: ${toolCall.type}`);
          console.log(`         Function name: ${toolCall.function?.name}`);
          console.log(`         Arguments: ${toolCall.function?.arguments?.substring(0, 100)}...`);
          
          // 尝试解析参数
          try {
            const parsedArgs = JSON.parse(toolCall.function?.arguments || '{}');
            console.log(`         Parsed args: ${Object.keys(parsedArgs).join(', ')}`);
          } catch (parseError) {
            console.log(`         ❌ Arguments parsing failed: ${parseError.message}`);
            console.log(`         Raw arguments: "${toolCall.function?.arguments}"`);
          }
        });
        
        return {
          success: true,
          hasToolCalls: true,
          toolCallCount: choice.message.tool_calls.length,
          parsingIssues: []
        };
      } else {
        // 检查是否有工具调用的文本表示
        if (choice.message?.content) {
          const content = choice.message.content;
          console.log('\n   📝 Content Analysis:');
          console.log(`      Content length: ${content.length}`);
          console.log(`      Content preview: ${content.substring(0, 200)}...`);
          
          // 检查是否包含工具调用的文本模式
          const toolPatterns = [
            /function_call\s*\(/i,
            /tool_call\s*\(/i,
            /\{\s*"name"\s*:\s*"(web_search|generate_report)"/i,
            /search\s*\(/i
          ];
          
          const foundPatterns = toolPatterns.filter(pattern => pattern.test(content));
          if (foundPatterns.length > 0) {
            console.log('   ⚠️  Found tool call patterns in text content - parsing issue detected!');
            return {
              success: false,
              hasToolCalls: false,
              parsingIssue: 'tool_calls_in_text',
              content: content
            };
          }
        }
        
        console.log('   📄 No tool calls found, normal text response');
        return {
          success: true,
          hasToolCalls: false,
          responseType: 'text'
        };
      }
    } else {
      console.log('   ❌ No choices in response');
      return {
        success: false,
        error: 'no_choices'
      };
    }
    
  } catch (error) {
    console.log(`   ❌ Tool call request failed: ${error.message}`);
    if (error.response) {
      console.log(`   📍 HTTP ${error.response.status}: ${error.response.data?.error?.message || 'Unknown error'}`);
      console.log(`   📄 Response data:`, JSON.stringify(error.response.data, null, 2));
    }
    return {
      success: false,
      error: error.message,
      httpStatus: error.response?.status
    };
  }
}

// 测试直接向LMStudio发送请求
async function testDirectLMStudioRequest() {
  console.log('\n🎯 Testing Direct LM Studio Request...');
  
  try {
    console.log('   📤 Sending request directly to localhost:1234...');
    
    const response = await axios.post('http://localhost:1234/v1/chat/completions', toolTestRequest, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log(`   ✅ Direct response received (${response.status})`);
    
    const result = response.data;
    if (result.choices && result.choices.length > 0) {
      const choice = result.choices[0];
      console.log(`   🔧 Tool calls: ${choice.message?.tool_calls?.length || 0}`);
      console.log(`   📝 Content length: ${choice.message?.content?.length || 0}`);
      console.log(`   🔚 Finish reason: ${choice.finish_reason}`);
      
      if (choice.message?.content && !choice.message?.tool_calls) {
        const content = choice.message.content;
        console.log(`   📄 Content preview: ${content.substring(0, 200)}...`);
        
        // 检查LMStudio是否将工具调用作为文本返回
        if (content.includes('function_call') || content.includes('tool_call') || content.includes('"name"')) {
          console.log('   ⚠️  LM Studio returned tool calls as text - this is the root issue!');
          return {
            success: false,
            issue: 'lmstudio_returns_tools_as_text',
            content: content
          };
        }
      }
    }
    
    return {
      success: true,
      directLMStudioWorking: true
    };
    
  } catch (error) {
    console.log(`   ❌ Direct LM Studio request failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// 运行完整诊断
async function runCompleteDiagnosis() {
  console.log('\n🔍 Starting 5506 Tool Parsing Diagnosis...');
  
  const serverHealthy = await check5506ServerHealth();
  if (!serverHealthy) {
    console.log('\n⚠️  Cannot proceed without 5506 server running');
    return false;
  }
  
  const lmstudioHealthy = await checkLMStudioServer();
  if (!lmstudioHealthy) {
    console.log('\n⚠️  LM Studio server issues detected');
  }
  
  const toolTestResult = await testToolCallRequest();
  
  let directTestResult = null;
  if (lmstudioHealthy) {
    directTestResult = await testDirectLMStudioRequest();
  }
  
  // 分析结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 Diagnosis Results:');
  
  if (!toolTestResult.success) {
    console.log('❌ Tool call parsing through 5506 failed');
    if (toolTestResult.parsingIssue === 'tool_calls_in_text') {
      console.log('🚨 ISSUE: Tool calls are being returned as text content instead of structured tool_calls array');
      console.log('📋 This indicates a parsing/transformation issue in the response pipeline');
    }
  } else if (!toolTestResult.hasToolCalls) {
    console.log('⚠️  No tool calls detected in response');
    if (toolTestResult.responseType === 'text') {
      console.log('📄 Model returned normal text response instead of tool calls');
    }
  } else {
    console.log('✅ Tool calls working correctly through 5506');
  }
  
  if (directTestResult) {
    if (directTestResult.issue === 'lmstudio_returns_tools_as_text') {
      console.log('🎯 ROOT CAUSE: LM Studio server is returning tool calls as text instead of structured format');
      console.log('💡 SOLUTION: Need to implement text-to-tool-call parsing for LM Studio responses');
    }
  }
  
  // 生成修复建议
  console.log('\n🔧 Recommended Actions:');
  
  if (toolTestResult.parsingIssue === 'tool_calls_in_text') {
    console.log('1. Create LM Studio response preprocessor to parse tool calls from text');
    console.log('2. Add tool call extraction patterns for common LM Studio formats');
    console.log('3. Implement fallback parsing for malformed tool call responses');
  }
  
  if (!toolTestResult.hasToolCalls && lmstudioHealthy) {
    console.log('1. Check LM Studio model compatibility with function calling');
    console.log('2. Verify tool definitions are correctly passed to LM Studio');
    console.log('3. Consider using different prompting strategies for tool use');
  }
  
  return toolTestResult.success;
}

// 执行诊断
runCompleteDiagnosis().then(success => {
  console.log('\n🔚 5506 Tool Parsing Diagnosis completed');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Diagnosis failed:', error);
  process.exit(1);
});