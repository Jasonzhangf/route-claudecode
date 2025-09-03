/**
 * 测试运行器
 * 
 * 执行RCC v4.1的完整测试套件
 * 
 * @author RCC Test Framework
 */

import { TestExecutionEngine } from '../src/test/execution-engine';
import { TestDataManager } from '../src/test/data-manager';
import { TestReportingSystem } from '../src/test/reporting-system';
import { TestPlan, TestSuite, TestCase } from '../src/test/execution-engine';

// 测试配置
const testConfig = {
  baseUrl: process.env.BASE_URL || 'http://localhost:5506',
  authToken: process.env.TEST_AUTH_TOKEN || 'test-token',
  timeout: parseInt(process.env.TEST_TIMEOUT || '30000'),
  retries: parseInt(process.env.TEST_RETRIES || '3'),
  parallel: process.env.TEST_PARALLEL === 'true',
  maxConcurrency: parseInt(process.env.TEST_MAX_CONCURRENCY || '10')
};

// 创建测试组件
const testEngine = new TestExecutionEngine(testConfig);
const testDataManager = new TestDataManager('./test-data');
const testReporter = new TestReportingSystem();

// 客户端模块测试用例
const clientTestCases: TestCase[] = [
  {
    id: 'client-health-check',
    name: 'Client Module Health Check',
    description: '验证客户端模块健康检查接口',
    type: 'unit',
    module: 'client',
    input: {},
    expected: {
      status: 'healthy'
    },
    timeout: 5000,
    tags: ['client', 'health'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'client-cli-command',
    name: 'Client CLI Command Test',
    description: '验证客户端CLI命令执行',
    type: 'unit',
    module: 'client',
    input: {
      command: 'start',
      args: ['--port', '5506']
    },
    expected: {
      output: 'Server started on port 5506'
    },
    timeout: 5000,
    tags: ['client', 'cli'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'client-http-request',
    name: 'Client HTTP Request Test',
    description: '验证客户端HTTP请求功能',
    type: 'unit',
    module: 'client',
    input: {
      method: 'GET',
      url: '/test',
      headers: {},
      body: null
    },
    expected: {
      status: 200,
      responseTime: '<100ms'
    },
    timeout: 5000,
    tags: ['client', 'http'],
    createdAt: new Date().toISOString()
  }
];

// 路由器模块测试用例
const routerTestCases: TestCase[] = [
  {
    id: 'router-request-routing',
    name: 'Router Request Routing Test',
    description: '验证请求路由功能',
    type: 'unit',
    module: 'router',
    input: {
      model: 'claude-3-sonnet',
      messages: [{ role: 'user' as const, content: 'Hello' }]
    },
    expected: {
      provider: 'anthropic',
      pipeline: 'coding'
    },
    timeout: 10000,
    tags: ['router', 'routing'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'router-config-loading',
    name: 'Router Configuration Loading Test',
    description: '验证配置加载功能',
    type: 'unit',
    module: 'router',
    input: {
      routing: {
        strategy: 'round-robin',
        defaultProvider: 'anthropic'
      },
      zeroFallbackPolicy: true
    },
    expected: {
      valid: true,
      warnings: []
    },
    timeout: 5000,
    tags: ['router', 'config'],
    createdAt: new Date().toISOString()
  }
];

// 流水线模块测试用例
const pipelineTestCases: TestCase[] = [
  {
    id: 'pipeline-module-testing',
    name: 'Pipeline Module Testing',
    description: '验证流水线子模块功能',
    type: 'unit',
    module: 'pipeline',
    input: {
      module: 'transformer',
      input: {
        type: 'anthropic',
        data: {
          content: 'Test data'
        }
      }
    },
    expected: {
      type: 'openai',
      converted: true
    },
    timeout: 5000,
    tags: ['pipeline', 'module'],
    createdAt: new Date().toISOString()
  }
];

// 测试套件
const unitTestSuite: TestSuite = {
  id: 'unit-test-suite',
  name: 'Unit Test Suite',
  description: 'RCC v4.1单元测试套件',
  testCases: [...clientTestCases, ...routerTestCases, ...pipelineTestCases],
  parallel: true,
  timeout: 30000,
  tags: ['unit']
};

// 测试计划
const testPlan: TestPlan = {
  id: 'full-test-plan',
  name: 'RCC v4.1 Full Test Plan',
  description: '完整的RCC v4.1测试计划',
  testSuites: [unitTestSuite],
  environment: process.env.TEST_ENV || 'development',
  parallel: true,
  timeout: 60000
};

/**
 * 执行单元测试
 */
async function runUnitTests(): Promise<void> {
  console.log('🚀 开始执行单元测试...');
  
  try {
    // 执行测试计划
    const report = await testEngine.executeTestPlan(testPlan);
    
    // 生成报告
    const reportConfig = {
      format: 'html' as const,
      outputPath: './test-results',
      includeDetails: true,
      includeCharts: true
    };
    
    const reportContent = await testReporter.generateReport(report, reportConfig);
    
    // 输出结果
    console.log(`✅ 单元测试执行完成`);
    console.log(`📊 测试结果摘要:`);
    console.log(`   总测试数: ${report.summary.total}`);
    console.log(`   通过: ${report.summary.passed}`);
    console.log(`   失败: ${report.summary.failed}`);
    console.log(`   跳过: ${report.summary.skipped}`);
    console.log(`   通过率: ${((report.summary.passed / report.summary.total) * 100).toFixed(2)}%`);
    
    // 检查是否所有测试都通过
    if (report.summary.failed > 0) {
      console.log(`❌ ${report.summary.failed} 个测试失败`);
      process.exit(1);
    } else {
      console.log(`✅ 所有单元测试通过`);
    }
  } catch (error) {
    console.error(`❌ 单元测试执行失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--unit') || args.length === 0) {
    await runUnitTests();
  } else {
    console.log('用法: npm run test:unit');
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error(`❌ 测试执行异常: ${error.message}`);
    process.exit(1);
  });
}

export { runUnitTests };