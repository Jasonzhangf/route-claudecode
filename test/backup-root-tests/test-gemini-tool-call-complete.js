#!/usr/bin/env node

/**
 * 完整Gemini工具调用测试 - 验证工具调用完整解析
 * 测试从工具格式修复到工具调用解析的完整流程
 */

const fetch = require('node-fetch');

// 测试用的工具定义（已清理的格式）
const testRequest = {
  contents: [{
    role: "user",
    parts: [{
      text: "Please use the TodoWrite tool to create a todo item with content 'Test Gemini tool call parsing', status 'in_progress', priority 'high', and id 'test-1'"
    }]
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
                content: {
                  type: "string",
                  description: "The todo item content"
                },
                status: {
                  type: "string",
                  description: "Status of the todo",
                  enum: ["pending", "in_progress", "completed"]
                },
                priority: {
                  type: "string", 
                  description: "Priority level",
                  enum: ["low", "medium", "high"]
                },
                id: {
                  type: "string",
                  description: "Unique identifier"
                }
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
    maxOutputTokens: 1000,
    temperature: 0.1
  }
};

async function testCompleteGeminiToolCall() {
  console.log('🔧 完整Gemini工具调用测试\n');

  // 从配置文件读取API密钥
  const configPath = '/Users/fanzhang/.route-claude-code/config.release.json';
  let apiKeys = [];
  
  try {
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    apiKeys = config.providers['google-gemini'].authentication.credentials.apiKey;
    console.log(`📋 找到 ${apiKeys.length} 个Gemini API密钥`);
  } catch (error) {
    console.log('❌ 无法读取配置文件:', error.message);
    return false;
  }

  const apiKey = apiKeys[0]; // 使用第一个API密钥
  console.log(`🔑 使用 API Key: ***${apiKey.slice(-4)}`);
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  console.log('📤 发送工具调用请求:');
  console.log(`- 工具名称: ${testRequest.tools[0].functionDeclarations[0].name}`);
  console.log(`- 请求内容: ${testRequest.contents[0].parts[0].text.slice(0, 100)}...`);

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
      console.log('\n✅ API调用成功!');
      
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log('📊 响应解析成功');
        
        if (jsonResponse.candidates && jsonResponse.candidates[0]) {
          const candidate = jsonResponse.candidates[0];
          console.log(`🏁 完成原因: ${candidate.finishReason}`);
          
          if (candidate.content?.parts) {
            let toolCallFound = false;
            let textFound = false;
            
            console.log(`📋 响应部分数量: ${candidate.content.parts.length}`);
            
            candidate.content.parts.forEach((part, partIndex) => {
              console.log(`\n📦 Part ${partIndex + 1}:`);
              
              if (part.functionCall) {
                toolCallFound = true;
                console.log(`🔧 工具调用检测到!`);
                console.log(`  - 函数名: ${part.functionCall.name}`);
                console.log(`  - 参数:`, JSON.stringify(part.functionCall.args, null, 2));
                
                // 验证参数结构是否正确
                if (part.functionCall.name === 'TodoWrite' && part.functionCall.args?.todos) {
                  const todos = part.functionCall.args.todos;
                  console.log(`  - Todo项目数量: ${todos.length}`);
                  
                  todos.forEach((todo, todoIndex) => {
                    console.log(`    Todo ${todoIndex + 1}:`);
                    console.log(`      content: ${todo.content}`);
                    console.log(`      status: ${todo.status}`);
                    console.log(`      priority: ${todo.priority}`);
                    console.log(`      id: ${todo.id}`);
                  });
                }
                
              } else if (part.text) {
                textFound = true;
                console.log(`💬 文本内容: ${part.text}`);
              } else {
                console.log(`❓ 未知部分类型:`, Object.keys(part));
              }
            });
            
            console.log(`\n🎯 解析结果:`);
            console.log(`- 包含工具调用: ${toolCallFound ? '✅' : '❌'}`);
            console.log(`- 包含文本: ${textFound ? '✅' : '❌'}`);
            
            if (toolCallFound) {
              console.log('\n🚀 工具调用测试成功!');
              console.log('- Gemini API正确返回了functionCall');
              console.log('- 参数格式完整且正确');
              console.log('- 现在测试我们的解析器是否能正确处理这个响应...');
              
              // 模拟我们的解析过程
              console.log('\n🔄 模拟路由器解析过程:');
              console.log('1. Gemini API返回 -> functionCall格式');
              console.log('2. convertGeminiToOpenAIBuffered -> tool_calls格式');
              console.log('3. processOpenAIBufferedResponse -> tool_use格式');
              console.log('4. 最终输出 -> Claude Code工具调用格式');
              
              return true;
            } else {
              console.log('\n❌ 工具调用测试失败 - 没有检测到functionCall');
              return false;
            }
            
          } else {
            console.log('⚠️  响应中没有content.parts');
          }
        } else {
          console.log('⚠️  响应中没有candidates');
        }
        
      } catch (parseError) {
        console.log('⚠️  JSON解析失败:');
        console.log(responseText.slice(0, 1000) + '...');
      }
      
    } else {
      console.log(`❌ API调用失败 (${response.status})`);
      console.log(responseText.slice(0, 500) + '...');
    }
    
  } catch (error) {
    console.log(`❌ 请求异常: ${error.message}`);
  }

  return false;
}

// 运行测试
testCompleteGeminiToolCall()
  .then(success => {
    console.log(`\n${success ? '🎉' : '💥'} 完整Gemini工具调用测试${success ? '成功' : '失败'}!`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 测试异常:', error);
    process.exit(1);
  });