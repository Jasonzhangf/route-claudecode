#!/usr/bin/env node

/**
 * CodeWhisperer性能测试 - 专门测试非流式策略
 * Owner: Jason Zhang
 */

const axios = require('axios');

const ROUTER_URL = 'http://0.0.0.0:3456';

// 使用CodeWhisperer的模型，避免OpenAI 429错误
const TEST_REQUESTS = [
  {
    name: 'small-response',
    description: '小响应测试，应该使用非流式策略',
    request: {
      model: 'claude-sonnet-4-20250514', // 路由到CodeWhisperer
      messages: [
        { role: 'user', content: '简单介绍TypeScript' }
      ],
      max_tokens: 500
    }
  },
  {
    name: 'medium-response', 
    description: '中等响应测试，测试策略选择',
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: '用JavaScript写一个简单的Promise示例，包含异步处理' }
      ],
      max_tokens: 1500
    }
  },
  {
    name: 'tool-call-test',
    description: '工具调用测试，应该使用缓冲策略',
    request: {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: '搜索Node.js最新版本信息' }
      ],
      tools: [
        {
          name: 'search',
          description: 'Search for information',
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      ],
      max_tokens: 1000
    }
  }
];

async function runSingleTest(testCase) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 开始测试: ${testCase.name}`);
    console.log(`📝 描述: ${testCase.description}`);
    
    const response = await axios.post(`${ROUTER_URL}/v1/messages`, testCase.request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 60000
    });
    
    const duration = Date.now() - startTime;
    
    const result = {
      testName: testCase.name,
      success: true,
      duration,
      responseSize: JSON.stringify(response.data).length,
      contentBlocks: response.data?.content?.length || 0,
      model: response.data?.model,
      usage: response.data?.usage,
      hasContent: response.data?.content && response.data.content.length > 0
    };
    
    console.log(`✅ 测试完成: ${testCase.name}`);
    console.log(`  ⏱️  耗时: ${duration}ms`);
    console.log(`  📊 响应大小: ${result.responseSize} bytes`);
    console.log(`  🎯 内容块数: ${result.contentBlocks}`);
    console.log(`  🔧 模型: ${result.model}`);
    console.log(`  📈 Token: input=${result.usage?.input_tokens}, output=${result.usage?.output_tokens}`);
    console.log(`  📄 有内容: ${result.hasContent ? '是' : '否'}`);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.log(`❌ 测试失败: ${testCase.name}`);
    console.log(`  错误: ${error.message}`);
    console.log(`  耗时: ${duration}ms`);
    console.log(`  状态: ${error.response?.status}`);
    
    return {
      testName: testCase.name,
      success: false,
      duration,
      error: error.message,
      status: error.response?.status
    };
  }
}

async function runCodeWhispererPerformanceTest() {
  console.log('🚀 CodeWhisperer性能测试');
  console.log('测试非流式策略的实际性能表现');
  console.log('=' * 50);
  
  const results = [];
  
  for (const testCase of TEST_REQUESTS) {
    const result = await runSingleTest(testCase);
    results.push(result);
    
    console.log('\\n' + '-' * 50 + '\\n');
    
    // 等待一点时间避免过快请求
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 生成性能报告
  console.log('📊 性能测试报告');
  console.log('=' * 50);
  
  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);
  
  console.log(`\\n📈 测试概况:`);
  console.log(`  ✅ 成功: ${successfulTests.length}/${results.length}`);
  console.log(`  ❌ 失败: ${failedTests.length}/${results.length}`);
  
  if (successfulTests.length > 0) {
    console.log(`\\n⏱️  性能数据:`);
    
    successfulTests.forEach(test => {
      console.log(`  ${test.testName}: ${test.duration}ms`);
      console.log(`    - 响应大小: ${test.responseSize} bytes`);
      console.log(`    - 内容块: ${test.contentBlocks}`);
      console.log(`    - 有内容: ${test.hasContent ? '是' : '否'}`);
    });
    
    const avgDuration = successfulTests.reduce((sum, t) => sum + t.duration, 0) / successfulTests.length;
    const minDuration = Math.min(...successfulTests.map(t => t.duration));
    const maxDuration = Math.max(...successfulTests.map(t => t.duration));
    
    console.log(`\\n📊 统计数据:`);
    console.log(`  平均耗时: ${Math.round(avgDuration)}ms`);
    console.log(`  最快耗时: ${minDuration}ms`);
    console.log(`  最慢耗时: ${maxDuration}ms`);
    
    // 检查内容质量
    const testsWithContent = successfulTests.filter(t => t.hasContent);
    console.log(`\\n📄 内容质量:`);
    console.log(`  有内容的测试: ${testsWithContent.length}/${successfulTests.length}`);
    
    if (testsWithContent.length === 0) {
      console.log(`  ⚠️  警告: 所有测试都没有返回内容！`);
      console.log(`  💡 可能原因: 策略配置问题或provider错误`);
    } else {
      console.log(`  ✅ 内容返回正常`);
    }
  }
  
  if (failedTests.length > 0) {
    console.log(`\\n❌ 失败测试:`);
    failedTests.forEach(test => {
      console.log(`  ${test.testName}: ${test.error} (${test.status || 'N/A'})`);
    });
  }
  
  // 保存结果
  const fs = require('fs');
  const resultFile = `/tmp/codewhisperer-performance-${Date.now()}.json`;
  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: results
  }, null, 2));
  
  console.log(`\\n📁 详细结果已保存: ${resultFile}`);
  
  return results;
}

// 执行测试
if (require.main === module) {
  runCodeWhispererPerformanceTest()
    .then(() => {
      console.log('\\n✅ 测试完成，程序退出');
      process.exit(0);
    })
    .catch(error => {
      console.error('\\n❌ 测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runCodeWhispererPerformanceTest };