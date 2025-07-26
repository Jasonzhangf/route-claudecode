#!/usr/bin/env node
/**
 * CodeWhisperer路由测试脚本
 * 验证路由配置和模型映射的正确性
 * 
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

// 路由测试配置
const ROUTING_TEST_CONFIG = {
  server: 'http://127.0.0.1:3456',
  
  // 基于当前配置的模型映射规则
  modelMappings: {
    // Haiku -> Background processing (轻量级任务)
    'claude-3-5-haiku-20241022': {
      expectedCategory: 'background',
      expectedProvider: 'shuaihong-openai', // 当前配置中background走shuaihong
      expectedTargetModel: 'gemini-2.5-flash'
    },
    
    // Sonnet -> Default processing (通用任务)
    'claude-3-5-sonnet-20241022': {
      expectedCategory: 'default',
      expectedProvider: 'codewhisperer-primary', // 默认走CodeWhisperer
      expectedTargetModel: 'CLAUDE_SONNET_4_20250514_V1_0'
    },
    
    // 如果强制路由到CodeWhisperer的测试
    'claude-sonnet-4-20250514': {
      expectedCategory: 'default',
      expectedProvider: 'codewhisperer-primary',
      expectedTargetModel: 'CLAUDE_SONNET_4_20250514_V1_0'
    }
  },
  
  // 路由测试用例
  routingTests: [
    {
      name: 'simple-background-task',
      description: '简单后台任务路由测试',
      input: {
        model: 'claude-3-5-haiku-20241022',
        messages: [{ role: 'user', content: 'Hello' }]
      },
      expectsProvider: 'shuaihong-openai'
    },
    
    {
      name: 'code-generation-task', 
      description: '代码生成任务路由测试',
      input: {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Write a function to sort an array' }]
      },
      expectsProvider: 'codewhisperer-primary'
    },
    
    {
      name: 'thinking-intensive-task',
      description: '思维密集型任务路由测试',
      input: {
        model: 'claude-3-opus-20240229',
        messages: [
          { 
            role: 'user', 
            content: 'Explain the philosophical implications of artificial intelligence consciousness' 
          }
        ]
      },
      expectsProvider: 'shuaihong-openai' // thinking任务当前走shuaihong
    },
    
    {
      name: 'long-context-task',
      description: '长上下文任务路由测试',
      input: {
        model: 'claude-3-5-sonnet-20241022',
        messages: Array(20).fill(null).map((_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}: This is a long conversation to test routing`
        }))
      },
      expectsProvider: 'codewhisperer-primary' // 长上下文应该走CodeWhisperer
    }
  ]
};

class CodeWhispererRoutingTester {
  constructor() {
    this.httpClient = axios.create({
      baseURL: ROUTING_TEST_CONFIG.server,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test-key'
      }
    });
    
    this.routingResults = [];
  }

  /**
   * 运行路由测试套件
   */
  async runRoutingTests() {
    console.log('🛣️  CodeWhisperer路由测试套件');
    console.log('======================================');
    console.log('');
    
    // 1. 获取当前路由配置
    console.log('📋 Step 1: 获取当前路由配置');
    const routingConfig = await this.getCurrentRoutingConfig();
    console.log('✅ 当前路由配置:', JSON.stringify(routingConfig, null, 2));
    console.log('');
    
    // 2. 验证模型映射
    console.log('📋 Step 2: 验证模型映射规则');
    await this.validateModelMappings();
    console.log('');
    
    // 3. 执行路由测试
    console.log('📋 Step 3: 执行路由测试用例');
    for (const test of ROUTING_TEST_CONFIG.routingTests) {
      console.log(`\n🔍 测试: ${test.name}`);
      console.log(`📝 描述: ${test.description}`);
      
      const result = await this.executeRoutingTest(test);
      this.routingResults.push(result);
      
      console.log(`📊 结果: ${result.success ? '✅ 通过' : '❌ 失败'}`);
      if (!result.success) {
        console.log(`❗ 预期provider: ${test.expectsProvider}`);
        console.log(`❗ 实际provider: ${result.actualProvider}`);
        console.log(`❗ 错误: ${result.error}`);
      }
    }
    
    // 4. 生成路由测试报告
    console.log('\n📋 Step 4: 生成路由测试报告');
    const report = this.generateRoutingReport();
    this.saveRoutingReport(report);
    
    console.log(`\n📊 路由测试摘要:`);
    console.log(`✅ 通过: ${report.summary.passed}/${report.summary.total}`);
    console.log(`❌ 失败: ${report.summary.failed}/${report.summary.total}`);
    console.log(`📈 成功率: ${report.summary.successRate}%`);
    
    return report.summary.successRate >= 80;
  }

  /**
   * 获取当前路由配置
   */
  async getCurrentRoutingConfig() {
    try {
      const response = await this.httpClient.get('/status');
      return {
        providers: response.data.providers || [],
        uptime: response.data.uptime,
        version: response.data.server
      };
    } catch (error) {
      console.error('❌ 无法获取路由配置:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 验证模型映射规则
   */
  async validateModelMappings() {
    for (const [model, mapping] of Object.entries(ROUTING_TEST_CONFIG.modelMappings)) {
      console.log(`🔍 验证模型: ${model}`);
      console.log(`   期望类别: ${mapping.expectedCategory}`);
      console.log(`   期望provider: ${mapping.expectedProvider}`);
      console.log(`   期望目标模型: ${mapping.expectedTargetModel}`);
      
      // 这里可以添加更详细的映射验证逻辑
      // 目前通过实际API调用来验证
    }
  }

  /**
   * 执行单个路由测试
   */
  async executeRoutingTest(test) {
    const startTime = Date.now();
    
    try {
      // 发送请求并捕获路由信息
      const response = await this.httpClient.post('/v1/messages', {
        ...test.input,
        max_tokens: 50,
        stream: false
      });
      
      const duration = Date.now() - startTime;
      
      // 分析响应以推断使用的provider
      const actualProvider = this.inferProviderFromResponse(response);
      
      return {
        name: test.name,
        success: actualProvider === test.expectsProvider,
        expectedProvider: test.expectsProvider,
        actualProvider,
        duration,
        responseData: {
          status: response.status,
          model: response.data.model,
          id: response.data.id,
          contentLength: JSON.stringify(response.data.content).length,
          hasContent: !!(response.data.content && response.data.content.length > 0),
          usage: response.data.usage
        }
      };
    } catch (error) {
      return {
        name: test.name,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 从响应推断使用的provider
   */
  inferProviderFromResponse(response) {
    const data = response.data;
    
    // 基于响应特征推断provider
    if (data.model) {
      // CodeWhisperer模型特征
      if (data.model.includes('CLAUDE_') || data.model.includes('V1_0')) {
        return 'codewhisperer-primary';
      }
      
      // OpenAI格式模型特征 (shuaihong)
      if (data.model.includes('gpt-') || data.model.includes('gemini-')) {
        return 'shuaihong-openai';
      }
    }
    
    // 基于ID格式推断
    if (data.id) {
      if (data.id.startsWith('chatcmpl-')) {
        return 'shuaihong-openai';
      } else if (data.id.startsWith('msg_')) {
        return 'codewhisperer-primary';
      }
    }
    
    // 基于响应结构推断
    if (data.usage && data.usage.input_tokens !== undefined) {
      // 这通常是Anthropic格式，可能来自CodeWhisperer
      return 'codewhisperer-primary';
    }
    
    return 'unknown';
  }

  /**
   * 生成路由测试报告
   */
  generateRoutingReport() {
    const passed = this.routingResults.filter(r => r.success).length;
    const failed = this.routingResults.length - passed;
    const total = this.routingResults.length;
    const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    return {
      timestamp: new Date().toISOString(),
      testType: 'CodeWhisperer路由测试',
      summary: {
        total,
        passed,
        failed,
        successRate
      },
      routingResults: this.routingResults,
      configuration: ROUTING_TEST_CONFIG,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * 生成改进建议
   */
  generateRecommendations() {
    const recommendations = [];
    
    const failedTests = this.routingResults.filter(r => !r.success);
    
    if (failedTests.length > 0) {
      recommendations.push({
        type: 'routing-mismatch',
        description: '路由不匹配问题',
        details: failedTests.map(t => ({
          test: t.name,
          expected: t.expectedProvider,
          actual: t.actualProvider
        })),
        suggestion: '检查路由规则配置，确保模型映射正确'
      });
    }
    
    // 分析响应时间
    const avgDuration = this.routingResults.reduce((sum, r) => sum + (r.duration || 0), 0) / this.routingResults.length;
    if (avgDuration > 5000) {
      recommendations.push({
        type: 'performance',
        description: '响应时间较长',
        avgDuration: `${avgDuration}ms`,
        suggestion: '考虑优化路由性能或增加超时设置'
      });
    }
    
    return recommendations;
  }

  /**
   * 保存路由测试报告
   */
  saveRoutingReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `codewhisperer-routing-report-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`📄 路由测试报告已保存: ${filename}`);
  }
}

// 主函数
async function main() {
  const tester = new CodeWhispererRoutingTester();
  
  try {
    const success = await tester.runRoutingTests();
    console.log('\n🎯 路由测试完成!');
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 路由测试失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { CodeWhispererRoutingTester, ROUTING_TEST_CONFIG };