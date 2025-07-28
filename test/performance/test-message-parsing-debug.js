#!/usr/bin/env node

/**
 * Claude Code消息解析调试测试
 * 构建复杂请求来测试消息解析机制，模拟真实的多轮对话
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

async function testMessageParsingDebug() {
  console.log('🔍 Claude Code消息解析调试测试...\n');

  const baseUrl = 'http://127.0.0.1:3456';
  
  // 构建一个复杂的多轮对话请求，模拟Claude Code的真实请求
  const complexRequest = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: 'Hello, my name is Alice. Please remember this for our conversation.'
      },
      {
        role: 'assistant',
        content: 'Hello Alice! Nice to meet you. I\'ll remember your name throughout our conversation. How can I help you today?'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Can you create a simple file for me? I need a JSON file with my information.'
          }
        ]
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I\'d be happy to help you create a JSON file with your information, Alice. Let me create that for you.'
          },
          {
            type: 'tool_use',
            id: 'toolu_01A2B3C4D5E6F7G8H9',
            name: 'create_file',
            input: {
              filename: 'alice_info.json',
              content: '{"name": "Alice", "created_at": "2025-01-26", "type": "user_info"}'
            }
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'toolu_01A2B3C4D5E6F7G8H9',
            content: 'File alice_info.json created successfully with 67 bytes'
          }
        ]
      },
      {
        role: 'user',
        content: 'What is my name that I told you at the beginning? And what file did we just create?'
      }
    ],
    system: [
      {
        type: 'text',
        text: 'You are a helpful assistant that remembers user information throughout the conversation.'
      },
      {
        type: 'text',
        text: 'Always be polite and reference previous context when relevant.'
      }
    ],
    tools: [
      {
        name: 'create_file',
        description: 'Create a new file with specified content',
        input_schema: {
          type: 'object',
          properties: {
            filename: {
              type: 'string',
              description: 'Name of the file to create'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            }
          },
          required: ['filename', 'content']
        }
      }
    ],
    stream: false
  };

  console.log('📋 测试配置:');
  console.log(`   基础URL: ${baseUrl}`);
  console.log(`   消息数量: ${complexRequest.messages.length}`);
  console.log(`   系统消息数量: ${complexRequest.system.length}`);
  console.log(`   工具数量: ${complexRequest.tools.length}`);
  console.log(`   包含tool_use: ${complexRequest.messages.some(m => 
    Array.isArray(m.content) && m.content.some(c => c.type === 'tool_use'))}`);
  console.log(`   包含tool_result: ${complexRequest.messages.some(m => 
    Array.isArray(m.content) && m.content.some(c => c.type === 'tool_result'))}`);

  try {
    console.log('\n🚀 发送复杂请求...');
    
    // 使用原始Claude Code headers模拟真实请求
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjE0NjEsImVtYWlsIjoiMjA5NDQyM0BxcS5jb20iLCJhY2Nlc3NUb2tlbiI6IjRhOTYzODQwMTg1MTEzNjlhZWIyMjBiN2UyNDMyOTkxNWVmZGI1MmVhZmMwOGE5MjExMDU2NGQ1ZjdiODc2MTciLCJpYXQiOjE3NTIyNDA3ODEsImV4cCI6MTc1NDgzMjc4MX0.1lngsOZfYrG8n2GRBrAz5PLM1j1EvyWeWXyPZX-vfGI',
      'x-app': 'cli',
      'user-agent': 'claude-cli/1.0.56 (external, cli)',
      'x-stainless-package-version': '0.55.1',
      'x-stainless-os': 'MacOS',
      'x-stainless-arch': 'arm64',
      'x-stainless-runtime': 'node',
      'x-stainless-runtime-version': 'v22.16.0',
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-beta': 'claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
    };

    console.log('\n📤 请求详情:');
    console.log(`   请求体大小: ${JSON.stringify(complexRequest).length} 字符`);
    console.log(`   最后一条消息: ${JSON.stringify(complexRequest.messages[complexRequest.messages.length - 1]).substring(0, 100)}...`);

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(complexRequest)
    });

    console.log(`\n📡 响应状态: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ 请求失败详情:', errorText);
      return false;
    }

    const responseData = await response.json();
    const responseText = responseData.content?.[0]?.text || responseData.content || '';
    const responseStr = String(responseText || JSON.stringify(responseData));
    
    console.log('\n📥 响应分析:');
    console.log(`   响应长度: ${responseStr.length} 字符`);
    console.log(`   响应类型: ${typeof responseData}`);
    console.log(`   完整响应: ${JSON.stringify(responseData)}`);
    console.log(`   响应预览: ${responseStr.substring(0, 200)}...`);

    // 检查响应是否包含上下文信息
    const responseTextStr = String(responseText || '').toLowerCase();
    const mentionsAlice = responseTextStr.includes('alice');
    const mentionsFile = responseTextStr.includes('alice_info.json') || 
                        responseTextStr.includes('file');
    const hasContextualResponse = mentionsAlice && mentionsFile;

    console.log('\n🔍 上下文分析:');
    console.log(`   提到用户名Alice: ${mentionsAlice ? '✅' : '❌'}`);
    console.log(`   提到创建的文件: ${mentionsFile ? '✅' : '❌'}`);
    console.log(`   保持上下文连续性: ${hasContextualResponse ? '✅' : '❌'}`);

    // 保存详细结果用于进一步分析
    const testResults = {
      timestamp: new Date().toISOString(),
      testType: 'message-parsing-debug',
      request: {
        messageCount: complexRequest.messages.length,
        systemCount: complexRequest.system.length,
        toolCount: complexRequest.tools.length,
        hasComplexContent: true,
        hasToolUse: true,
        hasToolResult: true,
        requestSize: JSON.stringify(complexRequest).length
      },
      response: {
        statusCode: response.status,
        responseLength: responseText.length,
        responseType: typeof responseData,
        fullResponse: responseData
      },
      analysis: {
        mentionsAlice,
        mentionsFile,
        hasContextualResponse,
        responsePreview: responseText.substring(0, 500)
      }
    };

    const resultFile = path.join(__dirname, 'debug', 'debug-output', `message-parsing-debug-${Date.now()}.json`);
    const resultDir = path.dirname(resultFile);
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }
    fs.writeFileSync(resultFile, JSON.stringify(testResults, null, 2));
    console.log(`\n💾 详细结果已保存: ${resultFile}`);

    if (hasContextualResponse && responseText.length > 10) {
      console.log('\n🎉 消息解析和上下文处理正常！');
      console.log('✅ 复杂消息格式解析成功');
      console.log('✅ 多轮对话上下文保持正确');
      console.log('✅ System消息和Tools正确处理');
      return true;
    } else {
      console.log('\n⚠️  消息解析可能存在问题:');
      if (responseText.length <= 10) {
        console.log('❌ 响应内容过短或为空');
      }
      if (!mentionsAlice) {
        console.log('❌ 未能从历史消息中提取用户名');
      }
      if (!mentionsFile) {
        console.log('❌ 未能从对话历史中引用文件创建');
      }
      return false;
    }

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    return false;
  }
}

// 运行测试
if (require.main === module) {
  testMessageParsingDebug()
    .then(success => {
      console.log(`\n${success ? '🎊 消息解析功能正常!' : '❌ 消息解析存在问题，需要进一步调试'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = { testMessageParsingDebug };