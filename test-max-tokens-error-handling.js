#!/usr/bin/env node

/**
 * 测试Max Tokens错误处理模块
 * 验证滚动截断、简化提示词等功能
 */

const { MaxTokensErrorHandlingModule } = require('./dist/utils/max-tokens-error-handling-module');
const { EnhancedMaxTokensErrorHandler } = require('./dist/utils/enhanced-max-tokens-error-handler');

console.log('🧪 Testing Max Tokens Error Handling Module');
console.log('=' + '='.repeat(60));

// 创建测试用的长请求
function createLongRequest() {
  const longMessage = 'This is a very long message that would exceed token limits. '.repeat(100);
  
  return {
    model: 'claude-3-sonnet-20240229',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful AI assistant with extensive knowledge and capabilities.'
      },
      {
        role: 'user',
        content: 'What is artificial intelligence? Please explain in detail.'
      },
      {
        role: 'assistant',
        content: longMessage
      },
      {
        role: 'user',
        content: longMessage
      },
      {
        role: 'assistant',
        content: 'I understand your question about AI.'
      },
      {
        role: 'user',
        content: 'Tell me more about machine learning algorithms.'
      }
    ],
    metadata: {
      system: {
        type: 'text',
        text: 'You are Claude, an AI assistant created by Anthropic. You are helpful, harmless, and honest. You have access to various tools and can assist with a wide range of tasks including coding, analysis, writing, math, and general questions. Always be thoughtful and provide accurate information.'
      },
      tools: [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for information',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' }
              },
              required: ['query']
            }
          }
        }
      ],
      requestId: 'test-max-tokens-' + Date.now(),
      targetProvider: 'test-provider',
      originalModel: 'claude-3-sonnet-20240229'
    }
  };
}

// 测试配置创建和加载
async function testConfigurationManagement() {
  console.log('\n🔧 Testing Configuration Management...');
  
  try {
    const handlingModule = new MaxTokensErrorHandlingModule();
    const config = handlingModule.getConfig();
    
    console.log('   ✅ Configuration loaded successfully');
    console.log(`   📋 Strategy: ${config.strategy}`);
    console.log(`   📊 History retention: ${config.rollingTruncation.historyRetentionPercent}%`);
    console.log(`   🔧 Simplified prompt: ${config.rollingTruncation.useSimplifiedPrompt}`);
    
    // 测试配置更新
    handlingModule.updateConfig({
      rollingTruncation: {
        ...config.rollingTruncation,
        historyRetentionPercent: 70
      }
    });
    
    const updatedConfig = handlingModule.getConfig();
    console.log(`   🔄 Updated history retention: ${updatedConfig.rollingTruncation.historyRetentionPercent}%`);
    
    return true;
  } catch (error) {
    console.log(`   ❌ Configuration test failed: ${error.message}`);
    return false;
  }
}

// 测试滚动截断功能
async function testRollingTruncation() {
  console.log('\n📝 Testing Rolling Truncation...');
  
  try {
    const handlingModule = new MaxTokensErrorHandlingModule();
    const longRequest = createLongRequest();
    const requestId = 'test-truncation-' + Date.now();
    
    console.log(`   📊 Original request: ${longRequest.messages.length} messages`);
    
    // 估算原始token数量
    const originalEstimate = estimateTokens(longRequest);
    console.log(`   🔢 Estimated original tokens: ${originalEstimate}`);
    
    const result = await handlingModule.handleMaxTokensError(
      longRequest,
      { provider: 'test-provider', model: 'test-model' },
      requestId
    );
    
    if (result.success) {
      console.log('   ✅ Truncation completed successfully');
      console.log(`   📉 Token reduction: ${result.originalTokens} → ${result.reducedTokens} (${Math.round((1 - result.reducedTokens / result.originalTokens) * 100)}% reduction)`);
      console.log(`   📝 Messages: ${longRequest.messages.length} → ${result.truncatedRequest.messages?.length || 0}`);
      console.log(`   🔧 System prompt simplified: ${result.details.systemPromptReduced}`);
      console.log(`   📋 History messages removed: ${result.details.historyMessagesRemoved}`);
    } else {
      console.log('   ❌ Truncation failed');
    }
    
    return result.success;
  } catch (error) {
    console.log(`   ❌ Rolling truncation test failed: ${error.message}`);
    return false;
  }
}

// 测试增强版错误处理器
async function testEnhancedErrorHandler() {
  console.log('\n🚀 Testing Enhanced Error Handler...');
  
  try {
    const enhancedHandler = new EnhancedMaxTokensErrorHandler({
      enableAutoRetry: true,
      maxRetryAttempts: 2
    });
    
    // 模拟max tokens响应
    const maxTokensResponse = {
      choices: [{
        message: { content: 'This response was truncated...' },
        finish_reason: 'length'
      }],
      usage: {
        prompt_tokens: 4000,
        completion_tokens: 2000,
        total_tokens: 6000
      }
    };
    
    const longRequest = createLongRequest();
    const result = await enhancedHandler.handleMaxTokensResponse(
      maxTokensResponse,
      'test-provider',
      'test-model',
      'test-request-id',
      longRequest
    );
    
    if (result.shouldRetry && result.truncatedRequest) {
      console.log('   ✅ Auto-retry mechanism triggered');
      console.log(`   🔄 Truncated request available: ${result.truncatedRequest.messages?.length || 0} messages`);
    } else if (result.error) {
      console.log(`   ⚠️  Error created: ${result.error.code}`);
      console.log(`   📄 Auto-retry available: ${result.error.details.autoRetryAvailable}`);
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Enhanced error handler test failed: ${error.message}`);
    return false;
  }
}

// 估算token数量的辅助函数
function estimateTokens(request) {
  let totalChars = 0;
  
  if (request.messages) {
    request.messages.forEach(msg => {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      }
    });
  }
  
  if (request.metadata?.system) {
    totalChars += JSON.stringify(request.metadata.system).length;
  }
  
  if (request.metadata?.tools) {
    totalChars += JSON.stringify(request.metadata.tools).length;
  }
  
  return Math.ceil(totalChars / 4);
}

// 运行所有测试
async function runAllTests() {
  console.log('\n🔍 Starting Max Tokens Error Handling Tests...');
  
  const tests = [
    { name: 'Configuration Management', fn: testConfigurationManagement },
    { name: 'Rolling Truncation', fn: testRollingTruncation },
    { name: 'Enhanced Error Handler', fn: testEnhancedErrorHandler }
  ];
  
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const success = await test.fn();
      if (success) {
        passedTests++;
      }
    } catch (error) {
      console.log(`   💥 Test '${test.name}' threw exception: ${error.message}`);
    }
    
    // 短暂延迟避免文件系统冲突
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 汇总结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary:');
  console.log(`   🎯 Tests passed: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('✅ All Max Tokens Error Handling tests passed!');
    console.log('🎉 滚动截断和智能处理功能验证成功');
  } else {
    console.log('⚠️  Some tests failed. Check implementation.');
  }
  
  return passedTests === totalTests;
}

// 执行测试
runAllTests().then(success => {
  console.log('\n🔚 Max Tokens Error Handling testing completed');
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});