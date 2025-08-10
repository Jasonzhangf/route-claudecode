#!/usr/bin/env node
/**
 * 直接测试Gemini Transformer - 验证allowedFunctionNames字段
 * Project owner: Jason Zhang
 */

// 模拟导入，使用构建后的文件
const path = require('path');
const distPath = path.join(__dirname, 'dist');

async function testTransformerDirectly() {
  console.log('🧪 直接测试Gemini Transformer的allowedFunctionNames字段...\n');

  try {
    // 导入构建后的JavaScript文件
    const { GeminiTransformer } = require('./dist/transformers/gemini.js');
    
    const transformer = new GeminiTransformer();
    transformer.setProviderId('test-provider');

    // 创建测试请求
    const testRequest = {
      model: 'gemini-2.5-flash',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: 'Create a file called test.txt with content Hello World'
        }
      ],
      tools: [
        {
          name: 'create_file',
          description: 'Create a new file with specified content',
          input_schema: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'Name of the file to create'
              },
              content: {
                type: 'string', 
                description: 'Content to write to the file'
              }
            },
            required: ['filename', 'content']
          }
        }
      ],
      metadata: {
        requestId: 'test-request-123'
      }
    };

    console.log('📝 测试请求:', JSON.stringify(testRequest, null, 2));
    console.log('\n🔧 转换中...\n');

    // 转换请求
    const geminiRequest = transformer.transformAnthropicToGemini(testRequest);
    
    console.log('✅ 转换成功！');
    console.log('📋 转换后的Gemini请求:');
    console.log(JSON.stringify(geminiRequest, null, 2));

    // 特别检查toolConfig
    if (geminiRequest.toolConfig) {
      console.log('\n🎯 toolConfig检查:');
      console.log('- mode:', geminiRequest.toolConfig.functionCallingConfig.mode);
      console.log('- allowedFunctionNames:', geminiRequest.toolConfig.functionCallingConfig.allowedFunctionNames);
      
      if (geminiRequest.toolConfig.functionCallingConfig.allowedFunctionNames) {
        console.log('✅ allowedFunctionNames字段存在');
      } else {
        console.log('❌ allowedFunctionNames字段缺失');
      }
    } else {
      console.log('❌ toolConfig字段完全缺失');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('Stack trace:', error.stack);
  }

  console.log('\n🧪 Transformer直接测试完成!');
}

testTransformerDirectly().catch(console.error);