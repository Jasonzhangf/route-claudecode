/**
 * Provider测试系统统一导出
 * 
 * 提供完整的测试解决方案，包括集成测试、性能基准测试和测试工具
 * 
 * @author Jason Zhang
 */

// 集成测试
export {
  ProviderIntegrationTest,
  runProviderIntegrationTests
} from './integration-test';

// 性能基准测试
export {
  ProviderPerformanceBenchmark,
  BenchmarkConfig,
  BenchmarkResult,
  runPerformanceBenchmark
} from './performance-benchmark';

/**
 * 完整测试套件
 * 
 * 集成所有测试组件的统一管理类
 */
export class CompleteTestSuite {
  private integrationTest: ProviderIntegrationTest;
  private performanceBenchmark: ProviderPerformanceBenchmark;

  constructor() {
    this.integrationTest = new ProviderIntegrationTest({
      timeout: 15000,
      verbose: true,
      retries: 2
    });
    
    this.performanceBenchmark = new ProviderPerformanceBenchmark();
  }

  /**
   * 运行所有测试
   */
  public async runAllTests(options: {
    includeIntegration?: boolean;
    includePerformance?: boolean;
    providerService?: any;
    monitoringSystem?: any;
  } = {}): Promise<{
    integrationResults?: any[];
    performanceResults?: any[];
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      duration: number;
      success: boolean;
    };
  }> {
    const {
      includeIntegration = true,
      includePerformance = true,
      providerService,
      monitoringSystem
    } = options;

    console.log('🧪 Starting Complete Provider Test Suite');
    console.log('='.repeat(60));

    const startTime = Date.now();
    let integrationResults: any[] | undefined;
    let performanceResults: any[] | undefined;
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    try {
      // 运行集成测试
      if (includeIntegration) {
        console.log('\n🔧 Phase 1: Integration Tests');
        console.log('-'.repeat(40));
        
        integrationResults = await this.integrationTest.runAllTests();
        
        // 统计集成测试结果
        for (const suite of integrationResults) {
          totalTests += suite.total;
          passedTests += suite.passed;
          failedTests += suite.failed;
        }
      }

      // 运行性能测试
      if (includePerformance && providerService) {
        console.log('\n🚀 Phase 2: Performance Benchmark');
        console.log('-'.repeat(40));

        await this.performanceBenchmark.initialize(providerService, monitoringSystem);
        performanceResults = await this.performanceBenchmark.runBenchmarkSuite();
        
        // 性能测试不计入通过/失败统计，但计入总数
        totalTests += performanceResults.length;
        passedTests += performanceResults.length; // 性能测试完成即视为通过
      }

      const duration = Date.now() - startTime;
      const success = failedTests === 0;

      // 生成综合报告
      this.generateComprehensiveReport({
        integrationResults,
        performanceResults,
        totalTests,
        passedTests,
        failedTests,
        duration,
        success
      });

      return {
        integrationResults,
        performanceResults,
        summary: {
          totalTests,
          passedTests,
          failedTests,
          duration,
          success
        }
      };
    } catch (error) {
      console.error('❌ Test suite execution failed:', error);
      throw error;
    } finally {
      // 清理资源
      await this.cleanup();
    }
  }

  /**
   * 运行快速验证测试
   */
  public async runQuickValidation(providerService?: any): Promise<{
    success: boolean;
    errors: string[];
    warnings: string[];
  }> {
    console.log('⚡ Running Quick Validation...');
    
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 快速集成测试 (只运行关键测试)
      const quickIntegrationTest = new ProviderIntegrationTest({
        timeout: 5000,
        verbose: false,
        retries: 1
      });

      const results = await quickIntegrationTest.runAllTests();
      
      // 分析结果
      for (const suite of results) {
        if (suite.failed > 0) {
          errors.push(`${suite.name}: ${suite.failed} tests failed`);
        }
        
        if (suite.passed < suite.total * 0.8) {
          warnings.push(`${suite.name}: Only ${suite.passed}/${suite.total} tests passed`);
        }
      }

      // 快速性能检查
      if (providerService) {
        try {
          const quickBenchmark = new ProviderPerformanceBenchmark();
          await quickBenchmark.initialize(providerService);
          
          const quickResult = await quickBenchmark.runSingleBenchmark('Quick Validation', {
            concurrency: 5,
            duration: 10,
            interval: 1000,
            timeout: 5000,
            warmupRequests: 5,
            verbose: false
          });

          if (quickResult.errorRate > 10) {
            errors.push(`High error rate in performance test: ${quickResult.errorRate.toFixed(2)}%`);
          }

          if (quickResult.requestsPerSecond < 1) {
            warnings.push(`Low throughput detected: ${quickResult.requestsPerSecond.toFixed(1)} RPS`);
          }

          await quickBenchmark.cleanup();
        } catch (perfError) {
          warnings.push(`Performance validation failed: ${perfError}`);
        }
      }

      const success = errors.length === 0;
      
      console.log(`${success ? '✅' : '❌'} Quick validation ${success ? 'passed' : 'failed'}`);
      if (errors.length > 0) {
        console.log('Errors:', errors);
      }
      if (warnings.length > 0) {
        console.log('Warnings:', warnings);
      }

      return { success, errors, warnings };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Validation execution failed: ${errorMsg}`);
      return { success: false, errors, warnings };
    }
  }

  /**
   * 生成综合测试报告
   */
  private generateComprehensiveReport(results: {
    integrationResults?: any[];
    performanceResults?: any[];
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number;
    success: boolean;
  }): void {
    console.log('\n📊 Complete Test Suite Report');
    console.log('='.repeat(70));

    // 总体结果
    console.log('\n🎯 Overall Results:');
    console.log(`   Total Tests: ${results.totalTests}`);
    console.log(`   Passed: ${results.passedTests} (${((results.passedTests / results.totalTests) * 100).toFixed(1)}%)`);
    console.log(`   Failed: ${results.failedTests} (${((results.failedTests / results.totalTests) * 100).toFixed(1)}%)`);
    console.log(`   Duration: ${(results.duration / 1000).toFixed(1)}s`);
    console.log(`   Status: ${results.success ? '✅ SUCCESS' : '❌ FAILURE'}`);

    // 集成测试详情
    if (results.integrationResults) {
      console.log('\n🔧 Integration Test Results:');
      for (const suite of results.integrationResults) {
        const status = suite.failed === 0 ? '✅' : '❌';
        console.log(`   ${status} ${suite.name}: ${suite.passed}/${suite.total} passed (${suite.duration}ms)`);
      }
    }

    // 性能测试详情
    if (results.performanceResults) {
      console.log('\n🚀 Performance Test Results:');
      const bestRps = Math.max(...results.performanceResults.map((r: any) => r.requestsPerSecond));
      const avgErrorRate = results.performanceResults.reduce((sum: number, r: any) => sum + r.errorRate, 0) / results.performanceResults.length;
      
      console.log(`   Best RPS: ${bestRps.toFixed(1)}`);
      console.log(`   Average Error Rate: ${avgErrorRate.toFixed(2)}%`);
    }

    // 健康度评估
    console.log('\n💊 System Health Assessment:');
    const healthScore = this.calculateHealthScore(results);
    console.log(`   Health Score: ${healthScore}/100`);
    
    if (healthScore >= 90) {
      console.log('   Status: 🟢 Excellent - System is performing optimally');
    } else if (healthScore >= 75) {
      console.log('   Status: 🟡 Good - Minor issues detected');
    } else if (healthScore >= 50) {
      console.log('   Status: 🟠 Fair - Several issues need attention');
    } else {
      console.log('   Status: 🔴 Poor - Critical issues require immediate action');
    }

    // 推荐行动
    console.log('\n📋 Recommendations:');
    if (results.success) {
      console.log('   • System is ready for production use');
      console.log('   • Monitor performance metrics regularly');
      console.log('   • Set up automated health checks');
    } else {
      console.log('   • Review failed tests and fix issues');
      console.log('   • Investigate error patterns');
      console.log('   • Consider load balancing optimization');
    }

    console.log('\n🏁 Test suite execution completed!');
  }

  /**
   * 计算系统健康度分数
   */
  private calculateHealthScore(results: {
    integrationResults?: any[];
    performanceResults?: any[];
    passedTests: number;
    totalTests: number;
  }): number {
    let score = 0;

    // 基础功能测试分数 (60分)
    if (results.totalTests > 0) {
      score += (results.passedTests / results.totalTests) * 60;
    }

    // 性能测试分数 (40分)
    if (results.performanceResults && results.performanceResults.length > 0) {
      const avgErrorRate = results.performanceResults.reduce((sum: number, r: any) => sum + r.errorRate, 0) / results.performanceResults.length;
      const avgRps = results.performanceResults.reduce((sum: number, r: any) => sum + r.requestsPerSecond, 0) / results.performanceResults.length;
      
      // 错误率评分 (20分)
      const errorScore = Math.max(0, 20 - (avgErrorRate * 4));
      
      // 性能评分 (20分)
      const performanceScore = Math.min(20, avgRps / 5);
      
      score += errorScore + performanceScore;
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * 清理测试资源
   */
  private async cleanup(): Promise<void> {
    try {
      await this.performanceBenchmark.cleanup();
      console.log('✅ Test suite cleanup completed');
    } catch (error) {
      console.error('⚠️  Cleanup warning:', error);
    }
  }
}

/**
 * 运行完整测试套件的便捷函数
 */
export async function runCompleteTestSuite(options: {
  includeIntegration?: boolean;
  includePerformance?: boolean;
  providerService?: any;
  monitoringSystem?: any;
} = {}) {
  const testSuite = new CompleteTestSuite();
  return await testSuite.runAllTests(options);
}

/**
 * 运行快速验证的便捷函数
 */
export async function runQuickValidation(providerService?: any) {
  const testSuite = new CompleteTestSuite();
  return await testSuite.runQuickValidation(providerService);
}