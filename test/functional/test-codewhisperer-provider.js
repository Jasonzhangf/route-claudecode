#!/usr/bin/env node
/**
 * CodeWhisperer Provider功能验证测试
 * 测试端口5504 (Kiro Gmail账号)
 * 项目所有者: Jason Zhang
 */

const { ProviderTestSuite } = require('./provider-test-suite');

async function testCodeWhispererProvider() {
  console.log('🧪 CodeWhisperer Provider功能验证测试');
  console.log('=' .repeat(60));

  let result;

  try {
    // 尝试导入CodeWhisperer Unified Client (优先)
    let CodeWhispererProvider;
    try {
      ({ CodeWhispererUnifiedClient: CodeWhispererProvider } = require('../../src/providers/codewhisperer'));
      console.log('✅ 使用CodeWhispererUnifiedClient (重构版)');
    } catch (error) {
      try {
        ({ CodeWhispererProvider } = require('../../src/providers/codewhisperer'));
        console.log('⚠️  降级使用CodeWhispererProvider (传统版)');
      } catch (fallbackError) {
        // 最后尝试EnhancedCodeWhispererClient
        ({ EnhancedCodeWhispererClient: CodeWhispererProvider } = require('../../src/providers/codewhisperer'));
        console.log('⚠️  使用EnhancedCodeWhispererClient (增强版)');
      }
    }

    // CodeWhisperer配置 (端口5504 - Kiro Gmail)
    const cwConfig = {
      endpoint: 'http://localhost:5504',
      defaultModel: 'CLAUDE_SONNET_4_20250514_V1_0',
      region: 'us-east-1',
      profileArn: process.env.CODEWHISPERER_PROFILE_ARN || 'test-profile-arn',
      authMethod: 'social',
      authentication: {
        type: 'oauth',
        credentials: {
          // CodeWhisperer使用OAuth，不需要API key
        }
      },
      httpOptions: {
        timeout: 120000,  // CodeWhisperer需要更长的超时时间
        maxRetries: 2,
        defaultHeaders: {
          'User-Agent': 'claude-code-router-test/1.0',
          'Accept': 'application/json'
        }
      }
    };

    console.log('\n🔧 测试 CodeWhisperer Kiro Gmail (端口5504)');
    console.log(`   模型: ${cwConfig.defaultModel}`);
    console.log(`   认证方法: ${cwConfig.authMethod}`);

    const cwProvider = new CodeWhispererProvider(cwConfig, 'codewhisperer-kiro-gmail-test');
    const cwTestSuite = new ProviderTestSuite(cwProvider);
    result = await cwTestSuite.runCompleteTestSuite();

  } catch (error) {
    console.error('❌ CodeWhisperer Provider测试失败:', error.message);
    console.error('   错误详情:', error.stack);
    
    result = {
      provider: 'CodeWhisperer-Error',
      providerType: 'codewhisperer',
      timestamp: new Date().toISOString(),
      summary: { total: 0, passed: 0, failed: 1, successRate: '0%' },
      errors: [{ test: 'Provider初始化', type: 'error', error: error.message }],
      status: 'INITIALIZATION_FAILED'
    };
  }

  // 生成CodeWhisperer特定报告
  generateCodeWhispererReport(result);
  
  return result;
}

function generateCodeWhispererReport(result) {
  console.log('\n📊 CodeWhisperer Provider测试总结');
  console.log('=' .repeat(50));

  console.log(`📈 测试统计:`);
  console.log(`   Provider: ${result.provider}`);
  console.log(`   类型: ${result.providerType}`);
  console.log(`   测试总数: ${result.summary.total}`);
  console.log(`   通过测试: ${result.summary.passed}`);
  console.log(`   失败测试: ${result.summary.failed}`);
  console.log(`   成功率: ${result.summary.successRate}`);
  console.log(`   状态: ${result.status}`);

  if (result.errors.length > 0) {
    console.log('\n❌ 错误详情:');
    result.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.test}:`);
      console.log(`      类型: ${error.type}`);
      console.log(`      详情: ${error.reason || error.error}`);
    });
  }

  // CodeWhisperer特定功能验证
  console.log('\n🔍 CodeWhisperer特定功能验证:');
  
  const hasBasicConnection = !result.errors.some(e => e.test.includes('基础连接'));
  const hasToolCalls = !result.errors.some(e => e.test.includes('工具调用'));
  const hasMultiTurn = !result.errors.some(e => e.test.includes('多轮会话'));
  const hasStreaming = !result.errors.some(e => e.test.includes('流式'));
  const hasAuthentication = result.status !== 'INITIALIZATION_FAILED';

  console.log(`   OAuth认证: ${hasAuthentication ? '✅ 认证成功' : '❌ 认证失败'}`);
  console.log(`   基础连接: ${hasBasicConnection ? '✅ 连接正常' : '❌ 连接失败'}`);
  console.log(`   Claude模型: ${hasBasicConnection ? '✅ 模型可用' : '❌ 模型不可用'}`);
  console.log(`   工具调用: ${hasToolCalls ? '✅ 工具调用正常' : '❌ 工具调用失败'}`);
  console.log(`   多轮会话: ${hasMultiTurn ? '✅ 多轮会话正常' : '❌ 多轮会话失败'}`);
  console.log(`   流式响应: ${hasStreaming ? '✅ 流式正常' : '❌ 流式失败'}`);

  // 特殊诊断信息
  if (result.errors.some(e => e.error && e.error.includes('401'))) {
    console.log('\n⚠️  诊断建议: 检测到401错误，可能是认证问题');
    console.log('   1. 验证CodeWhisperer OAuth token是否有效');
    console.log('   2. 检查profileArn配置是否正确');
    console.log('   3. 确认账号权限是否足够');
  }

  if (result.errors.some(e => e.error && (e.error.includes('ECONNREFUSED') || e.error.includes('timeout')))) {
    console.log('\n⚠️  诊断建议: 检测到连接问题');
    console.log('   1. 确认端口5504服务是否启动');
    console.log('   2. 检查网络连接是否正常');
    console.log('   3. 验证防火墙设置');
  }

  if (result.status === 'PASS') {
    console.log('\n🎉 CodeWhisperer Provider功能验证完全通过！');
    console.log('   ✅ Claude模型响应正常');
    console.log('   ✅ 工具调用功能完整');
    console.log('   ✅ 多轮对话支持良好');
  } else if (result.summary.passed > 0) {
    console.log('\n⚠️  CodeWhisperer Provider部分功能正常，存在部分问题。');
    console.log(`   ✅ ${result.summary.passed}个测试通过`);
    console.log(`   ❌ ${result.summary.failed}个测试失败`);
  } else {
    console.log('\n❌ CodeWhisperer Provider存在严重问题，需要排查配置。');
  }

  // 环境检查提示
  console.log('\n🔧 环境检查提示:');
  console.log('   1. 确保已启动CodeWhisperer服务: rcc start config-codewhisperer-kiro-gmail-5504.json');
  console.log('   2. 验证OAuth认证状态');
  console.log('   3. 检查网络连接和防火墙设置');
  console.log('   4. 确认模型权限和配额');
}

// 运行测试
if (require.main === module) {
  testCodeWhispererProvider().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testCodeWhispererProvider };