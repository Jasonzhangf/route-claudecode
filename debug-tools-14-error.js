#!/usr/bin/env node

/**
 * 调试工具调用第14个元素错误
 */

const fs = require('fs');

console.log('🔍 调试tools.14错误 - 模拟问题场景');

// 构建一个包含第14个工具为非对象的请求
const problemRequest = {
  model: "claude-3-sonnet-20240229",
  messages: [
    {
      role: "user",
      content: "使用多个工具进行复杂操作"
    }
  ],
  tools: [
    // 前13个正常工具
    ...Array.from({length: 13}, (_, i) => ({
      name: `tool_${i + 1}`,
      description: `Tool ${i + 1} description`,
      input_schema: {
        type: "object",
        properties: {
          param: {type: "string"}
        }
      }
    })),
    // 第14个工具故意设为字符串（会导致400错误）
    '{"name": "tool_14", "invalid": true}',
    // 再添加一些正常的
    {
      name: "tool_15",
      description: "Tool 15",
      input_schema: {type: "object", properties: {}}
    }
  ],
  max_tokens: 50
};

console.log('🚨 问题请求结构：');
console.log('总工具数量:', problemRequest.tools.length);
console.log('第14个工具类型:', typeof problemRequest.tools[13]);
console.log('第14个工具值:', problemRequest.tools[13]);

// 测试修复逻辑（模拟预处理器）
function testFixToolFormat(tool, index) {
  if (typeof tool !== 'object' || tool === null) {
    console.log(`🗑️ 发现无效工具at index ${index}: ${typeof tool}`);
    return null;
  }
  
  if (typeof tool === 'string') {
    console.log(`🔧 尝试解析字符串工具: ${tool}`);
    try {
      tool = JSON.parse(tool);
    } catch (e) {
      console.error(`❌ 解析失败: ${e.message}`);
      return null;
    }
  }
  
  return tool;
}

console.log('\n🔧 测试修复逻辑：');
const fixedTools = problemRequest.tools
  .map((tool, index) => testFixToolFormat(tool, index))
  .filter(tool => tool !== null);

console.log('修复后工具数量:', fixedTools.length);
console.log('移除的工具数量:', problemRequest.tools.length - fixedTools.length);

// 现在测试发送到服务器
console.log('\n🌐 发送测试请求到3456端口...');

const testRequestFixed = {
  ...problemRequest,
  tools: fixedTools
};

fetch('http://localhost:3456/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-key'
  },
  body: JSON.stringify(testRequestFixed)
})
.then(response => {
  console.log(`✅ 修复后响应状态: ${response.status}`);
  return response.json();
})
.then(data => {
  if (data.error) {
    console.error('❌ 错误响应:', data.error.message);
  } else {
    console.log('✅ 成功响应:', data.content?.[0]?.text || '(无内容)');
  }
})
.catch(error => {
  console.error('❌ 请求失败:', error.message);
});

// 同时发送原始问题请求进行对比
console.log('\n🚨 发送问题请求进行对比...');
fetch('http://localhost:3456/v1/messages', {
  method: 'POST', 
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-key'
  },
  body: JSON.stringify(problemRequest)
})
.then(response => {
  console.log(`💥 问题请求响应状态: ${response.status}`);
  return response.json();
})
.then(data => {
  if (data.error) {
    console.error('❌ 预期错误:', data.error.message);
  } else {
    console.log('意外成功响应');
  }
})
.catch(error => {
  console.error('❌ 预期错误:', error.message);
});