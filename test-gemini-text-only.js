#!/usr/bin/env node

/**
 * 测试Gemini纯文本响应是否正常
 */

const fetch = require('node-fetch');

const testRequest = {
  contents: [{
    role: "user",
    parts: [{
      text: "Hello, please just say 'Hi there!' in response."
    }]
  }],
  generationConfig: {
    maxOutputTokens: 100,
    temperature: 0.1
  }
};

async function testGeminiTextOnly() {
  console.log('💬 测试Gemini纯文本响应\n');

  const configPath = '/Users/fanzhang/.route-claude-code/config.release.json';
  let apiKey;
  
  try {
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    apiKey = config.providers['google-gemini'].authentication.credentials.apiKey[0];
  } catch (error) {
    console.log('❌ 无法读取配置文件:', error.message);
    return false;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testRequest)
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ API调用成功');
      
      const jsonResponse = JSON.parse(responseText);
      const candidate = jsonResponse.candidates?.[0];
      
      if (candidate?.content?.parts) {
        console.log(`📋 响应部分数量: ${candidate.content.parts.length}`);
        
        candidate.content.parts.forEach((part, i) => {
          console.log(`Part ${i + 1}:`);
          if (part.text) {
            console.log(`  文本: "${part.text}"`);
          } else {
            console.log(`  其他类型:`, Object.keys(part));
          }
        });
        
        return true;
      }
    } else {
      console.log(`❌ API失败: ${response.status}`);
      console.log(responseText);
    }
    
  } catch (error) {
    console.log(`❌ 异常: ${error.message}`);
  }

  return false;
}

testGeminiTextOnly();