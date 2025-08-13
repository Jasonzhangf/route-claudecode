#!/usr/bin/env node

async function traceDebug() {
  console.log('🧪 跟踪调试...');
  
  console.log('\n1. 导入处理器...');
  try {
    const { LMStudioBufferedProcessor } = await import('./src/v3/provider/openai-compatible/lmstudio-buffered-processor.js');
    console.log('✅ 导入成功');
    
    console.log('\n2. 创建实例...');
    const processor = new LMStudioBufferedProcessor();
    console.log('✅ 实例创建成功');
    
    console.log('\n3. 检查方法...');
    console.log('   process 方法存在:', typeof processor.process === 'function');
    console.log('   isLMStudioResponse 方法存在:', typeof processor.isLMStudioResponse === 'function');
    
    console.log('\n4. 测试前调用标记...');
    console.log('   即将调用 process 方法...');
    
    const testData = {
      data: 'Tool call: Bash({"command": "test"})',
      events: null
    };
    
    const context = {
      sessionId: 'trace-session',
      requestId: 'trace-001',
      timestamp: new Date(),
      metadata: { layer: 'trace' },
      debugEnabled: true
    };
    
    console.log('\n5. 正在调用 process...');
    const result = await processor.process(testData, context);
    console.log('✅ process 调用完成');
    
    console.log('\n6. 结果分析...');
    console.log('   输入:', testData);
    console.log('   输出:', result);
    console.log('   相同对象:', result === testData);
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error('   堆栈:', error.stack);
  }
}

traceDebug();