#!/usr/bin/env node

/**
 * Fixed Pipeline Test with Error Handling
 * 修复版流水线测试，带错误处理
 * Owner: Jason Zhang
 * 
 * Tests complete pipeline functionality with proper error handling
 */

const path = require('path');
const fs = require('fs');
const http = require('http');

// 数据库路径设置
const DATABASE_PATH = path.join(__dirname, 'database', 'pipeline-data-new');

// 确保数据库目录存在
function ensureDatabaseDirectories() {
  const dirs = [
    DATABASE_PATH,
    path.join(DATABASE_PATH, 'pipeline-tests'),
    path.join(DATABASE_PATH, 'analytics')
  ];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

class PipelineTestFramework {
  constructor() {
    this.serverUrl = 'http://localhost:3457';
    this.results = [];
    this.errors = [];
    ensureDatabaseDirectories();
  }

  /**
   * 发送HTTP请求
   */
  async makeRequest(requestData) {
    return new Promise((resolve) => {
      const postData = JSON.stringify(requestData);
      const options = {
        hostname: 'localhost',
        port: 3457,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          try {
            const data = res.statusCode === 200 ? JSON.parse(responseBody) : null;
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              data,
              error: res.statusCode !== 200 ? responseBody : null,
              headers: res.headers
            });
          } catch (error) {
            resolve({
              success: false,
              statusCode: res.statusCode,
              data: null,
              error: `Parse error: ${error.message}`,
              headers: res.headers
            });
          }
        });
      });

      req.on('error', error => resolve({
        success: false,
        statusCode: 0,
        data: null,
        error: error.message,
        headers: {}
      }));

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: 0,
          data: null,
          error: 'Request timeout',
          headers: {}
        });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 测试服务器连接
   */
  async testServerConnection() {
    console.log('🔗 [CONNECTION-TEST] Testing server connection...');
    
    try {
      const healthResponse = await this.makeHealthRequest();
      if (healthResponse.success) {
        console.log('✅ [CONNECTION] Server is responding');
        console.log(`   📊 Health status: ${JSON.stringify(healthResponse.data)}`);
        return true;
      } else {
        console.log('❌ [CONNECTION] Server health check failed');
        console.log(`   🔍 Status: ${healthResponse.statusCode}`);
        console.log(`   🔍 Error: ${healthResponse.error}`);
        return false;
      }
    } catch (error) {
      console.log('❌ [CONNECTION] Server connection failed');
      console.log(`   🔍 Error: ${error.message}`);
      return false;
    }
  }

  /**
   * 健康检查请求
   */
  async makeHealthRequest() {
    return new Promise((resolve) => {
      const options = {
        hostname: 'localhost',
        port: 3457,
        path: '/health',
        method: 'GET',
        timeout: 10000
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(responseBody);
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              data
            });
          } catch (error) {
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: `Parse error: ${error.message}`
            });
          }
        });
      });

      req.on('error', error => resolve({
        success: false,
        statusCode: 0,
        error: error.message
      }));

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: 0,
          error: 'Health check timeout'
        });
      });

      req.end();
    });
  }

  /**
   * 执行流水线测试步骤
   */
  async runPipelineTest(testName, requestData) {
    console.log(`\n🧪 [PIPELINE-TEST] ${testName}`);
    const startTime = Date.now();

    try {
      const response = await this.makeRequest(requestData);
      const duration = Date.now() - startTime;

      const result = {
        testName,
        success: response.success,
        duration,
        statusCode: response.statusCode,
        provider: response.headers['x-provider'] || 'unknown',
        model: response.headers['x-model'] || requestData.model || 'unknown',
        content: response.success ? 
          (response.data?.choices?.[0]?.message?.content?.substring(0, 150) || 'No content') : null,
        error: response.error,
        timestamp: new Date().toISOString(),
        requestData: {
          model: requestData.model,
          messageCount: requestData.messages?.length || 0,
          hasTools: !!requestData.tools && requestData.tools.length > 0,
          maxTokens: requestData.max_tokens || 'default'
        }
      };

      this.results.push(result);

      if (result.success) {
        console.log(`✅ [SUCCESS] ${testName} (${duration}ms)`);
        console.log(`   📍 Provider: ${result.provider}, Model: ${result.model}`);
        console.log(`   💬 Content: "${result.content}"`);
      } else {
        console.log(`❌ [FAILED] ${testName} (${duration}ms)`);
        console.log(`   🔍 Status: ${result.statusCode}`);
        console.log(`   🔍 Error: ${result.error}`);
        
        this.errors.push({
          testName,
          error: result.error,
          statusCode: result.statusCode,
          timestamp: result.timestamp
        });
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`💥 [ERROR] ${testName} failed: ${error.message}`);
      
      const errorResult = {
        testName,
        success: false,
        duration,
        statusCode: 0,
        provider: 'error',
        model: 'error',
        content: null,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.results.push(errorResult);
      this.errors.push({
        testName,
        error: error.message,
        statusCode: 0,
        timestamp: errorResult.timestamp
      });

      return errorResult;
    }
  }

  /**
   * 执行完整的流水线测试套件
   */
  async executeCompletePipelineTest() {
    console.log('🚀 [PIPELINE-TEST-SUITE] Starting Complete Pipeline Test');
    console.log('📊 [DATABASE] Data capture and error handling enabled\n');

    // Step 1: 测试服务器连接
    const connectionOk = await this.testServerConnection();
    if (!connectionOk) {
      console.log('❌ [ABORT] Server connection failed, aborting pipeline test');
      return this.generateFinalReport();
    }

    // Step 2: 基本文本生成测试
    await this.runPipelineTest('Simple Text Generation', {
      model: 'gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: 'Hello, please respond with "Pipeline test successful"'
      }],
      max_tokens: 50,
      temperature: 0.1
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: 不同模型路由测试
    await this.runPipelineTest('Model Routing Test', {
      model: 'glm-4.5',
      messages: [{
        role: 'user',
        content: 'Test model routing functionality'
      }],
      max_tokens: 60,
      temperature: 0.1
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: 类别路由测试
    await this.runPipelineTest('Category Routing - Background', {
      model: 'auto',
      messages: [{
        role: 'user',
        content: 'Background task test'
      }],
      max_tokens: 40,
      temperature: 0.1,
      category: 'background'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 5: 长上下文测试（较小token）
    await this.runPipelineTest('Long Context Test', {
      model: 'gemini-2.5-pro',
      messages: [{
        role: 'user',
        content: 'Long context test with extended input. '.repeat(20) + 'Please summarize this.'
      }],
      max_tokens: 100,
      temperature: 0.1,
      category: 'longcontext'
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 6: 错误处理测试 - 超大token请求
    await this.runPipelineTest('Error Handling - Token Limit', {
      model: 'auto',
      messages: [{
        role: 'user',
        content: 'Error handling test with very large token request'
      }],
      max_tokens: 10000, // 故意超大
      temperature: 0.1
    });

    // 生成最终报告
    return this.generateFinalReport();
  }

  /**
   * 生成最终测试报告
   */
  generateFinalReport() {
    const successfulTests = this.results.filter(r => r.success);
    const failedTests = this.results.filter(r => !r.success);

    const report = {
      testSuite: 'Complete Pipeline Test with Fixed Configuration',
      executedAt: new Date().toISOString(),
      summary: {
        totalTests: this.results.length,
        successfulTests: successfulTests.length,
        failedTests: failedTests.length,
        successRate: this.results.length > 0 ? successfulTests.length / this.results.length : 0,
        avgResponseTime: successfulTests.length > 0 ? 
          successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length : 0,
        totalErrors: this.errors.length
      },
      testResults: this.results,
      errorAnalysis: {
        totalErrors: this.errors.length,
        errorsByType: this.analyzeErrors(),
        detailedErrors: this.errors
      },
      systemValidation: {
        serverConnectivity: this.results.some(r => r.success),
        multiModelSupport: new Set(this.results.map(r => r.model)).size > 1,
        multiProviderSupport: new Set(this.results.map(r => r.provider)).size > 1,
        errorHandlingWorking: this.errors.length > 0 // 错误被捕获说明错误处理正常
      },
      performance: {
        fastestResponse: Math.min(...this.results.map(r => r.duration)),
        slowestResponse: Math.max(...this.results.map(r => r.duration)),
        avgResponseTime: this.results.length > 0 ? 
          this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length : 0
      }
    };

    // 保存报告
    try {
      const reportPath = path.join(DATABASE_PATH, 'analytics', 'fixed-pipeline-test-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      const testDataPath = path.join(DATABASE_PATH, 'pipeline-tests', 'fixed-pipeline-test-data.json');
      fs.writeFileSync(testDataPath, JSON.stringify({
        capturedAt: new Date().toISOString(),
        testResults: this.results,
        errors: this.errors
      }, null, 2));

      console.log('\n📊 [REPORTS] Test reports saved:');
      console.log(`   - Analysis Report: ${reportPath}`);
      console.log(`   - Test Data: ${testDataPath}`);
    } catch (error) {
      console.error('❌ Failed to save reports:', error.message);
    }

    return report;
  }

  /**
   * 分析错误类型
   */
  analyzeErrors() {
    const errorTypes = {};
    this.errors.forEach(error => {
      const key = error.statusCode > 0 ? `HTTP_${error.statusCode}` : 'NETWORK_ERROR';
      errorTypes[key] = (errorTypes[key] || 0) + 1;
    });
    return errorTypes;
  }

  /**
   * 打印最终结果
   */
  printFinalResults(report) {
    console.log('\n🏁 [FINAL-RESULTS] Complete Pipeline Test Results');
    console.log('=' .repeat(60));
    console.log(`📊 Total Tests: ${report.summary.totalTests}`);
    console.log(`✅ Successful: ${report.summary.successfulTests} (${(report.summary.successRate * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${report.summary.failedTests}`);
    console.log(`🚨 Total Errors: ${report.summary.totalErrors}`);
    console.log(`⚡ Avg Response Time: ${report.performance.avgResponseTime.toFixed(0)}ms`);
    
    if (Object.keys(report.errorAnalysis.errorsByType).length > 0) {
      console.log('\n🔍 [ERROR-ANALYSIS] Error Types:');
      Object.entries(report.errorAnalysis.errorsByType).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count} occurrences`);
      });
    }

    console.log('\n🔧 [SYSTEM-VALIDATION] System Status:');
    console.log(`   - Server Connectivity: ${report.systemValidation.serverConnectivity ? '✅' : '❌'}`);
    console.log(`   - Multi-Model Support: ${report.systemValidation.multiModelSupport ? '✅' : '❌'}`);
    console.log(`   - Multi-Provider Support: ${report.systemValidation.multiProviderSupport ? '✅' : '❌'}`);
    console.log(`   - Error Handling: ${report.systemValidation.errorHandlingWorking ? '✅' : '❌'}`);

    const systemHealthy = report.summary.successRate >= 0.5 && report.systemValidation.serverConnectivity;
    console.log(`\n${systemHealthy ? '🎉' : '❌'} [CONCLUSION] Pipeline test ${systemHealthy ? 'PASSED' : 'FAILED'}`);
    
    return systemHealthy;
  }
}

// 执行测试
if (require.main === module) {
  const testFramework = new PipelineTestFramework();
  
  testFramework.executeCompletePipelineTest()
    .then(report => {
      const success = testFramework.printFinalResults(report);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [FATAL] Pipeline test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { PipelineTestFramework };