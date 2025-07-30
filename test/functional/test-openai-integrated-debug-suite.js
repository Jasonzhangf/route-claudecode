#!/usr/bin/env node
/**
 * OpenAI集成调试测试套件
 * 整合数据捕获、Hook、回放和诊断系统的完整调试解决方案
 * Project: Claude Code Router Enhanced
 * Author: Jason Zhang
 */

const { OpenAIDataCaptureSystem } = require('./test-openai-pipeline-data-capture');
const { OpenAIPipelineHookManager } = require('./test-openai-pipeline-hooks');
const { OpenAIPipelineReplaySystem } = require('./test-openai-pipeline-replay');
const { OpenAIProblemDiagnosisSystem } = require('./test-openai-problem-diagnosis');
const axios = require('axios');
const readline = require('readline');

/**
 * OpenAI集成调试套件
 * 提供完整的OpenAI调试功能集合
 */
class OpenAIIntegratedDebugSuite {
  constructor() {
    this.captureSystem = new OpenAIDataCaptureSystem();
    this.hookManager = new OpenAIPipelineHookManager();
    this.replaySystem = new OpenAIPipelineReplaySystem();
    this.diagnosisSystem = new OpenAIProblemDiagnosisSystem();
    
    this.baseUrl = 'http://localhost:3456';
    this.isInitialized = false;
    this.currentSession = null;
    this.debugMode = false;
  }

  /**
   * 初始化调试套件
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('🚀 Initializing OpenAI Integrated Debug Suite...');
    
    // 初始化各个系统
    await this.captureSystem.initialize();
    await this.hookManager.enable();
    
    // 创建交互界面
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.isInitialized = true;
    console.log('✅ Debug suite initialized successfully');
  }

  /**
   * 启用调试模式
   */
  enableDebugMode() {
    this.debugMode = true;
    this.hookManager.enableStepMode();
    console.log('🔍 Debug mode enabled - detailed logging activated');
  }

  /**
   * 禁用调试模式
   */
  disableDebugMode() {
    this.debugMode = false;
    this.hookManager.disableStepMode();
    console.log('🏃 Debug mode disabled - normal operation');
  }

