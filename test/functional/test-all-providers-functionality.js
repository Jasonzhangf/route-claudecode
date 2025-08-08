#!/usr/bin/env node
/**
 * Provider功能验证主测试脚本
 * 测试所有已配置的Provider
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const { ProviderTestSuite } = require('./provider-test-suite');

// 模拟Provider导入 - 根据实际情况调整
let OpenAISDKClient, CodeWhispererUnifiedClient, GeminiClient, AnthropicClient;

try {
  ({ OpenAISDKClient } = require('../../src/providers/openai'));
  ({ CodeWhispererUnifiedClient } = require('../../src/providers/codewhisperer'));
  ({ GeminiClient } = require('../../src/providers/gemini')); 
  ({ AnthropicClient } = require('../../src/providers/anthropic'));
} catch (error) {
  console.log('⚠️ 某些Provider导入失败，将跳过相关测试');
}

/**
 * 创建测试配置
 */
function createTestConfigs() {
  const configs = [];

  // OpenAI Provider配置 (ModelScope端口5507)
  if (OpenAISDKClient) {
    configs.push({
      name: 'OpenAI-ModelScope',
      type: 'openai-sdk',
      providerClass: OpenAISDKClient,
      config: {
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
          maxRetries: 3
        }
      }
    });
  }

  // OpenAI Provider配置 (ShuaiHong端口5508)  
  if (OpenAISDKClient) {
    configs.push({
      name: 'OpenAI-ShuaiHong',
      type: 'openai-sdk', 
      providerClass: OpenAISDKClient,
      config: {
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
          maxRetries: 3
        }
      }
    });
  }

  // CodeWhisperer Provider配置 (端口5504)
  if (CodeWhispererUnifiedClient) {
    configs.push({
      name: 'CodeWhisperer-KiroGmail',
      type: 'codewhisperer',
      providerClass: CodeWhispererUnifiedClient,
      config: {
        endpoint: 'http://localhost:5504',
        defaultModel: 'CLAUDE_SONNET_4_20250514_V1_0',
        region: 'us-east-1',
        profileArn: process.env.CODEWHISPERER_PROFILE_ARN,
        authMethod: 'social',
        authentication: {
          type: 'oauth',
          credentials: {}
        }
      }
    });
  }

  // Gemini Provider配置 (端口5502)
  if (GeminiClient) {
    configs.push({
      name: 'Google-Gemini',
      type: 'gemini',
      providerClass: GeminiClient,
      config: {
        endpoint: 'http://localhost:5502',
        defaultModel: 'gemini-2.0-flash-exp',
        authentication: {
          type: 'api_key',
          credentials: {
            apiKey: process.env.GEMINI_API_KEY || 'test-key'
          }
        }
      }
    });
  }

  return configs;
}

/**
 * 测试单个Provider
 */
async function testSingleProvider(config) {
  console.log(`\n🚀 开始测试 ${config.name}`);
  console.log('=' .repeat(80));

  try {
    // 创建Provider实例
    const provider = new config.providerClass(config.config, config.name);
    
    // 运行测试套件
    const testSuite = new ProviderTestSuite(provider);
    const report = await testSuite.runCompleteTestSuite();

    return report;
  } catch (error) {
    console.error(`❌ Provider ${config.name} 初始化失败:`, error.message);
    return {
      provider: config.name,
      providerType: config.type,
      timestamp: new Date().toISOString(),
      summary: { total: 0, passed: 0, failed: 1, successRate: '0%' },
      errors: [{ test: 'Provider初始化', type: 'error', error: error.message }],
      status: 'INITIALIZATION_FAILED'
    };
  }
}

/**
 * 运行所有Provider测试
 */
