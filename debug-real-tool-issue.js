#!/usr/bin/env node

/**
 * 模拟生产环境中工具调用被显示的问题
 * 使用与生产日志相同的场景进行测试
 */

const axios = require('axios');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function testProductionScenario() {
  console.log('🔍 测试生产环境工具调用显示问题');
  console.log('=======================================');
  
  // 创建一个大请求，确保路由到longcontext → gemini-2.5-pro
  const largeContent = `
Please help me analyze this project structure and read the package.json file to understand the dependencies.

Here's a lot of context to make this request large enough to trigger longcontext routing:
${'This is additional context. '.repeat(1000)}

Please use the Read tool to check the package.json file.
  `.trim();

  const request = {
    model: "claude-sonnet-4-20250514", // 会被路由到gemini-2.5-pro
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: largeContent
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
      },
      {
        name: "Bash",
        description: "Execute bash commands",
        input_schema: {
          type: "object",
          properties: {
            command: { type: "string" },
            description: { type: "string" }
          },
          required: ["command"]
        }
      }
    ]
  };

  try {
    console.log('📤 发送longcontext工具调用测试请求...');
    console.log('📊 请求大小:', JSON.stringify(request).length, '字符');
    console.log('📊 预期路由: longcontext → shuaihong-openai → gemini-2.5-pro');
    
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 60000
    });
    
    console.log('✅ 请求成功');
    console.log('📊 响应分析:');
    console.log('   ID:', response.data.id);
    console.log('   Model:', response.data.model);
    console.log('   Role:', response.data.role);
    console.log('   Content blocks:', response.data.content.length);
    
    let foundToolCallText = false;
    let toolCallTexts = [];
    
    // 详细分析每个content block
    response.data.content.forEach((block, index) => {
      console.log(`\n📋 Block ${index + 1}:`);
      console.log('   Type:', block.type);
      
      if (block.type === 'text') {
        console.log('   Text length:', block.text.length);
        
        // 检查是否包含"Tool call:"文本
        const toolCallMatches = block.text.match(/Tool call:[^}]*}[^}]*}/g);
        if (toolCallMatches) {
          foundToolCallText = true;
          toolCallTexts.push(...toolCallMatches);
          console.log('   ❌ 发现工具调用文本被显示!');
          toolCallMatches.forEach((match, i) => {
            console.log(`     ${i+1}. ${match}`);
          });
        }
        
        // 显示文本预览
        const preview = block.text.slice(0, 300);
        console.log('   Text preview:', JSON.stringify(preview));
        
      } else if (block.type === 'tool_use') {
        console.log('   Tool name:', block.name);
        console.log('   Tool ID:', block.id);
        console.log('   Tool input keys:', Object.keys(block.input || {}));
      }
    });
    
    console.log('\n🔍 问题诊断结果:');
    console.log('   实际路由模型:', response.data.model);
    console.log('   Content blocks数量:', response.data.content.length);
    console.log('   发现工具调用文本:', foundToolCallText ? '❌ YES' : '✅ NO');
    
    if (foundToolCallText) {
      console.log('\n❌ 问题确认: 工具调用文本被错误显示给用户');
      console.log('🔧 发现的工具调用文本:');
      toolCallTexts.forEach((text, i) => {
        console.log(`   ${i+1}. ${text}`);
      });
      console.log('\n💡 这确实是需要修复的问题！');
      console.log('   原因: 响应修复器移除工具调用后，文本块仍然被保留显示');
    } else {
      console.log('\n✅ 工具调用文本处理正常，未发现显示问题');
    }
    
    return !foundToolCallText;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误数据:', error.response.data);
    }
    return false;
  }
}

async function main() {
  const success = await testProductionScenario();
  
  console.log('\n📋 测试总结:');
  console.log('=============');
  console.log('问题状态:', success ? '✅ 已修复' : '❌ 仍存在');
  
  if (!success) {
    console.log('\n🔧 修复建议:');
    console.log('1. 检查响应修复器中的文本清理逻辑');
    console.log('2. 确保工具调用文本被完全移除，而不是留下剩余文本');
    console.log('3. 考虑完全跳过包含工具调用的文本块');
  }
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}