#!/usr/bin/env node

/**
 * 简单Provider创建测试
 */

const { createPureOpenAIClient } = require('./dist/cli.js');

async function test() {
  try {
    console.log('🧪 开始Provider创建测试...');
    
    const config = {
      type: 'openai',
      apiKey: 'test',
      baseURL: 'http://localhost:1234/v1',
      defaultModel: 'test'
    };

    console.log('⚙️ 创建Provider...');
    const provider = createPureOpenAIClient(config, 'test-id');
    console.log('✅ 成功创建:', provider.name, provider.type);

  } catch (error) {
    console.error('❌ 创建失败:', error.message);
  }
}

test();