#!/usr/bin/env node

import { LMStudioBufferedProcessor } from './src/v3/provider/openai-compatible/lmstudio-buffered-processor.js';

async function simpleTest() {
  console.log('🧪 简单测试...');
  
  const processor = new LMStudioBufferedProcessor();
  
  const testData = {
    data: 'Here is the response:\n\nTool call: Bash({"command": "ls -la"})\n\nThe command will list files.',
    events: null
  };
  
  console.log('输入数据:', testData);
  
  const result = await processor.process(testData, {
    sessionId: 'test-session',
    requestId: 'test-001',
    timestamp: new Date(),
    metadata: { layer: 'test' },
    debugEnabled: true
  });
  
  console.log('结果:', JSON.stringify(result, null, 2));
  console.log('是否有事件:', !!(result.events && result.events.length > 0));
}

simpleTest().catch(console.error);