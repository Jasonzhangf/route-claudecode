#!/usr/bin/env node

/**
 * CodeWhisperer与demo3流水线对比脚本
 * 综合执行兼容性测试和流水线模拟测试
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 脚本配置
const SCRIPT_CONFIG = {
  testDir: path.join(__dirname, '../tests/codewhisperer'),
  logDir: '/tmp/codewhisperer-comprehensive-test',
  timeout: 120000, // 2分钟总超时
  
  tests: [
    {
      name: 'demo3-compatibility',
      script: 'test-demo3-compatibility.js',
      description: 'CodeWhisperer与demo3兼容性对比测试',
      priority: 1
    },
    {
      name: 'pipeline-simulation',
      script: 'test-pipeline-simulation.js', 
      description: 'CodeWhisperer流水线模拟测试',
      priority: 2
    }
  ]
};

// 确保日志目录存在
if (!fs.existsSync(SCRIPT_CONFIG.logDir)) {
  fs.mkdirSync(SCRIPT_CONFIG.logDir, { recursive: true });
}

/**
 * 执行单个测试脚本
 */
function executeTestScript(test) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(SCRIPT_CONFIG.logDir, `${test.name}-${timestamp}.log`);
    const scriptPath = path.join(SCRIPT_CONFIG.testDir, test.script);
    
    console.log(`\n🧪 执行测试: ${test.description}`);
    console.log(`📝 日志文件: ${logFile}`);
    console.log(`🔧 脚本路径: ${scriptPath}`);
    
    // 检查脚本是否存在
    if (!fs.existsSync(scriptPath)) {
      const error = `测试脚本不存在: ${scriptPath}`;
      console.error(`❌ ${error}`);
      resolve({
        test: test.name,
        success: false,
        error,
        logFile,
        duration: 0
      });
      return;
    }
    
    const startTime = Date.now();
    const logStream = fs.createWriteStream(logFile);
    
    // 启动子进程
    const child = spawn('node', [scriptPath], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    // 收集输出
    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      logStream.write(`[STDOUT] ${text}`);
      process.stdout.write(text); // 实时显示
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      logStream.write(`[STDERR] ${text}`);
      process.stderr.write(text); // 实时显示
    });
    
    // 设置超时
    const timeoutId = setTimeout(() => {
      console.log(`⏰ 测试超时，终止进程: ${test.name}`);
      child.kill('SIGTERM');
    }, SCRIPT_CONFIG.timeout);
    
    // 处理进程结束
    child.on('close', (code) => {
      clearTimeout(timeoutId);
      logStream.end();
      
      const duration = Date.now() - startTime;
      const success = code === 0;
      
      console.log(`${success ? '✅' : '❌'} 测试${success ? '成功' : '失败'}: ${test.name} (${duration}ms)`);
      
      resolve({
        test: test.name,
        description: test.description,
        success,
        exitCode: code,
        duration,
        stdout,
        stderr,
        logFile
      });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      logStream.end();
      
      const duration = Date.now() - startTime;
      console.error(`❌ 测试进程错误: ${test.name} - ${error.message}`);
      
      resolve({
        test: test.name,
        description: test.description,
        success: false,
        error: error.message,
        duration,
        logFile
      });
    });
  });
}

/**
 * 分析测试结果
 */
