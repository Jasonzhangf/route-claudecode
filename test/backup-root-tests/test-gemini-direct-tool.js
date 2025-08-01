#!/usr/bin/env node

/**
 * Test Direct Gemini API Tool Call
 * 直接测试Gemini API的工具调用功能
 */

const fetch = require('node-fetch');

async function testDirectGeminiToolCall() {
  console.log('🔧 Testing direct Gemini API tool call...');
  
  const apiKey = "AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const request = {
    contents: [{
      role: 'user',
      parts: [{ text: '请使用TodoWrite工具创建一个待办事项：学习TypeScript，状态是pending，优先级是high，ID是todo-001' }]
    }],
    tools: [{
      functionDeclarations: [{
        name: "TodoWrite",
        description: "Create and manage todo items",
        parameters: {
          type: "object",
          properties: {
            todos: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string" },
                  status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  id: { type: "string" }
                },
                required: ["content", "status", "priority", "id"]
              }
            }
          },
          required: ["todos"]
        }
      }]
    }],
    generationConfig: {
      maxOutputTokens: 1024
    }
  };

  try {
    console.log('📤 Direct Gemini Request:');
    console.log(JSON.stringify(request, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    console.log('\n📥 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const geminiResponse = await response.json();
    console.log('✅ Raw Gemini Response:');
    console.log(JSON.stringify(geminiResponse, null, 2));
    
    // 分析响应
    const candidate = geminiResponse.candidates?.[0];
    if (candidate?.content?.parts) {
      console.log('\n🔍 Response Analysis:');
      candidate.content.parts.forEach((part, index) => {
        console.log(`Part ${index + 1}:`);
        if (part.text) {
          console.log(`  - Text: "${part.text}"`);
        }
        if (part.functionCall) {
          console.log(`  - Function Call:`, {
            name: part.functionCall.name,
            args: part.functionCall.args
          });
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function main() {
  console.log('=== Direct Gemini Tool Call Test ===\n');
  await testDirectGeminiToolCall();
}

main().catch(console.error);