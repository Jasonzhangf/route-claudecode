#!/usr/bin/env node

/**
 * Router Logic Unit Test - 验证路由映射功能
 * 
 * 测试getModelMapping函数的核心逻辑
 */

import * as fs from 'fs';
import { RCCv4Config } from './src/config/config-types';

interface TestResult {
  name: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

/**
 * 复制并测试getModelMapping函数逻辑
 */
function getModelMapping(originalModel: string, routingRules: any): string {
  if (!routingRules) {
    return originalModel;
  }

  // 支持简化配置格式
  let routerConfig = null;
  
  if (routingRules.router) {
    routerConfig = routingRules.router;
  } else if (typeof routingRules === 'object' && !Array.isArray(routingRules)) {
    routerConfig = routingRules;
  }

  if (!routerConfig) {
    return originalModel;
  }

  const routeConfig = routerConfig[originalModel];
  if (!routeConfig) {
    return originalModel;
  }

  // 解析简化配置: "provider,model" 格式
  if (typeof routeConfig === 'string' && routeConfig.includes(',')) {
    const [provider, mappedModel] = routeConfig.split(',');
    return mappedModel;
  }

  if (typeof routeConfig === 'object' && routeConfig.model) {
    return routeConfig.model;
  }

  return originalModel;
}

async function runRouterUnitTest(): Promise<boolean> {
  try {
    const configPath = '/Users/fanzhang/.route-claudecode/config/v4/single-provider/lmstudio-v4-5506-simplified.json';
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config: RCCv4Config = JSON.parse(configContent);

    const testCases = [
      {
        name: 'claude-sonnet-4模型映射',
        input: 'claude-sonnet-4-20250514',
        expected: 'qwen3-235b-a22b-instruct-2507-mlx',
        routingRules: config.router
      },
      {
        name: 'claude-3-5-sonnet模型映射', 
        input: 'claude-3-5-sonnet-20241022',
        expected: 'qwen3-30b-a3b-instruct-2507-mlx',
        routingRules: config.router
      },
      {
        name: 'default模型映射',
        input: 'default',
        expected: 'gpt-oss-20b-mlx',
        routingRules: config.router
      },
      {
        name: '包装router配置',
        input: 'claude-sonnet-4-20250514', 
        expected: 'qwen3-235b-a22b-instruct-2507-mlx',
        routingRules: { router: config.router }
      },
      {
        name: '不存在的模型',
        input: 'non-existent-model',
        expected: 'non-existent-model',
        routingRules: config.router
      }
    ];

    const results: TestResult[] = testCases.map(testCase => {
      const actual = getModelMapping(testCase.input, testCase.routingRules);
      return {
        name: testCase.name,
        input: testCase.input,
        expected: testCase.expected,
        actual,
        passed: actual === testCase.expected
      };
    });

    const passedTests = results.filter(result => result.passed).length;
    const totalTests = results.length;

    // 生成测试报告
    const report = {
      timestamp: new Date().toISOString(),
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      success: passedTests === totalTests,
      results: results.map(result => ({
        name: result.name,
        input: result.input,
        expected: result.expected,
        actual: result.actual,
        status: result.passed ? 'PASS' : 'FAIL'
      }))
    };

    // 保存测试报告
    const reportPath = './test-results/router-unit-test-report.json';
    fs.mkdirSync('./test-results', { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report.success;

  } catch (error) {
    const errorReport = {
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0
    };

    fs.mkdirSync('./test-results', { recursive: true });
    fs.writeFileSync('./test-results/router-unit-test-report.json', JSON.stringify(errorReport, null, 2));
    
    return false;
  }
}

// 执行测试
if (require.main === module) {
  runRouterUnitTest().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { getModelMapping, runRouterUnitTest };