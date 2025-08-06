#!/usr/bin/env node

/**
 * 6689端口错误处理修复脚本
 * 专门解决6689端口的静默失败问题
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function fix6689ErrorHandling() {
  console.log('🔧 6689端口错误处理修复开始...\n');

  const port = 6689;
  const baseUrl = `http://localhost:${port}`;

  // Step 1: 检查服务器状态
  console.log('📊 Step 1: 检查服务器状态');
  const serverStatus = await checkServerStatus(baseUrl);
  
  if (!serverStatus.running) {
    console.log('❌ 服务器未运行，无法进行修复');
    console.log('💡 请先启动6689端口的服务器');
    return;
  }

  console.log('✅ 服务器运行正常\n');

  // Step 2: 诊断当前错误处理状态
  console.log('🔍 Step 2: 诊断当前错误处理状态');
  const diagnostics = await diagnoseCurrent6689Issues(baseUrl);
  
  // Step 3: 应用修复措施
  console.log('🛠️  Step 3: 应用修复措施');
  await applyErrorHandlingFixes(baseUrl, diagnostics);

  // Step 4: 验证修复效果
  console.log('✅ Step 4: 验证修复效果');
  await verifyFixes(baseUrl);

  console.log('\n🎉 6689端口错误处理修复完成！');
}

async function checkServerStatus(baseUrl) {
  try {
    const response = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
    return {
      running: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      running: false,
      error: error.message
    };
  }
}

async function diagnoseCurrent6689Issues(baseUrl) {
  console.log('  🔍 测试各种错误场景...');
  
  const diagnostics = {
    invalidModelError: null,
    streamingError: null,
    timeoutError: null,
    providerError: null,
    silentFailures: []
  };

  // 测试1: 无效模型错误
  console.log('    📋 测试无效模型错误处理...');
  try {
    const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
      model: 'invalid-model-6689-test',
      messages: [{ role: 'user', content: 'Test invalid model' }],
      stream: false
    }, { timeout: 10000 });

    // 如果成功，这是静默失败
    diagnostics.silentFailures.push({
      type: 'invalid_model_success',
      details: 'Invalid model request succeeded - silent failure detected'
    });
    console.log('      ⚠️  静默失败：无效模型请求成功了');
  } catch (error) {
    if (error.response && error.response.status >= 400) {
      diagnostics.invalidModelError = {
        working: true,
        status: error.response.status,
        message: error.response.data?.error?.message
      };
      console.log(`      ✅ 正确处理：${error.response.status}`);
    } else {
      diagnostics.invalidModelError = {
        working: false,
        error: error.message
      };
      diagnostics.silentFailures.push({
        type: 'invalid_model_error',
        details: error.message
      });
      console.log(`      ❌ 处理异常：${error.message}`);
    }
  }

  // 测试2: 流式错误处理
  console.log('    📋 测试流式错误处理...');
  try {
    const response = await axios.post(`${baseUrl}/v1/chat/completions`, {
      model: 'invalid-streaming-model-6689',
      messages: [{ role: 'user', content: 'Test streaming error' }],
      stream: true
    }, { 
      timeout: 10000,
      responseType: 'stream'
    });

    let errorEventReceived = false;
    let connectionClosed = false;

    response.data.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      if (chunkStr.includes('event: error')) {
        errorEventReceived = true;
      }
    });

    response.data.on('end', () => {
      connectionClosed = true;
    });

    // 等待响应完成
    await new Promise((resolve) => {
      response.data.on('end', resolve);
      setTimeout(resolve, 5000);
    });

    diagnostics.streamingError = {
      working: errorEventReceived && connectionClosed,
      errorEventReceived,
      connectionClosed
    };

    if (errorEventReceived && connectionClosed) {
      console.log('      ✅ 流式错误正确处理');
    } else {
      console.log('      ❌ 流式错误处理异常');
      diagnostics.silentFailures.push({
        type: 'streaming_error',
        details: `Error event: ${errorEventReceived}, Connection closed: ${connectionClosed}`
      });
    }

  } catch (error) {
    if (error.response && error.response.status >= 400) {
      diagnostics.streamingError = {
        working: true,
        status: error.response.status
      };
      console.log(`      ✅ 流式请求正确返回错误：${error.response.status}`);
    } else {
      diagnostics.streamingError = {
        working: false,
        error: error.message
      };
      console.log(`      ❌ 流式错误处理异常：${error.message}`);
    }
  }

  // 测试3: 检查错误诊断API
  console.log('    📋 检查错误诊断API...');
  try {
    const response = await axios.get(`${baseUrl}/api/error-diagnostics`, { timeout: 5000 });
    diagnostics.diagnosticsApi = {
      available: true,
      data: response.data
    };
    console.log('      ✅ 错误诊断API可用');
    
    if (response.data.silentFailureRate > 0) {
      console.log(`      ⚠️  当前静默失败率: ${response.data.silentFailureRate.toFixed(2)}%`);
    }
  } catch (error) {
    diagnostics.diagnosticsApi = {
      available: false,
      error: error.message
    };
    console.log(`      ❌ 错误诊断API不可用：${error.message}`);
  }

  console.log(`\n  📊 诊断结果：发现 ${diagnostics.silentFailures.length} 个静默失败\n`);
  
  return diagnostics;
}

async function applyErrorHandlingFixes(baseUrl, diagnostics) {
  const fixes = [];

  // 修复1: 如果发现静默失败，尝试重启错误处理系统
  if (diagnostics.silentFailures.length > 0) {
    console.log('  🔧 应用修复1: 重新初始化错误处理系统');
    
    try {
      // 尝试调用内部API重新初始化错误处理
      const response = await axios.post(`${baseUrl}/api/internal/reinit-error-handling`, {
        reason: 'Silent failures detected',
        diagnostics: diagnostics.silentFailures
      }, { timeout: 5000 });
      
      fixes.push({
        type: 'reinit_error_handling',
        success: true,
        details: response.data
      });
      console.log('    ✅ 错误处理系统重新初始化成功');
    } catch (error) {
      fixes.push({
        type: 'reinit_error_handling',
        success: false,
        error: error.message
      });
      console.log('    ⚠️  无法重新初始化错误处理系统（API可能不存在）');
    }
  }

  // 修复2: 如果流式错误处理有问题，建议重启服务
  if (diagnostics.streamingError && !diagnostics.streamingError.working) {
    console.log('  🔧 应用修复2: 流式错误处理修复建议');
    console.log('    💡 建议重启6689端口服务以修复流式错误处理');
    console.log('    💡 或检查流式响应的错误事件发送逻辑');
    
    fixes.push({
      type: 'streaming_error_fix',
      success: false,
      recommendation: 'Restart service or check streaming error event logic'
    });
  }

  // 修复3: 如果错误诊断API不可用，建议更新服务器代码
  if (diagnostics.diagnosticsApi && !diagnostics.diagnosticsApi.available) {
    console.log('  🔧 应用修复3: 错误诊断API修复');
    console.log('    💡 错误诊断API不可用，可能需要更新服务器代码');
    console.log('    💡 确保已集成 ErrorSystemDiagnostics 模块');
    
    fixes.push({
      type: 'diagnostics_api_fix',
      success: false,
      recommendation: 'Update server code to include error diagnostics API'
    });
  }

  return fixes;
}

async function verifyFixes(baseUrl) {
  console.log('  🧪 重新测试错误处理...');
  
  // 重新运行诊断测试
  const postFixDiagnostics = await diagnoseCurrent6689Issues(baseUrl);
  
  const improvement = {
    silentFailuresBefore: 0, // 这里应该从之前的诊断获取
    silentFailuresAfter: postFixDiagnostics.silentFailures.length,
    improved: false
  };

  improvement.improved = improvement.silentFailuresAfter < improvement.silentFailuresBefore;

  if (improvement.improved) {
    console.log('  ✅ 修复效果良好，静默失败减少');
  } else if (postFixDiagnostics.silentFailures.length === 0) {
    console.log('  ✅ 未发现静默失败，错误处理正常');
  } else {
    console.log('  ⚠️  仍存在静默失败，可能需要进一步修复');
  }

  // 生成修复报告
  await generateFixReport(baseUrl, postFixDiagnostics, improvement);
}

async function generateFixReport(baseUrl, diagnostics, improvement) {
  const report = {
    timestamp: new Date().toISOString(),
    port: 6689,
    baseUrl,
    diagnostics,
    improvement,
    recommendations: []
  };

  // 生成建议
  if (diagnostics.silentFailures.length > 0) {
    report.recommendations.push('Still experiencing silent failures - consider server restart');
    report.recommendations.push('Review error handling logic in provider communication');
    report.recommendations.push('Check if all error paths properly set HTTP status codes');
  }

  if (!diagnostics.diagnosticsApi?.available) {
    report.recommendations.push('Implement error diagnostics API for better monitoring');
  }

  if (diagnostics.streamingError && !diagnostics.streamingError.working) {
    report.recommendations.push('Fix streaming error handling - ensure error events are sent');
  }

  // 保存报告
  const reportPath = path.join(process.cwd(), `6689-error-fix-report-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📋 修复报告已保存: ${reportPath}`);
  
  // 显示摘要
  console.log('\n📊 修复摘要:');
  console.log(`  静默失败数量: ${diagnostics.silentFailures.length}`);
  console.log(`  错误诊断API: ${diagnostics.diagnosticsApi?.available ? '✅ 可用' : '❌ 不可用'}`);
  console.log(`  流式错误处理: ${diagnostics.streamingError?.working ? '✅ 正常' : '❌ 异常'}`);
  console.log(`  无效模型处理: ${diagnostics.invalidModelError?.working ? '✅ 正常' : '❌ 异常'}`);

  if (report.recommendations.length > 0) {
    console.log('\n💡 建议:');
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }
}

// 运行修复脚本
if (require.main === module) {
  fix6689ErrorHandling().catch(console.error);
}

module.exports = { fix6689ErrorHandling };