#!/usr/bin/env node

/**
 * Debug Gemini Response Format Issue
 * 调试Gemini响应格式问题，特别是为什么返回空文本
 */

const fetch = require('node-fetch');

async function testGeminiDirectAPI() {
  const apiKey = "AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const request = {
    contents: [{
      role: 'user',
      parts: [{ text: '你好，请简单回复一句话' }]
    }],
    generationConfig: {
      maxOutputTokens: 1024
    }
  };

  try {
    console.log('🚀 Testing direct Gemini API call...');
    console.log('Request:', JSON.stringify(request, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const geminiResponse = await response.json();
    console.log('✅ Raw Gemini Response:');
    console.log(JSON.stringify(geminiResponse, null, 2));
    
    // 测试我们的解析逻辑
    console.log('\n🔍 Testing our parsing logic:');
    const candidate = geminiResponse.candidates?.[0];
    console.log('candidate:', candidate);
    
    const content = candidate?.content?.parts?.[0]?.text || '';
    console.log('extracted content:', content);
    
    if (!content) {
      console.log('❌ Content extraction failed!');
      console.log('candidate structure:', JSON.stringify(candidate, null, 2));
      
      // 尝试其他可能的路径
      if (candidate?.content) {
        console.log('candidate.content:', JSON.stringify(candidate.content, null, 2));
        
        if (candidate.content.parts) {
          console.log('parts array:', candidate.content.parts);
          candidate.content.parts.forEach((part, index) => {
            console.log(`part[${index}]:`, JSON.stringify(part, null, 2));
          });
        }
      }
    } else {
      console.log('✅ Content extracted successfully:', content);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testGeminiThroughRouter() {
  console.log('\n🔄 Testing Gemini through router...');
  
  const routerRequest = {
    model: "claude-sonnet-4-20250514",
    messages: [
      {
        role: "user", 
        content: "你好，请简单回复一句话"
      }
    ],
    max_tokens: 1024,
    stream: false
  };

async function testGeminiToolCallThroughRouter() {
  console.log('\n🔧 Testing Gemini tool call through router...');
  
  const toolCallRequest = {
    model: "claude-sonnet-4-20250514",
    messages: [
      {
        role: "user", 
        content: "请帮我创建一个待办事项：学习TypeScript"
      }
    ],
    max_tokens: 1024,
    stream: false,
    tools: [
      {
        name: "TodoWrite",
        description: "Create and manage todo items",
        input_schema: {
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
      }
    ]
  };

  try {
    const response = await fetch('http://localhost:8888/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'messages-2023-12-15'
      },
      body: JSON.stringify(routerRequest)
    });

    console.log('Router response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Router Error:', errorText);
      return;
    }

    const routerResponse = await response.json();
    console.log('✅ Router Response:');
    console.log(JSON.stringify(routerResponse, null, 2));
    
  } catch (error) {
    console.error('❌ Router Error:', error.message);
  }
}

  try {
    const response = await fetch('http://localhost:8888/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'messages-2023-12-15'
      },
      body: JSON.stringify(toolCallRequest)
    });

    console.log('Tool call response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Tool Call Error:', errorText);
      return;
    }

    const toolCallResponse = await response.json();
    console.log('✅ Tool Call Response:');
    console.log(JSON.stringify(toolCallResponse, null, 2));
    
    // 分析工具调用响应
    if (toolCallResponse.content) {
      const toolUseBlocks = toolCallResponse.content.filter(block => block.type === 'tool_use');
      if (toolUseBlocks.length > 0) {
        console.log('\n🔍 Tool Use Analysis:');
        toolUseBlocks.forEach((block, index) => {
          console.log(`Tool ${index + 1}:`, {
            name: block.name,
            id: block.id,
            input: block.input
          });
        });
      } else {
        console.log('⚠️ No tool_use blocks found in response');
      }
    }
    
  } catch (error) {
    console.error('❌ Tool Call Error:', error.message);
  }
}

async function main() {
  console.log('=== Gemini Response Format Debug ===\n');
  
  // 1. 测试直接Gemini API调用
  await testGeminiDirectAPI();
  
  // 2. 测试通过路由器的调用
  await testGeminiThroughRouter();
  
  // 3. 测试工具调用
  await testGeminiToolCallThroughRouter();
}

main().catch(console.error);