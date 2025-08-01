#!/usr/bin/env node

/**
 * 直接对比测试 - 我们的直接API调用 vs Demo2服务器
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

function parseEvents(responseBuffer) {
  const events = [];
  let offset = 0;

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
      }
      
    } catch (parseError) {
      // 忽略解析错误，继续处理
    }
  }

  return events;
}

function buildResponse(events, originalModel) {
  const contents = [];
  let textContent = '';
  let toolName = '';
  let toolUseId = '';
  let partialJsonStr = '';

  for (const event of events) {
    if (!event.data || typeof event.data !== 'object') continue;

    const dataMap = event.data;
    
    switch (dataMap.type) {
      case 'content_block_start':
        if (dataMap.content_block && dataMap.content_block.type === 'tool_use') {
          toolUseId = dataMap.content_block.id;
          toolName = dataMap.content_block.name;
          partialJsonStr = '';
        }
        break;

      case 'content_block_delta':
        if (dataMap.delta) {
          const deltaMap = dataMap.delta;
          
          switch (deltaMap.type) {
            case 'text_delta':
              if (deltaMap.text) {
                textContent += deltaMap.text;
              }
              break;

            case 'input_json_delta':
              toolUseId = deltaMap.id;
              toolName = deltaMap.name;
              if (deltaMap.partial_json) {
                partialJsonStr += deltaMap.partial_json;
              }
              break;
          }
        }
        break;

      case 'content_block_stop':
        const index = dataMap.index;
        
        if (index === 1 && toolUseId && toolName) {
          // 工具调用内容块
          try {
            const toolInput = JSON.parse(partialJsonStr);
            contents.push({
              type: 'tool_use',
              id: toolUseId,
              name: toolName,
              input: toolInput
            });
          } catch (parseError) {
            console.log(`   ⚠️  工具输入JSON解析失败: ${parseError.message}`);
            console.log(`   原始JSON字符串: ${partialJsonStr}`);
          }
        } else if (index === 0 && textContent) {
          // 文本内容块
          contents.push({
            type: 'text',
            text: textContent
          });
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
  }

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

async function testDirectComparison() {
  console.log('🔍 直接对比测试 - 我们的实现 vs Demo2\n');

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
                  content: {
                    type: "string",
                    description: "todo内容"
                  },
                  status: {
                    type: "string",
                    enum: ["pending", "in_progress", "completed"],
                    description: "todo状态"
                  },
                  priority: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "优先级"
                  },
                  id: {
                    type: "string",
                    description: "唯一标识符"
                  }
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

  console.log('================================================================================');
  console.log('📤 测试我们的直接实现 (绕过服务器)');
  console.log('================================================================================');

  let ourResult = null;
  
  try {
    const startTime = Date.now();

    // 1. 获取token
    const accessToken = await getToken();
    console.log(`✅ Token获取成功`);

    // 2. 构建请求
    const cwRequest = buildCodeWhispererRequest(toolCallRequest);
    console.log(`✅ 请求构建成功 (demo2格式)`);
    console.log(`   - 工具数量: ${cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools?.length || 0}`);

    // 3. 发送API请求
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

    // 4. 解析响应
    const responseBuffer = Buffer.from(response.data);
    const events = parseEvents(responseBuffer);
    console.log(`✅ 响应解析成功 (${events.length} 事件)`);

    // 5. 构建最终响应
    const finalResponse = buildResponse(events, toolCallRequest.model);
    console.log(`✅ 响应构建成功`);
    
    ourResult = {
      success: true,
      duration: duration,
      response: finalResponse
    };

    console.log(`📋 我们的结果:`);
    console.log(`   - 内容块数量: ${finalResponse.content.length}`);
    finalResponse.content.forEach((block, i) => {
      console.log(`     [${i}] 类型: ${block.type}`);
      if (block.type === 'tool_use') {
        console.log(`         工具: ${block.name}`);
        console.log(`         ID: ${block.id}`);
        console.log(`         输入: ${JSON.stringify(block.input)}`);
      }
    });

  } catch (error) {
    console.log(`❌ 我们的实现失败: ${error.message}`);
    ourResult = { success: false, error: error.message };
  }

  console.log('\n================================================================================');
  console.log('📤 测试Demo2服务器实现');
  console.log('================================================================================');

  let demo2Result = null;

  try {
    const startTime = Date.now();
    
    const response = await axios.post(
      'http://127.0.0.1:8080/v1/messages',
      toolCallRequest,
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

    console.log(`📋 Demo2结果:`);
    console.log(`   - 内容块数量: ${response.data.content.length}`);
    response.data.content.forEach((block, i) => {
      console.log(`     [${i}] 类型: ${block.type}`);
      if (block.type === 'tool_use') {
        console.log(`         工具: ${block.name}`);
        console.log(`         ID: ${block.id}`);
        console.log(`         输入: ${JSON.stringify(block.input)}`);
      }
    });

  } catch (error) {
    console.log(`❌ Demo2失败: ${error.message}`);
    demo2Result = { success: false, error: error.message };
  }

  console.log('\n================================================================================');
  console.log('📊 详细对比分析');
  console.log('================================================================================');

  if (ourResult.success && demo2Result.success) {
    console.log('✅ 两个实现都成功！');

    const ourContent = ourResult.response.content;
    const demo2Content = demo2Result.response.content;

    console.log(`\n🔍 逐项对比:`);
    console.log(`   内容块数量: ${ourContent.length} vs ${demo2Content.length} ${ourContent.length === demo2Content.length ? '✅' : '❌'}`);

    if (ourContent.length === demo2Content.length && ourContent.length > 0) {
      for (let i = 0; i < ourContent.length; i++) {
        const ourBlock = ourContent[i];
        const demo2Block = demo2Content[i];

        console.log(`\n   📦 内容块 ${i + 1}:`);
        console.log(`     类型: ${ourBlock.type} vs ${demo2Block.type} ${ourBlock.type === demo2Block.type ? '✅' : '❌'}`);
        
        if (ourBlock.type === 'tool_use' && demo2Block.type === 'tool_use') {
          console.log(`     工具名: ${ourBlock.name} vs ${demo2Block.name} ${ourBlock.name === demo2Block.name ? '✅' : '❌'}`);
          
          const ourInput = JSON.stringify(ourBlock.input);
          const demo2Input = JSON.stringify(demo2Block.input);
          const inputMatch = ourInput === demo2Input;
          
          console.log(`     输入匹配: ${inputMatch ? '✅' : '❌'}`);
          
          if (!inputMatch) {
            console.log(`       我们的输入: ${ourInput}`);
            console.log(`       Demo2输入: ${demo2Input}`);
          }
        }
      }
    }

    console.log(`\n⚡ 性能对比:`);
    console.log(`   我们的实现: ${ourResult.duration}ms`);
    console.log(`   Demo2实现: ${demo2Result.duration}ms`);
    console.log(`   差异: ${Math.abs(ourResult.duration - demo2Result.duration)}ms`);

  } else {
    console.log('❌ 至少有一个实现失败');
    if (!ourResult.success) console.log(`   我们的错误: ${ourResult.error}`);
    if (!demo2Result.success) console.log(`   Demo2错误: ${demo2Result.error}`);
  }

  // 保存详细对比
  const comparisonData = {
    timestamp: new Date().toISOString(),
    testCase: "工具调用对比",
    ourImplementation: ourResult,
    demo2Implementation: demo2Result,
    toolCallRequest: toolCallRequest
  };

  const comparisonFile = path.join(__dirname, 'direct-comparison-result.json');
  fs.writeFileSync(comparisonFile, JSON.stringify(comparisonData, null, 2));
  console.log(`\n📁 详细对比结果保存到: ${comparisonFile}`);

  console.log('\n================================================================================');
  console.log('🏁 直接对比测试完成');
  console.log('================================================================================');
  
  if (ourResult.success && demo2Result.success) {
    if (ourResult.response.content.length === demo2Result.response.content.length &&
        ourResult.response.content.every((block, i) => 
          block.type === demo2Result.response.content[i].type &&
          (block.type !== 'tool_use' || JSON.stringify(block.input) === JSON.stringify(demo2Result.response.content[i].input))
        )) {
      console.log('🎉 完美匹配！我们的实现与Demo2完全一致');
    } else {
      console.log('⚠️  基本功能相同，但细节有差异');
    }
  }
}

// 运行对比测试
testDirectComparison().catch(console.error);