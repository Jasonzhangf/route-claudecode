#!/usr/bin/env node

async function directTest() {
  console.log('🧪 直接测试检测逻辑...');
  
  const testData = {
    data: 'Here is the response:\n\nTool call: Bash({"command": "ls -la"})\n\nThe command will list files.',
    events: null
  };
  
  // 直接实现检测逻辑
  function testIsLMStudioResponse(input) {
    console.log('检测输入:', input);
    console.log('输入类型:', typeof input);
    
    // 1. 检查纯字符串格式
    if (typeof input === 'string') {
      const result = input.includes('Tool call:');
      console.log('字符串检测结果:', result);
      return result;
    }
    
    // 2. 检查对象格式，包括 data 字段
    if (input && typeof input === 'object') {
      console.log('对象检测开始...');
      
      // 检查 data 字段（常见的LM Studio格式）
      if (input.data && typeof input.data === 'string') {
        const result = input.data.includes('Tool call:');
        console.log('data字段检测结果:', result);
        console.log('data内容:', input.data);
        return result;
      }
      
      console.log('data字段不存在或不是字符串');
      console.log('input.data:', input.data);
      console.log('typeof input.data:', typeof input.data);
      
      // 检查其他字段...
    }
    
    console.log('所有检测都失败');
    return false;
  }
  
  const result = testIsLMStudioResponse(testData);
  console.log('最终检测结果:', result);
}

directTest().catch(console.error);