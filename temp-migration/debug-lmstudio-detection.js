#!/usr/bin/env node

import { LMStudioBufferedProcessor } from './src/v3/provider/openai-compatible/lmstudio-buffered-processor.js';

async function debugLMStudioDetection() {
  console.log('🔍 调试 LM Studio 检测逻辑...');
  
  const processor = new LMStudioBufferedProcessor();
  
  // 测试数据
  const testCases = [
    {
      name: '基本工具调用',
      data: {
        data: 'Here is the response:\n\nTool call: Bash({"command": "ls -la"})\n\nThe command will list files.',
        events: null
      }
    },
    {
      name: '字符串格式',
      data: 'Here is the response:\n\nTool call: Bash({"command": "ls -la"})\n\nThe command will list files.'
    },
    {
      name: '事件数组格式',
      data: {
        events: [
          {
            choices: [{
              delta: {
                content: 'Tool call: Edit({"file_path": "/test"})'
              }
            }]
          }
        ]
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 测试: ${testCase.name}`);
    console.log('输入数据:', JSON.stringify(testCase.data, null, 2));
    
    try {
      const result = await processor.process(testCase.data, {
        sessionId: 'debug-session',
        requestId: 'debug-001',
        timestamp: new Date(),
        metadata: { layer: 'test' },
        debugEnabled: true
      });
      
      console.log('处理结果:', JSON.stringify(result, null, 2));
      console.log('是否生成了事件:', !!(result.events && result.events.length > 0));
      
    } catch (error) {
      console.log('处理错误:', error.message);
    }
  }
}

debugLMStudioDetection();