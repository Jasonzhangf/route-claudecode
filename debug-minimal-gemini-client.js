#!/usr/bin/env node
/**
 * 最小化复现Gemini客户端问题
 */

const { GoogleGenAI } = require('@google/genai');

// 模拟我们代码中的完整流程
class MinimalGeminiClient {
  constructor() {
    this.apiKey = 'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4';
    this.genAIClients = [new GoogleGenAI({ apiKey: this.apiKey })];
    this.requestTimeout = 60000;
  }

  async createCompletion(request) {
    console.log('🔧 开始处理请求...');
    
    const modelName = request.model;
    
    try {
      const result = await this.executeWithRetry(
        async (genAI, model) => {
          // 模拟我们的请求转换
          const geminiRequest = {
            model: model,
            contents: [{
              role: 'user', 
              parts: [{ text: request.messages[0].content }]
            }]
          };

          console.log('📤 发送到Gemini API:', JSON.stringify(geminiRequest, null, 2));

          // 模拟超时包装
          return Promise.race([
            genAI.models.generateContent(geminiRequest),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Timeout after ${this.requestTimeout}ms`)), this.requestTimeout)
            )
          ]);
        },
        modelName,
        'createCompletion'
      );

      console.log('✅ 成功！结果:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('❌ 失败:', error.message);
      throw error;
    }
  }

  async executeWithRetry(requestFn, modelName, operation) {
    const genAIClient = this.genAIClients[0];
    return await requestFn(genAIClient, modelName);
  }
}

async function testMinimalClient() {
  console.log('🚀 测试最小化Gemini客户端...');
  
  const client = new MinimalGeminiClient();
  
  const testRequest = {
    model: 'gemini-2.5-flash',
    messages: [{
      role: 'user',
      content: 'Hi'
    }]
  };

  try {
    await client.createCompletion(testRequest);
  } catch (error) {
    console.error('❌ 最小化客户端测试失败:', error);
  }
}

testMinimalClient();