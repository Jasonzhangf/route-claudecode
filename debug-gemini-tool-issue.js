#!/usr/bin/env node

/**
 * 强制测试gemini-2.5-pro的工具调用显示问题
 * 创建足够大的请求确保路由到longcontext类别
 */

const axios = require('axios');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function testGeminiToolCallIssue() {
  console.log('🔍 强制测试Gemini工具调用显示问题');
  console.log('=====================================');
  
  // 创建超大请求，确保触发45K+ tokens阈值
  const baseContent = `Please analyze this complex codebase and help me understand the structure. `;
  const repeatedContent = baseContent.repeat(2000); // 约100K字符，应该超过45K tokens
  
  const largeContent = `
${repeatedContent}

Now please use the Read tool to examine the package.json file and then use Bash to run a quick status check.

This is a complex development task that requires careful analysis.
  `.trim();

  const request = {
    model: "claude-sonnet-4-20250514", // 应该路由到gemini-2.5-pro
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
    console.log('📤 发送超大longcontext工具调用请求...');
    console.log('📊 请求大小:', JSON.stringify(request).length, '字符');
    console.log('📊 内容大小:', largeContent.length, '字符');
    console.log('📊 预期: 应路由到longcontext → shuaihong-openai → gemini-2.5-pro');
    
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 120000 // 2分钟超时
    });
    
    console.log('✅ 请求成功');
    console.log('📊 响应分析:');
    console.log('   ID:', response.data.id);
    console.log('   Model:', response.data.model, response.data.model === 'gemini-2.5-pro' ? '✅' : '❌');
    console.log('   Role:', response.data.role);
    console.log('   Content blocks:', response.data.content.length);
    
    let foundToolCallText = false;
    let foundResponseFixes = false;
    
    // 检查响应是否包含修复标记
    if (response.data.metadata && response.data.metadata.fixes_applied) {
      foundResponseFixes = true;
      console.log('   修复应用:', response.data.metadata.fixes_applied);
    }
    
    // 详细分析每个content block
    response.data.content.forEach((block, index) => {
      console.log(`\n📋 Block ${index + 1}:`);
      console.log('   Type:', block.type);
      
      if (block.type === 'text') {
        console.log('   Text length:', block.text.length);
        
        // 检查文本中是否包含"Tool call:"模式
        const toolCallPattern = /Tool call:\s*\w+\s*\([^)]*\)/g;
        const toolCallMatches = block.text.match(toolCallPattern);
        
        if (toolCallMatches) {
          foundToolCallText = true;
          console.log('   ❌ 发现工具调用文本被显示!');
          toolCallMatches.forEach((match, i) => {
            console.log(`     工具调用 ${i+1}: ${match}`);
          });
        }
        
        // 显示文本的开头和结尾
        const textPreview = block.text.slice(0, 200);
        const textSuffix = block.text.length > 200 ? block.text.slice(-100) : '';
        console.log('   Text start:', JSON.stringify(textPreview));
        if (textSuffix) {
          console.log('   Text end:', JSON.stringify(textSuffix));
        }
        
      } else if (block.type === 'tool_use') {
        console.log('   Tool name:', block.name);
        console.log('   Tool ID:', block.id);
        console.log('   Tool input:', JSON.stringify(block.input, null, 2));
      }
    });
    
    console.log('\n🔍 详细诊断:');
    console.log('   路由到的模型:', response.data.model);
    console.log('   是否为Gemini:', response.data.model === 'gemini-2.5-pro' ? '✅' : '❌');
    console.log('   应用了响应修复:', foundResponseFixes ? '✅' : '❌');
    console.log('   发现工具调用文本:', foundToolCallText ? '❌ YES' : '✅ NO');
    
    if (response.data.model !== 'gemini-2.5-pro') {
      console.log('\n⚠️  注意: 请求未路由到gemini-2.5-pro');
      console.log('   这可能是因为token数量未达到longcontext阈值');
      console.log('   或者路由逻辑有其他问题');
    }
    
    if (foundToolCallText) {
      console.log('\n❌ 确认问题: Gemini返回的工具调用文本未被完全清理');
      console.log('💡 这就是用户看到工具调用文本的原因！');
    } else {
      console.log('\n✅ 工具调用文本处理正常');
    }
    
    return !foundToolCallText;
    
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
  const success = await testGeminiToolCallIssue();
  
  console.log('\n📋 Gemini工具调用测试总结:');
  console.log('============================');
  console.log('问题状态:', success ? '✅ 正常' : '❌ 存在问题');
  
  if (!success) {
    console.log('\n🔧 问题分析:');
    console.log('Gemini模型返回的响应包含工具调用文本格式，但响应修复器');
    console.log('没有完全清理这些文本，导致用户看到"Tool call: ..."格式');
    console.log('\n修复方向:');
    console.log('1. 强化文本清理逻辑，完全移除包含工具调用的文本段落');
    console.log('2. 或者完全跳过显示包含工具调用模式的文本块');
  }
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}