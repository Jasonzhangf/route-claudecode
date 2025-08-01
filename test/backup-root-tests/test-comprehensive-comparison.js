#!/usr/bin/env node

/**
 * 综合对比测试 - 包括简单对话、工具调用、多轮对话
 * 与demo2逐级对比验证
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// 我们的直接实现常量
const CODEWHISPERER_CONSTANTS = {
  ENDPOINT: 'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
  CHAT_TRIGGER_TYPE: 'MANUAL',
  ORIGIN: 'AI_EDITOR',
  PROFILE_ARN: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
};

const MODEL_MAP = {
  'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0'
};

async function getToken() {
  const tokenPath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  const data = fs.readFileSync(tokenPath, 'utf8');
  const token = JSON.parse(data);
  return token.accessToken;
}

function buildCodeWhispererRequest(anthropicReq) {
  const lastMessage = anthropicReq.messages[anthropicReq.messages.length - 1];
  let content = '';
  
  if (typeof lastMessage.content === 'string') {
    content = lastMessage.content;
  } else if (Array.isArray(lastMessage.content)) {
    content = lastMessage.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join(' ');
  }

  const cwRequest = {
    conversationState: {
      chatTriggerType: CODEWHISPERER_CONSTANTS.CHAT_TRIGGER_TYPE,
      conversationId: uuidv4(),
      currentMessage: {
        userInputMessage: {
          content: content,
          modelId: MODEL_MAP[anthropicReq.model] || anthropicReq.model,
          origin: CODEWHISPERER_CONSTANTS.ORIGIN,
          userInputMessageContext: {}
        }
      },
      history: []
    },
    profileArn: CODEWHISPERER_CONSTANTS.PROFILE_ARN
  };

  // 处理多轮对话历史 - 基于demo2逻辑
  if (anthropicReq.messages.length > 1) {
    const history = [];
    
    for (let i = 0; i < anthropicReq.messages.length - 1; i++) {
      const msg = anthropicReq.messages[i];
      
      if (msg.role === 'user') {
        let userContent = '';
        if (typeof msg.content === 'string') {
          userContent = msg.content;
        } else if (Array.isArray(msg.content)) {
          userContent = msg.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join(' ');
        }
        
        history.push({
          userInputMessage: {
            content: userContent,
            modelId: MODEL_MAP[anthropicReq.model] || anthropicReq.model,
            origin: CODEWHISPERER_CONSTANTS.ORIGIN
          }
        });
      } else if (msg.role === 'assistant') {
        let assistantContent = '';
        if (typeof msg.content === 'string') {
          assistantContent = msg.content;
        } else if (Array.isArray(msg.content)) {
          assistantContent = msg.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join(' ');
        }
        
        history.push({
          assistantResponseMessage: {
            content: assistantContent,
            toolUses: []
          }
        });
      }
    }
    
    cwRequest.conversationState.history = history;
  }

  // 处理工具 - 基于demo2的工具转换逻辑
  if (anthropicReq.tools && anthropicReq.tools.length > 0) {
    const tools = [];
    for (const tool of anthropicReq.tools) {
      const cwTool = {
        toolSpecification: {
          name: tool.name,
          description: tool.description,
          inputSchema: {
            json: tool.input_schema
          }
        }
      };
      tools.push(cwTool);
    }
    cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools = tools;
  }

  return cwRequest;
}

function parseEventsWithDebug(responseBuffer) {
  const events = [];
  let offset = 0;
  
  console.log(`\n🔍 详细SSE解析过程 (总字节: ${responseBuffer.length}):`);

  while (offset < responseBuffer.length) {
    if (responseBuffer.length - offset < 12) break;

    const totalLen = responseBuffer.readUInt32BE(offset);
    const headerLen = responseBuffer.readUInt32BE(offset + 4);
    offset += 8;

    if (totalLen > responseBuffer.length - offset + 8) break;

    // 跳过头部
    if (headerLen > 0) {
      offset += headerLen;
    }

    // 读取payload
    const payloadLen = totalLen - headerLen - 12;
    if (payloadLen <= 0) {
      offset += 4; // Skip CRC32
      continue;
    }

    const payload = responseBuffer.subarray(offset, offset + payloadLen);
    offset += payloadLen + 4; // +4 for CRC32

    // 处理payload
    let payloadStr = payload.toString('utf8');
    if (payloadStr.startsWith('vent')) {
      payloadStr = payloadStr.substring(4);
    }

    console.log(`   Payload: ${payloadStr}`);

    try {
      const evt = JSON.parse(payloadStr);
      
      // 转换为SSE事件格式 - 基于demo2逻辑
      if (evt.content) {
        events.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'text_delta',
              text: evt.content
            }
          }
        });
        console.log(`   -> 文本事件: "${evt.content}"`);
      }
      
      // 工具调用处理 - 基于demo2的工具调用检测
      if (evt.toolUseId && evt.name) {
        if (!evt.input) {
          // 工具调用开始
          events.push({
            event: 'content_block_start',
            data: {
              type: 'content_block_start',
              index: 1,
              content_block: {
                type: 'tool_use',
                id: evt.toolUseId,
                name: evt.name,
                input: {}
              }
            }
          });
          console.log(`   -> 工具开始: ${evt.name} (${evt.toolUseId})`);
        } else {
          // 工具调用输入
          events.push({
            event: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: 1,
              delta: {
                type: 'input_json_delta',
                id: evt.toolUseId,
                name: evt.name,
                partial_json: evt.input
              }
            }
          });
          console.log(`   -> 工具输入: "${evt.input}"`);
        }
      }
      
      if (evt.stop) {
        const stopIndex = evt.toolUseId ? 1 : 0;
        events.push({
          event: 'content_block_stop',
          data: {
            type: 'content_block_stop',
            index: stopIndex
          }
        });
        console.log(`   -> 停止事件 (index: ${stopIndex})`);
      }
      
    } catch (parseError) {
      console.log(`   ❌ JSON解析失败: ${parseError.message}`);
    }
  }

  console.log(`   总共解析 ${events.length} 个事件\n`);
  return events;
}

function buildResponseWithDebug(events, originalModel) {
  const contents = [];
  let textContent = '';
  let toolName = '';
  let toolUseId = '';
  let partialJsonStr = '';
  
  console.log(`🔍 响应构建过程:`);

  for (const event of events) {
    if (!event.data || typeof event.data !== 'object') continue;

    const dataMap = event.data;
    console.log(`   处理事件: ${dataMap.type}`);
    
    switch (dataMap.type) {
      case 'content_block_start':
        if (dataMap.content_block && dataMap.content_block.type === 'tool_use') {
          toolUseId = dataMap.content_block.id;
          toolName = dataMap.content_block.name;
          partialJsonStr = '';
          console.log(`     -> 开始工具调用: ${toolName} (${toolUseId})`);
        }
        break;

      case 'content_block_delta':
        if (dataMap.delta) {
          const deltaMap = dataMap.delta;
          
          switch (deltaMap.type) {
            case 'text_delta':
              if (deltaMap.text) {
                textContent += deltaMap.text;
                console.log(`     -> 累积文本: "${deltaMap.text}"`);
              }
              break;

            case 'input_json_delta':
              toolUseId = deltaMap.id;
              toolName = deltaMap.name;
              if (deltaMap.partial_json) {
                partialJsonStr += deltaMap.partial_json;
                console.log(`     -> 累积JSON: "${deltaMap.partial_json}" (总计: "${partialJsonStr}")`);
              }
              break;
          }
        }
        break;

      case 'content_block_stop':
        const index = dataMap.index;
        console.log(`     -> 停止块 ${index}`);
        
        if (index === 1 && toolUseId && toolName) {
          // 工具调用内容块
          try {
            console.log(`     -> 尝试解析工具JSON: "${partialJsonStr}"`);
            const toolInput = JSON.parse(partialJsonStr);
            contents.push({
              type: 'tool_use',
              id: toolUseId,
              name: toolName,
              input: toolInput
            });
            console.log(`     -> ✅ 工具调用添加成功`);
          } catch (parseError) {
            console.log(`     -> ❌ 工具输入JSON解析失败: ${parseError.message}`);
            console.log(`     -> 原始JSON字符串: "${partialJsonStr}"`);
          }
        } else if (index === 0 && textContent) {
          // 文本内容块
          contents.push({
            type: 'text',
            text: textContent
          });
          console.log(`     -> ✅ 文本内容添加成功: "${textContent}"`);
        }
        break;
    }
  }

  // 如果没有其他内容但有文本，添加文本块
  if (contents.length === 0 && textContent) {
    contents.push({
      type: 'text',
      text: textContent
    });
    console.log(`   -> ✅ 添加遗留文本内容: "${textContent}"`);
  }

  console.log(`   最终内容块数量: ${contents.length}\n`);

  return {
    type: 'message',
    model: originalModel,
    role: 'assistant',
    content: contents,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: Math.max(1, Math.floor(textContent.length / 4)),
      output_tokens: Math.max(1, Math.floor(textContent.length / 4))
    }
  };
}

async function testComprehensiveComparison() {
  console.log('🔍 综合对比测试 - 我们的实现 vs Demo2\n');

  const testCases = [
    {
      name: '简单文本对话',
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: "Hello! Please give me a brief greeting."
          }
        ]
      }
    },
    {
      name: '工具调用请求',
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: "请帮我创建一个todo项目：学习TypeScript"
          }
        ],
        tools: [
          {
            name: "TodoWrite",
            description: "创建和管理todo项目列表",
            input_schema: {
              type: "object",
              properties: {
                todos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      content: { type: "string", description: "todo内容" },
                      status: { type: "string", enum: ["pending", "in_progress", "completed"] },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                      id: { type: "string", description: "唯一标识符" }
                    },
                    required: ["content", "status", "priority", "id"]
                  }
                }
              },
              required: ["todos"]
            }
          }
        ]
      }
    },
    {
      name: '多轮对话',
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: "你好，我想学习编程"
          },
          {
            role: "assistant",
            content: "你好！学习编程是一个很好的选择。你想学习哪种编程语言呢？"
          },
          {
            role: "user",
            content: "我想学习TypeScript，你能给我一些建议吗？"
          }
        ]
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`🧪 测试用例: ${testCase.name}`);
    console.log(`${'='.repeat(100)}`);

    // 测试我们的直接实现
    console.log('\n📤 测试我们的直接实现:');
    let ourResult = null;
    
    try {
      const startTime = Date.now();

      // 1. 获取token和构建请求
      const accessToken = await getToken();
      const cwRequest = buildCodeWhispererRequest(testCase.request);
      
      console.log(`✅ 请求准备完成`);
      console.log(`   - 消息数量: ${testCase.request.messages.length}`);
      console.log(`   - 工具数量: ${testCase.request.tools?.length || 0}`);
      console.log(`   - 历史记录: ${cwRequest.conversationState.history.length} 项`);

      // 2. 发送API请求
      const response = await axios.post(
        CODEWHISPERER_CONSTANTS.ENDPOINT,
        cwRequest,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          responseType: 'arraybuffer',
          timeout: 60000
        }
      );

      const duration = Date.now() - startTime;
      console.log(`✅ API调用成功 (${duration}ms, ${response.data.length} bytes)`);

      // 3. 解析响应（带调试）
      const responseBuffer = Buffer.from(response.data);
      const events = parseEventsWithDebug(responseBuffer);

      // 4. 构建最终响应（带调试）
      const finalResponse = buildResponseWithDebug(events, testCase.request.model);
      
      ourResult = {
        success: true,
        duration: duration,
        response: finalResponse
      };

    } catch (error) {
      console.log(`❌ 我们的实现失败: ${error.message}`);
      ourResult = { success: false, error: error.message };
    }

    // 测试Demo2服务器
    console.log('\n📤 测试Demo2服务器:');
    let demo2Result = null;

    try {
      const startTime = Date.now();
      
      const response = await axios.post(
        'http://127.0.0.1:8080/v1/messages',
        testCase.request,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          timeout: 60000
        }
      );

      const duration = Date.now() - startTime;
      console.log(`✅ Demo2调用成功 (${duration}ms)`);
      
      demo2Result = {
        success: true,
        duration: duration,
        response: response.data
      };

    } catch (error) {
      console.log(`❌ Demo2失败: ${error.message}`);
      demo2Result = { success: false, error: error.message };
    }

    // 对比分析
    console.log('\n📊 对比分析:');
    console.log('-'.repeat(50));

    if (ourResult.success && demo2Result.success) {
      const ourContent = ourResult.response.content;
      const demo2Content = demo2Result.response.content;

      console.log(`✅ 两个实现都成功`);
      console.log(`📋 结构对比:`);
      console.log(`   我们的内容块: ${ourContent.length}`);
      console.log(`   Demo2内容块: ${demo2Content.length}`);
      
      // 详细内容对比
      console.log(`\n🔍 内容详情:`);
      console.log(`   我们的结果:`);
      ourContent.forEach((block, i) => {
        console.log(`     [${i}] ${block.type}: ${
          block.type === 'text' ? `"${block.text?.substring(0, 50)}..."` :
          block.type === 'tool_use' ? `${block.name}(${JSON.stringify(block.input)})` : 'unknown'
        }`);
      });
      
      console.log(`   Demo2结果:`);
      demo2Content.forEach((block, i) => {
        console.log(`     [${i}] ${block.type}: ${
          block.type === 'text' ? `"${block.text?.substring(0, 50)}..."` :
          block.type === 'tool_use' ? `${block.name}(${JSON.stringify(block.input)})` : 'unknown'
        }`);
      });

    } else {
      console.log(`❌ 至少有一个实现失败`);
      if (!ourResult.success) console.log(`   我们的错误: ${ourResult.error}`);
      if (!demo2Result.success) console.log(`   Demo2错误: ${demo2Result.error}`);
    }

    // 保存详细结果
    const resultFile = path.join(__dirname, `comprehensive-${testCase.name.replace(/\s+/g, '-')}.json`);
    fs.writeFileSync(resultFile, JSON.stringify({
      testCase: testCase.name,
      ourResult: ourResult,
      demo2Result: demo2Result,
      timestamp: new Date().toISOString()
    }, null, 2));
    console.log(`📁 详细结果保存到: ${resultFile}`);
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log('🏁 综合对比测试完成');
  console.log(`${'='.repeat(100)}`);
}

// 运行综合对比测试
testComprehensiveComparison().catch(console.error);