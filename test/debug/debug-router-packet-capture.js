#!/usr/bin/env node

/**
 * Router HTTP请求抓包系统
 * 项目所有者: Jason Zhang
 * 
 * 目标:
 * 1. 捕获router发送到CodeWhisperer API的原始HTTP请求
 * 2. 分析400错误的具体原因
 * 3. 对比demo2的正确请求格式
 * 4. 生成具体的修复建议
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

// 配置常量
const CONFIG = {
  ROUTER_URL: 'http://localhost:3458',
  OUTPUT_DIR: '/tmp/router-packet-capture',
  DEBUG_DATA_DIR: '~/.route-claude-code/database/debug-captures'
};

// 测试用例数据
const TEST_CASES = {
  simple_text: {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: "Hello, how are you?"
      }
    ],
    stream: false
  },
  
  background_model: {
    model: "claude-3-5-haiku-20241022", // 这个应该路由到background类别
    max_tokens: 1000,
    messages: [
      {
        role: "user", 
        content: "Quick question about JavaScript"
      }
    ],
    stream: false
  },

  with_tools: {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: "Please create a todo list for project tasks"
      }
    ],
    tools: [
      {
        name: "TodoWrite",
        description: "Create and manage todo items",
        input_schema: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string" },
                  status: { type: "string", enum: ["pending", "completed"] },
                  priority: { type: "string", enum: ["high", "medium", "low"] }
                },
                required: ["content", "status", "priority"]
              }
            }
          },
          required: ["todos"]
        }
      }
    ],
    stream: false
  }
};

// Demo2正确请求格式参考（从main.go中提取）
const DEMO2_REFERENCE = {
  modelMap: {
    'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0',
    'claude-3-5-haiku-20241022': 'CLAUDE_3_7_SONNET_20250219_V1_0'
  },
  
  correctRequestFormat: {
    conversationState: {
      chatTriggerType: "MANUAL",
      conversationId: "uuid-here",
      currentMessage: {
        userInputMessage: {
          content: "Hello, how are you?",
          modelId: "CLAUDE_SONNET_4_20250514_V1_0",
          origin: "AI_EDITOR",
          userInputMessageContext: {} // ⚠️ 关键：必须是空对象！
        }
      },
      history: []
    },
    profileArn: "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK"
  }
};

class RouterPacketCapture {
  constructor() {
    this.outputDir = CONFIG.OUTPUT_DIR;
    this.results = {
      router: {},
      analysis: {},
      timestamp: new Date().toISOString()
    };
    
    this.setupOutputDirectory();
  }

  setupOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // 创建调试数据目录
    const debugDataDir = CONFIG.DEBUG_DATA_DIR.replace('~', os.homedir());
    if (!fs.existsSync(debugDataDir)) {
      fs.mkdirSync(debugDataDir, { recursive: true });
    }
    
    console.log('✅ 输出目录已准备:', this.outputDir);
  }

  /**
   * 检查Router服务器状态
   */
  async checkRouterServer() {
    console.log('\n🔍 检查Router服务器状态...');
    
    try {
      const response = await axios.get(`${CONFIG.ROUTER_URL}/health`, {
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('✅ Router服务器运行正常');
        return true;
      }
    } catch (error) {
      console.log('❌ Router服务器未运行，请先启动: ./rcc start');
      return false;
    }
  }

  /**
   * 捕获Router的HTTP请求
   */
  async captureRouterRequest(testName, testData) {
    console.log(`\n📡 捕获Router请求: ${testName}`);
    
    const captureData = {
      testName,
      timestamp: new Date().toISOString(),
      originalRequest: testData,
      routerRequest: null,
      routerResponse: null,
      routerError: null,
      codewhispererRequest: null,  // 我们希望能捕获到发送给CodeWhisperer的实际请求
      codewhispererResponse: null,
      codewhispererError: null
    };

    try {
      // 创建axios实例，捕获所有HTTP请求详情
      const axiosInstance = axios.create();
      
      // 请求拦截器 - 捕获发送给Router的请求
      axiosInstance.interceptors.request.use(request => {
        captureData.routerRequest = {
          url: request.url,
          method: request.method,
          headers: request.headers,
          data: request.data,
          timeout: request.timeout
        };
        
        console.log('🔍 发送给Router的请求详情:');
        console.log('URL:', request.url);
        console.log('Method:', request.method);
        console.log('Headers:', JSON.stringify(request.headers, null, 2));
        console.log('Body:', typeof request.data === 'string' ? request.data : JSON.stringify(request.data, null, 2));
        
        return request;
      });

      // 响应拦截器 - 捕获Router的响应
      axiosInstance.interceptors.response.use(
        response => {
          captureData.routerResponse = {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
          };
          
          console.log('✅ Router响应成功:', response.status, response.statusText);
          if (response.data) {
            console.log('响应数据:', JSON.stringify(response.data, null, 2));
          }
          return response;
        },
        error => {
          captureData.routerError = {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            headers: error.response?.headers,
            data: error.response?.data,
            config: {
              url: error.config?.url,
              method: error.config?.method,
              headers: error.config?.headers,
              data: error.config?.data
            }
          };
          
          console.log('❌ Router错误:', error.response?.status, error.message);
          if (error.response?.data) {
            console.log('错误响应数据:', JSON.stringify(error.response.data, null, 2));
          }
          
          return Promise.reject(error);
        }
      );

      // 发送请求到Router
      const response = await axiosInstance.post(`${CONFIG.ROUTER_URL}/v1/messages`, testData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'RouterPacketCapture/1.0'
        },
        timeout: 30000
      });

      console.log('✅ Router请求成功完成');
      
    } catch (error) {
      console.log('⚠️  Router请求失败，错误详情已捕获');
      
      // 尝试从错误中提取更多信息
      if (error.response?.data) {
        try {
          const errorData = typeof error.response.data === 'string' 
            ? JSON.parse(error.response.data)
            : error.response.data;
          captureData.routerError.parsedData = errorData;
        } catch (parseError) {
          captureData.routerError.rawData = error.response.data;
        }
      }
    }

    // 分析路由结果
    captureData.routingAnalysis = this.analyzeRouting(testData);

    // 保存捕获数据
    const outputFile = path.join(this.outputDir, `${testName}-capture.json`);
    fs.writeFileSync(outputFile, JSON.stringify(captureData, null, 2));
    
    this.results.router[testName] = captureData;
    console.log('💾 Router捕获数据已保存:', outputFile);
    
    return captureData;
  }

  /**
   * 分析路由逻辑
   */
  analyzeRouting(testData) {
    const analysis = {
      inputModel: testData.model,
      expectedCategory: this.determineExpectedCategory(testData),
      expectedTargetModel: this.getExpectedTargetModel(testData.model),
      hasTools: !!(testData.tools && testData.tools.length > 0),
      messageCount: testData.messages?.length || 0,
      contentLength: this.calculateContentLength(testData)
    };

    console.log('🎯 路由分析:', JSON.stringify(analysis, null, 2));
    return analysis;
  }

  /**
   * 确定预期的路由类别
   */
  determineExpectedCategory(testData) {
    // 基于CLAUDE.md中的路由规则
    const model = testData.model;
    
    if (model === 'claude-3-5-haiku-20241022') {
      return 'background';
    }
    
    if (testData.tools && testData.tools.length > 0) {
      return 'search';
    }
    
    const contentLength = this.calculateContentLength(testData);
    if (contentLength > 60000) {
      return 'longcontext';
    }
    
    return 'default';
  }

  /**
   * 获取预期的目标模型
   */
  getExpectedTargetModel(inputModel) {
    return DEMO2_REFERENCE.modelMap[inputModel] || inputModel;
  }

  /**
   * 计算内容长度
   */
  calculateContentLength(testData) {
    let totalLength = 0;
    
    if (testData.messages) {
      for (const message of testData.messages) {
        if (typeof message.content === 'string') {
          totalLength += message.content.length;
        }
      }
    }
    
    return totalLength;
  }

  /**
   * 对比分析结果
   */
  analyzeResults() {
    console.log('\n🔍 分析结果...');
    
    const analysis = {
      timestamp: new Date().toISOString(),
      testResults: {},
      commonIssues: [],
      fixSuggestions: []
    };

    for (const [testName, captureData] of Object.entries(this.results.router)) {
      const testAnalysis = {
        testName,
        success: !captureData.routerError,
        status: captureData.routerResponse?.status || captureData.routerError?.status,
        issues: [],
        observations: []
      };

      // 分析具体问题
      if (captureData.routerError) {
        if (captureData.routerError.status === 400) {
          testAnalysis.issues.push({
            type: 'bad_request',
            description: '400错误 - 请求格式问题',
            impact: 'critical'
          });
        }
        
        if (captureData.routerError.status === 403) {
          testAnalysis.issues.push({
            type: 'authentication',
            description: '403错误 - 认证失败',
            impact: 'critical'
          });
        }
      }

      // 分析路由逻辑
      const routing = captureData.routingAnalysis;
      if (routing) {
        testAnalysis.observations.push({
          type: 'routing',
          inputModel: routing.inputModel,
          expectedCategory: routing.expectedCategory,
          expectedTargetModel: routing.expectedTargetModel,
          hasTools: routing.hasTools
        });
      }

      analysis.testResults[testName] = testAnalysis;
    }

    // 生成修复建议
    analysis.fixSuggestions = this.generateFixSuggestions(analysis.testResults);

    // 保存分析结果
    const analysisFile = path.join(this.outputDir, 'analysis-results.json');
    fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));
    
    this.results.analysis = analysis;
    console.log('💾 分析结果已保存:', analysisFile);
    
    this.printAnalysisResults(analysis);
    
    return analysis;
  }

  /**
   * 生成修复建议
   */
  generateFixSuggestions(testResults) {
    const suggestions = [];
    
    // 检查400错误
    const has400Error = Object.values(testResults).some(result => 
      result.issues.some(issue => issue.type === 'bad_request')
    );
    
    if (has400Error) {
      suggestions.push({
        priority: 'critical',
        category: 'request_format',
        issue: '400错误 - CodeWhisperer API请求格式错误',
        suggestion: '检查userInputMessageContext字段，确保它是空对象{}，不包含tools字段',
        reference: 'demo2 main.go line 103: userInputMessageContext: {}'
      });
    }

    // 检查认证问题
    const has403Error = Object.values(testResults).some(result => 
      result.issues.some(issue => issue.type === 'authentication')
    );
    
    if (has403Error) {
      suggestions.push({
        priority: 'critical',
        category: 'authentication',
        issue: '403错误 - 认证失败',
        suggestion: '检查token获取逻辑和Authorization头格式',
        reference: 'demo2 main.go line 690: proxyReq.Header.Set("Authorization", "Bearer "+token)'
      });
    }

    return suggestions;
  }

  /**
   * 打印分析结果
   */
  printAnalysisResults(analysis) {
    console.log('\n📊 分析结果摘要:');
    console.log('=====================================');
    
    const totalTests = Object.keys(analysis.testResults).length;
    const successfulTests = Object.values(analysis.testResults)
      .filter(result => result.success).length;
    const failedTests = totalTests - successfulTests;
    
    console.log(`测试总数: ${totalTests}`);
    console.log(`成功: ${successfulTests}`);
    console.log(`失败: ${failedTests}`);
    
    // 显示每个测试的结果
    for (const [testName, result] of Object.entries(analysis.testResults)) {
      const status = result.success ? '✅' : '❌';
      console.log(`\n${status} ${testName}:`);
      console.log(`   状态: ${result.status || 'N/A'}`);
      
      if (result.issues.length > 0) {
        console.log('   问题:');
        result.issues.forEach(issue => {
          console.log(`   - [${issue.impact.toUpperCase()}] ${issue.description}`);
        });
      }
      
      if (result.observations.length > 0) {
        console.log('   观察:');
        result.observations.forEach(obs => {
          if (obs.type === 'routing') {
            console.log(`   - 路由: ${obs.inputModel} → ${obs.expectedCategory} → ${obs.expectedTargetModel}`);
            console.log(`   - 工具: ${obs.hasTools ? '是' : '否'}`);
          }
        });
      }
    }
    
    // 显示修复建议
    if (analysis.fixSuggestions.length > 0) {
      console.log('\n🔧 修复建议:');
      console.log('=====================================');
      analysis.fixSuggestions.forEach((suggestion, index) => {
        console.log(`${index + 1}. [${suggestion.priority.toUpperCase()}] ${suggestion.category}:`);
        console.log(`   问题: ${suggestion.issue}`);
        console.log(`   建议: ${suggestion.suggestion}`);
        console.log(`   参考: ${suggestion.reference}`);
        console.log('');
      });
    }
  }

  /**
   * 生成详细报告
   */
  generateReport() {
    console.log('\n📄 生成详细报告...');
    
    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        testCases: Object.keys(TEST_CASES).length,
        completedTests: Object.keys(this.results.router).length
      },
      demo2_reference: DEMO2_REFERENCE,
      test_results: this.results.router,
      analysis: this.results.analysis,
      recommendations: {
        immediate_fixes: [],
        improvements: [],
        monitoring: []
      }
    };

    // 根据分析结果生成推荐
    if (this.results.analysis?.fixSuggestions) {
      for (const suggestion of this.results.analysis.fixSuggestions) {
        if (suggestion.priority === 'critical') {
          report.recommendations.immediate_fixes.push(suggestion);
        } else {
          report.recommendations.improvements.push(suggestion);
        }
      }
    }

    // 添加监控建议
    report.recommendations.monitoring.push({
      category: 'request_tracing',
      suggestion: '启用debug模式监控CodeWhisperer请求',
      command: 'tail -f ~/.route-claude-code/logs/dev/ccr-*.log'
    });

    // 保存报告
    const reportFile = path.join(this.outputDir, 'router-packet-capture-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log('💾 详细报告已保存:', reportFile);
    return report;
  }

  /**
   * 运行完整的抓包测试
   */
  async runFullCapture() {
    console.log('🚀 开始Router抓包测试');
    console.log('=====================================');
    
    try {
      // 1. 检查Router服务器
      const routerReady = await this.checkRouterServer();
      if (!routerReady) {
        throw new Error('Router服务器未运行');
      }

      // 2. 对每个测试用例进行抓包
      for (const [testName, testData] of Object.entries(TEST_CASES)) {
        console.log(`\n🧪 测试用例: ${testName}`);
        console.log('================================');
        
        // 捕获Router请求
        const routerCapture = await this.captureRouterRequest(testName, testData);
        
        // 等待一下再进行下一个测试
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 3. 分析结果
      const analysis = this.analyzeResults();
      
      // 4. 生成最终报告
      const report = this.generateReport();
      
      console.log('\n🎉 Router抓包测试完成！');
      console.log('=====================================');
      console.log(`报告位置: ${this.outputDir}`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Router抓包测试失败:', error);
      throw error;
    }
  }
}

// 主执行函数
async function main() {
  console.log('🔍 Router HTTP请求抓包系统');
  console.log('=====================================');
  console.log('目标: 分析Router的CodeWhisperer请求格式问题');
  console.log('');
  
  const capture = new RouterPacketCapture();
  
  try {
    const report = await capture.runFullCapture();
    
    console.log('\n✅ 测试完成，请查看以下文件:');
    console.log(`📄 详细报告: ${path.join(CONFIG.OUTPUT_DIR, 'router-packet-capture-report.json')}`);
    console.log(`🔍 分析结果: ${path.join(CONFIG.OUTPUT_DIR, 'analysis-results.json')}`);
    console.log(`📁 原始数据: ${CONFIG.OUTPUT_DIR}`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { RouterPacketCapture, TEST_CASES, CONFIG, DEMO2_REFERENCE };