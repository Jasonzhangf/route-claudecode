#!/usr/bin/env node

/**
 * Claude Code 端到端交互式测试
 * 使用文件重定向输入模拟真实用户操作，测试完整的Claude Code交互体验
 * @author Jason Zhang
 * @version v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ClaudeCodeE2EInteractiveTest {
  constructor() {
    this.testResults = {
      sessionId: `claude-e2e-interactive-${Date.now()}`,
      timestamp: new Date().toISOString(),
      testType: 'claude-code-e2e-interactive',
      scenarios: [],
      summary: {}
    };

    this.config = {
      lmstudioPort: 5506,
      lmstudioConfig: '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json',
      outputDir: path.join(__dirname, '../output/functional/test-claude-e2e-data'),
      testTimeout: 120000, // 2分钟每个场景
      rcc3Command: 'rcc3'
    };

    // 测试场景定义
    this.testScenarios = [
      {
        name: 'basic-file-operations',
        description: '基础文件操作测试',
        inputs: [
          '列出当前目录下的文件',
          '创建一个名为test.txt的文件，内容是"Hello World"',
          '读取test.txt文件的内容',
          '删除test.txt文件'
        ],
        expectedPatterns: [
          /Tool call:.*ls/i,
          /Tool call:.*Write/i,
          /Tool call:.*Read/i,
          /Tool call:.*删除|rm/i
        ]
      },
      {
        name: 'complex-tool-usage',
        description: '复杂工具调用测试',
        inputs: [
          '帮我检查系统的磁盘使用情况',
          '查看当前正在运行的进程',
          '创建一个包含系统信息的报告文件'
        ],
        expectedPatterns: [
          /Tool call:.*df|disk/i,
          /Tool call:.*ps|process/i,
          /Tool call:.*Write.*report/i
        ]
      },
      {
        name: 'multi-turn-conversation',
        description: '多轮对话工具调用测试',
        inputs: [
          '我需要分析一个项目的代码结构',
          '请先列出项目根目录的内容',
          '然后检查package.json文件是否存在',
          '如果存在，请读取其内容并总结项目信息'
        ],
        expectedPatterns: [
          /分析.*代码结构/i,
          /Tool call:.*ls/i,
          /Tool call:.*package\.json/i,
          /Tool call:.*Read.*package\.json/i
        ]
      },
      {
        name: 'error-handling',
        description: '错误处理和恢复测试',
        inputs: [
          '读取一个不存在的文件nonexistent.txt',
          '执行一个错误的命令：invalidcommand',
          '现在正常操作：列出当前目录'
        ],
        expectedPatterns: [
          /Tool call:.*Read.*nonexistent/i,
          /Tool call:.*invalidcommand/i,
          /Tool call:.*ls/i
        ]
      }
    ];
  }

  /**
   * 运行端到端交互测试
   */
  async runE2EInteractiveTest() {
    console.log('🎭 Claude Code 端到端交互式测试');
    console.log('=====================================');
    console.log(`Session ID: ${this.testResults.sessionId}\n`);

    try {
      // 准备测试环境
      await this.prepareTestEnvironment();

      // 启动LMStudio服务
      await this.startLMStudioService();

      // 执行所有测试场景
      for (const scenario of this.testScenarios) {
        await this.executeTestScenario(scenario);
      }

      // 生成测试报告
      await this.generateE2EReport();

      console.log('\n✅ Claude Code 端到端交互测试完成!');

    } catch (error) {
      console.error('\n❌ 端到端测试失败:', error);
      throw error;
    }
  }

  /**
   * 准备测试环境
   */
  async prepareTestEnvironment() {
    console.log('🔧 准备测试环境...');

    // 创建输出目录
    await fs.mkdir(this.config.outputDir, { recursive: true });

    // 创建测试工作目录
    const testWorkDir = path.join(this.config.outputDir, 'test-workspace');
    await fs.mkdir(testWorkDir, { recursive: true });
    
    console.log(`   ✅ 测试环境准备完成`);
    console.log(`   📁 输出目录: ${this.config.outputDir}`);
    console.log(`   📁 工作目录: ${testWorkDir}`);
  }

  /**
   * 启动LMStudio服务
   */
  async startLMStudioService() {
    console.log('🚀 检查LMStudio服务状态...');

    // 首先检查服务是否已经在运行
    const isRunning = await this.checkServiceRunning();
    if (isRunning) {
      console.log('   ✅ LMStudio服务已在运行');
      return;
    }

    // 如果没有运行，尝试启动服务
    console.log('   🔄 启动LMStudio服务...');
    await this.cleanupPort(this.config.lmstudioPort);

    const serviceStarted = await this.startService();
    if (!serviceStarted) {
      throw new Error('LMStudio服务启动失败 - 请手动启动服务: rcc3 start ' + this.config.lmstudioConfig + ' --debug');
    }

    console.log('   ✅ LMStudio服务启动成功');
  }

  /**
   * 执行测试场景
   */
  async executeTestScenario(scenario) {
    console.log(`\n🎬 执行场景: ${scenario.description}...`);

    const scenarioResult = {
      name: scenario.name,
      description: scenario.description,
      startTime: new Date().toISOString(),
      inputs: scenario.inputs,
      outputs: [],
      interactions: [],
      success: false,
      issues: []
    };

    try {
      // 创建输入文件
      const inputFile = await this.createInputFile(scenario.name, scenario.inputs);
      
      // 执行Claude Code会话
      const sessionResult = await this.runClaudeCodeSession(inputFile, scenario);
      
      scenarioResult.outputs = sessionResult.outputs;
      scenarioResult.interactions = sessionResult.interactions;
      scenarioResult.rawOutput = sessionResult.rawOutput;

      // 分析结果
      const analysis = this.analyzeScenarioResults(scenario, sessionResult);
      scenarioResult.analysis = analysis;
      scenarioResult.success = analysis.overallSuccess;
      scenarioResult.issues = analysis.issues;

      console.log(`   📊 场景结果: ${scenarioResult.success ? '✅ 成功' : '❌ 失败'}`);
      console.log(`   🔧 工具调用: ${analysis.toolCallsDetected}/${scenario.expectedPatterns.length}`);
      console.log(`   ⚠️ 问题发现: ${analysis.issues.length}个`);

    } catch (error) {
      scenarioResult.success = false;
      scenarioResult.error = error.message;
      scenarioResult.issues.push({
        type: 'execution_error',
        message: error.message,
        severity: 'high'
      });
      
      console.log(`   ❌ 场景执行失败: ${error.message}`);
    }

    scenarioResult.endTime = new Date().toISOString();
    scenarioResult.duration = Date.now() - new Date(scenarioResult.startTime).getTime();
    
    this.testResults.scenarios.push(scenarioResult);
  }

  /**
   * 创建输入文件
   */
  async createInputFile(scenarioName, inputs) {
    const inputContent = inputs.join('\n') + '\n/exit\n';
    const inputFile = path.join(this.config.outputDir, `${scenarioName}-input.txt`);
    
    await fs.writeFile(inputFile, inputContent);
    console.log(`   📝 创建输入文件: ${inputFile}`);
    
    return inputFile;
  }

  /**
   * 运行Claude Code会话
   */
  async runClaudeCodeSession(inputFile, scenario) {
    console.log(`   🎯 启动Claude Code会话...`);

    const workspaceDir = path.join(this.config.outputDir, 'test-workspace');
    const outputFile = path.join(this.config.outputDir, `${scenario.name}-output.txt`);

    return new Promise((resolve, reject) => {
      let output = '';
      let interactions = [];
      let currentInteraction = null;

      // 启动Claude Code进程
      const claudeProcess = spawn(this.config.rcc3Command, ['code', '--port', this.config.lmstudioPort], {
        cwd: workspaceDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 设置超时
      const timeout = setTimeout(() => {
        claudeProcess.kill();
        reject(new Error('Claude Code会话超时'));
      }, this.config.testTimeout);

      // 读取输入文件并逐行发送
      fs.readFile(inputFile, 'utf8').then(inputContent => {
        const lines = inputContent.split('\n');
        let lineIndex = 0;

        const sendNextLine = () => {
          if (lineIndex < lines.length) {
            const line = lines[lineIndex].trim();
            if (line && line !== '/exit') {
              console.log(`     📤 输入: ${line}`);
              claudeProcess.stdin.write(line + '\n');
              
              currentInteraction = {
                input: line,
                timestamp: new Date().toISOString(),
                output: ''
              };
            } else if (line === '/exit') {
              claudeProcess.stdin.end();
            }
            lineIndex++;
          }
        };

        // 等待启动信息后开始发送命令
        setTimeout(() => {
          sendNextLine();
          
          // 定期发送下一行（模拟用户思考时间）
          const inputInterval = setInterval(() => {
            if (lineIndex < lines.length) {
              sendNextLine();
            } else {
              clearInterval(inputInterval);
            }
          }, 8000); // 每8秒发送一行
        }, 3000);
      });

      // 处理输出
      claudeProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        if (currentInteraction) {
          currentInteraction.output += text;
        }

        // 检测响应完成
        if (text.includes('> ') || text.includes('│ >')) {
          if (currentInteraction) {
            interactions.push(currentInteraction);
            console.log(`     📥 输出: ${this.extractMainResponse(currentInteraction.output)}`);
            currentInteraction = null;
          }
        }
      });

      claudeProcess.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(`     ⚠️ 错误: ${text.trim()}`);
      });

      claudeProcess.on('exit', async (code) => {
        clearTimeout(timeout);
        
        // 保存完整输出
        await fs.writeFile(outputFile, output);
        
        resolve({
          outputs: interactions.map(i => i.output),
          interactions: interactions,
          rawOutput: output,
          exitCode: code
        });
      });

      claudeProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 分析场景结果
   */
  analyzeScenarioResults(scenario, sessionResult) {
    const analysis = {
      toolCallsDetected: 0,
      toolCallsExpected: scenario.expectedPatterns.length,
      patternMatches: [],
      issues: [],
      overallSuccess: false
    };

    const fullOutput = sessionResult.rawOutput || '';

    // 检查期望的模式
    scenario.expectedPatterns.forEach((pattern, index) => {
      const match = pattern.test(fullOutput);
      analysis.patternMatches.push({
        pattern: pattern.toString(),
        matched: match,
        input: scenario.inputs[index] || 'N/A'
      });
      
      if (match) {
        analysis.toolCallsDetected++;
      }
    });

    // 检测API错误
    const apiErrors = (fullOutput.match(/Error:.*API error/g) || []).length;
    if (apiErrors > 0) {
      analysis.issues.push({
        type: 'api_error',
        message: `检测到 ${apiErrors} 个API错误`,
        severity: 'high'
      });
    }

    // 检测400 Bad Request错误
    const badRequests = (fullOutput.match(/400 Bad Request/g) || []).length;
    if (badRequests > 0) {
      analysis.issues.push({
        type: 'bad_request',
        message: `检测到 ${badRequests} 个400 Bad Request错误`,
        severity: 'high'
      });
    }

    // 检测工具调用格式问题
    if (fullOutput.includes('Tool call:') && !fullOutput.includes('function')) {
      analysis.issues.push({
        type: 'tool_call_format',
        message: '工具调用可能被作为文本处理而非结构化调用',
        severity: 'medium'
      });
    }

    // 计算成功率
    const successRate = analysis.toolCallsExpected > 0 ? 
      (analysis.toolCallsDetected / analysis.toolCallsExpected) : 0;
    
    analysis.successRate = successRate;
    analysis.overallSuccess = successRate >= 0.7 && analysis.issues.filter(i => i.severity === 'high').length === 0;

    return analysis;
  }

  /**
   * 提取主要响应内容
   */
  extractMainResponse(output) {
    // 提取主要的响应内容，排除UI元素
    const lines = output.split('\n');
    const contentLines = lines.filter(line => 
      !line.includes('│') && 
      !line.includes('╰') && 
      !line.includes('╭') && 
      !line.includes('> ') &&
      line.trim().length > 0
    );
    
    return contentLines.slice(0, 2).join(' ').substring(0, 100) + '...';
  }

  // 辅助方法

  async cleanupPort(port) {
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', `pkill -f "rcc3.*${port}"`], { stdio: 'pipe' });
      child.on('exit', () => {
        setTimeout(resolve, 2000);
      });
      child.on('error', () => resolve());
    });
  }

  async checkServiceRunning() {
    try {
      const response = await fetch(`http://localhost:${this.config.lmstudioPort}/health`, { 
        timeout: 3000 
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async startService() {
    console.log('   🚀 启动LMStudio路由服务...');

    return new Promise((resolve) => {
      const child = spawn(this.config.rcc3Command, ['start', this.config.lmstudioConfig, '--debug'], {
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

  /**
   * 生成测试报告
   */
  async generateE2EReport() {
    const summary = {
      totalScenarios: this.testResults.scenarios.length,
      successfulScenarios: this.testResults.scenarios.filter(s => s.success).length,
      totalIssues: this.testResults.scenarios.reduce((sum, s) => sum + s.issues.length, 0),
      totalToolCalls: this.testResults.scenarios.reduce((sum, s) => sum + (s.analysis?.toolCallsDetected || 0), 0),
      expectedToolCalls: this.testResults.scenarios.reduce((sum, s) => sum + (s.analysis?.toolCallsExpected || 0), 0),
      highSeverityIssues: this.testResults.scenarios.reduce((sum, s) => 
        sum + s.issues.filter(i => i.severity === 'high').length, 0)
    };

    summary.overallSuccessRate = summary.totalScenarios > 0 ? 
      (summary.successfulScenarios / summary.totalScenarios * 100).toFixed(1) : 0;
    
    summary.toolCallSuccessRate = summary.expectedToolCalls > 0 ?
      (summary.totalToolCalls / summary.expectedToolCalls * 100).toFixed(1) : 0;

    this.testResults.summary = summary;

    // 保存详细报告
    const reportPath = path.join(this.config.outputDir, `${this.testResults.sessionId}.json`);
    await fs.writeFile(reportPath, JSON.stringify(this.testResults, null, 2));

    // 生成可读报告
    const readableReport = this.generateReadableReport();
    const mdReportPath = path.join(this.config.outputDir, `${this.testResults.sessionId}.md`);
    await fs.writeFile(mdReportPath, readableReport);

    console.log('\n📊 端到端测试总结');
    console.log('==================');
    console.log(`测试场景: ${summary.totalScenarios} (成功: ${summary.successfulScenarios})`);
    console.log(`整体成功率: ${summary.overallSuccessRate}%`);
    console.log(`工具调用成功率: ${summary.toolCallSuccessRate}%`);
    console.log(`发现问题: ${summary.totalIssues} (高危: ${summary.highSeverityIssues})`);
    console.log(`\n📄 详细报告: ${reportPath}`);
    console.log(`📋 可读报告: ${mdReportPath}`);
  }

  /**
   * 生成可读报告
   */
  generateReadableReport() {
    const summary = this.testResults.summary;
    
    return `# Claude Code 端到端交互测试报告

## 测试概览
- **会话ID**: ${this.testResults.sessionId}
- **测试时间**: ${this.testResults.timestamp}
- **测试类型**: 端到端交互式测试

## 测试结果统计
- **总场景数**: ${summary.totalScenarios}
- **成功场景**: ${summary.successfulScenarios} ✅
- **失败场景**: ${summary.totalScenarios - summary.successfulScenarios} ❌
- **整体成功率**: ${summary.overallSuccessRate}%

## 工具调用分析
- **期望工具调用**: ${summary.expectedToolCalls}
- **成功工具调用**: ${summary.totalToolCalls}
- **工具调用成功率**: ${summary.toolCallSuccessRate}%

## 问题分析
- **总问题数**: ${summary.totalIssues}
- **高危问题**: ${summary.highSeverityIssues}
- **中等问题**: ${summary.totalIssues - summary.highSeverityIssues}

## 详细场景结果

${this.testResults.scenarios.map(scenario => `### ${scenario.description}
- **状态**: ${scenario.success ? '✅ 成功' : '❌ 失败'}
- **耗时**: ${scenario.duration}ms
- **工具调用**: ${scenario.analysis?.toolCallsDetected || 0}/${scenario.analysis?.toolCallsExpected || 0}
- **成功率**: ${((scenario.analysis?.successRate || 0) * 100).toFixed(1)}%
- **发现问题**: ${scenario.issues.length}个
${scenario.issues.length > 0 ? scenario.issues.map(issue => `  - ${issue.type}: ${issue.message}`).join('\n') : '  - 无问题'}
`).join('\n')}

## 建议和改进

${summary.highSeverityIssues > 0 ? `### 🚨 紧急需要修复
- 发现 ${summary.highSeverityIssues} 个高危问题需要立即修复
- 重点关注API错误和请求格式问题
- 建议重新运行单独的工具调用测试验证修复效果
` : ''}

${summary.toolCallSuccessRate < 80 ? `### ⚠️ 工具调用优化
- 工具调用成功率 ${summary.toolCallSuccessRate}% 低于预期
- 建议检查LMStudio的工具调用配置
- 可能需要优化工具调用解析逻辑
` : ''}

### 📈 持续改进
- 定期运行端到端测试以确保系统稳定性
- 监控工具调用成功率趋势
- 根据用户实际使用模式调整测试场景

---
*报告生成时间: ${new Date().toISOString()}*
`;
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new ClaudeCodeE2EInteractiveTest();
  test.runE2EInteractiveTest().catch(console.error);
}

export { ClaudeCodeE2EInteractiveTest };