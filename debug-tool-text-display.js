#!/usr/bin/env node

/**
 * 调试工具调用文本显示问题
 * 检查响应修复器是否正确清理工具调用文本
 */

const axios = require('axios');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function testToolCallDisplay() {
  console.log('🔍 测试工具调用文本显示问题');
  console.log('=====================================');
  
  const request = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: "Please use the Read tool to check the content of the package.json file."
      }
    ],
    tools: [
      {
        name: "Read",
        description: "Read file contents",
        input_schema: {
          type: "object",
          properties: {
            file_path: { type: "string" }
          },
          required: ["file_path"]
        }
      }
    ]
  };

  try {
    console.log('📤 发送工具调用测试请求...');
    
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('✅ 请求成功');
    console.log('📊 响应分析:');
    console.log('   ID:', response.data.id);
    console.log('   Model:', response.data.model);
    console.log('   Role:', response.data.role);
    console.log('   Content blocks:', response.data.content.length);
    
    // 详细分析每个content block
    response.data.content.forEach((block, index) => {
      console.log(`\n📋 Block ${index + 1}:`);
      console.log('   Type:', block.type);
      
      if (block.type === 'text') {
        console.log('   Text length:', block.text.length);
        console.log('   Text preview:', JSON.stringify(block.text.slice(0, 200)));
        
        // 检查是否包含工具调用文本
        if (block.text.includes('Tool call:')) {
          console.log('   ❌ 发现未清理的工具调用文本！');
          console.log('   工具调用文本:', block.text.match(/Tool call:[^}]*}/g));
        }
        
        // 检查是否只包含解释文字
        const cleanText = block.text.replace(/Tool call:[^}]*}/g, '').trim();
        if (cleanText) {
          console.log('   📝 剩余解释文字:', JSON.stringify(cleanText.slice(0, 100)));
        }
        
      } else if (block.type === 'tool_use') {
        console.log('   Tool name:', block.name);
        console.log('   Tool ID:', block.id);
        console.log('   Tool input:', JSON.stringify(block.input));
      }
    });
    
    // 检查是否存在同时包含文本和工具调用的问题
    const hasText = response.data.content.some(block => block.type === 'text' && block.text.trim());
    const hasToolCall = response.data.content.some(block => block.type === 'tool_use');
    const hasToolCallText = response.data.content.some(block => 
      block.type === 'text' && block.text.includes('Tool call:')
    );
    
    console.log('\n🔍 问题诊断:');
    console.log('   有文本块:', hasText ? '✅' : '❌');
    console.log('   有工具调用块:', hasToolCall ? '✅' : '❌');
    console.log('   文本中有工具调用:', hasToolCallText ? '❌' : '✅');
    
    if (hasToolCallText) {
      console.log('\n❌ 问题确认: 工具调用文本未完全清理');
      console.log('💡 需要修复响应修复器的文本清理逻辑');
    } else {
      console.log('\n✅ 工具调用文本已正确清理');
    }
    
    return !hasToolCallText;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误信息:', error.response.data);
    }
    return false;
  }
}

async function main() {
  const success = await testToolCallDisplay();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}