async function runAllProviderTests() {
  console.log('🧪 Claude Code Router - Provider功能验证测试');
  console.log('项目所有者: Jason Zhang');
  console.log('测试时间:', new Date().toISOString());
  console.log('=' .repeat(80));

  const configs = createTestConfigs();
  const allReports = [];

  console.log(`📋 发现 ${configs.length} 个Provider配置`);

  for (const config of configs) {
    try {
      const report = await testSingleProvider(config);
      allReports.push(report);
      
      // 添加延迟避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Provider ${config.name} 测试失败:`, error);
      allReports.push({
        provider: config.name,
        providerType: config.type,
        timestamp: new Date().toISOString(),
        summary: { total: 0, passed: 0, failed: 1, successRate: '0%' },
        errors: [{ test: '测试执行', type: 'error', error: error.message }],
        status: 'TEST_EXECUTION_FAILED'
      });
    }
  }

  // 生成综合报告
  generateComprehensiveReport(allReports);
  
  return allReports;
}

/**
 * 生成综合测试报告
 */
function generateComprehensiveReport(reports) {
  console.log('\n📊 综合测试报告');
  console.log('=' .repeat(80));

  const totalProviders = reports.length;
  const passedProviders = reports.filter(r => r.status === 'PASS').length;
  const failedProviders = totalProviders - passedProviders;

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  reports.forEach(report => {
    totalTests += report.summary.total;
    totalPassed += report.summary.passed;
    totalFailed += report.summary.failed;
  });

  const overallSuccessRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

  console.log('📈 总体统计:');
  console.log(`   Provider总数: ${totalProviders}`);
  console.log(`   通过Provider: ${passedProviders}`);
  console.log(`   失败Provider: ${failedProviders}`);
  console.log(`   测试总数: ${totalTests}`);
  console.log(`   通过测试: ${totalPassed}`);
  console.log(`   失败测试: ${totalFailed}`);
  console.log(`   总体成功率: ${overallSuccessRate}%`);

  console.log('\n📋 各Provider详情:');
  reports.forEach(report => {
    const status = report.status === 'PASS' ? '✅' : '❌';
    console.log(`   ${status} ${report.provider} (${report.providerType}): ${report.summary.successRate}`);
  });

  // 保存详细报告到文件
  const reportPath = path.join(__dirname, `provider-test-report-${Date.now()}.json`);
  try {
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalProviders,
        passedProviders,
        failedProviders,
        totalTests,
        totalPassed,
        totalFailed,
        overallSuccessRate: `${overallSuccessRate}%`
      },
      providerReports: reports
    }, null, 2));
    
    console.log(`\n💾 详细报告已保存: ${reportPath}`);
  } catch (error) {
    console.error('❌ 保存报告失败:', error.message);
  }

  // 检查关键功能
  console.log('\n🔍 关键功能验证:');
  
  const toolCallTests = reports.map(r => ({
    provider: r.provider,
    hasToolCall: !r.errors.some(e => e.test.includes('工具调用'))
  }));

  const multiTurnTests = reports.map(r => ({
    provider: r.provider,
    hasMultiTurn: !r.errors.some(e => e.test.includes('多轮会话'))
  }));

  console.log('   🛠️ 工具调用支持:');
  toolCallTests.forEach(test => {
    const status = test.hasToolCall ? '✅' : '❌';
    console.log(`      ${status} ${test.provider}`);
  });

  console.log('   💬 多轮会话支持:');
  multiTurnTests.forEach(test => {
    const status = test.hasMultiTurn ? '✅' : '❌';
    console.log(`      ${status} ${test.provider}`);
  });

  const allToolCallsWork = toolCallTests.every(t => t.hasToolCall);
  const allMultiTurnWork = multiTurnTests.every(t => t.hasMultiTurn);

  console.log('\n🎯 核心功能状态:');
  console.log(`   工具调用: ${allToolCallsWork ? '✅ 全部支持' : '❌ 部分失败'}`);
  console.log(`   多轮会话: ${allMultiTurnWork ? '✅ 全部支持' : '❌ 部分失败'}`);

  if (passedProviders === totalProviders && allToolCallsWork && allMultiTurnWork) {
    console.log('\n🎉 所有Provider功能验证通过！系统可正常工作。');
  } else {
    console.log('\n⚠️  部分Provider存在问题，需要进一步调试。');
  }
}

// 运行测试
if (require.main === module) {
  runAllProviderTests().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { runAllProviderTests, testSingleProvider };