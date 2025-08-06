/**
 * 优化的工具调用检测压力测试 - 目标100%检测率
 * 确保滑动窗口检测覆盖所有OpenAI兼容输入，流式和非流式响应
 * 零漏检目标测试
 */

const { OptimizedToolCallDetector } = require('./dist/utils/optimized-tool-call-detector');

// 优化的测试配置
const OPTIMIZED_TEST_CONFIG = {
  // 滑动窗口测试参数
  windowSizes: [200, 500, 1000],
  chunkSizes: [1, 5, 10, 50, 100],
  // 测试强度
  iterations: 20, // 减少迭代次数，专注于质量
  // 全面的工具调用测试样本
  toolCallSamples: [
    // === 第一组：标准格式 ===
    {
      name: 'Anthropic标准格式',
      content: '我需要执行一个任务：{"type": "tool_use", "id": "toolu_123", "name": "TodoWrite", "input": {"task": "完成项目文档"}}',
      shouldDetect: true,
      expectedConfidence: 0.9
    },
    {
      name: '文本工具调用格式',
      content: 'Tool call: SearchWeb({"query": "Claude API documentation", "max_results": 5})',
      shouldDetect: true,
      expectedConfidence: 0.8
    },
    {
      name: 'OpenAI工具调用格式',
      content: '{"tool_calls": [{"function": {"name": "get_weather", "arguments": "{\\"location\\": \\"Beijing\\"}"}}]}',
      shouldDetect: true,
      expectedConfidence: 0.8
    },
    
    // === 第二组：中文格式 - 重点测试 ===
    {
      name: '中文工具调用',
      content: '工具调用: 文档生成({"标题": "API文档", "内容": "详细说明"})',
      shouldDetect: true,
      expectedConfidence: 0.8
    },
    {
      name: '纯中文工具名',
      content: '工具调用: 搜索引擎({"查询": "人工智能", "结果数量": 10})',
      shouldDetect: true,
      expectedConfidence: 0.8
    },
    {
      name: '中文函数调用',
      content: '创建文件({"文件路径": "/tmp/测试.txt", "内容": "你好世界"})',
      shouldDetect: true,
      expectedConfidence: 0.7
    },
    {
      name: '混合中英文',
      content: '工具调用: CreateTask({"任务": "完成测试", "priority": "high"})',
      shouldDetect: true,
      expectedConfidence: 0.8
    },
    
    // === 第三组：复杂格式 ===
    {
      name: '嵌套JSON工具调用',
      content: '{"name": "ComplexTool", "input": {"nested": {"deep": {"value": "test"}}, "array": [1, 2, 3]}}',
      shouldDetect: true,
      expectedConfidence: 0.6
    },
    {
      name: '长参数工具调用',
      content: `Tool call: ProcessLongText({"text": "${'x'.repeat(500)}", "operation": "analyze"})`,
      shouldDetect: true,
      expectedConfidence: 0.8
    },
    {
      name: '多个工具调用',
      content: 'First: {"type": "tool_use", "id": "1", "name": "A", "input": {}} Second: Tool call: B({"param": "value"})',
      shouldDetect: true,
      expectedConfidence: 0.9
    },
    
    // === 第四组：边界情况 ===
    {
      name: '跨chunk分割的工具调用',
      chunks: ['{"type": "tool_', 'use", "id": "toolu_456", ', '"name": "TestTool", "input": {"param": "value"}}'],
      shouldDetect: true,
      expectedConfidence: 0.6
    },
    {
      name: '截断的中文工具调用',
      chunks: ['工具调用: 测试工', '具({"参数": "值"})'],
      shouldDetect: true,
      expectedConfidence: 0.6
    },
    {
      name: '部分JSON',
      chunks: ['{"name": "Test', 'Tool", "input": {"key": "value"}}'],
      shouldDetect: true,
      expectedConfidence: 0.6
    },
    
    // === 第五组：应该被拒绝的内容 ===
    {
      name: '普通文本',
      content: 'This is just normal text without any tool calls or function references.',
      shouldDetect: false,
      expectedConfidence: 0
    },
    {
      name: '普通JSON',
      content: '{"name": "John", "age": 30, "city": "New York"}',
      shouldDetect: false,
      expectedConfidence: 0
    },
    {
      name: '数学表达式',
      content: 'The function f(x) = x^2 + 2x + 1 is a quadratic function.',
      shouldDetect: false, // 这个可能会被误检，我们需要优化
      expectedConfidence: 0
    }
  ]
};

