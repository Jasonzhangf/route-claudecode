#!/usr/bin/env node

/**
 * CodeWhisperer Complete Response Tracing Test
 * 完整跟踪CodeWhisperer响应链路，定位90秒无响应问题
 * 
 * 测试目标：
 * 1. 完整跟踪从请求发送到响应接收的每个节点
 * 2. 记录每个节点的耗时和状态
 * 3. 定位数据在哪个节点停滞或超时
 * 4. 分析90秒无响应的具体原因
 */

const axios = require('axios');
const fs = require('fs');

const TEST_CONFIG = {
  routerEndpoint: 'http://localhost:3456/v1/messages',
  timeout: 120000, // 120秒总超时
  logFile: '/tmp/codewhisperer-response-tracing.log',
  detailedCaptureDir: '/tmp/cw-response-trace',
  testCases: [
    {
      name: 'simple-response',
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
      max_tokens: 100
    },
    {
      name: 'complex-response', 
      messages: [{ role: 'user', content: 'Please write a detailed explanation of how machine learning works, including the key concepts and applications.' }],
      max_tokens: 1000
    }
  ]
};

class ResponseTracer {
  constructor() {
    this.traceData = [];
    this.startTime = null;
    this.currentRequestId = null;
    
    // 确保日志目录存在
    if (!fs.existsSync(TEST_CONFIG.detailedCaptureDir)) {
      fs.mkdirSync(TEST_CONFIG.detailedCaptureDir, { recursive: true });
    }
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      message,
      data,
      elapsedTime: this.startTime ? Date.now() - this.startTime : 0
    };
    
