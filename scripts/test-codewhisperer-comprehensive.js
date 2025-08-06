#!/usr/bin/env node

/**
 * CodeWhisperer综合测试流程
 * 按照用户要求的分阶段测试：健康检查 → 黑盒测试 → 服务器测试
 * 节省token使用，确保每个阶段都验证通过再进行下一阶段
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 综合测试配置
const COMPREHENSIVE_TEST_CONFIG = {
  logDir: '/tmp/codewhisperer-comprehensive',
  timeout: 300000, // 5分钟总超时
  
  // 测试阶段定义
  stages: [
    {
      name: 'health_check',
      description: '健康检查阶段 - 验证系统基本功能',
      script: './scripts/test-codewhisperer-health-check.js',
      priority: 1,
      tokenUsage: 'minimal', // 最小token使用
      required: true,
      successCriteria: {
        exitCode: 0,
        description: '系统基本健康，可以进行后续测试'
      }
    },
    {
      name: 'blackbox_analysis',
      description: '黑盒测试阶段 - 离线分析二进制数据',
      script: './scripts/test-codewhisperer-binary-blackbox.js',
      priority: 2,
      tokenUsage: 'none', // 不使用token
      required: false,
      dependsOn: ['health_check'],
      successCriteria: {
        exitCode: 0,
        description: '二进制数据解析成功，格式验证通过'
      }
    },
    {
      name: 'compatibility_test',
      description: '兼容性测试阶段 - 与demo3对比',
      script: './tests/codewhisperer/test-demo3-compatibility.js',
      priority: 3,
      tokenUsage: 'moderate', // 中等token使用
      required: false,
      dependsOn: ['health_check'],
      successCriteria: {
        exitCode: 0,
        description: '兼容性评分≥80%'
      }
    },
    {
      name: 'pipeline_simulation',
      description: '流水线测试阶段 - 完整流水线验证',
      script: './tests/codewhisperer/test-pipeline-simulation.js',
      priority: 4,
      tokenUsage: 'high', // 高token使用
      required: false,
      dependsOn: ['health_check', 'compatibility_test'],
      successCriteria: {
        exitCode: 0,
        description: '流水线完整性评分≥80%'
      }
    }
  ]
};

// 确保日志目录存在
if (!fs.existsSync(COMPREHENSIVE_TEST_CONFIG.logDir)) {
  fs.mkdirSync(COMPREHENSIVE_TEST_CONFIG.logDir, { recursive: true });
}

/**
 * 执行单个测试阶段
 */
function executeStage(stage) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(COMPREHENSIVE_TEST_CONFIG.logDir, `${stage.name}-${timestamp}.log`);
    
    console.log(`\n🚀 执行阶段: ${stage.description}`);
    console.log(`📝 日志文件: ${logFile}`);
    console.log(`🪙 Token使用: ${stage.tokenUsage}`);
    console.log(`🔧 脚本: ${stage.script}`);
    
    // 检查脚本是否存在
    if (!fs.existsSync(stage.script)) {
      const error = `测试脚本不存在: ${stage.script}`;
      console.error(`❌ ${error}`);
      resolve({
        stage: stage.name,
        success: false,
        error,
        duration: 0,
        logFile
      });
      return;
    }
    
    const startTime = Date.now();
    const logStream = fs.createWriteStream(logFile);
    
    // 启动子进程
    const child = spawn('node', [stage.script], {
      cwd: process.cwd(),
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
      process.stdout.write(`  ${text}`); // 缩进显示
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      logStream.write(`[STDERR] ${text}`);
      process.stderr.write(`  ${text}`); // 缩进显示
    });
    
    // 设置超时
    const timeoutId = setTimeout(() => {
      console.log(`⏰ 阶段超时，终止进程: ${stage.name}`);
      child.kill('SIGTERM');
    }, COMPREHENSIVE_TEST_CONFIG.timeout);
    
    // 处理进程结束
    child.on('close', (code) => {
      clearTimeout(timeoutId);
      logStream.end();
      
      const duration = Date.now() - startTime;
      const success = code === 0;
      
      console.log(`${success ? '✅' : '❌'} 阶段${success ? '成功' : '失败'}: ${stage.name} (${duration}ms, 退出码: ${code})`);
      
      // 提取关键指标
      const metrics = extractMetrics(stdout, stage);
      
      resolve({
        stage: stage.name,
        description: stage.description,
        success,
        exitCode: code,
        duration,
        stdout,
        stderr,
        logFile,
        metrics,
        tokenUsage: stage.tokenUsage
      });
    });
    
    child.on('error', (error) => {
      clearTimeout(timeoutId);
      logStream.end();
      
      const duration = Date.now() - startTime;
      console.error(`❌ 阶段进程错误: ${stage.name} - ${error.message}`);
      
      resolve({
        stage: stage.name,
        description: stage.description,
        success: false,
        error: error.message,
        duration,
        logFile,
        tokenUsage: stage.tokenUsage
      });
    });
  });
}

