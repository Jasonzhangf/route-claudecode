#!/usr/bin/env node
/**
 * 最终修复测试 - 使用大的max_tokens
 */

const axios = require('axios');

async function testFinalFix() {
  console.log('🔍 Final Fix Test - Testing CCR with Large max_tokens');
  console.log('====================================================');
  
  const testRequest = {
    model: "claude-3-5-haiku-20241022",
    messages: [{ role: "user", content: "Say hello in a friendly way" }],
    max_tokens: 131072,
    stream: false
  };
  
  console.log('📥 Request:', JSON.stringify(testRequest, null, 2));
  
  try {
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', testRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test',
        'anthropic-version': '2023-06-01'
      }
    });
    
    console.log('📤 Response:', JSON.stringify(response.data, null, 2));
    
    const content = response.data.content;
    const hasContent = content && content.length > 0 && content[0].text;
    
    console.log(`\n${hasContent ? '✅' : '❌'} Result: ${hasContent ? 'SUCCESS' : 'FAILED'}`);
    if (hasContent) {
      console.log(`📝 Content: "${content[0].text}"`);
    }
    
    return { success: hasContent, response: response.data };
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

testFinalFix();