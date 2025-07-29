#!/usr/bin/env node

/**
 * CodeWhisperer非流式策略 vs 流式策略性能对比测试
 * Owner: Jason Zhang
 */

const axios = require('axios');

const ROUTER_URL = 'http://0.0.0.0:3456';
const TEST_REQUESTS = [
  {
    name: 'small-simple',
    description: '简单小请求，测试基础性能',
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: '你好，请简单介绍一下JavaScript' }
      ],
      max_tokens: 1000
    }
  },
  {
    name: 'medium-coding',
    description: '中等编程请求，测试代码生成性能', 
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: '请用JavaScript写一个简单的计算器类，包含加减乘除功能，并提供使用示例' }
      ],
      max_tokens: 2000
    }
  },
  {
    name: 'large-analysis',
    description: '大型分析请求，测试大响应处理',
    request: {
      model: 'claude-sonnet-4-20250514', 
      messages: [
        { role: 'user', content: '详细分析Node.js的事件循环机制，包括微任务、宏任务、阶段划分，并提供代码示例说明每个阶段的执行顺序' }
      ],
      max_tokens: 4000
    }
  },
  {
    name: 'tool-call',
    description: '工具调用请求，测试工具处理性能',
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: '搜索最新的JavaScript框架发展趋势' }
      ],
      tools: [
        {
          name: 'web_search',
          description: 'Search the web for information',
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      ],
      max_tokens: 2000
    }
  }
];

async function makeRequest(testCase, logPrefix) {
  const startTime = Date.now();
  
  try {
    console.log(`${logPrefix} 开始执行: ${testCase.name} - ${testCase.description}`);
    
    const response = await axios.post(`${ROUTER_URL}/v1/messages`, testCase.request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 60000
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const result = {
      testName: testCase.name,
      description: testCase.description,
      success: true,
      duration,
      responseSize: JSON.stringify(response.data).length,
      contentBlocks: response.data?.content?.length || 0,
      model: response.data?.model,
      usage: response.data?.usage
    };
    
    console.log(`${logPrefix} 完成: ${testCase.name}`);
    console.log(`  ⏱️  耗时: ${duration}ms`);
    console.log(`  📊 响应大小: ${result.responseSize} bytes`);
    console.log(`  🎯 内容块数量: ${result.contentBlocks}`);
    console.log(`  🔧 使用模型: ${result.model}`);
    console.log(`  📈 Token使用: ${JSON.stringify(result.usage)}`);
    
    return result;
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const result = {
      testName: testCase.name,
      description: testCase.description,
      success: false,
      duration,
      error: error.message,
      errorDetails: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      }
    };
    
    console.log(`${logPrefix} 失败: ${testCase.name}`);
    console.log(`  ❌ 错误: ${error.message}`);
    console.log(`  ⏱️  耗时: ${duration}ms`);
    
    return result;
  }
}

