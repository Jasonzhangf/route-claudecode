#!/usr/bin/env node

/**
 * 调试longcontext路由问题
 * 创建真正足够大的请求以触发gemini路由
 */

const { calculateTokenCount } = require('./dist/utils');

function createMassiveRequest() {
  // 创建超大内容，确保超过45K tokens
  const baseContent = `Please analyze this comprehensive software development project. This is a complex Node.js application with TypeScript that requires detailed analysis of its architecture, dependencies, build process, testing framework, and deployment pipeline. The project involves multiple modules, services, and components that need to be understood in their entirety.

Key areas that need analysis:
1. Package dependencies and their versions
2. Build configuration and scripts
3. Testing setup and coverage
4. Development workflow and tooling
5. Deployment and production considerations
6. Code quality and linting rules
7. Documentation structure
8. Performance considerations
9. Security configurations
10. Database connections and migrations

This analysis is critical for understanding the project's current state and planning future development work. The project has evolved over time and includes legacy code that needs to be understood alongside newer implementations.

Please help me by reading the package.json file first to understand the basic project structure and dependencies, then running diagnostic commands to check the current status of various project components.
`;

  // 重复内容直到达到足够的token数
  let massiveContent = '';
  for (let i = 0; i < 200; i++) {
    massiveContent += baseContent + `\n\nIteration ${i + 1} of detailed project analysis context.\n\n`;
  }

  return {
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: massiveContent
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
}

async function testTokenCalculation() {
  console.log('🔍 测试token计算和longcontext路由');
  console.log('===================================');
  
  const request = createMassiveRequest();
  const content = request.messages[0].content;
  
  console.log('📊 请求分析:');
  console.log('   内容字符数:', content.length);
  console.log('   完整请求大小:', JSON.stringify(request).length, '字符');
  
  try {
    // 计算token数
    const tokenCount = calculateTokenCount(
      request.messages,
      request.system,
      request.tools
    );
    
    console.log('   实际token数:', tokenCount);
    console.log('   longcontext阈值: 45,000 tokens');
    console.log('   是否达到longcontext:', tokenCount > 45000 ? '✅ YES' : '❌ NO');
    
    if (tokenCount > 45000) {
      console.log('   预期路由: longcontext → shuaihong-openai → gemini-2.5-pro');
    } else {
      console.log('   预期路由: default → shuaihong-openai → qwen3-coder');
      
      // 计算需要多少字符才能达到45K tokens
      const tokensPerChar = tokenCount / content.length;
      const charsNeededFor45K = Math.ceil(45000 / tokensPerChar);
      console.log(`   需要约 ${charsNeededFor45K} 字符才能达到45K tokens`);
    }
    
    return tokenCount > 45000;
    
  } catch (error) {
    console.error('❌ Token计算失败:', error.message);
    return false;
  }
}

async function testActualRequest() {
  const willTriggerLongcontext = await testTokenCalculation();
  
  if (!willTriggerLongcontext) {
    console.log('\n⚠️  请求不会触发longcontext路由，跳过API测试');
    return false;
  }
  
  console.log('\n🚀 发送longcontext API测试请求...');
  
  const axios = require('axios');
  const TEST_PORT = 3456;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  
  const request = createMassiveRequest();
  
  try {
    const response = await axios.post(`${BASE_URL}/v1/messages`, request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 120000
    });
    
    console.log('✅ API请求成功');
    console.log('📊 响应分析:');
    console.log('   Model:', response.data.model);
    console.log('   是否为Gemini:', response.data.model.includes('gemini') ? '✅' : '❌');
    console.log('   Content blocks:', response.data.content?.length || 0);
    
    // 检查工具调用文本问题
    let hasToolCallText = false;
    if (response.data.content) {
      response.data.content.forEach((block, index) => {
        if (block.type === 'text' && block.text.includes('Tool call:')) {
          hasToolCallText = true;
          console.log(`   ❌ Block ${index + 1} 包含工具调用文本`);
        }
      });
    }
    
    console.log('   工具调用文本问题:', hasToolCallText ? '❌ 存在' : '✅ 无');
    
    return response.data.model.includes('gemini') && !hasToolCallText;
    
  } catch (error) {
    console.error('❌ API请求失败:', error.message);
    return false;
  }
}

async function main() {
  const success = await testActualRequest();
  
  console.log('\n📋 longcontext路由测试总结:');
  console.log('============================');
  console.log('测试结果:', success ? '✅ 成功' : '❌ 失败');
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}