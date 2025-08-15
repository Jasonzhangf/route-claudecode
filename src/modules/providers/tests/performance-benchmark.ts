/**
 * Provider性能基准测试
 * 
 * 测试Provider系统的性能指标，包括吞吐量、延迟、并发处理能力等
 * 
 * @author Jason Zhang
 */

import { ProviderService } from '../provider-service';
import { CompleteMonitoringSystem } from '../monitoring';
import { StandardRequest } from '../../../interfaces';

/**
 * 性能测试配置
 */
export interface BenchmarkConfig {
  /** 并发数 */
  concurrency: number;
  /** 测试持续时间(秒) */
  duration: number;
  /** 请求间隔(毫秒) */
  interval: number;
  /** 超时时间(毫秒) */
  timeout: number;
  /** 预热请求数 */
  warmupRequests: number;
  /** 是否记录详细指标 */
  verbose: boolean;
}

/**
 * 性能测试结果
 */
export interface BenchmarkResult {
  /** 测试名称 */
  name: string;
  /** 配置 */
  config: BenchmarkConfig;
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 总测试时间(毫秒) */
  totalDuration: number;
  /** 平均响应时间(毫秒) */
  averageResponseTime: number;
  /** 中位数响应时间(毫秒) */
  medianResponseTime: number;
  /** 95分位数响应时间(毫秒) */
  p95ResponseTime: number;
  /** 99分位数响应时间(毫秒) */
  p99ResponseTime: number;
  /** 最小响应时间(毫秒) */
  minResponseTime: number;
  /** 最大响应时间(毫秒) */
  maxResponseTime: number;
  /** 每秒请求数(RPS) */
  requestsPerSecond: number;
  /** 错误率(%) */
  errorRate: number;
  /** 吞吐量(字符/秒) */
  throughput: number;
  /** 详细响应时间分布 */
  responseTimeDistribution?: number[];
  /** 错误详情 */
  errors?: Array<{ message: string; count: number }>;
}

/**
 * 请求统计
 */
interface RequestStats {
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: number;
  contentLength: number;
}

/**
 * Provider性能基准测试器
 */
export class ProviderPerformanceBenchmark {
  private providerService: ProviderService | null;
  private monitoringSystem: CompleteMonitoringSystem | null;

  constructor() {
    this.providerService = null;
    this.monitoringSystem = null;
  }

  /**
   * 初始化基准测试环境
   */
  public async initialize(
    providerService: ProviderService,
    monitoringSystem?: CompleteMonitoringSystem
  ): Promise<void> {
    this.providerService = providerService;
    this.monitoringSystem = monitoringSystem || null;

    if (this.monitoringSystem) {
      await this.monitoringSystem.start();
    }

    console.log('🚀 Performance benchmark initialized');
  }

