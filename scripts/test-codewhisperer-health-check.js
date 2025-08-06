#!/usr/bin/env node

/**
 * CodeWhisperer健康检查和二进制数据捕获脚本
 * 在使用有限token之前先验证系统是否正常工作
 * 如果不能工作，捕获二进制数据用于黑盒测试
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 健康检查配置
const HEALTH_CHECK_CONFIG = {
  serverUrl: 'http://localhost:8080',
  logDir: '/tmp/codewhisperer-health-check',
  binaryDataDir: '/tmp/codewhisperer-binary-data',
  timeout: 30000,
  
  // 测试用例 - 从简单到复杂
  testCases: [
    {
      name: 'server_ping',
      description: '服务器连通性测试',
      endpoint: '/health',
      method: 'GET',
      priority: 1,
      skipOnFailure: false
    },
    {
      name: 'auth_check',
      description: 'CodeWhisperer认证检查',
      endpoint: '/debug/codewhisperer/auth',
      method: 'GET',
      priority: 2,
      skipOnFailure: false
    },
    {
      name: 'simple_request',
      description: '简单文本请求测试',
      endpoint: '/v1/messages',
      method: 'POST',
      data: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello, this is a health check test.' }
        ]
      },
      priority: 3,
      skipOnFailure: true,
      captureBinary: true
    },
    {
      name: 'tool_request',
      description: '工具调用请求测试',
      endpoint: '/v1/messages',
      method: 'POST',
      data: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          { role: 'user', content: 'What time is it?' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_current_time',
              description: 'Get the current time',
              parameters: {
                type: 'object',
                properties: {},
                required: []
              }
            }
          }
        ]
      },
      priority: 4,
      skipOnFailure: true,
      captureBinary: true
    }
  ]
};

// 确保必要目录存在
[HEALTH_CHECK_CONFIG.logDir, HEALTH_CHECK_CONFIG.binaryDataDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * 执行健康检查测试
 */
async function executeHealthCheck(testCase) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(HEALTH_CHECK_CONFIG.logDir, `${testCase.name}-${timestamp}.log`);
  
  console.log(`\n🔍 执行健康检查: ${testCase.description}`);
  console.log(`📝 日志文件: ${logFile}`);
  
  const result = {
    testCase: testCase.name,
    description: testCase.description,
    timestamp,
    success: false,
    duration: 0,
    statusCode: null,
    error: null,
    response: null,
    binaryData: null,
    logFile
  };
  
  const startTime = Date.now();
  
  try {
    // 构建请求配置
    const config = {
      method: testCase.method,
      url: `${HEALTH_CHECK_CONFIG.serverUrl}${testCase.endpoint}`,
      timeout: HEALTH_CHECK_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CodeWhisperer-Health-Check/1.0'
      }
    };
    
    // 添加认证头（如果不是基础连通性测试）
    if (testCase.name !== 'server_ping') {
      config.headers.Authorization = 'Bearer test-token';
    }
    
    // 添加请求数据
    if (testCase.data) {
      config.data = testCase.data;
    }
    
    // 如果需要捕获二进制数据，设置响应类型
    if (testCase.captureBinary) {
      config.responseType = 'arraybuffer';
    }
    
    console.log(`  📡 发送请求: ${config.method} ${config.url}`);
    
    // 执行请求
    const response = await axios(config);
    result.duration = Date.now() - startTime;
    result.success = true;
    result.statusCode = response.status;
    
    // 处理响应数据
    if (testCase.captureBinary && response.data) {
      // 保存二进制数据
      const binaryFile = path.join(
        HEALTH_CHECK_CONFIG.binaryDataDir, 
        `${testCase.name}-${timestamp}.bin`
      );
      fs.writeFileSync(binaryFile, Buffer.from(response.data));
      result.binaryData = {
        file: binaryFile,
        size: response.data.byteLength,
        contentType: response.headers['content-type']
      };
      
      console.log(`  💾 二进制数据已保存: ${binaryFile} (${response.data.byteLength} bytes)`);
      
      // 尝试解析为文本以便日志记录
      try {
        const textData = Buffer.from(response.data).toString('utf8');
        result.response = {
          type: 'binary',
          size: response.data.byteLength,
          textPreview: textData.substring(0, 500),
          headers: response.headers
        };
      } catch (parseError) {
        result.response = {
          type: 'binary',
          size: response.data.byteLength,
          parseError: parseError.message,
          headers: response.headers
        };
      }
    } else {
      result.response = {
        type: 'json',
        data: response.data,
        headers: response.headers
      };
    }
    
    console.log(`  ✅ 测试成功 (${result.duration}ms, 状态码: ${result.statusCode})`);
    
  } catch (error) {
    result.duration = Date.now() - startTime;
    result.success = false;
    result.error = error.message;
    result.statusCode = error.response?.status;
    
    // 如果是网络错误，也尝试捕获错误响应的二进制数据
    if (testCase.captureBinary && error.response?.data) {
      try {
        const errorBinaryFile = path.join(
          HEALTH_CHECK_CONFIG.binaryDataDir, 
          `${testCase.name}-error-${timestamp}.bin`
        );
        fs.writeFileSync(errorBinaryFile, Buffer.from(error.response.data));
        result.binaryData = {
          file: errorBinaryFile,
          size: error.response.data.byteLength,
          contentType: error.response.headers?.['content-type'],
          isError: true
        };
        
        console.log(`  💾 错误响应二进制数据已保存: ${errorBinaryFile}`);
      } catch (saveError) {
        console.log(`  ⚠️  无法保存错误响应数据: ${saveError.message}`);
      }
    }
    
    if (error.response?.data) {
      result.response = {
        type: 'error',
        data: error.response.data,
        headers: error.response.headers
      };
    }
    
    console.log(`  ❌ 测试失败 (${result.duration}ms, 状态码: ${result.statusCode || 'N/A'})`);
    console.log(`     错误: ${error.message}`);
  }
  
  // 写入详细日志
  fs.writeFileSync(logFile, JSON.stringify(result, null, 2));
  
  return result;
}

