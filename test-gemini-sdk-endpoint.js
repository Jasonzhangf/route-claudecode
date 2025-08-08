#!/usr/bin/env node
/**
 * 测试Gemini SDK endpoint配置
 */

const { GoogleGenAI } = require('@google/genai');

async function testWithAndWithoutEndpoint() {
  console.log('🧪 测试Gemini SDK endpoint配置...');
  
  const apiKey = 'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4';

  // 测试1: 不指定baseURL (默认)
  try {
    console.log('📤 测试默认endpoint...');
    const genAI1 = new GoogleGenAI({ apiKey });
    const response1 = await genAI1.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'Hi' }]
      }]
    });
    console.log('✅ 默认endpoint成功！');
  } catch (error) {
    console.error('❌ 默认endpoint失败:', error.message);
  }

  // 测试2: 显式指定baseURL
  try {
    console.log('📤 测试显式endpoint...');
    const genAI2 = new GoogleGenAI({ 
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com'
    });
    const response2 = await genAI2.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{ text: 'Hi' }]
      }]
    });
    console.log('✅ 显式endpoint成功！');
  } catch (error) {
    console.error('❌ 显式endpoint失败:', error.message);
  }

  // 测试3: 查看SDK构造参数
  console.log('\n🔍 检查SDK构造参数...');
  console.log('GoogleGenAI支持的构造参数:', Object.getOwnPropertyNames(GoogleGenAI.prototype));
}

testWithAndWithoutEndpoint();