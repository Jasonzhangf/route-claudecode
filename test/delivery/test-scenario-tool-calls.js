#!/usr/bin/env node

/**
 * Delivery Test: Tool Calls Scenario Coverage
 * 测试所有Provider的工具调用处理能力
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  scenarios: [
    {
      name: 'simple-tool-call',
      description: '简单工具调用测试',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: '请帮我创建一个待办事项：完成交付测试'
          }
        ],
        tools: [
          {
            name: 'TodoWrite',
            description: 'Create todo items',
            input_schema: {
              type: 'object',
              properties: {
                todos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      content: { type: 'string' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] }
                    },
                    required: ['content', 'priority', 'status']
                  }
                }
              },
              required: ['todos']
            }
          }
        ]
      }
    },
    {
      name: 'multi-tool-call',
      description: '多工具调用测试',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: '请先搜索claude-code-router项目的相关信息，然后创建一个分析报告的待办事项'
          }
        ],
        tools: [
          {
            name: 'WebSearch',
            description: 'Search the web for information',
            input_schema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                max_results: { type: 'number', default: 5 }
              },
              required: ['query']
            }
          },
          {
            name: 'TodoWrite',
            description: 'Create todo items',
            input_schema: {
              type: 'object',
              properties: {
                todos: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      content: { type: 'string' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] }
                    },
                    required: ['content', 'priority', 'status']
                  }
                }
              },
              required: ['todos']
            }
          }
        ]
      }
    },
    {
      name: 'complex-schema-tool',
      description: '复杂Schema工具调用测试',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: '请分析claude-code-router项目的架构并生成一个多级的项目分析报告'
          }
        ],
        tools: [
          {
            name: 'AnalysisReport',
            description: 'Generate structured analysis report',
            input_schema: {
              type: 'object',
              properties: {
                project: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    version: { type: 'string' },
                    architecture: {
                      type: 'object',
                      properties: {
                        layers: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              description: { type: 'string' },
                              components: {
                                type: 'array',
                                items: { type: 'string' }
                              }
                            },
                            required: ['name', 'description']
                          }
                        },
                        providers: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              type: { type: 'string' },
                              features: {
                                type: 'array',
                                items: { type: 'string' }
                              }
                            },
                            required: ['name', 'type']
                          }
                        }
                      },
                      required: ['layers', 'providers']
                    }
                  },
                  required: ['name', 'version', 'architecture']
                },
                analysis: {
                  type: 'object',
                  properties: {
                    strengths: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    improvements: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    recommendations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          category: { type: 'string' },
                          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                          description: { type: 'string' }
                        },
                        required: ['category', 'priority', 'description']
                      }
                    }
                  },
                  required: ['strengths', 'improvements', 'recommendations']
                }
              },
              required: ['project', 'analysis']
            }
          }
        ]
      }
    }
  ]
};

// Provider配置
const PROVIDERS = [
  { name: 'codewhisperer', port: 3458, config: 'config-codewhisperer-only.json' },
  { name: 'openai', port: 3459, config: 'config-openai-only.json' },
  { name: 'gemini', port: 3460, config: 'config-gemini-only.json' },
  { name: 'anthropic', port: 3461, config: 'config-anthropic-only.json' }
];

class ToolCallsDeliveryTester {
  constructor() {
    this.results = [];
    this.outputDir = path.join(process.env.HOME, '.route-claude-code/database/delivery-testing/scenarios/tool-calls');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async testProvider(provider, scenario) {
    const startTime = Date.now();
    console.log(`\\n🧪 Testing ${provider.name} - ${scenario.name}`);
    
    try {
      const response = await axios.post(`http://localhost:${provider.port}/v1/messages`, scenario.request, {
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Session': `delivery-tool-calls-${Date.now()}`
        },
        timeout: 30000
      });

      const duration = Date.now() - startTime;
      const result = this.analyzeToolCallResponse(response.data, scenario, provider, duration);
      
      // 保存原始数据
      this.saveRawData(provider.name, scenario.name, {
        request: scenario.request,
        response: response.data,
        result: result
      });

      console.log(`   ✅ ${result.status} - ${result.summary}`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const result = {
        provider: provider.name,
        scenario: scenario.name,
        status: 'FAILED',
        duration: duration,
        error: {
          message: error.message,
          code: error.response?.status || 'NETWORK_ERROR',
          details: error.response?.data || error.toString()
        },
        summary: `Error: ${error.message}`,
        toolCallsDetected: 0,
        toolCallsExecuted: 0,
        responseComplete: false
      };

      console.log(`   ❌ FAILED - ${error.message}`);
      return result;
    }
  }

  analyzeToolCallResponse(response, scenario, provider, duration) {
    const result = {
      provider: provider.name,
      scenario: scenario.name,
      status: 'UNKNOWN',
      duration: duration,
      toolCallsDetected: 0,
      toolCallsExecuted: 0,
      responseComplete: false,
      contentBlocks: [],
      usage: response.usage || {},
      model: response.model || 'unknown'
    };

    // 分析响应内容
    if (response.content && Array.isArray(response.content)) {
      result.contentBlocks = response.content;
      
      // 统计工具调用
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      result.toolCallsDetected = toolUseBlocks.length;
      
      // 检查工具调用质量
      let validToolCalls = 0;
      for (const toolBlock of toolUseBlocks) {
        if (toolBlock.name && toolBlock.input && typeof toolBlock.input === 'object') {
          validToolCalls++;
          
          // 验证工具调用是否符合期望的schema
          const expectedTool = scenario.request.tools.find(t => t.name === toolBlock.name);
          if (expectedTool && this.validateToolInput(toolBlock.input, expectedTool.input_schema)) {
            result.toolCallsExecuted++;
          }
        }
      }

      // 检查响应完整性
      result.responseComplete = response.stop_reason === 'tool_use' || response.stop_reason === 'end_turn';
      
      // 综合判断测试结果
      if (result.toolCallsDetected > 0 && result.toolCallsExecuted === result.toolCallsDetected && result.responseComplete) {
        result.status = 'PASSED';
        result.summary = `Successfully executed ${result.toolCallsExecuted} tool call(s)`;
      } else if (result.toolCallsDetected > 0 && result.toolCallsExecuted < result.toolCallsDetected) {
        result.status = 'PARTIAL';
        result.summary = `Partial success: ${result.toolCallsExecuted}/${result.toolCallsDetected} tool calls executed`;
      } else if (result.toolCallsDetected === 0 && scenario.request.tools.length > 0) {
        result.status = 'FAILED';
        result.summary = 'No tool calls detected despite tools being available';
      } else {
        result.status = 'FAILED';
        result.summary = 'Response incomplete or invalid';
      }
    } else {
      result.status = 'FAILED';
      result.summary = 'Invalid response format - no content array';
    }

    return result;
  }

  validateToolInput(input, schema) {
    // 简单的schema验证
    if (schema.type === 'object' && schema.required) {
      return schema.required.every(field => input.hasOwnProperty(field));
    }
    return true;
  }

  saveRawData(provider, scenario, data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${provider}-${scenario}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`   💾 Raw data saved: ${filename}`);
  }

  async runAllTests() {
    console.log('🚀 Starting Tool Calls Delivery Testing');
    console.log(`Testing ${PROVIDERS.length} providers with ${TEST_CONFIG.scenarios.length} scenarios`);

    for (const provider of PROVIDERS) {
      console.log(`\\n📊 Testing Provider: ${provider.name} (Port: ${provider.port})`);
      
      for (const scenario of TEST_CONFIG.scenarios) {
        const result = await this.testProvider(provider, scenario);
        this.results.push(result);
        
        // 短暂延迟避免过快请求
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return this.generateReport();
  }

  generateReport() {
    const report = {
      testSuite: 'Tool Calls Delivery Testing',
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.length,
        passed: this.results.filter(r => r.status === 'PASSED').length,
        failed: this.results.filter(r => r.status === 'FAILED').length,
        partial: this.results.filter(r => r.status === 'PARTIAL').length
      },
      providerSummary: {},
      scenarioSummary: {},
      detailedResults: this.results
    };

    // Provider汇总
    for (const provider of PROVIDERS) {
      const providerResults = this.results.filter(r => r.provider === provider.name);
      report.providerSummary[provider.name] = {
        total: providerResults.length,
        passed: providerResults.filter(r => r.status === 'PASSED').length,
        failed: providerResults.filter(r => r.status === 'FAILED').length,
        partial: providerResults.filter(r => r.status === 'PARTIAL').length,
        avgDuration: Math.round(providerResults.reduce((sum, r) => sum + r.duration, 0) / providerResults.length),
        totalToolCalls: providerResults.reduce((sum, r) => sum + (r.toolCallsExecuted || 0), 0)
      };
    }

    // Scenario汇总
    for (const scenario of TEST_CONFIG.scenarios) {
      const scenarioResults = this.results.filter(r => r.scenario === scenario.name);
      report.scenarioSummary[scenario.name] = {
        total: scenarioResults.length,
        passed: scenarioResults.filter(r => r.status === 'PASSED').length,
        failed: scenarioResults.filter(r => r.status === 'FAILED').length,
        partial: scenarioResults.filter(r => r.status === 'PARTIAL').length,
        avgDuration: Math.round(scenarioResults.reduce((sum, r) => sum + r.duration, 0) / scenarioResults.length)
      };
    }

    // 保存报告
    const reportPath = path.join(this.outputDir, `tool-calls-delivery-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  printReport(report) {
    console.log('\\n📋 Tool Calls Delivery Test Report');
    console.log('=' * 50);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Partial: ${report.summary.partial}`);
    console.log(`Success Rate: ${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%`);

    console.log('\\n📊 Provider Performance:');
    for (const [provider, stats] of Object.entries(report.providerSummary)) {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`  ${provider}: ${stats.passed}/${stats.total} (${successRate}%) - ${stats.avgDuration}ms avg - ${stats.totalToolCalls} tools executed`);
    }

    console.log('\\n🎭 Scenario Results:');
    for (const [scenario, stats] of Object.entries(report.scenarioSummary)) {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`  ${scenario}: ${stats.passed}/${stats.total} (${successRate}%) - ${stats.avgDuration}ms avg`);
    }

    if (report.summary.failed > 0 || report.summary.partial > 0) {
      console.log('\\n⚠️  Issues Found:');
      for (const result of report.detailedResults) {
        if (result.status !== 'PASSED') {
          console.log(`  ${result.provider} - ${result.scenario}: ${result.summary}`);
        }
      }
    }
  }
}

// 执行测试
async function main() {
  const tester = new ToolCallsDeliveryTester();
  
  try {
    const report = await tester.runAllTests();
    tester.printReport(report);
    
    // 退出码根据测试结果决定
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Tool Calls Testing Failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ToolCallsDeliveryTester;