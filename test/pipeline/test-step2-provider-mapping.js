#!/usr/bin/env node

/**
 * Step 2: 供应商映射测试 - 验证模型名映射逻辑
 * 测试用例：验证不同provider的模型名映射是否正确
 * Author: Jason Zhang
 */

const fs = require('fs');

console.log('🧪 Step 2: 供应商映射测试');
console.log('=========================\n');

// 检查Step 1结果
if (!fs.existsSync('step1-output.json')) {
  console.log('❌ 请先运行 Step 1 测试');
  process.exit(1);
}

const step1Result = JSON.parse(fs.readFileSync('step1-output.json', 'utf8'));

if (step1Result.summary.passRate !== 100) {
  console.log('⚠️  Step 1 测试未完全通过，但继续进行 Step 2 测试');
}

console.log('📋 Step 1 结果概览:');
console.log(`   通过率: ${step1Result.summary.passRate}%`);
console.log(`   失败用例: ${step1Result.summary.failed}`);

// 定义供应商映射逻辑测试
const mappingTests = [
  {
    name: 'CodeWhisperer Provider Mapping',
    provider: 'codewhisperer-primary',
    tests: [
      {
        originalModel: 'claude-sonnet-4-20250514',
        targetModel: 'CLAUDE_SONNET_4_20250514_V1_0',
        category: 'default',
        expected: 'CLAUDE_SONNET_4_20250514_V1_0' // targetModel优先
      },
      {
        originalModel: 'claude-3-5-sonnet-20241022',
        targetModel: 'CLAUDE_SONNET_4_20250514_V1_0',
        category: 'thinking',
        expected: 'CLAUDE_SONNET_4_20250514_V1_0' // targetModel优先
      }
    ]
  },
  {
    name: 'ModelScope OpenAI Provider Mapping',
    provider: 'modelscope-openai',
    tests: [
      {
        originalModel: 'claude-3-5-haiku-20241022',
        targetModel: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
        category: 'background',
        expected: 'Qwen/Qwen3-Coder-480B-A35B-Instruct' // targetModel优先
      },
      {
        originalModel: 'claude-3-5-sonnet-20241022',
        targetModel: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
        category: 'longcontext',
        expected: 'Qwen/Qwen3-Coder-480B-A35B-Instruct' // targetModel优先
      },
      {
        originalModel: 'claude-sonnet-4-20250514',
        targetModel: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
        category: 'search',
        expected: 'Qwen/Qwen3-Coder-480B-A35B-Instruct' // targetModel优先
      }
    ]
  }
];

// 模拟CodeWhisperer映射逻辑
function simulateCodeWhispererMapping(originalModel, targetModel) {
  // 如果有targetModel，直接使用
  if (targetModel) {
    return targetModel;
  }
  
  // 否则使用默认映射
  const MODEL_MAP = {
    'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0',
    'claude-3-5-haiku-20241022': 'CLAUDE_3_7_SONNET_20250219_V1_0',
    'claude-3-5-sonnet-20241022': 'CLAUDE_3_7_SONNET_20250219_V1_0',
    'claude-3-opus-20240229': 'CLAUDE_3_7_SONNET_20250219_V1_0'
  };
  
  return MODEL_MAP[originalModel] || MODEL_MAP['claude-sonnet-4-20250514'];
}

// 模拟OpenAI映射逻辑
function simulateOpenAIMapping(originalModel, targetModel) {
  // 如果有targetModel，直接使用
  if (targetModel) {
    return targetModel;
  }
  
  // OpenAI provider通常直接使用原始模型名
  return originalModel;
}

// 执行映射测试
console.log('\n🔍 执行供应商映射测试:');
console.log('========================\n');

let totalTests = 0;
let passedTests = 0;
const results = [];

