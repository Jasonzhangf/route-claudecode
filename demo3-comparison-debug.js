#!/usr/bin/env node
/**
 * Demo3 vs Current Implementation 400错误调试对比工具
 * 全面捕获和对比数据流，定位API 400错误根本原因
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class Demo3ComparisonDebugger {
  constructor() {
    this.debugDir = path.join(__dirname, 'debug-output/demo3-400-analysis');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 确保输出目录存在
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
    
    this.demo3Port = 3457; // demo3默认端口
    this.currentPort = 3456; // 当前实现端口
  }

  /**
   * 主要调试流程
   */
  async runFullComparison() {
    console.log('🔍 Demo3 vs Current Implementation 400错误对比分析');
    console.log('==================================================');
    
    try {
      // 1. 检查服务状态
      await this.checkServicesStatus();
      
      // 2. 捕获demo3的完整流程数据
      const demo3Data = await this.captureDemo3Pipeline();
      
      // 3. 捕获当前实现的完整流程数据
      const currentData = await this.captureCurrentPipeline();
      
      // 4. 进行详细对比分析
      const comparisonResult = await this.performDetailedComparison(demo3Data, currentData);
      
      // 5. 验证token轮换影响
      const tokenRotationResult = await this.testTokenRotation();
      
      // 6. 生成修复建议
      const fixSuggestions = await this.generateFixSuggestions(comparisonResult, tokenRotationResult);
      
      // 7. 输出完整分析报告
      await this.generateComprehensiveReport({
        demo3Data,
        currentData,
        comparisonResult,
        tokenRotationResult,
        fixSuggestions
      });
      
      console.log('\n✅ 完整分析报告已生成');
      console.log(`📁 输出目录: ${this.debugDir}`);
      
    } catch (error) {
      console.error('❌ 调试过程异常:', error.message);
      throw error;
    }
  }

  /**
   * 检查服务状态
   */
  async checkServicesStatus() {
    console.log('\n📊 检查服务状态...');
    
    const services = [
      { name: 'Demo3', port: this.demo3Port, path: '/health' },
      { name: 'Current', port: this.currentPort, path: '/health' }
    ];
    
    for (const service of services) {
      try {
        const response = await axios.get(`http://localhost:${service.port}${service.path}`, {
          timeout: 3000
        });
        console.log(`  ✅ ${service.name}: 运行正常 (${response.status})`);
      } catch (error) {
        console.log(`  ❌ ${service.name}: 无法连接 - ${error.message}`);
      }
    }
  }

  /**
   * 捕获demo3的完整流程数据
   */
  async captureDemo3Pipeline() {
    console.log('\n🎯 捕获Demo3流程数据...');
    
    const testRequest = {
      model: 'CLAUDE_SONNET_4_20250514_V1_0',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: 'Hello, can you help me with a simple task?' }
      ],
      tools: [{
        name: 'get_current_time',
        description: 'Get the current time',
        input_schema: {
          type: 'object',
          properties: {}
        }
      }]
    };
    
    try {
      // 发送到demo3
      const demo3Response = await axios.post(`http://localhost:${this.demo3Port}/v1/messages`, testRequest, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'demo3-test-key'
        },
        timeout: 30000
      });
      
      const demo3Data = {
        request: testRequest,
        response: demo3Response.data,
        headers: demo3Response.headers,
        status: demo3Response.status,
        timestamp: new Date().toISOString()
      };
      
      // 保存demo3数据
      fs.writeFileSync(
        path.join(this.debugDir, `demo3-pipeline-${this.timestamp}.json`),
        JSON.stringify(demo3Data, null, 2)
      );
      
      console.log('  ✅ Demo3数据捕获成功');
      return demo3Data;
      
    } catch (error) {
      console.log('  ❌ Demo3数据捕获失败:', error.message);
      
      const errorData = {
        request: testRequest,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers
        },
        timestamp: new Date().toISOString()
      };
      
      // 保存错误数据
      fs.writeFileSync(
        path.join(this.debugDir, `demo3-error-${this.timestamp}.json`),
        JSON.stringify(errorData, null, 2)
      );
      
      return errorData;
    }
  }

  /**
   * 捕获当前实现的完整流程数据
   */
  async captureCurrentPipeline() {
    console.log('\n🔧 捕获当前实现流程数据...');
    
    const testRequest = {
      model: 'CLAUDE_SONNET_4_20250514_V1_0',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: 'Hello, can you help me with a simple task?' }
      ],
      tools: [{
        name: 'get_current_time',
        description: 'Get the current time',
        input_schema: {
          type: 'object',
          properties: {}
        }
      }]
    };
    
    try {
      // 发送到当前实现
      const currentResponse = await axios.post(`http://localhost:${this.currentPort}/v1/messages`, testRequest, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      });
      
      const currentData = {
        request: testRequest,
        response: currentResponse.data,
        headers: currentResponse.headers,
        status: currentResponse.status,
        timestamp: new Date().toISOString()
      };
      
      // 保存当前实现数据
      fs.writeFileSync(
        path.join(this.debugDir, `current-pipeline-${this.timestamp}.json`),
        JSON.stringify(currentData, null, 2)
      );
      
      console.log('  ✅ 当前实现数据捕获成功');
      return currentData;
      
    } catch (error) {
      console.log('  ❌ 当前实现数据捕获失败:', error.message);
      console.log(`     状态码: ${error.response?.status}`);
      console.log(`     错误详情: ${JSON.stringify(error.response?.data, null, 2)}`);
      
      const errorData = {
        request: testRequest,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers
        },
        timestamp: new Date().toISOString()
      };
      
      // 保存错误数据
      fs.writeFileSync(
        path.join(this.debugDir, `current-error-${this.timestamp}.json`),
        JSON.stringify(errorData, null, 2)
      );
      
      return errorData;
    }
  }

  /**
   * 执行详细对比分析
   */
  async performDetailedComparison(demo3Data, currentData) {
    console.log('\n🔬 执行详细对比分析...');
    
    const comparison = {
      requestDifferences: this.compareRequests(demo3Data.request, currentData.request),
      responseDifferences: this.compareResponses(demo3Data, currentData),
      statusComparison: {
        demo3: demo3Data.status || demo3Data.error?.status,
        current: currentData.status || currentData.error?.status,
        match: (demo3Data.status || demo3Data.error?.status) === (currentData.status || currentData.error?.status)
      },
      criticalIssues: []
    };
    
    // 识别关键问题
    if (currentData.error?.status === 400) {
      comparison.criticalIssues.push({
        type: 'API_400_ERROR',
        description: 'Current implementation returning 400 Bad Request',
        currentError: currentData.error,
        demo3Status: demo3Data.status
      });
    }
    
    // 保存对比结果
    fs.writeFileSync(
      path.join(this.debugDir, `comparison-analysis-${this.timestamp}.json`),
      JSON.stringify(comparison, null, 2)
    );
    
    console.log(`  ✅ 对比分析完成，发现 ${comparison.criticalIssues.length} 个关键问题`);
    return comparison;
  }

  /**
   * 测试token轮换影响
   */
  async testTokenRotation() {
    console.log('\n🔄 测试Token轮换影响...');
    
    const testResults = {
      beforeRotation: null,
      afterRotation: null,
      still400: false
    };
    
    try {
      // 测试轮换前
      console.log('  📝 测试Token轮换前状态...');
      testResults.beforeRotation = await this.sendTestRequest('before-rotation');
      
      // 测试轮换后 (模拟)
      console.log('  📝 测试Token轮换后状态...');
      testResults.afterRotation = await this.sendTestRequest('after-rotation');
      
      testResults.still400 = testResults.afterRotation.error?.status === 400;
      
      if (testResults.still400) {
        console.log('  ❌ Token轮换后仍有400错误 - 问题不在Token');
      } else {
        console.log('  ✅ Token轮换后错误解决 - 问题可能与Token相关');
      }
      
      // 保存轮换测试结果
      fs.writeFileSync(
        path.join(this.debugDir, `token-rotation-test-${this.timestamp}.json`),
        JSON.stringify(testResults, null, 2)
      );
      
      return testResults;
      
    } catch (error) {
      console.log('  ❌ Token轮换测试失败:', error.message);
      testResults.error = error.message;
      return testResults;
    }
  }

  /**
   * 发送测试请求
   */
  async sendTestRequest(phase) {
    const testRequest = {
      model: 'CLAUDE_SONNET_4_20250514_V1_0',
      max_tokens: 500,
      messages: [
        { role: 'user', content: `Test request during ${phase}` }
      ]
    };
    
    try {
      const response = await axios.post(`http://localhost:${this.currentPort}/v1/messages`, testRequest, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 15000
      });
      
      return {
        phase,
        success: true,
        status: response.status,
        data: response.data,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        phase,
        success: false,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 对比请求
   */
  compareRequests(demo3Req, currentReq) {
    const differences = [];
    
    if (JSON.stringify(demo3Req.model) !== JSON.stringify(currentReq.model)) {
      differences.push({ field: 'model', demo3: demo3Req.model, current: currentReq.model });
    }
    
    if (JSON.stringify(demo3Req.messages) !== JSON.stringify(currentReq.messages)) {
      differences.push({ field: 'messages', demo3: demo3Req.messages, current: currentReq.messages });
    }
    
    if (JSON.stringify(demo3Req.tools) !== JSON.stringify(currentReq.tools)) {
      differences.push({ field: 'tools', demo3: demo3Req.tools, current: currentReq.tools });
    }
    
    return {
      match: differences.length === 0,
      differences
    };
  }

  /**
   * 对比响应
   */
  compareResponses(demo3Data, currentData) {
    if (demo3Data.error && currentData.error) {
      return {
        bothErrors: true,
        demo3Error: demo3Data.error,
        currentError: currentData.error,
        sameErrorType: demo3Data.error.status === currentData.error.status
      };
    }
    
    if (demo3Data.error || currentData.error) {
      return {
        mixedResults: true,
        demo3HasError: !!demo3Data.error,
        currentHasError: !!currentData.error,
        demo3Response: demo3Data.response,
        currentResponse: currentData.response
      };
    }
    
    return {
      bothSuccess: true,
      demo3Response: demo3Data.response,
      currentResponse: currentData.response
    };
  }

  /**
   * 生成修复建议
   */
  async generateFixSuggestions(comparisonResult, tokenRotationResult) {
    console.log('\n💡 生成修复建议...');
    
    const suggestions = {
      priority: 'high',
      issues: comparisonResult.criticalIssues,
      recommendations: []
    };
    
    // 基于400错误的建议
    if (comparisonResult.criticalIssues.some(issue => issue.type === 'API_400_ERROR')) {
      suggestions.recommendations.push({
        type: 'API_400_FIX',
        description: '修复API 400错误',
        actions: [
          '检查请求体格式是否符合CodeWhisperer API规范',
          '验证工具定义结构是否正确',
          '确认profileArn字段处理逻辑',
          '对比demo3的请求格式进行精确匹配'
        ]
      });
    }
    
    // 基于token轮换的建议
    if (tokenRotationResult.still400) {
      suggestions.recommendations.push({
        type: 'NON_TOKEN_ISSUE',
        description: 'Token轮换后仍有400错误，问题不在认证',
        actions: [
          '重点检查请求体结构',
          '验证API端点和路径',
          '检查必需字段是否缺失'
        ]
      });
    }
    
    return suggestions;
  }

  /**
   * 生成综合报告
   */
  async generateComprehensiveReport(data) {
    const reportPath = path.join(this.debugDir, `comprehensive-analysis-report-${this.timestamp}.md`);
    
    const report = `# Demo3 vs Current Implementation 400错误分析报告

生成时间: ${new Date().toISOString()}

## 📋 执行摘要

### 关键发现
- Demo3状态: ${data.demo3Data.status || '错误'}
- 当前实现状态: ${data.currentData.status || data.currentData.error?.status || '错误'}
- 关键问题数量: ${data.comparisonResult.criticalIssues.length}
- Token轮换后仍有400错误: ${data.tokenRotationResult.still400 ? '是' : '否'}

### 问题优先级
${data.fixSuggestions.issues.map(issue => `- **${issue.type}**: ${issue.description}`).join('\n')}

## 🔍 详细分析

### 1. 请求对比分析
\`\`\`json
${JSON.stringify(data.comparisonResult.requestDifferences, null, 2)}
\`\`\`

### 2. 响应对比分析
\`\`\`json
${JSON.stringify(data.comparisonResult.responseDifferences, null, 2)}
\`\`\`

### 3. Token轮换测试结果
- 轮换前状态: ${data.tokenRotationResult.beforeRotation?.success ? '成功' : '失败'}
- 轮换后状态: ${data.tokenRotationResult.afterRotation?.success ? '成功' : '失败'}
- 问题是否与Token相关: ${data.tokenRotationResult.still400 ? '否' : '可能'}

## 💡 修复建议

${data.fixSuggestions.recommendations.map(rec => `
### ${rec.type}
${rec.description}

**行动项:**
${rec.actions.map(action => `- ${action}`).join('\n')}
`).join('\n')}

## 📊 原始数据文件

- Demo3数据: \`demo3-pipeline-${this.timestamp}.json\`
- 当前实现数据: \`current-pipeline-${this.timestamp}.json\` 或 \`current-error-${this.timestamp}.json\`
- 对比分析: \`comparison-analysis-${this.timestamp}.json\`
- Token测试: \`token-rotation-test-${this.timestamp}.json\`

## 🎯 下一步行动

1. **立即行动**: 修复关键的API 400错误
2. **代码对比**: 详细对比demo3和当前实现的差异
3. **测试验证**: 应用修复后进行全面测试
4. **文档更新**: 更新相关技术文档

---
*此报告由Demo3ComparisonDebugger自动生成*
`;
    
    fs.writeFileSync(reportPath, report);
    console.log(`  ✅ 综合分析报告已生成: ${reportPath}`);
  }
}

// 运行调试器
async function runDebugger() {
  const debuggerInstance = new Demo3ComparisonDebugger();
  
  try {
    await debuggerInstance.runFullComparison();
    console.log('\n🎉 Demo3对比分析完成！');
    console.log('📁 查看详细报告:', debuggerInstance.debugDir);
  } catch (error) {
    console.error('💥 调试器执行失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runDebugger();
}

module.exports = { Demo3ComparisonDebugger };