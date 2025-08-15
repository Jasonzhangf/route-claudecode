/**
 * 简化版LM Studio连接测试
 * 直接测试LM Studio API连接，不依赖复杂的模块系统
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

/**
 * LM Studio连接测试器
 */
class SimpleLMStudioTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        avgResponseTime: 0
      }
    };
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 开始LM Studio连接测试...\n');

    // OpenAI兼容接口测试
    await this.testOpenAICompatible();
    
    // Anthropic兼容接口测试
    await this.testAnthropicCompatible();
    
    // 并发测试
    await this.testConcurrentRequests();

    // 生成报告
    this.generateReport();
  }

  /**
   * 测试OpenAI兼容接口
   */
  async testOpenAICompatible() {
    console.log('📡 测试OpenAI兼容接口...');
    
    const testData = {
      model: "llama-3.1-8b-instruct",
      messages: [
        {
          role: "user",
          content: "简单测试：请回复'LM Studio连接正常'"
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    };

    const testResult = await this.makeRequest(
      'POST',
      'http://localhost:1234/v1/chat/completions',
      testData,
      {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer lm-studio-local-key'
      },
      'OpenAI Compatible API'
    );

    this.results.tests.push(testResult);
  }

  /**
   * 测试Anthropic兼容接口
   */
  async testAnthropicCompatible() {
    console.log('📡 测试Anthropic兼容接口...');
    
    const testData = {
      model: "llama-3.1-8b-instruct", 
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "简单测试：请回复'LM Studio Anthropic兼容正常'"
        }
      ]
    };

    const testResult = await this.makeRequest(
      'POST',
      'http://localhost:1234/v1/messages',
      testData,
      {
        'Content-Type': 'application/json',
        'x-api-key': 'lm-studio-local-key'
      },
      'Anthropic Compatible API'
    );

    this.results.tests.push(testResult);
  }

  /**
   * 测试并发请求
   */
  async testConcurrentRequests() {
    console.log('⚡ 测试并发请求...');

    const concurrentCount = 3;
    const requests = [];

    const testData = {
      model: "llama-3.1-8b-instruct",
      messages: [
        {
          role: "user", 
          content: "并发测试：请回复当前时间"
        }
      ],
      max_tokens: 50
    };

    for (let i = 0; i < concurrentCount; i++) {
      const promise = this.makeRequest(
        'POST',
        'http://localhost:1234/v1/chat/completions',
        testData,
        {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer lm-studio-local-key'
        },
        `Concurrent Request ${i + 1}`
      );
      requests.push(promise);
    }

    const results = await Promise.allSettled(requests);
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.results.tests.push(result.value);
      } else {
        this.results.tests.push({
          name: `Concurrent Request ${index + 1}`,
          success: false,
          responseTime: 0,
          error: result.reason?.message || 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * 发送HTTP请求
   */
  async makeRequest(method, url, data, headers, testName) {
    const startTime = performance.now();
    
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const postData = JSON.stringify(data);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname,
        method: method,
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 30000
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          const endTime = performance.now();
          const responseTime = Math.round(endTime - startTime);
          
          try {
            const parsedResponse = JSON.parse(responseData);
            const success = res.statusCode >= 200 && res.statusCode < 300;
            
            resolve({
              name: testName,
              success: success,
              responseTime: responseTime,
              statusCode: res.statusCode,
              response: success ? parsedResponse : null,
              error: success ? null : `HTTP ${res.statusCode}: ${responseData}`,
              timestamp: new Date().toISOString()
            });
            
          } catch (parseError) {
            resolve({
              name: testName,
              success: false,
              responseTime: responseTime,
              statusCode: res.statusCode,
              error: `JSON Parse Error: ${parseError.message}`,
              rawResponse: responseData.slice(0, 200),
              timestamp: new Date().toISOString()
            });
          }
        });
      });

      req.on('error', (error) => {
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        resolve({
          name: testName,
          success: false,
          responseTime: responseTime,
          error: `Request Error: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const endTime = performance.now();
        const responseTime = Math.round(endTime - startTime);
        
        resolve({
          name: testName,
          success: false,
          responseTime: responseTime,
          error: 'Request Timeout (30s)',
          timestamp: new Date().toISOString()
        });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📊 ======= LM Studio连接测试报告 =======\n');
    
    this.results.summary.total = this.results.tests.length;
    this.results.summary.passed = this.results.tests.filter(t => t.success).length;
    this.results.summary.failed = this.results.summary.total - this.results.summary.passed;
    
    const responseTimes = this.results.tests.map(t => t.responseTime);
    this.results.summary.avgResponseTime = Math.round(
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    );

    // 总览
    console.log(`总测试数: ${this.results.summary.total}`);
    console.log(`通过: ${this.results.summary.passed} ✅`);
    console.log(`失败: ${this.results.summary.failed} ❌`);
    console.log(`平均响应时间: ${this.results.summary.avgResponseTime}ms`);
    console.log(`成功率: ${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%`);
    
    console.log('\n📋 详细结果:\n');
    
    // 详细结果
    this.results.tests.forEach((test, index) => {
      const status = test.success ? '✅ 通过' : '❌ 失败';
      const responseTime = test.responseTime ? `${test.responseTime}ms` : 'N/A';
      
      console.log(`${index + 1}. ${test.name}`);
      console.log(`   状态: ${status}`);
      console.log(`   响应时间: ${responseTime}`);
      
      if (test.success && test.response) {
        if (test.response.choices && test.response.choices[0]) {
          const content = test.response.choices[0].message?.content || 
                         test.response.choices[0].text ||
                         '无响应内容';
          console.log(`   响应内容: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`);
        }
      } else if (test.error) {
        console.log(`   错误: ${test.error}`);
      }
      console.log('');
    });

    // 性能分析
    if (this.results.summary.passed > 0) {
      console.log('⚡ 性能分析:');
      console.log(`平均响应时间: ${this.results.summary.avgResponseTime}ms`);
      
      if (this.results.summary.avgResponseTime < 1000) {
        console.log('✅ 响应时间优秀 (<1s)');
      } else if (this.results.summary.avgResponseTime < 3000) {
        console.log('⚠️ 响应时间一般 (1-3s)'); 
      } else {
        console.log('❌ 响应时间偏慢 (>3s)');
      }
    }

    // 保存结果到文件
    const fs = require('fs');
    const reportPath = `tests/reports/lmstudio-test-${Date.now()}.json`;
    
    // 确保报告目录存在
    if (!fs.existsSync('tests/reports')) {
      fs.mkdirSync('tests/reports', { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 详细报告已保存: ${reportPath}`);
    
    console.log('\n🏁 测试完成！\n');
    
    // 返回总结果
    return {
      success: this.results.summary.failed === 0,
      summary: this.results.summary
    };
  }
}

// 主执行函数
async function main() {
  const tester = new SimpleLMStudioTester();
  
  try {
    await tester.runAllTests();
    
    if (tester.results.summary.failed === 0) {
      console.log('🎉 所有测试通过！LM Studio连接正常。');
      process.exit(0);
    } else {
      console.log('⚠️ 部分测试失败，请检查LM Studio配置。');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 测试执行出错:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 如果直接执行此脚本
if (require.main === module) {
  main();
}

module.exports = SimpleLMStudioTester;