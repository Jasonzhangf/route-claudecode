/**
 * 测试执行引擎
 * 
 * 负责执行各种类型的测试用例，包括单元测试、集成测试、端到端测试和性能测试
 * 
 * @author RCC Test Framework
 */

import axios from 'axios';
// import { AxiosInstance } from 'axios';  // 注释掉导致错误的导入
import { TestData, TestDataSource, CleanupCriteria } from './data-manager';
import { v4 as uuidv4 } from 'uuid';

// 测试用例接口
export interface TestCase {
  id: string;
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance';
  module: string;
  input: any;
  expected: any;
  timeout?: number;
  tags?: string[];
  createdAt: string;
}

// 测试套件接口
export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  parallel?: boolean;
  timeout?: number;
  tags?: string[];
}

// 测试计划接口
export interface TestPlan {
  id: string;
  name: string;
  description: string;
  testSuites: TestSuite[];
  environment: string;
  parallel?: boolean;
  timeout?: number;
}

// 测试配置接口
export interface TestConfig {
  baseUrl: string;
  authToken: string;
  timeout: number;
  retries: number;
  parallel: boolean;
  maxConcurrency: number;
}

// 测试结果接口
export interface TestResult {
  id: string;
  testCaseId: string;
  status: 'passed' | 'failed' | 'skipped' | 'running';
  startTime: string;
  endTime: string;
  duration: number;
  input: any;
  expected: any;
  actual: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  metadata: {
    environment: string;
    runner: string;
    tags: string[];
  };
}

// 测试报告接口
export interface TestReport {
  id: string;
  planId: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  results: TestResult[];
  environment: string;
  metadata: {
    runner: string;
    version: string;
    tags: string[];
  };
}

// 性能测试配置
export interface PerformanceConfig {
  concurrentUsers: number;
  duration: number; // seconds
  rampUp: number; // seconds
  testCase: TestCase;
}

// 性能测试结果
export interface PerformanceResult {
  testName: string;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    percentile95: number;
    percentile99: number;
    throughput: number; // requests per second
  };
  resourceUsage: {
    cpu: number; // percentage
    memory: number; // MB
    network: number; // KB/s
  };
  errors: Array<{
    code: string;
    message: string;
    count: number;
  }>;
}

/**
 * 测试执行引擎类
 */
export class TestExecutionEngine {
  private httpClient: any;  // 使用any类型替代AxiosInstance
  private testConfig: TestConfig;
  private activeTests: Map<string, TestResult>;
  private testResults: TestResult[];

  constructor(config: TestConfig) {
    this.testConfig = config;
    this.activeTests = new Map();
    this.testResults = [];
    
    // 初始化HTTP客户端
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 添加重试逻辑
    this.setupRetryInterceptor();
  }