    this.traceData.push(logEntry);
    console.log(`[${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    
    // 同时写入文件
    fs.appendFileSync(TEST_CONFIG.logFile, JSON.stringify(logEntry) + '\n');
  }

  async traceCompleteResponseFlow(testCase) {
    this.startTime = Date.now();
    this.currentRequestId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.log(`开始完整响应链路跟踪 - ${testCase.name}`, {
      requestId: this.currentRequestId,
      testCase: testCase.name
    });

    try {
      // 阶段1: 准备请求
      await this.traceRequestPreparation(testCase);
      
      // 阶段2: 发送请求并跟踪网络层
      const response = await this.traceNetworkRequest(testCase);
      
      // 阶段3: 跟踪响应处理
      await this.traceResponseProcessing(response);
      
      // 阶段4: 验证最终数据
      await this.traceFinalDataVerification(response);
      
      this.log(`完整响应链路跟踪完成 - ${testCase.name}`, {
        totalTime: Date.now() - this.startTime,
        success: true
      });
      
      return { success: true, totalTime: Date.now() - this.startTime };
      
    } catch (error) {
      this.log(`响应链路跟踪失败 - ${testCase.name}`, {
        error: error.message,
        stack: error.stack,
        totalTime: Date.now() - this.startTime
      });
      
      return { success: false, error: error.message, totalTime: Date.now() - this.startTime };
    }
  }

  async traceRequestPreparation(testCase) {
    const prepStartTime = Date.now();
    this.log('阶段1: 请求准备开始');
    
    // 检查路由器状态
    try {
      this.log('检查路由器服务状态');
      const healthCheck = await axios.get('http://localhost:3456/health', { timeout: 5000 });
      this.log('路由器状态检查完成', { 
        status: healthCheck.status,
        time: Date.now() - prepStartTime 
      });
    } catch (error) {
      this.log('路由器状态检查失败', { error: error.message });
      throw new Error(`路由器不可用: ${error.message}`);
    }
    
    // 准备请求payload
    const requestPayload = {
      model: 'claude-sonnet-4-20250514',
      messages: testCase.messages,
      max_tokens: testCase.max_tokens,
      stream: false,
      metadata: {
        requestId: this.currentRequestId,
        testCase: testCase.name,
        traceEnabled: true
      }
    };
    
    this.log('请求payload已准备', {
      payloadSize: JSON.stringify(requestPayload).length,
      prepTime: Date.now() - prepStartTime
    });
    
    // 保存请求到文件
    const requestFile = `${TEST_CONFIG.detailedCaptureDir}/request-${this.currentRequestId}.json`;
    fs.writeFileSync(requestFile, JSON.stringify(requestPayload, null, 2));
    this.log('请求已保存到文件', { file: requestFile });
  }

  async traceNetworkRequest(testCase) {
    const networkStartTime = Date.now();
    this.log('阶段2: 网络请求开始');
    
    const requestPayload = {
      model: 'claude-sonnet-4-20250514',
      messages: testCase.messages,
      max_tokens: testCase.max_tokens,
      stream: false,
      metadata: {
        requestId: this.currentRequestId,
        testCase: testCase.name,
        traceEnabled: true
      }
    };
    
    let response;
    let responseTime;
    
    try {
      // 发送请求并监控各个阶段
      this.log('发送HTTP请求到路由器');
      const requestStart = Date.now();
      
      response = await axios.post(TEST_CONFIG.routerEndpoint, requestPayload, {
        timeout: TEST_CONFIG.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': this.currentRequestId,
          'X-Trace-Enabled': 'true'
        },
        // 添加请求拦截器跟踪
        onUploadProgress: (progressEvent) => {
          this.log('上传进度', {
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percent: progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0
          });
        },
        onDownloadProgress: (progressEvent) => {
          this.log('下载进度', {
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percent: progressEvent.total ? Math.round((progressEvent.loaded * 100) / progressEvent.total) : 0,
            elapsedTime: Date.now() - requestStart
          });
        }
      });
      
      responseTime = Date.now() - requestStart;
      this.log('HTTP响应接收完成', {
        status: response.status,
        headers: response.headers,
        dataSize: JSON.stringify(response.data).length,
        responseTime: responseTime,
        networkTime: Date.now() - networkStartTime
      });
      
    } catch (error) {
      responseTime = Date.now() - networkStartTime;
      
      if (error.code === 'ECONNABORTED') {
        this.log('网络请求超时', {
          timeout: TEST_CONFIG.timeout,
          actualTime: responseTime,
          error: error.message
        });
      } else if (error.response) {
        this.log('HTTP错误响应', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          responseTime: responseTime
        });
      } else {
        this.log('网络连接错误', {
          error: error.message,
          code: error.code,
          responseTime: responseTime
        });
      }
      
      throw new Error(`网络请求失败: ${error.message} (${responseTime}ms)`);
    }
    
    // 保存响应到文件
    const responseFile = `${TEST_CONFIG.detailedCaptureDir}/response-${this.currentRequestId}.json`;
    fs.writeFileSync(responseFile, JSON.stringify({
      status: response.status,
      headers: response.headers,
      data: response.data,
      responseTime: responseTime,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    this.log('响应已保存到文件', { file: responseFile });
    
    return response;
  }

  async traceResponseProcessing(response) {
    const processingStartTime = Date.now();
    this.log('阶段3: 响应处理开始');
    
    // 分析响应结构
    this.log('分析响应结构', {
      hasData: !!response.data,
      dataType: typeof response.data,
      dataKeys: response.data ? Object.keys(response.data) : null
    });
    
    // 检查是否是预期的Anthropic格式
    if (response.data) {
      const expectedFields = ['id', 'model', 'role', 'content'];
      const presentFields = expectedFields.filter(field => response.data.hasOwnProperty(field));
      const missingFields = expectedFields.filter(field => !response.data.hasOwnProperty(field));
      
      this.log('响应格式验证', {
        expectedFields,
        presentFields,
        missingFields,
        isValidFormat: missingFields.length === 0
      });
      
      if (response.data.content) {
        this.log('响应内容分析', {
          contentType: typeof response.data.content,
          isArray: Array.isArray(response.data.content),
          contentLength: Array.isArray(response.data.content) ? response.data.content.length : response.data.content.length,
          hasText: response.data.content.some ? response.data.content.some(item => item.type === 'text') : !!response.data.content
        });
      }
    }
    
    this.log('响应处理完成', {
      processingTime: Date.now() - processingStartTime
    });
  }

  async traceFinalDataVerification(response) {
    const verificationStartTime = Date.now();
    this.log('阶段4: 最终数据验证开始');
    
    // 验证数据完整性
    let dataIntegrity = {
      hasResponse: !!response,
      hasData: !!response?.data,
      hasContent: !!response?.data?.content,
      hasModel: !!response?.data?.model,
      isComplete: false
    };
    
    if (response?.data) {
      // 检查响应是否完整
      dataIntegrity.isComplete = !!(
        response.data.id &&
        response.data.model &&
        response.data.content &&
        (Array.isArray(response.data.content) ? response.data.content.length > 0 : response.data.content.length > 0)
      );
      
      // 记录实际收到的数据
      this.log('最终数据内容', {
        id: response.data.id,
        model: response.data.model,
        role: response.data.role,
        contentType: typeof response.data.content,
        contentPreview: Array.isArray(response.data.content) 
          ? response.data.content.slice(0, 2) 
          : response.data.content.substring(0, 200),
        usage: response.data.usage || null
      });
    }
    
    this.log('数据完整性验证', dataIntegrity);
    
    // 性能总结
    const totalTime = Date.now() - this.startTime;
    this.log('性能总结', {
      totalResponseTime: totalTime,
      verificationTime: Date.now() - verificationStartTime,
      isSuccess: dataIntegrity.isComplete,
      performanceRating: totalTime < 10000 ? 'excellent' : totalTime < 30000 ? 'good' : totalTime < 60000 ? 'acceptable' : 'poor'
    });
    
    return dataIntegrity;
  }

  generateTraceReport() {
    const reportData = {
      testMetadata: {
        requestId: this.currentRequestId,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        totalDuration: Date.now() - this.startTime
      },
      traceEvents: this.traceData,
      summary: {
        totalEvents: this.traceData.length,
        errorEvents: this.traceData.filter(event => event.message.includes('失败') || event.message.includes('错误')).length,
        performanceEvents: this.traceData.filter(event => event.message.includes('完成') || event.message.includes('时间')).length
      }
    };
    
    const reportFile = `${TEST_CONFIG.detailedCaptureDir}/trace-report-${this.currentRequestId}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
    
    console.log(`\n=== 响应跟踪报告 ===`);
    console.log(`请求ID: ${this.currentRequestId}`);
    console.log(`总耗时: ${reportData.testMetadata.totalDuration}ms`);
    console.log(`事件总数: ${reportData.summary.totalEvents}`);
    console.log(`错误事件: ${reportData.summary.errorEvents}`);
    console.log(`报告文件: ${reportFile}`);
    
    return reportFile;
  }
}

