#!/usr/bin/env node

/**
 * Delivery Test: Multi-turn Conversation Scenario Coverage
 * 测试所有Provider的多轮对话和会话状态管理能力
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 多轮对话测试场景
const CONVERSATION_SCENARIOS = [
  {
    name: 'basic-multi-turn',
    description: '基础3轮对话测试',
    turns: [
      {
        role: 'user',
        content: '你好，我想了解Claude Code Router项目的基本概念'
      },
      {
        role: 'user', 
        content: '那它支持哪些AI提供商呢？'
      },
      {
        role: 'user',
        content: '请详细解释一下路由机制是如何工作的'
      }
    ]
  },
  {
    name: 'context-dependent-conversation',
    description: '上下文依赖对话测试',
    turns: [
      {
        role: 'user',
        content: '请帮我设计一个简单的Web API，用于用户管理'
      },
      {
        role: 'user',
        content: '在刚才的设计基础上，添加用户认证功能'
      },
      {
        role: 'user',
        content: '现在加上权限控制，区分管理员和普通用户'
      },
      {
        role: 'user',
        content: '最后，为这个系统添加日志记录功能'
      }
    ]
  },
  {
    name: 'complex-reasoning-chain',
    description: '复杂推理链对话测试',
    turns: [
      {
        role: 'user',
        content: '我有一个技术架构问题：如何设计一个支持多AI提供商的路由系统？'
      },
      {
        role: 'user',
        content: '考虑到刚才提到的设计，如何处理不同提供商的API格式差异？'
      },
      {
        role: 'user',
        content: '在格式转换的基础上，如何确保工具调用在不同提供商间正确工作？'
      },
      {
        role: 'user',
        content: '最后，如何实现负载均衡和故障切换来保证系统的高可用性？'
      },
      {
        role: 'user',
        content: '能否总结一下完整的架构设计要点？'
      }
    ]
  }
];

// Provider配置
const PROVIDERS = [
  { name: 'codewhisperer', port: 3458, config: 'config-codewhisperer-only.json' },
  { name: 'openai', port: 3459, config: 'config-openai-only.json' },
  { name: 'gemini', port: 3460, config: 'config-gemini-only.json' },
  { name: 'anthropic', port: 3461, config: 'config-anthropic-only.json' }
];

class MultiTurnDeliveryTester {
  constructor() {
    this.results = [];
    this.outputDir = path.join(process.env.HOME, '.route-claude-code/database/delivery-testing/scenarios/multi-turn');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async testConversationScenario(provider, scenario) {
    console.log(`\\n🗣️  Testing ${provider.name} - ${scenario.name}`);
    const sessionId = `delivery-multi-turn-${Date.now()}`;
    const conversationHistory = [];
    const turnResults = [];
    
    let totalDuration = 0;
    let conversationFailed = false;

    try {
      // 逐轮进行对话
      for (let i = 0; i < scenario.turns.length; i++) {
        const turn = scenario.turns[i];
        const turnStartTime = Date.now();
        
        console.log(`   🔄 Turn ${i + 1}/${scenario.turns.length}: "${turn.content.substring(0, 50)}..."`);
        
        // 构建包含历史的消息数组
        const messages = [...conversationHistory, turn];
        
        const request = {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          messages: messages
        };

        try {
          const response = await axios.post(`http://localhost:${provider.port}/v1/messages`, request, {
            headers: {
              'Content-Type': 'application/json',
              'X-Test-Session': sessionId,
              'X-Conversation-Turn': i + 1
            },
            timeout: 30000
          });

          const turnDuration = Date.now() - turnStartTime;
          totalDuration += turnDuration;

          const turnResult = this.analyzeTurnResponse(response.data, turn, i + 1, turnDuration);
          turnResults.push(turnResult);

          // 将用户消息和助手回复加入对话历史
          conversationHistory.push(turn);
          if (response.data.content && response.data.content.length > 0) {
            const assistantContent = response.data.content
              .filter(block => block.type === 'text')
              .map(block => block.text)
              .join('\\n');
              
            conversationHistory.push({
              role: 'assistant',
              content: assistantContent
            });
          }

          console.log(`      ✅ Turn ${i + 1} completed in ${turnDuration}ms`);

          // 轮次间延迟，模拟真实对话
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          const turnDuration = Date.now() - turnStartTime;
          totalDuration += turnDuration;
          
          const turnResult = {
            turn: i + 1,
            status: 'FAILED',
            duration: turnDuration,
            error: {
              message: error.message,
              code: error.response?.status || 'NETWORK_ERROR',
              details: error.response?.data || error.toString()
            },
            contextLength: messages.length,
            responseQuality: 0
          };
          
          turnResults.push(turnResult);
          conversationFailed = true;
          console.log(`      ❌ Turn ${i + 1} failed: ${error.message}`);
          break;
        }
      }

      // 生成整体对话结果
      const conversationResult = this.analyzeConversationResult(
        provider, scenario, turnResults, totalDuration, conversationHistory, conversationFailed
      );

      // 保存对话数据
      this.saveConversationData(provider.name, scenario.name, {
        scenario: scenario,
        conversationHistory: conversationHistory,
        turnResults: turnResults,
        overallResult: conversationResult
      });

      console.log(`   📊 Conversation ${conversationResult.status}: ${conversationResult.summary}`);
      return conversationResult;

    } catch (error) {
      const result = {
        provider: provider.name,
        scenario: scenario.name,
        status: 'FAILED',
        duration: totalDuration,
        error: {
          message: error.message,
          details: error.toString()
        },
        summary: `Conversation setup failed: ${error.message}`,
        completedTurns: 0,
        totalTurns: scenario.turns.length,
        contextPreservation: 0,
        responseQuality: 0
      };

      console.log(`   ❌ FAILED - ${error.message}`);
      return result;
    }
  }

  analyzeTurnResponse(response, turn, turnNumber, duration) {
    const result = {
      turn: turnNumber,
      status: 'UNKNOWN',
      duration: duration,
      contextLength: 0,
      responseQuality: 0,
      contentLength: 0,
      hasValidContent: false
    };

    if (response.content && Array.isArray(response.content)) {
      const textBlocks = response.content.filter(block => block.type === 'text');
      result.hasValidContent = textBlocks.length > 0;
      
      if (result.hasValidContent) {
        result.contentLength = textBlocks.reduce((sum, block) => sum + (block.text?.length || 0), 0);
        
        // 评估响应质量 (简化评分)
        if (result.contentLength > 100) {
          result.responseQuality = 0.8;
        } else if (result.contentLength > 50) {
          result.responseQuality = 0.6;
        } else if (result.contentLength > 20) {
          result.responseQuality = 0.4;
        } else {
          result.responseQuality = 0.2;
        }
        
        result.status = 'PASSED';
      } else {
        result.status = 'FAILED';
        result.responseQuality = 0;
      }
    } else {
      result.status = 'FAILED';
    }

    return result;
  }

  analyzeConversationResult(provider, scenario, turnResults, totalDuration, conversationHistory, conversationFailed) {
    const completedTurns = turnResults.filter(r => r.status === 'PASSED').length;
    const totalTurns = scenario.turns.length;
    
    const result = {
      provider: provider.name,
      scenario: scenario.name,
      status: 'UNKNOWN',
      duration: totalDuration,
      completedTurns: completedTurns,
      totalTurns: totalTurns,
      conversationHistory: conversationHistory,
      turnResults: turnResults
    };

    // 计算上下文保持能力
    result.contextPreservation = this.assessContextPreservation(conversationHistory, scenario);
    
    // 计算平均响应质量
    result.responseQuality = turnResults.reduce((sum, r) => sum + (r.responseQuality || 0), 0) / turnResults.length;
    
    // 综合评估
    if (conversationFailed) {
      result.status = 'FAILED';
      result.summary = `Conversation failed at turn ${completedTurns + 1}/${totalTurns}`;
    } else if (completedTurns === totalTurns) {
      if (result.contextPreservation > 0.7 && result.responseQuality > 0.6) {
        result.status = 'PASSED';
        result.summary = `All ${totalTurns} turns completed successfully with good context preservation`;
      } else if (result.contextPreservation > 0.5 || result.responseQuality > 0.4) {
        result.status = 'PARTIAL';
        result.summary = `All turns completed but with quality issues (context: ${(result.contextPreservation * 100).toFixed(1)}%, quality: ${(result.responseQuality * 100).toFixed(1)}%)`;
      } else {
        result.status = 'FAILED';
        result.summary = `Poor conversation quality despite completion`;
      }
    } else {
      result.status = 'FAILED';
      result.summary = `Only ${completedTurns}/${totalTurns} turns completed`;
    }

    return result;
  }

  assessContextPreservation(conversationHistory, scenario) {
    // 简化的上下文保持评估
    // 检查后续回复中是否引用了前面的内容
    
    if (conversationHistory.length < 4) return 0.5; // 对话太短，难以评估
    
    let contextScore = 0;
    let evaluations = 0;
    
    // 检查助手的回复是否显示了对前文的理解
    for (let i = 3; i < conversationHistory.length; i += 2) { // 跳过，只看助手回复
      if (conversationHistory[i].role === 'assistant') {
        const response = conversationHistory[i].content.toLowerCase();
        const previousContext = conversationHistory.slice(0, i)
          .map(msg => msg.content)
          .join(' ')
          .toLowerCase();
        
        // 简单检查是否有上下文关键词重复
        const contextKeywords = this.extractKeywords(previousContext);
        const responseKeywords = this.extractKeywords(response);
        
        const contextMatches = contextKeywords.filter(word => 
          responseKeywords.includes(word) && word.length > 4
        ).length;
        
        if (contextMatches > 0) {
          contextScore += Math.min(contextMatches / 3, 1); // 最多给1分
        }
        evaluations++;
      }
    }
    
    return evaluations > 0 ? contextScore / evaluations : 0.5;
  }

  extractKeywords(text) {
    // 简单的关键词提取
    return text
      .split(/\\s+/)
      .filter(word => word.length > 4 && !/^(the|and|but|for|are|with|this|that|have|will|can|would|could|should)$/i.test(word))
      .map(word => word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
      .filter(word => word.length > 3);
  }

  saveConversationData(provider, scenario, data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${provider}-${scenario}-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`   💾 Conversation data saved: ${filename}`);
  }

  async runAllTests() {
    console.log('🚀 Starting Multi-turn Conversation Delivery Testing');
    console.log(`Testing ${PROVIDERS.length} providers with ${CONVERSATION_SCENARIOS.length} conversation scenarios`);

    for (const provider of PROVIDERS) {
      console.log(`\\n📊 Testing Provider: ${provider.name} (Port: ${provider.port})`);
      
      for (const scenario of CONVERSATION_SCENARIOS) {
        const result = await this.testConversationScenario(provider, scenario);
        this.results.push(result);
        
        // 场景间延迟
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return this.generateReport();
  }

  generateReport() {
    const report = {
      testSuite: 'Multi-turn Conversation Delivery Testing',
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
        avgTurnsCompleted: providerResults.reduce((sum, r) => sum + (r.completedTurns || 0), 0) / providerResults.length,
        avgContextPreservation: providerResults.reduce((sum, r) => sum + (r.contextPreservation || 0), 0) / providerResults.length,
        avgResponseQuality: providerResults.reduce((sum, r) => sum + (r.responseQuality || 0), 0) / providerResults.length
      };
    }

    // Scenario汇总
    for (const scenario of CONVERSATION_SCENARIOS) {
      const scenarioResults = this.results.filter(r => r.scenario === scenario.name);
      report.scenarioSummary[scenario.name] = {
        total: scenarioResults.length,
        passed: scenarioResults.filter(r => r.status === 'PASSED').length,
        failed: scenarioResults.filter(r => r.status === 'FAILED').length,
        partial: scenarioResults.filter(r => r.status === 'PARTIAL').length,
        avgDuration: Math.round(scenarioResults.reduce((sum, r) => sum + r.duration, 0) / scenarioResults.length),
        avgTurnsCompleted: scenarioResults.reduce((sum, r) => sum + (r.completedTurns || 0), 0) / scenarioResults.length,
        totalTurns: scenario.turns.length
      };
    }

    // 保存报告
    const reportPath = path.join(this.outputDir, `multi-turn-delivery-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  printReport(report) {
    console.log('\\n📋 Multi-turn Conversation Delivery Test Report');
    console.log('=' * 50);
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`⚠️  Partial: ${report.summary.partial}`);
    console.log(`Success Rate: ${((report.summary.passed / report.summary.totalTests) * 100).toFixed(1)}%`);

    console.log('\\n📊 Provider Performance:');
    for (const [provider, stats] of Object.entries(report.providerSummary)) {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      const contextScore = (stats.avgContextPreservation * 100).toFixed(1);
      const qualityScore = (stats.avgResponseQuality * 100).toFixed(1);
      console.log(`  ${provider}: ${stats.passed}/${stats.total} (${successRate}%) - ${stats.avgDuration}ms avg - Context: ${contextScore}% - Quality: ${qualityScore}%`);
    }

    console.log('\\n🎭 Scenario Results:');
    for (const [scenario, stats] of Object.entries(report.scenarioSummary)) {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      const completionRate = ((stats.avgTurnsCompleted / stats.totalTurns) * 100).toFixed(1);
      console.log(`  ${scenario}: ${stats.passed}/${stats.total} (${successRate}%) - ${stats.avgDuration}ms avg - Completion: ${completionRate}%`);
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
  const tester = new MultiTurnDeliveryTester();
  
  try {
    const report = await tester.runAllTests();
    tester.printReport(report);
    
    // 退出码根据测试结果决定
    const exitCode = report.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Multi-turn Conversation Testing Failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = MultiTurnDeliveryTester;