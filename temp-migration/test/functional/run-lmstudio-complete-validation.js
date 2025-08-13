#!/usr/bin/env node

/**
 * LMStudio 完整验证测试运行器
 * 集成所有LMStudio相关的验证测试，提供一键式完整验证
 * @author Jason Zhang  
 * @version v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// 导入所有测试模块
import { LMStudioComprehensiveValidation } from './test-lmstudio-comprehensive-validation.js';
import { AutomatedDataScanner } from './test-automated-data-scanner.js';
import { ClaudeCodeRoutingValidation } from './test-claude-code-routing-validation.js';
import { LMStudioProtocolValidation } from './test-lmstudio-protocol-validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioCompleteValidation {
  constructor() {
    this.testResults = {
      sessionId: `lmstudio-complete-${Date.now()}`,
      timestamp: new Date().toISOString(),
      testType: 'lmstudio-complete-validation',
      phases: [],
      summary: {},
      recommendations: []
    };

    // 测试阶段定义
    this.validationPhases = [
      {
        name: 'environment-setup',
        description: '环境准备和服务启动',
        testClass: 'setup',
        priority: 'critical',
        timeout: 60000 // 60秒
      },
      {
        name: 'comprehensive-validation',
        description: 'LMStudio综合验证系统',
        testClass: LMStudioComprehensiveValidation,
        priority: 'critical',
        timeout: 300000 // 5分钟
      },
      {
        name: 'protocol-validation',
        description: 'OpenAI协议响应处理验证',
        testClass: LMStudioProtocolValidation,
        priority: 'high',
        timeout: 240000 // 4分钟
      },
      {
        name: 'routing-validation',
        description: 'Claude Code客户端连接路由验证',
        testClass: ClaudeCodeRoutingValidation,
        priority: 'high',
        timeout: 180000 // 3分钟
      },
      {
        name: 'data-analysis',
        description: '自动化数据扫描分析',
        testClass: AutomatedDataScanner,
        priority: 'medium',
        timeout: 120000 // 2分钟
      },
      {
        name: 'integration-report',
        description: '集成报告生成',
        testClass: 'report',
        priority: 'medium',
        timeout: 30000 // 30秒
      }
    ];

    // 配置
    this.config = {
      lmstudioPort: 5506,
      lmstudioConfig: '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json',
      outputDir: path.join(__dirname, '../output/functional/lmstudio-complete-validation'),
      maxRetries: 2,
      continueOnFailure: true
    };
  }

  /**
   * 运行完整验证流程
   */
  async runCompleteValidation() {
    console.log('🚀 LMStudio 完整验证测试系统');
    console.log('=========================================');
    console.log(`Session ID: ${this.testResults.sessionId}`);
    console.log(`开始时间: ${this.testResults.timestamp}\n`);

    try {
      // 创建输出目录
      await fs.mkdir(this.config.outputDir, { recursive: true });

      // 执行所有验证阶段
      for (let i = 0; i < this.validationPhases.length; i++) {
        const phase = this.validationPhases[i];
        console.log(`\n📋 阶段 ${i + 1}/${this.validationPhases.length}: ${phase.description}`);
        
        const phaseResult = await this.executeValidationPhase(phase);
        this.testResults.phases.push(phaseResult);

        // 检查是否应该继续
        if (phaseResult.status === 'failed' && !this.config.continueOnFailure && phase.priority === 'critical') {
          console.log(`\n🛑 关键阶段失败，停止验证: ${phase.description}`);
          break;
        }
      }

      // 生成最终报告
      await this.generateCompleteReport();

      // 输出总结
      this.printValidationSummary();

      console.log('\n✅ LMStudio 完整验证测试完成!');

    } catch (error) {
      console.error('\n❌ 完整验证失败:', error);
      await this.handleValidationFailure(error);
      throw error;
    }
  }

  /**
   * 执行验证阶段
   */
  async executeValidationPhase(phase) {
    const startTime = Date.now();
    
    const phaseResult = {
      name: phase.name,
      description: phase.description,
      priority: phase.priority,
      startTime: new Date().toISOString(),
      status: 'running',
      duration: 0,
      retryCount: 0
    };

    console.log(`   🔄 启动: ${phase.description}...`);

    for (let retry = 0; retry <= this.config.maxRetries; retry++) {
      try {
        phaseResult.retryCount = retry;

        if (retry > 0) {
          console.log(`   🔁 重试 ${retry}/${this.config.maxRetries}: ${phase.description}`);
          await this.waitBeforeRetry(retry);
        }

        // 执行具体的验证阶段
        const result = await this.runPhaseWithTimeout(phase);
        
        phaseResult.result = result;
        phaseResult.status = result.success ? 'passed' : 'failed';
        phaseResult.duration = Date.now() - startTime;

        if (result.success) {
          console.log(`   ✅ 完成: ${phase.description} (${phaseResult.duration}ms)`);
          break;
        } else if (retry === this.config.maxRetries) {
          console.log(`   ❌ 失败: ${phase.description} - ${result.error || 'Unknown error'}`);
          phaseResult.error = result.error;
        }

      } catch (error) {
        phaseResult.error = error.message;
        
        if (retry === this.config.maxRetries) {
          phaseResult.status = 'error';
          phaseResult.duration = Date.now() - startTime;
          console.log(`   💥 错误: ${phase.description} - ${error.message}`);
        }
      }
    }

    phaseResult.endTime = new Date().toISOString();
    return phaseResult;
  }

  /**
   * 带超时执行阶段
   */
  async runPhaseWithTimeout(phase) {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: `阶段超时 (${phase.timeout}ms)` });
      }, phase.timeout);

      try {
        let result;

        switch (phase.testClass) {
          case 'setup':
            result = await this.runEnvironmentSetup();
            break;
          case 'report':
            result = await this.runIntegrationReport();
            break;
          default:
            if (typeof phase.testClass === 'function') {
              const testInstance = new phase.testClass();
              const methodName = this.getTestMethodName(phase.testClass.name);
              result = await testInstance[methodName]();
              result = { success: true, details: result };
            } else {
              throw new Error(`Unknown test class: ${phase.testClass}`);
            }
            break;
        }

        clearTimeout(timeout);
        resolve(result);

      } catch (error) {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * 获取测试方法名
   */
  getTestMethodName(className) {
    const methodMap = {
      'LMStudioComprehensiveValidation': 'runComprehensiveValidation',
      'LMStudioProtocolValidation': 'runProtocolValidation',
      'ClaudeCodeRoutingValidation': 'runRoutingValidation',
      'AutomatedDataScanner': 'runAutomatedScan'
    };
    return methodMap[className] || 'run';
  }

  /**
   * 环境设置阶段
   */
  async runEnvironmentSetup() {
    console.log('      🔧 检查LMStudio服务状态...');
    
    const checks = [];

    // 检查配置文件
    try {
      await fs.access(this.config.lmstudioConfig);
      checks.push({ name: 'config-file', status: 'passed' });
    } catch {
      checks.push({ name: 'config-file', status: 'failed', error: '配置文件不存在' });
    }

    // 检查rcc3命令
    const rccAvailable = await this.checkCommand('rcc3');
    checks.push({ name: 'rcc3-command', status: rccAvailable ? 'passed' : 'failed' });

    // 检查端口占用
    const portFree = await this.isPortAvailable(this.config.lmstudioPort);
    if (!portFree) {
      console.log(`      🔄 清理端口 ${this.config.lmstudioPort}...`);
      await this.cleanupPort(this.config.lmstudioPort);
    }
    checks.push({ name: 'port-cleanup', status: 'passed' });

    // 启动LMStudio服务
    const serviceStarted = await this.startLMStudioService();
    checks.push({ name: 'service-startup', status: serviceStarted ? 'passed' : 'failed' });

    const success = checks.every(check => check.status === 'passed');
    
    return {
      success,
      details: { checks },
      error: success ? null : '环境设置失败'
    };
  }

  /**
   * 集成报告生成阶段
   */
  async runIntegrationReport() {
    console.log('      📊 生成集成报告...');

    try {
      // 收集所有阶段的结果
      const allResults = this.testResults.phases
        .filter(p => p.result)
        .map(p => ({
          phase: p.name,
          success: p.status === 'passed',
          duration: p.duration,
          details: p.result.details
        }));

      // 计算总体统计
      const stats = {
        totalPhases: this.testResults.phases.length,
        passedPhases: this.testResults.phases.filter(p => p.status === 'passed').length,
        failedPhases: this.testResults.phases.filter(p => p.status === 'failed').length,
        errorPhases: this.testResults.phases.filter(p => p.status === 'error').length,
        totalDuration: this.testResults.phases.reduce((sum, p) => sum + (p.duration || 0), 0)
      };

      // 生成建议
      const recommendations = this.generateRecommendations();

      return {
        success: true,
        details: {
          results: allResults,
          statistics: stats,
          recommendations
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成建议
   */
  generateRecommendations() {
    const recommendations = [];

    const failedPhases = this.testResults.phases.filter(p => p.status === 'failed' || p.status === 'error');
    
    if (failedPhases.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'phase-failures',
        title: `修复失败的验证阶段 (${failedPhases.length}个)`,
        description: failedPhases.map(p => p.description).join(', '),
        action: '重新运行失败的阶段，检查日志了解详细错误信息'
      });
    }

    const highRetryPhases = this.testResults.phases.filter(p => p.retryCount > 1);
    if (highRetryPhases.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'stability',
        title: '改善系统稳定性',
        description: `${highRetryPhases.length}个阶段需要多次重试才能通过`,
        action: '检查网络连接、服务稳定性和资源使用情况'
      });
    }

    const longDurationPhases = this.testResults.phases.filter(p => (p.duration || 0) > 60000);
    if (longDurationPhases.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'performance',
        title: '优化测试性能',
        description: `${longDurationPhases.length}个阶段执行时间较长`,
        action: '考虑并行化测试或优化测试逻辑以提高执行效率'
      });
    }

    return recommendations;
  }

  // 辅助方法

  async checkCommand(command) {
    return new Promise((resolve) => {
      const child = spawn('which', [command], { stdio: 'pipe' });
      child.on('exit', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const child = spawn('lsof', ['-ti', `:${port}`], { stdio: 'pipe' });
      child.on('exit', (code) => resolve(code !== 0));
      child.on('error', () => resolve(true));
    });
  }

  async cleanupPort(port) {
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', `pkill -f "rcc3 start.*${port}"`], { stdio: 'pipe' });
      child.on('exit', () => {
        setTimeout(resolve, 2000);
      });
      child.on('error', () => resolve());
    });
  }

  async startLMStudioService() {
    console.log('      🚀 启动LMStudio服务...');

    return new Promise((resolve) => {
      const child = spawn('rcc3', ['start', this.config.lmstudioConfig, '--debug'], {
        stdio: 'pipe',
        detached: true
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          child.kill();
          resolve(false);
        }
      }, 30000);

      child.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running') || output.includes(`listening on ${this.config.lmstudioPort}`)) {
          started = true;
          clearTimeout(timeout);
          child.unref();
          resolve(true);
        }
      });

      child.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  async waitBeforeRetry(retryCount) {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 指数退避，最大10秒
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 生成完整报告
   */
  async generateCompleteReport() {
    const summary = {
      sessionId: this.testResults.sessionId,
      startTime: this.testResults.timestamp,
      endTime: new Date().toISOString(),
      totalPhases: this.testResults.phases.length,
      passedPhases: this.testResults.phases.filter(p => p.status === 'passed').length,
      failedPhases: this.testResults.phases.filter(p => p.status === 'failed').length,
      errorPhases: this.testResults.phases.filter(p => p.status === 'error').length,
      totalDuration: this.testResults.phases.reduce((sum, p) => sum + (p.duration || 0), 0),
      successRate: 0
    };

    summary.successRate = summary.totalPhases > 0 ? 
      (summary.passedPhases / summary.totalPhases * 100) : 0;

    this.testResults.summary = summary;

    // 保存详细报告
    const reportPath = path.join(this.config.outputDir, `complete-validation-${this.testResults.sessionId}.json`);
    await fs.writeFile(reportPath, JSON.stringify(this.testResults, null, 2));

    // 生成可读性报告
    const readableReport = this.generateReadableReport();
    const readableReportPath = path.join(this.config.outputDir, `complete-validation-${this.testResults.sessionId}.md`);
    await fs.writeFile(readableReportPath, readableReport);

    console.log(`\n📄 详细报告: ${reportPath}`);
    console.log(`📋 可读报告: ${readableReportPath}`);
  }

  /**
   * 生成可读性报告
   */
  generateReadableReport() {
    const summary = this.testResults.summary;
    
    return `# LMStudio 完整验证报告

## 验证概览
- **会话ID**: ${summary.sessionId}
- **开始时间**: ${summary.startTime}
- **结束时间**: ${summary.endTime}
- **总耗时**: ${(summary.totalDuration / 1000).toFixed(1)} 秒
- **成功率**: ${summary.successRate.toFixed(1)}%

## 验证结果统计
- **总阶段数**: ${summary.totalPhases}
- **通过阶段**: ${summary.passedPhases} ✅
- **失败阶段**: ${summary.failedPhases} ❌
- **错误阶段**: ${summary.errorPhases} 💥

## 详细阶段结果

${this.testResults.phases.map(phase => `### ${phase.description}
- **状态**: ${phase.status === 'passed' ? '✅ 通过' : phase.status === 'failed' ? '❌ 失败' : '💥 错误'}
- **耗时**: ${(phase.duration || 0)}ms
- **重试次数**: ${phase.retryCount}
- **开始时间**: ${phase.startTime}
- **结束时间**: ${phase.endTime || 'N/A'}
${phase.error ? `- **错误**: ${phase.error}` : ''}
`).join('\n')}

## 改进建议

${this.testResults.recommendations?.map(rec => `### ${rec.title}
- **优先级**: ${rec.priority.toUpperCase()}
- **类别**: ${rec.category}
- **描述**: ${rec.description}  
- **建议行动**: ${rec.action}
`).join('\n') || '暂无建议'}

## 下一步行动
${summary.successRate < 80 ? `
⚠️ **注意**: 验证成功率低于80%，建议：
1. 检查失败阶段的详细错误信息
2. 确保LMStudio服务正常运行
3. 验证网络连接和配置正确性
4. 重新运行失败的测试阶段
` : `
✅ **验证通过**: 系统运行状况良好
1. 可以开始正常使用LMStudio路由功能
2. 定期运行验证以确保稳定性
3. 监控生产环境的性能指标
`}

---
*报告生成时间: ${new Date().toISOString()}*
`;
  }

  /**
   * 打印验证总结
   */
  printValidationSummary() {
    const summary = this.testResults.summary;
    
    console.log('\n📊 验证总结');
    console.log('=============');
    console.log(`总验证阶段: ${summary.totalPhases}`);
    console.log(`✅ 通过: ${summary.passedPhases}`);
    console.log(`❌ 失败: ${summary.failedPhases}`);
    console.log(`💥 错误: ${summary.errorPhases}`);
    console.log(`🕐 总耗时: ${(summary.totalDuration / 1000).toFixed(1)} 秒`);
    console.log(`📈 成功率: ${summary.successRate.toFixed(1)}%`);
    
    if (summary.successRate >= 90) {
      console.log('\n🎉 验证结果: 优秀 - 系统运行稳定');
    } else if (summary.successRate >= 75) {
      console.log('\n✅ 验证结果: 良好 - 系统基本可用');
    } else if (summary.successRate >= 50) {
      console.log('\n⚠️ 验证结果: 需要改进 - 存在一些问题');
    } else {
      console.log('\n❌ 验证结果: 不通过 - 需要修复重大问题');
    }
  }

  /**
   * 处理验证失败
   */
  async handleValidationFailure(error) {
    const errorReport = {
      error: error.message,
      timestamp: new Date().toISOString(),
      completedPhases: this.testResults.phases.length,
      lastPhase: this.testResults.phases[this.testResults.phases.length - 1]
    };

    const errorReportPath = path.join(this.config.outputDir, `error-report-${Date.now()}.json`);
    await fs.writeFile(errorReportPath, JSON.stringify(errorReport, null, 2));

    console.log(`\n📄 错误报告已保存: ${errorReportPath}`);
  }
}

// 主入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const validation = new LMStudioCompleteValidation();
  validation.runCompleteValidation().catch(console.error);
}

export { LMStudioCompleteValidation };