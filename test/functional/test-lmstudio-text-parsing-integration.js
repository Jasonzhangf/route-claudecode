#!/usr/bin/env node

/**
 * LM Studio 文本解析集成测试
 * 验证文本中的工具调用解析和缓冲处理功能
 * 
 * @author Jason Zhang
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testLMStudioTextParsing() {
  console.log('🧪 LM Studio 文本解析集成测试开始...');
  
  const testId = `lmstudio-text-parsing-${Date.now()}`;
  const outputFile = `/tmp/test-lmstudio-text-parsing-${testId}.log`;
  
  const testResults = {
    testId,
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };
  
  try {
    // 动态导入 ES 模块 (从compiled dist导入)
    const { LMStudioBufferedProcessor } = await import('../../dist/v3/provider/openai-compatible/lmstudio-buffered-processor.js');
    const { ResponsePipeline } = await import('../../dist/v3/pipeline/response-pipeline.js');
    
    console.log('✅ 成功导入 LM Studio 处理器和响应流水线');
    
    const processor = new LMStudioBufferedProcessor();
    const pipeline = new ResponsePipeline();
    
    // 测试 1: 基本文本中的工具调用提取
    console.log('\n📋 测试 1: 基本文本中的工具调用提取');
    const test1Result = await testBasicToolCallExtraction(processor);
    testResults.tests.push(test1Result);
    testResults.summary.total++;
    if (test1Result.passed) testResults.summary.passed++;
    else testResults.summary.failed++;
    
    // 测试 2: 复杂文本解析
    console.log('\n📋 测试 2: 复杂文本解析（多工具调用）');
    const test2Result = await testComplexTextParsing(processor);
    testResults.tests.push(test2Result);
    testResults.summary.total++;
    if (test2Result.passed) testResults.summary.passed++;
    else testResults.summary.failed++;
    
    // 测试 3: 响应流水线集成
    console.log('\n📋 测试 3: 响应流水线集成测试');
    const test3Result = await testPipelineIntegration(pipeline);
    testResults.tests.push(test3Result);
    testResults.summary.total++;
    if (test3Result.passed) testResults.summary.passed++;
    else testResults.summary.failed++;
    
    // 测试 4: 边缘情况处理
    console.log('\n📋 测试 4: 边缘情况处理');
    const test4Result = await testEdgeCases(processor);
    testResults.tests.push(test4Result);
    testResults.summary.total++;
    if (test4Result.passed) testResults.summary.passed++;
    else testResults.summary.failed++;
    
    // 测试 5: 性能基准测试
    console.log('\n📋 测试 5: 性能基准测试');
    const test5Result = await testPerformanceBenchmark(processor);
    testResults.tests.push(test5Result);
    testResults.summary.total++;
    if (test5Result.passed) testResults.summary.passed++;
    else testResults.summary.failed++;
    
    // 输出测试结果
    console.log('\n🎯 测试结果汇总:');
    console.log(`   总测试数: ${testResults.summary.total}`);
    console.log(`   通过: ${testResults.summary.passed}`);
    console.log(`   失败: ${testResults.summary.failed}`);
    console.log(`   成功率: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%`);
    
    // 保存详细测试结果
    const logContent = JSON.stringify(testResults, null, 2);
    fs.writeFileSync(outputFile, logContent);
    console.log(`\n📄 详细测试结果已保存到: ${outputFile}`);
    
    if (testResults.summary.failed === 0) {
      console.log('\n✅ 所有测试通过！LM Studio 文本解析功能工作正常');
      process.exit(0);
    } else {
      console.log('\n❌ 部分测试失败，请检查详细日志');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ 测试运行失败:', error.message);
    if (error.stack) {
      console.error('   Stack trace:', error.stack);
    }
    
    testResults.tests.push({
      name: 'Test Infrastructure',
      passed: false,
      error: error.message,
      details: { stack: error.stack }
    });
    
    const logContent = JSON.stringify(testResults, null, 2);
    fs.writeFileSync(outputFile, logContent);
    console.log(`\n📄 错误日志已保存到: ${outputFile}`);
    
    process.exit(1);
  }
}

/**
 * 测试基本工具调用提取
 */
