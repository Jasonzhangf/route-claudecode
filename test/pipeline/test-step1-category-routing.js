#!/usr/bin/env node

/**
 * Step 1: 类别路由测试 - 新架构版
 * 测试路由引擎的类别判断逻辑
 */

const { RoutingEngine } = require('../../dist/routing/engine.js');
const fs = require('fs');

// 测试配置 - 与config.json一致
const testConfig = {
  default: {
    provider: 'codewhisperer-primary',
    model: 'CLAUDE_SONNET_4_20250514_V1_0'
  },
  background: {
    provider: 'shuaihong-openai',
    model: 'gemini-2.5-flash'
  },
  thinking: {
    provider: 'codewhisperer-primary',
    model: 'CLAUDE_SONNET_4_20250514_V1_0'
  },
  longcontext: {
    provider: 'shuaihong-openai',
    model: 'gemini-2.5-pro'
  },
  search: {
    provider: 'shuaihong-openai',
    model: 'gemini-2.5-flash'
  }
};

async function testCategoryRouting() {
  console.log('🧪 Step 1: 类别路由测试 (新架构)');
  console.log('========================');
  
  const results = {
    timestamp: new Date().toISOString(),
    test: 'step1-category-routing',
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      passRate: 0
    },
    results: []
  };

  // 初始化路由引擎
  const routingEngine = new RoutingEngine(testConfig);

  // 测试用例
  const testCases = [
    {
      name: 'Default Category (Claude 4)',
      request: {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: '普通对话测试' }],
        max_tokens: 100
      },
      expected: {
        category: 'default', 
        provider: 'codewhisperer-primary',
        targetModel: 'CLAUDE_SONNET_4_20250514_V1_0'
      }
    },
    {
      name: 'Background Category (Haiku Model)',
      request: {
        model: 'claude-3-5-haiku-20241022',
        messages: [{ role: 'user', content: '简单任务' }],
        max_tokens: 100
      },
      expected: {
        category: 'background',
        provider: 'shuaihong-openai', 
        targetModel: 'gemini-2.5-flash'
      }
    },
    {
      name: 'Thinking Category (Explicit)',
      request: {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: '复杂分析任务' }],
        max_tokens: 100,
        metadata: { thinking: true }
      },
      expected: {
        category: 'thinking',
        provider: 'codewhisperer-primary',
        targetModel: 'CLAUDE_SONNET_4_20250514_V1_0'
      }
    },
    {
      name: 'Long Context Category',
      request: {
        model: 'claude-3-5-sonnet-20241022', 
        messages: [{ role: 'user', content: 'A'.repeat(70000) }], // > 60K tokens
        max_tokens: 100
      },
      expected: {
        category: 'longcontext',
        provider: 'shuaihong-openai',
        targetModel: 'gemini-2.5-pro'
      }
    },
    {
      name: 'Search Category (With Tools)',
      request: {
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: '搜索相关问题' }],
        max_tokens: 100,
        metadata: { 
          tools: [{ name: 'WebSearch', description: '搜索网络' }] 
        }
      },
      expected: {
        category: 'search',
        provider: 'shuaihong-openai', 
        targetModel: 'gemini-2.5-flash'
      }
    }
  ];

  console.log('🔍 执行类别路由测试:');
  console.log('=====================');

  for (const testCase of testCases) {
    results.summary.total++;
    
    try {
      console.log(`\\n${results.summary.total}. ${testCase.name}`);
      console.log(`   输入: ${testCase.request.model} | ${testCase.request.messages[0].content.substring(0, 20)}...`);
      
      // 执行路由
      const selectedProvider = await routingEngine.route(testCase.request, `test-${results.summary.total}`);
      
      // 检查结果
      const actualTargetModel = testCase.request.metadata?.targetModel;
      const actualCategory = testCase.request.metadata?.routingCategory;
      
      const providerMatch = selectedProvider === testCase.expected.provider;
      const modelMatch = actualTargetModel === testCase.expected.targetModel;
      const categoryMatch = actualCategory === testCase.expected.category;
      
      const passed = providerMatch && modelMatch && categoryMatch;
      
      if (passed) {
        results.summary.passed++;
        console.log(`   ✅ PASS`);
        console.log(`   类别: ${actualCategory}`);
        console.log(`   提供商: ${selectedProvider}`);
        console.log(`   目标模型: ${actualTargetModel}`);
      } else {
        console.log(`   ❌ FAIL`);
        console.log(`   期望类别: ${testCase.expected.category}, 实际: ${actualCategory} ${categoryMatch ? '✅' : '❌'}`);
        console.log(`   期望提供商: ${testCase.expected.provider}, 实际: ${selectedProvider} ${providerMatch ? '✅' : '❌'}`);
        console.log(`   期望模型: ${testCase.expected.targetModel}, 实际: ${actualTargetModel} ${modelMatch ? '✅' : '❌'}`);
      }

      // 记录详细结果
      results.results.push({
        name: testCase.name,
        expected: testCase.expected,
        actual: {
          category: actualCategory,
          provider: selectedProvider,
          targetModel: actualTargetModel
        },
        passed
      });

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.results.push({
        name: testCase.name,
        expected: testCase.expected,
        actual: null,
        passed: false,
        error: error.message
      });
    }
  }

  // 计算通过率
  results.summary.failed = results.summary.total - results.summary.passed;
  results.summary.passRate = Math.round((results.summary.passed / results.summary.total) * 100);

  // 输出总结
  console.log('\\n📊 Step 1 测试总结:');
  console.log('==================');
  console.log(`总测试用例: ${results.summary.total}`);
  console.log(`通过: ${results.summary.passed} (${results.summary.passRate}%)`);
  console.log(`失败: ${results.summary.failed}`);
  
  if (results.summary.passRate === 100) {
    console.log('\\n🎉 Step 1 完全通过! 类别路由逻辑正确');
    console.log('✅ 可以进行 Step 2 测试');
  } else {
    console.log('\\n⚠️  Step 1 存在问题，需要修复路由逻辑');
  }

  // 保存结果
  const outputFile = 'step1-output.json';
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\\n💾 详细结果已保存到: ${outputFile}`);

  return results;
}

// 运行测试
if (require.main === module) {
  testCategoryRouting()
    .then(results => {
      process.exit(results.summary.passRate === 100 ? 0 : 1);
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { testCategoryRouting };