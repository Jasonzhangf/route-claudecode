#!/usr/bin/env node

/**
 * 深入调查5506端口"Invalid discriminator value. Expected 'function'"错误的具体原因
 * 检查工具定义和响应中的工具调用格式问题
 */

const http = require('http');
const util = require('util');

console.log('🔍 开始调查5506端口工具调用格式问题...');
console.log('=' + '='.repeat(70));

// 测试用的工具调用请求 - 标准OpenAI格式
const testRequest = {
  messages: [
    { 
      role: 'user', 
      content: '请使用grep工具搜索当前目录中包含"testing"的文件' 
    }
  ],
  tools: [
    {
      type: "function", // 🎯 关键点：这里有type字段
      function: {
        name: "grep",
        description: "搜索文件中的文本模式",
        parameters: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "搜索模式"
            },
            path: {
              type: "string", 
              description: "搜索路径"
            }
          },
          required: ["pattern"]
        }
      }
    }
  ],
  max_tokens: 1024,
  temperature: 0.7,
  stream: false
};

/**
 * 发送HTTP请求到5506端口
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: 'localhost',
      port: 5506,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
        ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: responseData,
            parseError: e.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

/**
 * 深度分析工具定义的格式
 */
function analyzeToolDefinition(tools) {
  console.log('\n🔧 分析工具定义格式:');
  
  if (!Array.isArray(tools)) {
    console.log('❌ 工具不是数组:', typeof tools);
    return false;
  }
  
  tools.forEach((tool, index) => {
    console.log(`\n工具 ${index + 1}:`);
    console.log(`  - 有type字段: ${!!tool.type} (值: "${tool.type}")`);
    console.log(`  - type值类型: ${typeof tool.type}`);
    console.log(`  - 有function字段: ${!!tool.function}`);
    
    if (tool.function) {
      console.log(`  - function.name: ${tool.function.name}`);
      console.log(`  - function.description: ${tool.function.description ? '存在' : '缺失'}`);
      console.log(`  - function.parameters: ${tool.function.parameters ? '存在' : '缺失'}`);
    }
    
    // 检查是否符合OpenAI标准
    const isValidOpenAI = (
      tool.type === 'function' &&
      tool.function &&
      typeof tool.function.name === 'string' &&
      typeof tool.function.parameters === 'object'
    );
    
    console.log(`  - 符合OpenAI标准: ${isValidOpenAI ? '✅' : '❌'}`);
  });
  
  return true;
}

/**
 * 深度分析响应中的工具调用格式
 */
function analyzeToolCallsResponse(response) {
  console.log('\n📡 分析响应中的工具调用格式:');
  
  if (!response || !response.choices) {
    console.log('❌ 响应缺少choices字段');
    return;
  }
  
  response.choices.forEach((choice, index) => {
    console.log(`\n选择 ${index + 1}:`);
    console.log(`  - finish_reason: ${choice.finish_reason}`);
    console.log(`  - 有message: ${!!choice.message}`);
    
    if (choice.message) {
      console.log(`  - message.role: ${choice.message.role}`);
      console.log(`  - 有content: ${!!choice.message.content}`);
      console.log(`  - 有tool_calls: ${!!choice.message.tool_calls}`);
      
      if (choice.message.tool_calls) {
        console.log(`  - tool_calls数量: ${choice.message.tool_calls.length}`);
        
        choice.message.tool_calls.forEach((toolCall, tcIndex) => {
          console.log(`\n  工具调用 ${tcIndex + 1}:`);
          console.log(`    - id: ${toolCall.id || '缺失'}`);
          console.log(`    - 有type字段: ${!!toolCall.type} (值: "${toolCall.type}")`);
          console.log(`    - type值类型: ${typeof toolCall.type}`);
          console.log(`    - 有function字段: ${!!toolCall.function}`);
          
          if (toolCall.function) {
            console.log(`    - function.name: ${toolCall.function.name}`);
            console.log(`    - function.arguments: ${toolCall.function.arguments ? '存在' : '缺失'}`);
            console.log(`    - arguments长度: ${toolCall.function.arguments?.length || 0}`);
            
            // 检查arguments是否是有效JSON
            if (toolCall.function.arguments) {
              try {
                JSON.parse(toolCall.function.arguments);
                console.log(`    - arguments JSON有效: ✅`);
              } catch (e) {
                console.log(`    - arguments JSON无效: ❌ (${e.message})`);
              }
            }
          }
          
          // 🎯 关键检查：是否缺少type字段
          if (!toolCall.type) {
            console.log(`    - 🚨 缺少type字段 - 这就是"Invalid discriminator value"错误的原因!`);
          } else if (toolCall.type !== 'function') {
            console.log(`    - 🚨 type字段值错误: "${toolCall.type}" (应该是"function")`);
          } else {
            console.log(`    - ✅ type字段正确: "function"`);
          }
        });
      }
    }
  });
}

