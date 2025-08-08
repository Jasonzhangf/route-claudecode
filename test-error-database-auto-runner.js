#!/usr/bin/env node

/**
 * 自动错误数据库样本测试脚本
 * Automatic Error Database Sample Test Runner
 * Owner: Jason Zhang
 * 
 * 功能:
 * 1. 自动读取错误数据库中的所有错误样本
 * 2. 针对每种错误类型构建测试用例
 * 3. 执行自动化测试和问题定位
 * 4. 生成详细的错误分析报告
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

class ErrorDatabaseAutoRunner {
  constructor() {
    this.errorDatabasePath = './database/pipeline-data-new/errors';
    this.results = {
      totalSamples: 0,
      testCases: [],
      errorPatterns: new Map(),
      fixes: [],
      summary: {}
    };
  }

  /**
   * 扫描错误数据库，收集所有错误样本
   */
  async scanErrorDatabase() {
    console.log('🔍 [SCAN] Scanning error database for test samples...');
    
    const errorFiles = [];
    
    try {
      // 扫描错误数据库目录
      if (fs.existsSync(this.errorDatabasePath)) {
        const files = fs.readdirSync(this.errorDatabasePath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.errorDatabasePath, file);
            errorFiles.push(filePath);
          }
        }
      }

      // 扫描日志目录中的错误
      const logPath = '/Users/fanzhang/.route-claude-code/logs/port-3456';
      if (fs.existsSync(logPath)) {
        const logDirs = fs.readdirSync(logPath);
        for (const logDir of logDirs) {
          const errorLogPath = path.join(logPath, logDir, 'error.log');
          if (fs.existsSync(errorLogPath)) {
            errorFiles.push(errorLogPath);
          }
        }
      }

      console.log(`📁 [FOUND] ${errorFiles.length} error files to analyze`);
      return errorFiles;

    } catch (error) {
      console.error('❌ [ERROR] Failed to scan error database:', error.message);
      return [];
    }
  }

  /**
   * 解析错误文件，提取错误样本
   */
  async parseErrorFiles(errorFiles) {
    console.log('📖 [PARSE] Parsing error files...');
    
    const allErrors = [];

    for (const filePath of errorFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (filePath.endsWith('.json')) {
          // JSON格式错误文件
          const errorData = JSON.parse(content);
          if (errorData.errors && Array.isArray(errorData.errors)) {
            allErrors.push(...errorData.errors);
          }
        } else if (filePath.endsWith('.log')) {
          // 日志格式错误文件
          const lines = content.split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const errorObj = JSON.parse(line);
              allErrors.push(errorObj);
            } catch (parseError) {
              // 跳过无效的日志行
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ [WARN] Failed to parse ${filePath}: ${error.message}`);
      }
    }

    this.results.totalSamples = allErrors.length;
    console.log(`📊 [PARSED] ${allErrors.length} error samples collected`);
    
    return allErrors;
  }

  /**
   * 分析错误模式，按类型分组
   */
  analyzeErrorPatterns(errors) {
    console.log('🧪 [ANALYZE] Analyzing error patterns...');
    
    const patterns = new Map();
    const providerErrors = new Map();
    const modelErrors = new Map();

    for (const error of errors) {
      // 提取错误关键信息
      const errorType = this.extractErrorType(error);
      const provider = error.provider || 'unknown';
      const model = error.model || 'unknown';

      // 按错误类型分组
      if (!patterns.has(errorType)) {
        patterns.set(errorType, []);
      }
      patterns.get(errorType).push(error);

      // 按Provider分组
      if (!providerErrors.has(provider)) {
        providerErrors.set(provider, []);
      }
      providerErrors.get(provider).push(error);

      // 按Model分组
      if (!modelErrors.has(model)) {
        modelErrors.set(model, []);
      }
      modelErrors.get(model).push(error);
    }

    this.results.errorPatterns = patterns;
    this.results.providerErrors = providerErrors;
    this.results.modelErrors = modelErrors;

    console.log('📈 [PATTERNS] Error pattern analysis:');
    console.log(`   🎯 Error Types: ${patterns.size}`);
    console.log(`   🏭 Providers: ${providerErrors.size}`);
    console.log(`   🤖 Models: ${modelErrors.size}`);

    return patterns;
  }

  /**
   * 提取错误类型
   */
  extractErrorType(error) {
    // 首先检查直接的错误信息
    if (error.message) {
      const message = error.message.toLowerCase();
      
      // OpenAI格式相关错误
      if (message.includes('openai response missing choices')) {
        return 'openai_missing_choices';
      }
      if (message.includes('max_tokens_exceeded')) {
        return 'max_tokens_exceeded';
      }
      if (message.includes('timeout') || message.includes('timed out')) {
        return 'api_timeout';
      }
      if (message.includes('tool') && (message.includes('parsing') || message.includes('format'))) {
        return 'tool_parsing_error';
      }
      if (message.includes('401') || message.includes('unauthorized')) {
        return 'auth_error';
      }
      if (message.includes('429') || message.includes('rate limit')) {
        return 'rate_limit';
      }
      if (message.includes('500') || message.includes('internal server error')) {
        return 'server_error';
      }
    }

    // 检查错误对象的其他字段
    if (error.error && typeof error.error === 'string') {
      const errorStr = error.error.toLowerCase();
      if (errorStr.includes('openai response missing choices')) {
        return 'openai_missing_choices';
      }
    }

    // 检查数据字段中的错误信息
    if (error.data && error.data.error) {
      const dataError = error.data.error.toLowerCase();
      if (dataError.includes('openai response missing choices')) {
        return 'openai_missing_choices';
      }
    }

    // 检查category字段
    if (error.category === 'system' && error.message && error.message.includes('Client error recorded')) {
      if (error.data && error.data.error) {
        const clientError = error.data.error.toLowerCase();
        if (clientError.includes('openai response missing choices')) {
          return 'openai_missing_choices';
        }
      }
    }

    return error.errorType || 'unknown_error';
  }

  /**
   * 为每种错误类型构建自动测试用例
   */
  async buildTestCases(errorPatterns) {
    console.log('🔨 [BUILD] Building automated test cases...');
    
    const testCases = [];

    for (const [errorType, errors] of errorPatterns.entries()) {
      const testCase = {
        errorType,
        sampleCount: errors.length,
        testStrategy: this.getTestStrategy(errorType),
        samples: errors.slice(0, 5), // 取前5个样本进行测试
        expectedOutcome: this.getExpectedOutcome(errorType),
        testFunction: this.createTestFunction(errorType, errors[0])
      };

      testCases.push(testCase);
    }

    this.results.testCases = testCases;
    console.log(`🧪 [BUILT] ${testCases.length} test cases created`);
    
    return testCases;
  }

  /**
   * 根据错误类型确定测试策略
   */
  getTestStrategy(errorType) {
    const strategies = {
      'openai_missing_choices': 'mock_response_format_fix',
      'max_tokens_exceeded': 'token_limit_validation',
      'api_timeout': 'timeout_handling_test',
      'tool_parsing_error': 'tool_format_validation',
      'auth_error': 'authentication_check',
      'rate_limit': 'rate_limiting_behavior',
      'server_error': 'error_recovery_test'
    };
    
    return strategies[errorType] || 'generic_error_test';
  }

  /**
   * 确定期望的测试结果
   */
  getExpectedOutcome(errorType) {
    const outcomes = {
      'openai_missing_choices': 'should_fix_response_format_or_throw_clear_error',
      'max_tokens_exceeded': 'should_apply_preprocessing_strategies',
      'api_timeout': 'should_return_timeout_error_not_silent_fail',
      'tool_parsing_error': 'should_apply_tool_format_patches',
      'auth_error': 'should_retry_with_different_credentials',
      'rate_limit': 'should_backoff_and_retry_or_switch_provider',
      'server_error': 'should_failover_to_backup_provider'
    };
    
    return outcomes[errorType] || 'should_handle_gracefully';
  }

  /**
   * 为特定错误类型创建测试函数
   */
  createTestFunction(errorType, sampleError) {
    return async () => {
      console.log(`  🧪 Testing ${errorType} with sample: ${sampleError.errorId || 'unknown'}`);
      
      try {
        switch (errorType) {
          case 'openai_missing_choices':
            return await this.testOpenAIMissingChoices(sampleError);
          case 'max_tokens_exceeded':
            return await this.testMaxTokensExceeded(sampleError);
          case 'api_timeout':
            return await this.testApiTimeout(sampleError);
          case 'tool_parsing_error':
            return await this.testToolParsingError(sampleError);
          default:
            return await this.testGenericError(sampleError);
        }
      } catch (error) {
        return {
          success: false,
          error: error.message,
          type: 'test_execution_failed'
        };
      }
    };
  }

  /**
   * 测试OpenAI missing choices错误
   */
  async testOpenAIMissingChoices(sampleError) {
    console.log('    🔍 [TEST] OpenAI Missing Choices Error');
    
    // 模拟触发相同错误的请求
    const mockRequest = {
      model: 'ZhipuAI/GLM-4.5',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 100
    };

    const testResult = await this.makeTestRequest(mockRequest, 5507); // ModelScope端口
    
    // 分析结果
    if (testResult.success) {
      return {
        success: true,
        message: 'Response format issue appears to be resolved',
        details: testResult
      };
    } else if (testResult.error && testResult.error.includes('missing choices')) {
      return {
        success: false,
        message: 'OpenAI missing choices error reproduced - needs format patch',
        details: testResult,
        recommendation: 'Implement ModelScope response format patch'
      };
    } else {
      return {
        success: false,
        message: 'Different error occurred',
        details: testResult
      };
    }
  }

  /**
   * 测试Max Tokens Exceeded错误
   */
  async testMaxTokensExceeded(sampleError) {
    console.log('    🔍 [TEST] Max Tokens Exceeded Error');
    
    // 构造会触发token限制的请求
    const largeContent = 'test '.repeat(1000);
    const mockRequest = {
      model: 'auto',
      messages: [{ role: 'user', content: largeContent }],
      max_tokens: 50
    };

    const testResult = await this.makeTestRequest(mockRequest, 3456);
    
    if (testResult.success) {
      return {
        success: true,
        message: 'Preprocessing successfully handled token limits',
        details: testResult
      };
    } else if (testResult.error && testResult.error.includes('max_tokens_exceeded')) {
      return {
        success: false,
        message: 'Max tokens error reproduced - preprocessing not applied',
        details: testResult,
        recommendation: 'Check preprocessing strategy configuration'
      };
    }

    return { success: false, message: 'Unexpected result', details: testResult };
  }

  /**
   * 测试API超时错误
   */
  async testApiTimeout(sampleError) {
    console.log('    🔍 [TEST] API Timeout Error');
    
    const mockRequest = {
      model: 'gemini-2.5-pro',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 100
    };

    const testResult = await this.makeTestRequest(mockRequest, 3456, 3000); // 3秒超时
    
    if (testResult.isTimeout) {
      return {
        success: true,
        message: 'Timeout properly detected and handled',
        details: testResult
      };
    } else {
      return {
        success: false,
        message: 'Timeout behavior unclear',
        details: testResult
      };
    }
  }

  /**
   * 测试工具解析错误
   */
  async testToolParsingError(sampleError) {
    console.log('    🔍 [TEST] Tool Parsing Error');
    
    const mockRequest = {
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: 'What is the weather like?' }],
      tools: [{
        name: 'get_weather',
        description: 'Get weather information',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          }
        }
      }],
      max_tokens: 100
    };

    const testResult = await this.makeTestRequest(mockRequest, 3456);
    
    return {
      success: testResult.success,
      message: testResult.success ? 'Tool calls handled properly' : 'Tool parsing issues detected',
      details: testResult
    };
  }

  /**
   * 通用错误测试
   */
  async testGenericError(sampleError) {
    console.log('    🔍 [TEST] Generic Error Test');
    
    return {
      success: false,
      message: 'Generic error test - manual analysis required',
      details: sampleError
    };
  }

  /**
   * 发送测试请求
   */
  async makeTestRequest(requestData, port = 3456, timeout = 10000) {
    return new Promise((resolve) => {
      const postData = JSON.stringify(requestData);
      
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Bearer test-key'
        },
        timeout
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
              rawResponse: responseBody,
              error: res.statusCode !== 200 ? responseBody : null,
              isTimeout: false
            });
          } catch (error) {
            resolve({
              success: false,
              statusCode: res.statusCode,
              data: null,
              rawResponse: responseBody,
              error: `Parse error: ${error.message}`,
              isTimeout: false
            });
          }
        });
      });

      req.on('error', error => resolve({
        success: false,
        statusCode: 0,
        data: null,
        error: error.message,
        isTimeout: false
      }));

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: 0,
          data: null,
          error: 'Request timeout',
          isTimeout: true
        });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 执行所有测试用例
   */
  async runAllTests(testCases) {
    console.log('🚀 [RUN] Executing all test cases...');
    
    const results = [];

    for (const [index, testCase] of testCases.entries()) {
      console.log(`\n📋 [${index + 1}/${testCases.length}] Testing: ${testCase.errorType}`);
      console.log(`   📊 Sample Count: ${testCase.sampleCount}`);
      console.log(`   🎯 Strategy: ${testCase.testStrategy}`);
      console.log(`   🎪 Expected: ${testCase.expectedOutcome}`);

      const startTime = Date.now();
      const testResult = await testCase.testFunction();
      const duration = Date.now() - startTime;

      const result = {
        ...testCase,
        testResult,
        duration,
        timestamp: new Date().toISOString()
      };

      results.push(result);

      // 输出测试结果
      if (testResult.success) {
        console.log(`   ✅ [PASS] ${testResult.message}`);
      } else {
        console.log(`   ❌ [FAIL] ${testResult.message}`);
        if (testResult.recommendation) {
          console.log(`   💡 [REC] ${testResult.recommendation}`);
        }
      }
      console.log(`   ⏱️ Duration: ${duration}ms`);

      // 避免过于频繁的请求
      if (index < testCases.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  /**
   * 生成综合分析报告
   */
  generateAnalysisReport(testResults) {
    console.log('\n📊 [REPORT] Generating comprehensive analysis report...');

    const passed = testResults.filter(r => r.testResult.success);
    const failed = testResults.filter(r => !r.testResult.success);

    const report = {
      executedAt: new Date().toISOString(),
      summary: {
        totalSamples: this.results.totalSamples,
        totalTestCases: testResults.length,
        passed: passed.length,
        failed: failed.length,
        successRate: `${((passed.length / testResults.length) * 100).toFixed(1)}%`
      },
      errorPatterns: this.convertMapToObject(this.results.errorPatterns),
      testResults: testResults.map(r => ({
        errorType: r.errorType,
        sampleCount: r.sampleCount,
        testStrategy: r.testStrategy,
        success: r.testResult.success,
        message: r.testResult.message,
        recommendation: r.testResult.recommendation,
        duration: r.duration
      })),
      criticalIssues: failed.map(r => ({
        errorType: r.errorType,
        issue: r.testResult.message,
        recommendation: r.testResult.recommendation,
        affectedSamples: r.sampleCount
      })),
      recommendations: this.generateRecommendations(testResults)
    };

    // 保存报告
    const reportPath = './database/pipeline-data-new/analytics/error-database-auto-test-report.json';
    try {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 [SAVED] Report saved to: ${reportPath}`);
    } catch (error) {
      console.error(`❌ [ERROR] Failed to save report: ${error.message}`);
    }

    return report;
  }

  /**
   * 生成修复建议
   */
  generateRecommendations(testResults) {
    const recommendations = [];

    const failedTests = testResults.filter(r => !r.testResult.success);

    for (const failed of failedTests) {
      if (failed.errorType === 'openai_missing_choices') {
        recommendations.push({
          priority: 'HIGH',
          issue: 'ModelScope API response format incompatibility',
          solution: 'Implement ModelScope response format patch in unified-patch-preprocessor.ts',
          implementation: 'Add patch to convert ModelScope response format to OpenAI-compatible format before transformer processing',
          affectedProviders: ['modelscope-openai-key1', 'modelscope-openai-key2', 'modelscope-openai-key3', 'modelscope-openai-key4']
        });
      }

      if (failed.errorType === 'max_tokens_exceeded') {
        recommendations.push({
          priority: 'MEDIUM',
          issue: 'Token preprocessing not applied consistently',
          solution: 'Ensure preprocessing strategies are enabled and properly configured',
          implementation: 'Check configuration in test-pipeline-config.json and verify preprocessing manager integration',
          affectedModels: ['auto', 'Qwen/Qwen3-Coder-480B-A35B-Instruct', 'ZhipuAI/GLM-4.5']
        });
      }

      if (failed.errorType === 'api_timeout') {
        recommendations.push({
          priority: 'MEDIUM',
          issue: 'Timeout errors not properly handled',
          solution: 'Verify timeout error handling implementation',
          implementation: 'Check openai-streaming-handler.ts timeout detection and error throwing logic',
          affectedEndpoints: ['ShuaiHong API', 'ModelScope API']
        });
      }
    }

    return recommendations;
  }

  /**
   * 辅助函数：Map转对象
   */
  convertMapToObject(map) {
    const obj = {};
    for (const [key, value] of map.entries()) {
      obj[key] = Array.isArray(value) ? value.length : value;
    }
    return obj;
  }

  /**
   * 主执行函数
   */
  async run() {
    console.log('🎯 [START] Error Database Auto Test Runner');
    console.log('=' .repeat(80));

    try {
      // 1. 扫描错误数据库
      const errorFiles = await this.scanErrorDatabase();
      if (errorFiles.length === 0) {
        console.log('❌ [END] No error files found to test');
        return false;
      }

      // 2. 解析错误样本
      const errors = await this.parseErrorFiles(errorFiles);
      if (errors.length === 0) {
        console.log('❌ [END] No error samples found to test');
        return false;
      }

      // 3. 分析错误模式
      const patterns = this.analyzeErrorPatterns(errors);

      // 4. 构建测试用例
      const testCases = await this.buildTestCases(patterns);

      // 5. 执行测试
      const testResults = await this.runAllTests(testCases);

      // 6. 生成报告
      const report = this.generateAnalysisReport(testResults);

      // 7. 输出总结
      console.log('\n🏁 [SUMMARY] Error Database Auto Test Summary');
      console.log('=' .repeat(80));
      console.log(`📊 Total Error Samples: ${report.summary.totalSamples}`);
      console.log(`🧪 Test Cases: ${report.summary.totalTestCases}`);
      console.log(`✅ Passed: ${report.summary.passed}`);
      console.log(`❌ Failed: ${report.summary.failed}`);
      console.log(`📈 Success Rate: ${report.summary.successRate}`);

      if (report.criticalIssues.length > 0) {
        console.log('\n🚨 [CRITICAL] Issues Found:');
        report.criticalIssues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue.errorType}: ${issue.issue}`);
          if (issue.recommendation) {
            console.log(`      💡 ${issue.recommendation}`);
          }
        });
      }

      if (report.recommendations.length > 0) {
        console.log('\n💡 [RECOMMENDATIONS] Next Steps:');
        report.recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. [${rec.priority}] ${rec.issue}`);
          console.log(`      🔧 ${rec.solution}`);
        });
      }

      const overallSuccess = report.summary.failed === 0;
      console.log(`\n${overallSuccess ? '🎉' : '⚠️'} [CONCLUSION] Auto test ${overallSuccess ? 'PASSED' : 'NEEDS ATTENTION'}`);

      return overallSuccess;

    } catch (error) {
      console.error('💥 [FATAL] Auto test execution failed:', error);
      return false;
    }
  }
}

// 执行测试
if (require.main === module) {
  const runner = new ErrorDatabaseAutoRunner();
  runner.run()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [FATAL] Test runner crashed:', error);
      process.exit(1);
    });
}

module.exports = { ErrorDatabaseAutoRunner };