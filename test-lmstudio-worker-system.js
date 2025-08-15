#!/usr/bin/env node

/**
 * LM Studio Worker System Test
 * 基于实际LM Studio配置的Worker系统完整测试
 * 
 * @author Jason Zhang
 * @version 3.1.0
 */

import { readFileSync } from 'fs';
import { WorkerManager } from './dist/v3/pipeline/worker-manager.js';

// 颜色输出辅助函数
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

class LMStudioWorkerTest {
  constructor() {
    this.workerManager = null;
    this.config = null;
    this.startTime = Date.now();
  }

  /**
   * 加载LM Studio配置
   */
  loadConfig() {
    try {
      console.log(colors.blue('📋 Loading LM Studio configuration...'));
      
      const configPath = '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json';
      const configContent = readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configContent);
      
      console.log(colors.green('✅ Configuration loaded successfully'));
      console.log(colors.gray(`   Provider: ${this.config.providers.lmstudio.type}`));
      console.log(colors.gray(`   Endpoint: ${this.config.providers.lmstudio.endpoint}`));
      console.log(colors.gray(`   Models: ${this.config.providers.lmstudio.models.length} available`));
      console.log(colors.gray(`   Port: ${this.config.server.port}`));
      
      return true;
    } catch (error) {
      console.log(colors.red('❌ Failed to load configuration'));
      console.log(colors.red(`   Error: ${error.message}`));
      return false;
    }
  }

  /**
   * 创建Worker池配置
   */
  createWorkerPoolConfigs() {
    console.log(colors.blue('🏗️  Creating worker pool configurations...'));
    
    const workerPoolConfigs = [];
    
    // 为每个路由类别创建Worker池
    for (const [category, routing] of Object.entries(this.config.routing.categories)) {
      const poolConfig = {
        providerId: routing.provider,
        model: routing.model,
        providerConfig: this.config.providers[routing.provider],
        poolSize: 2, // 每个Provider.Model组合创建2个Worker
        debugEnabled: this.config.debug.enabled
      };
      
      workerPoolConfigs.push(poolConfig);
      
      console.log(colors.gray(`   ➕ ${category}: ${routing.provider}.${routing.model} (pool size: 2)`));
    }

    // 去重：相同的provider.model只需要一个池
    const uniqueConfigs = workerPoolConfigs.reduce((unique, config) => {
      const key = `${config.providerId}.${config.model}`;
      if (!unique.find(c => `${c.providerId}.${c.model}` === key)) {
        unique.push(config);
      }
      return unique;
    }, []);

    console.log(colors.green(`✅ Created ${uniqueConfigs.length} unique worker pool configurations`));
    return uniqueConfigs;
  }

  /**
   * 初始化Worker管理器
   */
  async initializeWorkerManager() {
    try {
      console.log(colors.blue('🚀 Initializing Worker Manager...'));
      
      const workerPoolConfigs = this.createWorkerPoolConfigs();
      this.workerManager = new WorkerManager('round-robin');
      
      // 设置事件监听
      this.setupEventListeners();
      
      // 初始化Worker管理器
      await this.workerManager.initialize(workerPoolConfigs);
      
      console.log(colors.green('✅ Worker Manager initialized successfully'));
      
      // 显示统计信息
      const metrics = this.workerManager.getMetrics();
      console.log(colors.cyan('📊 Worker Manager Metrics:'));
      console.log(colors.gray(`   Total Workers: ${metrics.totalWorkers}`));
      console.log(colors.gray(`   Healthy Workers: ${metrics.healthyWorkers}`));
      console.log(colors.gray(`   Status: ${this.workerManager.getStatus()}`));
      
      return true;
    } catch (error) {
      console.log(colors.red('❌ Failed to initialize Worker Manager'));
      console.log(colors.red(`   Error: ${error.message}`));
      return false;
    }
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    this.workerManager.on('log', (logEntry) => {
      if (logEntry.level === 'error') {
        console.log(colors.red(`🔥 [${logEntry.component}] ${logEntry.message}`));
      } else if (logEntry.level === 'warn') {
        console.log(colors.yellow(`⚠️  [${logEntry.component}] ${logEntry.message}`));
      } else if (logEntry.level === 'info') {
        console.log(colors.blue(`ℹ️  [${logEntry.component}] ${logEntry.message}`));
      }
    });

    this.workerManager.on('workerError', (event) => {
      console.log(colors.red(`💥 Worker Error [${event.workerId}]: ${event.error.message}`));
    });
  }

  /**
   * 测试输入处理流水线
   */
  async testInputProcessing() {
    console.log(colors.blue('🔄 Testing Input Processing Pipeline...'));
    
    try {
      const testInput = {
        model: 'gpt-oss-20b-mlx',
        messages: [
          {
            role: 'user',
            content: 'Hello, can you help me test the Claude Code tool calling functionality?'
          }
        ],
        tools: [
          {
            name: 'calculator',
            description: 'Perform mathematical calculations',
            input_schema: {
              type: 'object',
              properties: {
                expression: {
                  type: 'string',
                  description: 'Mathematical expression to evaluate'
                }
              },
              required: ['expression']
            }
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      };

      const context = {
        requestId: `test_input_${Date.now()}`,
        timestamp: Date.now(),
        metadata: {
          testType: 'input-processing',
          provider: 'lmstudio',
          model: 'gpt-oss-20b-mlx'
        },
        debugEnabled: true
      };

      console.log(colors.gray('   📤 Sending input request...'));
      const startTime = Date.now();
      
      const result = await this.workerManager.processInput(
        'lmstudio', 
        'gpt-oss-20b-mlx', 
        testInput, 
        context
      );
      
      const processingTime = Date.now() - startTime;
      
      console.log(colors.green('✅ Input processing completed successfully'));
      console.log(colors.gray(`   Processing Time: ${processingTime}ms`));
      console.log(colors.gray(`   Result Type: ${typeof result}`));
      console.log(colors.gray(`   Result Keys: ${Object.keys(result || {}).join(', ')}`));
      
      return result;
    } catch (error) {
      console.log(colors.red('❌ Input processing failed'));
      console.log(colors.red(`   Error: ${error.message}`));
      return null;
    }
  }

  /**
   * 测试输出处理流水线
   */
  async testOutputProcessing() {
    console.log(colors.blue('🔄 Testing Output Processing Pipeline...'));
    
    try {
      const mockProviderResponse = {
        id: 'chatcmpl-test-123',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-oss-20b-mlx',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I can help you with that! Let me use the calculator tool to demonstrate.\n\nTool call: calculator\nParameters: {"expression": "2 + 2"}\n\nResult: 4',
              tool_calls: [
                {
                  id: 'call_test_123',
                  type: 'function',
                  function: {
                    name: 'calculator',
                    arguments: '{"expression": "2 + 2"}'
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 75,
          total_tokens: 225
        }
      };

      const context = {
        requestId: `test_output_${Date.now()}`,
        timestamp: Date.now(),
        metadata: {
          testType: 'output-processing',
          provider: 'lmstudio',
          model: 'gpt-oss-20b-mlx'
        },
        debugEnabled: true
      };

      console.log(colors.gray('   📥 Processing output response...'));
      const startTime = Date.now();
      
      const result = await this.workerManager.processOutput(
        'lmstudio', 
        'gpt-oss-20b-mlx', 
        mockProviderResponse, 
        context
      );
      
      const processingTime = Date.now() - startTime;
      
      console.log(colors.green('✅ Output processing completed successfully'));
      console.log(colors.gray(`   Processing Time: ${processingTime}ms`));
      console.log(colors.gray(`   Result Type: ${typeof result}`));
      console.log(colors.gray(`   Result Keys: ${Object.keys(result || {}).join(', ')}`));
      
      return result;
    } catch (error) {
      console.log(colors.red('❌ Output processing failed'));
      console.log(colors.red(`   Error: ${error.message}`));
      return null;
    }
  }

  /**
   * 测试并发处理
   */
  async testConcurrentProcessing() {
    console.log(colors.blue('🚀 Testing Concurrent Processing...'));
    
    try {
      const concurrentRequests = 5;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        const testInput = {
          model: 'gpt-oss-20b-mlx',
          messages: [
            {
              role: 'user',
              content: `Concurrent test request #${i + 1} - Can you multiply ${i + 1} by 10?`
            }
          ],
          tools: [
            {
              name: 'calculator',
              description: 'Perform mathematical calculations',
              input_schema: {
                type: 'object',
                properties: {
                  expression: { type: 'string' }
                },
                required: ['expression']
              }
            }
          ],
          max_tokens: 500
        };

        const context = {
          requestId: `concurrent_${i + 1}_${Date.now()}`,
          timestamp: Date.now(),
          metadata: { testType: 'concurrent', requestNumber: i + 1 }
        };

        const promise = this.workerManager.processInput(
          'lmstudio', 
          'gpt-oss-20b-mlx', 
          testInput, 
          context
        );
        
        promises.push(promise);
      }

      console.log(colors.gray(`   📡 Sending ${concurrentRequests} concurrent requests...`));
      const startTime = Date.now();
      
      const results = await Promise.allSettled(promises);
      const processingTime = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(colors.green(`✅ Concurrent processing completed`));
      console.log(colors.gray(`   Total Time: ${processingTime}ms`));
      console.log(colors.gray(`   Successful: ${successful}/${concurrentRequests}`));
      console.log(colors.gray(`   Failed: ${failed}/${concurrentRequests}`));
      
      return { successful, failed, processingTime };
    } catch (error) {
      console.log(colors.red('❌ Concurrent processing test failed'));
      console.log(colors.red(`   Error: ${error.message}`));
      return null;
    }
  }

  /**
   * 显示最终统计信息
   */
  showFinalMetrics() {
    console.log(colors.blue('📊 Final Metrics Report:'));
    
    if (this.workerManager) {
      const metrics = this.workerManager.getMetrics();
      
      console.log(colors.cyan('Worker Manager Metrics:'));
      console.log(colors.gray(`   Total Workers: ${metrics.totalWorkers}`));
      console.log(colors.gray(`   Healthy Workers: ${metrics.healthyWorkers}`));
      console.log(colors.gray(`   Processing Workers: ${metrics.processingWorkers}`));
      console.log(colors.gray(`   Total Requests: ${metrics.totalRequests}`));
      console.log(colors.gray(`   Successful: ${metrics.successfulRequests}`));
      console.log(colors.gray(`   Failed: ${metrics.failedRequests}`));
      console.log(colors.gray(`   Avg Processing Time: ${metrics.avgProcessingTime}ms`));
      
      console.log(colors.cyan('Individual Worker Metrics:'));
      for (const [workerId, workerMetrics] of Object.entries(metrics.workerMetrics)) {
        console.log(colors.gray(`   ${workerId}:`));
        console.log(colors.gray(`     Requests: ${workerMetrics.totalRequests}`));
        console.log(colors.gray(`     Success Rate: ${workerMetrics.totalRequests > 0 ? Math.round((workerMetrics.successfulRequests / workerMetrics.totalRequests) * 100) : 0}%`));
        console.log(colors.gray(`     Avg Time: ${workerMetrics.avgProcessingTime}ms`));
      }
    }
    
    const totalTime = Date.now() - this.startTime;
    console.log(colors.cyan(`Total Test Duration: ${totalTime}ms`));
  }

  /**
   * 清理资源
   */
  async cleanup() {
    console.log(colors.blue('🧹 Cleaning up resources...'));
    
    if (this.workerManager) {
      await this.workerManager.shutdown();
    }
    
    console.log(colors.green('✅ Cleanup completed'));
  }

  /**
   * 运行完整测试
   */
  async run() {
    console.log(colors.cyan('🧪 LM Studio Worker System Test'));
    console.log(colors.cyan('================================'));
    
    try {
      // 1. 加载配置
      if (!this.loadConfig()) {
        return false;
      }

      // 2. 初始化Worker管理器
      if (!await this.initializeWorkerManager()) {
        return false;
      }

      // 3. 测试输入处理
      await this.testInputProcessing();

      // 4. 测试输出处理
      await this.testOutputProcessing();

      // 5. 测试并发处理
      await this.testConcurrentProcessing();

      // 6. 显示最终统计
      this.showFinalMetrics();

      console.log(colors.green('🎉 All tests completed successfully!'));
      return true;
      
    } catch (error) {
      console.log(colors.red('💥 Test suite failed'));
      console.log(colors.red(`   Error: ${error.message}`));
      console.log(colors.red(`   Stack: ${error.stack}`));
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// 运行测试
async function main() {
  const test = new LMStudioWorkerTest();
  const success = await test.run();
  process.exit(success ? 0 : 1);
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(colors.red('💥 Unhandled error:'), error);
    process.exit(1);
  });
}

export { LMStudioWorkerTest };