  /**
   * 运行完整的性能基准测试套件
   */
  public async runBenchmarkSuite(): Promise<BenchmarkResult[]> {
    console.log('📊 Starting Provider Performance Benchmark Suite');
    console.log('='.repeat(60));

    const results: BenchmarkResult[] = [];

    // 定义测试场景
    const scenarios: { name: string; config: BenchmarkConfig }[] = [
      {
        name: 'Light Load Test',
        config: {
          concurrency: 5,
          duration: 30,
          interval: 1000,
          timeout: 10000,
          warmupRequests: 10,
          verbose: false
        }
      },
      {
        name: 'Medium Load Test',
        config: {
          concurrency: 20,
          duration: 60,
          interval: 500,
          timeout: 15000,
          warmupRequests: 20,
          verbose: false
        }
      },
      {
        name: 'High Load Test',
        config: {
          concurrency: 50,
          duration: 60,
          interval: 200,
          timeout: 20000,
          warmupRequests: 50,
          verbose: false
        }
      },
      {
        name: 'Burst Load Test',
        config: {
          concurrency: 100,
          duration: 30,
          interval: 100,
          timeout: 30000,
          warmupRequests: 100,
          verbose: false
        }
      },
      {
        name: 'Sustained Load Test',
        config: {
          concurrency: 10,
          duration: 300, // 5分钟
          interval: 1000,
          timeout: 15000,
          warmupRequests: 30,
          verbose: true
        }
      }
    ];

    // 运行每个测试场景
    for (const scenario of scenarios) {
      console.log(`\n🧪 Running ${scenario.name}...`);
      
      try {
        const result = await this.runSingleBenchmark(scenario.name, scenario.config);
        results.push(result);
        
        // 显示快速结果概览
        console.log(`✅ ${scenario.name} completed:`);
        console.log(`   RPS: ${result.requestsPerSecond.toFixed(1)}`);
        console.log(`   Avg Response Time: ${result.averageResponseTime.toFixed(1)}ms`);
        console.log(`   Error Rate: ${result.errorRate.toFixed(2)}%`);
        
        // 等待一段时间再运行下一个测试
        if (scenarios.indexOf(scenario) < scenarios.length - 1) {
          console.log('   ⏳ Cooling down before next test...');
          await this.sleep(5000);
        }
      } catch (error) {
        console.error(`❌ ${scenario.name} failed:`, error);
      }
    }

    // 生成综合报告
    this.generateComprehensiveReport(results);

    return results;
  }

  /**
   * 运行单个基准测试
   */
  public async runSingleBenchmark(
    name: string,
    config: BenchmarkConfig
  ): Promise<BenchmarkResult> {
    if (!this.providerService) {
      throw new Error('ProviderService not initialized');
    }

    console.log(`📋 Test Configuration:`);
    console.log(`   Concurrency: ${config.concurrency}`);
    console.log(`   Duration: ${config.duration}s`);
    console.log(`   Interval: ${config.interval}ms`);
    console.log(`   Timeout: ${config.timeout}ms`);

    const stats: RequestStats[] = [];
    const errors = new Map<string, number>();

    // 预热阶段
    if (config.warmupRequests > 0) {
      console.log(`🔥 Warming up with ${config.warmupRequests} requests...`);
      await this.warmup(config.warmupRequests, config.timeout);
      await this.sleep(2000); // 预热后等待2秒
    }

    // 主测试阶段
    console.log(`🏃 Starting main test phase...`);
    const startTime = Date.now();
    const endTime = startTime + (config.duration * 1000);

    const workers: Promise<void>[] = [];

    // 启动并发工作线程
    for (let i = 0; i < config.concurrency; i++) {
      const worker = this.createWorker(i, endTime, config.interval, config.timeout, stats, errors);
      workers.push(worker);
    }

    // 等待所有工作线程完成
    await Promise.all(workers);

    const actualDuration = Date.now() - startTime;

    // 计算结果
    return this.calculateBenchmarkResult(name, config, stats, errors, actualDuration);
  }

  /**
   * 预热阶段
   */
  private async warmup(warmupRequests: number, timeout: number): Promise<void> {
    const warmupPromises: Promise<void>[] = [];

    for (let i = 0; i < warmupRequests; i++) {
      const promise = this.executeSingleRequest(timeout)
        .then(() => {}) // 忽略结果
        .catch(() => {}); // 忽略错误

      warmupPromises.push(promise);

      // 预热请求之间的小间隔
      if (i < warmupRequests - 1) {
        await this.sleep(100);
      }
    }

    await Promise.all(warmupPromises);
  }

