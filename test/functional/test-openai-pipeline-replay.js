#!/usr/bin/env node
/**
 * OpenAI流水线回放验证系统
 * 支持断点调试、单步执行和数据回放验证
 * Project: Claude Code Router Enhanced  
 * Author: Jason Zhang
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

/**
 * OpenAI流水线回放系统
 * 基于捕获数据实现调试回放和验证
 */
class OpenAIPipelineReplaySystem {
  constructor() {
    this.captureDir = '/tmp/openai-pipeline-captures';
    this.currentSession = null;
    this.capturedData = {};
    this.breakpoints = new Set();
    this.stepMode = false;
    this.currentStep = 0;
    this.modifications = {};
    this.rl = null;
  }

  /**
   * 加载捕获的会话数据
   */
  async loadSession(sessionId) {
    console.log(`📂 Loading session data: ${sessionId}`);
    
    this.currentSession = sessionId;
    this.capturedData = {};
    
    const steps = ['step1-input-processing', 'step2-routing', 'step3-transformation', 
                   'step4-raw-response', 'step5-transformer-input', 'step6-transformer-output'];
    
    for (const step of steps) {
      const filename = `${sessionId}-${step}.json`;
      const filepath = path.join(this.captureDir, filename);
      
      try {
        const data = await fs.readFile(filepath, 'utf8');
        this.capturedData[step] = JSON.parse(data);
        console.log(`✅ Loaded ${step}`);
      } catch (error) {
        console.log(`⚠️ Missing ${step} - skipping`);
      }
    }
    
    console.log(`📋 Session loaded: ${Object.keys(this.capturedData).length} steps available`);
    return this.capturedData;
  }

  /**
   * 列出所有可用的会话
   */
  async listAvailableSessions() {
    console.log('📋 Available capture sessions:');
    
    try {
      const files = await fs.readdir(this.captureDir);
      const sessions = new Set();
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.split('-')[0] + '-' + file.split('-')[1]; // capture-timestamp
          sessions.add(sessionId);
        }
      }
      
      const sessionList = Array.from(sessions).sort().reverse(); // 最新的在前
      sessionList.forEach((session, index) => {
        console.log(`  ${index + 1}. ${session}`);
      });
      
