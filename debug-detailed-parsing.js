#!/usr/bin/env node

/**
 * 详细解析调试 - 逐步分析SSE事件处理
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

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

  // 处理工具
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

function parseEventsWithDetailedDebug(responseBuffer) {
  const events = [];
  let offset = 0;
  
  console.log(`\\n🔍 详细SSE解析过程 (总字节: ${responseBuffer.length}):`);

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

    console.log(`   📦 Payload: ${payloadStr}`);

    try {
      const evt = JSON.parse(payloadStr);
      
      console.log(`   📋 解析事件:`, {
        hasContent: !!evt.content,
        hasToolInfo: !!(evt.toolUseId && evt.name),
        hasInput: !!evt.input,
        stop: evt.stop,
        toolUseId: evt.toolUseId,
        name: evt.name,
        content: evt.content,
        input: evt.input
      });
      
      // 转换为SSE事件格式
      if (evt.content) {
        const textEvent = {
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 0,
            delta: {
              type: 'text_delta',
              text: evt.content
            }
          }
        };
        events.push(textEvent);
        console.log(`   ➡️  添加文本事件: "${evt.content}"`);
      }
      
      // 工具调用处理
      if (evt.toolUseId && evt.name) {
        if (!evt.input) {
          // 工具调用开始
          const startEvent = {
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
          };
          events.push(startEvent);
          console.log(`   🛠️  添加工具开始事件: ${evt.name} (${evt.toolUseId})`);
        } else {
          // 工具调用输入
          const inputEvent = {
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
          };
          events.push(inputEvent);
          console.log(`   🔧  添加工具输入事件: "${evt.input}"`);
        }
      }
      
      if (evt.stop) {
        const stopIndex = evt.toolUseId ? 1 : 0;
        const stopEvent = {
          event: 'content_block_stop',
          data: {
            type: 'content_block_stop',
            index: stopIndex
          }
        };
        events.push(stopEvent);
        console.log(`   ⏹️  添加停止事件 (index: ${stopIndex})`);
      }
      
    } catch (parseError) {
      console.log(`   ❌ JSON解析失败: ${parseError.message}`);
    }
  }

  console.log(`   ✅ 总共解析 ${events.length} 个事件\\n`);
  return events;
}

function buildBufferedResponseWithDebug(events, originalModel) {
  const contexts = [];
  
  // 缓冲状态管理
  let textBuffer = '';
  let toolCallBuffer = new Map();
  
  console.log(`🔧 开始缓冲式响应构建 (${events.length} 个事件):`);
  
  // 第一阶段：完整缓冲所有数据
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    console.log(`\\n   [${i+1}/${events.length}] 处理事件: ${event.event}`);
    
    if (!event.data || typeof event.data !== 'object') {
      console.log(`      ⚠️  跳过无效数据`);
      continue;
    }

    const dataMap = event.data;
    console.log(`      📋 事件类型: ${dataMap.type}, index: ${dataMap.index}`);
    
    switch (dataMap.type) {
      case 'content_block_start':
        if (dataMap.content_block && dataMap.content_block.type === 'tool_use') {
          const toolId = dataMap.content_block.id;
          const toolName = dataMap.content_block.name;
          
          toolCallBuffer.set(toolId, {
            id: toolId,
            name: toolName,
            jsonFragments: [],
            isComplete: false
          });
          
          console.log(`      🛠️  初始化工具缓冲区: ${toolName} (${toolId})`);
        }
        break;

      case 'content_block_delta':
        if (dataMap.delta) {
          const deltaMap = dataMap.delta;
          console.log(`      🔄 Delta类型: ${deltaMap.type}`);
          
          switch (deltaMap.type) {
            case 'text_delta':
              if (deltaMap.text) {
                textBuffer += deltaMap.text;
                console.log(`      📝 缓冲文本: "${deltaMap.text}" (总长度: ${textBuffer.length})`);
              }
              break;

            case 'input_json_delta':
              const toolId = deltaMap.id;
              const fragment = deltaMap.partial_json;
              if (fragment && toolCallBuffer.has(toolId)) {
                toolCallBuffer.get(toolId).jsonFragments.push(fragment);
                const toolData = toolCallBuffer.get(toolId);
                console.log(`      🔧 缓冲JSON片段: "${fragment}" (工具: ${toolData.name}, 总片段: ${toolData.jsonFragments.length})`);
              } else {
                console.log(`      ⚠️  工具ID未找到或片段为空: ${toolId}, fragment: ${fragment}`);
              }
              break;
          }
        }
        break;

      case 'content_block_stop':
        const index = dataMap.index;
        console.log(`      ⏹️  内容块停止: index ${index}`);
        
        if (index === 1) {
          // 标记工具调用完成
          for (const [toolId, toolData] of toolCallBuffer) {
            if (!toolData.isComplete) {
              toolData.isComplete = true;
              console.log(`      ✅ 工具调用标记完成: ${toolData.name} (${toolData.jsonFragments.length} 个片段)`);
              break;
            }
          }
        } else if (index === 0 && textBuffer) {
          contexts.push({
            type: 'text',
            text: textBuffer
          });
          console.log(`      📄 添加文本内容: "${textBuffer.substring(0, 50)}..." (长度: ${textBuffer.length})`);
          textBuffer = '';
        }
        break;
    }
  }

  console.log(`\\n🔍 缓冲区状态检查:`);
  console.log(`   📝 文本缓冲区长度: ${textBuffer.length}`);
  console.log(`   🛠️  工具调用缓冲区: ${toolCallBuffer.size} 个工具`);
  
  // 第二阶段：处理完整的工具调用缓冲区
  for (const [toolId, toolData] of toolCallBuffer) {
    console.log(`\\n   🔧 处理工具: ${toolData.name} (${toolId})`);
    console.log(`      完成状态: ${toolData.isComplete}`);
    console.log(`      JSON片段数: ${toolData.jsonFragments.length}`);
    console.log(`      片段内容: ${toolData.jsonFragments.map(f => `"${f}"`).join(', ')}`);
    
    if (toolData.isComplete && toolData.jsonFragments.length > 0) {
      const completeJsonStr = toolData.jsonFragments.join('');
      console.log(`      🔗 合并JSON: "${completeJsonStr}"`);
      
      try {
        const toolInput = JSON.parse(completeJsonStr);
        contexts.push({
          type: 'tool_use',
          id: toolData.id,
          name: toolData.name,
          input: toolInput
        });
        console.log(`      ✅ 成功解析工具调用，添加到contexts`);
      } catch (parseError) {
        console.log(`      ❌ JSON解析失败: ${parseError.message}`);
        contexts.push({
          type: 'text',
          text: `Tool call: ${toolData.name}(${completeJsonStr})`
        });
        console.log(`      📄 作为文本添加`);
      }
    } else {
      console.log(`      ⚠️  工具未完成或无片段，跳过`);
    }
  }

  // 处理遗留的文本缓冲区
  if (textBuffer && contexts.length === 0) {
    contexts.push({
      type: 'text',
      text: textBuffer
    });
    console.log(`\\n   📄 添加遗留文本: "${textBuffer.substring(0, 50)}..."`);
  }

  console.log(`\\n🏁 最终结果:`);
  console.log(`   📋 内容块数: ${contexts.length}`);
  contexts.forEach((ctx, i) => {
    console.log(`   [${i}] ${ctx.type}: ${
      ctx.type === 'text' ? `"${ctx.text?.substring(0, 50)}..."` :
      ctx.type === 'tool_use' ? `${ctx.name}(keys: ${Object.keys(ctx.input).join(',')})` : 'unknown'
    }`);
  });

  return {
    type: 'message',
    model: originalModel,
    role: 'assistant',
    content: contexts,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: Math.max(1, Math.floor((textBuffer.length || 50) / 4)),
      output_tokens: Math.max(1, Math.floor((textBuffer.length || 50) / 4)),
    },
  };
}

async function debugDetailedParsing() {
  console.log('🔍 详细解析调试 - 逐步分析\\n');

  const toolCallRequest = {
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
  };

  try {
    console.log('📤 发送API请求...');
    const accessToken = await getToken();
    const cwRequest = buildCodeWhispererRequest(toolCallRequest);
    
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

    console.log(`✅ API调用成功 (${response.data.length} bytes)`);

    // 详细解析和调试
    const responseBuffer = Buffer.from(response.data);
    const events = parseEventsWithDetailedDebug(responseBuffer);
    const finalResponse = buildBufferedResponseWithDebug(events, toolCallRequest.model);
    
    // 保存详细调试结果
    const debugFile = path.join(__dirname, 'detailed-parsing-debug.json');
    fs.writeFileSync(debugFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      events: events,
      finalResponse: finalResponse,
      rawPayloads: [], // 可以添加原始payload数据
    }, null, 2));
    console.log(`\\n📁 详细调试数据保存到: ${debugFile}`);

  } catch (error) {
    console.log(`❌ 调试失败: ${error.message}`);
    console.log(error.stack);
  }
}

// 运行详细调试
debugDetailedParsing().catch(console.error);