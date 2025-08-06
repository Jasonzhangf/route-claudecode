/**
 * 统一工具调用检测压力测试
 * 确保滑动窗口检测覆盖所有OpenAI兼容输入，流式和非流式响应都执行检测
 */

const { UnifiedToolCallDetector, SlidingWindowDetector } = require('./dist/utils/unified-tool-call-detector');

// 压力测试配置
const STRESS_TEST_CONFIG = {
  // 滑动窗口测试参数
  windowSizes: [100, 200, 500, 1000, 2000],
  overlapSizes: [20, 50, 100, 200],
  chunkSizes: [1, 5, 10, 25, 50, 100, 200],
  
  // 测试强度
  iterations: 50,
  concurrentTests: 5,
  
  // 工具调用模式 - 覆盖各种可能的格式
  toolCallPatterns: [
    // 标准JSON格式
    '{"type": "tool_use", "id": "toolu_123", "name": "TestTool", "input": {"param": "value"}}',
    
    // Tool call文本格式
    'Tool call: TestTool({"param": "value", "nested": {"key": "val"}})',
    
    // 直接函数调用格式
    'ExecuteTask({"description": "测试任务", "priority": "high"})',
    
    // Qwen模型格式
    '{"name": "SearchTool", "arguments": "{\\"query\\": \\"test search\\", \\"limit\\": 10}"}',
    
    // 嵌套复杂JSON
    '{"type": "tool_use", "id": "complex_001", "name": "ComplexTool", "input": {"data": {"nested": {"deep": {"value": "test"}}}, "array": [1, 2, 3]}}',
    
    // 中文内容
    '我需要调用工具：{"type": "tool_use", "id": "chinese_tool", "name": "中文工具", "input": {"参数": "值", "描述": "这是一个中文工具调用"}}',
    
    // 多个工具调用
    'First tool: {"type": "tool_use", "id": "tool1", "name": "Tool1", "input": {"a": 1}} Second tool: {"type": "tool_use", "id": "tool2", "name": "Tool2", "input": {"b": 2}}',
    
    // 长参数工具调用
    '{"type": "tool_use", "id": "long_param", "name": "LongTool", "input": {"long_text": "' + 'x'.repeat(500) + '", "data": "test"}}',
    
    // 特殊字符
    'Tool call: SpecialTool({"text": "Hello \\"world\\"", "symbols": "!@#$%^&*()", "unicode": "🚀🔧⚡"})',
    
    // 格式错误但可修复的
    'Tool call: BrokenTool({param: "missing quotes", "valid": "param"})',
    
    // GLM风格
    'glm_tool_call: {"function_name": "GLMTool", "parameters": {"input": "test"}}',
    
    // 混合格式
    'Here is the result: {"type": "tool_use", "id": "mixed", "name": "MixedTool", "input": {"result": "success"}} and some additional text.'
  ],
  
  // 边界情况测试
  edgeCases: [
    // 跨块分割的工具调用
    {
      name: '跨块分割JSON',
      chunks: ['{"type": "tool_', 'use", "id": "split", ', '"name": "SplitTool", "input": {"test": "value"}}'],
      shouldDetect: true
    },
    
    // 极小块大小
    {
      name: '单字符块',
      chunks: Array.from('{"type": "tool_use", "id": "char", "name": "CharTool", "input": {}}'),
      shouldDetect: true
    },
    
    // 嵌套引号
    {
      name: '嵌套引号',
      chunks: ['Tool call: QuoteTool({"text": "\\"nested quotes\\" test", "data": "value"})'],
      shouldDetect: true
    },
    
    // 多层嵌套
    {
      name: '多层嵌套',
      chunks: ['{"type": "tool_use", "id": "nested", "name": "NestedTool", "input": {"level1": {"level2": {"level3": {"value": "deep"}}}}}'],
      shouldDetect: true
    },
    
    // 数组参数
    {
      name: '数组参数',
      chunks: ['Tool call: ArrayTool({"items": [{"id": 1, "name": "item1"}, {"id": 2, "name": "item2"}], "count": 2})'],
      shouldDetect: true
    },
    
    // 空参数
    {
      name: '空参数',
      chunks: ['{"type": "tool_use", "id": "empty", "name": "EmptyTool", "input": {}}'],
      shouldDetect: true
    },
    
    // 超长工具调用
    {
      name: '超长工具调用',
      chunks: [`{"type": "tool_use", "id": "long", "name": "LongTool", "input": {"data": "${'x'.repeat(2000)}"}}`],
      shouldDetect: true
    },
    
    // 格式混乱但有效
    {
      name: '格式混乱',
      chunks: ['   {"type":   "tool_use"  , "id":"messy"   ,"name": "MessyTool","input":{"param":"value"}}   '],
      shouldDetect: true
    }
  ]
};