/**
 * 从输出中提取关键指标
 */
function extractMetrics(stdout, stage) {
  const metrics = {};
  
  try {
    switch (stage.name) {
      case 'health_check':
        // 提取健康检查指标
        const healthMatch = stdout.match(/系统状态:\s*(\w+)/);
        if (healthMatch) {
          metrics.systemHealth = healthMatch[1];
        }
        
        const testMatch = stdout.match(/通过测试:\s*(\d+)\/(\d+)/);
        if (testMatch) {
          metrics.passedTests = parseInt(testMatch[1]);
          metrics.totalTests = parseInt(testMatch[2]);
          metrics.passRate = (metrics.passedTests / metrics.totalTests * 100).toFixed(1);
        }
        
        const tokenTestMatch = stdout.match(/可以进行token测试:\s*(是|否)/);
        if (tokenTestMatch) {
          metrics.canProceedWithTokenTests = tokenTestMatch[1] === '是';
        }
        break;
        
      case 'blackbox_analysis':
        // 提取黑盒测试指标
        const parseMatch = stdout.match(/成功解析:\s*(\d+)\/(\d+)/);
        if (parseMatch) {
          metrics.successfulParses = parseInt(parseMatch[1]);
          metrics.totalFiles = parseInt(parseMatch[2]);
          metrics.parseRate = (metrics.successfulParses / metrics.totalFiles * 100).toFixed(1);
        }
        
        const demo3Match = stdout.match(/demo3对比:\s*(\d+)个/);
        if (demo3Match) {
          metrics.demo3Comparisons = parseInt(demo3Match[1]);
        }
        break;
        
      case 'compatibility_test':
        // 提取兼容性测试指标
        const compatibilityMatch = stdout.match(/平均兼容性评分:\s*(\d+\.?\d*)%/);
        if (compatibilityMatch) {
          metrics.compatibilityScore = parseFloat(compatibilityMatch[1]);
        }
        
        const successMatch = stdout.match(/成功测试:\s*(\d+)\/(\d+)/);
        if (successMatch) {
          metrics.successfulTests = parseInt(successMatch[1]);
          metrics.totalTests = parseInt(successMatch[2]);
        }
        break;
        
      case 'pipeline_simulation':
        // 提取流水线测试指标
        const completenessMatch = stdout.match(/平均完整性评分:\s*(\d+\.?\d*)%/);
        if (completenessMatch) {
          metrics.completenessScore = parseFloat(completenessMatch[1]);
        }
        
        const pipelineSuccessMatch = stdout.match(/成功测试:\s*(\d+)\/(\d+)/);
        if (pipelineSuccessMatch) {
          metrics.successfulTests = parseInt(pipelineSuccessMatch[1]);
          metrics.totalTests = parseInt(pipelineSuccessMatch[2]);
        }
        break;
    }
  } catch (error) {
    console.log(`    ⚠️  指标提取失败: ${error.message}`);
  }
  
  return metrics;
}

/**
 * 检查阶段依赖
 */
