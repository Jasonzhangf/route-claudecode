#!/usr/bin/env node

/**
 * 验证最终修复：包含工具调用的文本块完全不显示
 */

const axios = require('axios');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function testFinalFix() {
  console.log('🔍 验证最终修复：工具调用文本完全不显示');
  console.log('============================================');
  
  const request = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: "Please read the package.json file and tell me about the project dependencies."
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
      },
      timeout: 30000
    });
    
    console.log('✅ 请求成功');
    console.log('📊 响应分析:');
    console.log('   ID:', response.data.id);
    console.log('   Model:', response.data.model);
    console.log('   Content blocks:', response.data.content?.length || 0);
    
    if (!response.data.content) {
      console.log('❌ 响应中没有content字段');
      return false;
    }
    
    let hasTextBlock = false;
    let hasToolBlock = false;
    let textContainsToolCall = false;
    
    // 分析每个content block
    response.data.content.forEach((block, index) => {
      console.log(`\n📋 Block ${index + 1}:`);
      console.log('   Type:', block.type);
      
      if (block.type === 'text') {
        hasTextBlock = true;
        console.log('   Text length:', block.text.length);
        console.log('   Text content:', JSON.stringify(block.text));
        
        // 检查是否包含工具调用文本
        if (block.text.includes('Tool call:')) {
          textContainsToolCall = true;
          console.log('   ❌ 仍包含工具调用文本！');
        }
        
      } else if (block.type === 'tool_use') {
        hasToolBlock = true;
        console.log('   Tool name:', block.name);
        console.log('   Tool ID:', block.id);
        console.log('   Tool input:', JSON.stringify(block.input));
      }
    });
    
    console.log('\n🔍 修复验证结果:');
    console.log('   有文本块:', hasTextBlock ? '是' : '否');
    console.log('   有工具块:', hasToolBlock ? '是' : '否');
    console.log('   文本包含工具调用:', textContainsToolCall ? '❌ 是' : '✅ 否');
    
    // 理想情况：只有工具块，没有包含工具调用的文本块
    const isFixed = hasToolBlock && !textContainsToolCall;
    
    if (isFixed) {
      console.log('\n🎉 修复成功！');
      console.log('✅ 工具调用被正确提取为独立块');
      console.log('✅ 包含工具调用的原始文本块被完全移除');
      console.log('✅ 用户不会看到"Tool call: ..."文本');
    } else {
      console.log('\n❌ 修复失败');
      if (!hasToolBlock) {
        console.log('   - 工具调用未被提取');
      }
      if (textContainsToolCall) {
        console.log('   - 原始文本块仍然显示工具调用文本');
      }
    }
    
    return isFixed;
    
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
  console.log('等待服务器启动...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const success = await testFinalFix();
  
  console.log('\n📋 最终修复验证:');
  console.log('==================');
  console.log('修复状态:', success ? '✅ 成功' : '❌ 失败');
  
  if (success) {
    console.log('\n🎯 修复效果:');
    console.log('✅ 工具调用文本不再显示给用户');
    console.log('✅ 工具调用被正确提取为独立块');
    console.log('✅ 原始包含工具调用的文本块被完全跳过');
    console.log('\n💡 用户现在只会看到纯净的工具调用，不会看到混乱的文本');
  }
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}