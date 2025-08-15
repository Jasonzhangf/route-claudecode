/**
 * LM Studio流水线测试
 * 验证v3.0六层架构和新的日志系统完整性
 * 
 * @author Jason Zhang
 * @version v3.1.0
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';

class LMStudioPipelineTest {
  constructor() {
    this.baseUrl = 'http://localhost:5506';
    this.logDir = path.join(os.homedir(), '.route-claudecode', 'logs', 'port-5506');
    this.testResults = [];
    this.errors = [];
    this.startTime = Date.now();
  }

  /**
   * 运行完整的流水线测试
   */
  async runFullPipelineTest() {
    console.log('🎯 LM Studio流水线测试 v3.1.0');
    console.log(`📊 测试目标: ${this.baseUrl}`);
    console.log(`📁 日志目录: ${this.logDir}\n`);

    try {
      // 1. 健康检查测试
      await this.testHealthCheck();

      // 2. 基础消息测试（default路由）
      await this.testBasicMessage();

      // 3. 长上下文测试（longcontext路由）
      await this.testLongContextMessage();

      // 4. 工具调用测试
      await this.testToolCalling();

      // 5. 后台任务测试（background路由）
      await this.testBackgroundTask();

      // 6. 思考模式测试（thinking路由）
      await this.testThinkingMode();

      // 7. 搜索测试（search路由）
      await this.testSearchMode();

      // 8. 验证日志系统
      await this.validateLoggingSystem();

      // 9. 性能和并发测试
      await this.testPerformanceAndConcurrency();

      // 10. 生成测试报告
      this.generateTestReport();

    } catch (error) {
      this.addError('流水线测试失败', error);
      console.error('❌ 流水线测试失败:', error.message);
    }
  }

  /**
   * 测试健康检查
   */
  async testHealthCheck() {
    console.log('🔍 测试健康检查...');
    
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      
      if (response.ok && data.overall === 'healthy') {
        this.addSuccess('健康检查', '✅ 服务正常运行');
        console.log(`   状态: ${data.overall}`);
        console.log(`   提供商: ${data.healthy}/${data.total}`);
      } else {
        this.addError('健康检查', new Error(`服务不健康: ${data.overall || 'unknown'}`));
      }
    } catch (error) {
      this.addError('健康检查', error);
    }
    console.log();
  }

  /**
   * 测试基础消息（default路由）
   */
  async testBasicMessage() {
    console.log('📝 测试基础消息（default路由）...');
    
    const testMessage = {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message for default routing. Please respond briefly.'
        }
      ],
      max_tokens: 100
    };

    await this.sendTestMessage('基础消息测试', testMessage, 'default');
    console.log();
  }

  /**
   * 测试长上下文消息（longcontext路由）
   */
  async testLongContextMessage() {
    console.log('📜 测试长上下文消息（longcontext路由）...');
    
    const longContent = 'This is a very long context message. '.repeat(3000); // ~60k characters
    
    const testMessage = {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: longContent + ' Please summarize this long message briefly.'
        }
      ],
      max_tokens: 150
    };

    await this.sendTestMessage('长上下文测试', testMessage, 'longcontext');
    console.log();
  }

  /**
   * 测试工具调用
   */
  async testToolCalling() {
    console.log('🔧 测试工具调用...');
    
    const testMessage = {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: 'What is the current time?'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_current_time',
            description: 'Get the current time',
            parameters: {
              type: 'object',
              properties: {
                timezone: {
                  type: 'string',
                  description: 'The timezone to get time for'
                }
              }
            }
          }
        }
      ],
      max_tokens: 100
    };

    await this.sendTestMessage('工具调用测试', testMessage, 'default');
    console.log();
  }

  /**
   * 测试后台任务（background路由）
   */
  async testBackgroundTask() {
    console.log('🔄 测试后台任务（background路由）...');
    
    const testMessage = {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: 'Process this simple background task'
        }
      ],
      stream: false,
      max_tokens: 50,
      metadata: {
        category: 'background'
      }
    };

    await this.sendTestMessage('后台任务测试', testMessage, 'background');
    console.log();
  }

  /**
   * 测试思考模式（thinking路由）
   */
  async testThinkingMode() {
    console.log('🧠 测试思考模式（thinking路由）...');
    
    const testMessage = {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: 'Let me think step by step about this complex mathematical problem: What is 123 * 456?'
        }
      ],
      max_tokens: 200,
      metadata: {
        thinking: true
      }
    };

    await this.sendTestMessage('思考模式测试', testMessage, 'thinking');
    console.log();
  }

  /**
   * 测试搜索模式（search路由）
   */
  async testSearchMode() {
    console.log('🔍 测试搜索模式（search路由）...');
    
    const testMessage = {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: 'Please search for information about artificial intelligence trends'
        }
      ],
      max_tokens: 150
    };

    await this.sendTestMessage('搜索模式测试', testMessage, 'search');
    console.log();
  }

  /**
   * 发送测试消息
   */
  async sendTestMessage(testName, message, expectedCategory) {
    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        this.addSuccess(testName, `✅ 响应成功 (${duration}ms)`);
        console.log(`   响应时间: ${duration}ms`);
        console.log(`   停止原因: ${data.stop_reason || 'unknown'}`);
        console.log(`   内容长度: ${data.content?.[0]?.text?.length || 0} 字符`);
        
        // 验证路由类别（如果在响应中可见）
        if (data.metadata?.routingCategory) {
          console.log(`   路由类别: ${data.metadata.routingCategory}`);
          if (data.metadata.routingCategory === expectedCategory) {
            this.addSuccess(`${testName} 路由验证`, '✅ 路由正确');
          } else {
            this.addError(`${testName} 路由验证`, new Error(`期望路由 ${expectedCategory}，实际 ${data.metadata.routingCategory}`));
          }
        }
      } else {
        const errorText = await response.text();
        this.addError(testName, new Error(`HTTP ${response.status}: ${errorText}`));
      }
    } catch (error) {
      this.addError(testName, error);
    }
  }

  /**
   * 验证日志系统
   */
  async validateLoggingSystem() {
    console.log('📊 验证日志系统...');
    
    try {
      // 检查日志目录是否存在
      if (fs.existsSync(this.logDir)) {
        console.log(`   ✅ 日志目录存在: ${this.logDir}`);
        
        // 检查实际的日志文件结构
        const logCategories = ['daily', 'errors', 'performance', 'pipeline'];
        let foundLogs = 0;
        
        logCategories.forEach(category => {
          const categoryPath = path.join(this.logDir, category);
          if (fs.existsSync(categoryPath)) {
            const files = fs.readdirSync(categoryPath);
            if (files.length > 0) {
              const totalSize = files.reduce((sum, file) => {
                const filePath = path.join(categoryPath, file);
                const stats = fs.statSync(filePath);
                return sum + stats.size;
              }, 0);
              console.log(`   ✅ ${category}: ${files.length} 文件, ${totalSize} bytes`);
              foundLogs++;
            }
          } else {
            console.log(`   ⚠️  ${category}: 目录未找到`);
          }
        });
        
        // 检查测试报告文件
        const reportFile = path.join(this.logDir, 'pipeline-test-report.json');
        if (fs.existsSync(reportFile)) {
          console.log(`   ✅ 测试报告: 存在`);
          foundLogs++;
        }
        
        if (foundLogs > 0) {
          this.addSuccess('日志系统验证', `✅ 发现 ${foundLogs} 个日志文件/目录`);
        } else {
          this.addError('日志系统验证', new Error('未发现任何日志文件'));
        }
        
      } else {
        this.addError('日志系统验证', new Error(`日志目录不存在: ${this.logDir}`));
      }
    } catch (error) {
      this.addError('日志系统验证', error);
    }
    console.log();
  }

  /**
   * 性能和并发测试
   */
  async testPerformanceAndConcurrency() {
    console.log('⚡ 测试性能和并发...');
    
    const concurrentRequests = 5;
    const testMessage = {
      model: 'claude-4-sonnet',
      messages: [
        {
          role: 'user',
          content: 'This is a concurrent test message.'
        }
      ],
      max_tokens: 50
    };

    try {
      const startTime = Date.now();
      const promises = Array.from({ length: concurrentRequests }, (_, i) => 
        fetch(`${this.baseUrl}/v1/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...testMessage,
            messages: [{
              role: 'user',
              content: `Concurrent test message #${i + 1}`
            }]
          })
        })
      );

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      const successCount = responses.filter(r => r.ok).length;
      
      console.log(`   并发请求: ${concurrentRequests}`);
      console.log(`   成功响应: ${successCount}`);
      console.log(`   总耗时: ${duration}ms`);
      console.log(`   平均耗时: ${(duration / concurrentRequests).toFixed(0)}ms`);
      
      if (successCount === concurrentRequests) {
        this.addSuccess('并发测试', `✅ ${successCount}/${concurrentRequests} 请求成功`);
      } else {
        this.addError('并发测试', new Error(`只有 ${successCount}/${concurrentRequests} 请求成功`));
      }
    } catch (error) {
      this.addError('并发测试', error);
    }
    console.log();
  }

  /**
   * 生成测试报告
   */
  generateTestReport() {
    const totalDuration = Date.now() - this.startTime;
    const successCount = this.testResults.filter(r => r.status === 'success').length;
    const errorCount = this.errors.length;
    const totalTests = successCount + errorCount;

    console.log('📊 流水线测试报告:');
    console.log(`状态: ${errorCount === 0 ? '✅ 通过' : '❌ 失败'}`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${errorCount}`);
    console.log(`总计: ${totalTests}`);
    console.log(`通过率: ${((successCount / totalTests) * 100).toFixed(1)}%`);
    console.log(`总耗时: ${totalDuration}ms`);
    
    if (errorCount > 0) {
      console.log('\n❌ 失败的测试:');
      this.errors.forEach(error => {
        console.log(`  - ${error.test}: ${error.error.message}`);
      });
    }

    console.log('\n✅ 成功的测试:');
    this.testResults.filter(r => r.status === 'success').forEach(result => {
      console.log(`  - ${result.test}: ${result.result}`);
    });

    // 保存测试报告到文件
    this.saveTestReport({
      status: errorCount === 0 ? 'PASS' : 'FAIL',
      summary: {
        total: totalTests,
        success: successCount,
        errors: errorCount,
        passRate: ((successCount / totalTests) * 100).toFixed(1),
        duration: totalDuration
      },
      results: this.testResults,
      errors: this.errors,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 保存测试报告
   */
  saveTestReport(report) {
    const reportPath = path.join(this.logDir, 'pipeline-test-report.json');
    
    try {
      // 确保目录存在
      const reportDir = path.dirname(reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 测试报告已保存: ${reportPath}`);
    } catch (error) {
      console.error(`保存测试报告失败: ${error.message}`);
    }
  }

  // 辅助方法
  addSuccess(test, result) {
    this.testResults.push({ test, result, status: 'success', timestamp: Date.now() });
  }

  addError(test, error) {
    this.errors.push({ test, error, timestamp: Date.now() });
  }
}

// 如果直接运行此文件，执行流水线测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new LMStudioPipelineTest();
  tester.runFullPipelineTest().then(() => {
    const hasErrors = tester.errors.length > 0;
    console.log(`\n🎯 流水线测试${hasErrors ? '失败' : '完成'}`);
    process.exit(hasErrors ? 1 : 0);
  });
}

export { LMStudioPipelineTest };