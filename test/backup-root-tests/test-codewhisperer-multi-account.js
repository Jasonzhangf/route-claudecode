#!/usr/bin/env node

/**
 * CodeWhisperer多账号Round Robin测试
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const axios = require('axios');

class CodeWhispererMultiAccountTester {
  constructor() {
    this.baseURL = 'http://127.0.0.1:6677/v1/messages';
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-key'
    };
    this.results = [];
  }

  async testRoundRobin() {
    console.log('🔄 测试CodeWhisperer多账号Round Robin功能\n');
    
    // 创建多账号配置
    const multiAccountConfig = {
      "server": {
        "port": 6677,
        "host": "0.0.0.0"
      },
      "providers": {
        "codewhisperer-multi": {
          "type": "codewhisperer",
          "endpoint": "https://codewhisperer.us-east-1.amazonaws.com",
          "authentication": {
            "type": "bearer",
            "credentials": {
              "tokenPath": [
                "~/.aws/sso/cache/kiro-auth-token.json",
                "~/.aws/sso/cache/kiro-gmail-token.json",
                "~/.aws/sso/cache/kiro-zcam-token.json"
              ]
            }
          },
          "keyRotation": {
            "enabled": true,
            "strategy": "round-robin",
            "cooldownMs": 1000
          },
          "models": [
            "CLAUDE_SONNET_4_20250514_V1_0",
            "CLAUDE_3_7_SONNET_20250219_V1_0"
          ],
          "defaultModel": "CLAUDE_SONNET_4_20250514_V1_0"
        }
      },
      "routing": {
        "default": {
          "provider": "codewhisperer-multi",
          "model": "CLAUDE_SONNET_4_20250514_V1_0"
        }
      },
      "debug": {
        "enabled": true,
        "logLevel": "debug",
        "traceRequests": true,
        "saveRequests": true,
        "logDir": "/Users/fanzhang/.route-claude-code/logs"
      }
    };

    // 保存配置文件
    const configPath = '/Users/fanzhang/.route-claude-code/config-multi-account.json';
    fs.writeFileSync(configPath, JSON.stringify(multiAccountConfig, null, 2));
    console.log(`✅ 多账号配置已创建: ${configPath}\n`);

    // 连续发送多个请求测试round robin
    const requests = [
      { content: "请简单介绍一下你自己", requestId: 1 },
      { content: "什么是编程中的设计模式？", requestId: 2 },
      { content: "解释一下什么是REST API", requestId: 3 },
      { content: "如何优化数据库查询性能？", requestId: 4 },
      { content: "什么是微服务架构？", requestId: 5 }
    ];

    console.log('📡 开始发送连续请求测试账号轮询...\n');

    for (const req of requests) {
      console.log(`🔸 发送请求 ${req.requestId}: ${req.content}`);
      
      try {
        const startTime = Date.now();
        
        const response = await axios.post(this.baseURL, {
          model: "claude-sonnet-4-20250514",
          max_tokens: 100,
          messages: [
            { role: "user", content: req.content }
          ]
        }, { 
          headers: this.headers,
          timeout: 30000
        });

        const duration = Date.now() - startTime;
        
        this.results.push({
          requestId: req.requestId,
          content: req.content,
          status: 'SUCCESS',
          duration,
          model: response.data.model,
          contentLength: response.data.content?.[0]?.text?.length || 0
        });

        console.log(`✅ 请求 ${req.requestId} 成功 - ${duration}ms - 模型: ${response.data.model}`);
        
        // 间隔1秒发送下一个请求，观察账号切换
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`❌ 请求 ${req.requestId} 失败: ${error.message}`);
        
        this.results.push({
          requestId: req.requestId,
          content: req.content,
          status: 'FAILED',
          error: error.message,
          statusCode: error.response?.status
        });
      }
    }

    return this.generateRoundRobinReport();
  }

  generateRoundRobinReport() {
    const report = {
      timestamp: new Date().toISOString(),
      testType: 'CodeWhisperer多账号Round Robin测试',
      totalRequests: this.results.length,
      successfulRequests: this.results.filter(r => r.status === 'SUCCESS').length,
      failedRequests: this.results.filter(r => r.status === 'FAILED').length,
      results: this.results,
      analysis: {
        successRate: `${(this.results.filter(r => r.status === 'SUCCESS').length / this.results.length * 100).toFixed(1)}%`,
        averageResponseTime: this.calculateAverageResponseTime(),
        accountRotationEvidence: this.analyzeAccountRotation()
      }
    };

    // 保存报告
    const reportPath = `/tmp/codewhisperer-round-robin-test-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 Round Robin测试报告:');
    console.log(`   总请求数: ${report.totalRequests}`);
    console.log(`   成功: ${report.successfulRequests}`);
    console.log(`   失败: ${report.failedRequests}`);
    console.log(`   成功率: ${report.analysis.successRate}`);
    console.log(`   平均响应时间: ${report.analysis.averageResponseTime}`);
    console.log(`   📁 详细报告: ${reportPath}`);

    return report;
  }

  calculateAverageResponseTime() {
    const successfulResults = this.results.filter(r => r.status === 'SUCCESS' && r.duration);
    if (successfulResults.length === 0) return 'N/A';
    
    const totalDuration = successfulResults.reduce((sum, r) => sum + r.duration, 0);
    return `${Math.round(totalDuration / successfulResults.length)}ms`;
  }

  analyzeAccountRotation() {
    // 分析是否有账号轮询的证据
    const successfulResults = this.results.filter(r => r.status === 'SUCCESS');
    
    if (successfulResults.length < 2) {
      return '请求数量不足，无法分析账号轮询';
    }

    // 检查响应时间的变化模式
    const responseTimes = successfulResults.map(r => r.duration);
    const timeVariance = this.calculateVariance(responseTimes);
    
    // 检查是否有token刷新的迹象（第一个请求通常较慢）
    const firstRequestTime = responseTimes[0];
    const subsequentRequestsAvg = responseTimes.slice(1).reduce((sum, time) => sum + time, 0) / (responseTimes.length - 1);
    
    return {
      responseTimeVariance: Math.round(timeVariance),
      firstRequestTime: `${firstRequestTime}ms`,
      subsequentAverage: `${Math.round(subsequentRequestsAvg)}ms`,
      tokenRefreshEvidence: firstRequestTime > subsequentRequestsAvg * 1.5 ? '可能存在' : '未发现',
      analysis: timeVariance > 1000000 ? '响应时间差异较大，可能存在账号切换' : '响应时间相对稳定'
    };
  }

  calculateVariance(numbers) {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDifferences = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDifferences.reduce((sum, sqDiff) => sum + sqDiff, 0) / numbers.length;
  }
}

// 运行测试
async function main() {
  const tester = new CodeWhispererMultiAccountTester();
  
  try {
    console.log('🧪 CodeWhisperer多账号Round Robin功能测试\n');
    
    const report = await tester.testRoundRobin();
    
    if (report.successfulRequests > 0) {
      console.log('\n🎉 多账号测试完成！');
      console.log('💡 提示: 查看日志文件以获取详细的账号切换信息');
    } else {
      console.log('\n⚠️  多账号测试未能成功完成');
      console.log('💡 建议: 检查配置文件和token文件是否正确');
    }
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);