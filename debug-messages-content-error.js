#!/usr/bin/env node

// 调试messages content格式错误
console.log('🔍 调试messages content格式错误');

const testRequest = {
  model: 'Qwen3-Coder-480B',
  messages: [
    {
      role: 'user',
      content: { type: 'text', text: 'Hello world' }
    }
  ],
  max_tokens: 1000,
  stream: false
};

console.log('📥 原始消息:', JSON.stringify(testRequest.messages[0], null, 2));

// 模拟当前的convertMessageContent逻辑
function convertMessageContent(msg) {
  const content = [];
  if (msg.content) {
    if (typeof msg.content === 'string') {
      content.push({ type: 'text', text: msg.content });
    } else if (Array.isArray(msg.content)) {
      msg.content.forEach(block => {
        if (block.type === 'text') {
          content.push({ type: 'text', text: block.text });
        } else {
          content.push(block);
        }
      });
    } else if (typeof msg.content === 'object' && msg.content !== null) {
      const contentObj = msg.content;
      if (contentObj.type === 'text' && contentObj.text) {
        content.push({ type: 'text', text: contentObj.text });
      } else {
        content.push({ type: 'text', text: JSON.stringify(msg.content) });
      }
    }
  }
  return content;
}

const convertedContent = convertMessageContent(testRequest.messages[0]);
console.log('🔄 转换后内容:', JSON.stringify(convertedContent, null, 2));
console.log('❌ 问题: content应该是字符串，但现在是对象数组');

// 正确的方法：如果是对象格式，直接提取text字符串
function fixMessageContent(msg) {
  if (msg.content) {
    if (typeof msg.content === 'string') {
      return msg.content; // 直接返回字符串
    } else if (Array.isArray(msg.content)) {
      // 如果是数组，保持数组格式
      return msg.content;
    } else if (typeof msg.content === 'object' && msg.content !== null) {
      const contentObj = msg.content;
      if (contentObj.type === 'text' && contentObj.text) {
        return contentObj.text; // 直接返回文本字符串
      } else {
        return JSON.stringify(msg.content); // 转换为字符串
      }
    }
  }
  return '';
}

const fixedContent = fixMessageContent(testRequest.messages[0]);
console.log('✅ 修复后内容:', JSON.stringify(fixedContent, null, 2));
console.log('✅ 类型:', typeof fixedContent);

// 模拟预处理器的新修复逻辑
function simulatePreprocessorFix(msg) {
  if (msg.content && typeof msg.content === 'object' && !Array.isArray(msg.content)) {
    console.log('🔧 [PREPROCESSOR-FIX] Detected object content, converting to string format');
    if (msg.content.type === 'text' && msg.content.text) {
      return {
        ...msg,
        content: msg.content.text // 直接提取text字符串
      };
    } else {
      return {
        ...msg,
        content: JSON.stringify(msg.content)
      };
    }
  }
  return msg;
}

// 测试预处理器修复
const preprocessedMessage = simulatePreprocessorFix(testRequest.messages[0]);
console.log('🔧 预处理器修复后:', JSON.stringify(preprocessedMessage, null, 2));

// 测试API调用
async function testAPICall() {
  const testFixedRequest = {
    ...testRequest,
    messages: [preprocessedMessage]
  };
  
  console.log('🧪 测试修复后的API请求:', JSON.stringify(testFixedRequest, null, 2));
  
  // 验证content格式
  const contentType = typeof testFixedRequest.messages[0].content;
  console.log('✅ Content类型验证:', contentType);
  console.log('✅ 是否为字符串:', contentType === 'string');
}

testAPICall();