  /**
   * 设置重试拦截器
   */
  private setupRetryInterceptor(): void {
    this.httpClient.interceptors.response.use(
      response => response,
      async (error) => {
        const config = error.config;
        
        if (!config || !config.retryCount) {
          config.retryCount = 0;
        }
        
        if (config.retryCount >= this.testConfig.retries) {
          return Promise.reject(error);
        }
        
        config.retryCount += 1;
        
        // 指数退避延迟
        const delay = Math.pow(2, config.retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.httpClient(config);
      }
    );
  }

  /**
   * 执行测试用例
   * @param testCase 测试用例
   * @returns 测试结果
   */
  async executeTestCase(testCase: TestCase): Promise<TestResult> {
    const testResult: TestResult = {
      id: uuidv4(),
      testCaseId: testCase.id,
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: '',
      duration: 0,
      input: testCase.input,
      expected: testCase.expected,
      actual: null,
      metadata: {
        environment: 'default',
        runner: 'test-execution-engine',
        tags: testCase.tags || []
      }
    };

    // 记录活跃测试
    this.activeTests.set(testResult.id, testResult);

    try {
      // 根据测试类型执行不同的测试逻辑
      switch (testCase.type) {
        case 'unit':
          testResult.actual = await this.executeUnitFunctionalTest(testCase);
          break;
          
        case 'integration':
          testResult.actual = await this.executeIntegrationTest(testCase);
          break;
          
        case 'e2e':
          testResult.actual = await this.executeEndToEndTest(testCase);
          break;
          
        case 'performance':
          testResult.actual = await this.executePerformanceTest(testCase);
          break;
          
        default:
          throw new Error(`Unsupported test type: ${testCase.type}`);
      }

      // 验证结果
      if (this.validateTestResult(testCase.expected, testResult.actual)) {
        testResult.status = 'passed';
      } else {
        testResult.status = 'failed';
        testResult.error = {
          message: 'Test result does not match expected output',
          code: 'ASSERTION_FAILED'
        };
      }
    } catch (error) {
      testResult.status = 'failed';
      testResult.error = {
        message: error.message,
        stack: error.stack,
        code: error.code || 'TEST_EXECUTION_ERROR'
      };
    } finally {
      testResult.endTime = new Date().toISOString();
      testResult.duration = new Date(testResult.endTime).getTime() - new Date(testResult.startTime).getTime();
      this.activeTests.delete(testResult.id);
      this.testResults.push(testResult);
    }

    return testResult;
  }

  /**
   * 执行单元功能测试
   * @param testCase 测试用例
   * @returns 测试结果
   */
  private async executeUnitFunctionalTest(testCase: TestCase): Promise<any> {
    const timeout = testCase.timeout || this.testConfig.timeout;
    
    // 构造API端点
    const endpoint = `/api/v1/${testCase.module}/test/functional`;
    
    try {
      const response = await this.httpClient.post(endpoint, {
        testCase: {
          name: testCase.name,
          description: testCase.description,
          input: testCase.input,
          expected: testCase.expected,
          timeout
        }
      }, {
        timeout
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Unit test failed for module ${testCase.module}: ${error.message}`);
    }
  }

  /**
   * 执行集成测试
   * @param testCase 测试用例
   * @returns 测试结果
   */
  private async executeIntegrationTest(testCase: TestCase): Promise<any> {
    const timeout = testCase.timeout || this.testConfig.timeout * 2;
    
    // 构造API端点
    const endpoint = `/api/v1/${testCase.module}/test/integration`;
    
    try {
      const response = await this.httpClient.post(endpoint, {
        testCase: {
          name: testCase.name,
          description: testCase.description,
          input: testCase.input,
          expected: testCase.expected,
          timeout
        }
      }, {
        timeout
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`Integration test failed for module ${testCase.module}: ${error.message}`);
    }
  }

  /**
   * 执行端到端测试
   * @param testCase 测试用例
   * @returns 测试结果
   */
  private async executeEndToEndTest(testCase: TestCase): Promise<any> {
    const timeout = testCase.timeout || this.testConfig.timeout * 3;
    
    // 构造API端点
    const endpoint = `/api/v1/system/test/e2e`;
    
    try {
      const response = await this.httpClient.post(endpoint, {
        testCase: {
          name: testCase.name,
          description: testCase.description,
          input: testCase.input,
          expected: testCase.expected,
          timeout,
          modules: testCase.module.split(',')
        }
      }, {
        timeout
      });
      
      return response.data;
    } catch (error) {
      throw new Error(`End-to-end test failed: ${error.message}`);
    }
  }

  /**
   * 执行性能测试
   * @param testCase 测试用例
   * @returns 性能测试结果
   */
  private async executePerformanceTest(testCase: TestCase): Promise<PerformanceResult> {
    const timeout = testCase.timeout || this.testConfig.timeout * 10;
    
    // 构造API端点
    const endpoint = `/api/v1/${testCase.module}/test/performance`;
    
    try {
      const response = await this.httpClient.post(endpoint, {
        config: testCase.input as PerformanceConfig
      }, {
        timeout
      });
      
      return response.data.data as PerformanceResult;
    } catch (error) {
      throw new Error(`Performance test failed for module ${testCase.module}: ${error.message}`);
    }
  }

  /**
   * 验证测试结果
   * @param expected 期望结果
   * @param actual 实际结果
   * @returns 是否匹配
   */
  private validateTestResult(expected: any, actual: any): boolean {
    // 简单的深度相等比较
    return JSON.stringify(expected) === JSON.stringify(actual);
  }

  /**
   * 并行执行测试套件
   * @param testSuite 测试套件
   * @returns 测试结果数组
   */
  async executeTestSuite(testSuite: TestSuite): Promise<TestResult[]> {
    const startTime = Date.now();
    const results: TestResult[] = [];
    
    if (testSuite.parallel) {
      // 并行执行
      const promises = testSuite.testCases.map(testCase => 
        this.executeTestCase(testCase)
      );
      
      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      // 串行执行
      for (const testCase of testSuite.testCases) {
        const result = await this.executeTestCase(testCase);
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * 执行测试计划
   * @param testPlan 测试计划
   * @returns 测试报告
   */
  async executeTestPlan(testPlan: TestPlan): Promise<TestReport> {
    const report: TestReport = {
      id: uuidv4(),
      planId: testPlan.id,
      name: testPlan.name,
      startTime: new Date().toISOString(),
      endTime: '',
      duration: 0,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      results: [],
      environment: testPlan.environment,
      metadata: {
        runner: 'test-execution-engine',
        version: '1.0.0',
        tags: []
      }
    };

    try {
      // 执行测试套件
      for (const testSuite of testPlan.testSuites) {
        const suiteResults = await this.executeTestSuite(testSuite);
        report.results.push(...suiteResults);
      }

      // 统计结果
      report.summary.total = report.results.length;
      report.summary.passed = report.results.filter(r => r.status === 'passed').length;
      report.summary.failed = report.results.filter(r => r.status === 'failed').length;
      report.summary.skipped = report.results.filter(r => r.status === 'skipped').length;
    } catch (error) {
      console.error(`Test plan execution failed: ${error.message}`);
    } finally {
      report.endTime = new Date().toISOString();
      report.duration = new Date(report.endTime).getTime() - new Date(report.startTime).getTime();
    }

    return report;
  }

  /**
   * 获取活跃测试列表
   * @returns 活跃测试结果数组
   */
  getActiveTests(): TestResult[] {
    return Array.from(this.activeTests.values());
  }

  /**
   * 获取所有测试结果
   * @returns 测试结果数组
   */
  getTestResults(): TestResult[] {
    return [...this.testResults];
  }

  /**
   * 清理测试结果
   */
  clearTestResults(): void {
    this.testResults = [];
    this.activeTests.clear();
  }

  /**
   * 获取测试执行统计
   * @returns 执行统计信息
   */
  getExecutionStats(): {
    totalExecuted: number;
    passed: number;
    failed: number;
    averageDuration: number;
  } {
    const totalExecuted = this.testResults.length;
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = totalExecuted > 0 ? totalDuration / totalExecuted : 0;

    return {
      totalExecuted,
      passed,
      failed,
      averageDuration
    };
  }
}

// 导出类型定义
export default TestExecutionEngine;