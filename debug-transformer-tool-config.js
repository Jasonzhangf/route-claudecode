#!/usr/bin/env node
/**
 * 调试transformer工具配置传递问题
 * Project owner: Jason Zhang
 */

const { GeminiTransformer } = require('./dist/transformers/gemini.js');

function debugTransformerToolConfig() {
  console.log('🔍 调试transformer工具配置传递\n');
  
  const transformer = new GeminiTransformer();
  transformer.setProviderId('test-provider');
  
  // 测试Anthropic格式请求转换
  const anthropicRequest = {
    model: 'gemini-2.5-flash-lite',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: 'MUST call the calculator function to multiply 123 by 456!'
      }
    ],
    tools: [
      {
        name: 'calculator',
        description: 'Perform mathematical calculations',
        input_schema: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['multiply', 'add'] },
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['operation', 'a', 'b']
        }
      }
    ],
    metadata: { requestId: 'debug-test-001' }
  };
  
  console.log('📋 测试1: 默认工具配置转换（无tool_choice）');
  console.log('-'.repeat(50));
  
  try {
    const geminiRequest1 = transformer.transformAnthropicToGemini(anthropicRequest);
    
    console.log('✅ 转换成功');
    console.log('📝 Gemini请求结构:');
    console.log('- model:', geminiRequest1.model);
    console.log('- contents数量:', geminiRequest1.contents?.length);
    console.log('- tools存在:', !!geminiRequest1.tools);
    console.log('- toolConfig存在:', !!geminiRequest1.toolConfig);
    
    if (geminiRequest1.toolConfig) {
      console.log('🎯 toolConfig详情:');
      console.log(JSON.stringify(geminiRequest1.toolConfig, null, 2));
    } else {
      console.log('❌ toolConfig缺失！');
    }
    
    if (geminiRequest1.tools) {
      console.log('🔧 tools详情:');
      console.log('- tools数组长度:', geminiRequest1.tools.length);
      console.log('- 第一个tool:', JSON.stringify(geminiRequest1.tools[0], null, 2));
    }
    
    console.log('\n📋 完整Gemini请求:');
    console.log(JSON.stringify(geminiRequest1, null, 2));
    
  } catch (error) {
    console.error('❌ 转换失败:', error.message);
  }
  
  // 测试添加tool_choice = 'required'
  console.log('\n📋 测试2: 强制工具调用配置转换（tool_choice=required）');
  console.log('-'.repeat(50));
  
  try {
    const requestWithRequired = {
      ...anthropicRequest,
      tool_choice: 'required'  // 添加强制工具调用
    };
    
    const geminiRequest2 = transformer.transformAnthropicToGemini(requestWithRequired);
    
    console.log('✅ 转换成功');
    console.log('🎯 toolConfig详情:');
    console.log(JSON.stringify(geminiRequest2.toolConfig, null, 2));
    
    // 比较与成功的原生API请求
    console.log('\n🔍 与成功的原生API请求对比:');
    console.log('我们生成的toolConfig:');
    console.log(JSON.stringify(geminiRequest2.toolConfig, null, 2));
    console.log('\n原生API成功的toolConfig:');
    console.log(JSON.stringify({
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['calculator']
      }
    }, null, 2));
    
    const isEqual = JSON.stringify(geminiRequest2.toolConfig) === JSON.stringify({
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['calculator']
      }
    });
    
    console.log('🎯 配置是否一致:', isEqual ? '✅ 是' : '❌ 否');
    
  } catch (error) {
    console.error('❌ 转换失败:', error.message);
  }
  
  // 测试3: 验证工具定义格式
  console.log('\n📋 测试3: 验证工具定义格式');
  console.log('-'.repeat(50));
  
  const testRequest = {
    ...anthropicRequest,
    tool_choice: 'required'
  };
  
  try {
    const geminiRequest = transformer.transformAnthropicToGemini(testRequest);
    
    console.log('🔧 我们的工具定义:');
    console.log(JSON.stringify(geminiRequest.tools, null, 2));
    
    console.log('\n🔧 原生API成功的工具定义:');
    console.log(JSON.stringify([{
      functionDeclarations: [{
        name: 'calculator',
        description: 'Perform mathematical calculations',
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['multiply'] },
            a: { type: 'number' },
            b: { type: 'number' }
          },
          required: ['operation', 'a', 'b']
        }
      }]
    }], null, 2));
    
  } catch (error) {
    console.error('❌ 工具定义验证失败:', error.message);
  }
  
  console.log('\n🎯 调试结论:');
  console.log('💡 检查重点:');
  console.log('   1. toolConfig是否正确生成并包含mode=ANY');
  console.log('   2. allowedFunctionNames是否正确设置');
  console.log('   3. 工具定义格式是否与原生API一致');
  console.log('   4. 是否需要在CCR请求中明确设置tool_choice');
}

debugTransformerToolConfig();