#!/usr/bin/env node

/**
 * Load Balance Error Handling and Data Capture Test
 * 负载均衡错误处理和数据捕获测试
 * Owner: Jason Zhang
 * 
 * Tests load balancing with comprehensive error handling and database capture
 * 测试负载均衡的全面错误处理和数据库捕获功能
 */

const path = require('path');
const fs = require('fs');
const http = require('http');

// 数据库路径设置
const DATABASE_PATH = path.join(__dirname, 'database', 'pipeline-data-new');
const ERROR_DATABASE_PATH = path.join(DATABASE_PATH, 'errors');
const LOAD_BALANCE_PATH = path.join(DATABASE_PATH, 'load-balance');

// 确保数据库目录存在
function ensureDatabaseDirectories() {
  const dirs = [DATABASE_PATH, ERROR_DATABASE_PATH, LOAD_BALANCE_PATH];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// 错误处理模块
class ErrorCaptureModule {
  constructor() {
    this.errorLog = [];
    this.requestLog = [];
    ensureDatabaseDirectories();
  }

  /**
   * 捕获错误数据到数据库
   */
  captureError(errorData) {
    const timestamp = new Date().toISOString();
    const errorRecord = {
      timestamp,
      errorId: this.generateErrorId(),
      ...errorData
    };

    this.errorLog.push(errorRecord);
    
    console.log(`🚨 [ERROR-CAPTURE] ${errorRecord.errorType}: ${errorRecord.message}`);
    console.log(`   📍 Provider: ${errorRecord.provider || 'unknown'}`);
    console.log(`   📍 Model: ${errorRecord.model || 'unknown'}`);
    console.log(`   📍 Request ID: ${errorRecord.requestId || 'unknown'}`);
    
    // 立即保存到数据库文件
    this.saveErrorsToDatabase();
    
    return errorRecord.errorId;
  }

  /**
   * 捕获请求数据
   */
  captureRequest(requestData) {
    const timestamp = new Date().toISOString();
    const requestRecord = {
      timestamp,
      requestId: requestData.requestId || this.generateRequestId(),
      ...requestData
    };

    this.requestLog.push(requestRecord);
    
    if (requestData.success) {
      console.log(`✅ [REQUEST-CAPTURE] Success: ${requestRecord.provider}/${requestRecord.model} (${requestRecord.responseTime}ms)`);
    } else {
      console.log(`❌ [REQUEST-CAPTURE] Failed: ${requestRecord.provider}/${requestRecord.model} - ${requestRecord.error}`);
    }
    
    return requestRecord.requestId;
  }

  /**
   * 生成错误ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成请求ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 保存错误数据到数据库
   */
  saveErrorsToDatabase() {
    try {
      const errorFilePath = path.join(ERROR_DATABASE_PATH, 'load-balance-errors.json');
      fs.writeFileSync(errorFilePath, JSON.stringify({
        capturedAt: new Date().toISOString(),
        totalErrors: this.errorLog.length,
        errors: this.errorLog
      }, null, 2));
    } catch (error) {
      console.error('❌ Failed to save errors to database:', error.message);
    }
  }

  /**
   * 保存请求数据到数据库
   */
  saveRequestsToDatabase() {
    try {
      const requestFilePath = path.join(LOAD_BALANCE_PATH, 'load-balance-requests.json');
      fs.writeFileSync(requestFilePath, JSON.stringify({
        capturedAt: new Date().toISOString(),
        totalRequests: this.requestLog.length,
        successfulRequests: this.requestLog.filter(r => r.success).length,
        failedRequests: this.requestLog.filter(r => !r.success).length,
        requests: this.requestLog
      }, null, 2));
    } catch (error) {
      console.error('❌ Failed to save requests to database:', error.message);
    }
  }

  /**
   * 生成错误分析报告
   */
  generateErrorAnalysis() {
    const errorTypes = {};
    const providerErrors = {};
    const modelErrors = {};

    this.errorLog.forEach(error => {
      // 按错误类型统计
      errorTypes[error.errorType] = (errorTypes[error.errorType] || 0) + 1;
      
      // 按provider统计
      if (error.provider) {
        providerErrors[error.provider] = (providerErrors[error.provider] || 0) + 1;
      }
      
      // 按model统计
      if (error.model) {
        modelErrors[error.model] = (modelErrors[error.model] || 0) + 1;
      }
    });

    return {
      totalErrors: this.errorLog.length,
      errorTypes,
      providerErrors,
      modelErrors,
      errorRate: this.requestLog.length > 0 ? this.errorLog.length / this.requestLog.length : 0
    };
  }

  /**
   * 生成请求分析报告
   */
  generateRequestAnalysis() {
    const successful = this.requestLog.filter(r => r.success);
    const failed = this.requestLog.filter(r => !r.success);
    
    const providerStats = {};
    const modelStats = {};
    
    this.requestLog.forEach(req => {
      if (req.provider) {
        if (!providerStats[req.provider]) {
          providerStats[req.provider] = { total: 0, success: 0, failed: 0, avgResponseTime: 0 };
        }
        providerStats[req.provider].total++;
        if (req.success) {
          providerStats[req.provider].success++;
          if (req.responseTime) {
            providerStats[req.provider].avgResponseTime += req.responseTime;
          }
        } else {
          providerStats[req.provider].failed++;
        }
      }

      if (req.model) {
        if (!modelStats[req.model]) {
          modelStats[req.model] = { total: 0, success: 0, failed: 0 };
        }
        modelStats[req.model].total++;
        if (req.success) {
          modelStats[req.model].success++;
        } else {
          modelStats[req.model].failed++;
        }
      }
    });

    // 计算平均响应时间
    Object.keys(providerStats).forEach(provider => {
      if (providerStats[provider].success > 0) {
        providerStats[provider].avgResponseTime = Math.round(
          providerStats[provider].avgResponseTime / providerStats[provider].success
        );
      }
    });

    return {
      totalRequests: this.requestLog.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      successRate: this.requestLog.length > 0 ? successful.length / this.requestLog.length : 0,
      avgResponseTime: successful.length > 0 ? 
        successful.reduce((sum, r) => sum + (r.responseTime || 0), 0) / successful.length : 0,
      providerStats,
      modelStats
    };
  }

  /**
   * 保存综合分析报告
   */
  saveFinalReport() {
    const errorAnalysis = this.generateErrorAnalysis();
    const requestAnalysis = this.generateRequestAnalysis();
    
    const report = {
      testSuite: 'Load Balance Error Handling Test',
      executedAt: new Date().toISOString(),
      summary: {
        totalRequests: requestAnalysis.totalRequests,
        successfulRequests: requestAnalysis.successfulRequests,
        failedRequests: requestAnalysis.failedRequests,
        totalErrors: errorAnalysis.totalErrors,
        successRate: requestAnalysis.successRate,
        errorRate: errorAnalysis.errorRate,
        avgResponseTime: requestAnalysis.avgResponseTime
      },
      errorAnalysis,
      requestAnalysis,
      loadBalanceValidation: {
        multiProviderUsed: Object.keys(requestAnalysis.providerStats).length > 1,
        distributionWorking: this.validateDistribution(requestAnalysis.providerStats),
        errorHandlingWorking: errorAnalysis.totalErrors > 0 // 如果有错误且被捕获，说明错误处理正常
      }
    };

    try {
      const reportPath = path.join(DATABASE_PATH, 'analytics', 'load-balance-error-handling-report.json');
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 [REPORT] Comprehensive report saved to: ${reportPath}`);
      return report;
    } catch (error) {
      console.error('❌ Failed to save final report:', error.message);
      return report;
    }
  }

  /**
   * 验证负载均衡分布
   */
  validateDistribution(providerStats) {
    const providerCounts = Object.values(providerStats).map(stat => stat.total);
    if (providerCounts.length < 2) return false;
    
    const max = Math.max(...providerCounts);
    const min = Math.min(...providerCounts);
    const variance = max - min;
    const total = providerCounts.reduce((sum, count) => sum + count, 0);
    
    // 如果方差相对于总数不超过50%，认为分布较为均匀
    return variance / total <= 0.5;
  }
}

// 负载均衡测试类
class LoadBalanceTest {
  constructor() {
    this.errorCapture = new ErrorCaptureModule();
    this.serverUrl = 'http://localhost:3456';
  }

  /**
   * 执行负载均衡请求
   */
  async makeLoadBalancedRequest(requestData, category = 'default') {
    const requestId = this.errorCapture.generateRequestId();
    const startTime = Date.now();

    try {
      const requestBody = JSON.stringify({
        ...requestData,
        category // 添加路由类别
      });

      const response = await this.httpRequest({
        hostname: 'localhost',
        port: 3456,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody),
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      }, requestBody);

      const responseTime = Date.now() - startTime;
      
      const requestRecord = {
        requestId,
        category,
        success: response.success,
        responseTime,
        provider: response.headers['x-provider'] || 'unknown',
        model: response.headers['x-model'] || 'unknown',
        statusCode: response.statusCode,
        content: response.success ? (response.data?.choices?.[0]?.message?.content?.substring(0, 100) || 'No content') : null,
        error: response.success ? null : response.error
      };

      this.errorCapture.captureRequest(requestRecord);

      if (!response.success) {
        this.errorCapture.captureError({
          requestId,
          errorType: 'api_request_failed',
          message: response.error || 'Unknown API error',
          provider: requestRecord.provider,
          model: requestRecord.model,
          category,
          statusCode: response.statusCode,
          responseTime
        });
      }

      return requestRecord;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const requestRecord = {
        requestId,
        category,
        success: false,
        responseTime,
        provider: 'error',
        model: 'error',
        statusCode: 0,
        content: null,
        error: error.message
      };

      this.errorCapture.captureRequest(requestRecord);
      this.errorCapture.captureError({
        requestId,
        errorType: 'network_error',
        message: error.message,
        provider: 'unknown',
        model: 'unknown',
        category,
        responseTime
      });

      return requestRecord;
    }
  }

  /**
   * HTTP请求工具函数
   */
  httpRequest(options, postData) {
    return new Promise((resolve) => {
      const req = http.request(options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const data = JSON.parse(responseBody);
              resolve({
                success: true,
                statusCode: res.statusCode,
                headers: res.headers,
                data
              });
            } else {
              resolve({
                success: false,
                statusCode: res.statusCode,
                headers: res.headers,
                error: `HTTP ${res.statusCode}: ${responseBody}`
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              statusCode: res.statusCode,
              headers: res.headers,
              error: `Parse error: ${parseError.message}`
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          statusCode: 0,
          headers: {},
          error: error.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: 0,
          headers: {},
          error: 'Request timeout'
        });
      });

      if (postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  /**
   * 执行负载均衡测试
   */
  async runLoadBalanceTest() {
    console.log('🚀 [LOAD-BALANCE-TEST] Starting comprehensive load balance test with error handling');
    console.log('📊 [DATABASE] Error capture and data logging enabled\n');

    // 测试场景
    const testScenarios = [
      {
        name: 'Default Category Load Balance',
        category: 'default',
        requests: 8,
        message: 'Test default routing load balance distribution'
      },
      {
        name: 'Background Category Load Balance',
        category: 'background',
        requests: 6,
        message: 'Test background tasks load balance'
      },
      {
        name: 'Thinking Category Load Balance',
        category: 'thinking',
        requests: 4,
        message: 'Complex reasoning task for load balance validation'
      },
      {
        name: 'Long Context Load Balance',
        category: 'longcontext',
        requests: 3,
        message: 'Long context test with large content. '.repeat(50) // 长文本
      }
    ];

    let totalRequests = 0;
    let successfulRequests = 0;

    for (const scenario of testScenarios) {
      console.log(`\n🎯 [TEST-SCENARIO] ${scenario.name} (${scenario.requests} requests)`);
      
      for (let i = 0; i < scenario.requests; i++) {
        const requestData = {
          model: 'auto', // 让路由器决定
          messages: [{
            role: 'user',
            content: `${scenario.message} - Request ${i + 1}`
          }],
          max_tokens: scenario.category === 'longcontext' ? 200 : 100,
          temperature: 0.1
        };

        const result = await this.makeLoadBalancedRequest(requestData, scenario.category);
        totalRequests++;
        
        if (result.success) {
          successfulRequests++;
        }

        // 延迟避免过载
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 保存数据和生成报告
    console.log('\n📊 [FINALIZATION] Saving data and generating reports...');
    this.errorCapture.saveRequestsToDatabase();
    this.errorCapture.saveErrorsToDatabase();
    const finalReport = this.errorCapture.saveFinalReport();

    // 输出测试总结
    console.log('\n🏁 [RESULTS] Load Balance Test with Error Handling Complete');
    console.log(`   📈 Total Requests: ${totalRequests}`);
    console.log(`   ✅ Successful: ${successfulRequests} (${((successfulRequests / totalRequests) * 100).toFixed(1)}%)`);
    console.log(`   ❌ Failed: ${totalRequests - successfulRequests}`);
    console.log(`   🚨 Errors Captured: ${finalReport.errorAnalysis.totalErrors}`);
    console.log(`   ⚖️ Load Balance Working: ${finalReport.loadBalanceValidation.distributionWorking ? '✅' : '❌'}`);
    console.log(`   🔧 Error Handling Working: ${finalReport.loadBalanceValidation.errorHandlingWorking ? '✅' : '❌'}`);

    if (Object.keys(finalReport.requestAnalysis.providerStats).length > 0) {
      console.log('\n📊 [PROVIDER-STATS] Load Balance Distribution:');
      Object.entries(finalReport.requestAnalysis.providerStats).forEach(([provider, stats]) => {
        console.log(`   - ${provider}: ${stats.success}/${stats.total} (${((stats.success / stats.total) * 100).toFixed(1)}%) avg ${stats.avgResponseTime}ms`);
      });
    }

    return finalReport;
  }
}

// 执行测试
if (require.main === module) {
  const test = new LoadBalanceTest();
  test.runLoadBalanceTest()
    .then(report => {
      const success = report.summary.successRate >= 0.5 && report.loadBalanceValidation.multiProviderUsed;
      console.log(`\n${success ? '🎉' : '❌'} [FINAL] Load balance test with error handling ${success ? 'PASSED' : 'FAILED'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [FATAL] Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { LoadBalanceTest, ErrorCaptureModule };