/**
 * 集成测试运行器
 * 
 * 执行RCC v4.1的集成测试套件
 * 
 * @author RCC Test Framework
 */

import { TestExecutionEngine } from '../src/test/execution-engine';
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
const testReporter = new TestReportingSystem();

// 模块间接口测试用例
const interfaceTestCases: TestCase[] = [
  {
    id: 'client-router-interface',
    name: 'Client-Router Interface Test',
    description: '验证客户端与路由器模块接口',
    type: 'integration',
    module: 'client,router',
    input: {
      request: {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user' as const, content: 'Hello' }]
      }
    },
    expected: {
      provider: 'anthropic',
      pipeline: 'coding'
    },
    timeout: 15000,
    tags: ['integration', 'interface'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'router-pipeline-interface',
    name: 'Router-Pipeline Interface Test',
    description: '验证路由器与流水线模块接口',
    type: 'integration',
    module: 'router,pipeline',
    input: {
      pipelineConfig: {
        modules: ['transformer', 'protocol', 'server-compatibility', 'server']
      },
      requestData: {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user' as const, content: 'Hello' }]
      }
    },
    expected: {
      layersProcessed: 4,
      status: 'completed'
    },
    timeout: 20000,
    tags: ['integration', 'interface'],
    createdAt: new Date().toISOString()
  }
];

// 数据流测试用例
const dataFlowTestCases: TestCase[] = [
  {
    id: 'request-data-flow',
    name: 'Request Data Flow Test',
    description: '验证请求处理数据流',
    type: 'integration',
    module: 'client,router,pipeline',
    input: {
      request: {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user' as const, content: 'List files in current directory' }],
        tools: [{
          name: 'list_files',
          description: 'List files in directory',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string' }
            },
            required: ['path']
          }
        }]
      }
    },
    expected: {
      hasRequest: true,
      hasRouting: true,
      hasPipeline: true
    },
    timeout: 25000,
    tags: ['integration', 'data-flow'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'response-data-flow',
    name: 'Response Data Flow Test',
    description: '验证响应处理数据流',
    type: 'integration',
    module: 'pipeline,router,client',
    input: {
      response: {
        id: 'test-response',
        choices: [{
          message: {
            role: 'assistant',
            content: 'Here are the files in the current directory',
            tool_calls: [{
              id: 'tool-call-1',
              type: 'function',
              function: {
                name: 'list_files',
                arguments: '{"path": "."}'
              }
            }]
          },
          finish_reason: 'tool_calls'
        }]
      }
    },
    expected: {
      hasResponse: true,
      hasTransformation: true,
      hasDelivery: true
    },
    timeout: 25000,
    tags: ['integration', 'data-flow'],
    createdAt: new Date().toISOString()
  }
];

// 错误处理测试用例
const errorHandlingTestCases: TestCase[] = [
  {
    id: 'network-error-handling',
    name: 'Network Error Handling Test',
    description: '验证网络错误处理',
    type: 'integration',
    module: 'client,router,pipeline',
    input: {
      errorType: 'network_error',
      errorMessage: 'Connection timeout',
      timeout: 5000
    },
    expected: {
      handled: true,
      recovery: {
        attempted: true,
        successful: true
      }
    },
    timeout: 15000,
    tags: ['integration', 'error-handling'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'config-error-handling',
    name: 'Configuration Error Handling Test',
    description: '验证配置错误处理',
    type: 'integration',
    module: 'router',
    input: {
      config: {
        routing: {
          strategy: 'invalid-strategy'
        }
      }
    },
    expected: {
      handled: true,
      errorResponse: {
        code: 'INVALID_CONFIG',
        message: expect.any(String)
      }
    },
    timeout: 10000,
    tags: ['integration', 'error-handling'],
    createdAt: new Date().toISOString()
  }
];

// 集成测试套件
const integrationTestSuite: TestSuite = {
  id: 'integration-test-suite',
  name: 'Integration Test Suite',
  description: 'RCC v4.1集成测试套件',
  testCases: [...interfaceTestCases, ...dataFlowTestCases, ...errorHandlingTestCases],
  parallel: true,
  timeout: 60000,
  tags: ['integration']
};

// 测试计划
const integrationTestPlan: TestPlan = {
  id: 'integration-test-plan',
  name: 'RCC v4.1 Integration Test Plan',
  description: 'RCC v4.1集成测试计划',
  testSuites: [integrationTestSuite],
  environment: process.env.TEST_ENV || 'integration',
  parallel: true,
  timeout: 120000
};

/**
 * 执行集成测试
 */
async function runIntegrationTests(): Promise<void> {
  console.log('🚀 开始执行集成测试...');
  
  try {
    // 执行测试计划
    const report = await testEngine.executeTestPlan(integrationTestPlan);
    
    // 生成报告
    const reportConfig = {
      format: 'html' as const,
      outputPath: './test-results',
      includeDetails: true,
      includeCharts: true
    };
    
    const reportContent = await testReporter.generateReport(report, reportConfig);
    
    // 输出结果
    console.log(`✅ 集成测试执行完成`);
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
      console.log(`✅ 所有集成测试通过`);
    }
  } catch (error) {
    console.error(`❌ 集成测试执行失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--integration') || args.length === 0) {
    await runIntegrationTests();
  } else {
    console.log('用法: npm run test:integration');
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

export { runIntegrationTests };