#!/usr/bin/env node
/**
 * Gemini Provider 工具解析综合测试
 * 测试所有Gemini兼容供应商的工具调用解析和大文本处理
 * 项目所有者: Jason Zhang
 */

const fs = require('fs').promises;
const path = require('path');

class GeminiToolParsingTester {
  constructor() {
    this.testResults = [];
    this.rawDataSaved = [];
    this.databasePath = path.join(process.env.HOME, '.route-claude-code/config/database');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  }

  async saveRawData(testName, data) {
    const filename = `gemini-raw-${testName}-${this.timestamp}.json`;
    const filepath = path.join(this.databasePath, filename);
    
    try {
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
      this.rawDataSaved.push({ testName, filepath, size: JSON.stringify(data).length });
      console.log(`💾 原始数据已保存: ${filename}`);
    } catch (error) {
      console.error(`❌ 保存原始数据失败 (${testName}):`, error.message);
    }
  }

  async testProvider(port, providerName, config = {}) {
    console.log(`\n🔍 测试 ${providerName} (端口 ${port})`);
    console.log('=' .repeat(60));

    const testScenarios = [
      'basic_tool_call',
      'large_text_with_tools', 
      'multiple_tools',
      'streaming_tools',
      'tool_error_handling'
    ];

    const providerResults = {
      provider: providerName,
      port,
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { total: 0, passed: 0, failed: 0 }
    };

    for (const scenario of testScenarios) {
      try {
        const result = await this.runTestScenario(port, scenario, config);
        providerResults.tests.push(result);
        providerResults.summary.total++;
        
        if (result.status === 'PASS') {
          providerResults.summary.passed++;
          console.log(`   ✅ ${scenario}: 通过`);
        } else {
          providerResults.summary.failed++;
          console.log(`   ❌ ${scenario}: 失败 - ${result.error}`);
        }

        // 保存原始数据到database
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
        
        providerResults.tests.push(failResult);
        providerResults.summary.total++;
        providerResults.summary.failed++;
        
        console.log(`   ❌ ${scenario}: 异常 - ${error.message}`);
        
        // 保存错误数据
        await this.saveRawData(`${providerName}-${port}-${scenario}-error`, {
          error: error.message,
          stack: error.stack,
          scenario
        });
      }
    }

    providerResults.summary.successRate = 
      `${Math.round((providerResults.summary.passed / providerResults.summary.total) * 100)}%`;

    return providerResults;
  }

