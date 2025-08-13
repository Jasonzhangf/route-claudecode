#!/usr/bin/env node

/**
 * 工具解析修复效果验证测试
 * 直接验证38个工具调用解析问题的修复效果
 * @author Jason Zhang
 * @version v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { LMStudioBufferedProcessor } from '../../src/v3/provider/openai-compatible/lmstudio-buffered-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ToolParsingFixVerificationTest {
  constructor() {
    this.testResults = {
      sessionId: `tool-parsing-fix-verification-${Date.now()}`,
      timestamp: new Date().toISOString(),
      testType: 'tool-parsing-fix-verification',
      results: [],
      summary: {}
    };
    
    this.processor = new LMStudioBufferedProcessor();
  }

  /**
   * 主测试流程
   */
  async runTest() {
    console.log('🔧 工具解析修复效果验证测试');
    console.log('=============================================');
    console.log(`Session ID: ${this.testResults.sessionId}\n`);

    try {
      // 测试1: 标准工具调用模式处理
      await this.testStandardToolCallPattern();

      // 测试2: 带前缀的工具调用模式处理
      await this.testPrefixToolCallPattern();

      // 测试3: 混合内容处理（文本+工具调用）
      await this.testMixedContentProcessing();

      // 测试4: 真实LM Studio响应数据处理
      await this.testRealLMStudioData();

      // 测试5: 性能和稳定性测试
      await this.testPerformanceAndStability();

      // 生成总结
      this.generateSummary();

      // 保存结果
      await this.saveResults();

      console.log('\n✅ 工具解析修复效果验证完成!');
      console.log(`📊 修复成功率: ${this.testResults.summary.overallFixRate || 0}%`);
      console.log(`🔧 成功提取工具调用: ${this.testResults.summary.totalToolCallsExtracted || 0}个`);

    } catch (error) {
      console.error('\n❌ 测试失败:', error);
      process.exit(1);
    }
  }

  /**
   * 测试1: 标准工具调用模式处理
   */
  async testStandardToolCallPattern() {
    console.log('📋 测试1: 标准工具调用模式处理...');

    const testCases = [
      {
        name: 'single-tool-call',
        input: {
          events: [{
            choices: [{
              delta: {
                content: 'Tool call: bash(echo "Hello World")'
              }
            }]
          }]
        }
      },
      {
        name: 'multiple-tool-calls',
        input: {
          events: [{
            choices: [{
              delta: {
                content: 'Tool call: bash(ls -la)\n\nTool call: file_read(/etc/hosts)'
              }
            }]
          }]
        }
      },
      {
        name: 'tool-call-with-json-args',
        input: {
          events: [{
            choices: [{
              delta: {
                content: 'Tool call: api_call({"url": "https://api.example.com", "method": "GET"})'
              }
            }]
          }]
        }
      }
    ];

    const testResults = [];

    for (const testCase of testCases) {
      try {
        const context = {
          requestId: `test-${testCase.name}`,
          provider: 'lmstudio'
        };

        const result = await this.processor.process(testCase.input, context);
        
        const toolCallsExtracted = this.countToolCalls(result);
        const success = toolCallsExtracted > 0;

        testResults.push({
          name: testCase.name,
          success,
          toolCallsExtracted,
          hasProperFormat: this.hasProperEventFormat(result)
        });

        console.log(`   ${success ? '✅' : '❌'} ${testCase.name}: 提取${toolCallsExtracted}个工具调用`);

      } catch (error) {
        testResults.push({
          name: testCase.name,
          success: false,
          error: error.message
        });
        console.log(`   ❌ ${testCase.name}: 处理失败 - ${error.message}`);
      }
    }

    this.testResults.results.push({
      test: 'standard-tool-call-pattern',
      status: testResults.every(r => r.success) ? 'passed' : 'partial',
      details: {
        totalTests: testResults.length,
        passed: testResults.filter(r => r.success).length,
        totalToolCallsExtracted: testResults.reduce((sum, r) => sum + (r.toolCallsExtracted || 0), 0),
        results: testResults
      }
    });
  }

  /**
   * 测试2: 带前缀的工具调用模式处理
   */
  async testPrefixToolCallPattern() {
    console.log('\n🔍 测试2: 带前缀的工具调用模式处理...');

    const testCases = [
      {
        name: 'circle-prefix-tool-call',
        input: {
          events: [{
            choices: [{
              delta: {
                content: '⏺ Tool call: bash(echo "test with prefix")'
              }
            }]
          }]
        }
      },
      {
        name: 'mixed-prefix-patterns',
        input: {
          events: [{
            choices: [{
              delta: {
                content: 'Some text before\n\n⏺ Tool call: file_write(test.txt, "content")\n\nTool call: bash(cat test.txt)\n\nSome text after'
              }
            }]
          }]
        }
      }
    ];

    const testResults = [];

    for (const testCase of testCases) {
      try {
        const context = {
          requestId: `prefix-test-${testCase.name}`,
          provider: 'lmstudio'
        };

        const result = await this.processor.process(testCase.input, context);
        
        const toolCallsExtracted = this.countToolCalls(result);
        const success = toolCallsExtracted > 0;

        testResults.push({
          name: testCase.name,
          success,
          toolCallsExtracted,
          hasTextContent: this.hasTextContent(result)
        });

        console.log(`   ${success ? '✅' : '❌'} ${testCase.name}: 提取${toolCallsExtracted}个工具调用`);

      } catch (error) {
        testResults.push({
          name: testCase.name,
          success: false,
          error: error.message
        });
        console.log(`   ❌ ${testCase.name}: 处理失败 - ${error.message}`);
      }
    }

    this.testResults.results.push({
      test: 'prefix-tool-call-pattern',
      status: testResults.every(r => r.success) ? 'passed' : 'partial',
      details: {
        totalTests: testResults.length,
        passed: testResults.filter(r => r.success).length,
        totalToolCallsExtracted: testResults.reduce((sum, r) => sum + (r.toolCallsExtracted || 0), 0),
        results: testResults
      }
    });
  }

  /**
   * 测试3: 混合内容处理（文本+工具调用）
   */
  async testMixedContentProcessing() {
    console.log('\n🔄 测试3: 混合内容处理（文本+工具调用）...');

    const mixedContent = {
      events: [{
        choices: [{
          delta: {
            content: `I'll help you analyze the system files. Let me start by checking the directory structure.

Tool call: bash(ls -la /etc)

Now let me examine the network configuration:

Tool call: file_read(/etc/hosts)

Based on the analysis, I'll create a summary report:

Tool call: file_write(analysis_report.txt, "System analysis completed successfully")`
          }
        }]
      }]
    };

    try {
      const context = {
        requestId: 'mixed-content-test',
        provider: 'lmstudio'
      };

      const result = await this.processor.process(mixedContent, context);
      
      const toolCallsExtracted = this.countToolCalls(result);
      const hasTextContent = this.hasTextContent(result);
      const success = toolCallsExtracted === 3 && hasTextContent;

      console.log(`   ${success ? '✅' : '❌'} 混合内容处理: 提取${toolCallsExtracted}个工具调用，保留文本内容: ${hasTextContent}`);

      this.testResults.results.push({
        test: 'mixed-content-processing',
        status: success ? 'passed' : 'failed',
        details: {
          toolCallsExtracted,
          hasTextContent,
          expectedToolCalls: 3,
          success
        }
      });

    } catch (error) {
      console.log(`   ❌ 混合内容处理失败: ${error.message}`);
      
      this.testResults.results.push({
        test: 'mixed-content-processing',
        status: 'failed',
        details: {
          error: error.message
        }
      });
    }
  }

  /**
   * 测试4: 真实LM Studio响应数据处理
   */
  async testRealLMStudioData() {
    console.log('\n📊 测试4: 真实LM Studio响应数据处理...');

    // 模拟真实的LM Studio流式响应数据
    const realLMStudioData = {
      events: [
        {
          choices: [{
            delta: { content: 'I understand you want me to ' }
          }]
        },
        {
          choices: [{
            delta: { content: 'help with file operations. Let me start by checking the current directory.\n\n' }
          }]
        },
        {
          choices: [{
            delta: { content: 'Tool call: bash(pwd)' }
          }]
        },
        {
          choices: [{
            delta: { content: '\n\nNow let me list the files:\n\n' }
          }]
        },
        {
          choices: [{
            delta: { content: 'Tool call: bash(ls -la)' }
          }]
        },
        {
          choices: [{
            delta: { content: '\n\nThese commands will help us understand the current working environment.' }
          }]
        }
      ]
    };

    try {
      const context = {
        requestId: 'real-lmstudio-test',
        provider: 'lmstudio'
      };

      const result = await this.processor.process(realLMStudioData, context);
      
      const toolCallsExtracted = this.countToolCalls(result);
      const hasTextContent = this.hasTextContent(result);
      const hasProperFormat = this.hasProperEventFormat(result);
      const success = toolCallsExtracted === 2 && hasTextContent && hasProperFormat;

      console.log(`   ${success ? '✅' : '❌'} 真实数据处理: 提取${toolCallsExtracted}个工具调用，保留文本: ${hasTextContent}，格式正确: ${hasProperFormat}`);

      this.testResults.results.push({
        test: 'real-lmstudio-data-processing',
        status: success ? 'passed' : 'partial',
        details: {
          toolCallsExtracted,
          hasTextContent,
          hasProperFormat,
          expectedToolCalls: 2,
          success
        }
      });

    } catch (error) {
      console.log(`   ❌ 真实数据处理失败: ${error.message}`);
      
      this.testResults.results.push({
        test: 'real-lmstudio-data-processing',
        status: 'failed',
        details: {
          error: error.message
        }
      });
    }
  }

  /**
   * 测试5: 性能和稳定性测试
   */
  async testPerformanceAndStability() {
    console.log('\n⚡ 测试5: 性能和稳定性测试...');

    const performanceTestData = {
      events: [{
        choices: [{
          delta: {
            content: 'Tool call: bash(echo "Performance test")'.repeat(50)
          }
        }]
      }]
    };

    const iterations = 10;
    const times = [];
    let successCount = 0;

    for (let i = 0; i < iterations; i++) {
      try {
        const startTime = Date.now();
        
        const context = {
          requestId: `perf-test-${i}`,
          provider: 'lmstudio'
        };

        const result = await this.processor.process(performanceTestData, context);
        
        const processingTime = Date.now() - startTime;
        times.push(processingTime);
        
        if (this.countToolCalls(result) > 0) {
          successCount++;
        }

      } catch (error) {
        console.log(`   ⚠️ 迭代${i + 1}失败: ${error.message}`);
      }
    }

    const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const successRate = (successCount / iterations) * 100;

    console.log(`   📊 性能测试结果:`);
    console.log(`      - 成功率: ${successRate.toFixed(1)}% (${successCount}/${iterations})`);
    console.log(`      - 平均处理时间: ${avgTime.toFixed(2)}ms`);
    console.log(`      - 最大处理时间: ${Math.max(...times) || 0}ms`);

    this.testResults.results.push({
      test: 'performance-and-stability',
      status: successRate >= 90 ? 'passed' : 'warning',
      details: {
        iterations,
        successCount,
        successRate,
        averageTime: avgTime,
        maxTime: Math.max(...times) || 0,
        times
      }
    });
  }

  /**
   * 计算工具调用数量
   */
  countToolCalls(result) {
    if (!result?.events) return 0;
    
    return result.events.filter(event => 
      event.event === 'content_block_start' &&
      event.data?.content_block?.type === 'tool_use'
    ).length;
  }

  /**
   * 检查是否有文本内容
   */
  hasTextContent(result) {
    if (!result?.events) return false;
    
    return result.events.some(event => 
      event.event === 'content_block_start' &&
      event.data?.content_block?.type === 'text'
    );
  }

  /**
   * 检查是否有正确的事件格式
   */
  hasProperEventFormat(result) {
    if (!result?.events) return false;
    
    const requiredEvents = ['message_start', 'ping'];
    return requiredEvents.every(eventType => 
      result.events.some(event => event.event === eventType)
    );
  }

  /**
   * 生成测试总结
   */
  generateSummary() {
    const total = this.testResults.results.length;
    const passed = this.testResults.results.filter(r => r.status === 'passed').length;
    const failed = this.testResults.results.filter(r => r.status === 'failed').length;
    const warnings = this.testResults.results.filter(r => r.status === 'warning' || r.status === 'partial').length;

    // 计算总体修复率
    const totalToolCallsExtracted = this.testResults.results.reduce((sum, result) => {
      return sum + (result.details?.totalToolCallsExtracted || result.details?.toolCallsExtracted || 0);
    }, 0);

    // 从性能测试中获取成功率
    const performanceTest = this.testResults.results.find(r => r.test === 'performance-and-stability');
    const stabilitySuccessRate = performanceTest?.details?.successRate || 0;

    const overallFixRate = passed === total ? 100 : Math.round((passed / total) * 100);

    this.testResults.summary = {
      total,
      passed,
      failed,
      warnings,
      overallFixRate,
      totalToolCallsExtracted,
      stabilitySuccessRate
    };
  }

  /**
   * 保存测试结果
   */
  async saveResults() {
    const outputDir = path.join(__dirname, '../output/functional');
    await fs.mkdir(outputDir, { recursive: true });
    
    const outputFile = path.join(outputDir, `${this.testResults.sessionId}.json`);
    await fs.writeFile(outputFile, JSON.stringify(this.testResults, null, 2));
    
    console.log(`\n📄 测试结果已保存: ${outputFile}`);
  }
}

// 运行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new ToolParsingFixVerificationTest();
  test.runTest().catch(console.error);
}

export { ToolParsingFixVerificationTest };