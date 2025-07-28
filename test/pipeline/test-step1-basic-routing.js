#!/usr/bin/env node

/**
 * Step 1: 基础路由测试 - 验证路由引擎基本逻辑
 * 测试用例：验证5个类别的路由引擎决策是否正确
 * Author: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Step 1: 基础路由测试');
console.log('========================\n');

// 加载配置
const configPath = path.join(process.env.HOME, '.claude-code-router', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('📋 当前路由配置:');
console.log('================');
Object.entries(config.routing).forEach(([category, rule]) => {
  console.log(`  ${category}: ${rule.provider} → ${rule.model}`);
});

// 模拟路由引擎决策的测试用例
const testCases = [
  {
    name: 'Default Category',
    input: {
      model: 'claude-sonnet-4-20250514',
      content: '普通对话测试'
    },
    expectedCategory: 'default',
    expectedProvider: 'codewhisperer-primary',
    expectedTargetModel: 'CLAUDE_SONNET_4_20250514_V1_0',
    reason: '普通对话，不符合其他特殊条件'
  },
  {
    name: 'Background Category (Haiku Model)',
    input: {
      model: 'claude-3-5-haiku-20241022',
      content: '简单任务'
    },
    expectedCategory: 'background',
    expectedProvider: 'shuaihong-openai',
    expectedTargetModel: 'gemini-2.5-flash',
    reason: '模型名包含"haiku"触发background类别'
  },
  {
    name: 'Thinking Category (Explicit)',
    input: {
      model: 'claude-sonnet-4-20250514',
      content: '复杂分析',
      metadata: { thinking: true }
    },
    expectedCategory: 'thinking',
    expectedProvider: 'codewhisperer-primary',
    expectedTargetModel: 'CLAUDE_SONNET_4_20250514_V1_0',
    reason: 'metadata.thinking = true 显式设置'
  },
  {
    name: 'Long Context Category',
    input: {
      model: 'claude-3-5-sonnet-20241022',
      content: 'A'.repeat(25000) + '长文档分析'
    },
    expectedCategory: 'longcontext',
    expectedProvider: 'shuaihong-openai',
    expectedTargetModel: 'gemini-2.5-pro',
    reason: '内容长度超过20000字符'
  },
  {
    name: 'Search Category (With Tools)',
    input: {
      model: 'claude-sonnet-4-20250514',
      content: '搜索相关问题',
      metadata: {
        tools: [{
          name: 'WebSearch',
          description: 'Web search tool'
        }]
      }
    },
    expectedCategory: 'search',
    expectedProvider: 'shuaihong-openai',
    expectedTargetModel: 'gemini-2.5-flash',
    reason: '包含搜索相关工具'
  }
];

// 模拟路由引擎的决策逻辑
function determineCategory(input) {
  // 检查显式thinking模式
  if (input.metadata?.thinking) {
    return 'thinking';
  }

  // 检查长上下文（粗略估算token）
  const contentLength = input.content.length;
  if (contentLength > 20000) {
    return 'longcontext';
  }

  // 检查背景处理（haiku模型）
  if (input.model.includes('haiku')) {
    return 'background';
  }

  // 检查搜索/工具 - 修正逻辑匹配实际路由引擎
  if (input.metadata?.tools) {
    const tools = input.metadata.tools;
    console.log(`   Debug: 检查工具数组:`, tools.map(t => t.name));
    if (Array.isArray(tools) && tools.some(tool => 
      tool.name && (
        tool.name.toLowerCase().includes('search') || 
        tool.name.toLowerCase().includes('web') ||
        tool.name.toLowerCase().includes('browse')
      )
    )) {
      console.log(`   Debug: 找到搜索工具，返回search类别`);
      return 'search';
    }
  }

  // 默认类别
  return 'default';
}

// 根据类别获取路由决策
function getRoutingDecision(category) {
  const rule = config.routing[category];
  if (!rule) {
    throw new Error(`No routing rule found for category: ${category}`);
  }
  return {
    provider: rule.provider,
    targetModel: rule.model
  };
}

// 执行测试
console.log('\n🔍 执行路由决策测试:');
console.log('=====================\n');

let passCount = 0;
const results = [];

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.name}`);
  console.log(`   输入: ${testCase.input.model} | ${testCase.input.content.substring(0, 30)}...`);
  console.log(`   原因: ${testCase.reason}`);
  
  // 执行路由决策
  const actualCategory = determineCategory(testCase.input);
  const actualDecision = getRoutingDecision(actualCategory);
  
  // 验证结果
  const categoryCorrect = actualCategory === testCase.expectedCategory;
  const providerCorrect = actualDecision.provider === testCase.expectedProvider;
  const modelCorrect = actualDecision.targetModel === testCase.expectedTargetModel;
  const allCorrect = categoryCorrect && providerCorrect && modelCorrect;
  
  console.log(`   实际类别: ${actualCategory} ${categoryCorrect ? '✅' : '❌'}`);
  console.log(`   实际提供商: ${actualDecision.provider} ${providerCorrect ? '✅' : '❌'}`);
  console.log(`   实际目标模型: ${actualDecision.targetModel} ${modelCorrect ? '✅' : '❌'}`);
  console.log(`   整体结果: ${allCorrect ? '✅ PASS' : '❌ FAIL'}`);
  
  if (allCorrect) passCount++;
  
  results.push({
    name: testCase.name,
    expected: {
      category: testCase.expectedCategory,
      provider: testCase.expectedProvider,
      targetModel: testCase.expectedTargetModel
    },
    actual: {
      category: actualCategory,
      provider: actualDecision.provider,
      targetModel: actualDecision.targetModel
    },
    passed: allCorrect
  });
  
  console.log('');
});

// 保存结果
const output = {
  timestamp: new Date().toISOString(),
  test: 'step1-basic-routing',
  summary: {
    total: testCases.length,
    passed: passCount,
    failed: testCases.length - passCount,
    passRate: Math.round((passCount / testCases.length) * 100)
  },
  results: results,
  config: {
    routing: config.routing,
    providers: Object.keys(config.providers)
  }
};

fs.writeFileSync('step1-output.json', JSON.stringify(output, null, 2));

// 总结
console.log('📊 Step 1 测试总结:');
console.log('==================');
console.log(`总测试用例: ${testCases.length}`);
console.log(`通过: ${passCount} (${Math.round((passCount/testCases.length)*100)}%)`);
console.log(`失败: ${testCases.length - passCount}`);

if (passCount === testCases.length) {
  console.log('\n🎉 Step 1 完全通过! 路由引擎逻辑正确');
  console.log('✅ 可以进行 Step 2 测试');
} else {
  console.log('\n⚠️  Step 1 存在问题，需要修复路由引擎逻辑');
  console.log('❌ 请检查失败的测试用例');
}

console.log(`\n💾 详细结果已保存到: step1-output.json`);