/**
 * 分析健康检查结果
 */
function analyzeHealthResults(results) {
  const analysis = {
    totalTests: results.length,
    passedTests: 0,
    failedTests: 0,
    systemHealth: 'unknown',
    issues: [],
    recommendations: [],
    binaryDataFiles: [],
    canProceedWithTokenTests: false
  };
  
  // 分析各个测试结果
  for (const result of results) {
    if (result.success) {
      analysis.passedTests++;
    } else {
      analysis.failedTests++;
      analysis.issues.push(`${result.testCase}: ${result.error}`);
    }
    
    // 收集二进制数据文件
    if (result.binaryData) {
      analysis.binaryDataFiles.push({
        testCase: result.testCase,
        file: result.binaryData.file,
        size: result.binaryData.size,
        isError: result.binaryData.isError || false
      });
    }
  }
  
  // 确定系统健康状态
  const serverPingResult = results.find(r => r.testCase === 'server_ping');
  const authCheckResult = results.find(r => r.testCase === 'auth_check');
  const simpleRequestResult = results.find(r => r.testCase === 'simple_request');
  
  if (!serverPingResult?.success) {
    analysis.systemHealth = 'critical';
    analysis.recommendations.push('服务器无法连接，请检查服务器是否启动');
    analysis.canProceedWithTokenTests = false;
  } else if (!authCheckResult?.success) {
    analysis.systemHealth = 'auth_failed';
    analysis.recommendations.push('认证系统有问题，请检查Kiro认证配置');
    analysis.canProceedWithTokenTests = false;
  } else if (!simpleRequestResult?.success) {
    analysis.systemHealth = 'request_failed';
    analysis.recommendations.push('基础请求失败，需要进行黑盒测试分析');
    analysis.canProceedWithTokenTests = false;
  } else {
    analysis.systemHealth = 'healthy';
    analysis.canProceedWithTokenTests = true;
    analysis.recommendations.push('系统基本健康，可以进行完整的token测试');
  }
  
  // 特殊建议
  if (analysis.binaryDataFiles.length > 0) {
    analysis.recommendations.push('已捕获二进制响应数据，可用于黑盒测试分析');
  }
  
  if (analysis.failedTests > 0 && analysis.binaryDataFiles.length === 0) {
    analysis.recommendations.push('建议启用二进制数据捕获以便进行详细分析');
  }
  
  return analysis;
}

