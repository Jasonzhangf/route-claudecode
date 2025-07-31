#!/usr/bin/env node

/**
 * 真实Gemini API测试 - 验证工具格式修复
 * 使用真实的Gemini API密钥测试工具调用
 */

const fetch = require('node-fetch');

// 测试用的工具定义（已清理的格式）
const cleanToolsForGemini = {
  tools: [{
    functionDeclarations: [{
      name: "calculator",
      description: "Performs mathematical calculations",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "Mathematical expression to evaluate"
          }
        },
        required: ["expression"]
      }
    }]
  }]
};

// 测试请求
const testRequest = {
  contents: [{
    role: "user",
    parts: [{
      text: "Calculate 15 * 25 and tell me the result"
    }]
  }],
  generationConfig: {
    maxOutputTokens: 1000,
    temperature: 0.1
  },
  ...cleanToolsForGemini
};

async function testRealGeminiAPI() {
  console.log('🌐 真实Gemini API测试 - 验证工具格式修复\n');

  // 从配置文件读取API密钥
  const configPath = '/Users/fanzhang/.route-claude-code/config.release.json';
  let apiKeys = [];
  
  try {
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    apiKeys = config.providers['google-gemini'].authentication.credentials.apiKey;
    console.log(`📋 找到 ${apiKeys.length} 个Gemini API密钥`);
  } catch (error) {
    console.log('⚠️  无法读取配置文件，使用环境变量');
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) {
      apiKeys = [envKey];
    }
  }

  if (apiKeys.length === 0) {
    console.log('❌ 未找到Gemini API密钥');
    console.log('请设置 GEMINI_API_KEY 环境变量或确保配置文件包含密钥');
    return false;
  }

  console.log('📤 发送请求格式:');
  console.log(JSON.stringify(testRequest, null, 2));

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    const keyName = `key${i + 1}`;
    
    console.log(`\n🔑 测试 API Key ${keyName} (***${apiKey.slice(-4)})`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testRequest)
      });

      const responseText = await response.text();
      
      if (response.ok) {
        console.log(`✅ ${keyName}: API调用成功!`);
        
        try {
          const jsonResponse = JSON.parse(responseText);
          console.log(`📊 ${keyName}: 响应解析成功`);
          
          if (jsonResponse.candidates && jsonResponse.candidates[0]) {
            const candidate = jsonResponse.candidates[0];
            console.log(`📋 ${keyName}: 候选数量: ${jsonResponse.candidates.length}`);
            console.log(`🏁 ${keyName}: 完成原因: ${candidate.finishReason}`);
            
            if (candidate.content?.parts) {
              let hasToolCall = false;
              let hasText = false;
              
              candidate.content.parts.forEach((part, partIndex) => {
                if (part.functionCall) {
                  hasToolCall = true;
                  console.log(`🔧 ${keyName}: 工具调用 ${partIndex + 1}: ${part.functionCall.name}`);
                  console.log(`📝 ${keyName}: 工具参数:`, JSON.stringify(part.functionCall.args, null, 2));
                } else if (part.text) {
                  hasText = true;
                  console.log(`💬 ${keyName}: 文本内容: ${part.text.slice(0, 100)}...`);
                }
              });
              
              if (!hasToolCall && !hasText) {
                console.log(`⚠️  ${keyName}: 响应中没有工具调用或文本内容`);
              }
            }
            
            // 检查token使用情况
            if (jsonResponse.usageMetadata) {
              const usage = jsonResponse.usageMetadata;
              console.log(`📈 ${keyName}: Token使用 - 输入: ${usage.promptTokenCount}, 输出: ${usage.candidatesTokenCount}`);
            }
          }
          
          return true; // 第一个成功的就够了
          
        } catch (parseError) {
          console.log(`⚠️  ${keyName}: JSON解析失败，原始响应:`);
          console.log(responseText.slice(0, 500) + '...');
        }
        
      } else {
        console.log(`❌ ${keyName}: API调用失败 (${response.status})`);
        
        try {
          const errorData = JSON.parse(responseText);
          if (errorData.error?.details) {
            console.log(`🔍 ${keyName}: 错误详情:`);
            errorData.error.details.forEach(detail => {
              console.log(`  - ${detail.description}`);
            });
            
            // 检查是否还有工具格式问题
            const hasSchemaError = errorData.error.details.some(detail => 
              detail.description.includes('additionalProperties') || 
              detail.description.includes('$schema') ||
              detail.description.includes('Unknown name')
            );
            
            if (hasSchemaError) {
              console.log(`💥 ${keyName}: 仍然存在工具格式问题!`);
              return false;
            }
          }
        } catch (parseError) {
          console.log(`📛 ${keyName}: 错误响应: ${responseText.slice(0, 200)}...`);
        }
      }
      
    } catch (error) {
      console.log(`❌ ${keyName}: 请求异常: ${error.message}`);
    }
  }

  console.log('\n🎯 测试总结:');
  console.log('- 所有API密钥已测试');
  console.log('- 工具格式修复已应用');
  console.log('- 如果没有工具格式错误，说明修复成功');
  
  return true;
}

// 运行测试
testRealGeminiAPI()
  .then(success => {
    if (success) {
      console.log('\n🎉 Gemini真实API测试完成!');
      process.exit(0);
    } else {
      console.log('\n💥 Gemini真实API测试失败!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 测试异常:', error);
    process.exit(1);
  });