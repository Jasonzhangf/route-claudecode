#!/usr/bin/env node
/**
 * 调试Gemini请求格式转换
 */

// 模拟GeminiRequestConverter.convertToGeminiFormat的输出
const testRequest = {
  model: 'gemini-2.5-flash',
  messages: [{
    role: 'user',
    content: 'Hi'
  }]
};

// 预期的Gemini请求格式
const expectedGeminiRequest = {
  model: 'gemini-2.5-flash',
  contents: [{
    role: 'user',
    parts: [{ text: 'Hi' }]
  }]
};

console.log('预期的Gemini API请求格式:');
console.log(JSON.stringify(expectedGeminiRequest, null, 2));

// 检查我们可能生成的错误格式
const possibleWrongFormat = {
  model: 'gemini-2.5-flash', 
  contents: [{
    role: 'user',
    parts: [{ text: 'Hi' }]
  }],
  generationConfig: {},
  tools: [],
  functionCallingConfig: { mode: 'AUTO' }
};

console.log('\n可能的错误格式（包含空的tools和config）:');
console.log(JSON.stringify(possibleWrongFormat, null, 2));

console.log('\n关键点：');
console.log('1. model参数是否正确传递');
console.log('2. contents格式是否正确');
console.log('3. 是否有空的tools或config导致问题');
console.log('4. genAI.models.generateContent期望的确切格式');