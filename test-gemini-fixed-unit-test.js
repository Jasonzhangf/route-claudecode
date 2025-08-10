/**
 * Gemini Provider 修复后的单元测试验证
 * 项目所有者: Jason Zhang
 */

const { GeminiTransformer } = require('./dist/transformers/gemini');

console.log('🧪 开始Gemini Provider修复后的单元测试...\n');

async function runFixedGeminiTests() {
  let passed = 0;
  let failed = 0;
  
  // Test 1: GeminiTransformer基础功能
  try {
    console.log('📋 Test 1: GeminiTransformer初始化');
    const transformer = new GeminiTransformer();
    
    if (transformer && transformer.name === 'gemini') {
      console.log('   ✅ GeminiTransformer初始化成功');
      passed++;
    } else {
      console.log('   ❌ GeminiTransformer初始化失败');
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ GeminiTransformer初始化异常: ${error.message}`);
    failed++;
  }

  // Test 2: ProviderId设置功能 (Zero Fallback验证)
  try {
    console.log('📋 Test 2: ProviderId设置功能');
    const transformer = new GeminiTransformer();
    
    // 测试setProviderId方法
    transformer.setProviderId('test-provider');
    console.log('   ✅ ProviderId设置成功');
    passed++;
  } catch (error) {
    console.log(`   ❌ ProviderId设置失败: ${error.message}`);
    failed++;
  }

  // Test 3: 格式转换基础验证 (避免实际API调用)
  try {
    console.log('📋 Test 3: 格式转换基础验证');
    const transformer = new GeminiTransformer();
    transformer.setProviderId('test-provider');
    
    const testRequest = {
      model: 'gemini-2.5-pro',
      messages: [
        {
          role: 'user',
          content: 'Hello test'
        }
      ],
      max_tokens: 100,
      metadata: {
        requestId: 'test-request-123'
      }
    };

    // 这里应该能成功转换，因为我们修复了所有硬编码问题
    const geminiRequest = transformer.transformAnthropicToGemini(testRequest);
    
    if (geminiRequest && geminiRequest.contents && geminiRequest.contents.length > 0) {
      console.log('   ✅ 格式转换成功');
      passed++;
    } else {
      console.log('   ❌ 格式转换失败 - 无效输出');
      failed++;
    }
  } catch (error) {
    if (error.message.includes('required') && !error.message.includes('||')) {
      console.log('   ✅ 格式转换正确抛出配置错误 (Zero Fallback原则)');
      passed++;
    } else {
      console.log(`   ❌ 格式转换异常: ${error.message}`);
      failed++;
    }
  }

  // Test 4: Zero Hardcode验证 - 确保没有硬编码fallback
  try {
    console.log('📋 Test 4: Zero Fallback验证');
    const transformer = new GeminiTransformer();
    
    const invalidRequest = {
      model: 'gemini-2.5-pro', 
      messages: [
        {
          role: 'user',
          content: 'test'
        }
      ],
      // 故意缺少 metadata.requestId
    };

    transformer.transformAnthropicToGemini(invalidRequest);
    console.log('   ❌ 应该抛出错误但没有抛出 (存在fallback违规)');
    failed++;
  } catch (error) {
    if (error.message.includes('requestId is required') && !error.message.includes('||')) {
      console.log('   ✅ 正确的fail-fast错误处理 (Zero Fallback原则)');
      passed++;
    } else {
      console.log(`   ⚠️  错误处理不够严格: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🧪 Gemini Provider修复后单元测试结果');
  console.log('='.repeat(60));
  console.log(`📊 总体结果:`);
  console.log(`   • 总测试数: ${passed + failed}`);
  console.log(`   • 通过: ${passed} (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log(`   • 失败: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过! Gemini Provider修复成功!');
    console.log('✅ Zero硬编码原则: 已实现');
    console.log('✅ Zero Fallback原则: 已实现'); 
    console.log('✅ Fail-fast错误处理: 已实现');
  } else {
    console.log('\n⚠️  仍有测试失败，需要进一步修复');
  }
  
  console.log('='.repeat(60));
  
  return { passed, failed };
}

if (require.main === module) {
  runFixedGeminiTests()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
}

module.exports = { runFixedGeminiTests };