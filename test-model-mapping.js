#!/usr/bin/env node

/**
 * 模型映射验证测试
 * 从日志中提取的真实请求数据验证路由和映射逻辑
 */

const fs = require('fs');
const path = require('path');

// 从日志中提取的测试用例
const testCases = [
  {
    name: "claude-3-5-haiku-20241022 -> default category (无特殊标记)",
    input: {
      model: "claude-3-5-haiku-20241022", 
      messages: [{"role": "user", "content": "Hello"}],
      messageCount: 1,
      hasTools: false
    },
    expectedCategory: "default", // 现在应该是default，因为没有特殊标记
    expectedProvider: "codewhisperer-primary",
    expectedTargetModel: "CLAUDE_SONNET_4_20250514_V1_0" // default类别的模型
  },
  {
    name: "claude-sonnet-4-20250514 with tools -> search category", 
    input: {
      model: "claude-sonnet-4-20250514",
      messages: [{"role": "user", "content": "Use tools to search"}],
      messageCount: 1,
      hasTools: true,
      metadata: {
        tools: [{"name": "WebSearch"}]
      }
    },
    expectedCategory: "search",
    expectedProvider: "codewhisperer-primary", 
    expectedTargetModel: "CLAUDE_SONNET_4_20250514_V1_0"
  },
  {
    name: "claude-sonnet-4-20250514 default case",
    input: {
      model: "claude-sonnet-4-20250514",
      messages: [{"role": "user", "content": "Normal request"}],
      messageCount: 1,
      hasTools: false
    },
    expectedCategory: "default",
    expectedProvider: "codewhisperer-primary",
    expectedTargetModel: "CLAUDE_SONNET_4_20250514_V1_0"
  }
];

// 加载配置文件
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('🧪 模型映射验证测试');
console.log('='.repeat(50));

// 模拟路由引擎的类别判断逻辑
function determineCategory(request) {
  // Check for explicit thinking mode
  if (request.metadata?.thinking) {
    return 'thinking';
  }

  // Check for long context based on token count (simplified)
  if (request.messageCount > 100) { // 简化的长上下文检测
    return 'longcontext';
  }

  // Check for search tools
  if (request.metadata?.tools && Array.isArray(request.metadata.tools)) {
    const hasSearchTools = request.metadata.tools.some(tool => 
      typeof tool === 'object' && tool.name && (
        tool.name.toLowerCase().includes('search') ||
        tool.name.toLowerCase().includes('web') ||
        tool.name === 'WebSearch'
      )
    );
    
    if (hasSearchTools) {
      return 'search';
    }
  }

  // Default category for all other cases (不再硬编码haiku检测)
  return 'default';
}

// 验证每个测试用例
let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`\n📋 Test ${index + 1}: ${testCase.name}`);
  console.log('-'.repeat(40));
  
  // Step 1: 类别判断
  const actualCategory = determineCategory(testCase.input);
  const categoryCorrect = actualCategory === testCase.expectedCategory;
  
  console.log(`输入模型: ${testCase.input.model}`);
  console.log(`预期类别: ${testCase.expectedCategory}`);
  console.log(`实际类别: ${actualCategory} ${categoryCorrect ? '✅' : '❌'}`);
  
  // Step 2: 配置查询
  const categoryRule = config.routing[actualCategory];
  if (!categoryRule) {
    console.log(`❌ 配置中找不到类别: ${actualCategory}`);
    return;
  }
  
  const actualProvider = categoryRule.provider;
  const actualTargetModel = categoryRule.model;
  
  const providerCorrect = actualProvider === testCase.expectedProvider;
  const modelCorrect = actualTargetModel === testCase.expectedTargetModel;
  
  console.log(`预期Provider: ${testCase.expectedProvider}`);
  console.log(`实际Provider: ${actualProvider} ${providerCorrect ? '✅' : '❌'}`);
  console.log(`预期目标模型: ${testCase.expectedTargetModel}`);
  console.log(`实际目标模型: ${actualTargetModel} ${modelCorrect ? '✅' : '❌'}`);
  
  const testPassed = categoryCorrect && providerCorrect && modelCorrect;
  if (testPassed) {
    passedTests++;
    console.log('🎉 测试通过');
  } else {
    console.log('💥 测试失败');
  }
});

console.log('\n' + '='.repeat(50));
console.log(`📊 测试结果: ${passedTests}/${totalTests} 通过`);

if (passedTests === totalTests) {
  console.log('🎯 所有模型映射测试通过！');
  process.exit(0);
} else {
  console.log('🚨 部分测试失败，需要修复映射逻辑');
  process.exit(1);
}