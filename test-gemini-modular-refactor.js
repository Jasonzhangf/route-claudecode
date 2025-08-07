#!/usr/bin/env node

/**
 * Gemini Provider模块化重构测试脚本
 * 项目所有者: Jason Zhang
 * 
 * 测试目标:
 * 1. 验证模块化架构重构是否修复工具调用问题
 * 2. 对比重构前后的响应质量
 * 3. 验证stop_reason的内容驱动判断逻辑
 * 4. 测试补丁系统的集成
 */

const axios = require('axios');
const fs = require('fs');

const CONFIG = {
  GEMINI_PORT: 5502,
  BASE_URL: 'http://localhost:5502',
  TEST_TIMEOUT: 30000,
  DEBUG_DIR: '/tmp'
};

// 测试用例定义
const TEST_CASES = [
  {
    name: "Basic Text Response",
    description: "测试基础文本响应功能",
    messages: [
      {
        role: "user",
        content: "Hello, how are you today?"
      }
    ],
    tools: null,
    expectedType: "text_only",
    expectedStopReason: "end_turn"
  },
  {
    name: "OpenAI Format Tool Call",
    description: "测试OpenAI格式工具调用",
    messages: [
      {
        role: "user",
        content: "What's the weather like in San Francisco?"
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get weather information for a city",
          parameters: {
            type: "object",
            properties: {
              city: {
                type: "string",
                description: "The city name"
              },
              units: {
                type: "string",
                enum: ["celsius", "fahrenheit"],
                description: "Temperature units"
              }
            },
            required: ["city"]
          }
        }
      }
    ],
    expectedType: "tool_call",
    expectedStopReason: "tool_use"
  },
  {
    name: "Anthropic Format Tool Call",
    description: "测试Anthropic格式工具调用", 
    messages: [
      {
        role: "user",
        content: "Search for information about quantum computing"
      }
    ],
    tools: [
      {
        name: "web_search",
        description: "Search the web for information",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query"
            },
            max_results: {
              type: "integer",
              description: "Maximum number of results",
              default: 5
            }
          },
          required: ["query"]
        }
      }
    ],
    expectedType: "tool_call",
    expectedStopReason: "tool_use"
  }
];

class GeminiModularTester {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log('🚀 开始Gemini模块化重构验证测试');
    console.log(`⚙️ 测试配置: 端口 ${CONFIG.GEMINI_PORT}, 超时 ${CONFIG.TEST_TIMEOUT}ms`);
    console.log(`📁 调试文件将保存在 ${CONFIG.DEBUG_DIR}/`);
    console.log('=' .repeat(80));

    // 检查服务是否运行
    const isServiceRunning = await this.checkServiceHealth();
    if (!isServiceRunning) {
      console.error('❌ Gemini服务未运行，请先启动服务');
      console.error(`   命令: rcc start ~/.route-claude-code/config/single-provider/config-google-gemini-5502.json --debug`);
      process.exit(1);
    }

    // 运行每个测试用例
    for (let i = 0; i < TEST_CASES.length; i++) {
      const testCase = TEST_CASES[i];
      console.log(`\n🧪 测试 ${i + 1}/${TEST_CASES.length}: ${testCase.name}`);
      console.log(`   📝 描述: ${testCase.description}`);
      
      try {
        const result = await this.runTestCase(testCase);
        this.results.push(result);
        
        if (result.success) {
          console.log(`   ✅ 成功 - 耗时: ${result.duration}ms`);
          console.log(`   📊 响应类型: ${result.responseType}, Stop Reason: ${result.stopReason}`);
          if (result.toolCallsCount > 0) {
            console.log(`   🔧 工具调用: ${result.toolCallsCount}个`);
          }
        } else {
          console.log(`   ❌ 失败 - ${result.error}`);
        }
        
      } catch (error) {
        console.log(`   💥 异常 - ${error.message}`);
        this.results.push({
          testCase: testCase.name,
          success: false,
          error: error.message,
          duration: 0
        });
      }
      
      // 测试间隔
      if (i < TEST_CASES.length - 1) {
        await this.sleep(2000);
      }
    }

