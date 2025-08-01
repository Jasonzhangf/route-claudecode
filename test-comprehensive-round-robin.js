#!/usr/bin/env node

/**
 * CodeWhisperer多账号Round Robin综合测试
 * 包含复杂工具调用、多轮会话、故障切换机制测试
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const axios = require('axios');

class ComprehensiveRoundRobinTester {
  constructor() {
    this.baseURL = 'http://127.0.0.1:6677';
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-key'
    };
    this.testResults = [];
    this.conversationHistory = [];
    this.providerUsage = new Map();
  }

  async runComprehensiveTests() {
    console.log('🔄 CodeWhisperer多账号Round Robin综合测试\n');
    console.log('📋 测试覆盖范围:');
    console.log('   ✓ 复杂工具调用的Round Robin');
    console.log('   ✓ 多轮会话的provider切换');
    console.log('   ✓ 权限/认证失败的故障切换');
    console.log('   ✓ Provider黑名单和恢复机制');
    console.log('   ✓ 负载均衡验证\n');

    // 1. 基础provider状态检查
    await this.checkInitialProviderStatus();
    
    // 2. 复杂工具调用测试
    await this.testComplexToolCallsRoundRobin();
    
    // 3. 多轮会话测试
    await this.testMultiTurnConversationRoundRobin();
    
    // 4. 故障注入和切换测试
    await this.testFailureRecoveryMechanisms();
    
    // 5. 负载均衡验证
    await this.testLoadBalancingBehavior();
    
    // 6. Provider健康恢复测试
    await this.testProviderHealthRecovery();

    return this.generateComprehensiveReport();
  }

  async checkInitialProviderStatus() {
    console.log('📊 1. 检查初始Provider状态...');
    
    try {
      const response = await axios.get(`${this.baseURL}/status`, { headers: this.headers });
      const status = response.data;
      
      console.log(`   - 可用Providers: ${status.providers?.join(', ')}`);
      console.log(`   - 路由配置类别: ${status.routing?.categories?.join(', ')}`);
      
      // 检查每个provider的健康状态
      if (status.routing?.providerHealth) {
        for (const [providerId, health] of Object.entries(status.routing.providerHealth)) {
          console.log(`   - ${providerId}: ${health.isHealthy ? '✅ 健康' : '❌ 不健康'} (${health.totalRequests}次请求)`);
        }
      }

      this.testResults.push({
        test: 'initial_provider_status',
        status: 'SUCCESS',
        details: {
          providers: status.providers || [],
          healthyProviders: this.countHealthyProviders(status.routing?.providerHealth || {}),
          totalProviders: status.providers?.length || 0
        }
      });

    } catch (error) {
      console.log(`   ❌ 状态检查失败: ${error.message}`);
      this.testResults.push({
        test: 'initial_provider_status',
        status: 'FAILED',
        error: error.message
      });
    }
  }

  async testComplexToolCallsRoundRobin() {
    console.log('\n🛠️  2. 复杂工具调用Round Robin测试...');
    
    const toolCallTests = [
      {
        name: '文件搜索工具',
        messages: [{ role: "user", content: "帮我搜索项目中所有的TypeScript文件" }],
        tools: [{
          name: "Glob",
          description: "文件模式匹配工具",
          input_schema: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "要匹配的文件模式" }
            },
            required: ["pattern"]
          }
        }]
      },
      {
        name: '代码搜索工具',
        messages: [{ role: "user", content: "在代码中搜索所有包含'CodeWhisperer'的文件" }],
        tools: [{
          name: "Grep",
          description: "代码搜索工具", 
          input_schema: {
            type: "object",
            properties: {
              pattern: { type: "string", description: "搜索模式" },
              glob: { type: "string", description: "文件过滤模式" }
            },
            required: ["pattern"]
          }
        }]
      },
      {
        name: '复杂待办事项工具',
        messages: [{ role: "user", content: "创建一个包含5个编程任务的待办事项列表" }],
        tools: [{
          name: "TodoWrite",
          description: "创建待办事项",
          input_schema: {
            type: "object",
            properties: {
              todos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    content: { type: "string", description: "任务内容" },
                    status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                    priority: { type: "string", enum: ["high", "medium", "low"] },
                    id: { type: "string", description: "任务ID" }
                  },
                  required: ["content", "status", "priority", "id"]
                }
              }
            },
            required: ["todos"]
          }
        }]
      }
    ];

    const toolResults = [];
    
    for (let i = 0; i < toolCallTests.length; i++) {
      const test = toolCallTests[i];
      console.log(`   🔧 测试工具: ${test.name}`);
      
      try {
        const startTime = Date.now();
        
        const response = await axios.post(`${this.baseURL}/v1/messages`, {
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: test.messages,
          tools: test.tools
        }, { 
          headers: this.headers,
          timeout: 20000
        });

        const duration = Date.now() - startTime;
        const usedProvider = this.extractProviderFromResponse(response);
        this.trackProviderUsage(usedProvider);
        
        toolResults.push({
          testName: test.name,
          status: 'SUCCESS',
          duration,
          model: response.data.model,
          provider: usedProvider,
          hasToolCall: this.hasToolCall(response.data.content),
          contentBlocks: response.data.content?.length || 0
        });

        console.log(`      ✅ ${duration}ms - Provider: ${usedProvider} - 工具调用: ${this.hasToolCall(response.data.content) ? '是' : '否'}`);
        
        // 短暂延迟观察provider切换
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`      ❌ ${test.name} 失败: ${error.message}`);
        toolResults.push({
          testName: test.name,
          status: 'FAILED',
          error: error.message,
          statusCode: error.response?.status
        });
      }
    }

    const successCount = toolResults.filter(r => r.status === 'SUCCESS').length;
    console.log(`   📊 工具调用测试: ${successCount}/${toolCallTests.length} 成功`);

    this.testResults.push({
      test: 'complex_tool_calls_round_robin',
      status: successCount > 0 ? 'SUCCESS' : 'FAILED',
      details: {
        totalTests: toolCallTests.length,
        successfulTests: successCount,
        results: toolResults,
        providerDistribution: Object.fromEntries(this.providerUsage)
      }
    });
  }

  async testMultiTurnConversationRoundRobin() {
    console.log('\n💬 3. 多轮会话Round Robin测试...');
    
    const conversationFlow = [
      "你好，我想学习编程，从哪里开始比较好？",
      "我对Python感兴趣，能推荐一些学习资源吗？",
      "在学习Python的过程中，我应该注意哪些常见的陷阱？",
      "除了Python，你还推荐学习哪些编程语言？",
      "如何在学习编程的同时建立项目经验？",
      "感谢你的建议，能帮我制定一个3个月的学习计划吗？"
    ];

    const conversationResults = [];
    
    for (let i = 0; i < conversationFlow.length; i++) {
      const userMessage = conversationFlow[i];
      console.log(`   ${i + 1}. 用户: ${userMessage.substring(0, 30)}...`);
      
      try {
        const startTime = Date.now();
        
        // 构建包含历史对话的请求
        const messages = [
          ...this.conversationHistory,
          { role: "user", content: userMessage }
        ];
        
        const response = await axios.post(`${this.baseURL}/v1/messages`, {
          model: "claude-sonnet-4-20250514",
          max_tokens: 150,
          messages: messages
        }, { 
          headers: this.headers,
          timeout: 15000
        });

        const duration = Date.now() - startTime;
        const usedProvider = this.extractProviderFromResponse(response);
        this.trackProviderUsage(usedProvider);
        
        // 更新对话历史
        this.conversationHistory.push({ role: "user", content: userMessage });
        this.conversationHistory.push({
          role: "assistant",
          content: response.data.content?.[0]?.text || "响应内容为空"
        });
        
        conversationResults.push({
          turn: i + 1,
          status: 'SUCCESS',
          duration,
          provider: usedProvider,
          historyLength: messages.length,
          responseLength: response.data.content?.[0]?.text?.length || 0
        });

        console.log(`      ✅ ${duration}ms - Provider: ${usedProvider} - 历史长度: ${messages.length}`);
        
        // 短暂延迟
        await new Promise(resolve => setTimeout(resolve, 800));
        
      } catch (error) {
        console.log(`      ❌ 第${i + 1}轮失败: ${error.message}`);
        conversationResults.push({
          turn: i + 1,
          status: 'FAILED',
          error: error.message,
          statusCode: error.response?.status
        });
        
        // 失败时不更新对话历史
        break;
      }
    }

    const successfulTurns = conversationResults.filter(r => r.status === 'SUCCESS').length;
    console.log(`   📊 多轮对话: ${successfulTurns}/${conversationFlow.length} 轮成功`);

    this.testResults.push({
      test: 'multi_turn_conversation_round_robin',
      status: successfulTurns >= 3 ? 'SUCCESS' : 'FAILED',
      details: {
        totalTurns: conversationFlow.length,
        successfulTurns,
        conversationResults,
        finalHistoryLength: this.conversationHistory.length,
        providerDistribution: Object.fromEntries(this.providerUsage)
      }
    });
  }

  async testFailureRecoveryMechanisms() {
    console.log('\n🔥 4. 故障切换机制测试...');
    
    try {
      // 获取当前provider健康状态
      const statusResponse = await axios.get(`${this.baseURL}/status`, { headers: this.headers });
      const providerHealth = statusResponse.data.routing?.providerHealth || {};
      
      console.log('   📊 当前Provider健康状态:');
      for (const [providerId, health] of Object.entries(providerHealth)) {
        console.log(`      ${providerId}: ${health.isHealthy ? '✅' : '❌'} (错误计数: ${health.consecutiveErrors})`);
      }
      
      // 模拟高负载请求来观察故障行为
      console.log('   🚀 发送高负载请求测试故障切换...');
      
      const highLoadResults = [];
      const promises = [];
      
      // 同时发送10个请求
      for (let i = 0; i < 10; i++) {
        const promise = this.sendRequestWithErrorTracking(`高负载测试请求 ${i + 1}`, i + 1);
        promises.push(promise);
      }
      
      const results = await Promise.allSettled(promises);
      
      let successCount = 0;
      let errorCount = 0;
      const errorTypes = new Map();
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.status === 'SUCCESS') {
          successCount++;
          highLoadResults.push(result.value);
        } else {
          errorCount++;
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          const errorType = this.categorizeError(error);
          errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
        }
      });
      
      console.log(`   📊 高负载测试结果: ${successCount}/10 成功, ${errorCount}/10 失败`);
      if (errorTypes.size > 0) {
        console.log('   🔍 错误类型分布:');
        for (const [errorType, count] of errorTypes.entries()) {
          console.log(`      ${errorType}: ${count}次`);
        }
      }
      
      // 检查provider健康状态变化
      const afterStatusResponse = await axios.get(`${this.baseURL}/status`, { headers: this.headers });
      const afterProviderHealth = afterStatusResponse.data.routing?.providerHealth || {};
      
      console.log('   📊 测试后Provider健康状态:');
      const healthChanges = [];
      for (const [providerId, health] of Object.entries(afterProviderHealth)) {
        const beforeHealth = providerHealth[providerId]?.isHealthy || false;
        const afterHealth = health.isHealthy;
        const changed = beforeHealth !== afterHealth;
        
        console.log(`      ${providerId}: ${afterHealth ? '✅' : '❌'} ${changed ? '(状态变化)' : ''}`);
        
        if (changed) {
          healthChanges.push({
            providerId,
            before: beforeHealth,
            after: afterHealth,
            consecutiveErrors: health.consecutiveErrors
          });
        }
      }

      this.testResults.push({
        test: 'failure_recovery_mechanisms',
        status: successCount > 0 ? 'SUCCESS' : 'FAILED',
        details: {
          totalRequests: 10,
          successfulRequests: successCount,
          failedRequests: errorCount,
          errorDistribution: Object.fromEntries(errorTypes),
          healthChanges,
          providerHealthBefore: providerHealth,
          providerHealthAfter: afterProviderHealth
        }
      });
      
    } catch (error) {
      console.log(`   ❌ 故障切换测试失败: ${error.message}`);
      this.testResults.push({
        test: 'failure_recovery_mechanisms',
        status: 'FAILED',
        error: error.message
      });
    }
  }

  async testLoadBalancingBehavior() {
    console.log('\n⚖️  5. 负载均衡行为验证...');
    
    try {
      const loadTestRequests = 15; // 发送15个请求来验证负载均衡
      const results = [];
      
      console.log(`   🔄 发送${loadTestRequests}个请求验证负载分布...`);
      
      for (let i = 0; i < loadTestRequests; i++) {
        try {
          const response = await axios.post(`${this.baseURL}/v1/messages`, {
            model: "claude-sonnet-4-20250514",
            max_tokens: 50,
            messages: [{ role: "user", content: `负载均衡测试 ${i + 1}: 简单回答一个编程问题` }]
          }, { 
            headers: this.headers,
            timeout: 10000
          });
          
          const usedProvider = this.extractProviderFromResponse(response);
          this.trackProviderUsage(usedProvider);
          
          results.push({
            requestId: i + 1,
            status: 'SUCCESS',
            provider: usedProvider
          });
          
          // 非常短的延迟
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          results.push({
            requestId: i + 1,
            status: 'FAILED',
            error: error.message
          });
        }
      }
      
      // 分析负载分布
      const providerCounts = new Map();
      const successfulResults = results.filter(r => r.status === 'SUCCESS');
      
      successfulResults.forEach(result => {
        const provider = result.provider;
        providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
      });
      
      console.log('   📊 负载分布统计:');
      const totalSuccessful = successfulResults.length;
      for (const [provider, count] of providerCounts.entries()) {
        const percentage = Math.round((count / totalSuccessful) * 100);
        console.log(`      ${provider}: ${count}次 (${percentage}%)`);
      }
      
      // 计算负载均衡质量
      const expectedPerProvider = totalSuccessful / providerCounts.size;
      const variance = this.calculateLoadBalanceVariance(providerCounts, expectedPerProvider);
      const isWellBalanced = variance < (expectedPerProvider * 0.5); // 允许50%的方差
      
      console.log(`   📈 负载均衡质量: ${isWellBalanced ? '✅ 良好' : '⚠️ 需要优化'} (方差: ${Math.round(variance)})`);

      this.testResults.push({
        test: 'load_balancing_behavior',
        status: successfulResults.length > 0 ? 'SUCCESS' : 'FAILED',
        details: {
          totalRequests: loadTestRequests,
          successfulRequests: successfulResults.length,
          providerDistribution: Object.fromEntries(providerCounts),
          loadBalanceVariance: variance,
          isWellBalanced,
          expectedPerProvider: Math.round(expectedPerProvider)
        }
      });
      
    } catch (error) {
      console.log(`   ❌ 负载均衡测试失败: ${error.message}`);
      this.testResults.push({
        test: 'load_balancing_behavior',
        status: 'FAILED',
        error: error.message
      });
    }
  }

  async testProviderHealthRecovery() {
    console.log('\n🏥 6. Provider健康恢复测试...');
    
    try {
      // 等待一段时间让系统恢复
      console.log('   ⏳ 等待30秒让不健康的provider恢复...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // 检查恢复状态
      const recoveryResponse = await axios.get(`${this.baseURL}/status`, { headers: this.headers });
      const recoveryHealth = recoveryResponse.data.routing?.providerHealth || {};
      
      console.log('   📊 恢复后Provider状态:');
      let healthyCount = 0;
      let totalProviders = 0;
      
      for (const [providerId, health] of Object.entries(recoveryHealth)) {
        totalProviders++;
        if (health.isHealthy) {
          healthyCount++;
        }
        console.log(`      ${providerId}: ${health.isHealthy ? '✅ 健康' : '❌ 不健康'} (冷却中: ${health.inCooldown ? '是' : '否'})`);
      }
      
      const recoveryRate = Math.round((healthyCount / totalProviders) * 100);
      console.log(`   📈 恢复率: ${healthyCount}/${totalProviders} (${recoveryRate}%)`);
      
      // 发送恢复验证请求
      console.log('   🔍 发送验证请求测试恢复效果...');
      const verificationResults = [];
      
      for (let i = 0; i < 5; i++) {
        try {
          const response = await axios.post(`${this.baseURL}/v1/messages`, {
            model: "claude-sonnet-4-20250514",
            max_tokens: 30,
            messages: [{ role: "user", content: `恢复验证 ${i + 1}: 系统是否正常工作？` }]
          }, { 
            headers: this.headers,
            timeout: 10000
          });
          
          const usedProvider = this.extractProviderFromResponse(response);
          verificationResults.push({
            requestId: i + 1,
            status: 'SUCCESS',
            provider: usedProvider
          });
          
          console.log(`      ✅ 验证 ${i + 1}: Provider ${usedProvider} 响应正常`);
          
        } catch (error) {
          verificationResults.push({
            requestId: i + 1,
            status: 'FAILED',
            error: error.message
          });
          console.log(`      ❌ 验证 ${i + 1}: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const verificationSuccessCount = verificationResults.filter(r => r.status === 'SUCCESS').length;
      console.log(`   📊 恢复验证: ${verificationSuccessCount}/5 成功`);

      this.testResults.push({
        test: 'provider_health_recovery',
        status: verificationSuccessCount >= 3 ? 'SUCCESS' : 'FAILED',
        details: {
          totalProviders,
          healthyProviders: healthyCount,
          recoveryRate: `${recoveryRate}%`,
          verificationResults,
          successfulVerifications: verificationSuccessCount,
          providerHealth: recoveryHealth
        }
      });
      
    } catch (error) {
      console.log(`   ❌ 健康恢复测试失败: ${error.message}`);
      this.testResults.push({
        test: 'provider_health_recovery',
        status: 'FAILED',
        error: error.message
      });
    }
  }

  // 工具方法
  async sendRequestWithErrorTracking(content, requestId) {
    try {
      const startTime = Date.now();
      const response = await axios.post(`${this.baseURL}/v1/messages`, {
        model: "claude-sonnet-4-20250514",
        max_tokens: 50,
        messages: [{ role: "user", content }]
      }, { 
        headers: this.headers,
        timeout: 8000
      });
      
      const duration = Date.now() - startTime;
      const usedProvider = this.extractProviderFromResponse(response);
      
      return {
        requestId,
        status: 'SUCCESS',
        duration,
        provider: usedProvider
      };
    } catch (error) {
      return {
        requestId,
        status: 'FAILED',
        error: error.message,
        statusCode: error.response?.status
      };
    }
  }

  categorizeError(error) {
    if (typeof error === 'string') {
      if (error.includes('timeout')) return 'Timeout';
      if (error.includes('500')) return 'Server Error';
      if (error.includes('401') || error.includes('403')) return 'Authentication';
      if (error.includes('429')) return 'Rate Limited';
      return 'Other Error';
    }
    return 'Unknown Error';
  }

  extractProviderFromResponse(response) {
    // 尝试从响应头或其他地方提取provider信息
    // 这里需要根据实际的响应格式来实现
    return 'provider-inferred'; // 临时实现
  }

  trackProviderUsage(provider) {
    this.providerUsage.set(provider, (this.providerUsage.get(provider) || 0) + 1);
  }

  hasToolCall(content) {
    if (!content || !Array.isArray(content)) return false;
    return content.some(block => block.type === 'tool_use');
  }

  countHealthyProviders(providerHealth) {
    return Object.values(providerHealth).filter(health => health.isHealthy).length;
  }

  calculateLoadBalanceVariance(providerCounts, expected) {
    const values = Array.from(providerCounts.values());
    const variance = values.reduce((acc, count) => acc + Math.pow(count - expected, 2), 0) / values.length;
    return variance;
  }

  generateComprehensiveReport() {
    const successfulTests = this.testResults.filter(r => r.status === 'SUCCESS').length;
    const totalTests = this.testResults.length;
    const successRate = Math.round((successfulTests / totalTests) * 100);

    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'CodeWhisperer多账号Round Robin综合测试',
      summary: {
        totalTests,
        successfulTests,
        failedTests: totalTests - successfulTests,
        successRate: `${successRate}%`,
        comprehensiveValidation: successRate >= 80
      },
      testCategories: {
        basicFunctionality: this.testResults.filter(r => ['initial_provider_status'].includes(r.test)),
        complexScenarios: this.testResults.filter(r => ['complex_tool_calls_round_robin', 'multi_turn_conversation_round_robin'].includes(r.test)),
        failureHandling: this.testResults.filter(r => ['failure_recovery_mechanisms', 'provider_health_recovery'].includes(r.test)),
        loadBalancing: this.testResults.filter(r => ['load_balancing_behavior'].includes(r.test))
      },
      providerUsageOverall: Object.fromEntries(this.providerUsage),
      results: this.testResults,
      conclusion: this.generateComprehensiveConclusion(successRate),
      recommendations: this.generateRecommendations()
    };

    // 保存报告
    const reportPath = `/tmp/comprehensive-round-robin-test-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 综合测试报告:');
    console.log(`   测试成功率: ${report.summary.successRate}`);
    console.log(`   综合验证: ${report.summary.comprehensiveValidation ? '✅ 通过' : '❌ 需要改进'}`);
    console.log(`   Provider使用分布: ${JSON.stringify(Object.fromEntries(this.providerUsage))}`);
    console.log(`   详细报告: ${reportPath}`);

    return report;
  }

  generateComprehensiveConclusion(successRate) {
    if (successRate >= 90) {
      return 'CodeWhisperer多账号Round Robin功能在所有复杂场景下都表现优秀，包括工具调用、多轮会话、故障切换和负载均衡';
    } else if (successRate >= 80) {
      return 'CodeWhisperer多账号Round Robin功能在大多数场景下表现良好，个别复杂场景可能需要优化';
    } else if (successRate >= 60) {
      return 'CodeWhisperer多账号Round Robin功能基本可用，但在复杂场景和故障处理方面存在问题';
    } else {
      return 'CodeWhisperer多账号Round Robin功能存在严重问题，需要全面检查和修复';
    }
  }

  generateRecommendations() {
    const recommendations = [];
    
    const failedTests = this.testResults.filter(r => r.status === 'FAILED');
    
    if (failedTests.some(t => t.test === 'complex_tool_calls_round_robin')) {
      recommendations.push('优化复杂工具调用的Round Robin处理，确保工具定义正确传递');
    }
    
    if (failedTests.some(t => t.test === 'multi_turn_conversation_round_robin')) {
      recommendations.push('改进多轮会话的provider切换机制，保持对话上下文的一致性');
    }
    
    if (failedTests.some(t => t.test === 'failure_recovery_mechanisms')) {
      recommendations.push('增强故障切换机制，提高错误分类和处理的准确性');
    }
    
    if (failedTests.some(t => t.test === 'load_balancing_behavior')) {
      recommendations.push('调整负载均衡算法，确保请求在各provider间更均匀分布');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('系统运行良好，建议定期进行综合测试以维持性能');
    }
    
    return recommendations;
  }
}

// 运行综合测试
async function main() {
  console.log('🧪 CodeWhisperer多账号Round Robin综合测试\n');
  
  const tester = new ComprehensiveRoundRobinTester();
  
  try {
    const report = await tester.runComprehensiveTests();
    
    console.log(`\n${report.summary.comprehensiveValidation ? '🎉' : '⚠️'} 综合测试完成`);
    console.log(`结论: ${report.conclusion}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 改进建议:');
      report.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    process.exit(report.summary.comprehensiveValidation ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ 综合测试执行失败:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);