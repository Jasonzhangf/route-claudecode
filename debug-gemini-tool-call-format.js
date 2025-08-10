#!/usr/bin/env node
/**
 * 调试Gemini工具调用格式 - 分析实际发送的API请求
 * Project owner: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

// 导入必要的模块
async function analyzeGeminiToolCallFormat() {
  console.log('🔍 Gemini工具调用格式分析开始...\n');

  // 1. 模拟标准工具定义（Anthropic格式）
  const anthropicToolRequest = {
    model: 'gemini-2.5-flash',
    max_tokens: 1024,
    temperature: 0.1,
    messages: [{
      role: 'user',
      content: 'What is the weather like in Beijing?'
    }],
    tools: [{
      name: 'create_file',
      description: 'Create a new file with specified content',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to create'
          },
          content: {
            type: 'string', 
            description: 'Content to write to the file'
          }
        },
        required: ['path', 'content']
      }
    }],
    metadata: {
      requestId: 'debug-test-' + Date.now()
    }
  };

  console.log('📤 标准Anthropic格式工具请求:');
  console.log(JSON.stringify(anthropicToolRequest, null, 2));

  // 2. 手动分析预期的Gemini格式（基于源码分析）
  console.log('\n🔄 基于源码分析的预期Gemini格式...');
  
  // 基于transformer源码手动构建预期格式
  const expectedGeminiRequest = {
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{ text: 'What is the weather like in Beijing?' }]
    }],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.1
    },
    tools: [{
      functionDeclarations: [{
        name: 'create_file',
        description: 'Create a new file with specified content',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path to create'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      }]
    }],
    functionCallingConfig: { 
      mode: 'ANY'
    }
  };
  
  console.log('\n📤 基于源码分析的Gemini API请求:');
  console.log(JSON.stringify(expectedGeminiRequest, null, 2));

  // 3. 检查关键字段
  console.log('\n🔍 关键字段分析:');
  console.log('- model:', expectedGeminiRequest.model);
  console.log('- contents count:', expectedGeminiRequest.contents?.length || 0);
  console.log('- tools defined:', !!expectedGeminiRequest.tools);
  console.log('- tools count:', expectedGeminiRequest.tools?.[0]?.functionDeclarations?.length || 0);
  console.log('- functionCallingConfig:', JSON.stringify(expectedGeminiRequest.functionCallingConfig));
  
  // 4. 验证tools格式
  if (expectedGeminiRequest.tools && expectedGeminiRequest.tools[0]) {
    const tool = expectedGeminiRequest.tools[0].functionDeclarations[0];
    console.log('\n🛠️ 第一个工具详细信息:');
    console.log('- name:', tool?.name);
    console.log('- description:', tool?.description);
    console.log('- parameters:', JSON.stringify(tool?.parameters, null, 2));
  }

  // 5. 对比Google官方API文档预期格式
  console.log('\n📋 Google Gemini API官方预期格式:');
  const officialFormat = {
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{ text: 'What is the weather like in Beijing?' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: 'create_file',
        description: 'Create a new file with specified content',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path to create'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['path', 'content']
        }
      }]
    }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY'  // 根据文档，应该是toolConfig而不是functionCallingConfig
      }
    }
  };
  
  console.log(JSON.stringify(officialFormat, null, 2));

  // 6. 分析可能的问题
  console.log('\n🚨 可能的问题点:');
  console.log('1. toolConfig vs functionCallingConfig 字段名称');
  console.log('2. mode值: ANY vs AUTO');
  console.log('3. tools数组结构是否正确');
  console.log('4. functionDeclarations的参数schema格式');
  
  console.log('\n🔍 Gemini工具调用格式分析完成!');
}

// 执行分析
analyzeGeminiToolCallFormat().catch(console.error);