class UnifiedToolCallStressTester {
  constructor() {
    this.detector = new UnifiedToolCallDetector();
    this.slidingDetector = new SlidingWindowDetector();
    this.results = {
      nonStreaming: { total: 0, detected: 0, missed: 0, falsePositives: 0, errors: 0 },
      streaming: { total: 0, detected: 0, missed: 0, falsePositives: 0, errors: 0 },
      slidingWindow: { total: 0, detected: 0, missed: 0, errors: 0 },
      edgeCases: { total: 0, passed: 0, failed: 0 },
      performance: { totalTime: 0, avgTime: 0, maxTime: 0, minTime: Infinity }
    };
  }

  /**
   * 生成流式数据块
   */
  generateStreamingChunks(pattern, chunkSize) {
    const prefix = 'Let me help you with that task. ';
    const suffix = ' This completes the requested operation.';
    const fullText = prefix + pattern + suffix;
    
    const chunks = [];
    for (let i = 0; i < fullText.length; i += chunkSize) {
      chunks.push(fullText.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 模拟滑动窗口处理
   */
  simulateSlidingWindow(chunks, windowSize, overlapSize) {
    let buffer = '';
    const detections = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      buffer += chunk;
      
      // 保持窗口大小
      if (buffer.length > windowSize) {
        const keepSize = windowSize - overlapSize;
        buffer = buffer.slice(-keepSize) + chunk;
      }
      
      // 在当前窗口中检测
      const context = {
        provider: 'openai',
        model: 'test-model',
        isStreaming: true,
        requestId: `test-${i}`
      };
      
      const detection = this.slidingDetector.detectInText(buffer, context);
      detections.push({
        chunkIndex: i,
        bufferLength: buffer.length,
        hasToolCall: detection.hasToolCalls,
        toolCallsCount: detection.extractedToolCalls.length,
        confidence: detection.confidence,
        detectionMethod: detection.detectionMethod
      });
    }
    
    return detections;
  }

  /**
   * 测试非流式响应
   */
  async testNonStreamingResponse(pattern, testId) {
    const startTime = Date.now();
    
    try {
      const testData = {
        content: [
          {
            type: "text",
            text: `I'll help you with this task. ${pattern} The operation is complete.`
          }
        ],
        id: `test-${testId}`,
        model: "test-model",
        role: "assistant",
        type: "message"
      };

      const context = {
        provider: 'openai',
        model: 'test-model',
        isStreaming: false,
        requestId: `test-${testId}`
      };

      const result = await this.detector.detectAndProcess(testData, context);
      const hasToolCalls = this.hasExtractedToolCalls(result);
      const shouldDetect = this.shouldDetectToolCall(pattern);

      this.results.nonStreaming.total++;
      
      if (hasToolCalls && shouldDetect) {
        this.results.nonStreaming.detected++;
      } else if (!hasToolCalls && shouldDetect) {
        this.results.nonStreaming.missed++;
        console.log(`❌ NON-STREAMING MISSED: ${pattern.substring(0, 50)}...`);
      } else if (hasToolCalls && !shouldDetect) {
        this.results.nonStreaming.falsePositives++;
        console.log(`⚠️  NON-STREAMING FALSE POSITIVE: ${pattern.substring(0, 50)}...`);
      }

      const duration = Date.now() - startTime;
      this.updatePerformanceStats(duration);

      return { hasToolCalls, shouldDetect, duration };

    } catch (error) {
      this.results.nonStreaming.errors++;
      console.log(`❌ NON-STREAMING ERROR: ${error.message}`);
      return { hasToolCalls: false, shouldDetect: false, duration: Date.now() - startTime };
    }
  }

  /**
   * 测试流式响应
   */
  async testStreamingResponse(pattern, chunkSize, windowSize, overlapSize, testId) {
    const startTime = Date.now();
    
    try {
      const chunks = this.generateStreamingChunks(pattern, chunkSize);
      const detections = this.simulateSlidingWindow(chunks, windowSize, overlapSize);
      
      const hasDetection = detections.some(d => d.hasToolCall);
      const shouldDetect = this.shouldDetectToolCall(pattern);

      this.results.streaming.total++;
      this.results.slidingWindow.total++;

      if (hasDetection && shouldDetect) {
        this.results.streaming.detected++;
        this.results.slidingWindow.detected++;
      } else if (!hasDetection && shouldDetect) {
        this.results.streaming.missed++;
        this.results.slidingWindow.missed++;
        console.log(`❌ STREAMING MISSED: ${pattern.substring(0, 30)}... (chunk: ${chunkSize}, window: ${windowSize})`);
      } else if (hasDetection && !shouldDetect) {
        this.results.streaming.falsePositives++;
      }

      const duration = Date.now() - startTime;
      this.updatePerformanceStats(duration);

      return { hasDetection, shouldDetect, detections, duration };

    } catch (error) {
      this.results.streaming.errors++;
      this.results.slidingWindow.errors++;
      console.log(`❌ STREAMING ERROR: ${error.message}`);
      return { hasDetection: false, shouldDetect: false, detections: [], duration: Date.now() - startTime };
    }
  }

  /**
   * 测试边界情况
   */
  async testEdgeCases() {
    console.log('\\n🔍 运行边界情况测试...');
    
    for (const testCase of STRESS_TEST_CONFIG.edgeCases) {
      try {
        console.log(`   测试: ${testCase.name}`);
        
        let buffer = '';
        let detected = false;
        const context = {
          provider: 'openai',
          model: 'test-model',
          isStreaming: true,
          requestId: `edge-${testCase.name}`
        };

        for (const chunk of testCase.chunks) {
          buffer += chunk;
          const detection = this.slidingDetector.detectInText(buffer, context);
          if (detection.hasToolCalls) {
            detected = true;
            break;
          }
        }

        this.results.edgeCases.total++;
        
        if (detected === testCase.shouldDetect) {
          this.results.edgeCases.passed++;
          console.log(`     ✅ 通过`);
        } else {
          this.results.edgeCases.failed++;
          console.log(`     ❌ 失败 (期望: ${testCase.shouldDetect}, 实际: ${detected})`);
        }

      } catch (error) {
        this.results.edgeCases.failed++;
        console.log(`     ❌ 错误: ${error.message}`);
      }
    }
  }

  /**
   * 运行完整压力测试
   */
  async runFullStressTest() {
    console.log('🚀 开始统一工具调用检测压力测试...\\n');
    
    const totalTests = this.calculateTotalTests();
    console.log(`📊 测试配置:`);
    console.log(`   • 工具调用模式: ${STRESS_TEST_CONFIG.toolCallPatterns.length} 个`);
    console.log(`   • 窗口大小: ${STRESS_TEST_CONFIG.windowSizes.join(', ')}`);
    console.log(`   • 重叠大小: ${STRESS_TEST_CONFIG.overlapSizes.join(', ')}`);
    console.log(`   • 块大小: ${STRESS_TEST_CONFIG.chunkSizes.join(', ')}`);
    console.log(`   • 迭代次数: ${STRESS_TEST_CONFIG.iterations}`);
    console.log(`   • 预计总测试数: ${totalTests}\\n`);

    let testCount = 0;
    const startTime = Date.now();

    // 测试所有工具调用模式
    for (const pattern of STRESS_TEST_CONFIG.toolCallPatterns) {
      console.log(`🧪 测试模式: ${pattern.substring(0, 60)}...`);
      
      // 非流式测试
      for (let i = 0; i < STRESS_TEST_CONFIG.iterations; i++) {
        await this.testNonStreamingResponse(pattern, testCount++);
        this.logProgress(testCount, totalTests);
      }

      // 流式测试 - 所有参数组合
      for (const windowSize of STRESS_TEST_CONFIG.windowSizes) {
        for (const overlapSize of STRESS_TEST_CONFIG.overlapSizes) {
          if (overlapSize >= windowSize) continue; // 跳过无效组合
          
          for (const chunkSize of STRESS_TEST_CONFIG.chunkSizes) {
            for (let i = 0; i < STRESS_TEST_CONFIG.iterations; i++) {
              await this.testStreamingResponse(pattern, chunkSize, windowSize, overlapSize, testCount++);
              this.logProgress(testCount, totalTests);
            }
          }
        }
      }
    }

    // 边界情况测试
    await this.testEdgeCases();

    const totalDuration = Date.now() - startTime;
    this.results.performance.totalTime = totalDuration;
    this.results.performance.avgTime = totalDuration / testCount;

    this.printDetailedResults();
  }

  /**
   * 计算总测试数
   */
  calculateTotalTests() {
    const patterns = STRESS_TEST_CONFIG.toolCallPatterns.length;
    const iterations = STRESS_TEST_CONFIG.iterations;
    
    // 非流式测试
    const nonStreamingTests = patterns * iterations;
    
    // 流式测试
    const validCombinations = STRESS_TEST_CONFIG.windowSizes.length * 
                             STRESS_TEST_CONFIG.overlapSizes.length * 
                             STRESS_TEST_CONFIG.chunkSizes.length;
    const streamingTests = patterns * validCombinations * iterations;
    
    return nonStreamingTests + streamingTests;
  }

  /**
   * 记录进度
   */
  logProgress(current, total) {
    if (current % 500 === 0 || current === total) {
      const percentage = ((current / total) * 100).toFixed(1);
      console.log(`   进度: ${current}/${total} (${percentage}%)`);
    }
  }

  /**
   * 更新性能统计
   */
  updatePerformanceStats(duration) {
    this.results.performance.maxTime = Math.max(this.results.performance.maxTime, duration);
    this.results.performance.minTime = Math.min(this.results.performance.minTime, duration);
  }

  /**
   * 检查是否提取了工具调用
   */
  hasExtractedToolCalls(data) {
    if (!data?.content || !Array.isArray(data.content)) {
      return false;
    }
    return data.content.some(block => block.type === 'tool_use');
  }

  /**
   * 判断是否应该检测到工具调用
   */
  shouldDetectToolCall(pattern) {
    return pattern.includes('tool_use') || 
           pattern.includes('Tool call:') || 
           (pattern.includes('name') && pattern.includes('input')) ||
           pattern.includes('arguments') ||
           /\w+\s*\(\s*\{/.test(pattern);
  }

  /**
   * 打印详细结果
   */
  printDetailedResults() {
    console.log('\\n' + '='.repeat(80));
    console.log('📊 统一工具调用检测压力测试结果');
    console.log('='.repeat(80));

    // 非流式结果
    console.log('\\n🔄 非流式响应测试:');
    this.printTestResults(this.results.nonStreaming);

    // 流式结果
    console.log('\\n🌊 流式响应测试:');
    this.printTestResults(this.results.streaming);

    // 滑动窗口结果
    console.log('\\n🪟 滑动窗口检测:');
    console.log(`   总窗口测试: ${this.results.slidingWindow.total}`);
    console.log(`   窗口检测成功: ${this.results.slidingWindow.detected}`);
    console.log(`   窗口漏检: ${this.results.slidingWindow.missed}`);
    console.log(`   窗口错误: ${this.results.slidingWindow.errors}`);
    console.log(`   窗口检测率: ${this.calculateSuccessRate(this.results.slidingWindow)}%`);

    // 边界情况结果
    console.log('\\n🔍 边界情况测试:');
    console.log(`   总测试数: ${this.results.edgeCases.total}`);
    console.log(`   通过: ${this.results.edgeCases.passed}`);
    console.log(`   失败: ${this.results.edgeCases.failed}`);
    console.log(`   通过率: ${((this.results.edgeCases.passed / this.results.edgeCases.total) * 100).toFixed(2)}%`);

    // 性能统计
    console.log('\\n⚡ 性能统计:');
    console.log(`   总耗时: ${(this.results.performance.totalTime / 1000).toFixed(2)}s`);
    console.log(`   平均耗时: ${this.results.performance.avgTime.toFixed(2)}ms`);
    console.log(`   最大耗时: ${this.results.performance.maxTime}ms`);
    console.log(`   最小耗时: ${this.results.performance.minTime}ms`);

    // 总体评估
    this.printOverallAssessment();

    // 优化建议
    this.printOptimizationSuggestions();
  }

  /**
   * 打印测试结果
   */
  printTestResults(results) {
    console.log(`   总测试数: ${results.total}`);
    console.log(`   检测成功: ${results.detected}`);
    console.log(`   漏检: ${results.missed}`);
    console.log(`   误检: ${results.falsePositives}`);
    console.log(`   错误: ${results.errors}`);
    console.log(`   成功率: ${this.calculateSuccessRate(results)}%`);
  }

  /**
   * 计算成功率
   */
  calculateSuccessRate(results) {
    if (results.total === 0) return 0;
    return ((results.detected / results.total) * 100).toFixed(2);
  }

  /**
   * 打印总体评估
   */
  printOverallAssessment() {
    const totalDetected = this.results.nonStreaming.detected + this.results.streaming.detected;
    const totalMissed = this.results.nonStreaming.missed + this.results.streaming.missed;
    const totalTests = this.results.nonStreaming.total + this.results.streaming.total;
    const totalErrors = this.results.nonStreaming.errors + this.results.streaming.errors;

    console.log('\\n🎯 总体评估:');
    console.log(`   总检测率: ${((totalDetected / totalTests) * 100).toFixed(2)}%`);
    console.log(`   总漏检率: ${((totalMissed / totalTests) * 100).toFixed(2)}%`);
    console.log(`   总错误率: ${((totalErrors / totalTests) * 100).toFixed(2)}%`);

    if (totalMissed === 0 && totalErrors === 0) {
      console.log('\\n🎉 完美！没有漏检和错误，滑动窗口检测覆盖了所有样本！');
    } else if (totalMissed < totalTests * 0.01) {
      console.log('\\n✅ 优秀！漏检率低于1%，系统表现良好。');
    } else if (totalMissed < totalTests * 0.05) {
      console.log('\\n⚠️  良好，但需要优化。漏检率在1-5%之间。');
    } else {
      console.log('\\n❌ 需要改进！漏检率超过5%，可能存在系统性问题。');
    }
  }

  /**
   * 打印优化建议
   */
  printOptimizationSuggestions() {
    console.log('\\n💡 优化建议:');
    
    if (this.results.slidingWindow.missed > 0) {
      console.log('   • 考虑增加滑动窗口大小以捕获更长的工具调用');
      console.log('   • 优化重叠大小以提高跨块检测能力');
    }
    
    if (this.results.streaming.missed > this.results.nonStreaming.missed) {
      console.log('   • 流式检测需要特别关注，可能需要改进缓冲策略');
    }
    
    if (this.results.nonStreaming.falsePositives > 0 || this.results.streaming.falsePositives > 0) {
      console.log('   • 存在误检，需要提高检测模式的精确度');
    }
    
    if (this.results.performance.maxTime > 1000) {
      console.log('   • 某些测试耗时较长，考虑优化检测算法性能');
    }
    
    if (this.results.edgeCases.failed > 0) {
      console.log('   • 边界情况处理需要改进，增强鲁棒性');
    }
  }
}

// 运行测试
async function main() {
  const tester = new UnifiedToolCallStressTester();
  
  try {
    await tester.runFullStressTest();
    console.log('\\n✅ 统一工具调用检测压力测试完成！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { UnifiedToolCallStressTester, STRESS_TEST_CONFIG };