class OptimizedToolCallDetectionTester {
  constructor() {
    this.detector = new OptimizedToolCallDetector(500);
    this.results = {
      total: 0,
      detected: 0,
      missed: 0,
      falsePositives: 0,
      correctRejections: 0,
      slidingWindow: {
        total: 0,
        detected: 0,
        missed: 0
      },
      streaming: {
        total: 0,
        detected: 0,
        missed: 0
      },
      detailResults: []
    };
  }

  /**
   * 运行优化的压力测试
   */
  async runOptimizedStressTest() {
    console.log('🚀 开始优化的工具调用检测压力测试 - 目标100%检测率...\n');
    
    const totalTests = this.calculateTotalTests();
    console.log(`📊 总测试数: ${totalTests}`);
    console.log(`🔄 测试样本: ${OPTIMIZED_TEST_CONFIG.toolCallSamples.length} 个`);
    console.log(`📏 窗口大小: ${OPTIMIZED_TEST_CONFIG.windowSizes.join(', ')}`);
    console.log(`📦 块大小: ${OPTIMIZED_TEST_CONFIG.chunkSizes.join(', ')}`);
    console.log(`🔁 迭代次数: ${OPTIMIZED_TEST_CONFIG.iterations}\n`);

    let testCount = 0;

    // 1. 基础检测测试 - 详细分析
    console.log('🧪 1. 基础检测测试（详细分析）...');
    for (const sample of OPTIMIZED_TEST_CONFIG.toolCallSamples) {
      console.log(`   测试样本: ${sample.name}`);
      
      let sampleResults = {
        name: sample.name,
        shouldDetect: sample.shouldDetect,
        results: []
      };
      
      for (let i = 0; i < OPTIMIZED_TEST_CONFIG.iterations; i++) {
        const result = await this.testBasicDetectionDetailed(sample);
        sampleResults.results.push(result);
        testCount++;
      }
      
      this.results.detailResults.push(sampleResults);
      this.analyzeSampleResults(sampleResults);
    }

    // 2. 滑动窗口测试
    console.log('\n🪟 2. 滑动窗口测试...');
    for (const sample of OPTIMIZED_TEST_CONFIG.toolCallSamples) {
      if (sample.chunks) continue; // 跳过已经分块的样本
      
      for (const windowSize of OPTIMIZED_TEST_CONFIG.windowSizes) {
        for (const chunkSize of OPTIMIZED_TEST_CONFIG.chunkSizes) {
          for (let i = 0; i < Math.floor(OPTIMIZED_TEST_CONFIG.iterations / 2); i++) {
            await this.testSlidingWindowOptimized(sample, windowSize, chunkSize);
            testCount++;
          }
        }
      }
    }

    // 3. 流式检测测试
    console.log('\n🌊 3. 流式检测测试...');
    for (const sample of OPTIMIZED_TEST_CONFIG.toolCallSamples) {
      for (const chunkSize of OPTIMIZED_TEST_CONFIG.chunkSizes) {
        for (let i = 0; i < Math.floor(OPTIMIZED_TEST_CONFIG.iterations / 2); i++) {
          await this.testStreamingDetectionOptimized(sample, chunkSize);
          testCount++;
        }
      }
    }

    // 4. 边界情况测试
    console.log('\n🔍 4. 边界情况测试...');
    await this.testEdgeCasesOptimized();

    // 5. 打印详细结果
    this.printOptimizedResults();
  }

  /**
   * 计算总测试数
   */
  calculateTotalTests() {
    const basicTests = OPTIMIZED_TEST_CONFIG.toolCallSamples.length * OPTIMIZED_TEST_CONFIG.iterations;
    const slidingWindowTests = OPTIMIZED_TEST_CONFIG.toolCallSamples.filter(s => !s.chunks).length * 
                              OPTIMIZED_TEST_CONFIG.windowSizes.length * 
                              OPTIMIZED_TEST_CONFIG.chunkSizes.length * 
                              Math.floor(OPTIMIZED_TEST_CONFIG.iterations / 2);
    const streamingTests = OPTIMIZED_TEST_CONFIG.toolCallSamples.length * 
                          OPTIMIZED_TEST_CONFIG.chunkSizes.length * 
                          Math.floor(OPTIMIZED_TEST_CONFIG.iterations / 2);
    
    return basicTests + slidingWindowTests + streamingTests;
  }

