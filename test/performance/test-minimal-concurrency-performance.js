#!/usr/bin/env node

/**
 * 极简并发管理性能测试
 * 验证新的零等待、零阻塞架构的性能表现
 * Owner: Jason Zhang
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

const API_BASE = 'http://localhost:3456';
const TEST_CONFIG = {
  // 并发级别测试
  concurrencyLevels: [1, 5, 10, 20, 50, 100],
  // 每个级别的请求数量
  requestsPerLevel: 20,
  // 超时时间（毫秒）
  timeout: 30000,
  // 请求间隔（毫秒）
  requestInterval: 10
};

/**
 * 生成测试请求
 */
function createTestRequest() {
  return {
    model: 'claude-sonnet-4-20250514',
    messages: [
      {
        role: 'user',
        content: 'Test concurrency performance - please respond quickly'
      }
    ],
    max_tokens: 50,
    temperature: 0.1
  };
}

/**
 * 发送单个测试请求
 */
async function sendTestRequest(requestId) {
  const startTime = performance.now();
  
  try {
    const response = await axios.post(`${API_BASE}/messages`, createTestRequest(), {
      timeout: TEST_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        'x-test-request-id': `perf-test-${requestId}`
      }
    });

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    return {
      success: true,
      requestId,
      responseTime,
      statusCode: response.status,
      hasContent: response.data && response.data.content && response.data.content.length > 0,
      contentLength: response.data?.content?.[0]?.text?.length || 0,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;

    return {
      success: false,
      requestId,
      responseTime,
      error: error.message,
      statusCode: error.response?.status || null,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 并发性能测试
 */
async function runConcurrencyTest(concurrencyLevel, requestCount) {
  console.log(`\n🚀 Testing concurrency level: ${concurrencyLevel} (${requestCount} requests)`);
  
  const startTime = performance.now();
  const promises = [];
  
  // 创建并发请求
  for (let i = 0; i < requestCount; i++) {
    const requestId = `${concurrencyLevel}-${i}`;
    
    // 如果并发级别小于请求数，使用间隔创建
    if (i < concurrencyLevel) {
      promises.push(sendTestRequest(requestId));
    } else {
      // 等待前一批完成一些再发送
      const delayMs = Math.floor(i / concurrencyLevel) * TEST_CONFIG.requestInterval;
      promises.push(
        new Promise(resolve => 
          setTimeout(() => resolve(sendTestRequest(requestId)), delayMs)
        )
      );
    }
  }

  // 等待所有请求完成
  const results = await Promise.all(promises);
  const endTime = performance.now();
  const totalTime = endTime - startTime;

  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const maxResponseTime = Math.max(...results.map(r => r.responseTime));
  const minResponseTime = Math.min(...results.map(r => r.responseTime));
  
  // 计算吞吐量
  const throughput = (successCount / (totalTime / 1000)).toFixed(2);
  
  console.log(`✅ Concurrency ${concurrencyLevel} Results:`);
  console.log(`   - Total time: ${totalTime.toFixed(0)}ms`);
  console.log(`   - Successful requests: ${successCount}/${requestCount} (${(successCount/requestCount*100).toFixed(1)}%)`);
  console.log(`   - Failed requests: ${failureCount}`);
  console.log(`   - Avg response time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`   - Min response time: ${minResponseTime.toFixed(0)}ms`);
  console.log(`   - Max response time: ${maxResponseTime.toFixed(0)}ms`);
  console.log(`   - Throughput: ${throughput} req/sec`);

  return {
    concurrencyLevel,
    requestCount,
    totalTime,
    successCount,
    failureCount,
    successRate: successCount / requestCount,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    throughput: parseFloat(throughput),
    results: results
  };
}

/**
 * 等等延迟测试 - 验证零等待特性
 */
async function runZeroWaitTest() {
  console.log(`\n⚡ Zero-Wait Architecture Test`);
  console.log(`Sending 50 requests simultaneously to test immediate allocation...`);
  
  const startTime = performance.now();
  const promises = [];
  
  // 同时发送50个请求
  for (let i = 0; i < 50; i++) {
    promises.push(sendTestRequest(`zero-wait-${i}`));
  }

  const results = await Promise.all(promises);
  const endTime = performance.now();
  
  // 计算第一个响应时间（衡量等待时间）
  const firstResponseTime = Math.min(...results.map(r => r.responseTime));
  const lastResponseTime = Math.max(...results.map(r => r.responseTime));
  const successCount = results.filter(r => r.success).length;
  
  console.log(`✅ Zero-Wait Test Results:`);
  console.log(`   - All requests sent simultaneously`);
  console.log(`   - First response: ${firstResponseTime.toFixed(0)}ms`);
  console.log(`   - Last response: ${lastResponseTime.toFixed(0)}ms`);
  console.log(`   - Successful: ${successCount}/50 (${(successCount/50*100).toFixed(1)}%)`);
  console.log(`   - Response spread: ${(lastResponseTime - firstResponseTime).toFixed(0)}ms`);
  
  if (firstResponseTime > 5000) {
    console.log(`⚠️  WARNING: First response took ${firstResponseTime.toFixed(0)}ms - may indicate waiting/blocking`);
  } else {
    console.log(`🎯 EXCELLENT: Quick first response indicates zero-wait architecture working`);
  }

  return {
    testType: 'zero-wait',
    simultaneousRequests: 50,
    firstResponseTime,
    lastResponseTime,
    responseSpread: lastResponseTime - firstResponseTime,
    successCount,
    successRate: successCount / 50
  };
}

/**
 * 获取系统并发状态
 */
async function getConcurrencyStatus() {
  try {
    const response = await axios.get(`${API_BASE}/status`);
    if (response.data && response.data.concurrency) {
      return response.data.concurrency;
    }
  } catch (error) {
    console.log(`⚠️  Could not fetch concurrency status: ${error.message}`);
  }
  return null;
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🧪 Minimal Concurrency Performance Test');
  console.log('=====================================');
  console.log(`Target: ${API_BASE}`);
  console.log(`Test config: ${JSON.stringify(TEST_CONFIG, null, 2)}`);

  // 检查服务器状态
  try {
    const statusResponse = await axios.get(`${API_BASE}/status`);
    console.log(`✅ Server is running`);
  } catch (error) {
    console.error(`❌ Server not reachable: ${error.message}`);
    process.exit(1);
  }

  const allResults = [];

  // 1. 零等待测试
  const zeroWaitResult = await runZeroWaitTest();
  allResults.push(zeroWaitResult);

  // 2. 并发级别测试
  for (const concurrencyLevel of TEST_CONFIG.concurrencyLevels) {
    const result = await runConcurrencyTest(concurrencyLevel, TEST_CONFIG.requestsPerLevel);
    allResults.push(result);
    
    // 检查并发状态
    const concurrencyStatus = await getConcurrencyStatus();
    if (concurrencyStatus) {
      console.log(`   - Current system status: ${JSON.stringify(concurrencyStatus.system)}`);
    }
    
    // 短暂休息避免系统过载
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 3. 结果汇总
  console.log(`\n📊 Performance Test Summary`);
  console.log(`============================`);
  
  const concurrencyResults = allResults.filter(r => r.testType !== 'zero-wait');
  const avgThroughput = concurrencyResults.reduce((sum, r) => sum + r.throughput, 0) / concurrencyResults.length;
  const avgSuccessRate = concurrencyResults.reduce((sum, r) => sum + r.successRate, 0) / concurrencyResults.length;
  const avgResponseTime = concurrencyResults.reduce((sum, r) => sum + r.avgResponseTime, 0) / concurrencyResults.length;
  
  console.log(`Overall Metrics:`);
  console.log(`  - Average throughput: ${avgThroughput.toFixed(2)} req/sec`);
  console.log(`  - Average success rate: ${(avgSuccessRate * 100).toFixed(1)}%`);
  console.log(`  - Average response time: ${avgResponseTime.toFixed(0)}ms`);
  console.log(`  - Zero-wait performance: ${zeroWaitResult.firstResponseTime.toFixed(0)}ms first response`);

  // 性能评级
  let grade = 'UNKNOWN';
  if (avgSuccessRate >= 0.95 && avgThroughput >= 5 && zeroWaitResult.firstResponseTime < 3000) {
    grade = 'EXCELLENT';
  } else if (avgSuccessRate >= 0.90 && avgThroughput >= 3 && zeroWaitResult.firstResponseTime < 5000) {
    grade = 'GOOD';
  } else if (avgSuccessRate >= 0.80 && avgThroughput >= 2) {
    grade = 'FAIR';
  } else {
    grade = 'NEEDS_IMPROVEMENT';
  }

  console.log(`\n🏆 Performance Grade: ${grade}`);
  
  // 保存详细结果
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = `/tmp/concurrency-performance-${timestamp}.json`;
  require('fs').writeFileSync(resultsFile, JSON.stringify({
    testConfig: TEST_CONFIG,
    timestamp: new Date().toISOString(),
    summary: {
      avgThroughput,
      avgSuccessRate,
      avgResponseTime,
      zeroWaitFirstResponse: zeroWaitResult.firstResponseTime,
      grade
    },
    results: allResults
  }, null, 2));
  
  console.log(`📁 Detailed results saved to: ${resultsFile}`);
  
  return grade;
}

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { runConcurrencyTest, runZeroWaitTest, main };