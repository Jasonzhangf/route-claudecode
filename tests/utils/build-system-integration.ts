// 与现有构建系统的集成方案
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { testLogger } from './test-logger';

export class BuildSystemIntegration {
  // 扩展 package.json 中的测试脚本
  static extendTestScripts(): void {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      testLogger.warn('package.json not found, skipping script extension');
      return;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // 确保存在 scripts 对象
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    // 添加新的测试脚本
    packageJson.scripts = {
      ...packageJson.scripts,
      'test:unit': 'jest --config=tests/config/jest.config.unit.js',
      'test:integration': 'jest --config=tests/config/jest.config.integration.js',
      'test:e2e': 'jest tests/e2e/',
      'test:performance': 'node tests/performance/run-performance-tests.js',
      'test:coverage': 'jest --coverage',
      'test:ci': 'npm run test:unit && npm run test:integration',
      'test:watch': 'jest --watch',
      'test:debug': 'node --inspect-brk node_modules/.bin/jest --runInBand'
    };
    
    // 写回 package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    testLogger.info('Extended test scripts in package.json');
  }
  
  // 创建 GitHub Actions 工作流
  static createGitHubWorkflows(): void {
    const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
    if (!fs.existsSync(workflowsDir)) {
      fs.mkdirSync(workflowsDir, { recursive: true });
    }
    
    // 创建测试工作流
    const testWorkflow = `
name: Run Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run coverage check
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
`;
    
    fs.writeFileSync(path.join(workflowsDir, 'test.yml'), testWorkflow.trim());
    testLogger.info('Created GitHub Actions test workflow');
    
    // 创建性能测试工作流
    const performanceWorkflow = `
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * 1'  # 每周一凌晨2点运行
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 20.x
      uses: actions/setup-node@v3
      with:
        node-version: '20.x'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run performance tests
      run: npm run test:performance
    
    - name: Archive performance results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: performance-results
        path: test-results/performance/
`;
    
    fs.writeFileSync(path.join(workflowsDir, 'performance.yml'), performanceWorkflow.trim());
    testLogger.info('Created GitHub Actions performance workflow');
  }
  
  // 创建测试启动脚本
  static createTestScripts(): void {
    // 创建单元测试运行脚本
    const unitTestScript = `#!/bin/bash
# 单元测试运行脚本

set -e

echo "Running unit tests..."
npm run test:unit

echo "Unit tests completed successfully!"
`;
    
    const unitTestScriptPath = path.join(process.cwd(), 'scripts', 'run-unit-tests.sh');
    fs.writeFileSync(unitTestScriptPath, unitTestScript.trim());
    fs.chmodSync(unitTestScriptPath, '755');
    
    // 创建集成测试运行脚本
    const integrationTestScript = `#!/bin/bash
# 集成测试运行脚本

set -e

echo "Running integration tests..."
npm run test:integration

echo "Integration tests completed successfully!"
`;
    
    const integrationTestScriptPath = path.join(process.cwd(), 'scripts', 'run-integration-tests.sh');
    fs.writeFileSync(integrationTestScriptPath, integrationTestScript.trim());
    fs.chmodSync(integrationTestScriptPath, '755');
    
    // 创建完整测试套件运行脚本
    const fullTestScript = `#!/bin/bash
# 完整测试套件运行脚本

set -e

echo "Running full test suite..."

echo "1. Running unit tests..."
npm run test:unit

echo "2. Running integration tests..."
npm run test:integration

echo "3. Running coverage check..."
npm run test:coverage

echo "Full test suite completed successfully!"
`;
    
    const fullTestScriptPath = path.join(process.cwd(), 'scripts', 'run-full-test-suite.sh');
    fs.writeFileSync(fullTestScriptPath, fullTestScript.trim());
    fs.chmodSync(fullTestScriptPath, '755');
    
    testLogger.info('Created test runner scripts');
  }
  
  // 验证构建系统集成
  static verifyIntegration(): boolean {
    try {
      // 检查 package.json 是否包含测试脚本
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        testLogger.error('package.json not found');
        return false;
      }
      
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const requiredScripts = ['test:unit', 'test:integration', 'test:coverage'];
      
      for (const script of requiredScripts) {
        if (!packageJson.scripts || !packageJson.scripts[script]) {
          testLogger.error(`Required test script '${script}' not found in package.json`);
          return false;
        }
      }
      
      // 检查工作流文件是否存在
      const workflowFiles = ['test.yml', 'performance.yml'];
      const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
      
      for (const workflow of workflowFiles) {
        const workflowPath = path.join(workflowsDir, workflow);
        if (!fs.existsSync(workflowPath)) {
          testLogger.error(`Required workflow file '${workflow}' not found`);
          return false;
        }
      }
      
      // 检查脚本文件是否存在
      const scriptFiles = ['run-unit-tests.sh', 'run-integration-tests.sh', 'run-full-test-suite.sh'];
      const scriptsDir = path.join(process.cwd(), 'scripts');
      
      for (const script of scriptFiles) {
        const scriptPath = path.join(scriptsDir, script);
        if (!fs.existsSync(scriptPath)) {
          testLogger.error(`Required script file '${script}' not found`);
          return false;
        }
      }
      
      testLogger.info('Build system integration verification passed');
      return true;
    } catch (error) {
      testLogger.error('Build system integration verification failed', { error });
      return false;
    }
  }
  
  // 生成测试报告摘要
  static generateTestReportSummary(): string {
    const summary = `
# 测试框架集成摘要

## 已添加的 npm 脚本

- \`npm run test:unit\` - 运行单元测试
- \`npm run test:integration\` - 运行集成测试
- \`npm run test:e2e\` - 运行端到端测试
- \`npm run test:performance\` - 运行性能测试
- \`npm run test:coverage\` - 运行测试并生成覆盖率报告
- \`npm run test:ci\` - 运行 CI 测试套件
- \`npm run test:watch\` - 监听模式运行测试
- \`npm run test:debug\` - 调试模式运行测试

## GitHub Actions 工作流

- \`test.yml\` - 自动化测试工作流
- \`performance.yml\` - 性能测试工作流

## 测试运行脚本

- \`scripts/run-unit-tests.sh\` - 单元测试运行脚本
- \`scripts/run-integration-tests.sh\` - 集成测试运行脚本
- \`scripts/run-full-test-suite.sh\` - 完整测试套件运行脚本

## 集成验证

运行 \`npm run test:ci\` 来验证集成是否成功。
`;
    
    return summary.trim();
  }
}