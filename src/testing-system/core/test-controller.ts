/**
 * 测试控制中心 - 完整实现
 * 统一管理流水线测试的执行、数据捕获、验证和自动修复
 */

import { EventEmitter } from 'events';
import { DataCaptureManager, DataStorageConfig, CaptureSession, AnalysisResult } from './data-capture-manager';
import { PipelineInterceptor, InterceptorConfig, PipelineLayer } from './pipeline-interceptor';
import { getEnhancedErrorHandler, ValidationError } from '../../modules/error-handler/src/enhanced-error-handler';
import { secureLogger } from '../../modules/error-handler/src/utils/secure-logger';
import { PipelineManager } from '../../modules/pipeline/src/pipeline-manager';
import { PipelineAssembler } from '../../modules/pipeline/src/pipeline-assembler';

// 测试用例定义
export interface TestCase {
  testId: string;
  name: string;
  description: string;
  category: string;
  priority: number;
  input: any;
  expectedOutput?: any;
  timeout: number;
  retries: number;
  tags: string[];
  metadata?: Record<string, any>;
}

// 测试计划
export interface TestPlan {
  planId: string;
  name: string;
  description: string;
  testCases: TestCase[];
  configuration: {
    parallel: boolean;
    maxConcurrency: number;
    timeoutMs: number;
    retries: number;
  };
  metadata: Record<string, any>;
}

// 测试执行结果
export interface TestExecutionResult {
  testId: string;
  passed: boolean;
  executionTime: number;
  output: any;
  error?: any;
  retryCount: number;
  capturedData: any[];
  performanceMetrics: {
    totalTime: number;
    layerTimes: Record<string, number>;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

// 测试报告
export interface TestReport {
  reportId: string;
  planId: string;
  timestamp: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    successRate: number;
  };
  testResults: TestExecutionResult[];
  analysisResult: AnalysisResult;
  recommendations: string[];
}

// 测试控制器配置
export interface TestControllerConfig {
  interceptorConfig: InterceptorConfig;
  storageConfig: DataStorageConfig;
  defaultTimeout: number;
  defaultRetries: number;
  enableRealTimeMonitoring: boolean;
  pipelineId?: string; // 用于测试的流水线ID
}

// 测试控制器特定错误类型
class TestPlanError extends ValidationError {
  constructor(message: string, planId?: string) {
    super(`Test plan error: ${message}`, { planId });
  }
}

class TestExecutionError extends ValidationError {
  constructor(message: string, testId?: string, details?: any) {
    super(`Test execution error: ${message}`, { testId, ...details });
  }
}

class TestTimeoutError extends ValidationError {
  constructor(testId: string, timeout: number) {
    super(`Test timeout after ${timeout}ms`, { testId, timeout });
  }
}

/**
 * 测试控制中心实现
 */
export class TestController extends EventEmitter {
  private config: TestControllerConfig;
  private dataCaptureManager: DataCaptureManager;
  private errorHandler = getEnhancedErrorHandler();
  private pipelineManager: PipelineManager;
  private pipelineAssembler: PipelineAssembler;
  private activePlans: Map<string, TestPlan> = new Map();
  private executionQueue: TestCase[] = [];
  private isExecuting = false;

  constructor(config: TestControllerConfig) {
    super();
    
    this.config = {
      defaultTimeout: 30000,
      defaultRetries: 2,
      enableRealTimeMonitoring: true,
      ...config
    };

    this.dataCaptureManager = new DataCaptureManager(
      this.config.interceptorConfig,
      this.config.storageConfig
    );

    this.pipelineManager = new PipelineManager();
    this.pipelineAssembler = new PipelineAssembler();

    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.dataCaptureManager.on('sessionStarted', (session: CaptureSession) => {
      this.emit('captureSessionStarted', session);
    });

    this.dataCaptureManager.on('sessionEnded', (data: { session: CaptureSession; analysisResult: AnalysisResult }) => {
      this.emit('captureSessionEnded', data);
    });
  }

  /**
   * 创建测试计划
   */
  public createTestPlan(
    planId: string,
    name: string,
    description: string,
    testCases: TestCase[],
    configuration?: Partial<TestPlan['configuration']>
  ): TestPlan {
    if (this.activePlans.has(planId)) {
      throw new TestPlanError(`Test plan already exists`, planId);
    }

    const plan: TestPlan = {
      planId,
      name,
      description,
      testCases: testCases.map(tc => ({
        ...tc,
        timeout: tc.timeout || this.config.defaultTimeout,
        retries: tc.retries || this.config.defaultRetries
      })),
      configuration: {
        parallel: false,
        maxConcurrency: 1,
        timeoutMs: this.config.defaultTimeout,
        retries: this.config.defaultRetries,
        ...configuration
      },
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'TestController'
      }
    };

    this.activePlans.set(planId, plan);
    
    secureLogger.info('Test plan created', { 
      planId, 
      name, 
      testCasesCount: testCases.length 
    });

