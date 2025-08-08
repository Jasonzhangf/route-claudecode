#!/usr/bin/env node
/**
 * 直接测试Google Gemini SDK调用
 */

const { GoogleGenAI } = require('@google/genai');

async function testGeminiSDK() {
  console.log('🧪 直接测试Google Gemini SDK...');
  
  const apiKey = 'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4';
  const genAI = new GoogleGenAI({ apiKey });

  try {
    console.log('📤 发送请求到Gemini API...');
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'Hi' }]
      }]
    });

    console.log('✅ 成功！响应:', JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('❌ 失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

testGeminiSDK();