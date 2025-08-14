#!/usr/bin/env node

const { getUnifiedPatchPreprocessor } = require('./dist/preprocessing/unified-patch-preprocessor');

console.log('🧪 DEBUG: Testing preprocessor initialization...\n');

// 测试1: 默认配置
console.log('=== TEST 1: Default Configuration ===');
const preprocessor1 = getUnifiedPatchPreprocessor(5509);
console.log('- Preprocessor created:', !!preprocessor1);
console.log('- Config:', preprocessor1.config);
console.log('- Compatibility processor available:', !!preprocessor1.compatibilityProcessor);
console.log();

// 测试2: 强制debug配置
console.log('=== TEST 2: Force Debug Configuration ===');
const preprocessor2 = getUnifiedPatchPreprocessor(5509, {
  debugMode: true,
  enabled: true,
  forceAllInputs: true
});
console.log('- Preprocessor created:', !!preprocessor2);
console.log('- Config:', preprocessor2.config);
console.log();

// 测试3: 测试实际预处理调用
console.log('=== TEST 3: Test Preprocessing Call ===');

const testRequest = {
  model: "ZhipuAI/GLM-4.5",
  messages: [
    {
      role: "user", 
      content: {
        type: "text",
        text: "Hello, this should trigger format fix"
      }
    }
  ],
  tools: [
    "invalid_tool_string",  // This should trigger fix
    {
      type: "function",
      function: {
        name: "test_tool",
        description: "A test tool"
      }
    }
  ]
};

console.log('🔍 Testing with problematic request that should trigger fixes...');
console.log('Original request has:');
console.log('- Message content as object (should be fixed to array)');
console.log('- Tools array with string element (should be fixed)');
console.log();

(async () => {
  try {
    const result = await preprocessor2.preprocessInput(
      testRequest,
      "modelscope-openai",
      "ZhipuAI/GLM-4.5", 
      "test-request-id"
    );
    
    console.log('✅ Preprocessing completed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.log('❌ Preprocessing failed:', error.message);
  }
})();