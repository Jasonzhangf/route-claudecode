#!/usr/bin/env node
/**
 * 测试不同的Gemini SDK调用格式
 */

const { GoogleGenAI } = require('@google/genai');

async function testDifferentFormats() {
  console.log('🧪 测试不同的Gemini SDK调用格式...');
  
  const apiKey = 'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4';
  const genAI = new GoogleGenAI({ apiKey });

  // 格式1: 正确格式
  const correctFormat = {
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{ text: 'Hi' }]
    }]
  };

  // 格式2: 可能的错误格式（包含额外字段）
  const possibleWrongFormat = {
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [{ text: 'Hi' }]
    }],
    generationConfig: {},
    tools: undefined,
    functionCallingConfig: undefined
  };

  try {
    console.log('📤 测试正确格式...');
    const response1 = await genAI.models.generateContent(correctFormat);
    console.log('✅ 正确格式成功！');
  } catch (error) {
    console.error('❌ 正确格式失败:', error.message);
  }

  try {
    console.log('📤 测试可能错误的格式...');
    const response2 = await genAI.models.generateContent(possibleWrongFormat);
    console.log('✅ 包含额外字段的格式也成功！');
  } catch (error) {
    console.error('❌ 包含额外字段的格式失败:', error.message);
  }
}

testDifferentFormats();