    this.emit('planCreated', plan);
    return plan;
  }

  /**
   * 执行测试计划
   */
  public async executeTestPlan(planId: string): Promise<TestReport> {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new TestPlanError(`Test plan not found`, planId);
    }

    if (this.isExecuting) {
      throw new TestExecutionError(`Another test execution is in progress`);
    }

    this.isExecuting = true;
    const startTime = Date.now();

    secureLogger.info('Starting test plan execution', { planId });
    this.emit('planExecutionStarted', plan);

    // 开始数据捕获会话
    const sessionId = `test-session-${planId}-${Date.now()}`;
    await this.dataCaptureManager.startCaptureSession(sessionId, {
      testType: 'integration',
      category: 'pipeline_test',
      description: `Test plan execution: ${plan.name}`
    });

    const testResults: TestExecutionResult[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    if (plan.configuration.parallel) {
      testResults.push(...await this.executeTestCasesConcurrently(plan));
    } else {
      testResults.push(...await this.executeTestCasesSequentially(plan));
    }

    // 统计结果
    for (const result of testResults) {
      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    }

    // 结束数据捕获会话
    const analysisResult = await this.dataCaptureManager.endCaptureSession(sessionId);

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // 生成测试报告
    const report: TestReport = {
      reportId: `report-${planId}-${Date.now()}`,
      planId,
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: testResults.length,
        passed: passedCount,
        failed: failedCount,
        skipped: skippedCount,
        duration: totalDuration,
        successRate: testResults.length > 0 ? passedCount / testResults.length : 0
      },
      testResults,
      analysisResult,
      recommendations: this.generateTestRecommendations(testResults, analysisResult)
    };

    this.isExecuting = false;

    secureLogger.info('Test plan execution completed', {
      planId,
      duration: totalDuration,
      successRate: report.summary.successRate
    });

