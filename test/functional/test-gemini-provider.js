#!/usr/bin/env node
/**
 * Gemini Provider功能验证测试
 * 测试端口5502 (Google Gemini API)
 * 项目所有者: Jason Zhang
 */

const path = require('path');

// 修复模块导入路径
const { ProviderTestSuite } = require('./provider-test-suite');

async function testGeminiProvider() {
  console.log('🧪 Gemini Provider功能验证测试');
  console.log('=' .repeat(60));

  let result;

  try {
    // 导入Gemini Client - 使用构建后的模块
    const { GeminiClient } = require('../../dist/providers/gemini');
    console.log('✅ 成功导入GeminiClient');

    // Gemini配置 (端口5502)
    const geminiConfig = {
      endpoint: 'http://localhost:5502',
      defaultModel: 'gemini-2.0-flash-exp',
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: process.env.GEMINI_API_KEY || 'test-key'
        }
      },
      httpOptions: {
        timeout: 60000,
        maxRetries: 2,
        defaultHeaders: {
          'User-Agent': 'claude-code-router-test/1.0',
          'Content-Type': 'application/json'
        }
      }
    };

    console.log('\n🔧 测试 Google Gemini (端口5502)');
    console.log(`   模型: ${geminiConfig.defaultModel}`);
    console.log(`   端点: ${geminiConfig.endpoint}`);

    const geminiProvider = new GeminiClient(geminiConfig, 'gemini-test');
    
    // 先测试基础连接
    console.log('\n🏥 执行健康检查...');
    const isHealthy = await geminiProvider.isHealthy();
    console.log(`   健康状态: ${isHealthy ? '✅ 正常' : '❌ 异常'}`);

    const geminiTestSuite = new ProviderTestSuite(geminiProvider);
    result = await geminiTestSuite.runCompleteTestSuite();

  } catch (error) {
    console.error('❌ Gemini Provider测试失败:', error.message);
    console.error('   错误详情:', error.stack);
    
    result = {
      provider: 'Gemini-Error',
      providerType: 'gemini',
      timestamp: new Date().toISOString(),
      summary: { total: 0, passed: 0, failed: 1, successRate: '0%' },
      errors: [{ test: 'Provider初始化', type: 'error', error: error.message }],
      status: 'INITIALIZATION_FAILED'
    };
  }

  // 生成Gemini特定报告
  generateGeminiReport(result);
  
  return result;
}

function generateGeminiReport(result) {
  console.log('\n📊 Gemini Provider测试总结');
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

  // Gemini特定功能验证
  console.log('\n🔍 Gemini特定功能验证:');
  
  const hasBasicConnection = !result.errors.some(e => e.test.includes('基础连接'));
  const hasToolCalls = !result.errors.some(e => e.test.includes('工具调用'));
  const hasMultiTurn = !result.errors.some(e => e.test.includes('多轮会话'));
  const hasStreaming = !result.errors.some(e => e.test.includes('流式'));
  const hasAuthentication = result.status !== 'INITIALIZATION_FAILED';

  console.log(`   API Key认证: ${hasAuthentication ? '✅ 认证成功' : '❌ 认证失败'}`);
  console.log(`   基础连接: ${hasBasicConnection ? '✅ 连接正常' : '❌ 连接失败'}`);
  console.log(`   Gemini模型: ${hasBasicConnection ? '✅ 模型可用' : '❌ 模型不可用'}`);
  console.log(`   工具调用: ${hasToolCalls ? '✅ 工具调用正常' : '❌ 工具调用失败'}`);
  console.log(`   多轮会话: ${hasMultiTurn ? '✅ 多轮会话正常' : '❌ 多轮会话失败'}`);
  console.log(`   流式响应: ${hasStreaming ? '✅ 流式正常' : '❌ 流式失败'}`);

  // 特殊诊断信息
  if (result.errors.some(e => e.error && (e.error.includes('401') || e.error.includes('403')))) {
    console.log('\n⚠️  诊断建议: 检测到认证错误');
    console.log('   1. 验证GEMINI_API_KEY环境变量是否设置');
    console.log('   2. 检查API Key是否有效且未过期');
    console.log('   3. 确认API配额和权限设置');
  }

  if (result.errors.some(e => e.error && (e.error.includes('ECONNREFUSED') || e.error.includes('timeout')))) {
    console.log('\n⚠️  诊断建议: 检测到连接问题');
    console.log('   1. 确认端口5502服务是否启动');
    console.log('   2. 检查Gemini服务配置');
    console.log('   3. 验证网络连接状态');
  }

  if (result.errors.some(e => e.error && e.error.includes('model'))) {
    console.log('\n⚠️  诊断建议: 检测到模型相关问题');
    console.log('   1. 验证gemini-2.0-flash-exp模型是否可用');
    console.log('   2. 检查模型权限和区域限制');
    console.log('   3. 尝试使用其他可用的Gemini模型');
  }

  if (result.status === 'PASS') {
    console.log('\n🎉 Gemini Provider功能验证完全通过！');
    console.log('   ✅ Google Gemini API响应正常');
    console.log('   ✅ 工具调用功能完整');
    console.log('   ✅ 多轮对话支持良好');
    console.log('   ✅ 流式响应工作正常');
  } else if (result.summary.passed > 0) {
    console.log('\n⚠️  Gemini Provider部分功能正常，存在部分问题。');
    console.log(`   ✅ ${result.summary.passed}个测试通过`);
    console.log(`   ❌ ${result.summary.failed}个测试失败`);
  } else {
    console.log('\n❌ Gemini Provider存在严重问题，需要排查配置。');
  }

  // 性能和特性评估
  console.log('\n🚀 Gemini特性评估:');
  console.log('   🧠 多模态能力: Gemini支持文本、图像、视频等多种输入');
  console.log('   ⚡ 响应速度: Gemini 2.0 Flash针对速度优化');
  console.log('   🔧 工具调用: 原生支持Function calling');
  console.log('   💬 长上下文: 支持大规模上下文窗口');

  // 环境检查提示
  console.log('\n🔧 环境检查提示:');
  console.log('   1. 确保已启动Gemini服务: rcc start config-google-gemini-5502.json');
  console.log('   2. 验证GEMINI_API_KEY环境变量');
  console.log('   3. 检查Google Cloud项目和API权限');
  console.log('   4. 确认网络可访问Google API');
}

// 运行测试
if (require.main === module) {
  testGeminiProvider().catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testGeminiProvider };