/**
 * 生成健康检查报告
 */
function generateHealthReport(results, analysis) {
  const timestamp = new Date().toISOString();
  const reportFile = path.join(HEALTH_CHECK_CONFIG.logDir, `health-report-${timestamp.replace(/[:.]/g, '-')}.md`);
  
  let report = `# CodeWhisperer健康检查报告\n\n`;
  report += `**检查时间**: ${timestamp}\n`;
  report += `**系统状态**: ${analysis.systemHealth}\n`;
  report += `**测试结果**: ${analysis.passedTests}/${analysis.totalTests} 通过\n`;
  report += `**可以进行token测试**: ${analysis.canProceedWithTokenTests ? '✅ 是' : '❌ 否'}\n\n`;
  
  // 系统健康状态
  report += `## 🏥 系统健康状态\n\n`;
  
  const healthStatus = {
    'healthy': '✅ 健康 - 系统正常运行',
    'auth_failed': '🔐 认证失败 - 需要检查认证配置',
    'request_failed': '📡 请求失败 - 需要进行黑盒测试',
    'critical': '🚨 严重 - 服务器无法连接',
    'unknown': '❓ 未知 - 需要进一步检查'
  };
  
  report += `**状态**: ${healthStatus[analysis.systemHealth] || analysis.systemHealth}\n\n`;
  
  // 详细测试结果
  report += `## 📋 详细测试结果\n\n`;
  
  for (const result of results) {
    report += `### ${result.description}\n\n`;
    report += `- **测试名称**: ${result.testCase}\n`;
    report += `- **状态**: ${result.success ? '✅ 成功' : '❌ 失败'}\n`;
    report += `- **耗时**: ${result.duration}ms\n`;
    report += `- **状态码**: ${result.statusCode || 'N/A'}\n`;
    
    if (result.error) {
      report += `- **错误**: ${result.error}\n`;
    }
    
    if (result.binaryData) {
      report += `- **二进制数据**: ${result.binaryData.file} (${result.binaryData.size} bytes)\n`;
    }
    
    report += `- **日志文件**: \`${result.logFile}\`\n\n`;
  }
  
  // 二进制数据文件
  if (analysis.binaryDataFiles.length > 0) {
    report += `## 💾 捕获的二进制数据\n\n`;
    report += `| 测试用例 | 文件路径 | 大小 | 类型 |\n`;
    report += `|----------|----------|------|------|\n`;
    
    for (const binaryFile of analysis.binaryDataFiles) {
      const type = binaryFile.isError ? '错误响应' : '正常响应';
      report += `| ${binaryFile.testCase} | \`${binaryFile.file}\` | ${binaryFile.size} bytes | ${type} |\n`;
    }
    report += `\n`;
  }
  
  // 发现的问题
  report += `## 🚨 发现的问题\n\n`;
  
  if (analysis.issues.length > 0) {
    for (const issue of analysis.issues) {
      report += `- ${issue}\n`;
    }
  } else {
    report += `🎉 未发现问题！\n`;
  }
  
  // 建议
  report += `\n## 🔧 建议\n\n`;
  
  for (const recommendation of analysis.recommendations) {
    report += `- ${recommendation}\n`;
  }
  
  // 下一步行动
  report += `\n## 📋 下一步行动\n\n`;
  
  if (analysis.canProceedWithTokenTests) {
    report += `### ✅ 系统健康，可以进行完整测试\n\n`;
    report += `1. 执行完整的兼容性测试:\n`;
    report += `   \`\`\`bash\n`;
    report += `   ./scripts/test-codewhisperer-demo3-pipeline.js\n`;
    report += `   \`\`\`\n\n`;
    report += `2. 监控token使用情况\n`;
    report += `3. 如果发现问题，立即停止测试以节省token\n`;
  } else {
    report += `### ❌ 系统有问题，需要先修复\n\n`;
    
    if (analysis.systemHealth === 'critical') {
      report += `1. **立即修复**: 启动服务器\n`;
      report += `2. 检查端口8080是否被占用\n`;
      report += `3. 查看服务器日志\n`;
    } else if (analysis.systemHealth === 'auth_failed') {
      report += `1. **立即修复**: 检查Kiro认证配置\n`;
      report += `2. 验证token文件是否存在: \`~/.aws/sso/cache/kiro-auth-token.json\`\n`;
      report += `3. 尝试重新登录Kiro\n`;
    } else if (analysis.systemHealth === 'request_failed') {
      report += `1. **黑盒测试**: 使用捕获的二进制数据进行分析\n`;
      report += `2. 对比demo3的响应格式\n`;
      report += `3. 检查parser实现\n`;
    }
    
    report += `\n**⚠️ 重要**: 在修复问题之前不要进行完整的token测试！\n`;
  }
  
  report += `\n---\n`;
  report += `**报告生成时间**: ${timestamp}\n`;
  report += `**健康检查工具**: CodeWhisperer Health Check v1.0\n`;
  
  fs.writeFileSync(reportFile, report);
  console.log(`\n📄 健康检查报告已生成: ${reportFile}`);
  
  return reportFile;
}

