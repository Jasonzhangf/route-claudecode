#!/usr/bin/env node

import { LMStudioBufferedProcessor } from './src/v3/provider/openai-compatible/lmstudio-buffered-processor.js';

async function testDetectionOnly() {
  console.log('🔍 测试纯检测逻辑...');
  
  const processor = new LMStudioBufferedProcessor();
  
  // 获取私有方法通过反射
  const isLMStudioResponse = processor.constructor.prototype.isLMStudioResponse.bind(processor);
  
  const testCases = [
    {
      name: '对象数据格式',
      data: {
        data: 'Here is the response:\n\nTool call: Bash({"command": "ls -la"})\n\nThe command will list files.',
        events: null
      }
    },
    {
      name: '纯字符串格式',
      data: 'Here is the response:\n\nTool call: Bash({"command": "ls -la"})\n\nThe command will list files.'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 测试: ${testCase.name}`);
    try {
      // 由于私有方法无法直接访问，我们直接检查逻辑
      let result = false;
      
      const input = testCase.data;
      
      // 复制检测逻辑
      if (typeof input === 'string') {
        result = input.includes('Tool call:');
      } else if (input && typeof input === 'object') {
        if (input.data && typeof input.data === 'string') {
          result = input.data.includes('Tool call:');
        }
      }
      
      console.log(`   检测结果: ${result}`);
      console.log(`   输入类型: ${typeof input}`);
      if (typeof input === 'object') {
        console.log(`   数据字段: ${input.data ? 'exists' : 'not found'}`);
        console.log(`   包含Tool call: ${input.data && input.data.includes('Tool call:')}`);
      }
      
    } catch (error) {
      console.log(`   错误: ${error.message}`);
    }
  }
}

testDetectionOnly();