function analyzeResults(results) {
  const analysis = {
    totalTests: results.length,
    successfulTests: 0,
    failedTests: 0,
    totalDuration: 0,
    issues: [],
    recommendations: [],
    testDetails: {}
  };
  
  for (const result of results) {
    analysis.totalDuration += result.duration;
    
    if (result.success) {
      analysis.successfulTests++;
    } else {
      analysis.failedTests++;
      analysis.issues.push(`${result.test}: ${result.error || '测试失败'}`);
    }
    
    // 分析具体测试结果
    analysis.testDetails[result.test] = {
      success: result.success,
      duration: result.duration,
      exitCode: result.exitCode,
      hasOutput: !!(result.stdout || result.stderr),
      logFile: result.logFile
    };
    
    // 从输出中提取关键信息
    if (result.stdout) {
      // 兼容性测试结果分析
      if (result.test === 'demo3-compatibility') {
        const compatibilityMatch = result.stdout.match(/平均兼容性评分:\s*(\d+\.?\d*)%/);
        if (compatibilityMatch) {
          const score = parseFloat(compatibilityMatch[1]);
          analysis.testDetails[result.test].compatibilityScore = score;
          
          if (score < 80) {
            analysis.issues.push(`兼容性评分过低: ${score}%`);
            analysis.recommendations.push('需要改进CodeWhisperer与demo3的兼容性');
          }
        }
      }
      
      // 流水线测试结果分析
      if (result.test === 'pipeline-simulation') {
        const completenessMatch = result.stdout.match(/平均完整性评分:\s*(\d+\.?\d*)%/);
        if (completenessMatch) {
          const score = parseFloat(completenessMatch[1]);
          analysis.testDetails[result.test].completenessScore = score;
          
          if (score < 80) {
            analysis.issues.push(`流水线完整性评分过低: ${score}%`);
            analysis.recommendations.push('需要实现缺失的流水线阶段');
          }
        }
      }
    }
  }
  
  // 总体建议
  if (analysis.failedTests > 0) {
    analysis.recommendations.push('修复失败的测试用例');
  }
  
  if (analysis.totalDuration > 60000) {
    analysis.recommendations.push('优化测试执行性能，减少总耗时');
  }
  
  return analysis;
}

/**
 * 生成综合测试报告
 */
