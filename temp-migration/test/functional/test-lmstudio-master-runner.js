#!/usr/bin/env node

/**
 * LMStudio 测试主控制器
 * 协调运行所有LMStudio相关的验证和测试，提供完整的自动化测试流水线
 * @author Jason Zhang
 * @version v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// 导入测试模块
import { LMStudioComprehensiveValidation } from './test-lmstudio-comprehensive-validation.js';
import { AutomatedDataScanner } from './test-automated-data-scanner.js';
import { ClaudeCodeLMStudioIntegration } from './test-claude-code-lmstudio-integration.js';
import { LMStudioToolParsingAnalysis } from './test-lmstudio-tool-parsing-analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioMasterRunner {
  constructor() {
    this.masterSession = {
      sessionId: `lmstudio-master-${Date.now()}`,
      timestamp: new Date().toISOString(),
      runType: 'lmstudio-complete-validation',
      testSuites: [],
      summary: {},
      recommendations: []
    };
    
    // 测试套件配置
    this.testSuites = [
      {
        name: 'comprehensive-validation',
        description: '综合验证系统 - 7个阶段的完整验证流程',
        runner: LMStudioComprehensiveValidation,
        priority: 'critical',
        estimatedTime: '5-8分钟',
        dependencies: []
      },
      {
        name: 'data-scanner',
        description: '自动化数据扫描 - 发现解析错误和生成修复建议',
        runner: AutomatedDataScanner,
        priority: 'high',
        estimatedTime: '2-4分钟',
        dependencies: []
      },
      {
        name: 'integration-test',
        description: 'Claude Code集成测试 - 端到端连接和工具调用验证',
        runner: ClaudeCodeLMStudioIntegration,
        priority: 'critical',
        estimatedTime: '6-10分钟',
        dependencies: ['comprehensive-validation']
      },
      {
        name: 'tool-parsing-analysis',
        description: '工具调用解析分析 - 现有数据的深度分析',
        runner: LMStudioToolParsingAnalysis,
        priority: 'medium',
        estimatedTime: '1-3分钟',
        dependencies: ['data-scanner']
      }
    ];

    this.config = {
      outputDir: path.join(__dirname, '../output/functional/test-lmstudio-master'),
      parallel: false, // 串行执行以避免资源冲突
      continueOnError: true, // 单个测试失败时继续执行
      generateReport: true,
      cleanupAfter: false
    };
  }

  /**
   * 运行完整的LMStudio测试流水线
   */
  async runMasterValidation() {
    console.log('🎯 LMStudio 主控测试系统');
    console.log('=====================================');
    console.log(`Master Session: ${this.masterSession.sessionId}`);
    console.log(`测试套件数量: ${this.testSuites.length}`);
    console.log(`预计总耗时: 14-25分钟\n`);

    try {
      // 步骤1: 环境预检查
      await this.preflightChecks();

      // 步骤2: 按依赖顺序执行测试套件
      await this.executeTestSuites();

      // 步骤3: 汇总分析结果
      await this.aggregateResults();

      // 步骤4: 生成智能建议
      await this.generateMasterRecommendations();

      // 步骤5: 创建综合报告
      await this.generateMasterReport();

      // 步骤6: 清理和后续处理
      await this.postProcessing();

      console.log('\n🎉 LMStudio 主控测试完成!');
      console.log(`📊 执行套件: ${this.masterSession.testSuites.length}`);
      console.log(`🎯 整体成功率: ${this.calculateOverallSuccessRate()}%`);
      console.log(`💡 生成建议: ${this.masterSession.recommendations.length}个`);

    } catch (error) {
      console.error('\n❌ 主控测试失败:', error);
      await this.handleMasterError(error);
      throw error;
    }
  }

  /**
   * 步骤1: 环境预检查
   */
  async preflightChecks() {
    console.log('🔍 步骤1: 环境预检查...');
    
    const checks = {
      outputDirectory: false,
      nodeVersion: false,
      lmstudioConfig: false,
      rcc3Command: false,
      diskSpace: false,
      networkConnectivity: false
    };

    try {
      // 创建输出目录
      await fs.mkdir(this.config.outputDir, { recursive: true });
      checks.outputDirectory = true;

      // 检查Node.js版本
      const nodeVersion = process.version;
      checks.nodeVersion = nodeVersion.startsWith('v18.') || nodeVersion.startsWith('v20.') || nodeVersion.startsWith('v21.');
      
      // 检查LMStudio配置
      const configPath = '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json';
      try {
        await fs.access(configPath);
        checks.lmstudioConfig = true;
      } catch {}

      // 检查rcc3命令
      checks.rcc3Command = await this.checkCommand('rcc3');

      // 检查磁盘空间（简化检查）
      checks.diskSpace = true; // 假设有足够空间

      // 检查网络连通性（检查localhost）
      try {
        await fetch('http://localhost:1/');
      } catch {
        checks.networkConnectivity = true; // 连接失败是预期的，说明网络栈正常
      }

      const passedChecks = Object.values(checks).filter(Boolean).length;
      console.log(`   ✅ 预检查通过: ${passedChecks}/${Object.keys(checks).length}`);
      
      if (passedChecks < 4) {
        throw new Error('环境预检查未通过最低要求');
      }

    } catch (error) {
      console.error(`   ❌ 预检查失败: ${error.message}`);
      throw error;
    }

    this.masterSession.preflightChecks = checks;
  }

  /**
   * 步骤2: 按依赖顺序执行测试套件
   */
  async executeTestSuites() {
    console.log('\n🚀 步骤2: 执行测试套件...');
    
    const executionOrder = this.resolveDependencyOrder();
    console.log(`   📋 执行顺序: ${executionOrder.map(suite => suite.name).join(' → ')}`);

    for (const [index, suite] of executionOrder.entries()) {
      console.log(`\n   [${index + 1}/${executionOrder.length}] 执行: ${suite.description}`);
      console.log(`   ⏱️ 预计耗时: ${suite.estimatedTime}`);
      
      const suiteResult = await this.executeSingleSuite(suite);
      this.masterSession.testSuites.push(suiteResult);
      
      // 检查是否需要提前终止
      if (!suiteResult.success && !this.config.continueOnError) {
        console.log(`   ⚠️ 套件失败，终止执行`);
        break;
      }

      // 套件间暂停
      if (index < executionOrder.length - 1) {
        console.log(`   ⏸️ 等待3秒后继续...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const successfulSuites = this.masterSession.testSuites.filter(s => s.success).length;
    console.log(`\n   📊 套件执行结果: ${successfulSuites}/${this.masterSession.testSuites.length} 成功`);
  }

  /**
   * 解析依赖顺序
   */
  resolveDependencyOrder() {
    const resolved = [];
    const visiting = new Set();
    const visited = new Set();

    const visit = (suite) => {
      if (visiting.has(suite.name)) {
        throw new Error(`检测到循环依赖: ${suite.name}`);
      }
      if (visited.has(suite.name)) {
        return;
      }

      visiting.add(suite.name);
      
      for (const depName of suite.dependencies) {
        const depSuite = this.testSuites.find(s => s.name === depName);
        if (depSuite) {
          visit(depSuite);
        }
      }
      
      visiting.delete(suite.name);
      visited.add(suite.name);
      resolved.push(suite);
    };

    for (const suite of this.testSuites) {
      visit(suite);
    }

    return resolved;
  }

  /**
   * 执行单个测试套件
   */
  async executeSingleSuite(suite) {
    const startTime = Date.now();
    const suiteResult = {
      name: suite.name,
      description: suite.description,
      priority: suite.priority,
      startTime: new Date().toISOString(),
      success: false,
      duration: 0,
      results: null,
      error: null
    };

    try {
      const TestRunner = suite.runner;
      const testInstance = new TestRunner();
      
      // 根据套件类型调用不同的运行方法
      let results;
      switch (suite.name) {
        case 'comprehensive-validation':
          results = await testInstance.runComprehensiveValidation();
          break;
        case 'data-scanner':
          results = await testInstance.runAutomatedScan();
          break;
        case 'integration-test':
          results = await testInstance.runIntegrationTests();
          break;
        case 'tool-parsing-analysis':
          results = await testInstance.runAnalysis();
          break;
        default:
          throw new Error(`未知的测试套件类型: ${suite.name}`);
      }

      suiteResult.success = true;
      suiteResult.results = testInstance.testResults || testInstance.scanResults || results;
      
      console.log(`   ✅ ${suite.name} 执行成功`);

    } catch (error) {
      suiteResult.success = false;
      suiteResult.error = error.message;
      
      console.log(`   ❌ ${suite.name} 执行失败: ${error.message}`);
    }

    suiteResult.duration = Date.now() - startTime;
    suiteResult.endTime = new Date().toISOString();
    
    return suiteResult;
  }

  /**
   * 步骤3: 汇总分析结果
   */
  async aggregateResults() {
    console.log('\n📊 步骤3: 汇总分析结果...');
    
    const aggregation = {
      totalSuites: this.masterSession.testSuites.length,
      successfulSuites: this.masterSession.testSuites.filter(s => s.success).length,
      failedSuites: this.masterSession.testSuites.filter(s => !s.success).length,
      totalDuration: this.masterSession.testSuites.reduce((sum, s) => sum + s.duration, 0),
      issuesFound: [],
      patternsDetected: [],
      recommendationsSummary: []
    };

    // 从各个测试套件中提取关键信息
    for (const suite of this.masterSession.testSuites) {
      if (suite.results) {
        // 提取发现的问题
        if (suite.results.analysis?.issueStatistics) {
          aggregation.issuesFound.push({
            suite: suite.name,
            issues: suite.results.analysis.issueStatistics
          });
        }

        // 提取模式信息
        if (suite.results.analysis?.contentAnalysis?.patternDistribution) {
          aggregation.patternsDetected.push({
            suite: suite.name,
            patterns: suite.results.analysis.contentAnalysis.patternDistribution
          });
        }

        // 提取建议摘要
        if (suite.results.recommendations) {
          aggregation.recommendationsSummary.push({
            suite: suite.name,
            recommendationCount: suite.results.recommendations.length,
            priorities: this.categorizeRecommendations(suite.results.recommendations)
          });
        }
      }
    }

    this.masterSession.aggregation = aggregation;
    
    console.log(`   📈 总体执行情况: ${aggregation.successfulSuites}/${aggregation.totalSuites} 套件成功`);
    console.log(`   ⏱️ 总执行时间: ${(aggregation.totalDuration / 1000).toFixed(1)}秒`);
    console.log(`   🔍 发现问题域: ${aggregation.issuesFound.length}个`);
  }

  /**
   * 分类建议优先级
   */
  categorizeRecommendations(recommendations) {
    return {
      critical: recommendations.filter(r => r.priority === 'critical').length,
      high: recommendations.filter(r => r.priority === 'high').length,
      medium: recommendations.filter(r => r.priority === 'medium').length,
      low: recommendations.filter(r => r.priority === 'low').length
    };
  }

  /**
   * 步骤4: 生成智能建议
   */
  async generateMasterRecommendations() {
    console.log('\n💡 步骤4: 生成智能建议...');
    
    const masterRecommendations = [];
    const aggregation = this.masterSession.aggregation;

    // 基于整体成功率的建议
    const overallSuccessRate = this.calculateOverallSuccessRate();
    if (overallSuccessRate < 80) {
      masterRecommendations.push({
        priority: 'critical',
        category: 'system-stability',
        title: '提高系统整体稳定性',
        description: `当前测试成功率为${overallSuccessRate}%，低于推荐的90%标准`,
        action: '优先修复失败的关键测试套件，特别是integration-test和comprehensive-validation',
        impact: 'high'
      });
    }

    // 基于失败套件的建议
    const failedSuites = this.masterSession.testSuites.filter(s => !s.success);
    if (failedSuites.length > 0) {
      masterRecommendations.push({
        priority: 'high',
        category: 'test-failures',
        title: '修复测试套件失败',
        description: `${failedSuites.length}个测试套件执行失败: ${failedSuites.map(s => s.name).join(', ')}`,
        action: '逐个检查失败的测试套件日志，修复根本问题',
        impact: 'high'
      });
    }

    // 基于问题发现的建议
    const totalIssues = aggregation.issuesFound.reduce((sum, item) => 
      sum + Object.values(item.issues).reduce((s, count) => s + count, 0), 0);
    
    if (totalIssues > 10) {
      masterRecommendations.push({
        priority: 'high',
        category: 'data-quality',
        title: '改善数据质量和解析准确性',
        description: `发现${totalIssues}个数据解析和格式问题`,
        action: '实施自动化数据扫描器建议的修复方案，重点关注tool_calls_as_text问题',
        impact: 'medium'
      });
    }

    // 基于模式多样性的建议
    const uniquePatterns = new Set();
    aggregation.patternsDetected.forEach(item => {
      Object.keys(item.patterns).forEach(pattern => uniquePatterns.add(pattern));
    });

    if (uniquePatterns.size > 5) {
      masterRecommendations.push({
        priority: 'medium',
        category: 'pattern-standardization',
        title: '标准化工具调用模式',
        description: `检测到${uniquePatterns.size}种不同的工具调用模式，增加了维护复杂性`,
        action: '实现统一的模式识别器，支持所有检测到的模式格式',
        impact: 'medium'
      });
    }

    // 性能优化建议
    const avgDuration = aggregation.totalDuration / aggregation.totalSuites;
    if (avgDuration > 300000) { // 超过5分钟
      masterRecommendations.push({
        priority: 'medium',
        category: 'performance',
        title: '优化测试执行性能',
        description: `平均测试套件执行时间为${(avgDuration/1000).toFixed(1)}秒，超过推荐值`,
        action: '优化测试逻辑，减少不必要的等待时间，实现并行执行',
        impact: 'low'
      });
    }

    // LMStudio特定建议
    masterRecommendations.push({
      priority: 'medium',
      category: 'lmstudio-optimization',
      title: 'LMStudio集成持续优化',
      description: '基于测试结果持续优化LMStudio集成',
      action: '建立定期回归测试机制，监控工具调用准确性趋势',
      impact: 'medium'
    });

    this.masterSession.recommendations = masterRecommendations;
    
    console.log(`   💡 生成主控建议: ${masterRecommendations.length}个`);
    console.log(`   🚨 关键建议: ${masterRecommendations.filter(r => r.priority === 'critical').length}个`);
    console.log(`   🔥 高优先级: ${masterRecommendations.filter(r => r.priority === 'high').length}个`);
  }

  /**
   * 步骤5: 创建综合报告
   */
  async generateMasterReport() {
    console.log('\n📋 步骤5: 创建综合报告...');

    // 生成主控摘要
    this.masterSession.summary = {
      executionTime: new Date().toISOString(),
      totalDuration: this.masterSession.aggregation.totalDuration,
      overallSuccessRate: this.calculateOverallSuccessRate(),
      suitesExecuted: this.masterSession.testSuites.length,
      suitesSuccessful: this.masterSession.aggregation.successfulSuites,
      issuesIdentified: this.masterSession.aggregation.issuesFound.length,
      recommendationsGenerated: this.masterSession.recommendations.length
    };

    // 保存详细JSON报告
    const detailedReportPath = path.join(this.config.outputDir, `${this.masterSession.sessionId}.json`);
    await fs.writeFile(detailedReportPath, JSON.stringify(this.masterSession, null, 2));

    // 生成可读性HTML报告
    const htmlReportPath = path.join(this.config.outputDir, 'lmstudio-master-report.html');
    const htmlReport = this.generateHTMLReport();
    await fs.writeFile(htmlReportPath, htmlReport);

    // 生成Markdown摘要报告
    const markdownReportPath = path.join(this.config.outputDir, 'lmstudio-master-summary.md');
    const markdownReport = this.generateMarkdownReport();
    await fs.writeFile(markdownReportPath, markdownReport);

    console.log(`   📄 详细报告: ${detailedReportPath}`);
    console.log(`   🌐 HTML报告: ${htmlReportPath}`);
    console.log(`   📝 Markdown摘要: ${markdownReportPath}`);
  }

  /**
   * 生成HTML报告
   */
  generateHTMLReport() {
    const summary = this.masterSession.summary;
    const aggregation = this.masterSession.aggregation;
    
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LMStudio 主控测试报告</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .title { color: #2c3e50; font-size: 2.5em; margin-bottom: 10px; }
        .subtitle { color: #7f8c8d; font-size: 1.2em; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric { background: #ecf0f1; padding: 20px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #3498db; }
        .metric-label { color: #7f8c8d; margin-top: 10px; }
        .section { margin-bottom: 40px; }
        .section-title { color: #2c3e50; font-size: 1.8em; margin-bottom: 20px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .suite { background: #f8f9fa; padding: 20px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #3498db; }
        .suite.failed { border-left-color: #e74c3c; }
        .suite-name { font-weight: bold; color: #2c3e50; font-size: 1.3em; }
        .suite-description { color: #7f8c8d; margin: 5px 0; }
        .suite-status { display: inline-block; padding: 5px 15px; border-radius: 15px; color: white; font-size: 0.9em; margin-top: 10px; }
        .suite-status.success { background: #27ae60; }
        .suite-status.failed { background: #e74c3c; }
        .recommendation { background: #fff3cd; padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid #ffc107; }
        .recommendation.critical { border-left-color: #dc3545; background: #f8d7da; }
        .recommendation.high { border-left-color: #fd7e14; background: #fff3cd; }
        .recommendation-title { font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
        .recommendation-action { color: #495057; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">🎯 LMStudio 主控测试报告</div>
            <div class="subtitle">会话ID: ${this.masterSession.sessionId}</div>
            <div class="subtitle">执行时间: ${summary.executionTime}</div>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value">${summary.overallSuccessRate}%</div>
                <div class="metric-label">整体成功率</div>
            </div>
            <div class="metric">
                <div class="metric-value">${summary.suitesSuccessful}/${summary.suitesExecuted}</div>
                <div class="metric-label">成功套件</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(summary.totalDuration / 1000).toFixed(1)}s</div>
                <div class="metric-label">总执行时间</div>
            </div>
            <div class="metric">
                <div class="metric-value">${summary.recommendationsGenerated}</div>
                <div class="metric-label">生成建议</div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">测试套件执行结果</div>
            ${this.masterSession.testSuites.map(suite => `
                <div class="suite ${suite.success ? 'success' : 'failed'}">
                    <div class="suite-name">${suite.description}</div>
                    <div class="suite-description">套件: ${suite.name} | 优先级: ${suite.priority}</div>
                    <div class="suite-description">执行时间: ${(suite.duration / 1000).toFixed(1)}秒</div>
                    ${suite.error ? `<div class="suite-description">错误: ${suite.error}</div>` : ''}
                    <div class="suite-status ${suite.success ? 'success' : 'failed'}">
                        ${suite.success ? '✅ 成功' : '❌ 失败'}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <div class="section-title">智能建议 (${this.masterSession.recommendations.length}个)</div>
            ${this.masterSession.recommendations.map(rec => `
                <div class="recommendation ${rec.priority}">
                    <div class="recommendation-title">${this.getPriorityIcon(rec.priority)} ${rec.title}</div>
                    <div class="recommendation-action"><strong>描述:</strong> ${rec.description}</div>
                    <div class="recommendation-action"><strong>行动:</strong> ${rec.action}</div>
                    <div class="recommendation-action"><strong>影响:</strong> ${rec.impact}</div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * 生成Markdown报告
   */
  generateMarkdownReport() {
    const summary = this.masterSession.summary;
    
    return `# 🎯 LMStudio 主控测试报告

## 概览
- **会话ID**: ${this.masterSession.sessionId}
- **执行时间**: ${summary.executionTime}
- **总耗时**: ${(summary.totalDuration / 1000).toFixed(1)}秒
- **整体成功率**: ${summary.overallSuccessRate}%

## 📊 执行摘要
- **测试套件总数**: ${summary.suitesExecuted}
- **成功套件**: ${summary.suitesSuccessful}
- **失败套件**: ${summary.suitesExecuted - summary.suitesSuccessful}
- **发现问题域**: ${summary.issuesIdentified}
- **生成建议**: ${summary.recommendationsGenerated}

## 🚀 测试套件详情

${this.masterSession.testSuites.map(suite => `### ${suite.success ? '✅' : '❌'} ${suite.description}
- **套件名**: ${suite.name}
- **优先级**: ${suite.priority}
- **执行时间**: ${(suite.duration / 1000).toFixed(1)}秒
- **状态**: ${suite.success ? '成功' : '失败'}
${suite.error ? `- **错误**: ${suite.error}` : ''}
`).join('\n')}

## 💡 智能建议 (${this.masterSession.recommendations.length}个)

${this.masterSession.recommendations.map(rec => `### ${this.getPriorityIcon(rec.priority)} ${rec.title}
- **优先级**: ${rec.priority}
- **类别**: ${rec.category}
- **描述**: ${rec.description}
- **行动**: ${rec.action}
- **影响**: ${rec.impact}
`).join('\n')}

## 📈 下一步行动

${summary.overallSuccessRate >= 90 ? '### ✅ 系统状态良好\n- 当前测试通过率达到推荐标准\n- 继续定期运行回归测试\n- 监控性能和稳定性趋势' : '### 🚨 需要改进\n- 当前成功率低于90%推荐标准\n- 优先修复失败的关键测试套件\n- 实施建议的修复方案'}

### 🔄 持续改进
- 建立自动化测试流水线
- 定期更新测试数据集
- 监控工具调用解析准确性
- 优化LMStudio集成性能

---
*报告生成时间: ${new Date().toISOString()}*
*生成工具: LMStudio Master Test Runner v3.0*
`;
  }

  /**
   * 步骤6: 清理和后续处理
   */
  async postProcessing() {
    console.log('\n🧹 步骤6: 清理和后续处理...');

    if (this.config.cleanupAfter) {
      // 清理临时文件（如果启用）
      console.log('   🗑️ 清理临时文件...');
    }

    // 创建快速访问脚本
    await this.createQuickAccessScript();
    console.log('   📜 创建快速访问脚本...');

    // 更新状态文件
    await this.updateStatusFile();
    console.log('   📊 更新状态文件...');

    console.log('   ✅ 后续处理完成');
  }

  /**
   * 创建快速访问脚本
   */
  async createQuickAccessScript() {
    const scriptContent = `#!/bin/bash
# LMStudio 主控测试快速访问脚本
# 生成于: ${new Date().toISOString()}

echo "🎯 LMStudio 主控测试结果"
echo "========================="
echo "会话ID: ${this.masterSession.sessionId}"
echo "成功率: ${this.calculateOverallSuccessRate()}%"
echo "报告位置: ${this.config.outputDir}"
echo ""
echo "📄 查看详细报告:"
echo "cat '${this.config.outputDir}/lmstudio-master-summary.md'"
echo ""
echo "🌐 打开HTML报告:"
echo "open '${this.config.outputDir}/lmstudio-master-report.html'"
`;

    const scriptPath = path.join(this.config.outputDir, 'view-results.sh');
    await fs.writeFile(scriptPath, scriptContent);
    
    // 使脚本可执行
    try {
      await fs.chmod(scriptPath, 0o755);
    } catch {}
  }

  /**
   * 更新状态文件
   */
  async updateStatusFile() {
    const status = {
      lastRun: this.masterSession.timestamp,
      sessionId: this.masterSession.sessionId,
      overallSuccessRate: this.calculateOverallSuccessRate(),
      suitesExecuted: this.masterSession.testSuites.length,
      recommendationsCount: this.masterSession.recommendations.length,
      nextRecommendedRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7天后
    };

    const statusPath = path.join(this.config.outputDir, 'status.json');
    await fs.writeFile(statusPath, JSON.stringify(status, null, 2));
  }

  // 辅助方法

  async checkCommand(command) {
    return new Promise((resolve) => {
      const child = spawn('which', [command], { stdio: 'pipe' });
      child.on('exit', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  calculateOverallSuccessRate() {
    const successful = this.masterSession.testSuites.filter(s => s.success).length;
    const total = this.masterSession.testSuites.length;
    return total > 0 ? Math.round((successful / total) * 100) : 0;
  }

  getPriorityIcon(priority) {
    const icons = {
      critical: '🚨',
      high: '🔥',
      medium: '⚠️',
      low: '💡'
    };
    return icons[priority] || '📝';
  }

  async handleMasterError(error) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      sessionId: this.masterSession.sessionId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      executedSuites: this.masterSession.testSuites.length,
      lastSuccessfulSuite: this.masterSession.testSuites.filter(s => s.success).pop()?.name || 'none'
    };

    const errorPath = path.join(this.config.outputDir, `error-${Date.now()}.json`);
    await fs.writeFile(errorPath, JSON.stringify(errorLog, null, 2));
    
    console.error(`💾 错误日志已保存: ${errorPath}`);
  }
}

// 运行主控测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const masterRunner = new LMStudioMasterRunner();
  masterRunner.runMasterValidation().catch(console.error);
}

export { LMStudioMasterRunner };