async function runPerformanceComparison() {
  console.log('🚀 CodeWhisperer非流式 vs 流式性能对比测试');
  console.log('=' * 60);
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };
  
  for (const testCase of TEST_REQUESTS) {
    console.log(`\\n📋 测试案例: ${testCase.name}`);
    console.log(`📝 描述: ${testCase.description}`);
    console.log('-' * 50);
    
    // 执行多轮测试以获得平均性能
    const rounds = 2;
    const testResults = [];
    
    for (let round = 1; round <= rounds; round++) {
      console.log(`\\n🔄 第 ${round} 轮测试:`);
      
      const result = await makeRequest(testCase, `[Round ${round}]`);
      testResults.push(result);
      
      // 间隔一点时间避免过度负载
      if (round < rounds) {
        console.log(`   ⏳ 等待 2 秒后继续下一轮...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 计算平均性能
    const successfulTests = testResults.filter(r => r.success);
    if (successfulTests.length > 0) {
      const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
      const avgResponseSize = successfulTests.reduce((sum, r) => sum + r.responseSize, 0) / successfulTests.length;
      
      const testSummary = {
        testName: testCase.name,
        description: testCase.description,
        rounds: rounds,
        successfulRounds: successfulTests.length,
        averageDuration: Math.round(avgDuration),
        averageResponseSize: Math.round(avgResponseSize),
        minDuration: Math.min(...successfulTests.map(r => r.duration)),
        maxDuration: Math.max(...successfulTests.map(r => r.duration)),
        model: successfulTests[0].model,
        detailedResults: testResults
      };
      
      results.tests.push(testSummary);
      
      console.log(`\\n📊 ${testCase.name} 测试总结:`);
      console.log(`  ✅ 成功轮数: ${successfulTests.length}/${rounds}`);
      console.log(`  ⏱️  平均耗时: ${testSummary.averageDuration}ms`);
      console.log(`  📏 耗时范围: ${testSummary.minDuration}ms - ${testSummary.maxDuration}ms`);
      console.log(`  📊 平均响应大小: ${testSummary.averageResponseSize} bytes`);
      console.log(`  🔧 使用模型: ${testSummary.model}`);
    } else {
      console.log(`\\n❌ ${testCase.name} 测试失败: 所有轮次都失败`);
      results.tests.push({
        testName: testCase.name,
        description: testCase.description,
        success: false,
        error: 'All rounds failed',
        detailedResults: testResults
      });
    }
    
    console.log('\\n' + '=' * 60);
  }
  
  // 保存详细结果
  const fs = require('fs');
  const resultsFile = `/tmp/non-streaming-performance-${Date.now()}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  
  console.log(`\\n🎯 性能测试完成!`);
  console.log(`📁 详细结果已保存到: ${resultsFile}`);
  
  // 生成性能报告
  generatePerformanceReport(results);
  
  return results;
}

function generatePerformanceReport(results) {
  console.log(`\\n📈 性能测试报告`);
  console.log(`🕐 测试时间: ${results.timestamp}`);
  console.log('=' * 60);
  
  const successfulTests = results.tests.filter(t => t.success !== false);
  
  if (successfulTests.length === 0) {
    console.log('❌ 所有测试都失败了，无法生成性能报告');
    return;
  }
  
  console.log('\\n🏆 测试结果概览:');
  successfulTests.forEach(test => {
    console.log(`  ${test.testName}: ${test.averageDuration}ms (${test.successfulRounds}/${test.rounds} 成功)`);
  });
  
  // 按性能排序
  const sortedByPerformance = [...successfulTests].sort((a, b) => a.averageDuration - b.averageDuration);
  
  console.log('\\n🚀 性能排名 (从快到慢):');
  sortedByPerformance.forEach((test, index) => {
    const rank = index + 1;
    const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '📊';
    console.log(`  ${emoji} ${rank}. ${test.testName}: ${test.averageDuration}ms`);
  });
  
  // 分析结果
  const avgPerformance = successfulTests.reduce((sum, t) => sum + t.averageDuration, 0) / successfulTests.length;
  console.log(`\\n📊 平均响应时间: ${Math.round(avgPerformance)}ms`);
  
  const fastest = sortedByPerformance[0];
  const slowest = sortedByPerformance[sortedByPerformance.length - 1];
  console.log(`⚡ 最快测试: ${fastest.testName} (${fastest.averageDuration}ms)`);
  console.log(`🐌 最慢测试: ${slowest.testName} (${slowest.averageDuration}ms)`);
  
  if (slowest.averageDuration > fastest.averageDuration) {
    const performanceGap = ((slowest.averageDuration - fastest.averageDuration) / fastest.averageDuration * 100).toFixed(1);
    console.log(`📈 性能差距: ${performanceGap}%`);
  }
  
  console.log('\\n💡 策略建议:');
  if (avgPerformance < 3000) {
    console.log('  ✅ 当前策略表现良好，平均响应时间在可接受范围内');
  } else if (avgPerformance < 5000) {
    console.log('  ⚠️  平均响应时间偏高，建议进一步优化');
  } else {
    console.log('  🚨 响应时间过长，需要紧急优化策略');
  }
  
  // 检查是否有工具调用的性能影响
  const toolTests = successfulTests.filter(t => t.testName.includes('tool'));
  const nonToolTests = successfulTests.filter(t => !t.testName.includes('tool'));
  
  if (toolTests.length > 0 && nonToolTests.length > 0) {
    const avgToolTime = toolTests.reduce((sum, t) => sum + t.averageDuration, 0) / toolTests.length;
    const avgNonToolTime = nonToolTests.reduce((sum, t) => sum + t.averageDuration, 0) / nonToolTests.length;
    
    console.log(`\\n🔧 工具调用性能分析:`);
    console.log(`  工具调用平均时间: ${Math.round(avgToolTime)}ms`);
    console.log(`  普通请求平均时间: ${Math.round(avgNonToolTime)}ms`);
    
    if (avgToolTime > avgNonToolTime * 1.5) {
      console.log(`  📈 工具调用比普通请求慢 ${((avgToolTime - avgNonToolTime) / avgNonToolTime * 100).toFixed(1)}%`);
      console.log(`  💡 建议: 工具调用场景优先使用缓冲策略`);
    }
  }
}

// 执行测试
if (require.main === module) {
  runPerformanceComparison()
    .then(() => {
      console.log('\\n✅ 测试完成，程序退出');
      process.exit(0);
    })
    .catch(error => {
      console.error('\\n❌ 测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runPerformanceComparison };