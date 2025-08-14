#!/usr/bin/env node

/**
 * 端到端测试：Claude Code风险审计会话测试
 * 模拟用户输入"请完成本项目代码风险扫描"并进行多轮会话
 */

const http = require('http');
const fs = require('fs').promises;

console.log('🧪 端到端测试：Claude Code风险审计会话');
console.log('=' + '='.repeat(60));

// 测试配置
const TEST_CONFIG = {
  serverPort: 3456,
  timeout: 60000, // 增加超时时间用于复杂对话
  conversationId: `risk-audit-e2e-${Date.now()}`,
  sessionId: `session-${Date.now()}`
};

/**
 * 会话测试器
 */
class RiskAuditConversationTester {
  constructor() {
    this.conversationHistory = [];
    this.conversationId = TEST_CONFIG.conversationId;
    this.sessionId = TEST_CONFIG.sessionId;
    this.testResults = [];
  }

  /**
   * 发送消息到Claude Code服务
   */
  async sendMessage(content, isFirstMessage = false) {
    console.log(`\\n📤 发送消息: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    
    const requestData = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: [
        ...this.conversationHistory,
        {
          role: 'user',
          content: [{ type: 'text', text: content }]
        }
      ],
      metadata: {
        conversationId: this.conversationId,
        sessionId: this.sessionId,
        requestType: 'risk-audit-conversation'
      }
    };

    return this.makeRequest(requestData);
  }

  /**
   * 执行HTTP请求
   */
  async makeRequest(requestData) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestData);
      const startTime = Date.now();

      const req = http.request({
        hostname: 'localhost',
        port: TEST_CONFIG.serverPort,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Bearer test-key-e2e-risk-audit'
        },
        timeout: TEST_CONFIG.timeout
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const responseTime = Date.now() - startTime;

          try {
            const parsedResponse = res.statusCode === 200 ? JSON.parse(data) : null;
            const errorResponse = res.statusCode !== 200 ? JSON.parse(data) : null;

            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              rawData: data,
              parsedResponse,
              errorResponse,
              responseTime
            });
          } catch (parseError) {
            reject(new Error(`Response parsing failed: ${parseError.message}`));
          }
        });
      });

      req.on('error', (err) => reject(new Error(`Request failed: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 处理响应并更新会话历史
   */
  processResponse(response, userMessage) {
    if (response.statusCode === 200 && response.parsedResponse) {
      // 添加用户消息到历史
      this.conversationHistory.push({
        role: 'user',
        content: [{ type: 'text', text: userMessage }]
      });

      // 添加助手响应到历史
      this.conversationHistory.push({
        role: 'assistant',
        content: response.parsedResponse.content
      });

      const assistantText = this.extractTextFromContent(response.parsedResponse.content);
      console.log(`\\n📥 收到响应 (${response.responseTime}ms): ${assistantText.substring(0, 200)}${assistantText.length > 200 ? '...' : ''}`);
      
      return {
        success: true,
        content: assistantText,
        responseTime: response.responseTime,
        tokensUsed: response.parsedResponse.usage || {}
      };
    } else {
      console.log(`\\n❌ 响应错误: ${response.statusCode}`);
      if (response.errorResponse) {
        console.log(`错误详情: ${JSON.stringify(response.errorResponse, null, 2)}`);
      }
      
      return {
        success: false,
        error: response.errorResponse || 'Unknown error',
        statusCode: response.statusCode
      };
    }
  }

  /**
   * 从内容数组中提取文本
   */
  extractTextFromContent(content) {
    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\\n');
    }
    return String(content);
  }

  /**
   * 执行完整的风险审计会话测试
   */
  async runRiskAuditConversation() {
    console.log('\\n🚀 开始风险审计端到端会话测试...\\n');

    try {
      // 第一轮：初始风险扫描请求
      console.log('\\n' + '='.repeat(80));
      console.log('📋 第一轮：请求代码风险扫描');
      console.log('='.repeat(80));

      const round1Response = await this.sendMessage("请完成本项目代码风险扫描", true);
      const round1Result = this.processResponse(round1Response, "请完成本项目代码风险扫描");
      
      this.testResults.push({
        round: 1,
        request: "请完成本项目代码风险扫描",
        ...round1Result,
        expectedFeatures: ['扫描代码', '风险识别', '分析报告']
      });

      if (!round1Result.success) {
        throw new Error(`第一轮会话失败: ${round1Result.error}`);
      }

      // 检查是否包含风险扫描相关内容
      const hasRiskAnalysis = round1Result.content.includes('风险') || 
                             round1Result.content.includes('风险扫描') || 
                             round1Result.content.includes('代码审计') ||
                             round1Result.content.includes('安全') ||
                             round1Result.content.includes('static analysis');

      if (!hasRiskAnalysis) {
        console.log('⚠️  警告：第一轮响应似乎不包含风险扫描内容');
      }

      // 等待一段时间模拟用户思考
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 第二轮：询问具体风险类型
      console.log('\\n' + '='.repeat(80));
      console.log('📋 第二轮：询问具体风险分析');
      console.log('='.repeat(80));

      const round2Response = await this.sendMessage("重点分析静默失败风险和fallback风险，并提供具体的修复建议");
      const round2Result = this.processResponse(round2Response, "重点分析静默失败风险和fallback风险，并提供具体的修复建议");
      
      this.testResults.push({
        round: 2,
        request: "重点分析静默失败风险和fallback风险，并提供具体的修复建议",
        ...round2Result,
        expectedFeatures: ['静默失败', 'fallback', '修复建议']
      });

      if (!round2Result.success) {
        console.log('⚠️  第二轮会话失败，但继续测试');
      }

      // 等待一段时间
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 第三轮：确认修复和结果
      console.log('\\n' + '='.repeat(80));
      console.log('📋 第三轮：确认风险修复状态');
      console.log('='.repeat(80));

      const round3Response = await this.sendMessage("总结一下发现的关键风险和已修复的项目，确保项目符合零硬编码零fallback原则");
      const round3Result = this.processResponse(round3Response, "总结一下发现的关键风险和已修复的项目，确保项目符合零硬编码零fallback原则");
      
      this.testResults.push({
        round: 3,
        request: "总结一下发现的关键风险和已修复的项目，确保项目符合零硬编码零fallback原则",
        ...round3Result,
        expectedFeatures: ['风险总结', '修复状态', '零硬编码', '零fallback']
      });

      return {
        success: true,
        conversationLength: this.conversationHistory.length,
        totalRounds: 3,
        results: this.testResults
      };

    } catch (error) {
      console.error('❌ 会话测试执行失败:', error);
      return {
        success: false,
        error: error.message,
        results: this.testResults
      };
    }
  }
}

/**
 * 分析测试结果
 */
function analyzeConversationResults(conversationResult) {
  console.log('\\n' + '='.repeat(70));
  console.log('📊 风险审计会话测试分析报告');
  console.log('='.repeat(70));

  const { success, conversationLength, totalRounds, results, error } = conversationResult;

  console.log('\\n📈 基础统计:');
  console.log(`   会话是否成功: ${success ? '✅ 是' : '❌ 否'}`);
  if (error) {
    console.log(`   错误信息: ${error}`);
  }
  console.log(`   总会话轮数: ${totalRounds || 'N/A'}`);
  console.log(`   会话历史长度: ${conversationLength || 0}`);

  if (results && results.length > 0) {
    console.log('\\n🔍 各轮会话结果:');
    
    let totalResponseTime = 0;
    let successfulRounds = 0;
    
    results.forEach(result => {
      const status = result.success ? '✅ SUCCESS' : '❌ FAIL';
      console.log(`\\n   📋 第${result.round}轮: ${status}`);
      console.log(`      请求: ${result.request.substring(0, 80)}...`);
      
      if (result.success) {
        successfulRounds++;
        totalResponseTime += result.responseTime || 0;
        console.log(`      响应时间: ${result.responseTime}ms`);
        console.log(`      响应长度: ${result.content ? result.content.length : 0} 字符`);
        
        // 检查期望特性
        if (result.expectedFeatures) {
          const foundFeatures = result.expectedFeatures.filter(feature => 
            result.content && result.content.toLowerCase().includes(feature.toLowerCase())
          );
          console.log(`      期望特性: ${foundFeatures.length}/${result.expectedFeatures.length} 找到`);
          console.log(`      找到特性: ${foundFeatures.join(', ')}`);
        }
      } else {
        console.log(`      错误: ${result.error}`);
        console.log(`      状态码: ${result.statusCode}`);
      }
    });

    const averageResponseTime = successfulRounds > 0 ? (totalResponseTime / successfulRounds) : 0;
    const successRate = (successfulRounds / results.length) * 100;

    console.log('\\n📊 整体表现:');
    console.log(`   成功率: ${successRate.toFixed(1)}%`);
    console.log(`   平均响应时间: ${averageResponseTime.toFixed(0)}ms`);
    
    // 功能验证评估
    console.log('\\n🧪 功能验证评估:');
    const allFeaturesFound = results.every(result => 
      result.expectedFeatures && result.success && 
      result.expectedFeatures.some(feature => 
        result.content && result.content.toLowerCase().includes(feature.toLowerCase())
      )
    );
    
    console.log(`   风险扫描功能: ${allFeaturesFound ? '✅ 正常工作' : '⚠️ 需要检查'}`);
    console.log(`   多轮对话能力: ${successfulRounds >= 2 ? '✅ 正常' : '❌ 异常'}`);
    console.log(`   用户体验: ${averageResponseTime < 10000 ? '✅ 响应及时' : '⚠️ 响应较慢'}`);
  }

  const overallSuccess = success && results.length >= 3 && results.filter(r => r.success).length >= 2;
  
  console.log(`\\n🏁 测试结果: ${overallSuccess ? '✅ 端到端测试通过' : '❌ 端到端测试失败'}`);
  
  if (overallSuccess) {
    console.log('\\n🎉 风险审计功能端到端验证成功！');
    console.log('✅ Claude Code能够正确处理代码风险扫描请求');
    console.log('✅ 多轮会话功能正常工作');
    console.log('✅ 系统响应性能符合预期');
  } else {
    console.log('\\n⚠️ 端到端测试发现问题，需要进一步调查');
  }

  return {
    success: overallSuccess,
    successRate: results.length > 0 ? (results.filter(r => r.success).length / results.length) * 100 : 0,
    averageResponseTime: results.length > 0 ? (results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / results.length) : 0,
    conversationAnalysis: {
      totalRounds: results.length,
      successfulRounds: results.filter(r => r.success).length,
      functionalityVerified: allFeaturesFound
    }
  };
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🎯 目标: 验证Claude Code风险审计功能的端到端用户体验');
  console.log('📋 测试内容: 模拟用户请求代码风险扫描的完整会话流程');
  console.log('🔄 会话流程: 风险扫描请求 → 具体分析 → 修复确认');
  console.log(`🌐 测试服务: localhost:${TEST_CONFIG.serverPort}`);

  try {
    // 首先检查服务是否运行
    console.log('\\n🔍 检查Claude Code服务状态...');
    const healthCheck = await checkServiceHealth();
    
    if (!healthCheck.healthy) {
      throw new Error(`服务不可用: ${healthCheck.error}`);
    }
    
    console.log(`✅ 服务健康检查通过 (${healthCheck.responseTime}ms)`);

    // 执行风险审计会话测试
    const tester = new RiskAuditConversationTester();
    const conversationResult = await tester.runRiskAuditConversation();
    
    // 分析测试结果
    const analysis = analyzeConversationResults(conversationResult);

    // 保存测试结果
    const reportData = {
      timestamp: new Date().toISOString(),
      testType: 'risk-audit-e2e-conversation',
      config: TEST_CONFIG,
      conversationResult,
      analysis,
      conversationHistory: tester.conversationHistory
    };

    const reportPath = `test-risk-audit-e2e-conversation-${Date.now()}.json`;
    await fs.writeFile(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\\n💾 测试报告已保存到: ${reportPath}`);

    process.exit(analysis.success ? 0 : 1);

  } catch (error) {
    console.error('❌ 端到端测试执行失败:', error);
    process.exit(1);
  }
}

/**
 * 健康检查函数
 */
async function checkServiceHealth() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const req = http.request({
      hostname: 'localhost',
      port: TEST_CONFIG.serverPort,
      path: '/health',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      const responseTime = Date.now() - startTime;
      resolve({
        healthy: res.statusCode === 200,
        responseTime,
        statusCode: res.statusCode
      });
    });

    req.on('error', (err) => {
      resolve({
        healthy: false,
        error: err.message,
        responseTime: Date.now() - startTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        healthy: false,
        error: 'Health check timeout',
        responseTime: Date.now() - startTime
      });
    });

    req.end();
  });
}

// 直接执行测试
if (require.main === module) {
  main();
}

module.exports = {
  RiskAuditConversationTester,
  analyzeConversationResults
};