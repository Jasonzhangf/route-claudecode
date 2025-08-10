#!/usr/bin/env node
/**
 * 测试UNEXPECTED_TOOL_CALL情况
 * Project owner: Jason Zhang
 */

const { GoogleGenAI } = require('@google/genai');

async function testUnexpectedToolCall() {
  console.log('🔍 测试UNEXPECTED_TOOL_CALL情况...\n');

  const configPath = process.env.HOME + '/.route-claude-code/config/single-provider/config-google-gemini-5502.json';
  let apiKey;
  
  try {
    const config = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
    const auth = config.providers?.['google-gemini']?.authentication?.credentials;
    apiKey = auth?.apiKey || auth?.api_key;
    if (Array.isArray(apiKey)) {
      apiKey = apiKey[0];
    }
  } catch (error) {
    console.error('❌ 无法读取API密钥:', error.message);
    return;
  }

  const genAI = new GoogleGenAI({ apiKey });

  // 尝试重现UNEXPECTED_TOOL_CALL的请求
  const requests = [
    {
      name: '低token限制 + 强制工具调用',
      payload: {
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: 'Call the get_time function with UTC timezone. Only use the function, do not explain.' }]
        }],
        tools: [{
          functionDeclarations: [{
            name: 'get_time',
            description: 'Get current time',
            parameters: {
              type: 'object',
              properties: {
                timezone: { type: 'string', enum: ['UTC', 'PST', 'EST'] }
              },
              required: ['timezone']
            }
          }]
        }],
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: ['get_time']
          }
        },
        generationConfig: {
          maxOutputTokens: 5  // 极低的token限制
        }
      }
    },
    {
      name: '多个工具 + ANY模式',
      payload: {
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: 'I need you to get the current time.' }]
        }],
        tools: [
          {
            functionDeclarations: [{
              name: 'get_time',
              description: 'Get current time',
              parameters: {
                type: 'object',
                properties: {
                  timezone: { type: 'string', enum: ['UTC'] }
                },
                required: ['timezone']
              }
            }]
          },
          {
            functionDeclarations: [{
              name: 'get_date',
              description: 'Get current date',
              parameters: {
                type: 'object',
                properties: {
                  format: { type: 'string', enum: ['ISO', 'US'] }
                },
                required: ['format']
              }
            }]
          }
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: ['get_time', 'get_date']
          }
        },
        generationConfig: {
          maxOutputTokens: 10
        }
      }
    }
  ];

  for (const testCase of requests) {
    console.log(`🧪 测试: ${testCase.name}`);
    console.log('-'.repeat(50));

    try {
      const result = await genAI.models.generateContent(testCase.payload);
      
      console.log('📊 响应结构分析:');
      console.log('- candidates存在:', !!result.candidates);
      console.log('- candidates长度:', result.candidates?.length);
      
      if (result.candidates && result.candidates.length > 0) {
        const candidate = result.candidates[0];
        console.log('- finishReason:', candidate.finishReason);
        console.log('- candidate keys:', Object.keys(candidate));
        console.log('- hasContent:', !!candidate.content);
        console.log('- hasParts:', !!candidate.content?.parts);
        
        if (candidate.finishReason === 'UNEXPECTED_TOOL_CALL') {
          console.log('🎯 发现UNEXPECTED_TOOL_CALL!');
          console.log('- 完整candidate:', JSON.stringify(candidate, null, 2));
        }
        
        if (candidate.content?.parts) {
          console.log('- parts数量:', candidate.content.parts.length);
          candidate.content.parts.forEach((part, i) => {
            console.log(`- part[${i}]:`, {
              hasText: !!part.text,
              hasFunctionCall: !!part.functionCall,
              textLength: part.text?.length,
              functionName: part.functionCall?.name
            });
          });
        }
      }
      
      console.log('✅ 测试完成\n');
      
    } catch (error) {
      console.error('❌ 测试失败:', error.message);
      console.log('🔍 可能这就是导致UNEXPECTED_TOOL_CALL的情况\n');
    }
  }
}

testUnexpectedToolCall().catch(console.error);