/**
 * 主测试函数
 */
async function runToolFormatInvestigation() {
  try {
    console.log('\n📤 发送工具调用请求到5506端口...');
    
    // 分析发送的工具定义格式
    analyzeToolDefinition(testRequest.tools);
    
    // 发送请求
    const response = await makeRequest('POST', '/v1/chat/completions', testRequest);
    
    console.log('\n📥 收到响应:');
    console.log(`  - HTTP状态: ${response.status}`);
    console.log(`  - Content-Type: ${response.headers['content-type']}`);
    
    if (response.parseError) {
      console.log('❌ JSON解析错误:', response.parseError);
      console.log('原始响应:', response.body.substring(0, 500));
      return;
    }
    
    // 检查是否有错误
    if (response.body.error) {
      console.log('🚨 API错误响应:');
      console.log(`  - 错误类型: ${response.body.error.type}`);
      console.log(`  - 错误消息: ${response.body.error.message}`);
      
      // 检查是否是discriminator错误
      if (response.body.error.message && response.body.error.message.includes('Invalid discriminator value')) {
        console.log('\n🎯 发现关键错误: Invalid discriminator value!');
        console.log('这意味着工具调用数组中的对象缺少"type": "function"字段');
        
        // 分析错误详情
        if (response.body.error.message.includes('Expected \'function\'')) {
          console.log('✅ 确认：错误是因为工具调用对象缺少type字段或type字段值不正确');
        }
      }
      
      return;
    }
    
    // 分析正常响应中的工具调用格式
    analyzeToolCallsResponse(response.body);
    
    // 生成诊断报告
    console.log('\n' + '='.repeat(70));
    console.log('📊 诊断报告:');
    
    const hasToolCalls = response.body.choices?.some(c => c.message?.tool_calls);
    if (hasToolCalls) {
      console.log('✅ 响应包含工具调用');
      
      // 检查每个工具调用是否有type字段
      const allToolCalls = response.body.choices
        .filter(c => c.message?.tool_calls)
        .flatMap(c => c.message.tool_calls);
      
      const missingType = allToolCalls.filter(tc => !tc.type);
      const wrongType = allToolCalls.filter(tc => tc.type && tc.type !== 'function');
      
      if (missingType.length > 0) {
        console.log(`🚨 发现 ${missingType.length} 个工具调用缺少type字段`);
        console.log('这是"Invalid discriminator value"错误的根本原因！');
      }
      
      if (wrongType.length > 0) {
        console.log(`🚨 发现 ${wrongType.length} 个工具调用type字段值错误`);
        wrongType.forEach(tc => {
          console.log(`  - 工具调用ID ${tc.id}: type="${tc.type}" (应为"function")`);
        });
      }
      
      if (missingType.length === 0 && wrongType.length === 0) {
        console.log('✅ 所有工具调用都有正确的type字段');
      }
      
    } else {
      console.log('❌ 响应不包含工具调用');
    }
    
    // 生成修复建议
    console.log('\n🔧 修复建议:');
    console.log('1. 检查OpenAI Transformer在convertOpenAIMessageToAnthropicContent中是否正确处理tool_calls');
    console.log('2. 检查预处理器是否在处理LM Studio响应时正确添加type字段');
    console.log('3. 验证补丁系统中的OpenAIToolFormatFixPatch是否被正确应用');
    console.log('4. 查看是否有其他组件移除了type字段');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 5506端口未运行，请先启动服务:');
      console.log('rcc start --config ~/.route-claude-code/config/single-provider/config-openai-lmstudio-5506.json --debug');
    }
  }
}

// 运行调查
runToolFormatInvestigation();