      return sessionList;
    } catch (error) {
      console.error('❌ Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * 设置断点
   */
  setBreakpoint(step) {
    this.breakpoints.add(step);
    console.log(`🔴 Breakpoint set at ${step}`);
  }

  /**
   * 移除断点
   */
  removeBreakpoint(step) {
    this.breakpoints.delete(step);
    console.log(`⚪ Breakpoint removed from ${step}`);
  }

  /**
   * 启用单步模式
   */
  enableStepMode() {
    this.stepMode = true;
    console.log('👣 Step mode enabled - will pause at each step');
  }

  /**
   * 禁用单步模式
   */
  disableStepMode() {
    this.stepMode = false;
    console.log('🏃 Step mode disabled - continuous execution');
  }

  /**
   * 修改步骤数据（用于验证修复）
   */
  modifyStepData(step, path, newValue) {
    if (!this.modifications[step]) {
      this.modifications[step] = {};
    }
    
    this.modifications[step][path] = newValue;
    console.log(`✏️ Modification set: ${step}.${path} = ${JSON.stringify(newValue)}`);
  }

  /**
   * 应用修改到数据
   */
  applyModifications(step, data) {
    if (!this.modifications[step]) return data;
    
    const modifiedData = JSON.parse(JSON.stringify(data)); // 深拷贝
    
    for (const [path, value] of Object.entries(this.modifications[step])) {
      this.setNestedValue(modifiedData, path, value);
      console.log(`🔧 Applied modification: ${step}.${path} = ${JSON.stringify(value)}`);
    }
    
    return modifiedData;
  }

  /**
   * 设置嵌套对象的值
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * 创建交互式命令行接口
   */
  createInteractiveInterface() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return this.rl;
  }

  /**
   * 等待用户输入
   */
  async waitForUserInput(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * 执行单步调试
   */
  async executeStep(stepName) {
    console.log(`\n🔍 [${stepName.toUpperCase()}] Executing step...`);
    
    const stepData = this.capturedData[stepName];
    if (!stepData) {
      console.log(`❌ No data available for ${stepName}`);
      return null;
    }

    // 应用修改
    const modifiedData = this.applyModifications(stepName, stepData);
    
    // 显示步骤详情
    this.displayStepDetails(stepName, modifiedData);
    
    // 检查断点或单步模式
    if (this.breakpoints.has(stepName) || this.stepMode) {
      console.log(`\n⏸️ Paused at ${stepName}`);
      await this.handleBreakpoint(stepName, modifiedData);
    }
    
    return modifiedData;
  }

  /**
   * 显示步骤详情
   */
  displayStepDetails(stepName, data) {
    console.log(`\n📊 [${stepName}] Step Details:`);
    console.log(`   Timestamp: ${data.timestamp}`);
    console.log(`   Session ID: ${data.sessionId}`);
    
    switch (stepName) {
      case 'step1-input-processing':
        console.log(`   Model: ${data.originalRequest.model}`);
        console.log(`   Messages: ${data.originalRequest.messages.length}`);
        console.log(`   Token Count: ${data.tokenCount}`);
        console.log(`   Tools: ${data.toolCount}`);
        break;
        
      case 'step2-routing':
        console.log(`   Category: ${data.category}`);
        console.log(`   Provider: ${data.selectedProvider}`);
        console.log(`   Model Mapping: ${data.originalModel} → ${data.targetModel}`);
        break;
        
      case 'step3-transformation':
        console.log(`   System Prompt: ${data.transformationChanges.systemPromptHandling}`);
        console.log(`   Tools Transformed: ${data.transformationChanges.toolsTransformed}`);
        console.log(`   Message Format Changed: ${data.transformationChanges.messageFormatChanged}`);
        break;
        
      case 'step4-raw-response':
        console.log(`   Has Content: ${data.responseAnalysis.hasContent}`);
        console.log(`   Content Length: ${data.responseAnalysis.contentLength}`);
        console.log(`   Tool Calls: ${data.responseAnalysis.toolCallCount}`);
        console.log(`   Finish Reason: ${data.responseAnalysis.finishReason}`);
        break;
        
      case 'step5-transformer-input':
        console.log(`   Valid OpenAI Format: ${data.inputAnalysis.isValidOpenAI}`);
        console.log(`   Required Fields: ${data.inputAnalysis.hasRequiredFields}`);
        console.log(`   Data Integrity: ${data.inputAnalysis.dataIntegrity}`);
        break;
        
      case 'step6-transformer-output':
        console.log(`   Content Blocks: ${data.outputAnalysis.contentBlocks}`);
        console.log(`   Text Blocks: ${data.outputAnalysis.hasTextBlocks}`);
        console.log(`   Tool Use Blocks: ${data.outputAnalysis.hasToolUseBlocks}`);
        console.log(`   Stop Reason: ${data.outputAnalysis.stopReason}`);
        break;
    }
  }

  /**
   * 处理断点交互
   */
  async handleBreakpoint(stepName, data) {
    console.log('\n🛠️ Debugger Commands:');
    console.log('  c - continue');
    console.log('  s - step mode on/off');
    console.log('  i - inspect data');
    console.log('  m - modify data');
    console.log('  v - validate step');
    console.log('  q - quit');
    
    while (true) {
      const command = await this.waitForUserInput('\n[debugger] > ');
      
      switch (command.toLowerCase()) {
        case 'c':
        case 'continue':
          console.log('▶️ Continuing execution...');
          return;
          
        case 's':
        case 'step':
          this.stepMode = !this.stepMode;
          console.log(`👣 Step mode: ${this.stepMode ? 'ON' : 'OFF'}`);
          break;
          
        case 'i':
        case 'inspect':
          console.log('\n🔍 Data Inspection:');
          console.log(JSON.stringify(data, null, 2));
          break;
          
        case 'm':
        case 'modify':
          await this.interactiveModify(stepName);
          break;
          
        case 'v':
        case 'validate':
          await this.validateStep(stepName, data);
          break;
          
        case 'q':
        case 'quit':
          console.log('👋 Quitting debugger...');
          process.exit(0);
          
        default:
          console.log('❓ Unknown command. Use c, s, i, m, v, or q');
      }
    }
  }

  /**
   * 交互式数据修改
   */
  async interactiveModify(stepName) {
    console.log('\n✏️ Interactive Data Modification:');
    console.log('Enter path (e.g., "originalRequest.model") or "done" to finish:');
    
    while (true) {
      const path = await this.waitForUserInput('Path > ');
      if (path.toLowerCase() === 'done') break;
      
      const value = await this.waitForUserInput('New value (JSON) > ');
      try {
        const parsedValue = JSON.parse(value);
        this.modifyStepData(stepName, path, parsedValue);
      } catch (error) {
        // 如果不是JSON，作为字符串处理
        this.modifyStepData(stepName, path, value);
      }
    }
  }

  /**
   * 验证步骤数据
   */
  async validateStep(stepName, data) {
    console.log(`\n✅ Validating ${stepName}...`);
    
    const validation = this.performStepValidation(stepName, data);
    
    console.log('📋 Validation Results:');
    validation.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`   ${icon} ${result.check}: ${result.message}`);
    });
    
    const passedCount = validation.filter(r => r.passed).length;
    console.log(`\n📊 Validation Summary: ${passedCount}/${validation.length} checks passed`);
  }

  /**
   * 执行步骤验证
   */
  performStepValidation(stepName, data) {
    const validations = [];
    
    switch (stepName) {
      case 'step1-input-processing':
        validations.push({
          check: 'Has original request',
          passed: !!(data.originalRequest),
          message: data.originalRequest ? 'Request data present' : 'Missing request data'
        });
        validations.push({
          check: 'Has model name',
          passed: !!(data.originalRequest?.model),
          message: data.originalRequest?.model || 'Missing model name'
        });
        validations.push({
          check: 'Has messages',
          passed: !!(data.originalRequest?.messages?.length > 0),
          message: `${data.originalRequest?.messages?.length || 0} messages`
        });
        break;
        
      case 'step2-routing':
        validations.push({
          check: 'Has routing category',
          passed: !!(data.category),
          message: data.category || 'Missing category'
        });
        validations.push({
          check: 'Has selected provider',
          passed: !!(data.selectedProvider),
          message: data.selectedProvider || 'Missing provider'
        });
        validations.push({
          check: 'Has model mapping',
          passed: !!(data.originalModel && data.targetModel),
          message: `${data.originalModel} → ${data.targetModel}`
        });
        break;
        
      case 'step4-raw-response':
        validations.push({
          check: 'Has response content',
          passed: data.responseAnalysis?.hasContent,
          message: data.responseAnalysis?.hasContent ? 'Content present' : 'No content'
        });
        validations.push({
          check: 'Valid content length',
          passed: (data.responseAnalysis?.contentLength || 0) > 0,
          message: `${data.responseAnalysis?.contentLength || 0} characters`
        });
        break;
        
      case 'step6-transformer-output':
        validations.push({
          check: 'Has content blocks',
          passed: (data.outputAnalysis?.contentBlocks || 0) > 0,
          message: `${data.outputAnalysis?.contentBlocks || 0} blocks`
        });
        validations.push({
          check: 'Has text content',
          passed: data.outputAnalysis?.hasTextBlocks > 0,
          message: `${data.outputAnalysis?.hasTextBlocks || 0} text blocks`
        });
        break;
    }
    
    return validations;
  }

  /**
   * 执行完整流水线回放
   */
  async executeFullReplay() {
    console.log('\n🎬 Starting full pipeline replay...');
    
    const steps = [
      'step1-input-processing',
      'step2-routing', 
      'step3-transformation',
      'step4-raw-response',
      'step5-transformer-input',
      'step6-transformer-output'
    ];
    
    const results = {};
    
    for (const step of steps) {
      const result = await this.executeStep(step);
      results[step] = result;
      
      if (!result) {
        console.log(`⚠️ Pipeline interrupted at ${step}`);
        break;
      }
    }
    
    console.log('\n🏁 Replay completed');
    return results;
  }

  /**
   * 对比两个会话的差异
   */
  async compareWithSession(otherSessionId) {
    console.log(`\n🔄 Comparing with session: ${otherSessionId}`);
    
    const originalData = this.capturedData;
    await this.loadSession(otherSessionId);
    const otherData = this.capturedData;
    
    // 恢复原始数据
    this.capturedData = originalData;
    
    const comparison = {};
    const steps = Object.keys(originalData);
    
    for (const step of steps) {
      if (otherData[step]) {
        comparison[step] = this.compareStepData(originalData[step], otherData[step]);
      } else {
        comparison[step] = { missing: true };
      }
    }
    
    console.log('📊 Comparison Results:');
    for (const [step, diff] of Object.entries(comparison)) {
      console.log(`\n   [${step}]:`);
      if (diff.missing) {
        console.log('     ❌ Missing in comparison session');
      } else {
        console.log(`     📈 Differences found: ${diff.differences.length}`);
        diff.differences.slice(0, 3).forEach(d => {
          console.log(`       • ${d.path}: ${d.original} → ${d.other}`);
        });
      }
    }
    
    return comparison;
  }

  /**
   * 对比两个步骤数据
   */
  compareStepData(original, other) {
    const differences = [];
    
    const compare = (obj1, obj2, path = '') => {
      for (const key in obj1) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof obj1[key] === 'object' && obj1[key] !== null) {
          if (typeof obj2[key] === 'object' && obj2[key] !== null) {
            compare(obj1[key], obj2[key], currentPath);
          } else {
            differences.push({
              path: currentPath,
              original: JSON.stringify(obj1[key]),
              other: obj2[key]
            });
          }
        } else if (obj1[key] !== obj2[key]) {
          differences.push({
            path: currentPath,
            original: obj1[key],
            other: obj2[key]
          });
        }
      }
    };
    
    compare(original, other);
    return { differences };
  }

  /**
   * 生成回放报告
   */
  async generateReplayReport() {
    const report = {
      sessionId: this.currentSession,
      timestamp: new Date().toISOString(),
      stepsAvailable: Object.keys(this.capturedData),
      modificationsApplied: Object.keys(this.modifications),
      breakpointsSet: Array.from(this.breakpoints),
      stepModeEnabled: this.stepMode,
      validationResults: {}
    };
    
    // 对每个步骤执行验证
    for (const step of Object.keys(this.capturedData)) {
      const data = this.applyModifications(step, this.capturedData[step]);
      report.validationResults[step] = this.performStepValidation(step, data);
    }
    
    const reportPath = path.join(this.captureDir, `${this.currentSession}-replay-report.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📋 Replay report generated: ${reportPath}`);
    return report;
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.rl) {
      this.rl.close();
    }
  }
}

