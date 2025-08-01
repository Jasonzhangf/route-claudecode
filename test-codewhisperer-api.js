#!/usr/bin/env node

/**
 * 直接测试CodeWhisperer API调用 - 完整的端到端测试
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// 从demo2移植的常量
const CODEWHISPERER_CONSTANTS = {
  ENDPOINT: 'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
  CHAT_TRIGGER_TYPE: 'MANUAL',
  ORIGIN: 'AI_EDITOR',
  PROFILE_ARN: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
};

const MODEL_MAP = {
  'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3-5-sonnet-20241022': 'CLAUDE_3_5_SONNET_20241022_V1_0'
};

async function getToken() {
  const tokenPath = path.join(os.homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
  if (!fs.existsSync(tokenPath)) {
    throw new Error('Token文件不存在');
  }
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

  return {
    conversationState: {
      chatTriggerType: CODEWHISPERER_CONSTANTS.CHAT_TRIGGER_TYPE,
      conversationId: uuidv4(),
      currentMessage: {
        userInputMessage: {
          content: content,
          modelId: MODEL_MAP[anthropicReq.model] || anthropicReq.model,
          origin: CODEWHISPERER_CONSTANTS.ORIGIN,
          userInputMessageContext: {} // 基于demo2: 必须为空对象
        }
      },
      history: []
    },
    profileArn: CODEWHISPERER_CONSTANTS.PROFILE_ARN
  };
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
      
      // 转换为SSE事件格式
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
      
      if (evt.stop) {
        events.push({
          event: 'content_block_stop',
          data: {
            type: 'content_block_stop',
            index: 0
          }
        });
      }
    } catch (parseError) {
      console.log(`   ⚠️  JSON解析失败: ${parseError.message}`);
    }
  }

  return events;
}

function buildResponse(events, originalModel) {
  let textContent = '';
  
  for (const event of events) {
    if (event.data && event.data.delta && event.data.delta.text) {
      textContent += event.data.delta.text;
    }
  }

  return {
    id: `cw_${Date.now()}`,
    type: 'message',
    model: originalModel,
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: textContent
      }
    ],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: Math.max(1, Math.floor(textContent.length / 4)),
      output_tokens: Math.max(1, Math.floor(textContent.length / 4))
    }
  };
}

async function testCodeWhispererAPI() {
  console.log('🔍 测试CodeWhisperer API直接调用\n');

  const testCases = [
    {
      name: '简单文本请求',
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: "Hello! Please respond with a simple greeting."
          }
        ]
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`============================================================`);
    console.log(`🧪 测试用例: ${testCase.name}`);
    console.log(`============================================================`);

    try {
      const startTime = Date.now();

      // 1. 获取token
      console.log('📤 步骤1: 获取认证token...');
      const accessToken = await getToken();
      console.log(`   ✅ Token获取成功 (长度: ${accessToken.length})`);

      // 2. 构建请求
      console.log('📤 步骤2: 构建CodeWhisperer请求...');
      const cwRequest = buildCodeWhispererRequest(testCase.request);
      console.log(`   ✅ 请求构建成功`);
      console.log(`   - conversationId: ${cwRequest.conversationState.conversationId}`);
      console.log(`   - modelId: ${cwRequest.conversationState.currentMessage.userInputMessage.modelId}`);
      console.log(`   - 内容: "${cwRequest.conversationState.currentMessage.userInputMessage.content}"`);

      // 3. 发送API请求
      console.log('📤 步骤3: 发送API请求...');
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
          timeout: 30000
        }
      );

      const duration = Date.now() - startTime;

      console.log(`   ✅ API调用成功 (${duration}ms)`);
      console.log(`   - 状态码: ${response.status}`);
      console.log(`   - 响应大小: ${response.data.length} bytes`);

      // 4. 解析响应
      console.log('📤 步骤4: 解析响应数据...');
      const responseBuffer = Buffer.from(response.data);
      const events = parseEvents(responseBuffer);
      
      console.log(`   ✅ 响应解析成功`);
      console.log(`   - 解析事件数量: ${events.length}`);

      // 5. 构建最终响应
      console.log('📤 步骤5: 构建最终响应...');
      const finalResponse = buildResponse(events, testCase.request.model);
      
      console.log(`   ✅ 响应构建成功`);
      console.log(`   - 响应ID: ${finalResponse.id}`);
      console.log(`   - 模型: ${finalResponse.model}`);
      console.log(`   - 停止原因: ${finalResponse.stop_reason}`);
      
      if (finalResponse.content && finalResponse.content[0] && finalResponse.content[0].text) {
        const text = finalResponse.content[0].text;
        const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
        console.log(`   - 响应内容: "${preview}"`);
        console.log(`   - 内容长度: ${text.length} 字符`);
      }

      if (finalResponse.usage) {
        console.log(`   - Token使用: 输入=${finalResponse.usage.input_tokens}, 输出=${finalResponse.usage.output_tokens}`);
      }

      console.log(`\n✅ 测试通过 - Demo2移植完全成功！`);

    } catch (error) {
      console.log(`\n❌ 测试失败`);
      console.log(`   错误: ${error.message}`);
      
      if (error.response) {
        console.log(`   API状态码: ${error.response.status}`);
        console.log(`   API错误信息: ${error.response.statusText}`);
        
        if (error.response.data) {
          try {
            const errorText = Buffer.from(error.response.data).toString('utf8');
            console.log(`   详细错误: ${errorText.substring(0, 200)}`);
          } catch (e) {
            console.log(`   响应数据长度: ${error.response.data.length} bytes`);
          }
        }
      }
      
      if (error.code) {
        console.log(`   错误代码: ${error.code}`);
      }
    }
  }

  console.log(`\n============================================================`);
  console.log('🏁 API测试完成');
  console.log(`============================================================`);
}

// 运行测试
testCodeWhispererAPI().catch(console.error);