  /**
   * 详细的基础检测测试
   */
  async testBasicDetectionDetailed(sample) {
    const requestId = `basic-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    // 构造测试请求
    const testRequest = {
      messages: [
        {
          role: 'user',
          content: sample.content || this.combineChunks(sample.chunks)
        }
      ],
      model: 'test-model'
    };

    try {
      const result = this.detector.detectInRequest(testRequest, requestId);
      
      this.results.total++;
      
      const testResult = {
        hasToolCalls: result.hasToolCalls,
        confidence: result.confidence,
        detectedPatterns: result.detectedPatterns,
        detectionMethod: result.detectionMethod,
        extractedCount: result.extractedToolCalls?.length || 0
      };
      
      if (result.hasToolCalls && sample.shouldDetect) {
        this.results.detected++;
        testResult.status = 'correct_detection';
      } else if (!result.hasToolCalls && !sample.shouldDetect) {
        this.results.correctRejections++;
        testResult.status = 'correct_rejection';
      } else if (!result.hasToolCalls && sample.shouldDetect) {
        this.results.missed++;
        testResult.status = 'missed';
        console.log(`     ❌ 漏检: 置信度=${result.confidence}, 模式=${result.detectedPatterns.join(',')}`);
      } else if (result.hasToolCalls && !sample.shouldDetect) {
        this.results.falsePositives++;
        testResult.status = 'false_positive';
        console.log(`     ⚠️  误检: 置信度=${result.confidence}, 模式=${result.detectedPatterns.join(',')}`);
      }
      
      return testResult;
      
    } catch (error) {
      console.log(`     ❌ 测试错误: ${error.message}`);
      this.results.total++;
      this.results.missed++;
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * 分析样本结果
   */
  analyzeSampleResults(sampleResults) {
    const total = sampleResults.results.length;
    const correct = sampleResults.results.filter(r => 
      r.status === 'correct_detection' || r.status === 'correct_rejection'
    ).length;
    const missed = sampleResults.results.filter(r => r.status === 'missed').length;
    const falsePositive = sampleResults.results.filter(r => r.status === 'false_positive').length;
    
    const accuracy = (correct / total * 100).toFixed(1);
    
    if (missed > 0 || falsePositive > 0) {
      console.log(`     ⚠️  准确率: ${accuracy}% (漏检: ${missed}, 误检: ${falsePositive})`);
    } else {
      console.log(`     ✅ 准确率: ${accuracy}% (完美)`);
    }
  }

  /**
   * 优化的滑动窗口测试
   */
  async testSlidingWindowOptimized(sample, windowSize, chunkSize) {
    if (!sample.content) return;
    
    const requestId = `sliding-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    // 创建自定义检测器
    const customDetector = new OptimizedToolCallDetector(windowSize);
    
    // 将内容分块
    const chunks = this.createChunks(sample.content, chunkSize);
    
    // 模拟滑动窗口处理
    let windowState = customDetector.createSlidingWindowState();
    let detected = false;
    let maxConfidence = 0;
    
    for (const chunk of chunks) {
      const result = customDetector.updateSlidingWindow(chunk, windowState);
      windowState = result.newState;
      
      if (result.detectionResult.hasToolCalls) {
        detected = true;
        maxConfidence = Math.max(maxConfidence, result.detectionResult.confidence);
      }
    }
    
    this.results.slidingWindow.total++;
    
    if (detected && sample.shouldDetect) {
      this.results.slidingWindow.detected++;
    } else if (!detected && sample.shouldDetect) {
      this.results.slidingWindow.missed++;
      console.log(`     ❌ 滑动窗口漏检: ${sample.name} (窗口: ${windowSize}, 块: ${chunkSize}, 置信度: ${maxConfidence})`);
    }
  }

