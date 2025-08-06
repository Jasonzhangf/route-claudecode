/**
 * 错误系统健康检查
 * 测试错误处理是否正确工作，特别是6689端口的问题
 */

const axios = require('axios');

async function testErrorSystemHealth() {
  console.log('🏥 错误系统健康检查开始...\n');

  // 测试不同端口的错误处理
  const testPorts = [3456, 6689, 8888];
  const results = {};

  for (const port of testPorts) {
    console.log(`🔍 测试端口 ${port}:`);
    results[port] = await testPortErrorHandling(port);
    console.log('');
  }

  // 生成健康报告
  generateHealthReport(results);
}

async function testPortErrorHandling(port) {
  const baseUrl = `http://localhost:${port}`;
  const testResults = {
    port,
    serverRunning: false,
    errorHandling: {
      invalidModel: { tested: false, success: false, details: null },
      invalidEndpoint: { tested: false, success: false, details: null },
      streamingError: { tested: false, success: false, details: null },
      timeoutError: { tested: false, success: false, details: null }
    },
    silentFailures: 0,
    totalTests: 0
  };

  // 检查服务器是否运行
  try {
    const healthResponse = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
    testResults.serverRunning = true;
    console.log(`  ✅ 服务器运行正常 (状态: ${healthResponse.status})`);
  } catch (error) {
    console.log(`  ❌ 服务器未运行或无响应: ${error.message}`);
    return testResults;
  }

  // 测试1: 无效模型错误处理
  console.log(`  🧪 测试无效模型错误处理...`);
  testResults.totalTests++;
  try {
    await axios.post(`${baseUrl}/v1/chat/completions`, {
      model: 'invalid-model-that-does-not-exist-12345',
      messages: [{ role: 'user', content: 'Test message' }],
      stream: false
    }, { timeout: 10000 });
    
    // 如果请求成功，这可能是静默失败
    console.log(`    ⚠️  请求成功但应该失败 - 可能的静默失败`);
    testResults.silentFailures++;
  } catch (error) {
    testResults.errorHandling.invalidModel.tested = true;
    if (error.response && error.response.status >= 400) {
      testResults.errorHandling.invalidModel.success = true;
      testResults.errorHandling.invalidModel.details = {
        status: error.response.status,
        message: error.response.data?.error?.message || error.message
      };
      console.log(`    ✅ 正确返回错误 (${error.response.status}): ${error.response.data?.error?.message || error.message}`);
    } else {
      console.log(`    ❌ 错误处理不正确: ${error.message}`);
      testResults.silentFailures++;
    }
  }

  // 测试2: 流式请求错误处理
  console.log(`  🧪 测试流式请求错误处理...`);
  testResults.totalTests++;
  try {
    const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
      model: 'another-invalid-model-stream-test',
      messages: [{ role: 'user', content: 'Streaming test' }],
      stream: true
    }, { 
      timeout: 10000,
      responseType: 'stream'
    });

    // 监听流式响应
    let hasError = false;
    let errorReceived = false;

    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      if (chunkStr.includes('event: error')) {
        hasError = true;
        errorReceived = true;
      }
    });

    response.data.on('end', () => {
      testResults.errorHandling.streamingError.tested = true;
      if (hasError && errorReceived) {
        testResults.errorHandling.streamingError.success = true;
        console.log(`    ✅ 流式错误正确处理`);
      } else {
        console.log(`    ❌ 流式错误处理不正确`);
        testResults.silentFailures++;
      }
    });

    // 等待流式响应完成
    await new Promise((resolve) => {
      response.data.on('end', resolve);
      setTimeout(resolve, 5000); // 5秒超时
    });

  } catch (error) {
    testResults.errorHandling.streamingError.tested = true;
    if (error.response && error.response.status >= 400) {
      testResults.errorHandling.streamingError.success = true;
      console.log(`    ✅ 流式请求正确返回错误 (${error.response.status})`);
    } else {
      console.log(`    ❌ 流式错误处理异常: ${error.message}`);
      testResults.silentFailures++;
    }
  }

  // 测试3: 超时错误处理
  console.log(`  🧪 测试超时错误处理...`);
  testResults.totalTests++;
  try {
    await axios.post(`${baseUrl}/v1/chat/completions`, {
      model: 'qwen3-coder', // 使用可能存在的模型
      messages: [{ role: 'user', content: 'This is a timeout test with a very long message that might cause timeout issues in the system. '.repeat(100) }],
      stream: false,
      max_tokens: 1000
    }, { timeout: 1000 }); // 1秒超时

    console.log(`    ⚠️  请求在超时时间内完成 - 无法测试超时处理`);
  } catch (error) {
    testResults.errorHandling.timeoutError.tested = true;
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      testResults.errorHandling.timeoutError.success = true;
      console.log(`    ✅ 超时错误正确处理: ${error.message}`);
    } else if (error.response && error.response.status >= 400) {
      testResults.errorHandling.timeoutError.success = true;
      console.log(`    ✅ 服务器错误正确处理 (${error.response.status})`);
    } else {
      console.log(`    ❌ 超时错误处理异常: ${error.message}`);
      testResults.silentFailures++;
    }
  }

  // 测试4: 检查错误统计API
  try {
    const statsResponse = await axios.get(`${baseUrl}/api/error-diagnostics`, { timeout: 5000 });
    console.log(`  📊 错误诊断API可用: ${statsResponse.status}`);
  } catch (error) {
    console.log(`  ⚠️  错误诊断API不可用: ${error.message}`);
  }

  return testResults;
}