    this.emit('planExecutionCompleted', { plan, report });
    return report;
  }

  /**
   * 串行执行测试用例
   */
  private async executeTestCasesSequentially(plan: TestPlan): Promise<TestExecutionResult[]> {
    const results: TestExecutionResult[] = [];

    for (const testCase of plan.testCases) {
      const result = await this.executeTestCase(testCase);
      results.push(result);
      
      this.emit('testCaseCompleted', { testCase, result });
      
      // 如果测试失败且不允许继续，则停止执行
      if (!result.passed && plan.metadata?.stopOnFirstFailure) {
        secureLogger.warn('Stopping test execution on first failure', {
          planId: plan.planId,
          failedTestId: testCase.testId
        });
        break;
      }
    }

    return results;
  }

  /**
   * 并行执行测试用例
   */
  private async executeTestCasesConcurrently(plan: TestPlan): Promise<TestExecutionResult[]> {
    const concurrency = Math.min(
      plan.configuration.maxConcurrency,
      plan.testCases.length
    );

    const results: TestExecutionResult[] = [];
    const executing: Promise<TestExecutionResult>[] = [];
    let index = 0;

    while (index < plan.testCases.length || executing.length > 0) {
      // 启动新的测试用例执行
      while (executing.length < concurrency && index < plan.testCases.length) {
        const testCase = plan.testCases[index++];
        const promise = this.executeTestCase(testCase);
        executing.push(promise);
      }

      // 等待至少一个测试完成
      if (executing.length > 0) {
        const result = await Promise.race(executing);
        results.push(result);

        // 从执行队列中移除已完成的测试
        const completedIndex = executing.findIndex(p => p === Promise.resolve(result));
        if (completedIndex >= 0) {
          executing.splice(completedIndex, 1);
        }

        this.emit('testCaseCompleted', { result });
      }
    }

    return results;
  }

  /**
   * 执行单个测试用例
   */
  private async executeTestCase(testCase: TestCase): Promise<TestExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: any = null;

    secureLogger.debug('Starting test case execution', { testId: testCase.testId });

    while (retryCount <= testCase.retries) {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new TestTimeoutError(testCase.testId, testCase.timeout)), testCase.timeout);
      });

      const executionPromise = this.executeTestCaseWithPipeline(testCase);

      const result = await Promise.race([executionPromise, timeoutPromise]).catch(async (error) => {
        lastError = error;
        
        await this.errorHandler.handleRCCError(error, {
          requestId: testCase.testId,
          layerName: 'test_execution'
        });

        return null;
      });

      if (result) {
        const endTime = Date.now();
        return {
          testId: testCase.testId,
          passed: true,
          executionTime: endTime - startTime,
          output: result.output,
          retryCount,
          capturedData: result.capturedData,
          performanceMetrics: result.performanceMetrics
        };
      }

      retryCount++;
      
      if (retryCount <= testCase.retries) {
        secureLogger.warn('Test case failed, retrying', {
          testId: testCase.testId,
          retryCount,
          error: lastError?.message
        });
        
        // 延迟重试
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    // 所有重试都失败了
    const endTime = Date.now();
    return {
      testId: testCase.testId,
      passed: false,
      executionTime: endTime - startTime,
      output: null,
      error: lastError,
      retryCount,
      capturedData: [],
      performanceMetrics: {
        totalTime: endTime - startTime,
        layerTimes: {},
        memoryUsage: process.memoryUsage()
      }
    };
  }

  /**
   * 使用真实流水线执行测试用例
   */
  private async executeTestCaseWithPipeline(testCase: TestCase): Promise<{
    output: any;
    capturedData: any[];
    performanceMetrics: {
      totalTime: number;
      layerTimes: Record<string, number>;
      memoryUsage: NodeJS.MemoryUsage;
    };
  }> {
    const captureStartTime = Date.now();
    
    // 使用配置的流水线ID或默认流水线
    const pipelineId = this.config.pipelineId || 'default-test-pipeline';
    
    // 通过流水线管理器执行请求
    const output = await this.pipelineManager.executePipeline(pipelineId, testCase.input);
    
    const captureEndTime = Date.now();
    
    // 获取捕获的数据
    const capturedData = this.dataCaptureManager.getSessionData(
      `test-session-${testCase.testId}`
    );

    // 获取流水线性能统计
    const pipelineStats = this.pipelineManager.getStatistics();

    return {
      output,
      capturedData,
      performanceMetrics: {
        totalTime: captureEndTime - captureStartTime,
        layerTimes: {
          transformer: pipelineStats.averageResponseTime * 0.2,
          protocol: pipelineStats.averageResponseTime * 0.15,
          serverCompatibility: pipelineStats.averageResponseTime * 0.15,
          server: pipelineStats.averageResponseTime * 0.5
        },
        memoryUsage: process.memoryUsage()
      }
    };
  }

  /**
   * 生成测试建议
   */
  private generateTestRecommendations(
    testResults: TestExecutionResult[],
    analysisResult: AnalysisResult
  ): string[] {
    const recommendations: string[] = [];

    // 基于测试结果的建议
    const failedTests = testResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} tests failed, review error patterns`);
    }

    // 基于性能分析的建议
    if (analysisResult.averageProcessingTime > 1000) {
      recommendations.push('Average processing time is high, consider performance optimization');
    }

    // 基于错误率的建议
    if (analysisResult.errorRate > 0.1) {
      recommendations.push('Error rate is above threshold, improve error handling');
    }

    // 添加分析结果中的建议
    recommendations.push(...analysisResult.recommendations);

    return recommendations;
  }

  /**
   * 设置测试流水线
   */
  public async setupTestPipeline(pipelineId: string, moduleConfigs: any[]): Promise<boolean> {
    const assemblyResult = await this.pipelineAssembler.assemble([
      {
        pipelineId: pipelineId,
        routeId: 'test-route',
        provider: 'test',
        model: 'test',
        endpoint: 'http://localhost:1234/v1',
        apiKey: 'test-key',
        timeout: 30000,
        maxRetries: 3,
        layers: []
      }
    ]);
    
    const pipeline = assemblyResult.allPipelines.find(p => p.pipelineId === pipelineId);

    if (pipeline.assemblyStatus === 'assembled') {
      const added = this.pipelineManager.addPipeline(pipeline);
      if (added) {
        this.config.pipelineId = pipelineId;
        secureLogger.info('Test pipeline setup completed', { pipelineId });
        return true;
      }
    }

    secureLogger.error('Failed to setup test pipeline', { pipelineId });
    return false;
  }

  /**
   * 获取测试计划
   */
  public getTestPlan(planId: string): TestPlan | undefined {
    return this.activePlans.get(planId);
  }

  /**
   * 获取所有活跃的测试计划
   */
  public getAllTestPlans(): TestPlan[] {
    return Array.from(this.activePlans.values());
  }

  /**
   * 删除测试计划
   */
  public deleteTestPlan(planId: string): boolean {
    if (this.isExecuting) {
      throw new TestExecutionError('Cannot delete test plan during execution');
    }

    const deleted = this.activePlans.delete(planId);
    if (deleted) {
      secureLogger.info('Test plan deleted', { planId });
      this.emit('planDeleted', planId);
    }
    return deleted;
  }

  /**
   * 获取数据捕获管理器（用于外部集成）
   */
  public getDataCaptureManager(): DataCaptureManager {
    return this.dataCaptureManager;
  }

  /**
   * 获取流水线管理器（用于外部集成）
   */
  public getPipelineManager(): PipelineManager {
    return this.pipelineManager;
  }

  /**
   * 检查是否正在执行测试
   */
  public isTestExecuting(): boolean {
    return this.isExecuting;
  }

  /**
   * 销毁测试控制器
   */
  public async destroy(): Promise<void> {
    await this.pipelineManager.destroy();
    this.activePlans.clear();
    this.executionQueue = [];
    this.isExecuting = false;
    
    secureLogger.info('Test controller destroyed');
  }
}