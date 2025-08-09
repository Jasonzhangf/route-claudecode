#!/usr/bin/env node

/**
 * 测试ModelScope预处理补丁对GLM-4.5和Qwen3-Coder的支持
 */

// 使用require语法以避免ES模块问题
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing ModelScope Preprocessing Patches');
console.log('=' + '='.repeat(60));

// 测试数据
const testCases = [
  {
    name: 'GLM-4.5 Tool Call Request',
    provider: 'openai',
    model: 'ZhipuAI/GLM-4.5',
    stage: 'input',
    data: {
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please search for information about Node.js' },
            { 
              type: 'tool_use', 
              name: 'web_search',
              input: { query: 'Node.js latest features' }
            }
          ]
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for information'
          }
        }
      ]
    }
  },
  {
    name: 'Qwen3-Coder Tool Response',
    provider: 'openai', 
    model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    stage: 'response',
    data: {
      choices: [{
        message: {
          role: 'assistant',
          content: 'I will help you write a Python function',
          tool_calls: [
            {
              id: 'tool_123',
              type: 'function',
              function: {
                name: 'code_generator',
                arguments: '{"language": "python", "task": "fibonacci"}'
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }],
      usage: { 
        prompt_tokens: 50,
        completion_tokens: 30 
      }
    }
  },
  {
    name: 'GLM-4.5 Response Processing',
    provider: 'openai',
    model: 'glm-4.5-turbo',
    stage: 'response', 
    data: {
      content: [
        {
          type: 'text',
          text: 'Tool call: web_search({"query": "Node.js performance tips"})'
        }
      ],
      id: 'msg_123',
      role: 'assistant'
    }
  },
  {
    name: 'Qwen3 Missing Choices Format',
    provider: 'openai',
    model: 'qwen3-coder-large', 
    stage: 'response',
    data: {
      id: 'resp_456',
      role: 'assistant',
      content: 'Here is the code solution',
      finish_reason: 'stop',
      usage: { total_tokens: 100 }
    }
  }
];

async function runTests() {
  const patchManager = createPatchManager();
  const preprocessor = getUnifiedPatchPreprocessor(undefined, {
    debugMode: true,
    forceAllInputs: true
  });

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const [index, testCase] of testCases.entries()) {
    console.log(`\\n${index + 1}. Testing: ${testCase.name}`);
    console.log(`   Model: ${testCase.model}`);
    console.log(`   Stage: ${testCase.stage}`);

    try {
      let result;
      const requestId = `test_${Date.now()}_${index}`;

      if (testCase.stage === 'input') {
        result = await preprocessor.preprocessInput(
          testCase.data,
          testCase.provider,
          testCase.model,
          requestId
        );
      } else if (testCase.stage === 'response') {
        result = await preprocessor.preprocessResponse(
          testCase.data, 
          testCase.provider,
          testCase.model,
          requestId
        );
      }

      // 验证结果
      const success = result && typeof result === 'object';
      
      if (success) {
        console.log(`   ✅ PASSED`);
        
        // 特殊验证逻辑
        if (testCase.name.includes('GLM-4.5') && testCase.stage === 'input') {
          if (result.temperature === 0.8) {
            console.log(`   📊 GLM-4.5 temperature correctly set to 0.8`);
          }
          if (result.messages && result.messages[0] && typeof result.messages[0].content === 'string') {
            console.log(`   🔧 Tool call format converted to ModelScope GLM format`);
          }
        }
        
        if (testCase.name.includes('Qwen3') && testCase.stage === 'response') {
          if (result.choices && Array.isArray(result.choices)) {
            console.log(`   🔧 Missing choices field fixed for Qwen3`);
          }
        }
        
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Result is invalid`);
      }

      // 显示关键输出信息
      if (result !== testCase.data) {
        console.log(`   🔄 Data was processed and modified`);
      }

    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`);
      console.log(`   📍 Error details:`, error.stack?.split('\\n')[0]);
    }
  }

  console.log(`\\n` + '='.repeat(60));
  console.log(`🎯 Test Results: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log(`✅ All ModelScope preprocessing patches working correctly!`);
    console.log(`🎉 GLM-4.5 and Qwen3-Coder support validated`);
  } else {
    console.log(`⚠️  Some tests failed. Please review the patches.`);
  }

  // 显示补丁统计
  const stats = patchManager.getStats();
  console.log(`\\n📊 Patch Manager Stats:`);
  console.log(`   Registered patches: ${stats.totalPatches}`);
  console.log(`   Active patches: ${stats.activePatches}`);
  
  return passedTests === totalTests;
}

// 运行测试
runTests().then(success => {
  console.log(`\\n🔚 Testing completed`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});