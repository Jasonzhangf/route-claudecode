/**
 * 端到端测试运行器
 * 
 * 执行RCC v4.1的端到端测试套件
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

// 完整流程测试用例
const fullFlowTestCases: TestCase[] = [
  {
    id: 'standard-request-flow',
    name: 'Standard Request Flow Test',
    description: '验证标准请求处理流程',
    type: 'e2e',
    module: 'client,router,pipeline,server',
    input: {
      request: {
        model: 'claude-3-sonnet',
        messages: [{ role: 'user' as const, content: 'Hello, how are you?' }]
      }
    },
    expected: {
      hasResponse: true,
      responseFormat: 'anthropic',
      finishReason: expect.any(String)
    },
    timeout: 30000,
    tags: ['e2e', 'flow'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'tool-calling-flow',
    name: 'Tool Calling Flow Test',
    description: '验证工具调用处理流程',
    type: 'e2e',
    module: 'client,router,pipeline,server',
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
      hasResponse: true,
      hasToolCalls: true,
      toolCallsFormat: 'anthropic'
    },
    timeout: 35000,
    tags: ['e2e', 'flow', 'tools'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'error-response-flow',
    name: 'Error Response Flow Test',
    description: '验证错误响应处理流程',
    type: 'e2e',
    module: 'client,router,pipeline,server',
    input: {
      request: {
        model: 'invalid-model',
        messages: [{ role: 'user' as const, content: 'This should cause an error' }]
      }
    },
    expected: {
      hasResponse: true,
      hasError: true,
      errorFormat: 'anthropic'
    },
    timeout: 25000,
    tags: ['e2e', 'flow', 'error'],
    createdAt: new Date().toISOString()
  }
];

// 性能基准测试用例
const performanceTestCases: TestCase[] = [
  {
    id: 'response-time-test',
    name: 'Response Time Test',
    description: '验证系统响应时间',
    type: 'performance',
    module: 'client,router,pipeline,server',
    input: {
      concurrentUsers: 10,
      duration: 60,
      rampUp: 10,
      testCase: {
        name: 'response_time_test',
        input: {
          request: {
            model: 'claude-3-sonnet',
            messages: [{ role: 'user' as const, content: 'Hello' }]
          }
        }
      }
    },
    expected: {
      averageResponseTime: '<100ms',
      successRate: '>95%'
    },
    timeout: 120000,
    tags: ['e2e', 'performance'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'concurrent-processing-test',
    name: 'Concurrent Processing Test',
    description: '验证并发处理能力',
    type: 'performance',
    module: 'client,router,pipeline,server',
    input: {
      concurrentUsers: 50,
      duration: 120,
      rampUp: 30,
      testCase: {
        name: 'concurrent_processing_test',
        input: {
          request: {
            model: 'claude-3-sonnet',
            messages: [{ role: 'user' as const, content: 'List files' }],
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
        }
      }
    },
    expected: {
      throughput: '>50 requests/second',
      errorRate: '<5%'
    },
    timeout: 180000,
    tags: ['e2e', 'performance'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'resource-usage-test',
    name: 'Resource Usage Test',
    description: '验证资源使用情况',
    type: 'performance',
    module: 'client,router,pipeline,server',
    input: {
      concurrentUsers: 25,
      duration: 90,
      rampUp: 15,
      testCase: {
        name: 'resource_usage_test',
        input: {
          request: {
            model: 'claude-3-sonnet',
            messages: [{ role: 'user' as const, content: 'Complex request with multiple tools' }],
            tools: [
              {
                name: 'list_files',
                description: 'List files in directory',
                input_schema: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' }
                  },
                  required: ['path']
                }
              },
              {
                name: 'read_file',
                description: 'Read file content',
                input_schema: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' }
                  },
                  required: ['path']
                }
              }
            ]
          }
        }
      }
    },
    expected: {
      memoryUsage: '<200MB',
      cpuUsage: '<80%'
    },
    timeout: 150000,
    tags: ['e2e', 'performance'],
    createdAt: new Date().toISOString()
  }
];

// 端到端测试套件
const e2eTestSuite: TestSuite = {
  id: 'e2e-test-suite',
  name: 'End-to-End Test Suite',
  description: 'RCC v4.1端到端测试套件',
  testCases: [...fullFlowTestCases, ...performanceTestCases],
  parallel: false,  // 端到端测试通常需要串行执行以避免资源冲突
  timeout: 300000,
  tags: ['e2e']
};

// 测试计划
const e2eTestPlan: TestPlan = {
  id: 'e2e-test-plan',
  name: 'RCC v4.1 End-to-End Test Plan',
  description: 'RCC v4.1端到端测试计划',
  testSuites: [e2eTestSuite],
  environment: process.env.TEST_ENV || 'e2e',
  parallel: false,
  timeout: 600000
};

/**
 * 执行端到端测试
 */
async function runE2ETests(): Promise<void> {
  console.log('🚀 开始执行端到端测试...');
  
  try {
    // 执行测试计划
    const report = await testEngine.executeTestPlan(e2eTestPlan);
    
    // 生成报告
    const reportConfig = {
      format: 'html' as const,
      outputPath: './test-results',
      includeDetails: true,
      includeCharts: true
    };
    
    const reportContent = await testReporter.generateReport(report, reportConfig);
    
    // 输出结果
    console.log(`✅ 端到端测试执行完成`);
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
      console.log(`✅ 所有端到端测试通过`);
    }
  } catch (error) {
    console.error(`❌ 端到端测试执行失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--e2e') || args.length === 0) {
    await runE2ETests();
  } else {
    console.log('用法: npm run test:e2e');
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

export { runE2ETests };