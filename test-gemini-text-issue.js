#!/usr/bin/env node

/**
 * 测试模拟真实Gemini响应中工具调用文本显示问题
 * 基于生产日志中的实际观察
 */

const axios = require('axios');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function testGeminiTextIssue() {
  console.log('🔍 测试Gemini工具调用文本显示问题');
  console.log('====================================');
  
  // 创建一个足够大的请求，确保路由到longcontext
  const baseText = `
I need help analyzing this complex software project. The project has multiple components and I need to understand its structure, dependencies, and current state.

Here's some context about what I'm working on:
- This is a Node.js project with TypeScript
- It uses various build tools and dependencies
- I need to analyze the package.json and run some diagnostic commands
- The project structure is complex with multiple modules

Please help me by first reading the package.json file to understand the dependencies, and then running a quick status check to see the current state of the project.

This analysis is important for understanding the project architecture and planning next steps.
  `.trim();
  
  // 重复文本以达到longcontext阈值
  const largeContent = baseText.repeat(100); // 应该足够大
  
  const request = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
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
    console.log('📤 发送测试请求...');
    console.log('📊 内容大小:', largeContent.length, '字符');
    console.log('📊 请求大小:', JSON.stringify(request).length, '字符');
    
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 90000
    });
    
    console.log('✅ 请求成功');
    console.log('📊 响应分析:');
    console.log('   ID:', response.data.id);
    console.log('   Model:', response.data.model);
    console.log('   Role:', response.data.role);
    console.log('   Content blocks:', response.data.content?.length || 0);
    
    if (!response.data.content) {
      console.log('❌ 响应中没有content字段');
      return false;
    }
    
    let toolCallTextFound = false;
    let explanationTextFound = false;
    let toolBlocksFound = 0;
    
    // 详细分析响应内容
    response.data.content.forEach((block, index) => {
      console.log(`\n📋 Block ${index + 1}:`);
      console.log('   Type:', block.type);
      
      if (block.type === 'text') {
        console.log('   Text length:', block.text.length);
        
        // 检查是否包含工具调用文本
        const toolCallRegex = /Tool call:\s*\w+\s*\([^)]*\)/gi;
        const toolCallMatches = block.text.match(toolCallRegex);
        
        if (toolCallMatches) {
          toolCallTextFound = true;
          console.log('   ❌ 发现工具调用文本:');
          toolCallMatches.forEach(match => {
            console.log(`     "${match}"`);
          });
        }
        
        // 检查是否有合理的解释性文字
        const cleanText = block.text.replace(toolCallRegex, '').trim();
        if (cleanText.length > 10) {
          explanationTextFound = true;
          console.log('   📝 解释性文字 (前100字符):');
          console.log(`     "${cleanText.slice(0, 100)}"`);
        }
        
        // 显示完整文本（如果较短）
        if (block.text.length < 500) {
          console.log('   完整文本:', JSON.stringify(block.text));
        }
        
      } else if (block.type === 'tool_use') {
        toolBlocksFound++;
        console.log('   Tool name:', block.name);
        console.log('   Tool ID:', block.id);
        console.log('   Tool input:', JSON.stringify(block.input, null, 2));
      }
    });
    
    console.log('\n🔍 问题诊断:');
    console.log('   路由模型:', response.data.model);
    console.log('   是否为Gemini:', response.data.model.includes('gemini') ? '✅' : '❌');
    console.log('   工具调用块数量:', toolBlocksFound);
    console.log('   发现工具调用文本:', toolCallTextFound ? '❌ YES' : '✅ NO');
    console.log('   有解释性文字:', explanationTextFound ? '✅ YES' : '❌ NO');
    
    // 如果找到了工具调用文本，这就是问题
    if (toolCallTextFound) {
      console.log('\n❌ 问题确认: 工具调用文本被显示给用户');
      console.log('🔧 这就是用户报告的问题！');
      console.log('💡 响应修复器没有完全清理工具调用文本');
      
      if (explanationTextFound) {
        console.log('📝 同时存在解释性文字，说明应该保留文字但移除工具调用部分');
      }
    } else {
      console.log('\n✅ 工具调用文本处理正常');
    }
    
    return !toolCallTextFound;
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误详情:', error.response.data);
    }
    return false;
  }
}

async function main() {
  console.log('等待服务器启动...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const success = await testGeminiTextIssue();
  
  console.log('\n📋 测试总结:');
  console.log('=============');
  console.log('问题状态:', success ? '✅ 已修复' : '❌ 仍存在');
  
  if (!success) {
    console.log('\n🔧 修复方向:');
    console.log('1. 检查响应修复器的工具调用文本清理逻辑');
    console.log('2. 确保"Tool call: ..."模式被完全移除');
    console.log('3. 保留有价值的解释性文字');
    console.log('4. 验证修复是否在生产环境中生效');
  }
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}