async function main() {
  console.log('=== CodeWhisperer Complete Response Tracing Test ===');
  console.log(`开始时间: ${new Date().toISOString()}`);
  console.log(`日志文件: ${TEST_CONFIG.logFile}`);
  console.log(`详细捕获目录: ${TEST_CONFIG.detailedCaptureDir}`);
  
  // 清理之前的日志
  if (fs.existsSync(TEST_CONFIG.logFile)) {
    fs.unlinkSync(TEST_CONFIG.logFile);
  }
  
  const results = [];
  
  for (const testCase of TEST_CONFIG.testCases) {
    console.log(`\n--- 开始测试用例: ${testCase.name} ---`);
    
    const tracer = new ResponseTracer();
    const result = await tracer.traceCompleteResponseFlow(testCase);
    
    result.testCase = testCase.name;
    result.reportFile = tracer.generateTraceReport();
    results.push(result);
    
    console.log(`--- 测试用例完成: ${testCase.name} (${result.success ? '成功' : '失败'}) ---`);
    
    // 测试用例间等待5秒
    if (TEST_CONFIG.testCases.indexOf(testCase) < TEST_CONFIG.testCases.length - 1) {
      console.log('等待5秒后继续下一个测试用例...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // 生成最终报告
  const finalReport = {
    testSuite: 'CodeWhisperer Complete Response Tracing',
    timestamp: new Date().toISOString(),
    results: results,
    summary: {
      totalTests: results.length,
      successfulTests: results.filter(r => r.success).length,
      failedTests: results.filter(r => !r.success).length,
      averageResponseTime: results.reduce((sum, r) => sum + r.totalTime, 0) / results.length,
      maxResponseTime: Math.max(...results.map(r => r.totalTime)),
      minResponseTime: Math.min(...results.map(r => r.totalTime))
    }
  };
  
  const finalReportFile = `${TEST_CONFIG.detailedCaptureDir}/final-trace-report-${Date.now()}.json`;
  fs.writeFileSync(finalReportFile, JSON.stringify(finalReport, null, 2));
  
  console.log('\n=== 最终测试报告 ===');
  console.log(`成功: ${finalReport.summary.successfulTests}/${finalReport.summary.totalTests}`);
  console.log(`平均响应时间: ${finalReport.summary.averageResponseTime.toFixed(2)}ms`);
  console.log(`最大响应时间: ${finalReport.summary.maxResponseTime}ms`);
  console.log(`最小响应时间: ${finalReport.summary.minResponseTime}ms`);
  console.log(`最终报告: ${finalReportFile}`);
  
  // 如果有失败的测试，退出码为1
  process.exit(finalReport.summary.failedTests > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { ResponseTracer, TEST_CONFIG };