async function testBasicToolCallExtraction(processor) {
  const testName = '基本工具调用提取';
  console.log(`   🔍 执行: ${testName}`);
  
  try {
    // 模拟 LM Studio 响应文本
    const mockResponse = {
      data: 'Here is the response:\n\nTool call: Bash({"command": "ls -la"})\n\nThe command will list files.',
      events: null
    };
    
    const result = await processor.process(mockResponse, {
      requestId: 'test-basic-001',
      layer: 'transformer',
      processingTime: 0
    });
    
    // 验证结果
    const hasEvents = result.events && Array.isArray(result.events);
    const hasToolUseEvent = hasEvents && result.events.some(event => 
      event.event === 'content_block_start' && 
      event.data?.content_block?.type === 'tool_use' &&
      event.data?.content_block?.name === 'Bash'
    );
    
    if (!hasEvents) {
      throw new Error('响应中没有生成 events 数组');
    }
    
    if (!hasToolUseEvent) {
      throw new Error('没有检测到工具调用事件');
    }
    
    console.log(`   ✅ ${testName} - 通过`);
    return {
      name: testName,
      passed: true,
      details: {
        eventsGenerated: result.events.length,
        toolCallsExtracted: result.events.filter(e => e.event === 'content_block_start' && e.data?.content_block?.type === 'tool_use').length
      }
    };
    
  } catch (error) {
    console.log(`   ❌ ${testName} - 失败: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      details: { stack: error.stack }
    };
  }
}

/**
 * 测试复杂文本解析
 */
async function testComplexTextParsing(processor) {
  const testName = '复杂文本解析';
  console.log(`   🔍 执行: ${testName}`);
  
  try {
    // 模拟包含多个工具调用的复杂响应
    const mockResponse = {
      data: `I'll help you check the system status:

⏺ Tool call: Bash({"command": "ps aux | grep nginx"})

After checking the process, let me also check the disk space:

Tool call: Bash({"command": "df -h"})

Finally, let's check the network connections:

Tool call: Read({"file_path": "/var/log/nginx/access.log", "limit": 10})

These commands will give us a comprehensive view of the system.`,
      events: null
    };
    
    const result = await processor.process(mockResponse, {
      requestId: 'test-complex-001',
      layer: 'transformer',
      processingTime: 0
    });
    
    // 验证结果
    const toolUseEvents = result.events ? result.events.filter(event => 
      event.event === 'content_block_start' && 
      event.data?.content_block?.type === 'tool_use'
    ) : [];
    
    if (toolUseEvents.length !== 3) {
      throw new Error(`期望检测到3个工具调用，实际检测到${toolUseEvents.length}个`);
    }
    
    // 验证工具名称
    const toolNames = toolUseEvents.map(event => event.data.content_block.name);
    const expectedTools = ['Bash', 'Bash', 'Read'];
    
    for (let i = 0; i < expectedTools.length; i++) {
      if (toolNames[i] !== expectedTools[i]) {
        throw new Error(`工具 ${i+1} 期望为 ${expectedTools[i]}，实际为 ${toolNames[i]}`);
      }
    }
    
    console.log(`   ✅ ${testName} - 通过`);
    return {
      name: testName,
      passed: true,
      details: {
        eventsGenerated: result.events.length,
        toolCallsExtracted: toolUseEvents.length,
        toolNames: toolNames
      }
    };
    
  } catch (error) {
    console.log(`   ❌ ${testName} - 失败: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      details: { stack: error.stack }
    };
  }
}

/**
 * 测试响应流水线集成
 */