/**
 * 主函数
 */
async function main() {
  console.log('🏥 开始CodeWhisperer健康检查');
  console.log(`📁 日志目录: ${HEALTH_CHECK_CONFIG.logDir}`);
  console.log(`💾 二进制数据目录: ${HEALTH_CHECK_CONFIG.binaryDataDir}`);
  console.log(`⚠️  注意: 这是预检查，不会消耗大量token`);
  
  const results = [];
  let shouldContinue = true;
  
  // 按优先级执行测试
  const sortedTests = HEALTH_CHECK_CONFIG.testCases.sort((a, b) => a.priority - b.priority);
  
  for (const testCase of sortedTests) {
    if (!shouldContinue && testCase.skipOnFailure) {
      console.log(`\n⏭️  跳过测试: ${testCase.description} (前置条件未满足)`);
      continue;
    }
    
    const result = await executeHealthCheck(testCase);
    results.push(result);
    
    // 如果关键测试失败，决定是否继续
    if (!result.success && !testCase.skipOnFailure) {
      shouldContinue = false;
      console.log(`\n🚨 关键测试失败，停止后续测试: ${testCase.description}`);
    }
  }
  
  // 分析结果
  const analysis = analyzeHealthResults(results);
  
  // 生成报告
  const reportFile = generateHealthReport(results, analysis);
  
  // 输出总结
  console.log('\n🎯 健康检查总结:');
  console.log(`  🏥 系统状态: ${analysis.systemHealth}`);
  console.log(`  ✅ 通过测试: ${analysis.passedTests}/${analysis.totalTests}`);
  console.log(`  💾 二进制文件: ${analysis.binaryDataFiles.length}个`);
  console.log(`  🧪 可以进行token测试: ${analysis.canProceedWithTokenTests ? '是' : '否'}`);
  console.log(`  📄 详细报告: ${reportFile}`);
  
  // 特别提醒
  if (!analysis.canProceedWithTokenTests) {
    console.log('\n⚠️  重要提醒:');
    console.log('   系统当前有问题，建议先修复再进行完整测试');
    console.log('   这样可以避免浪费有限的token配额');
    
    if (analysis.binaryDataFiles.length > 0) {
      console.log('\n💡 黑盒测试建议:');
      console.log('   已捕获二进制响应数据，可以用于离线分析');
      console.log('   建议与demo3的响应进行对比分析');
    }
  } else {
    console.log('\n🎉 系统健康，可以安全进行完整测试！');
  }
  
  // 根据结果设置退出码
  process.exit(analysis.canProceedWithTokenTests ? 0 : 1);
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 健康检查执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  executeHealthCheck,
  analyzeHealthResults,
  generateHealthReport
};