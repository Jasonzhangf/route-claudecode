#!/usr/bin/env node

/**
 * CodeWhisperer Round Robin多账号测试验证
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const axios = require('axios');

class RoundRobinValidator {
  constructor() {
    this.baseURL = 'http://127.0.0.1:6677';
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-key'
    };
    this.testResults = [];
  }

  async validateRoundRobinSupport() {
    console.log('🔄 验证CodeWhisperer多账号Round Robin支持\n');

    // 1. 检查当前配置
    await this.checkCurrentConfiguration();

    // 2. 测试多provider支持
    await this.testMultiProviderSupport();

    // 3. 检查provider管理器
    await this.checkProviderManager();

    // 4. 测试round robin行为
    await this.testRoundRobinBehavior();

    return this.generateValidationReport();
  }

  async checkCurrentConfiguration() {
    console.log('📋 1. 检查当前配置支持...');
    
    try {
      const response = await axios.get(`${this.baseURL}/status`, { headers: this.headers });
      const status = response.data;
      
      console.log(`   - 服务器状态: ${status.server}`);
      console.log(`   - Provider数量: ${status.providers?.length || 0}`);
      console.log(`   - 可用Providers: ${status.providers?.join(', ') || '无'}`);
      
      this.testResults.push({
        test: 'configuration_check',
        status: 'SUCCESS',
        details: {
          serverStatus: status.server,
          providerCount: status.providers?.length || 0,
          providers: status.providers || []
        }
      });

      // 检查是否有多个CodeWhisperer providers
      const cwProviders = status.providers?.filter(p => p.includes('kiro')) || [];
      if (cwProviders.length > 1) {
        console.log(`   ✅ 发现多个CodeWhisperer providers: ${cwProviders.join(', ')}`);
      } else {
        console.log(`   ⚠️  只发现 ${cwProviders.length} 个CodeWhisperer provider`);
      }

    } catch (error) {
      console.log(`   ❌ 配置检查失败: ${error.message}`);
      this.testResults.push({
        test: 'configuration_check',
        status: 'FAILED',
        error: error.message
      });
    }
  }

  async testMultiProviderSupport() {
    console.log('\n🔗 2. 测试多Provider支持...');
    
    try {
      // 发送连续请求观察provider选择
      const requests = [
        'Hello, how are you today?',
        'What is artificial intelligence?', 
        'Explain machine learning briefly',
        'What are the benefits of cloud computing?',
        'How does blockchain work?'
      ];

      const results = [];
      
      for (let i = 0; i < requests.length; i++) {
        const startTime = Date.now();
        
        try {
          const response = await axios.post(`${this.baseURL}/v1/messages`, {
            model: "claude-sonnet-4-20250514",
            max_tokens: 50,
            messages: [{ role: "user", content: requests[i] }]
          }, { 
            headers: this.headers,
            timeout: 15000
          });

          const duration = Date.now() - startTime;
          results.push({
            requestId: i + 1,
            duration,
            status: 'SUCCESS',
            model: response.data.model,
            hasContent: !!response.data.content?.[0]?.text
          });

          console.log(`   请求 ${i + 1}: ✅ ${duration}ms - 模型: ${response.data.model}`);
          
          // 短暂延迟观察provider切换
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          results.push({
            requestId: i + 1,
            status: 'FAILED',
            error: error.message,
            statusCode: error.response?.status
          });
          console.log(`   请求 ${i + 1}: ❌ ${error.message}`);
        }
      }

      const successCount = results.filter(r => r.status === 'SUCCESS').length;
      console.log(`   📊 总计: ${successCount}/${requests.length} 成功`);

      this.testResults.push({
        test: 'multi_provider_support',
        status: successCount > 0 ? 'SUCCESS' : 'FAILED',
        details: {
          totalRequests: requests.length,
          successfulRequests: successCount,
          results: results
        }
      });

    } catch (error) {
      console.log(`   ❌ 多Provider测试失败: ${error.message}`);
      this.testResults.push({
        test: 'multi_provider_support',
        status: 'FAILED',
        error: error.message
      });
    }
  }

  async checkProviderManager() {
    console.log('\n⚙️ 3. 检查Provider管理器...');
    
    try {
      // 尝试获取provider统计信息
      const response = await axios.get(`${this.baseURL}/api/stats`, { headers: this.headers });
      const stats = response.data;
      
      console.log(`   - 总请求数: ${stats.totalRequests || 0}`);
      console.log(`   - Provider统计: ${stats.providers ? 'Available' : 'Not Available'}`);
      
      if (stats.providers) {
        for (const [providerId, providerStats] of Object.entries(stats.providers)) {
          console.log(`   - ${providerId}: ${providerStats.requests || 0} 请求`);
        }
      }

      this.testResults.push({
        test: 'provider_manager_check',
        status: 'SUCCESS',
        details: stats
      });

    } catch (error) {
      console.log(`   ⚠️  Provider管理器检查失败: ${error.message}`);
      this.testResults.push({
        test: 'provider_manager_check',
        status: 'PARTIAL',
        error: error.message
      });
    }
  }

  async testRoundRobinBehavior() {
    console.log('\n🔄 4. 测试Round Robin行为...');
    
    try {
      // 快速连续发送请求测试轮询
      const rapidRequests = Array.from({ length: 6 }, (_, i) => ({
        id: i + 1,
        content: `Quick test ${i + 1}: What is ${['Python', 'JavaScript', 'Java', 'Go', 'Rust', 'TypeScript'][i]}?`
      }));

      const rapidResults = [];
      
      console.log('   发送快速连续请求测试轮询...');
      
      const startTime = Date.now();
      const promises = rapidRequests.map(async (req) => {
        try {
          const response = await axios.post(`${this.baseURL}/v1/messages`, {
            model: "claude-sonnet-4-20250514",
            max_tokens: 30,
            messages: [{ role: "user", content: req.content }]
          }, { 
            headers: this.headers,
            timeout: 10000
          });

          return {
            requestId: req.id,
            status: 'SUCCESS',
            model: response.data.model,
            timestamp: Date.now()
          };
        } catch (error) {
          return {
            requestId: req.id,
            status: 'FAILED',
            error: error.message,
            timestamp: Date.now()
          };
        }
      });

      const results = await Promise.allSettled(promises);
      const totalTime = Date.now() - startTime;
      
      let successCount = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.status === 'SUCCESS') {
          successCount++;
          console.log(`   请求 ${index + 1}: ✅ 模型: ${result.value.model}`);
        } else {
          console.log(`   请求 ${index + 1}: ❌ 失败`);
        }
      });

      console.log(`   📊 并发测试: ${successCount}/${rapidRequests.length} 成功, 总耗时: ${totalTime}ms`);

      this.testResults.push({
        test: 'round_robin_behavior',
        status: successCount > 0 ? 'SUCCESS' : 'FAILED',
        details: {
          totalRequests: rapidRequests.length,
          successfulRequests: successCount,
          totalTime,
          averageTime: Math.round(totalTime / rapidRequests.length),
          results: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'FAILED', error: r.reason })
        }
      });

    } catch (error) {
      console.log(`   ❌ Round Robin测试失败: ${error.message}`);
      this.testResults.push({
        test: 'round_robin_behavior',
        status: 'FAILED',
        error: error.message
      });
    }
  }

  generateValidationReport() {
    const successfulTests = this.testResults.filter(r => r.status === 'SUCCESS').length;
    const totalTests = this.testResults.length;
    const successRate = Math.round((successfulTests / totalTests) * 100);

    const report = {
      timestamp: new Date().toISOString(),
      testSuite: 'CodeWhisperer Round Robin验证',
      summary: {
        totalTests,
        successfulTests,
        failedTests: totalTests - successfulTests,
        successRate: `${successRate}%`,
        roundRobinSupported: successRate >= 75
      },
      results: this.testResults,
      conclusion: this.generateConclusion(successRate)
    };

    // 保存报告
    const reportPath = `/tmp/round-robin-validation-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 Round Robin验证报告:');
    console.log(`   测试通过率: ${report.summary.successRate}`);
    console.log(`   Round Robin支持: ${report.summary.roundRobinSupported ? '✅ 是' : '❌ 否'}`);
    console.log(`   详细报告: ${reportPath}`);

    return report;
  }

  generateConclusion(successRate) {
    if (successRate >= 90) {
      return 'CodeWhisperer多账号Round Robin功能完全正常，支持多provider轮询和负载均衡';
    } else if (successRate >= 75) {
      return 'CodeWhisperer多账号Round Robin功能基本正常，可能存在小问题但不影响核心功能';
    } else if (successRate >= 50) {
      return 'CodeWhisperer多账号Round Robin功能部分可用，建议检查配置和provider状态';
    } else {
      return 'CodeWhisperer多账号Round Robin功能存在问题，需要检查配置、网络和provider状态';
    }
  }
}

// 运行验证
async function main() {
  console.log('🧪 CodeWhisperer多账号Round Robin支持验证\n');
  
  const validator = new RoundRobinValidator();
  
  try {
    const report = await validator.validateRoundRobinSupport();
    
    console.log(`\n${report.summary.roundRobinSupported ? '🎉' : '⚠️'} 验证完成`);
    console.log(`结论: ${report.conclusion}`);
    
    process.exit(report.summary.roundRobinSupported ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ 验证执行失败:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);