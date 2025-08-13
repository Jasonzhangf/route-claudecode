#!/usr/bin/env node

import { LMStudioBufferedProcessor } from './src/v3/provider/openai-compatible/lmstudio-buffered-processor.js';

async function comprehensiveDebug() {
  console.log('🧪 全面调试 LM Studio 处理器...');
  
  console.log('\n1. 创建处理器实例...');
  const processor = new LMStudioBufferedProcessor();
  console.log('✅ 处理器实例创建成功');
  console.log('   名称:', processor.name);
  console.log('   版本:', processor.version);
  console.log('   层类型:', processor.layerType);
  
  console.log('\n2. 准备测试数据...');
  const testData = {
    data: 'Here is the response:\n\nTool call: Bash({"command": "ls -la"})\n\nThe command will list files.',
    events: null
  };
  
  const context = {
    sessionId: 'test-session',
    requestId: 'test-001',
    timestamp: new Date(),
    metadata: { layer: 'test' },
    debugEnabled: true
  };
  
  console.log('   测试数据类型:', typeof testData);
  console.log('   有 data 字段:', !!testData.data);
  console.log('   data 类型:', typeof testData.data);
  console.log('   包含 Tool call:', testData.data.includes('Tool call:'));
  
  console.log('\n3. 手动检测逻辑测试...');
  // 手动复制检测逻辑
  let shouldProcess = false;
  if (testData && typeof testData === 'object') {
    if (testData.data && typeof testData.data === 'string') {
      shouldProcess = testData.data.includes('Tool call:');
    }
  }
  console.log('   手动检测结果:', shouldProcess);
  
  console.log('\n4. 调用处理器方法...');
  try {
    console.log('   开始处理...');
    const result = await processor.process(testData, context);
    
    console.log('\n5. 处理结果分析...');
    console.log('   结果类型:', typeof result);
    console.log('   有 events 字段:', !!result.events);
    if (result.events) {
      console.log('   events 长度:', result.events.length);
      console.log('   events 类型:', Array.isArray(result.events) ? 'array' : typeof result.events);
    }
    console.log('   结果与输入相同:', result === testData);
    
    console.log('\n6. 详细结果输出...');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('\n❌ 处理器调用失败:', error.message);
    console.error('   错误堆栈:', error.stack);
  }
}

comprehensiveDebug().catch(console.error);