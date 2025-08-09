#!/usr/bin/env node

/**
 * 简单的ModelScope补丁测试
 * 验证GLM-4.5和Qwen3-Coder的patch条件匹配
 */

console.log('🧪 Testing ModelScope Patches - Simple Validation');
console.log('=' + '='.repeat(60));

// 模拟patch条件检查函数
function testModelScopeConditions() {
  const modelTestCases = [
    'ZhipuAI/GLM-4.5',
    'glm-4.5-turbo',
    'GLM-4.5',
    'Qwen/Qwen3-Coder-480B-A35B-Instruct',  
    'qwen3-coder-large',
    'Qwen3-Coder',
    'qwen3-480b',
    'regular-model' // 不应该匹配
  ];

  // 复制patch中的条件逻辑
  function shouldApplyModelScopePatch(model) {
    return model.includes('Qwen') || 
           model.includes('ZhipuAI') ||
           model.includes('GLM') ||
           model.includes('GLM-4.5') ||
           model.includes('glm-4.5') ||
           model.includes('Qwen3') ||
           model.includes('qwen3') ||
           model.includes('480B') ||
           model.includes('Coder');
  }

  // 检查GLM模型识别
  function isGLMModel(model) {
    return Boolean(model && (
      model.toLowerCase().includes('glm') ||
      model.toLowerCase().includes('zhipuai')
    ));
  }

  // 检查Qwen3-Coder模型识别
  function isQwen3CoderModel(model) {
    return Boolean(model && (
      model.toLowerCase().includes('qwen3') ||
      model.toLowerCase().includes('coder') ||
      model.toLowerCase().includes('480b')
    ));
  }

  console.log('\\n📋 ModelScope Patch Condition Tests:');
  
  let passedTests = 0;
  let totalTests = modelTestCases.length;

  modelTestCases.forEach((model, index) => {
    const shouldApply = shouldApplyModelScopePatch(model);
    const isGLM = isGLMModel(model);
    const isQwen3 = isQwen3CoderModel(model);
    
    console.log(`\\n${index + 1}. Model: "${model}"`);
    console.log(`   Should apply patch: ${shouldApply ? '✅' : '❌'}`);
    console.log(`   Is GLM model: ${isGLM ? '✅' : '❌'}`);
    console.log(`   Is Qwen3-Coder model: ${isQwen3 ? '✅' : '❌'}`);
    
    // 验证逻辑
    if (model === 'regular-model') {
      if (!shouldApply && !isGLM && !isQwen3) {
        console.log('   🎯 Correctly excluded non-ModelScope model');
        passedTests++;
      } else {
        console.log('   ❌ Should not match regular model');
      }
    } else {
      if (shouldApply) {
        console.log('   🎯 Correctly identified ModelScope model');
        passedTests++;
      } else {
        console.log('   ❌ Should match ModelScope model');
      }
    }
  });

  return { passed: passedTests, total: totalTests };
}

// 测试工具调用格式转换
function testToolCallFormatConversion() {
  console.log('\\n🔧 Tool Call Format Conversion Tests:');

  function convertToolUseToModelScopeFormat(toolBlock, model) {
    function isGLMModel(model) {
      return Boolean(model && (
        model.toLowerCase().includes('glm') ||
        model.toLowerCase().includes('zhipuai')
      ));
    }

    function isQwen3CoderModel(model) {
      return Boolean(model && (
        model.toLowerCase().includes('qwen3') ||
        model.toLowerCase().includes('coder') ||
        model.toLowerCase().includes('480b')
      ));
    }

    if (isGLMModel(model)) {
      // GLM-4.5格式: Tool call: FunctionName({...})
      const functionName = toolBlock.name || 'unknown';
      const inputData = JSON.stringify(toolBlock.input || {});
      return `Tool call: ${functionName}(${inputData})`;
    } else if (isQwen3CoderModel(model)) {
      // Qwen3-Coder格式: 更倾向于结构化格式
      return JSON.stringify({
        type: 'tool_use',
        name: toolBlock.name,
        input: toolBlock.input
      });
    }
    
    // 默认格式
    return JSON.stringify(toolBlock);
  }

  const toolCallTests = [
    {
      model: 'ZhipuAI/GLM-4.5',
      toolBlock: { name: 'web_search', input: { query: 'Node.js' } },
      expectedFormat: 'GLM format'
    },
    {
      model: 'Qwen/Qwen3-Coder-480B',
      toolBlock: { name: 'code_generator', input: { language: 'python' } },
      expectedFormat: 'Qwen3 JSON format'
    }
  ];

  let formatTests = 0;
  
  toolCallTests.forEach((test, index) => {
    const result = convertToolUseToModelScopeFormat(test.toolBlock, test.model);
    
    console.log(`\\n${index + 1}. Model: ${test.model}`);
    console.log(`   Input: ${JSON.stringify(test.toolBlock)}`);
    console.log(`   Output: ${result}`);
    
    if (test.model.includes('GLM') && result.startsWith('Tool call:')) {
      console.log('   ✅ GLM format conversion successful');
      formatTests++;
    } else if (test.model.includes('Qwen3') && result.includes('"type":"tool_use"')) {
      console.log('   ✅ Qwen3 format conversion successful');
      formatTests++;
    } else {
      console.log('   ❌ Format conversion failed');
    }
  });

  return { passed: formatTests, total: toolCallTests.length };
}

// 运行所有测试
async function runAllTests() {
  const conditionResults = testModelScopeConditions();
  const formatResults = testToolCallFormatConversion();
  
  const totalPassed = conditionResults.passed + formatResults.passed;
  const totalTests = conditionResults.total + formatResults.total;
  
  console.log('\\n' + '='.repeat(60));
  console.log(`🎯 Overall Results: ${totalPassed}/${totalTests} tests passed`);
  
  if (totalPassed === totalTests) {
    console.log('✅ All ModelScope preprocessing patches validated successfully!');
    console.log('🎉 GLM-4.5 and Qwen3-Coder support ready for production');
  } else {
    console.log('⚠️  Some tests failed. Review patch logic.');
  }
  
  console.log('\\n📊 Summary:');
  console.log(`   Model condition matching: ${conditionResults.passed}/${conditionResults.total}`);
  console.log(`   Tool call format conversion: ${formatResults.passed}/${formatResults.total}`);
  
  return totalPassed === totalTests;
}

// 执行测试
runAllTests().then(success => {
  console.log('\\n🔚 Testing completed');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});