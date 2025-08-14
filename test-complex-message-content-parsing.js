#!/usr/bin/env node

// 测试复杂消息内容解析
const axios = require('axios');

console.log('🔍 测试复杂消息内容格式解析');
console.log('='.repeat(60));

async function testComplexMessageParsing() {
  // 创建包含复杂content结构的请求（模拟Claude Code发送的内容）
  const request = {
    model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    messages: [{
      role: 'user',
      content: [{ // 这是数组格式，应该被正确处理
        type: 'text',
        text: 'This is a complex message with array content structure. It should be processed correctly by the OpenAI input processor.'
      }]
    }],
    max_tokens: 100,
    stream: false
  };

  console.log('📤 发送包含复杂content结构的请求...');
  console.log('🔧 Content结构: array with text blocks');
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('✅ 请求成功！');
    console.log(`📊 状态: ${response.status}`);
    console.log(`📋 内容: ${JSON.stringify(response.data.content?.[0] || {}, null, 2)}`);
    
    return { success: true };
    
  } catch (error) {
    console.log('❌ 请求失败');
    if (error.response) {
      console.log(`📊 状态: ${error.response.status}`);
      console.log(`💬 错误: ${error.response.data?.error?.message || '未知错误'}`);
      
      // 检查是否是消息格式错误
      if (error.response.data?.error?.message?.includes('messages.') && 
          error.response.data?.error?.message?.includes('content')) {
        console.log('🎯 确认：这是消息content格式错误！');
        console.log('💡 我们的OpenAI输入处理器可能没有正确处理数组格式content');
        return { success: false, contentFormatError: true };
      }
    } else {
      console.log(`🌐 网络错误: ${error.message}`);
    }
    return { success: false, contentFormatError: false };
  }
}

// 同时测试对象格式content（应该引起错误的情况）
async function testObjectContentFormat() {
  const request = {
    model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct', 
    messages: [{
      role: 'user',
      content: { // 这是错误的对象格式，应该被修复
        type: 'text',
        text: 'This is object format content that should be converted to proper format'
      }
    }],
    max_tokens: 100,
    stream: false
  };

  console.log('\n📤 发送包含对象content结构的请求...');
  console.log('🔧 Content结构: object (should be fixed by processor)');
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', request, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log('✅ 请求成功！（对象content被正确转换）');
    console.log(`📊 状态: ${response.status}`);
    
    return { success: true, objectFixed: true };
    
  } catch (error) {
    console.log('❌ 请求失败');
    if (error.response?.data?.error?.message?.includes('messages.') && 
        error.response?.data?.error?.message?.includes('content')) {
      console.log('🎯 对象content格式没有被修复！');
      return { success: false, objectNotFixed: true };
    }
    return { success: false, objectNotFixed: false };
  }
}

async function runTests() {
  console.log('🧪 测试1: 数组格式content');
  const result1 = await testComplexMessageParsing();
  
  console.log('\n🧪 测试2: 对象格式content');
  const result2 = await testObjectContentFormat();
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 测试结果总结:');
  
  if (result1.contentFormatError) {
    console.log('❌ 数组格式content处理失败 - OpenAI输入处理器需要修复');
  } else if (result1.success) {
    console.log('✅ 数组格式content处理成功');
  }
  
  if (result2.objectNotFixed) {
    console.log('❌ 对象格式content没有被修复 - convertMessageContent方法可能有问题');
  } else if (result2.success) {
    console.log('✅ 对象格式content被成功转换');
  }
}

runTests().catch(console.error);