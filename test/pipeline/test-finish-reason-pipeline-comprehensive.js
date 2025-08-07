#!/usr/bin/env node

/**
 * Comprehensive Finish Reason Pipeline Test
 * 全面测试finish reason处理流水线
 * 
 * 测试用例: 验证OpenAI到Anthropic协议转换中的finish reason处理
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test Configuration
const TEST_CONFIG = {
  port: 3456,
  timeout: 30000,
  outputDir: './test/pipeline/outputs',
  scenarios: [
    {
      name: 'normal-tool-call',
      description: '正常工具调用响应测试',
      mockResponse: {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_test123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "San Francisco"}'
              }
            }]
          },
          finish_reason: 'tool_calls'
        }]
      }
    },
    {
      name: 'text-format-tool-call',
      description: '文本格式工具调用测试(GLM-4.5格式)',
      mockResponse: {
        content: [{
          type: 'text',
          text: 'I will help you with that. Tool call: Edit({"file_path": "/test/file.js", "new_content": "console.log(\\"hello\\")"})'
        }],
        role: 'assistant',
        stop_reason: 'end_turn'  // 错误的stop_reason，应该被修正为tool_use
      }
    },
    {
      name: 'wrong-finish-reason',
      description: '错误finish reason测试 - 有工具调用但finish_reason为stop',
      mockResponse: {
        choices: [{
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: 'call_wrong123',
              type: 'function',
              function: {
                name: 'calculate',
                arguments: '{"expression": "2+2"}'
              }
            }]
          },
          finish_reason: 'stop'  // 错误：应该是tool_calls
        }]
      }
    },
    {
      name: 'unknown-finish-reason',
      description: 'Unknown finish reason测试',
      mockResponse: {
        choices: [{
          message: {
            role: 'assistant',
            content: 'This is a test response'
          },
          finish_reason: 'unknown'  // 应该抛出错误或映射到合适值
        }]
      }
    },
    {
      name: 'mixed-content-tool-call',
      description: '混合内容工具调用测试',
      mockResponse: {
        content: [{
          type: 'text',
          text: 'Here is the result: {"type": "tool_use", "id": "toolu_mixed123", "name": "search", "input": {"query": "test"}} and some additional text.'
        }],
        role: 'assistant',
        stop_reason: 'end_turn'  // 应该被修正为tool_use
      }
    },
    {
      name: 'no-tools-correct-reason',
      description: '无工具调用正确finish reason测试',
      mockResponse: {
        choices: [{
          message: {
            role: 'assistant',
            content: 'This is a normal response without tools.'
          },
          finish_reason: 'stop'
        }]
      }
    }
  ]
};

class FinishReasonPipelineTest {
  constructor() {
    this.results = [];
    this.baseUrl = `http://localhost:${TEST_CONFIG.port}`;
    
    // 确保输出目录存在
    if (!fs.existsSync(TEST_CONFIG.outputDir)) {
      fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
    }
  }

  /**
   * 执行完整测试流程
   */
  async runComprehensiveTest() {
    console.log('🚀 Starting Comprehensive Finish Reason Pipeline Test...');
    console.log(`📊 Testing ${TEST_CONFIG.scenarios.length} scenarios on port ${TEST_CONFIG.port}\n`);

    const startTime = Date.now();
    
    try {
      // 检查服务健康状态
      await this.checkServiceHealth();
      
      // 执行所有测试场景
      for (const scenario of TEST_CONFIG.scenarios) {
        await this.testScenario(scenario);
      }
      
      // 生成测试报告
      const duration = Date.now() - startTime;
      await this.generateTestReport(duration);
      
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * 检查服务健康状态
   */
  async checkServiceHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      
      console.log('✅ Service health check passed');
      console.log('📊 Health status:', JSON.stringify(response.data, null, 2));
      
    } catch (error) {
      throw new Error(`Service health check failed: ${error.message}`);
    }
  }

  /**
   * 测试单个场景
   */
  async testScenario(scenario) {
    console.log(`\n🧪 Testing scenario: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    
    const startTime = Date.now();
    const result = {
      scenario: scenario.name,
      description: scenario.description,
      success: false,
      duration: 0,
      originalData: scenario.mockResponse,
      processedData: null,
      findings: [],
      errors: []
    };
    
    try {
      // 模拟通过路由发送请求来触发流水线处理
      const testRequest = this.createTestRequest(scenario);
      
      console.log('📤 Sending test request...');
      const response = await axios.post(`${this.baseUrl}/anthropic/messages`, testRequest, {
        timeout: TEST_CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      result.processedData = response.data;
      result.success = response.status === 200;
      result.duration = Date.now() - startTime;
      
      // 分析处理结果
      this.analyzeScenarioResult(scenario, result);
      
      console.log(`✅ Scenario completed in ${result.duration}ms`);
      
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.errors.push(error.message);
      
      if (error.response) {
        result.processedData = error.response.data;
        console.log(`❌ Scenario failed with ${error.response.status}: ${error.response.statusText}`);\n        console.log('Response data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log(`❌ Scenario failed: ${error.message}`);\n      }
    }
    
    this.results.push(result);
    
    // 保存场景详细结果
    await this.saveScenarioResult(scenario.name, result);
  }

  /**
   * 创建测试请求
   */
  createTestRequest(scenario) {
    // 根据不同场景创建合适的请求
    const baseRequest = {
      model: 'claude-4-sonnet', // 使用支持工具调用的模型
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Test scenario: ${scenario.name}. Please simulate the expected response pattern.`
      }]
    };

    // 对于需要工具调用的场景，添加工具定义
    if (scenario.name.includes('tool')) {
      baseRequest.tools = [{
        name: 'get_weather',
        description: 'Get weather information for a location',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          }
        }
      }, {
        name: 'Edit',
        description: 'Edit a file with new content',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            new_content: { type: 'string' }
          }
        }
      }];
    }

    return baseRequest;
  }

  /**
   * 分析场景处理结果
   */
  analyzeScenarioResult(scenario, result) {
    if (!result.processedData) {
      result.findings.push('No processed data received');
      return;
    }

    const processed = result.processedData;
    
    // 分析finish reason处理
    this.analyzeFinishReasonHandling(scenario, processed, result);
    
    // 分析工具调用处理
    this.analyzeToolCallHandling(scenario, processed, result);
    
    // 分析响应一致性
    this.analyzeResponseConsistency(scenario, processed, result);
  }

  /**
   * 分析finish reason处理
   */
  analyzeFinishReasonHandling(scenario, processed, result) {
    const stopReason = processed.stop_reason;
    const hasContent = processed.content && processed.content.length > 0;
    const hasToolUseBlocks = hasContent && processed.content.some(block => block.type === 'tool_use');
    
    // 根据场景名称推断预期行为
    if (scenario.name.includes('tool')) {
      if (hasToolUseBlocks) {
        if (stopReason === 'tool_use') {
          result.findings.push('✅ Correct: Has tool calls and stop_reason is tool_use');
        } else {
          result.findings.push(`❌ Error: Has tool calls but stop_reason is '${stopReason}', expected 'tool_use'`);\n        }
      } else {
        result.findings.push('⚠️  Warning: Expected tool calls but none found in response');
      }
    } else {
      // 非工具调用场景
      if (stopReason === 'end_turn' || stopReason === 'stop') {
        result.findings.push('✅ Correct: Normal response with appropriate stop_reason');
      } else {
        result.findings.push(`⚠️  Warning: Non-tool response has stop_reason '${stopReason}'`);\n      }
    }
  }

  /**
   * 分析工具调用处理
   */
  analyzeToolCallHandling(scenario, processed, result) {
    if (!processed.content) return;
    
    const toolBlocks = processed.content.filter(block => block.type === 'tool_use');
    const textBlocks = processed.content.filter(block => block.type === 'text');
    
    result.findings.push(`📊 Content analysis: ${toolBlocks.length} tool blocks, ${textBlocks.length} text blocks`);\n    
    // 检查文本块中是否还有未处理的工具调用
    textBlocks.forEach((block, index) => {
      if (this.containsToolCallPatterns(block.text)) {
        result.findings.push(`❌ Error: Text block ${index} still contains unprocessed tool call patterns`);\n        result.findings.push(`   Text sample: ${block.text.substring(0, 100)}...`);\n      }
    });
    
    // 验证工具调用块格式
    toolBlocks.forEach((block, index) => {
      if (!block.id || !block.name || block.input === undefined) {
        result.findings.push(`❌ Error: Tool block ${index} has invalid format`);\n        result.findings.push(`   Missing: ${!block.id ? 'id ' : ''}${!block.name ? 'name ' : ''}${block.input === undefined ? 'input' : ''}`);\n      } else {
        result.findings.push(`✅ Tool block ${index}: Valid format (${block.name})`);\n      }
    });
  }

  /**
   * 分析响应一致性
   */
  analyzeResponseConsistency(scenario, processed, result) {
    const hasToolBlocks = processed.content && processed.content.some(block => block.type === 'tool_use');
    const stopReason = processed.stop_reason;
    
    // 逻辑一致性检查
    if (hasToolBlocks && stopReason !== 'tool_use') {
      result.findings.push(`❌ Inconsistency: Has tools but stop_reason is '${stopReason}' instead of 'tool_use'`);\n    }
    
    if (!hasToolBlocks && stopReason === 'tool_use') {
      result.findings.push(`❌ Inconsistency: No tools but stop_reason is 'tool_use'`);\n    }
    
    if (hasToolBlocks && stopReason === 'tool_use') {
      result.findings.push('✅ Consistency: Tool blocks and stop_reason are aligned');
    }
  }

  /**
   * 检查文本中是否包含工具调用模式
   */
  containsToolCallPatterns(text) {
    if (!text) return false;
    
    const patterns = [
      /Tool\s+call:\s*\w+\s*\(/i,
      /\{\s*"type"\s*:\s*"tool_use"\s*,/i,
      /\{\s*"id"\s*:\s*"toolu_[^"]+"\s*,/i,
      /"name"\s*:\s*"[^"]+"\s*,\s*"input"\s*:\s*\{/i,
      /\w+\s*\(\s*\{\s*"[^"]+"\s*:\s*"[^"]*"/i
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * 保存场景结果
   */
  async saveScenarioResult(scenarioName, result) {
    const filename = path.join(TEST_CONFIG.outputDir, `${scenarioName}-result.json`);
    
    try {
      await fs.promises.writeFile(filename, JSON.stringify(result, null, 2));
      console.log(`📁 Scenario result saved: ${filename}`);\n    } catch (error) {
      console.error(`Failed to save scenario result: ${error.message}`);\n    }
  }

  /**
   * 生成测试报告
   */
  async generateTestReport(duration) {
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.length - passed;
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
    
    const report = {
      summary: {
        total: this.results.length,
        passed,
        failed,
        passRate: `${(passed / this.results.length * 100).toFixed(1)}%`,
        totalDuration: `${duration}ms`,\n        avgScenarioDuration: `${avgDuration.toFixed(1)}ms`\n      },
      timestamp: new Date().toISOString(),
      results: this.results,
      keyFindings: this.summarizeKeyFindings()
    };
    
    // 保存详细报告
    const reportPath = path.join(TEST_CONFIG.outputDir, 'comprehensive-test-report.json');
    await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // 输出控制台总结
    console.log('\\n' + '='.repeat(70));
    console.log('🎯 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(70));
    console.log(`📊 Total Tests: ${report.summary.total}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`📈 Pass Rate: ${report.summary.passRate}`);
    console.log(`⏱️  Total Duration: ${report.summary.totalDuration}`);
    console.log(`⏱️  Avg Duration: ${report.summary.avgScenarioDuration}`);
    
    console.log('\\n🔍 KEY FINDINGS:');
    report.keyFindings.forEach((finding, index) => {
      console.log(`${index + 1}. ${finding}`);
    });
    
    console.log(`\\n📁 Detailed report saved: ${reportPath}`);\n    console.log('='.repeat(70));
  }

  /**
   * 总结关键发现
   */
  summarizeKeyFindings() {
    const findings = [];
    
    // 统计工具调用处理成功率
    const toolScenarios = this.results.filter(r => r.scenario.includes('tool'));
    const toolSuccessRate = toolScenarios.filter(r => r.success).length / toolScenarios.length * 100;
    findings.push(`Tool call processing success rate: ${toolSuccessRate.toFixed(1)}%`);\n    
    // 统计finish reason修复情况
    const finishReasonIssues = this.results.reduce((count, r) => {
      return count + r.findings.filter(f => f.includes('❌') && f.includes('stop_reason')).length;
    }, 0);
    findings.push(`Finish reason inconsistencies detected: ${finishReasonIssues}`);\n    
    // 统计文本格式工具调用处理
    const textToolIssues = this.results.reduce((count, r) => {
      return count + r.findings.filter(f => f.includes('unprocessed tool call patterns')).length;
    }, 0);
    findings.push(`Unprocessed text format tool calls: ${textToolIssues}`);\n    
    // 统计验证失败
    const validationIssues = this.results.reduce((count, r) => {
      return count + r.findings.filter(f => f.includes('❌')).length;
    }, 0);
    findings.push(`Total validation issues found: ${validationIssues}`);\n    
    return findings;
  }
}

// 主执行函数
async function main() {
  const tester = new FinishReasonPipelineTest();
  
  try {
    await tester.runComprehensiveTest();
    console.log('\\n🎉 Test execution completed successfully!');\n    process.exit(0);
  } catch (error) {
    console.error('\\n💥 Test execution failed:', error.message);\n    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { FinishReasonPipelineTest, TEST_CONFIG };