function generateComprehensiveReport(results, analysis) {
  const timestamp = new Date().toISOString();
  const reportFile = path.join(SCRIPT_CONFIG.logDir, `comprehensive-report-${timestamp.replace(/[:.]/g, '-')}.md`);
  
  let report = `# CodeWhisperer与demo3综合对比测试报告\n\n`;
  report += `**测试时间**: ${timestamp}\n`;
  report += `**测试脚本**: ${SCRIPT_CONFIG.tests.length}个\n`;
  report += `**总耗时**: ${analysis.totalDuration}ms\n\n`;
  
  // 执行摘要
  report += `## 📊 执行摘要\n\n`;
  report += `- **成功测试**: ${analysis.successfulTests}/${analysis.totalTests}\n`;
  report += `- **失败测试**: ${analysis.failedTests}/${analysis.totalTests}\n`;
  report += `- **成功率**: ${(analysis.successfulTests / analysis.totalTests * 100).toFixed(1)}%\n`;
  report += `- **平均耗时**: ${(analysis.totalDuration / analysis.totalTests).toFixed(0)}ms\n\n`;
  
  // 关键指标
  report += `## 🎯 关键指标\n\n`;
  
  for (const [testName, details] of Object.entries(analysis.testDetails)) {
    report += `### ${testName}\n\n`;
    report += `- **状态**: ${details.success ? '✅ 成功' : '❌ 失败'}\n`;
    report += `- **耗时**: ${details.duration}ms\n`;
    
    if (details.compatibilityScore !== undefined) {
      report += `- **兼容性评分**: ${details.compatibilityScore}%\n`;
    }
    
    if (details.completenessScore !== undefined) {
      report += `- **完整性评分**: ${details.completenessScore}%\n`;
    }
    
    report += `- **日志文件**: \`${details.logFile}\`\n\n`;
  }
  
  // 详细结果
  report += `## 📋 详细测试结果\n\n`;
  
  for (const result of results) {
    report += `### ${result.description}\n\n`;
    
    report += `- **测试名称**: ${result.test}\n`;
    report += `- **执行状态**: ${result.success ? '✅ 成功' : '❌ 失败'}\n`;
    report += `- **退出码**: ${result.exitCode || 'N/A'}\n`;
    report += `- **执行时间**: ${result.duration}ms\n`;
    
    if (result.error) {
      report += `- **错误信息**: ${result.error}\n`;
    }
    
    if (result.stdout && result.stdout.includes('测试总结')) {
      const summaryMatch = result.stdout.match(/🎯 测试总结:([\s\S]*?)(?=\n\n|\n$|$)/);
      if (summaryMatch) {
        report += `- **测试总结**:\n\`\`\`\n${summaryMatch[1].trim()}\n\`\`\`\n`;
      }
    }
    
    report += `- **详细日志**: \`${result.logFile}\`\n\n`;
  }
  
  // 问题和建议
  report += `## 🚨 发现的问题\n\n`;
  
  if (analysis.issues.length > 0) {
    for (const issue of analysis.issues) {
      report += `- ${issue}\n`;
    }
  } else {
    report += `🎉 未发现重大问题！\n`;
  }
  
  report += `\n## 🔧 改进建议\n\n`;
  
  if (analysis.recommendations.length > 0) {
    for (const recommendation of analysis.recommendations) {
      report += `- ${recommendation}\n`;
    }
  } else {
    report += `✨ 所有测试都通过，系统运行良好！\n`;
  }
  
  // 下一步行动
  report += `\n## 📋 下一步行动\n\n`;
  
  if (analysis.failedTests > 0) {
    report += `### 🚨 立即修复 (P0)\n\n`;
    for (const result of results) {
      if (!result.success) {
        report += `- 修复 ${result.test} 测试失败问题\n`;
      }
    }
    report += `\n`;
  }
  
  if (analysis.issues.length > 0) {
    report += `### 🔧 架构改进 (P1)\n\n`;
    const uniqueRecommendations = [...new Set(analysis.recommendations)];
    for (const rec of uniqueRecommendations) {
      report += `- ${rec}\n`;
    }
    report += `\n`;
  }
  
  report += `### 📈 持续优化 (P2)\n\n`;
  report += `- 定期执行综合测试，监控系统健康状态\n`;
  report += `- 扩展测试覆盖范围，增加更多边界情况\n`;
  report += `- 优化测试执行效率，减少总耗时\n`;
  
  report += `\n---\n`;
  report += `**报告生成时间**: ${timestamp}\n`;
  report += `**测试工具**: CodeWhisperer Demo3 Comprehensive Test v1.0\n`;
  report += `**项目所有者**: Jason Zhang\n`;
  
  fs.writeFileSync(reportFile, report);
  console.log(`\n📄 综合测试报告已生成: ${reportFile}`);
  
  return reportFile;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始CodeWhisperer与demo3综合对比测试');
  console.log(`📁 日志目录: ${SCRIPT_CONFIG.logDir}`);
  console.log(`⏱️  超时设置: ${SCRIPT_CONFIG.timeout}ms`);
  
  const results = [];
  
  // 按优先级排序执行测试
  const sortedTests = SCRIPT_CONFIG.tests.sort((a, b) => a.priority - b.priority);
  
  for (const test of sortedTests) {
    const result = await executeTestScript(test);
    results.push(result);
    
    // 如果高优先级测试失败，询问是否继续
    if (!result.success && test.priority === 1) {
      console.log(`\n⚠️  高优先级测试失败: ${test.name}`);
      console.log('是否继续执行后续测试？建议先修复此问题。');
      // 在实际使用中可以添加交互式确认
    }
  }
  
  // 分析结果
  const analysis = analyzeResults(results);
  
  // 生成综合报告
  const reportFile = generateComprehensiveReport(results, analysis);
  
  // 输出最终总结
  console.log('\n🎯 综合测试总结:');
  console.log(`  ✅ 成功测试: ${analysis.successfulTests}/${analysis.totalTests}`);
  console.log(`  ❌ 失败测试: ${analysis.failedTests}/${analysis.totalTests}`);
  console.log(`  📊 成功率: ${(analysis.successfulTests / analysis.totalTests * 100).toFixed(1)}%`);
  console.log(`  ⏱️  总耗时: ${analysis.totalDuration}ms`);
  console.log(`  📄 详细报告: ${reportFile}`);
  
  // 输出关键指标
  for (const [testName, details] of Object.entries(analysis.testDetails)) {
    if (details.compatibilityScore !== undefined) {
      console.log(`  🔗 ${testName} 兼容性: ${details.compatibilityScore}%`);
    }
    if (details.completenessScore !== undefined) {
      console.log(`  🔄 ${testName} 完整性: ${details.completenessScore}%`);
    }
  }
  
  // 根据结果设置退出码
  const overallSuccess = analysis.successfulTests === analysis.totalTests;
  const hasGoodScores = Object.values(analysis.testDetails).every(details => 
    (details.compatibilityScore === undefined || details.compatibilityScore >= 80) &&
    (details.completenessScore === undefined || details.completenessScore >= 80)
  );
  
  if (overallSuccess && hasGoodScores) {
    console.log('\n🎉 所有测试通过，系统运行良好！');
    process.exit(0);
  } else {
    console.log('\n⚠️  发现问题，请查看详细报告进行修复。');
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 综合测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  executeTestScript,
  analyzeResults,
  generateComprehensiveReport
};