    // 输出测试总结
    this.printSummary();
  }

  async checkServiceHealth() {
    try {
      console.log('🔍 检查服务健康状态...');
      const response = await axios.get(`${CONFIG.BASE_URL}/health`, {
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('✅ 服务运行正常');
        return true;
      }
    } catch (error) {
      console.log(`⚠️ 服务健康检查失败: ${error.message}`);
    }
    return false;
  }

  async runTestCase(testCase) {
    const startTime = Date.now();
    
    const requestPayload = {
      model: "gemini-2.5-flash",
      messages: testCase.messages,
      max_tokens: 1000,
      temperature: 0.7
    };

    if (testCase.tools) {
      requestPayload.tools = testCase.tools;
    }

    try {
      // 发送请求
      const response = await axios.post(`${CONFIG.BASE_URL}/v1/messages`, requestPayload, {
        timeout: CONFIG.TEST_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const duration = Date.now() - startTime;
      
      // 保存调试信息
      await this.saveDebugInfo(testCase.name, requestPayload, response.data);
      
      // 分析响应
      const analysis = this.analyzeResponse(response.data, testCase);
      
      return {
        testCase: testCase.name,
        success: true,
        duration,
        responseType: analysis.responseType,
        stopReason: analysis.stopReason,
        toolCallsCount: analysis.toolCallsCount,
        contentBlocks: analysis.contentBlocks,
        matchesExpected: analysis.matchesExpected,
        rawResponse: response.data
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 保存错误信息
      await this.saveErrorInfo(testCase.name, requestPayload, error);
      
      return {
        testCase: testCase.name,
        success: false,
        error: error.response?.data?.error?.message || error.message,
        duration,
        httpStatus: error.response?.status
      };
    }
  }

  analyzeResponse(response, testCase) {
    const analysis = {
      responseType: 'unknown',
      stopReason: response.stop_reason || 'missing',
      toolCallsCount: 0,
      contentBlocks: response.content?.length || 0,
      matchesExpected: false
    };

    if (response.content && Array.isArray(response.content)) {
      const hasText = response.content.some(block => block.type === 'text');
      const hasToolUse = response.content.some(block => block.type === 'tool_use');
      
      analysis.toolCallsCount = response.content.filter(block => block.type === 'tool_use').length;
      
      if (hasToolUse) {
        analysis.responseType = 'tool_call';
      } else if (hasText) {
        analysis.responseType = 'text_only';
      }
    }

    // 检查是否符合预期
    analysis.matchesExpected = (
      analysis.responseType === testCase.expectedType &&
      analysis.stopReason === testCase.expectedStopReason
    );

    return analysis;
  }

  async saveDebugInfo(testName, request, response) {
    try {
      const filename = `${CONFIG.DEBUG_DIR}/gemini-modular-test-${testName.replace(/\s+/g, '-')}-${Date.now()}.json`;
      const debugData = {
        testName,
        timestamp: new Date().toISOString(),
        architecture: 'modular-v3',
        request,
        response,
        analysis: this.analyzeResponse(response, { expectedType: 'unknown', expectedStopReason: 'unknown' })
      };
      
      fs.writeFileSync(filename, JSON.stringify(debugData, null, 2));
      console.log(`   📄 调试信息保存: ${filename}`);
    } catch (error) {
      console.log(`   ⚠️ 调试信息保存失败: ${error.message}`);
    }
  }

  async saveErrorInfo(testName, request, error) {
    try {
      const filename = `${CONFIG.DEBUG_DIR}/gemini-modular-error-${testName.replace(/\s+/g, '-')}-${Date.now()}.json`;
      const errorData = {
        testName,
        timestamp: new Date().toISOString(),
        request,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        }
      };
      
      fs.writeFileSync(filename, JSON.stringify(errorData, null, 2));
      console.log(`   📄 错误信息保存: ${filename}`);
    } catch (err) {
      console.log(`   ⚠️ 错误信息保存失败: ${err.message}`);
    }
  }

  printSummary() {
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const totalTime = Date.now() - this.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 测试结果总结');
    console.log('='.repeat(80));
    console.log(`总测试数: ${totalTests}`);
    console.log(`成功: ${successfulTests} ✅`);
    console.log(`失败: ${failedTests} ❌`);
    console.log(`总耗时: ${totalTime}ms`);
    console.log(`成功率: ${(successfulTests / totalTests * 100).toFixed(1)}%`);
    
    console.log('\n📝 详细结果:');
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.testCase}`);
      
      if (result.success) {
        console.log(`   响应类型: ${result.responseType}, Stop Reason: ${result.stopReason}`);
        console.log(`   内容块: ${result.contentBlocks}, 工具调用: ${result.toolCallsCount}`);
        console.log(`   符合预期: ${result.matchesExpected ? '✅' : '⚠️'}`);
      } else {
        console.log(`   错误: ${result.error}`);
        if (result.httpStatus) {
          console.log(`   HTTP状态: ${result.httpStatus}`);
        }
      }
    });

    // 关键发现
    console.log('\n🔍 关键发现:');
    const toolCallTests = this.results.filter(r => r.success && r.toolCallsCount > 0);
    if (toolCallTests.length > 0) {
      console.log(`✅ 工具调用功能: ${toolCallTests.length}个测试成功`);
      toolCallTests.forEach(test => {
        console.log(`   ${test.testCase}: ${test.toolCallsCount}个工具调用, stop_reason=${test.stopReason}`);
      });
    } else {
      console.log('❌ 工具调用功能: 未检测到成功的工具调用');
    }

    const correctStopReasons = this.results.filter(r => r.success && r.matchesExpected);
    console.log(`✅ Stop Reason正确性: ${correctStopReasons.length}/${successfulTests} 测试符合预期`);

    console.log('\n🎯 结论:');
    if (successfulTests === totalTests && toolCallTests.length > 0) {
      console.log('🎉 模块化重构成功！所有测试通过，工具调用功能正常');
    } else if (successfulTests > 0 && toolCallTests.length > 0) {
      console.log('🔧 部分成功，工具调用功能已修复，但仍有待改进');
    } else {
      console.log('🚨 重构需要进一步完善，工具调用问题可能仍存在');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 主执行函数
async function main() {
  const tester = new GeminiModularTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('💥 测试执行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { GeminiModularTester, TEST_CASES };