function checkDependencies(stage, completedStages) {
  if (!stage.dependsOn || stage.dependsOn.length === 0) {
    return { canExecute: true };
  }
  
  const missingDeps = [];
  const failedDeps = [];
  
  for (const dep of stage.dependsOn) {
    const depResult = completedStages.find(s => s.stage === dep);
    if (!depResult) {
      missingDeps.push(dep);
    } else if (!depResult.success) {
      failedDeps.push(dep);
    }
  }
  
  if (missingDeps.length > 0) {
    return {
      canExecute: false,
      reason: `缺少依赖阶段: ${missingDeps.join(', ')}`
    };
  }
  
  if (failedDeps.length > 0) {
    return {
      canExecute: false,
      reason: `依赖阶段失败: ${failedDeps.join(', ')}`
    };
  }
  
  return { canExecute: true };
}

/**
 * 分析综合测试结果
 */
function analyzeComprehensiveResults(results) {
  const analysis = {
    totalStages: results.length,
    completedStages: results.filter(r => !r.skipped).length,
    successfulStages: results.filter(r => r.success).length,
    skippedStages: results.filter(r => r.skipped).length,
    totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
    tokenUsage: {
      none: results.filter(r => r.tokenUsage === 'none').length,
      minimal: results.filter(r => r.tokenUsage === 'minimal').length,
      moderate: results.filter(r => r.tokenUsage === 'moderate').length,
      high: results.filter(r => r.tokenUsage === 'high').length
    },
    overallHealth: 'unknown',
    recommendations: [],
    nextSteps: []
  };
  
  // 确定整体健康状态
  const healthCheckResult = results.find(r => r.stage === 'health_check');
  const blackboxResult = results.find(r => r.stage === 'blackbox_analysis');
  const compatibilityResult = results.find(r => r.stage === 'compatibility_test');
  const pipelineResult = results.find(r => r.stage === 'pipeline_simulation');
  
  if (!healthCheckResult?.success) {
    analysis.overallHealth = 'critical';
    analysis.recommendations.push('系统基础功能有问题，需要立即修复');
    analysis.nextSteps.push('检查服务器状态和认证配置');
  } else if (blackboxResult && !blackboxResult.success) {
    analysis.overallHealth = 'data_format_issue';
    analysis.recommendations.push('二进制数据格式有问题，需要检查parser实现');
    analysis.nextSteps.push('基于黑盒测试结果修复数据解析逻辑');
  } else if (compatibilityResult && !compatibilityResult.success) {
    analysis.overallHealth = 'compatibility_issue';
    analysis.recommendations.push('与demo3兼容性有问题，需要对齐实现');
    analysis.nextSteps.push('基于兼容性测试结果修复差异');
  } else if (pipelineResult && !pipelineResult.success) {
    analysis.overallHealth = 'pipeline_issue';
    analysis.recommendations.push('流水线集成有问题，需要完善架构');
    analysis.nextSteps.push('实现缺失的流水线阶段');
  } else if (analysis.successfulStages === analysis.completedStages) {
    analysis.overallHealth = 'healthy';
    analysis.recommendations.push('所有测试阶段都通过，系统运行良好');
    analysis.nextSteps.push('可以进行生产环境部署');
  } else {
    analysis.overallHealth = 'partial';
    analysis.recommendations.push('部分测试通过，需要修复失败的阶段');
  }
  
  // Token使用分析
  const tokenConsumingStages = results.filter(r => 
    r.success && ['minimal', 'moderate', 'high'].includes(r.tokenUsage)
  ).length;
  
  if (tokenConsumingStages > 0) {
    analysis.recommendations.push(`已使用token的测试阶段: ${tokenConsumingStages}个`);
  }
  
  return analysis;
}

/**
 * 生成综合测试报告
 */