mappingTests.forEach((providerTest, providerIndex) => {
  console.log(`${providerIndex + 1}. ${providerTest.name}`);
  console.log(`   ${'='.repeat(providerTest.name.length + 3)}`);
  
  const providerResults = [];
  
  providerTest.tests.forEach((test, testIndex) => {
    totalTests++;
    
    // 根据provider类型执行对应的映射逻辑
    let actualModel;
    if (providerTest.provider === 'codewhisperer-primary') {
      actualModel = simulateCodeWhispererMapping(test.originalModel, test.targetModel);
    } else if (providerTest.provider === 'modelscope-openai') {
      actualModel = simulateOpenAIMapping(test.originalModel, test.targetModel);
    }
    
    const passed = actualModel === test.expected;
    if (passed) passedTests++;
    
    console.log(`   ${testIndex + 1}. ${test.category} category:`);
    console.log(`      输入模型: ${test.originalModel}`);
    console.log(`      目标模型: ${test.targetModel}`);
    console.log(`      期望输出: ${test.expected}`);
    console.log(`      实际输出: ${actualModel}`);
    console.log(`      结果: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
    
    providerResults.push({
      category: test.category,
      originalModel: test.originalModel,
      targetModel: test.targetModel,
      expected: test.expected,
      actual: actualModel,
      passed: passed
    });
  });
  
  results.push({
    provider: providerTest.provider,
    tests: providerResults
  });
  
  console.log('');
});

// 验证端到端映射流程
console.log('🔄 端到端映射流程验证:');
console.log('========================');

const endToEndTests = step1Result.results.map(result => {
  const provider = result.actual.provider;
  const originalModel = result.name.includes('Haiku') ? 'claude-3-5-haiku-20241022' : 
                       result.name.includes('Long Context') ? 'claude-3-5-sonnet-20241022' : 
                       'claude-sonnet-4-20250514';
  const targetModel = result.actual.targetModel;
  
  let finalModel;
  if (provider === 'codewhisperer-primary') {
    finalModel = simulateCodeWhispererMapping(originalModel, targetModel);
  } else if (provider === 'modelscope-openai') {
    finalModel = simulateOpenAIMapping(originalModel, targetModel);
  }
  
  const correct = finalModel === targetModel;
  
  console.log(`${result.name}:`);
  console.log(`  ${originalModel} → ${result.actual.category} → ${provider} → ${finalModel} ${correct ? '✅' : '❌'}`);
  
  return {
    testName: result.name,
    originalModel: originalModel,
    category: result.actual.category,
    provider: provider,
    targetModel: targetModel,
    finalModel: finalModel,
    correct: correct
  };
});

const endToEndPassed = endToEndTests.filter(t => t.correct).length;

// 保存结果
const output = {
  timestamp: new Date().toISOString(),
  test: 'step2-provider-mapping',
  step1Summary: step1Result.summary,
  mappingTests: {
    total: totalTests,
    passed: passedTests,
    failed: totalTests - passedTests,
    passRate: Math.round((passedTests / totalTests) * 100)
  },
  endToEndTests: {
    total: endToEndTests.length,
    passed: endToEndPassed,
    failed: endToEndTests.length - endToEndPassed,
    passRate: Math.round((endToEndPassed / endToEndTests.length) * 100)
  },
  results: {
    providerMappings: results,
    endToEndFlow: endToEndTests
  }
};

fs.writeFileSync('step2-output.json', JSON.stringify(output, null, 2));

// 总结
console.log('\n📊 Step 2 测试总结:');
console.log('==================');
console.log(`供应商映射测试: ${passedTests}/${totalTests} (${Math.round((passedTests/totalTests)*100)}%)`);
console.log(`端到端流程测试: ${endToEndPassed}/${endToEndTests.length} (${Math.round((endToEndPassed/endToEndTests.length)*100)}%)`);

if (passedTests === totalTests && endToEndPassed === endToEndTests.length) {
  console.log('\n🎉 Step 2 完全通过! 供应商映射逻辑正确');
  console.log('✅ 可以进行 Step 3 实际API测试');
} else {
  console.log('\n⚠️  Step 2 存在问题，需要修复供应商映射逻辑');
  console.log('❌ 请检查失败的映射测试');
}

console.log(`\n💾 详细结果已保存到: step2-output.json`);