  /**
   * 优化的流式检测测试
   */
  async testStreamingDetectionOptimized(sample, chunkSize) {
    const content = sample.content || this.combineChunks(sample.chunks);
    if (!content) return;
    
    const requestId = `streaming-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
    
    // 创建流式块
    const chunks = this.createChunks(content, chunkSize);
    
    // 模拟流式处理
    let windowState = this.detector.createSlidingWindowState();
    let detected = false;
    let maxConfidence = 0;
    
    for (const chunk of chunks) {
      const result = this.detector.updateSlidingWindow(chunk, windowState);
      windowState = result.newState;
      
      if (result.detectionResult.hasToolCalls) {
        detected = true;
        maxConfidence = Math.max(maxConfidence, result.detectionResult.confidence);
      }
    }
    
    this.results.streaming.total++;
    
    if (detected && sample.shouldDetect) {
      this.results.streaming.detected++;
    } else if (!detected && sample.shouldDetect) {
      this.results.streaming.missed++;
      console.log(`     ❌ 流式检测漏检: ${sample.name} (块大小: ${chunkSize}, 置信度: ${maxConfidence})`);
    }
  }

  /**
   * 优化的边界情况测试
   */
  async testEdgeCasesOptimized() {
    console.log('   测试边界情况...');
    
    const edgeCases = [
      {
        name: '空内容',
        request: { messages: [{ role: 'user', content: '' }] },
        shouldDetect: false
      },
      {
        name: '只有空格',
        request: { messages: [{ role: 'user', content: '   \n\t  ' }] },
        shouldDetect: false
      },
      {
        name: '非常长的普通文本',
        request: { messages: [{ role: 'user', content: 'This is a very long text without any tool calls. '.repeat(100) }] },
        shouldDetect: false
      },
      {
        name: '混合内容数组',
        request: { 
          messages: [{ 
            role: 'user', 
            content: [
              { type: 'text', text: 'Normal text' },
              { type: 'text', text: 'Tool call: TestTool({"param": "value"})' }
            ]
          }] 
        },
        shouldDetect: true
      },
      {
        name: '已有tool_use块',
        request: { 
          messages: [{ 
            role: 'assistant', 
            content: [
              { type: 'text', text: 'I will help you' },
              { type: 'tool_use', id: 'test', name: 'TestTool', input: { param: 'value' } }
            ]
          }] 
        },
        shouldDetect: true
      },
      {
        name: '显式工具定义',
        request: {
          messages: [{ role: 'user', content: 'Help me with this task' }],
          tools: [{ name: 'TestTool', description: 'A test tool', input_schema: { type: 'object' } }]
        },
        shouldDetect: true
      }
    ];

    for (const testCase of edgeCases) {
      const requestId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
      
      try {
        const result = this.detector.detectInRequest(testCase.request, requestId);
        
        if (result.hasToolCalls === testCase.shouldDetect) {
          console.log(`     ✅ ${testCase.name} (置信度: ${result.confidence})`);
        } else {
          console.log(`     ❌ ${testCase.name} (期望: ${testCase.shouldDetect}, 实际: ${result.hasToolCalls}, 置信度: ${result.confidence})`);
        }
      } catch (error) {
        console.log(`     ❌ ${testCase.name} - 错误: ${error.message}`);
      }
    }
  }

  /**
   * 创建文本块
   */
  createChunks(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 合并块
   */
  combineChunks(chunks) {
    return chunks ? chunks.join('') : '';
  }

  /**
   * 打印优化的测试结果
   */
  printOptimizedResults() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 优化的工具调用检测压力测试结果 - 目标100%检测率');
    console.log('='.repeat(80));

    // 基础检测结果
    console.log('\n🔍 基础检测结果:');
    console.log(`   总测试数: ${this.results.total}`);
    console.log(`   检测成功: ${this.results.detected}`);
    console.log(`   正确拒绝: ${this.results.correctRejections}`);
    console.log(`   漏检: ${this.results.missed}`);
    console.log(`   误检: ${this.results.falsePositives}`);
    
    const accuracy = ((this.results.detected + this.results.correctRejections) / this.results.total * 100).toFixed(2);
    const precision = this.results.detected / (this.results.detected + this.results.falsePositives) * 100;
    const recall = this.results.detected / (this.results.detected + this.results.missed) * 100;
    
    console.log(`   准确率: ${accuracy}%`);
    console.log(`   精确率: ${precision.toFixed(2)}%`);
    console.log(`   召回率: ${recall.toFixed(2)}%`);

    // 详细样本分析
    console.log('\n📋 详细样本分析:');
    for (const sampleResult of this.results.detailResults) {
      const total = sampleResult.results.length;
      const correct = sampleResult.results.filter(r => 
        r.status === 'correct_detection' || r.status === 'correct_rejection'
      ).length;
      const missed = sampleResult.results.filter(r => r.status === 'missed').length;
      const falsePositive = sampleResult.results.filter(r => r.status === 'false_positive').length;
      
      const sampleAccuracy = (correct / total * 100).toFixed(1);
      const status = missed === 0 && falsePositive === 0 ? '✅' : '❌';
      
      console.log(`   ${status} ${sampleResult.name}: ${sampleAccuracy}% (漏检: ${missed}, 误检: ${falsePositive})`);
    }

    // 滑动窗口结果
    console.log('\n🪟 滑动窗口检测结果:');
    console.log(`   总测试数: ${this.results.slidingWindow.total}`);
    console.log(`   检测成功: ${this.results.slidingWindow.detected}`);
    console.log(`   漏检: ${this.results.slidingWindow.missed}`);
    
    if (this.results.slidingWindow.total > 0) {
      const windowAccuracy = (this.results.slidingWindow.detected / this.results.slidingWindow.total * 100).toFixed(2);
      console.log(`   检测率: ${windowAccuracy}%`);
    }

    // 流式检测结果
    console.log('\n🌊 流式检测结果:');
    console.log(`   总测试数: ${this.results.streaming.total}`);
    console.log(`   检测成功: ${this.results.streaming.detected}`);
    console.log(`   漏检: ${this.results.streaming.missed}`);
    
    if (this.results.streaming.total > 0) {
      const streamingAccuracy = (this.results.streaming.detected / this.results.streaming.total * 100).toFixed(2);
      console.log(`   检测率: ${streamingAccuracy}%`);
    }

    // 总体评估
    const totalMissed = this.results.missed + this.results.slidingWindow.missed + this.results.streaming.missed;
    const totalTests = this.results.total + this.results.slidingWindow.total + this.results.streaming.total;
    
    console.log('\n🎯 总体评估:');
    console.log(`   总漏检数: ${totalMissed}`);
    console.log(`   总测试数: ${totalTests}`);
    console.log(`   总漏检率: ${(totalMissed / totalTests * 100).toFixed(2)}%`);
    console.log(`   总误检数: ${this.results.falsePositives}`);

    // 成功评估
    if (totalMissed === 0 && this.results.falsePositives === 0) {
      console.log('\n🎉 完美！达到100%检测率，零漏检，零误检！');
    } else if (totalMissed === 0) {
      console.log('\n🎉 优秀！达到100%召回率，零漏检！');
      console.log(`⚠️  但存在 ${this.results.falsePositives} 个误检，需要提高精确度。`);
    } else if (totalMissed < totalTests * 0.01) {
      console.log('\n✅ 非常好！漏检率低于1%，接近目标。');
    } else if (totalMissed < totalTests * 0.05) {
      console.log('\n⚠️  良好，但需要进一步优化。漏检率在1-5%之间。');
    } else {
      console.log('\n❌ 需要继续改进！漏检率超过5%。');
    }

    // 优化建议
    console.log('\n💡 优化建议:');
    if (totalMissed === 0 && this.results.falsePositives === 0) {
      console.log('   • 系统表现完美，已达到100%检测率目标！');
    } else {
      if (this.results.missed > 0) {
        console.log('   • 基础检测存在漏检，需要增加更多检测模式或降低阈值');
      }
      if (this.results.slidingWindow.missed > 0) {
        console.log('   • 滑动窗口检测需要优化，考虑增加窗口重叠或调整窗口大小');
      }
      if (this.results.streaming.missed > 0) {
        console.log('   • 流式检测需要改进，可能需要更好的缓冲策略');
      }
      if (this.results.falsePositives > 0) {
        console.log('   • 存在误检，需要提高检测模式的精确度，增加排除规则');
      }
    }
  }
}

// 运行优化测试
async function main() {
  const tester = new OptimizedToolCallDetectionTester();
  
  try {
    await tester.runOptimizedStressTest();
    console.log('\n✅ 优化的工具调用检测压力测试完成！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

main().catch(console.error);