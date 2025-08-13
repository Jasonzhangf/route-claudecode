#!/usr/bin/env node

/**
 * LM Studio缓冲式处理修复验证测试
 * 验证38个工具调用解析问题的修复效果
 * @author Jason Zhang
 * @version v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { LMStudioBufferedProcessor } from '../../src/v3/provider/openai-compatible/lmstudio-buffered-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioBufferedProcessingFixTest {
  constructor() {
    this.testResults = {
      sessionId: `lmstudio-buffered-fix-test-${Date.now()}`,
      timestamp: new Date().toISOString(),
      testType: 'lmstudio-buffered-processing-fix',
      results: [],
      summary: {}
    };
    
    this.processor = new LMStudioBufferedProcessor();
    
    // 捕获数据路径
    this.capturePaths = [
      '/Users/fanzhang/.route-claudecode/database/captures/openai-protocol/lmstudio',
      '/Users/fanzhang/.route-claude-code/database/captures/openai'
    ];
  }

  /**
   * 主测试流程
   */
  async runTest() {
    console.log('🔧 LM Studio缓冲式处理修复验证测试');
    console.log('=============================================');
    console.log(`Session ID: ${this.testResults.sessionId}\n`);

    try {
      // 测试1: 初始化和健康检查
      await this.testProcessorInitialization();

      // 测试2: 使用真实捕获数据测试修复效果
      await this.testWithRealCaptureData();

      // 测试3: 测试边界情况和错误处理
      await this.testEdgeCasesAndErrorHandling();

      // 测试4: 性能基准测试
      await this.testPerformanceBenchmark();

      // 生成总结
      this.generateSummary();

      // 保存结果
      await this.saveResults();

      console.log('\n✅ LM Studio缓冲式处理修复验证完成!');
      console.log(`📊 修复成功率: ${this.testResults.summary.fixSuccessRate || 0}%`);
      console.log(`🔧 处理的文件: ${this.testResults.summary.processedFiles || 0}`);

    } catch (error) {
      console.error('\n❌ 测试失败:', error);
      process.exit(1);
    }
  }

  /**
   * 测试1: 处理器初始化和健康检查
   */
  async testProcessorInitialization() {
    console.log('🚀 测试1: 处理器初始化和健康检查...');

    const initResults = {
      processorCreated: false,
      healthCheckPassed: false,
      capabilitiesCorrect: false,
      layerInfoCorrect: false
    };

    try {
      // 检查处理器创建
      initResults.processorCreated = this.processor !== null;
      
      // 健康检查
      initResults.healthCheckPassed = await this.processor.healthCheck();
      
      // 检查能力
      const capabilities = this.processor.getCapabilities();
      initResults.capabilitiesCorrect = 
        capabilities.canHandleStreaming &&
        capabilities.canHandleToolCalls &&
        capabilities.canHandleBuffering;
      
      // 检查层信息
      initResults.layerInfoCorrect = 
        this.processor.name === 'lmstudio-buffered-processor' &&
        this.processor.version === '3.0.0' &&
        this.processor.layerType === 'preprocessor';

      console.log(`   ✅ 处理器创建: ${initResults.processorCreated}`);
      console.log(`   ✅ 健康检查: ${initResults.healthCheckPassed}`);
      console.log(`   ✅ 能力检查: ${initResults.capabilitiesCorrect}`);
      console.log(`   ✅ 层信息检查: ${initResults.layerInfoCorrect}`);

    } catch (error) {
      console.log(`   ❌ 初始化测试失败: ${error.message}`);
    }

    this.testResults.results.push({
      test: 'processor-initialization',
      status: Object.values(initResults).every(Boolean) ? 'passed' : 'failed',
      details: initResults
    });
  }

  /**
   * 测试2: 使用真实捕获数据测试修复效果
   */
  async testWithRealCaptureData() {
    console.log('\n📁 测试2: 使用真实捕获数据测试修复效果...');

    const testResults = {
      filesProcessed: 0,
      fixedFiles: 0,
      toolCallsExtracted: 0,
      fixedIssues: [],
      failedFiles: [],
      performanceMetrics: {
        totalProcessingTime: 0,
        averageProcessingTime: 0
      }
    };

    for (const capturePath of this.capturePaths) {
      try {
        const stats = await fs.stat(capturePath);
        if (stats.isDirectory()) {
          const files = await this.findCaptureFiles(capturePath);
          
          for (const file of files.slice(0, 20)) { // 限制处理前20个文件
            const startTime = Date.now();
            
            try {
              testResults.filesProcessed++;
              
              const fileContent = await fs.readFile(file, 'utf8');
              const captureData = JSON.parse(fileContent);
              
              // 检查原始数据是否有工具调用问题
              const hasOriginalIssue = this.detectOriginalToolCallIssue(captureData);
              
              if (hasOriginalIssue) {
                // 使用缓冲式处理器处理数据
                const mockContext = {
                  requestId: `test-${testResults.filesProcessed}`,
                  provider: 'lmstudio'
                };
                
                const processedResult = await this.processor.process(captureData, mockContext);
                
                // 验证修复效果
                const isFixed = this.verifyFix(captureData, processedResult);
                
                if (isFixed) {
                  testResults.fixedFiles++;
                  testResults.toolCallsExtracted += this.countExtractedToolCalls(processedResult);
                  testResults.fixedIssues.push({
                    file: path.basename(file),
                    originalIssue: hasOriginalIssue,
                    fixedSuccessfully: true,
                    toolCallsExtracted: this.countExtractedToolCalls(processedResult)
                  });
                  
                  console.log(`   ✅ 修复成功: ${path.basename(file)}`);
                } else {
                  testResults.failedFiles.push({
                    file: path.basename(file),
                    reason: 'fix_failed'
                  });
                  console.log(`   ❌ 修复失败: ${path.basename(file)}`);
                }
              }
              
              const processingTime = Date.now() - startTime;
              testResults.performanceMetrics.totalProcessingTime += processingTime;
              
            } catch (fileError) {
              testResults.failedFiles.push({
                file: path.basename(file),
                reason: fileError.message
              });
              console.log(`   ⚠️ 文件处理错误: ${path.basename(file)} - ${fileError.message}`);
            }
          }
        }
      } catch (error) {
        console.log(`   ⚠️ 路径不存在或无法访问: ${capturePath}`);
      }
    }

    // 计算平均处理时间
    if (testResults.filesProcessed > 0) {
      testResults.performanceMetrics.averageProcessingTime = 
        testResults.performanceMetrics.totalProcessingTime / testResults.filesProcessed;
    }

    console.log(`   📊 处理完成: ${testResults.filesProcessed}个文件`);
    console.log(`   ✅ 修复成功: ${testResults.fixedFiles}个文件`);
    console.log(`   🔧 提取工具调用: ${testResults.toolCallsExtracted}个`);
    console.log(`   ❌ 处理失败: ${testResults.failedFiles.length}个文件`);
    console.log(`   ⏱️ 平均处理时间: ${testResults.performanceMetrics.averageProcessingTime.toFixed(2)}ms`);

    this.testResults.results.push({
      test: 'real-capture-data-fix',
      status: testResults.fixedFiles > 0 ? 'passed' : 'failed',
      details: testResults
    });
  }

  /**
   * 查找捕获文件
   */
  async findCaptureFiles(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.findCaptureFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.json') && 
                   (entry.name.includes('openai') || entry.name.includes('lmstudio'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // 忽略读取错误
    }
    
    return files.slice(-40); // 返回最新的40个文件
  }

  /**
   * 检测原始数据中的工具调用问题
   */
  detectOriginalToolCallIssue(captureData) {
    // 检查请求中是否有工具调用
    const hasToolsInRequest = captureData.request?.tools && captureData.request.tools.length > 0;
    
    if (!hasToolsInRequest) {
      return false;
    }

    // 检查响应中的文本是否包含工具调用模式但没有正确的tool_calls结构
    const responseText = this.extractResponseText(captureData.response);
    const hasToolCallPatterns = this.hasToolCallPatterns(responseText);
    const hasProperToolCalls = this.hasProperToolCallsStructure(captureData.response);
    
    return hasToolCallPatterns && !hasProperToolCalls;
  }

  /**
   * 提取响应文本
   */
  extractResponseText(response) {
    if (!response) return '';
    
    try {
      // OpenAI格式
      if (response.choices?.[0]?.message?.content) {
        return response.choices[0].message.content;
      }
      
      // 流式响应
      if (response.events) {
        return response.events
          .filter(e => e.choices?.[0]?.delta?.content)
          .map(e => e.choices[0].delta.content)
          .join('');
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * 检查文本中是否有工具调用模式
   */
  hasToolCallPatterns(text) {
    if (!text) return false;
    
    const patterns = [
      /(?:⏺\s*)?Tool call:\s*(\w+)\((.*?)\)/g,
      /Tool call:\s*(\w+)\((.*?)\)/g,
      /function_call\s*=\s*(\w+)\((.*?)\)/g
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * 检查是否有正确的工具调用结构
   */
  hasProperToolCallsStructure(response) {
    if (!response) return false;
    
    // 检查OpenAI格式的tool_calls
    if (response.choices?.[0]?.message?.tool_calls) {
      return true;
    }
    
    // 检查流式响应中的tool_calls
    if (response.events) {
      return response.events.some(e => e.choices?.[0]?.delta?.tool_calls);
    }
    
    return false;
  }

  /**
   * 验证修复效果
   */
  verifyFix(originalData, processedResult) {
    try {
      // 检查处理结果是否包含事件
      if (!processedResult?.events) {
        return false;
      }

      // 检查是否有工具使用事件
      const hasToolUseEvents = processedResult.events.some(event => 
        event.event === 'content_block_start' &&
        event.data?.content_block?.type === 'tool_use'
      );

      return hasToolUseEvents;
    } catch (error) {
      return false;
    }
  }

  /**
   * 计算提取的工具调用数量
   */
  countExtractedToolCalls(processedResult) {
    try {
      if (!processedResult?.events) {
        return 0;
      }

      return processedResult.events.filter(event => 
        event.event === 'content_block_start' &&
        event.data?.content_block?.type === 'tool_use'
      ).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 测试3: 测试边界情况和错误处理
   */
  async testEdgeCasesAndErrorHandling() {
    console.log('\n⚠️ 测试3: 边界情况和错误处理...');

    const edgeCases = [
      {
        name: 'empty-input',
        input: null,
        expectedBehavior: 'return_input_as_is'
      },
      {
        name: 'non-lmstudio-input',
        input: { type: 'anthropic', data: 'test' },
        expectedBehavior: 'return_input_as_is'
      },
      {
        name: 'malformed-json',
        input: 'data: {"invalid": json}',
        expectedBehavior: 'handle_gracefully'
      },
      {
        name: 'large-input',
        input: this.generateLargeInput(),
        expectedBehavior: 'process_successfully'
      }
    ];

    const edgeTestResults = [];

    for (const testCase of edgeCases) {
      try {
        const mockContext = {
          requestId: `edge-test-${testCase.name}`,
          provider: 'lmstudio'
        };

        const result = await this.processor.process(testCase.input, mockContext);
        
        let testPassed = false;
        
        switch (testCase.expectedBehavior) {
          case 'return_input_as_is':
            testPassed = result === testCase.input;
            break;
          case 'handle_gracefully':
            testPassed = result !== null && result !== undefined;
            break;
          case 'process_successfully':
            testPassed = result !== null;
            break;
        }

        edgeTestResults.push({
          name: testCase.name,
          passed: testPassed,
          expectedBehavior: testCase.expectedBehavior,
          actualResult: result !== null ? 'success' : 'null'
        });

        console.log(`   ${testPassed ? '✅' : '❌'} ${testCase.name}: ${testCase.expectedBehavior}`);

      } catch (error) {
        edgeTestResults.push({
          name: testCase.name,
          passed: false,
          expectedBehavior: testCase.expectedBehavior,
          error: error.message
        });
        console.log(`   ❌ ${testCase.name}: 抛出异常 - ${error.message}`);
      }
    }

    this.testResults.results.push({
      test: 'edge-cases-and-error-handling',
      status: edgeTestResults.every(r => r.passed) ? 'passed' : 'partial',
      details: {
        totalTests: edgeTestResults.length,
        passed: edgeTestResults.filter(r => r.passed).length,
        results: edgeTestResults
      }
    });
  }

  /**
   * 生成大输入用于测试
   */
  generateLargeInput() {
    const largeContent = 'Tool call: bash(' + 'x'.repeat(10000) + ')';
    return `data: {"choices": [{"delta": {"content": "${largeContent}"}}]}`;
  }

  /**
   * 测试4: 性能基准测试
   */
  async testPerformanceBenchmark() {
    console.log('\n⚡ 测试4: 性能基准测试...');

    const benchmarkInput = this.generateBenchmarkInput();
    const iterations = 100;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      await this.processor.process(benchmarkInput, {
        requestId: `benchmark-${i}`,
        provider: 'lmstudio'
      });
      
      times.push(Date.now() - startTime);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log(`   📊 平均处理时间: ${avgTime.toFixed(2)}ms`);
    console.log(`   ⚡ 最快处理时间: ${minTime}ms`);
    console.log(`   🐌 最慢处理时间: ${maxTime}ms`);

    this.testResults.results.push({
      test: 'performance-benchmark',
      status: avgTime < 100 ? 'passed' : 'warning', // 期望平均处理时间小于100ms
      details: {
        iterations,
        averageTime: avgTime,
        minTime,
        maxTime,
        times: times.slice(0, 10) // 只保存前10个时间用于调试
      }
    });
  }

  /**
   * 生成基准测试输入
   */
  generateBenchmarkInput() {
    return {
      events: [
        {
          choices: [{
            delta: {
              content: 'I will help you with that task.\n\nTool call: bash(echo "Hello World")\n\nThe command executed successfully.'
            }
          }]
        }
      ]
    };
  }

  /**
   * 生成测试总结
   */
  generateSummary() {
    const total = this.testResults.results.length;
    const passed = this.testResults.results.filter(r => r.status === 'passed').length;
    const failed = this.testResults.results.filter(r => r.status === 'failed').length;
    const warnings = this.testResults.results.filter(r => r.status === 'warning' || r.status === 'partial').length;

    // 从真实数据测试中获取修复统计
    const realDataTest = this.testResults.results.find(r => r.test === 'real-capture-data-fix');
    const fixSuccessRate = realDataTest?.details?.filesProcessed > 0 
      ? Math.round((realDataTest.details.fixedFiles / realDataTest.details.filesProcessed) * 100)
      : 0;

    this.testResults.summary = {
      total,
      passed,
      failed,
      warnings,
      fixSuccessRate,
      processedFiles: realDataTest?.details?.filesProcessed || 0,
      fixedFiles: realDataTest?.details?.fixedFiles || 0,
      toolCallsExtracted: realDataTest?.details?.toolCallsExtracted || 0
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
  const test = new LMStudioBufferedProcessingFixTest();
  test.runTest().catch(console.error);
}

export { LMStudioBufferedProcessingFixTest };