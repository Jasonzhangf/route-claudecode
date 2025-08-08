#!/usr/bin/env node
/**
 * OpenAI Provider功能验证测试
 * 测试端口5507 (ModelScope) 和端口5508 (ShuaiHong)
 * 项目所有者: Jason Zhang
 */

const { ProviderTestSuite } = require('./provider-test-suite');

async function testOpenAIProviders() {
  console.log('🧪 OpenAI Provider功能验证测试');
  console.log('=' .repeat(60));

  const results = [];

  try {
    // 导入OpenAI SDK Client
    const { OpenAISDKClient } = require('../../src/providers/openai');

    // 测试ModelScope Provider (端口5507)
    console.log('\n🔧 测试 ModelScope Provider (端口5507)');
    const modelScopeConfig = {
      endpoint: 'http://localhost:5507/v1/chat/completions',
      defaultModel: 'Qwen3-Coder-480B',
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: 'test-key'
        }
      },
      sdkOptions: {
        timeout: 60000,
        maxRetries: 2,
        defaultHeaders: {
          'User-Agent': 'claude-code-router-test/1.0'
        }
      }
    };

    const modelScopeProvider = new OpenAISDKClient(modelScopeConfig, 'modelscope-test');
    const modelScopeTestSuite = new ProviderTestSuite(modelScopeProvider);
    const modelScopeReport = await modelScopeTestSuite.runCompleteTestSuite();
    results.push(modelScopeReport);

    // 等待2秒避免请求过快
    console.log('\n⏳ 等待2秒后继续下一个测试...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试ShuaiHong Provider (端口5508)
    console.log('\n🔧 测试 ShuaiHong Provider (端口5508)');
    const shuaiHongConfig = {
      endpoint: 'http://localhost:5508/v1/chat/completions',
      defaultModel: 'claude-4-sonnet',
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: 'test-key'
        }
      },
      sdkOptions: {
        timeout: 60000,
        maxRetries: 2,
        defaultHeaders: {
          'User-Agent': 'claude-code-router-test/1.0'
        }
      }
    };

    const shuaiHongProvider = new OpenAISDKClient(shuaiHongConfig, 'shuaihong-test');
    const shuaiHongTestSuite = new ProviderTestSuite(shuaiHongProvider);
    const shuaiHongReport = await shuaiHongTestSuite.runCompleteTestSuite();
    results.push(shuaiHongReport);

  } catch (error) {
    console.error('❌ OpenAI Provider测试失败:', error.message);
    results.push({
      provider: 'OpenAI-SDK-Error',
      providerType: 'openai-sdk',
      timestamp: new Date().toISOString(),
      summary: { total: 0, passed: 0, failed: 1, successRate: '0%' },
      errors: [{ test: 'Provider导入', type: 'error', error: error.message }],
      status: 'IMPORT_FAILED'
    });
  }

  // 生成OpenAI Provider特定报告
  generateOpenAIReport(results);
  
  return results;
}

function generateOpenAIReport(results) {
  console.log('\n📊 OpenAI Provider测试总结');
  console.log('=' .repeat(50));

  const totalTests = results.reduce((sum, r) => sum + r.summary.total, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.summary.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.summary.failed, 0);
  const overallSuccessRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

  console.log(`📈 总体统计:`);
  console.log(`   Provider数量: ${results.length}`);
  console.log(`   测试总数: ${totalTests}`);
  console.log(`   通过测试: ${totalPassed}`);
  console.log(`   失败测试: ${totalFailed}`);
  console.log(`   成功率: ${overallSuccessRate}%`);

  console.log('\n📋 各Provider结果:');
  results.forEach(result => {
    const status = result.status === 'PASS' ? '✅' : '❌';
    console.log(`   ${status} ${result.provider}: ${result.summary.successRate} (${result.summary.passed}/${result.summary.total})`);
    
    if (result.errors.length > 0) {
      console.log(`      ⚠️  错误: ${result.errors.length}个`);
      result.errors.forEach(error => {
        console.log(`         - ${error.test}: ${error.reason || error.error}`);
      });
    }
  });

  // 特定功能验证
  console.log('\n🔍 关键功能验证:');
  
  const hasWorkingProvider = results.some(r => r.status === 'PASS');
  const allHaveToolCalls = results.every(r => 
    !r.errors.some(e => e.test.includes('工具调用')));
  const allHaveMultiTurn = results.every(r => 
    !r.errors.some(e => e.test.includes('多轮会话')));

  console.log(`   基础功能: ${hasWorkingProvider ? '✅ 至少一个Provider工作正常' : '❌ 所有Provider都有问题'}`);
  console.log(`   工具调用: ${allHaveToolCalls ? '✅ 全部支持' : '❌ 部分失败'}`);
  console.log(`   多轮会话: ${allHaveMultiTurn ? '✅ 全部支持' : '❌ 部分失败'}`);
  console.log(`   流式响应: ${results.every(r => !r.errors.some(e => e.test.includes('流式'))) ? '✅ 全部支持' : '❌ 部分失败'}`);

  if (hasWorkingProvider && allHaveToolCalls && allHaveMultiTurn) {
    console.log('\n🎉 OpenAI Provider功能验证完全通过！');
  } else {
    console.log('\n⚠️  OpenAI Provider存在部分问题，但基础功能可用。');
  }
}

// 运行测试
if (require.main === module) {
  testOpenAIProviders().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testOpenAIProviders };