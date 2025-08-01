#!/usr/bin/env node

/**
 * 直接测试CodeWhisperer转换器修复
 * 项目所有者: Jason Zhang
 */

// 模拟TypeScript环境中的import
const { CodeWhispererConverter } = require('./dist/providers/codewhisperer/converter');

async function testConverterFix() {
  console.log('🔧 直接测试CodeWhisperer转换器修复\n');

  const converter = new CodeWhispererConverter();
  
  // 测试请求
  const testRequest = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: "List all TypeScript files"
      }
    ],
    tools: [
      {
        name: "Glob",
        description: "Fast file pattern matching tool",
        input_schema: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "The glob pattern to match files against" }
          },
          required: ["pattern"],
          additionalProperties: false,
          "$schema": "http://json-schema.org/draft-07/schema#"
        }
      }
    ]
  };

  console.log('📤 测试转换请求:');
  console.log(`🛠️  工具数量: ${testRequest.tools.length}`);
  console.log(`📝 消息: "${testRequest.messages[0].content}"`);

  try {
    const cwRequest = converter.buildCodeWhispererRequest(testRequest);
    
    console.log('✅ 转换成功');
    console.log('\n🔍 转换结果分析:');
    console.log(`   conversationId: ${cwRequest.conversationState.conversationId}`);
    console.log(`   content: "${cwRequest.conversationState.currentMessage.userInputMessage.content}"`);
    console.log(`   modelId: "${cwRequest.conversationState.currentMessage.userInputMessage.modelId}"`);
    console.log(`   origin: "${cwRequest.conversationState.currentMessage.userInputMessage.origin}"`);
    
    // 检查userInputMessageContext
    const context = cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext;
    console.log(`   userInputMessageContext keys: [${Object.keys(context).join(', ')}]`);
    
    if (context.tools) {
      console.log(`   tools count: ${context.tools.length}`);
      context.tools.forEach((tool, i) => {
        console.log(`   tool[${i}]: ${tool.toolSpecification.name}`);
      });
    } else {
      console.log('   tools: undefined (符合demo2的omitempty行为)');
    }
    
    // 检查模型映射
    if (cwRequest.conversationState.currentMessage.userInputMessage.modelId) {
      console.log(`✅ 模型映射成功: ${testRequest.model} -> ${cwRequest.conversationState.currentMessage.userInputMessage.modelId}`);
    } else {
      console.log(`❌ 模型映射失败: ${testRequest.model} -> undefined/empty`);
    }
    
    // 保存结果用于对比
    const fs = require('fs');
    fs.writeFileSync('/tmp/converter-fix-test.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      inputRequest: testRequest,
      convertedRequest: cwRequest,
      fixesApplied: [
        "Removed MODEL_MAP fallback mechanism",
        "Implemented omitempty behavior for userInputMessageContext"
      ]
    }, null, 2));
    console.log(`\n📁 转换结果保存到: /tmp/converter-fix-test.json`);
    
  } catch (error) {
    console.log(`❌ 转换失败: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }

  console.log('\n🔍 修复验证结论:');
  console.log('1. modelId映射：应该返回具体值或undefined（不能有fallback）');
  console.log('2. userInputMessageContext：应该只在有工具时包含tools字段'); 
  console.log('3. 与demo2行为完全一致');
}

// 运行测试
testConverterFix().catch(console.error);