/**
 * 交互式回放调试会话
 */
async function runInteractiveReplaySession() {
  console.log('🎬 OpenAI Pipeline Replay System\n');
  
  const replaySystem = new OpenAIPipelineReplaySystem();
  replaySystem.createInteractiveInterface();
  
  try {
    // 列出可用会话
    const sessions = await replaySystem.listAvailableSessions();
    if (sessions.length === 0) {
      console.log('❌ No capture sessions found. Run data capture first.');
      return;
    }
    
    // 选择会话
    const sessionChoice = await replaySystem.waitForUserInput('Select session number: ');
    const sessionIndex = parseInt(sessionChoice) - 1;
    
    if (sessionIndex < 0 || sessionIndex >= sessions.length) {
      console.log('❌ Invalid session selection');
      return;
    }
    
    const selectedSession = sessions[sessionIndex];
    await replaySystem.loadSession(selectedSession);
    
    // 调试选项菜单
    while (true) {
      console.log('\n🛠️ Replay System Commands:');
      console.log('  1. Set breakpoint');
      console.log('  2. Enable step mode');
      console.log('  3. Execute full replay');
      console.log('  4. Execute single step');
      console.log('  5. Modify data');
      console.log('  6. Generate report');
      console.log('  7. Compare with other session');
      console.log('  q. Quit');
      
      const choice = await replaySystem.waitForUserInput('Choose option: ');
      
      switch (choice) {
        case '1':
          const step = await replaySystem.waitForUserInput('Step name (e.g., step1-input-processing): ');
          replaySystem.setBreakpoint(step);
          break;
          
        case '2':
          replaySystem.enableStepMode();
          break;
          
        case '3':
          await replaySystem.executeFullReplay();
          break;
          
        case '4':
          const singleStep = await replaySystem.waitForUserInput('Step name: ');
          await replaySystem.executeStep(singleStep);
          break;
          
        case '5':
          const modifyStep = await replaySystem.waitForUserInput('Step name: ');
          await replaySystem.interactiveModify(modifyStep);
          break;
          
        case '6':
          await replaySystem.generateReplayReport();
          break;
          
        case '7':
          const otherSession = await replaySystem.waitForUserInput('Other session ID: ');
          await replaySystem.compareWithSession(otherSession);
          break;
          
        case 'q':
        case 'quit':
          console.log('👋 Goodbye!');
          replaySystem.cleanup();
          return;
          
        default:
          console.log('❓ Invalid choice');
      }
    }
    
  } catch (error) {
    console.error('❌ Replay session failed:', error);
  } finally {
    replaySystem.cleanup();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runInteractiveReplaySession()
    .then(() => {
      console.log('\n✅ Replay system session completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Replay system failed:', error);
      process.exit(1);
    });
}

module.exports = { OpenAIPipelineReplaySystem, runInteractiveReplaySession };