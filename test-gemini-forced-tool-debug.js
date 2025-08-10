#!/usr/bin/env node
/**
 * Gemini强制工具调用问题调试 - 分析空content错误
 * Project owner: Jason Zhang
 */

async function testGeminiForcedToolDebug() {
  console.log('🔍 调试Gemini强制工具调用空content问题...\n');
  
  // 使用项目服务器测试强制工具调用
  const testRequest = {
    "model": "gemini-2.5-flash",
    "messages": [
      {
        "role": "user", 
        "content": "MUST use get_time function to get current UTC time. This is required!"
      }
    ],
    "tools": [
      {
        "function": {
          "name": "get_time",
          "description": "Get current time in specified timezone",
          "parameters": {
            "type": "object",
            "properties": {
              "timezone": {
                "type": "string",
                "enum": ["UTC", "EST", "PST"]
              }
            },
            "required": ["timezone"]
          }
        }
      }
    ],
    "tool_choice": "required",  // 🔥 强制工具调用
    "max_tokens": 1000
  };
  
  console.log('🚀 发送强制工具调用请求到CCR系统...');
  console.log('📝 请求配置:');
  console.log('- tool_choice:', testRequest.tool_choice);
  console.log('- 工具数量:', testRequest.tools.length);
  console.log('- 模型:', testRequest.model);
  
  try {
    const response = await fetch('http://localhost:5502/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testRequest)
    });
    
    const result = await response.json();
    
    if (result.error) {
      console.log('\n❌ 捕获到错误响应:');
      console.log('- 错误类型:', result.error.type);
      console.log('- 错误消息:', result.error.message);
      console.log('- 错误阶段:', result.error.stage);
      console.log('- Provider:', result.error.provider);
      console.log('- 完整错误:', JSON.stringify(result.error, null, 2));
      
      if (result.error.message.includes('candidate missing content or parts')) {
        console.log('\n🎯 确认这是我们需要修复的空content问题！');
        console.log('💡 解决方案参考:');
        console.log('   1. 改进UNEXPECTED_TOOL_CALL处理逻辑');
        console.log('   2. 添加工具调用强制失败的优雅处理');  
        console.log('   3. 为强制工具调用提供备用响应策略');
      }
      
    } else {
      console.log('\n✅ 成功响应:');
      console.log('- choices数量:', result.choices?.length);
      console.log('- 第一个choice内容:', result.choices?.[0]?.message?.content?.substring(0, 200));
    }
    
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
  }
  
  console.log('\n🔧 现在测试不同的tool_choice设置:');
  
  // 测试AUTO模式
  const autoRequest = { ...testRequest, tool_choice: 'auto' };
  console.log('\n📋 测试AUTO模式...');
  
  try {
    const response = await fetch('http://localhost:5502/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(autoRequest)
    });
    
    const result = await response.json();
    
    if (result.error) {
      console.log('❌ AUTO模式错误:', result.error.message);
    } else {
      console.log('✅ AUTO模式成功');
      console.log('- 响应长度:', result.choices?.[0]?.message?.content?.length);
      console.log('- 内容预览:', result.choices?.[0]?.message?.content?.substring(0, 100) + '...');
    }
    
  } catch (error) {
    console.log('❌ AUTO模式请求失败:', error.message);
  }
  
  console.log('\n🎯 调试总结:');
  console.log('1. 确认了强制工具调用(required)导致空content错误');
  console.log('2. AUTO模式可能工作正常');
  console.log('3. 需要改进transformer对强制工具调用失败的处理');
  console.log('4. 关键修复: 当Gemini无法满足强制工具调用时的优雅降级');
}

testGeminiForcedToolDebug().catch(console.error);