  /**
   * 执行完整的调试流程
   */
  async runCompleteDebugFlow(testRequest = null) {
    console.log('\n🎬 Starting complete OpenAI debug flow...');
    
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Step 1: 准备测试请求
      const request = testRequest || this.createTestRequest();
      console.log('\n📤 Test request prepared:', {
        model: request.model,
        messages: request.messages.length,
        tools: request.metadata?.tools?.length || 0
      });

      // Step 2: 使用Hook系统发送请求并捕获数据
      console.log('\n🎣 Sending request with hooks enabled...');
      const response = await this.sendRequestWithHooks(request);
      
      // Step 3: 立即诊断会话
      if (this.currentSession) {
        console.log('\n🩺 Running immediate diagnosis...');
        const diagnosis = await this.diagnosisSystem.diagnoseSession(this.currentSession);
        this.diagnosisSystem.generateDiagnosisSummary(diagnosis);
        
        // Step 4: 如果发现问题，启动回放调试
        if (diagnosis.issues.length > 0) {
          console.log('\n🔧 Issues detected, starting replay debugging...');
          await this.runReplayDebugging();
        }
      }

      console.log('\n✅ Complete debug flow finished');
      return {
        request,
        response,
        sessionId: this.currentSession,
        hasIssues: this.currentSession ? true : false
      };

    } catch (error) {
      console.error('\n❌ Debug flow failed:', error);
      
      // 即使失败也尝试诊断
      if (this.currentSession) {
        console.log('\n🩺 Running failure diagnosis...');
        await this.diagnosisSystem.diagnoseSession(this.currentSession);
      }
      
      throw error;
    }
  }

  /**
   * 创建测试请求
   */
  createTestRequest() {
    return {
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please help me search for information about Node.js best practices and create a simple HTTP server example.'
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      metadata: {
        requestId: `debug-test-${Date.now()}`,
        tools: [
          {
            name: 'WebSearch',
            description: 'Search for information on the web',
            input_schema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' }
              },
              required: ['query']
            }
          }
        ]
      }
    };
  }

  /**
   * 使用Hook系统发送请求
   */
  async sendRequestWithHooks(request) {
    // 开始新的会话捕获
    this.currentSession = `capture-${Date.now()}`;
    
    try {
      // 手动触发Hook捕获 (模拟集成环境)
      await this.captureSystem.captureStep1Input(request);
      
      // 模拟路由决策
      const routingResult = this.simulateRouting(request);
      await this.captureSystem.captureStep2Routing(routingResult);
      
      // 模拟格式转换
      const transformationData = this.simulateTransformation(request, routingResult);
      await this.captureSystem.captureStep3Transformation(
        transformationData.anthropicRequest,
        transformationData.openaiRequest
      );
      
      // 发送真实API请求
      console.log('📡 Sending request to local router...');
      const response = await this.sendToLocalRouter(request);
      
      // 捕获API响应
      await this.captureSystem.captureStep4RawResponse(response.data, false);
      await this.captureSystem.captureStep5TransformerInput(response.data);
      
      // 处理响应并捕获最终输出
      const finalResponse = this.processFinalResponse(response.data, request);
      await this.captureSystem.captureStep6TransformerOutput(finalResponse);
      
      // 生成捕获报告
      await this.captureSystem.generateCaptureReport();
      
      return finalResponse;
      
    } catch (error) {
      console.error('❌ Request with hooks failed:', error);
      throw error;
    }
  }

  /**
   * 模拟路由决策
   */
  simulateRouting(request) {
    // 基于请求特征确定路由
    let category = 'default';
    let provider = 'codewhisperer-primary';
    let targetModel = 'CLAUDE_SONNET_4_20250514_V1_0';
    
    if (request.model.includes('haiku')) {
      category = 'background';
      provider = 'shuaihong-openai';
      targetModel = 'gemini-2.5-flash';
    } else if (request.metadata?.tools && request.metadata.tools.length > 0) {
      category = 'search';
      provider = 'shuaihong-openai';
      targetModel = 'gemini-2.5-flash';
    }
    
    return {
      category,
      provider,
      targetModel,
      originalModel: request.model,
      reason: `Determined based on ${category} category`
    };
  }

  /**
   * 模拟格式转换
   */
  simulateTransformation(request, routingResult) {
    const anthropicRequest = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      system: null,
      tools: request.metadata?.tools
    };
    
    const openaiRequest = {
      model: routingResult.targetModel,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : 
                msg.content.map(block => block.text).join('')
      })),
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      tools: request.metadata?.tools ? request.metadata.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      })) : undefined
    };
    
    return { anthropicRequest, openaiRequest };
  }

  /**
   * 发送请求到本地路由器
   */
  async sendToLocalRouter(request) {
    try {
      const response = await axios.post(`${this.baseUrl}/v1/messages`, request, {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 30000
      });
      
      return response;
    } catch (error) {
      if (error.response) {
        console.log('API Error Response:', error.response.status, error.response.data);
      }
      throw error;
    }
  }

  /**
   * 处理最终响应
   */
  processFinalResponse(responseData, originalRequest) {
    return {
      id: responseData.id || `msg_${Date.now()}`,
      model: originalRequest.model, // 保持原始模型名
      role: 'assistant',
      content: responseData.content || [
        { type: 'text', text: 'Error: No content in response' }
      ],
      stop_reason: responseData.stop_reason || 'error',
      usage: responseData.usage || {
        input_tokens: 0,
        output_tokens: 0
      }
    };
  }

  /**
   * 运行回放调试
   */
  async runReplayDebugging() {
    if (!this.currentSession) {
      console.log('❌ No current session for replay debugging');
      return;
    }

    console.log('\n🎬 Starting replay debugging session...');
    
    try {
      // 加载会话数据
      await this.replaySystem.loadSession(this.currentSession);
      
      // 设置自动断点在问题步骤
      this.replaySystem.setBreakpoint('step4-raw-response');
      this.replaySystem.setBreakpoint('step6-transformer-output');
      
      // 执行回放
      const results = await this.replaySystem.executeFullReplay();
      
      // 生成回放报告
      await this.replaySystem.generateReplayReport();
      
      console.log('✅ Replay debugging completed');
      return results;
      
    } catch (error) {
      console.error('❌ Replay debugging failed:', error);
    }
  }

  /**
   * 运行性能基准测试
   */
  async runPerformanceBenchmark() {
    console.log('\n📊 Running performance benchmark...');
    
    const testCases = [
      { name: 'Simple Text', hasTools: false, messageCount: 1 },
      { name: 'With Tools', hasTools: true, messageCount: 1 },
      { name: 'Multi-turn', hasTools: false, messageCount: 3 },
      { name: 'Complex Tools', hasTools: true, messageCount: 2 }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Testing: ${testCase.name}`);
      
      const request = this.createBenchmarkRequest(testCase);
      const startTime = Date.now();
      
      try {
        await this.runCompleteDebugFlow(request);
        const duration = Date.now() - startTime;
        
        results.push({
          testCase: testCase.name,
          duration,
          success: true,
          sessionId: this.currentSession
        });
        
        console.log(`✅ ${testCase.name}: ${duration}ms`);
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        results.push({
          testCase: testCase.name,
          duration,
          success: false,
          error: error.message,
          sessionId: this.currentSession
        });
        
        console.log(`❌ ${testCase.name}: Failed after ${duration}ms`);
      }
      
      // 短暂等待避免过载
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 生成性能报告
    console.log('\n📈 Performance Benchmark Results:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.testCase}: ${result.duration}ms`);
    });
    
    const avgDuration = results.filter(r => r.success)
                              .reduce((sum, r) => sum + r.duration, 0) / 
                              results.filter(r => r.success).length;
    console.log(`\n📊 Average successful duration: ${Math.round(avgDuration)}ms`);
    
    return results;
  }

  /**
   * 创建基准测试请求
   */
  createBenchmarkRequest(testCase) {
    const baseRequest = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3,
      metadata: {
        requestId: `benchmark-${testCase.name.toLowerCase().replace(' ', '-')}-${Date.now()}`
      }
    };
    
    // 根据测试用例配置消息
    if (testCase.messageCount === 1) {
      baseRequest.messages = [
        { role: 'user', content: `Test message for ${testCase.name}` }
      ];
    } else {
      baseRequest.messages = [];
      for (let i = 0; i < testCase.messageCount; i++) {
        baseRequest.messages.push(
          { role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i + 1}` }
        );
      }
    }
    
    // 根据测试用例配置工具
    if (testCase.hasTools) {
      baseRequest.metadata.tools = [
        {
          name: 'TestTool',
          description: `Test tool for ${testCase.name}`,
          input_schema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Test input' }
            },
            required: ['input']
          }
        }
      ];
      
      if (testCase.name === 'Complex Tools') {
        baseRequest.metadata.tools.push({
          name: 'WebSearch',
          description: 'Search for information',
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        });
      }
    }
    
    return baseRequest;
  }

  /**
   * 运行交互式调试会话
   */
  async runInteractiveSession() {
    console.log('\n🎮 Starting interactive debug session...');
    console.log('Available commands:');
    console.log('  1. Run complete debug flow');
    console.log('  2. Run performance benchmark');
    console.log('  3. Diagnose existing session');
    console.log('  4. Replay session');
    console.log('  5. Enable/disable debug mode');
    console.log('  6. View recent sessions');
    console.log('  q. Quit');
    
    while (true) {
      const choice = await this.waitForInput('\n[debug-suite] > ');
      
      switch (choice.toLowerCase()) {
        case '1':
          await this.runCompleteDebugFlow();
          break;
          
        case '2':
          await this.runPerformanceBenchmark();
          break;
          
        case '3':
          const sessionId = await this.waitForInput('Session ID: ');
          const diagnosis = await this.diagnosisSystem.diagnoseSession(sessionId);
          this.diagnosisSystem.generateDiagnosisSummary(diagnosis);
          break;
          
        case '4':
          const replaySessionId = await this.waitForInput('Session ID for replay: ');
          await this.replaySystem.loadSession(replaySessionId);
          await this.replaySystem.executeFullReplay();
          break;
          
        case '5':
          this.debugMode = !this.debugMode;
          if (this.debugMode) {
            this.enableDebugMode();
          } else {
            this.disableDebugMode();
          }
          break;
          
        case '6':
          const sessions = await this.replaySystem.listAvailableSessions();
          console.log(`Found ${sessions.length} recent sessions`);
          break;
          
        case 'q':
        case 'quit':
          console.log('👋 Goodbye!');
          return;
          
        default:
          console.log('❓ Unknown command');
      }
    }
  }

  /**
   * 等待用户输入
   */
  async waitForInput(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * 生成综合调试报告
   */
  async generateComprehensiveReport() {
    console.log('\n📋 Generating comprehensive debug report...');
    
    // 运行批量诊断
    const batchDiagnosis = await this.diagnosisSystem.batchDiagnosis();
    
    // 创建综合报告
    const report = {
      timestamp: new Date().toISOString(),
      suiteVersion: '1.0.0',
      overallHealth: {
        sessionsAnalyzed: batchDiagnosis.sessionsAnalyzed,
        issuesSummary: batchDiagnosis.overallSummary,
        healthScore: this.calculateHealthScore(batchDiagnosis.overallSummary)
      },
      commonIssues: batchDiagnosis.commonIssues,
      recommendations: this.generateSystemRecommendations(batchDiagnosis),
      systemStatus: {
        captureSystemReady: true,
        hookSystemEnabled: this.hookManager.isEnabled,
        debugModeActive: this.debugMode,
        lastSessionId: this.currentSession
      }
    };
    
    console.log('\n📊 Comprehensive Report Summary:');
    console.log(`   Health Score: ${report.overallHealth.healthScore}/100`);
    console.log(`   Sessions Analyzed: ${report.overallHealth.sessionsAnalyzed}`);
    console.log(`   Common Issues: ${report.commonIssues.length}`);
    
    return report;
  }

  /**
   * 计算健康分数
   */
  calculateHealthScore(summary) {
    const total = summary.critical + summary.high + summary.medium + summary.low;
    if (total === 0) return 100;
    
    const weightedScore = (summary.critical * 4) + (summary.high * 3) + (summary.medium * 2) + (summary.low * 1);
    const maxPossibleScore = total * 4;
    
    return Math.max(0, Math.round(100 - (weightedScore / maxPossibleScore) * 100));
  }

  /**
   * 生成系统建议
   */
  generateSystemRecommendations(batchDiagnosis) {
    const recommendations = [];
    
    if (batchDiagnosis.overallSummary.critical > 0) {
      recommendations.push({
        priority: 'urgent',
        action: 'Address critical issues immediately',
        description: 'Critical issues prevent normal operation and must be fixed first'
      });
    }
    
    if (batchDiagnosis.commonIssues.length > 0) {
      const topIssue = batchDiagnosis.commonIssues[0];
      recommendations.push({
        priority: 'high',
        action: `Fix recurring issue: ${topIssue.issueId}`,
        description: `This issue affects ${topIssue.percentage}% of sessions`
      });
    }
    
    if (batchDiagnosis.sessionsAnalyzed < 5) {
      recommendations.push({
        priority: 'medium',
        action: 'Increase test coverage',
        description: 'Run more debug sessions to improve issue detection accuracy'
      });
    }
    
    return recommendations;
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.rl) {
      this.rl.close();
    }
    this.hookManager.disable();
    console.log('🧹 Debug suite cleaned up');
  }
}

/**
 * 运行完整的集成调试演示
 */
async function runIntegratedDebugDemo() {
  console.log('🚀 OpenAI Integrated Debug Suite Demo\n');
  
  const debugSuite = new OpenAIIntegratedDebugSuite();
  
  try {
    await debugSuite.initialize();
    
    // 运行交互式会话
    await debugSuite.runInteractiveSession();
    
  } catch (error) {
    console.error('❌ Integrated debug demo failed:', error);
  } finally {
    debugSuite.cleanup();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runIntegratedDebugDemo()
    .then(() => {
      console.log('\n✅ Integrated debug suite demo completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Integrated debug suite demo failed:', error);
      process.exit(1);
    });
}

module.exports = { OpenAIIntegratedDebugSuite, runIntegratedDebugDemo };