  async runTestScenario(port, scenario, config) {
    const baseUrl = `http://localhost:${port}`;
    
    // 构建测试请求
    let testRequest;
    switch (scenario) {
      case 'basic_tool_call':
        testRequest = this.buildBasicToolCallRequest();
        break;
      case 'large_text_with_tools':
        testRequest = this.buildLargeTextWithToolsRequest();
        break;
      case 'multiple_tools':
        testRequest = this.buildMultipleToolsRequest();
        break;
      case 'streaming_tools':
        testRequest = this.buildStreamingToolsRequest();
        break;
      case 'tool_error_handling':
        testRequest = this.buildToolErrorHandlingRequest();
        break;
      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }

    // 发送请求并收集响应数据
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

      // 尝试解析JSON响应
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseBody);
        rawData.response.parsed = parsedResponse;
      } catch (e) {
        rawData.response.parseError = e.message;
      }

      const duration = Date.now() - startTime;

      // 分析响应中的工具调用
      const toolAnalysis = this.analyzeToolCalls(parsedResponse || {}, responseBody);
      
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

  buildBasicToolCallRequest() {
    return {
      model: 'gemini-2.0-flash-exp',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: '请使用get_weather工具查询北京的天气'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: '获取指定城市的天气信息',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: '城市名称'
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: '温度单位'
                }
              },
              required: ['city']
            }
          }
        }
      ],
      tool_choice: 'auto'
    };
  }

  buildLargeTextWithToolsRequest() {
    const longText = '这是一个很长的文本内容，用于测试在大量文本响应中工具调用的解析能力。'.repeat(100) + 
      '\n\n现在请使用calculate工具计算一个复杂的数学表达式。';

    return {
      model: 'gemini-2.0-flash-exp',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: longText
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'calculate',
            description: '执行数学计算',
            parameters: {
              type: 'object',
              properties: {
                expression: {
                  type: 'string',
                  description: '要计算的数学表达式'
                }
              },
              required: ['expression']
            }
          }
        }
      ],
      tool_choice: 'auto'
    };
  }

  buildMultipleToolsRequest() {
    return {
      model: 'gemini-2.0-flash-exp',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: '请先查询北京天气，然后计算今天的温度是否适合户外活动，最后发送提醒消息'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: '获取天气信息',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string', description: '城市名称' }
              },
              required: ['city']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'calculate',
            description: '执行计算',
            parameters: {
              type: 'object',
              properties: {
                expression: { type: 'string', description: '计算表达式' }
              },
              required: ['expression']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'send_message',
            description: '发送消息',
            parameters: {
              type: 'object',
              properties: {
                message: { type: 'string', description: '消息内容' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: '优先级' }
              },
              required: ['message']
            }
          }
        }
      ],
      tool_choice: 'auto'
    };
  }

  buildStreamingToolsRequest() {
    return {
      model: 'gemini-2.0-flash-exp',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: '请使用工具查询当前时间并进行格式化'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_current_time',
            description: '获取当前时间',
            parameters: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  description: '时间格式'
                }
              }
            }
          }
        }
      ],
      tool_choice: 'auto',
      stream: true
    };
  }

  buildToolErrorHandlingRequest() {
    return {
      model: 'gemini-2.0-flash-exp',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: '请使用一个不存在的工具'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'nonexistent_tool',
            description: '这是一个不存在的工具，用于测试错误处理',
            parameters: {
              type: 'object',
              properties: {
                param: { type: 'string' }
              }
            }
          }
        }
      ],
      tool_choice: 'required'
    };
  }

  analyzeToolCalls(parsedResponse, rawText) {
    const analysis = {
      hasToolCalls: false,
      toolCallsFound: 0,
      toolCallsDetails: [],
      parsingIssues: [],
      textLength: rawText.length
    };

    try {
      // 检查标准 tool_calls 字段
      if (parsedResponse.content && Array.isArray(parsedResponse.content)) {
        for (const content of parsedResponse.content) {
          if (content.type === 'tool_use') {
            analysis.hasToolCalls = true;
            analysis.toolCallsFound++;
            analysis.toolCallsDetails.push({
              id: content.id,
              name: content.name,
              parameters: content.input,
              type: 'anthropic_format'
            });
          }
        }
      }

      // 检查 OpenAI 格式的 tool_calls
      if (parsedResponse.choices && parsedResponse.choices.length > 0) {
        const choice = parsedResponse.choices[0];
        if (choice.message && choice.message.tool_calls) {
          for (const toolCall of choice.message.tool_calls) {
            analysis.hasToolCalls = true;
            analysis.toolCallsFound++;
            analysis.toolCallsDetails.push({
              id: toolCall.id,
              name: toolCall.function.name,
              parameters: toolCall.function.arguments,
              type: 'openai_format'
            });
          }
        }
      }

      // 在原始文本中搜索可能的工具调用模式
      const toolCallPatterns = [
        /\{[^}]*"type"\s*:\s*"tool_use"[^}]*\}/g,
        /\{[^}]*"function"\s*:\s*\{[^}]*"name"[^}]*\}/g,
        /toolu_[a-zA-Z0-9_]+/g,
        /functionCall/g,
        /tool_calls/g
      ];

      for (const pattern of toolCallPatterns) {
        const matches = rawText.match(pattern);
        if (matches) {
          analysis.parsingIssues.push({
            pattern: pattern.source,
            matches: matches.length,
            examples: matches.slice(0, 3)
          });
        }
      }

      // 检查可能的解析问题
      if (rawText.includes('tool') && !analysis.hasToolCalls) {
        analysis.parsingIssues.push({
          type: 'potential_missed_tools',
          description: '响应中包含"tool"关键词但未检测到工具调用',
          textSample: rawText.substring(0, 500)
        });
      }

    } catch (error) {
      analysis.parsingIssues.push({
        type: 'analysis_error',
        error: error.message
      });
    }

    return analysis;
  }

  async generateReport() {
    const reportPath = path.join(this.databasePath, `gemini-tool-parsing-report-${this.timestamp}.json`);
    const report = {
      testSuite: 'Gemini工具解析综合测试',
      timestamp: new Date().toISOString(),
      results: this.testResults,
      summary: {
        totalProviders: this.testResults.length,
        totalTests: this.testResults.reduce((sum, r) => sum + r.summary.total, 0),
        totalPassed: this.testResults.reduce((sum, r) => sum + r.summary.passed, 0),
        totalFailed: this.testResults.reduce((sum, r) => sum + r.summary.failed, 0)
      },
      rawDataFiles: this.rawDataSaved
    };

    report.summary.overallSuccessRate = 
      `${Math.round((report.summary.totalPassed / report.summary.totalTests) * 100)}%`;

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 测试总结报告');
    console.log('=' .repeat(60));
    console.log(`总供应商数: ${report.summary.totalProviders}`);
    console.log(`总测试数: ${report.summary.totalTests}`);
    console.log(`通过测试: ${report.summary.totalPassed}`);
    console.log(`失败测试: ${report.summary.totalFailed}`);
    console.log(`总成功率: ${report.summary.overallSuccessRate}`);
    console.log(`📁 完整报告: ${reportPath}`);
    console.log(`💾 原始数据文件: ${this.rawDataSaved.length} 个`);

    return report;
  }

  async runComprehensiveTest() {
    console.log('🚀 启动 Gemini 工具解析综合测试');
    console.log('测试范围: 所有兼容供应商 + 大文本 + 流式响应');
    console.log('=' .repeat(80));

    // 测试所有Gemini兼容供应商
    const providers = [
      { port: 5502, name: 'Google Gemini API', config: {} },
      { port: 5508, name: 'ShuaiHong Gemini Compatible', config: {} }
    ];

    for (const provider of providers) {
      try {
        const result = await this.testProvider(provider.port, provider.name, provider.config);
        this.testResults.push(result);
      } catch (error) {
        console.error(`❌ 测试供应商 ${provider.name} 失败:`, error.message);
        this.testResults.push({
          provider: provider.name,
          port: provider.port,
          error: error.message,
          timestamp: new Date().toISOString(),
          tests: [],
          summary: { total: 0, passed: 0, failed: 1 }
        });
      }
    }

    // 生成综合报告
    return await this.generateReport();
  }
}

// 主函数
async function main() {
  const tester = new GeminiToolParsingTester();
  
  try {
    await tester.runComprehensiveTest();
    console.log('\n✅ Gemini工具解析综合测试完成');
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GeminiToolParsingTester };