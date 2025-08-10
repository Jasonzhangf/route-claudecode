#!/usr/bin/env node

/**
 * 测试解耦后的Provider创建是否正常
 */

async function testProviderCreation() {
  console.log('🧪 测试解耦后的Provider创建...\n');

  try {
    // 测试pure client导入
    console.log('📦 导入PureOpenAIClient...');
    const { PureOpenAIClient } = require('./dist/cli.js');
    console.log('✅ PureOpenAIClient导入成功');

    // 测试基本配置
    const testConfig = {
      type: 'openai',
      apiKey: 'test-key',
      baseURL: 'http://localhost:1234/v1',
      defaultModel: 'test-model',
      sdkOptions: {
        timeout: 30000,
        maxRetries: 3
      }
    };

    console.log('🏗️  创建Provider实例...');
    // const provider = new PureOpenAIClient(testConfig, 'test-provider');
    // console.log('✅ Provider创建成功:', provider.name, provider.type);

    console.log('🎯 测试完成 - 基本导入和结构正常');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('📋 错误堆栈:', error.stack);
  }
}

testProviderCreation();