async function testPipelineIntegration(pipeline) {
  const testName = '响应流水线集成';
  console.log(`   🔍 执行: ${testName}`);
  
  try {
    // 模拟 LM Studio 响应
    const mockResponse = {
      data: 'Let me help you run this command:\n\nTool call: Bash({"command": "echo Hello World"})\n\nThis will output Hello World.',
      events: null
    };
    
    const context = {
      requestId: 'test-pipeline-001',
      provider: 'lmstudio-openai-5506',
      model: 'qwen3-30b',
      isStreaming: false,
      timestamp: Date.now()
    };
    
    const result = await pipeline.process(mockResponse, context);
    
    // 验证流水线处理结果
    if (!result.events || !Array.isArray(result.events)) {
      throw new Error('流水线没有生成 events 数组');
    }
    
    const hasToolEvent = result.events.some(event => 
      event.event === 'content_block_start' && 
      event.data?.content_block?.type === 'tool_use' &&
      event.data?.content_block?.name === 'Bash'
    );
    
    if (!hasToolEvent) {
      throw new Error('流水线处理后没有检测到工具调用事件');
    }
    
    console.log(`   ✅ ${testName} - 通过`);
    return {
      name: testName,
      passed: true,
      details: {
        pipelineApplied: true,
        eventsGenerated: result.events.length,
        providerDetected: 'lmstudio'
      }
    };
    
  } catch (error) {
    console.log(`   ❌ ${testName} - 失败: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      details: { stack: error.stack }
    };
  }
}

/**
 * 测试边缘情况处理
 */
async function testEdgeCases(processor) {
  const testName = '边缘情况处理';
  console.log(`   🔍 执行: ${testName}`);
  
  try {
    // 测试用例数组
    const testCases = [
      {
        name: '空响应',
        data: { data: '', events: null },
        expectEvents: false
      },
      {
        name: '非工具调用文本',
        data: { data: 'This is just regular text without any tool calls.', events: null },
        expectEvents: false
      },
      {
        name: '格式错误的工具调用',
        data: { data: 'Tool call: InvalidTool(invalid json)', events: null },
        expectEvents: true // 应该尝试处理即使JSON无效
      },
      {
        name: '嵌套工具调用',
        data: { data: 'Tool call: Edit({"file_path": "/test", "content": "Tool call: Nested()"})', events: null },
        expectEvents: true
      }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      try {
        const result = await processor.process(testCase.data, {
          requestId: `edge-case-${testCase.name.replace(/\s+/g, '-').toLowerCase()}`,
          layer: 'transformer',
          processingTime: 0
        });
        
        const hasEvents = result.events && Array.isArray(result.events) && result.events.length > 0;
        const passed = hasEvents === testCase.expectEvents;
        
        results.push({
          name: testCase.name,
          passed,
          hasEvents,
          expected: testCase.expectEvents
        });
        
      } catch (error) {
        results.push({
          name: testCase.name,
          passed: false,
          error: error.message
        });
      }
    }
    
    const allPassed = results.every(r => r.passed);
    
    if (allPassed) {
      console.log(`   ✅ ${testName} - 通过`);
    } else {
      console.log(`   ❌ ${testName} - 部分失败`);
    }
    
    return {
      name: testName,
      passed: allPassed,
      details: {
        testCases: results,
        passedCount: results.filter(r => r.passed).length,
        totalCount: results.length
      }
    };
    
  } catch (error) {
    console.log(`   ❌ ${testName} - 失败: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      details: { stack: error.stack }
    };
  }
}

/**
 * 测试性能基准
 */
async function testPerformanceBenchmark(processor) {
  const testName = '性能基准测试';
  console.log(`   🔍 执行: ${testName}`);
  
  try {
    // 大量工具调用文本
    const largeText = Array.from({ length: 100 }, (_, i) => 
      `Tool call: Bash({"command": "echo test ${i}"})`
    ).join('\n\n');
    
    const mockResponse = {
      data: `Processing large batch of commands:\n\n${largeText}\n\nAll commands completed.`,
      events: null
    };
    
    // 性能测试
    const iterations = 10;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      
      await processor.process(mockResponse, {
        requestId: `perf-test-${i}`,
        layer: 'transformer',
        processingTime: 0
      });
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
      times.push(duration);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    // 性能要求：平均处理时间应该小于 100ms
    const performanceTarget = 100; // ms
    const passed = avgTime < performanceTarget;
    
    if (passed) {
      console.log(`   ✅ ${testName} - 通过 (平均 ${avgTime.toFixed(2)}ms)`);
    } else {
      console.log(`   ❌ ${testName} - 失败 (平均 ${avgTime.toFixed(2)}ms, 超过目标 ${performanceTarget}ms)`);
    }
    
    return {
      name: testName,
      passed,
      details: {
        iterations,
        avgTime: Math.round(avgTime * 100) / 100,
        maxTime: Math.round(maxTime * 100) / 100,
        minTime: Math.round(minTime * 100) / 100,
        performanceTarget,
        toolCallsProcessed: 100
      }
    };
    
  } catch (error) {
    console.log(`   ❌ ${testName} - 失败: ${error.message}`);
    return {
      name: testName,
      passed: false,
      error: error.message,
      details: { stack: error.stack }
    };
  }
}

// 运行测试
if (import.meta.url === `file://${__filename}`) {
  testLMStudioTextParsing();
}

export { testLMStudioTextParsing };