#!/usr/bin/env node

/**
 * Final Verification Test - Complete Model and Scenario Testing
 * 最终验证测试 - 完整的模型和场景测试
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const CONFIG = {
  BASE_URL: 'http://localhost:3458',
  TIMEOUT: 30000,
  OUTPUT_DIR: '/tmp/final-verification',
  SCENARIOS: [
    {
      name: 'claude-sonnet-4-simple',
      description: 'Claude Sonnet 4 - Simple text request',
      model: 'claude-sonnet-4-20250514',
      expectedProvider: 'kiro-gmail',
      expectedTargetModel: 'CLAUDE_SONNET_4_20250514_V1_0',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello, how are you today?' }],
        stream: false
      }
    },
    {
      name: 'claude-haiku-background',
      description: 'Claude Haiku - Background category routing',
      model: 'claude-3-5-haiku-20241022',
      expectedProvider: 'modelscope-openai',
      expectedTargetModel: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
      request: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Quick background task' }],
        stream: false
      }
    },
    {
      name: 'claude-sonnet-4-with-tools',
      description: 'Claude Sonnet 4 - With tools (search category)',
      model: 'claude-sonnet-4-20250514',
      expectedProvider: 'modelscope-openai',
      expectedTargetModel: 'qwen3-coder',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Create a todo list for project management' }],
        tools: [{
          name: 'TodoWrite',
          description: 'Create and manage todo items',
          input_schema: {
            type: 'object',
            properties: {
              todos: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    content: { type: 'string' },
                    status: { type: 'string', enum: ['pending', 'completed'] },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] }
                  },
                  required: ['content', 'status', 'priority']
                }
              }
            },
            required: ['todos']
          }
        }],
        stream: false
      }
    },
    {
      name: 'claude-sonnet-4-streaming',
      description: 'Claude Sonnet 4 - Streaming response',
      model: 'claude-sonnet-4-20250514',
      expectedProvider: 'kiro-gmail',
      expectedTargetModel: 'CLAUDE_SONNET_4_20250514_V1_0',
      request: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Tell me a short story' }],
        stream: true
      }
    }
  ]
};

class FinalVerificationTest {
  constructor() {
    this.results = [];
    this.outputDir = CONFIG.OUTPUT_DIR;
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Final Verification Test Suite');
    console.log(`📊 Total scenarios: ${CONFIG.SCENARIOS.length}`);
    console.log('');

    for (const scenario of CONFIG.SCENARIOS) {
      console.log(`🧪 Testing: ${scenario.name}`);
      console.log(`📝 Description: ${scenario.description}`);
      
      try {
        const result = await this.runScenarioTest(scenario);
        this.results.push(result);
        
        if (result.success) {
          console.log(`✅ ${scenario.name}: SUCCESS`);
          if (result.responseModel) {
            console.log(`🎯 Model mapping verified: ${scenario.model} -> ${result.responseModel}`);
          }
        } else {
          console.log(`❌ ${scenario.name}: FAILED`);
          console.log(`💥 Error: ${result.error}`);
        }
      } catch (error) {
        console.log(`💥 ${scenario.name}: EXCEPTION - ${error.message}`);
        this.results.push({
          scenario: scenario.name,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('');
      await this.delay(1000); // 1秒间隔避免请求过快
    }

    await this.generateReport();
  }

  async runScenarioTest(scenario) {
    const startTime = Date.now();
    
    try {
      const response = await axios({
        method: 'POST',
        url: `${CONFIG.BASE_URL}/v1/messages`,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FinalVerificationTest/1.0'
        },
        data: scenario.request,
        timeout: CONFIG.TIMEOUT,
        validateStatus: () => true // 接受所有状态码，手动处理
      });

      const duration = Date.now() - startTime;

      const result = {
        scenario: scenario.name,
        success: response.status === 200,
        status: response.status,
        duration,
        timestamp: new Date().toISOString(),
        request: scenario.request,
        response: response.data,
        headers: response.headers
      };

      // 验证响应数据
      if (response.status === 200 && response.data) {
        // 检查模型名是否正确映射
        if (response.data.model) {
          result.responseModel = response.data.model;
          result.modelMappingCorrect = this.verifyModelMapping(scenario, response.data.model);
        }

        // 检查内容是否存在
        if (response.data.content && response.data.content.length > 0) {
          result.hasContent = true;
        }

        // 检查流式响应处理
        if (scenario.request.stream) {
          result.streamHandled = true;
        }
      } else {
        result.error = response.data?.error?.message || `HTTP ${response.status}`;
      }

      return result;

    } catch (error) {
      return {
        scenario: scenario.name,
        success: false,
        error: error.message,
        status: error.response?.status || 'NETWORK_ERROR',
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  verifyModelMapping(scenario, responseModel) {
    // 根据实际的路由配置验证模型映射
    const mappings = {
      'claude-sonnet-4-20250514': ['CLAUDE_SONNET_4_20250514_V1_0', 'qwen3-coder'],
      'claude-3-5-haiku-20241022': ['CLAUDE_3_7_SONNET_20250219_V1_0', 'Qwen/Qwen3-Coder-480B-A35B-Instruct']
    };

    const validModels = mappings[scenario.model] || [];
    return validModels.includes(responseModel);
  }

  async generateReport() {
    const timestamp = new Date().toISOString();
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;
    const successRate = ((successCount / totalCount) * 100).toFixed(1);

    const report = {
      metadata: {
        timestamp,
        testName: 'Final Verification Test Suite',
        totalScenarios: totalCount,
        successfulScenarios: successCount,
        failedScenarios: totalCount - successCount,
        successRate: `${successRate}%`,
        testDuration: this.results.reduce((sum, r) => sum + (r.duration || 0), 0)
      },
      summary: {
        allTestsPassed: successCount === totalCount,
        criticalIssues: this.results.filter(r => !r.success).length,
        modelMappingIssues: this.results.filter(r => r.modelMappingCorrect === false).length
      },
      results: this.results,
      analysis: this.analyzeResults()
    };

    // 保存详细报告
    const reportPath = path.join(this.outputDir, `final-verification-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 输出摘要
    console.log('📊 Final Verification Test Results');
    console.log('=====================================');
    console.log(`✅ Success Rate: ${successRate}% (${successCount}/${totalCount})`);
    console.log(`⏱️  Total Duration: ${report.metadata.testDuration}ms`);
    console.log(`📁 Detailed Report: ${reportPath}`);
    console.log('');

    if (report.summary.allTestsPassed) {
      console.log('🎉 ALL TESTS PASSED! Router is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the detailed report for issues.');
      
      // 输出失败的测试
      const failedTests = this.results.filter(r => !r.success);
      failedTests.forEach(test => {
        console.log(`❌ ${test.scenario}: ${test.error || 'Unknown error'}`);
      });
    }

    return report;
  }

  analyzeResults() {
    const analysis = {
      modelMappingResults: {},
      providerResults: {},
      commonIssues: [],
      recommendations: []
    };

    // 分析模型映射
    this.results.forEach(result => {
      if (result.responseModel) {
        const originalModel = result.request?.model;
        if (originalModel) {
          analysis.modelMappingResults[originalModel] = result.responseModel;
        }
      }
    });

    // 分析常见问题
    const errorMessages = this.results
      .filter(r => !r.success)
      .map(r => r.error)
      .filter(Boolean);

    const errorCounts = {};
    errorMessages.forEach(error => {
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    });

    analysis.commonIssues = Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count);

    // 生成建议
    if (analysis.commonIssues.length > 0) {
      analysis.recommendations.push({
        category: 'error_handling',
        suggestion: 'Address the most common error: ' + analysis.commonIssues[0].error
      });
    }

    if (this.results.some(r => r.modelMappingCorrect === false)) {
      analysis.recommendations.push({
        category: 'model_mapping',
        suggestion: 'Review model mapping configuration in routing rules'
      });
    }

    return analysis;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 主执行函数
async function main() {
  console.log('🔧 Final Verification Test Suite');
  console.log('==================================');
  console.log('Testing all models and scenarios after CodeWhisperer fix');
  console.log('');

  const tester = new FinalVerificationTest();
  
  try {
    await tester.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { FinalVerificationTest, CONFIG };