#!/usr/bin/env node

/**
 * Test Gemini Tool Call functionality
 * 测试Gemini工具调用功能
 */

const fetch = require('node-fetch');

async function testGeminiToolCall() {
  console.log('🔧 Testing Gemini tool call through router...');
  
  const toolCallRequest = {
    model: "claude-sonnet-4-20250514",
    messages: [
      {
        role: "user", 
        content: "请使用TodoWrite工具创建一个待办事项：学习TypeScript，状态是pending，优先级是high，ID是todo-001"
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
    console.log('📤 Request:');
    console.log(JSON.stringify(toolCallRequest, null, 2));
    
    const response = await fetch('http://localhost:6677/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'messages-2023-12-15'
      },
      body: JSON.stringify(toolCallRequest)
    });

    console.log('\n📥 Response status:', response.status);
    
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
      const textBlocks = toolCallResponse.content.filter(block => block.type === 'text');
      
      console.log('\n🔍 Response Analysis:');
      console.log(`- Text blocks: ${textBlocks.length}`);
      console.log(`- Tool use blocks: ${toolUseBlocks.length}`);
      
      if (toolUseBlocks.length > 0) {
        console.log('\n🔧 Tool Use Details:');
        toolUseBlocks.forEach((block, index) => {
          console.log(`Tool ${index + 1}:`, {
            name: block.name,
            id: block.id,
            input: block.input
          });
        });
      } else {
        console.log('⚠️ No tool_use blocks found in response');
        if (textBlocks.length > 0) {
          console.log('📝 Text content instead:');
          textBlocks.forEach(block => {
            console.log(`"${block.text}"`);
          });
        }
      }
      
      // Check usage information
      if (toolCallResponse.usage) {
        console.log('\n📊 Token Usage:');
        console.log(`- Input tokens: ${toolCallResponse.usage.input_tokens}`);
        console.log(`- Output tokens: ${toolCallResponse.usage.output_tokens}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Tool Call Error:', error.message);
    console.error('Error details:', error);
  }
}

async function main() {
  console.log('=== Gemini Tool Call Test ===\n');
  await testGeminiToolCall();
}

main().catch(console.error);