function generateComprehensiveReport(results, analysis) {
  const timestamp = new Date().toISOString();
  const reportFile = path.join(COMPREHENSIVE_TEST_CONFIG.logDir, `comprehensive-report-${timestamp.replace(/[:.]/g, '-')}.md`);
  
  let report = `# CodeWhisperer综合测试报告\n\n`;
  report += `**测试时间**: ${timestamp}\n`;
  report += `**总体健康状态**: ${analysis.overallHealth}\n`;
  report += `**完成阶段**: ${analysis.completedStages}/${analysis.totalStages}\n`;
  report += `**成功阶段**: ${analysis.successfulStages}/${analysis.completedStages}\n`;
  report += `**总耗时**: ${analysis.totalDuration}ms\n\n`;
  
  // 测试流程概览
  report += `## 🔄 测试流程概览\n\n`;
  report += `本次测试按照分阶段策略执行，确保在使用有限token之前验证系统健康状态：\n\n`;
  report += `1. **健康检查阶段** - 验证系统基本功能 (最小token使用)\n`;
  report += `2. **黑盒测试阶段** - 离线分析二进制数据 (不使用token)\n`;
  report += `3. **兼容性测试阶段** - 与demo3对比 (中等token使用)\n`;
  report += `4. **流水线测试阶段** - 完整流水线验证 (高token使用)\n\n`;
  
  // Token使用统计
  report += `## 🪙 Token使用统计\n\n`;
  report += `| 使用级别 | 阶段数量 | 说明 |\n`;
  report += `|----------|----------|------|\n`;
  report += `| 不使用 | ${analysis.tokenUsage.none} | 离线分析，不消耗token |\n`;
  report += `| 最小使用 | ${analysis.tokenUsage.minimal} | 基础健康检查 |\n`;
  report += `| 中等使用 | ${analysis.tokenUsage.moderate} | 兼容性对比测试 |\n`;
  report += `| 高使用 | ${analysis.tokenUsage.high} | 完整功能测试 |\n\n`;
  
  // 详细阶段结果
  report += `## 📋 详细阶段结果\n\n`;
  
  for (const result of results) {
    report += `### ${result.description}\n\n`;
    
    if (result.skipped) {
      report += `⏭️ **状态**: 跳过 - ${result.skipReason}\n\n`;
      continue;
    }
    
    report += `- **阶段名称**: ${result.stage}\n`;
    report += `- **执行状态**: ${result.success ? '✅ 成功' : '❌ 失败'}\n`;
    report += `- **退出码**: ${result.exitCode || 'N/A'}\n`;
    report += `- **执行时间**: ${result.duration}ms\n`;
    report += `- **Token使用**: ${result.tokenUsage}\n`;
    
    if (result.error) {
      report += `- **错误信息**: ${result.error}\n`;
    }
    
    // 关键指标
    if (result.metrics && Object.keys(result.metrics).length > 0) {
      report += `- **关键指标**:\n`;
      for (const [key, value] of Object.entries(result.metrics)) {
        report += `  - ${key}: ${value}\n`;
      }
    }
    
    report += `- **详细日志**: \`${result.logFile}\`\n\n`;
  }
  
  // 问题诊断
  report += `## 🔧 问题诊断\n\n`;
  
  const healthStatus = {
    'healthy': '✅ 系统健康，所有测试通过',
    'critical': '🚨 系统严重问题，基础功能失败',
    'data_format_issue': '📊 数据格式问题，需要修复parser',
    'compatibility_issue': '🔗 兼容性问题，需要对齐demo3标准',
    'pipeline_issue': '🔄 流水线问题，需要完善架构',
    'partial': '⚠️ 部分问题，需要修复失败的阶段',
    'unknown': '❓ 状态未知，需要进一步检查'
  };
  
  report += `**诊断结果**: ${healthStatus[analysis.overallHealth] || analysis.overallHealth}\n\n`;
  
  // 建议和下一步
  report += `## 💡 建议和下一步行动\n\n`;
  
  if (analysis.recommendations.length > 0) {
    report += `### 建议\n\n`;
    for (const recommendation of analysis.recommendations) {
      report += `- ${recommendation}\n`;
    }
    report += `\n`;
  }
  
  if (analysis.nextSteps.length > 0) {
    report += `### 下一步行动\n\n`;
    for (const step of analysis.nextSteps) {
      report += `- ${step}\n`;
    }
    report += `\n`;
  }
  
  // Token节省效果
  const skippedHighTokenStages = results.filter(r => 
    r.skipped && ['moderate', 'high'].includes(r.tokenUsage)
  ).length;
  
  if (skippedHighTokenStages > 0) {
    report += `### 🎯 Token节省效果\n\n`;
    report += `通过分阶段测试策略，成功跳过了 ${skippedHighTokenStages} 个高token消耗的测试阶段，\n`;
    report += `避免了在系统有问题的情况下浪费宝贵的token配额。\n\n`;
  }
  
  report += `---\n`;
  report += `**报告生成时间**: ${timestamp}\n`;
  report += `**测试工具**: CodeWhisperer Comprehensive Test v1.0\n`;
  report += `**项目所有者**: Jason Zhang\n`;
  
  fs.writeFileSync(reportFile, report);
  console.log(`\n📄 综合测试报告已生成: ${reportFile}`);
  
  return reportFile;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始CodeWhisperer综合测试流程');
  console.log(`📁 日志目录: ${COMPREHENSIVE_TEST_CONFIG.logDir}`);
  console.log(`⏱️ 超时设置: ${COMPREHENSIVE_TEST_CONFIG.timeout}ms`);
  console.log(`🪙 策略: 分阶段测试，节省token使用`);
  
  const results = [];
  const completedStages = [];
  
  // 按优先级排序执行阶段
  const sortedStages = COMPREHENSIVE_TEST_CONFIG.stages.sort((a, b) => a.priority - b.priority);
  
  for (const stage of sortedStages) {
    // 检查依赖
    const depCheck = checkDependencies(stage, completedStages);
    
    if (!depCheck.canExecute) {
      console.log(`\n⏭️ 跳过阶段: ${stage.description}`);
      console.log(`   原因: ${depCheck.reason}`);
      
      results.push({
        stage: stage.name,
        description: stage.description,
        skipped: true,
        skipReason: depCheck.reason,
        tokenUsage: stage.tokenUsage
      });
      continue;
    }
    
    // 执行阶段
    const result = await executeStage(stage);
    results.push(result);
    completedStages.push(result);
    
    // 检查是否满足成功条件
    if (!result.success && stage.required) {
      console.log(`\n🚨 必需阶段失败，停止后续测试: ${stage.description}`);
      console.log(`   这样可以避免浪费token在有问题的系统上`);
      break;
    }
    
    // 特殊逻辑：如果健康检查失败，询问是否继续
    if (stage.name === 'health_check' && !result.success) {
      console.log(`\n⚠️ 健康检查失败，建议先修复基础问题再继续测试`);
      console.log(`   继续测试可能会浪费宝贵的token配额`);
      
      // 在实际使用中可以添加交互式确认
      // 这里直接停止以节省token
      break;
    }
  }
  
  // 分析结果
  const analysis = analyzeComprehensiveResults(results);
  
  // 生成综合报告
  const reportFile = generateComprehensiveReport(results, analysis);
  
  // 输出最终总结
  console.log('\n🎯 综合测试总结:');
  console.log(`  🏥 整体健康状态: ${analysis.overallHealth}`);
  console.log(`  ✅ 成功阶段: ${analysis.successfulStages}/${analysis.completedStages}`);
  console.log(`  ⏭️ 跳过阶段: ${analysis.skippedStages}个`);
  console.log(`  ⏱️ 总耗时: ${analysis.totalDuration}ms`);
  console.log(`  📄 详细报告: ${reportFile}`);
  
  // Token使用总结
  const tokenStages = analysis.tokenUsage.minimal + analysis.tokenUsage.moderate + analysis.tokenUsage.high;
  console.log(`  🪙 Token使用阶段: ${tokenStages}个`);
  
  if (analysis.overallHealth === 'healthy') {
    console.log('\n🎉 所有测试阶段都通过，CodeWhisperer系统运行良好！');
  } else {
    console.log('\n⚠️ 发现问题，请查看详细报告进行修复');
    console.log('   分阶段测试策略成功节省了token使用');
  }
  
  // 根据结果设置退出码
  const overallSuccess = analysis.overallHealth === 'healthy';
  process.exit(overallSuccess ? 0 : 1);
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 综合测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  executeStage,
  checkDependencies,
  analyzeComprehensiveResults,
  generateComprehensiveReport
};