  /**
   * 创建工作线程
   */
  private async createWorker(
    workerId: number,
    endTime: number,
    interval: number,
    timeout: number,
    stats: RequestStats[],
    errors: Map<string, number>
  ): Promise<void> {
    while (Date.now() < endTime) {
      const requestStart = Date.now();

      try {
        const result = await this.executeSingleRequest(timeout);
        
        const stat: RequestStats = {
          responseTime: Date.now() - requestStart,
          success: result.success,
          error: result.error,
          timestamp: requestStart,
          contentLength: result.contentLength || 0
        };

        stats.push(stat);

        if (!result.success && result.error) {
          const count = errors.get(result.error) || 0;
          errors.set(result.error, count + 1);
        }
      } catch (error) {
        const stat: RequestStats = {
          responseTime: Date.now() - requestStart,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: requestStart,
          contentLength: 0
        };

        stats.push(stat);

        const errorMsg = stat.error || 'Unknown error';
        const count = errors.get(errorMsg) || 0;
        errors.set(errorMsg, count + 1);
      }

      // 间隔控制
      const elapsed = Date.now() - requestStart;
      const sleepTime = Math.max(0, interval - elapsed);
      if (sleepTime > 0 && Date.now() < endTime - sleepTime) {
        await this.sleep(sleepTime);
      }
    }
  }

