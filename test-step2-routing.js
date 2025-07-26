#!/usr/bin/env node
/**
 * Step 2: 测试路由模块
 * 使用Step1的输出，验证模型路由逻辑
 */

const fs = require('fs');

async function testStep2() {
  console.log('🔍 Step 2: Testing Routing Logic');
  
  // 读取Step1的输出
  if (!fs.existsSync('step1-output.json')) {
    console.error('❌ Step1 output not found. Run step1 first.');
    return { success: false };
  }
  
  const step1Data = JSON.parse(fs.readFileSync('step1-output.json', 'utf8'));
  console.log('📥 Input from Step1:', {
    model: step1Data.input.model,
    success: step1Data.success
  });
  
  // 模拟路由逻辑分析
  const routingAnalysis = {
    inputModel: step1Data.input.model,
    expectedCategory: step1Data.input.model.includes('haiku') ? 'background' : 'default',
    expectedProvider: 'shuaihong-openai',
    expectedTargetModel: step1Data.input.model.includes('haiku') ? 'gemini-2.5-flash' : 'gpt-4o'
  };
  
  console.log('🎯 Routing Analysis:', JSON.stringify(routingAnalysis, null, 2));
  
  // 验证实际路由结果
  const actualModel = step1Data.output?.model;
  const routingSuccess = actualModel === routingAnalysis.expectedTargetModel;
  
  console.log('📊 Routing Verification:', {
    expected: routingAnalysis.expectedTargetModel,
    actual: actualModel,
    success: routingSuccess
  });
  
  const outputs = {
    timestamp: new Date().toISOString(),
    step: 'step2-routing',
    input: step1Data.input,
    routingAnalysis,
    actualModel,
    success: routingSuccess
  };
  
  fs.writeFileSync('step2-output.json', JSON.stringify(outputs, null, 2));
  console.log(routingSuccess ? '✅ Step 2 completed' : '❌ Step 2 failed');
  
  return outputs;
}

// 运行测试
if (require.main === module) {
  testStep2().then(result => {
    process.exit(result.success ? 0 : 1);
  });
}

module.exports = { testStep2 };