function generateHealthReport(results) {
  console.log('📋 错误系统健康报告');
  console.log('='.repeat(50));

  let totalSilentFailures = 0;
  let totalTests = 0;
  let runningPorts = 0;

  for (const [port, result] of Object.entries(results)) {
    console.log(`\n🔌 端口 ${port}:`);
    
    if (!result.serverRunning) {
      console.log(`  ❌ 服务器未运行`);
      continue;
    }

    runningPorts++;
    totalSilentFailures += result.silentFailures;
    totalTests += result.totalTests;

    console.log(`  ✅ 服务器运行正常`);
    console.log(`  📊 测试统计:`);
    console.log(`     总测试数: ${result.totalTests}`);
    console.log(`     静默失败: ${result.silentFailures}`);
    console.log(`     成功率: ${result.totalTests > 0 ? Math.round(((result.totalTests - result.silentFailures) / result.totalTests) * 100) : 0}%`);

    console.log(`  🧪 错误处理测试:`);
    for (const [testName, testResult] of Object.entries(result.errorHandling)) {
      if (testResult.tested) {
        const status = testResult.success ? '✅' : '❌';
        console.log(`     ${testName}: ${status}`);
        if (testResult.details) {
          console.log(`       详情: ${JSON.stringify(testResult.details)}`);
        }
      } else {
        console.log(`     ${testName}: ⏭️  未测试`);
      }
    }
  }

  console.log(`\n📈 总体健康状况:`);
  console.log(`  运行中的端口: ${runningPorts}`);
  console.log(`  总测试数: ${totalTests}`);
  console.log(`  总静默失败: ${totalSilentFailures}`);
  console.log(`  系统健康度: ${totalTests > 0 ? Math.round(((totalTests - totalSilentFailures) / totalTests) * 100) : 0}%`);

  if (totalSilentFailures > 0) {
    console.log(`\n⚠️  发现 ${totalSilentFailures} 个静默失败，需要修复！`);
    console.log(`\n🔧 建议的修复步骤:`);
    console.log(`1. 检查错误处理器是否正确设置HTTP状态码`);
    console.log(`2. 验证流式请求的错误事件是否正确发送`);
    console.log(`3. 确保所有错误都有客户端通知`);
    console.log(`4. 检查特定端口(如6689)的配置是否正确`);
  } else {
    console.log(`\n✅ 错误系统运行良好，未发现静默失败！`);
  }

  console.log(`\n💡 下一步:`);
  console.log(`1. 定期运行此健康检查`);
  console.log(`2. 监控错误诊断API的统计数据`);
  console.log(`3. 关注特定端口的错误模式`);
  console.log(`4. 优化错误处理机制以减少静默失败`);
}

// 运行健康检查
testErrorSystemHealth().catch(console.error);