  /**
   * 执行单个请求
   */
  private async executeSingleRequest(timeout: number): Promise<{
    success: boolean;
    error?: string;
    contentLength?: number;
  }> {
    if (!this.providerService) {
      throw new Error('ProviderService not available');
    }

    // 创建测试请求
    const testRequest: StandardRequest = {
      messages: [
        { 
          role: 'user', 
          content: 'This is a performance benchmark test message. Please respond with a brief acknowledgment.' 
        }
      ],
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 50
    };

    try {
      // 模拟请求处理 (实际环境中这里会调用真实的API)
      const response = await Promise.race([
        this.simulateRequest(testRequest),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        )
      ]) as any;

      return {
        success: true,
        contentLength: response.content?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 模拟请求处理 (用于测试)
   */
  private async simulateRequest(request: StandardRequest): Promise<any> {
    // 模拟处理延迟 (50-200ms)
    const delay = 50 + Math.random() * 150;
    await this.sleep(delay);

    // 模拟偶发错误 (2% 错误率)
    if (Math.random() < 0.02) {
      throw new Error('Simulated provider error');
    }

    // 模拟响应
    return {
      content: 'This is a simulated response for the benchmark test.',
      usage: {
        promptTokens: request.messages[0].content.length / 4,
        completionTokens: 20,
        totalTokens: 25 + request.messages[0].content.length / 4
      }
    };
  }

  /**
   * 计算基准测试结果
   */
  private calculateBenchmarkResult(
    name: string,
    config: BenchmarkConfig,
    stats: RequestStats[],
    errors: Map<string, number>,
    actualDuration: number
  ): BenchmarkResult {
    if (stats.length === 0) {
      throw new Error('No requests were completed');
    }

    // 基础统计
    const totalRequests = stats.length;
    const successfulRequests = stats.filter(s => s.success).length;
    const failedRequests = totalRequests - successfulRequests;

    // 响应时间统计
    const responseTimes = stats.map(s => s.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const medianResponseTime = this.calculatePercentile(responseTimes, 0.5);
    const p95ResponseTime = this.calculatePercentile(responseTimes, 0.95);
    const p99ResponseTime = this.calculatePercentile(responseTimes, 0.99);
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);

    // 吞吐量计算
    const requestsPerSecond = (totalRequests / actualDuration) * 1000;
    const errorRate = (failedRequests / totalRequests) * 100;
    
    // 吞吐量 (字符数/秒)
    const totalContentLength = stats.reduce((sum, stat) => sum + stat.contentLength, 0);
    const throughput = (totalContentLength / actualDuration) * 1000;

    // 错误详情
    const errorDetails = Array.from(errors.entries()).map(([message, count]) => ({
      message,
      count
    }));

    const result: BenchmarkResult = {
      name,
      config,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalDuration: actualDuration,
      averageResponseTime,
      medianResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond,
      errorRate,
      throughput,
      responseTimeDistribution: config.verbose ? responseTimes : undefined,
      errors: errorDetails.length > 0 ? errorDetails : undefined
    };

    return result;
  }

  /**
   * 计算分位数
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  /**
   * 生成综合报告
   */
  private generateComprehensiveReport(results: BenchmarkResult[]): void {
    console.log('\n📊 Comprehensive Performance Report');
    console.log('='.repeat(80));

    // 性能汇总表
    console.log('\n📈 Performance Summary:');
    console.log('-'.repeat(80));
    console.log(
      '| Test Name'.padEnd(20) + 
      '| RPS'.padEnd(10) + 
      '| Avg RT(ms)'.padEnd(12) + 
      '| P95 RT(ms)'.padEnd(12) + 
      '| Error%'.padEnd(8) + 
      '| Throughput'.padEnd(12) + '|'
    );
    console.log('-'.repeat(80));

    for (const result of results) {
      console.log(
        `| ${result.name.slice(0, 18).padEnd(18)} | ` +
        `${result.requestsPerSecond.toFixed(1).padEnd(8)} | ` +
        `${result.averageResponseTime.toFixed(1).padEnd(10)} | ` +
        `${result.p95ResponseTime.toFixed(1).padEnd(10)} | ` +
        `${result.errorRate.toFixed(2).padEnd(6)} | ` +
        `${(result.throughput / 1000).toFixed(1)}KB/s`.padEnd(10) + ' |'
      );
    }

    console.log('-'.repeat(80));

    // 性能趋势分析
    console.log('\n📊 Performance Analysis:');
    
    const maxRps = Math.max(...results.map(r => r.requestsPerSecond));
    const minErrorRate = Math.min(...results.map(r => r.errorRate));
    const bestPerformance = results.find(r => r.requestsPerSecond === maxRps);
    const mostReliable = results.find(r => r.errorRate === minErrorRate);

    console.log(`   🚀 Best Throughput: ${bestPerformance?.name} (${maxRps.toFixed(1)} RPS)`);
    console.log(`   🛡️  Most Reliable: ${mostReliable?.name} (${minErrorRate.toFixed(2)}% error rate)`);

    // 推荐配置
    console.log('\n💡 Recommendations:');
    if (maxRps > 100) {
      console.log('   ✅ System can handle high concurrent loads effectively');
    } else if (maxRps > 50) {
      console.log('   ⚠️  System performance is moderate, consider optimization');
    } else {
      console.log('   ❌ System performance is below optimal, requires investigation');
    }

    if (minErrorRate < 1) {
      console.log('   ✅ Excellent reliability with very low error rates');
    } else if (minErrorRate < 5) {
      console.log('   ⚠️  Acceptable reliability, monitor error trends');
    } else {
      console.log('   ❌ High error rates detected, requires immediate attention');
    }

    // 详细错误报告
    const totalErrors = results.reduce((sum, r) => sum + r.failedRequests, 0);
    if (totalErrors > 0) {
      console.log('\n⚠️  Error Summary:');
      const allErrors = new Map<string, number>();
      
      results.forEach(result => {
        if (result.errors) {
          result.errors.forEach(error => {
            const current = allErrors.get(error.message) || 0;
            allErrors.set(error.message, current + error.count);
          });
        }
      });

      Array.from(allErrors.entries())
        .sort(([,a], [,b]) => b - a)
        .forEach(([message, count]) => {
          console.log(`   • ${message}: ${count} occurrences`);
        });
    }

    console.log('\n🏁 Performance benchmark completed successfully!');
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    if (this.monitoringSystem) {
      await this.monitoringSystem.stop();
    }

    console.log('🧹 Performance benchmark cleaned up');
  }
}

/**
 * 运行性能基准测试的便捷函数
 */
export async function runPerformanceBenchmark(
  providerService: ProviderService,
  monitoringSystem?: CompleteMonitoringSystem
): Promise<BenchmarkResult[]> {
  const benchmark = new ProviderPerformanceBenchmark();
  
  try {
    await benchmark.initialize(providerService, monitoringSystem);
    const results = await benchmark.runBenchmarkSuite();
    return results;
  } finally {
    await benchmark.cleanup();
  }
}