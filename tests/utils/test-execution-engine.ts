// 测试执行引擎核心类
import { getTestConfig, TestConfig } from '../config/test-environments';
import { TestResult, TestSuite, TestCase } from './test-types';

export class TestExecutionEngine {
  private config: TestConfig;
  private results: TestResult[] = [];
  
  constructor() {
    this.config = getTestConfig();
  }
  
  // 执行单个测试用例
  async executeTestCase(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    let result: TestResult;
    
    try {
      // 执行测试前钩子
      await this.beforeTest(testCase);
      
      // 执行测试
      await testCase.execute();
      
      // 执行测试后钩子
      await this.afterTest(testCase);
      
      result = {
        id: testCase.id,
        name: testCase.name,
        status: 'passed',
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      result = {
        id: testCase.id,
        name: testCase.name,
        status: 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
    
    this.results.push(result);
    return result;
  }
  
  // 执行测试套件
  async executeTestSuite(testSuite: TestSuite): Promise<TestResult[]> {
    const suiteResults: TestResult[] = [];
    
    // 执行套件前钩子
    await this.beforeTestSuite(testSuite);
    
    // 串行执行测试用例
    if (!this.config.test.parallel) {
      for (const testCase of testSuite.testCases) {
        const result = await this.executeTestCase(testCase);
        suiteResults.push(result);
      }
    } 
    // 并行执行测试用例
    else {
      const promises = testSuite.testCases.map(testCase => this.executeTestCase(testCase));
      const results = await Promise.all(promises);
      suiteResults.push(...results);
    }
    
    // 执行套件后钩子
    await this.afterTestSuite(testSuite);
    
    return suiteResults;
  }
  
  // 测试前钩子
  private async beforeTest(testCase: TestCase): Promise<void> {
    if (testCase.before) {
      await testCase.before();
    }
  }
  
  // 测试后钩子
  private async afterTest(testCase: TestCase): Promise<void> {
    if (testCase.after) {
      await testCase.after();
    }
  }
  
  // 测试套件前钩子
  private async beforeTestSuite(testSuite: TestSuite): Promise<void> {
    if (testSuite.beforeAll) {
      await testSuite.beforeAll();
    }
  }
  
  // 测试套件后钩子
  private async afterTestSuite(testSuite: TestSuite): Promise<void> {
    if (testSuite.afterAll) {
      await testSuite.afterAll();
    }
  }
  
  // 获取测试结果
  getResults(): TestResult[] {
    return [...this.results];
  }
  
  // 清空测试结果
  clearResults(): void {
    this.results = [];
  }
  
  // 重试失败的测试
  async retryFailedTests(maxRetries: number = this.config.test.retryAttempts): Promise<TestResult[]> {
    const failedTests = this.results.filter(result => result.status === 'failed');
    const retryResults: TestResult[] = [];
    
    for (const failedTest of failedTests) {
      // 这里需要根据测试ID重新获取测试用例
      // 简化实现，实际应该有测试注册机制
      console.log(`Retrying test: ${failedTest.name}`);
    }
    
    return retryResults;
  }
}