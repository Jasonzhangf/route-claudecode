#!/usr/bin/env node
/**
 * Gemini Anthropic格式真机测试
 * 使用正确的Anthropic格式测试Gemini Provider工具调用
 * 项目所有者: Jason Zhang
 */

const fs = require('fs').promises;
const path = require('path');

class GeminiAnthropicRealWorldTester {
  constructor() {
    this.databasePath = path.join(process.env.HOME, '.route-claude-code/config/database');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.testResults = [];
  }

  async runRealWorldTest() {
    console.log('🚀 Gemini Anthropic格式真机测试');
    console.log('使用正确的Anthropic格式测试工具调用功能');
    console.log('=' .repeat(80));

    const providers = [
      { port: 5502, name: 'Google Gemini API', config: {} }
    ];

    for (const provider of providers) {
      await this.testProvider(provider.port, provider.name, provider.config);
    }

    await this.generateReport();
  }

  async testProvider(port, providerName, config) {
    console.log(`\n🔍 测试 ${providerName} (端口 ${port})`);
    console.log('=' .repeat(60));

    const testScenarios = [
      'anthropic_basic_tool',
      'anthropic_large_text_tool', 
      'anthropic_multiple_tools',
      'anthropic_tool_result_roundtrip'
    ];

    const providerResult = {
      provider: providerName,
      port,
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { total: 0, passed: 0, failed: 0 }
    };

    for (const scenario of testScenarios) {
      try {
        const result = await this.runTestScenario(port, scenario, config);
        providerResult.tests.push(result);
        providerResult.summary.total++;
        
        if (result.status === 'PASS') {
          providerResult.summary.passed++;
          console.log(`   ✅ ${scenario}: 通过`);
        } else {
          providerResult.summary.failed++;
          console.log(`   ❌ ${scenario}: 失败 - ${result.error}`);
        }

        // 保存原始数据
        if (result.rawData) {
          await this.saveRawData(`${providerName}-${port}-${scenario}`, result.rawData);
        }

      } catch (error) {
        const failResult = {
          scenario,
          status: 'FAIL',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        
        providerResult.tests.push(failResult);
        providerResult.summary.total++;
        providerResult.summary.failed++;
        
        console.log(`   ❌ ${scenario}: 异常 - ${error.message}`);
      }
    }

    providerResult.summary.successRate = 
      `${Math.round((providerResult.summary.passed / providerResult.summary.total) * 100)}%`;

    this.testResults.push(providerResult);
    return providerResult;
  }

  async runTestScenario(port, scenario, config) {
    const baseUrl = `http://localhost:${port}`;
    
    let testRequest;
    switch (scenario) {
      case 'anthropic_basic_tool':
        testRequest = this.buildAnthropicBasicToolRequest();
        break;
      case 'anthropic_large_text_tool':
        testRequest = this.buildAnthropicLargeTextToolRequest();
        break;
      case 'anthropic_multiple_tools':
        testRequest = this.buildAnthropicMultipleToolsRequest();
        break;
      case 'anthropic_tool_result_roundtrip':
        testRequest = this.buildAnthropicToolResultRequest();
        break;
      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }

    // 发送请求
    const startTime = Date.now();
    let response, rawData;

    try {
      const fetch = (await import('node-fetch')).default;
      
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey || 'test-key'}`,
          ...config.headers
        },
        body: JSON.stringify(testRequest)
      };

      response = await fetch(`${baseUrl}/v1/messages`, fetchOptions);
      rawData = {
        request: testRequest,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        }
      };

      const responseBody = await response.text();
      rawData.response.body = responseBody;

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseBody);
        rawData.response.parsed = parsedResponse;
      } catch (e) {
        rawData.response.parseError = e.message;
      }

      const duration = Date.now() - startTime;
      const toolAnalysis = this.analyzeAnthropicToolCalls(parsedResponse || {}, responseBody);
      
      return {
        scenario,
        status: response.ok ? 'PASS' : 'FAIL',
        duration,
        toolAnalysis,
        rawData,
        timestamp: new Date().toISOString(),
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        scenario,
        status: 'FAIL',
        duration,
        error: error.message,
        rawData: rawData || { request: testRequest, error: error.message },
        timestamp: new Date().toISOString()
      };
    }
  }

  buildAnthropicBasicToolRequest() {
    return {
      "model": "gemini-2.0-flash-exp",
      "max_tokens": 1000,
      "messages": [
        {
          "role": "user",
          "content": "请使用工具查询北京的天气"
        }
      ],
      "tools": [
        {
          "name": "get_weather",
          "description": "获取指定城市的天气信息",
          "input_schema": {
            "type": "object",
            "properties": {
              "city": {
                "type": "string",
                "description": "城市名称"
              },
              "unit": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "温度单位"
              }
            },
            "required": ["city"]
          }
        }
      ]
    };
  }

  buildAnthropicLargeTextToolRequest() {
    const longText = '这是一个很长的文本内容，用于测试在大量文本响应中工具调用的解析能力。'.repeat(50) + 
      '\n\n现在请使用calculate工具计算一个复杂的数学表达式。';

    return {
      "model": "gemini-2.0-flash-exp",
      "max_tokens": 2000,
      "messages": [
        {
          "role": "user",
          "content": longText
        }
      ],
      "tools": [
        {
          "name": "calculate",
          "description": "执行数学计算",
          "input_schema": {
            "type": "object",
            "properties": {
              "expression": {
                "type": "string",
                "description": "要计算的数学表达式"
              }
            },
            "required": ["expression"]
          }
        }
      ]
    };
  }

  buildAnthropicMultipleToolsRequest() {
    return {
      "model": "gemini-2.0-flash-exp",
      "max_tokens": 1500,
      "messages": [
        {
          "role": "user",
          "content": "请先查询北京天气，然后计算温度转换，最后发送提醒消息"
        }
      ],
      "tools": [
        {
          "name": "get_weather",
          "description": "获取天气信息",
          "input_schema": {
            "type": "object",
            "properties": {
              "city": { "type": "string", "description": "城市名称" }
            },
            "required": ["city"]
          }
        },
        {
          "name": "calculate",
          "description": "执行计算",
          "input_schema": {
            "type": "object",
            "properties": {
              "expression": { "type": "string", "description": "计算表达式" }
            },
            "required": ["expression"]
          }
        },
        {
          "name": "send_message",
          "description": "发送消息",
          "input_schema": {
            "type": "object",
            "properties": {
              "message": { "type": "string", "description": "消息内容" },
              "priority": { "type": "string", "enum": ["low", "medium", "high"], "description": "优先级" }
            },
            "required": ["message"]
          }
        }
      ]
    };
  }

  buildAnthropicToolResultRequest() {
    return {
      "model": "gemini-2.0-flash-exp", 
      "max_tokens": 1000,
      "messages": [
        {
          "role": "user",
          "content": "请查询天气"
        },
        {
          "role": "assistant",
          "content": [
            {
              "type": "tool_use",
              "id": "toolu_123456789",
              "name": "get_weather",
              "input": {
                "city": "北京"
              }
            }
          ]
        },
        {
          "role": "user",
          "content": [
            {
              "type": "tool_result",
              "tool_use_id": "toolu_123456789",
              "content": "北京今天晴天，温度25°C，湿度60%"
            }
          ]
        }
      ],
      "tools": [
        {
          "name": "get_weather",
          "description": "获取天气信息",
          "input_schema": {
            "type": "object",
            "properties": {
              "city": { "type": "string", "description": "城市名称" }
            },
            "required": ["city"]
          }
        }
      ]
    };
  }

  analyzeAnthropicToolCalls(parsedResponse, rawText) {
    const analysis = {
      hasToolCalls: false,
      toolCallsFound: 0,
      toolCallsDetails: [],
      parsingIssues: [],
      textLength: rawText.length,
      format: 'anthropic'
    };

    try {
      // 检查Anthropic格式的tool_use
      if (parsedResponse.content && Array.isArray(parsedResponse.content)) {
        for (const content of parsedResponse.content) {
          if (content.type === 'tool_use') {
            analysis.hasToolCalls = true;
            analysis.toolCallsFound++;
            analysis.toolCallsDetails.push({
              id: content.id,
              name: content.name,
              input: content.input,
              type: 'anthropic_tool_use'
            });
          }
        }
      }

      // 检查是否有错误信息
      if (parsedResponse.error) {
        analysis.parsingIssues.push({
          type: 'api_error',
          message: parsedResponse.error.message,
          code: parsedResponse.error.code
        });
      }

      // 分析原始文本中的工具调用模式
      const toolPatterns = [
        /tool_use/g,
        /toolu_[a-zA-Z0-9_]+/g,
        /functionCall/g,
        /"missing function"/g
      ];

      for (const pattern of toolPatterns) {
        const matches = rawText.match(pattern);
        if (matches) {
          analysis.parsingIssues.push({
            pattern: pattern.source,
            matches: matches.length,
            examples: matches.slice(0, 3)
          });
        }
      }

    } catch (error) {
      analysis.parsingIssues.push({
        type: 'analysis_error',
        error: error.message
      });
    }

    return analysis;
  }

  async saveRawData(testName, data) {
    const filename = `anthropic-real-${testName}-${this.timestamp}.json`;
    const filepath = path.join(this.databasePath, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      console.log(`💾 原始数据已保存: ${filename}`);
    } catch (error) {
      console.error(`❌ 保存原始数据失败 (${testName}):`, error.message);
    }
  }

  async generateReport() {
    console.log('\n📊 Anthropic格式真机测试报告');
    console.log('=' .repeat(60));
    
    const report = {
      testSuite: 'Gemini Anthropic格式真机测试',
      timestamp: new Date().toISOString(),
      architecture: 'Anthropic格式 → Gemini Provider → Anthropic格式',
      results: this.testResults,
      summary: {
        totalProviders: this.testResults.length,
        totalTests: this.testResults.reduce((sum, r) => sum + r.summary.total, 0),
        totalPassed: this.testResults.reduce((sum, r) => sum + r.summary.passed, 0),
        totalFailed: this.testResults.reduce((sum, r) => sum + r.summary.failed, 0)
      }
    };

    report.summary.overallSuccessRate = 
      `${Math.round((report.summary.totalPassed / report.summary.totalTests) * 100)}%`;

    const reportPath = path.join(this.databasePath, `anthropic-real-test-report-${this.timestamp}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`总供应商数: ${report.summary.totalProviders}`);
    console.log(`总测试数: ${report.summary.totalTests}`);
    console.log(`通过测试: ${report.summary.totalPassed}`);
    console.log(`失败测试: ${report.summary.totalFailed}`);
    console.log(`总成功率: ${report.summary.overallSuccessRate}`);
    console.log(`📁 完整报告: ${reportPath}`);

    // 分析结果
    if (report.summary.totalPassed > 0) {
      console.log('\n🎉 发现工作的测试用例！');
      console.log('✅ Anthropic格式工具调用功能已验证');
    } else {
      console.log('\n⚠️  仍有问题需要进一步调试');
      console.log('🔧 需要检查具体的转换逻辑实现');
    }

    return report;
  }
}

// 主函数
async function main() {
  const tester = new GeminiAnthropicRealWorldTester();
  
  try {
    await tester.runRealWorldTest();
    console.log('\n✅ Anthropic格式真机测试完成');
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GeminiAnthropicRealWorldTester };