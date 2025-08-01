#!/usr/bin/env node

/**
 * 调试CodeWhisperer响应格式 - 查看原始数据
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
  return {
    conversationState: {
      chatTriggerType: CODEWHISPERER_CONSTANTS.CHAT_TRIGGER_TYPE,
      conversationId: uuidv4(),
      currentMessage: {
        userInputMessage: {
          content: anthropicReq.messages[0].content,
          modelId: MODEL_MAP[anthropicReq.model],
          origin: CODEWHISPERER_CONSTANTS.ORIGIN,
          userInputMessageContext: {}
        }
      },
      history: []
    },
    profileArn: CODEWHISPERER_CONSTANTS.PROFILE_ARN
  };
}

async function debugCodeWhispererResponse() {
  console.log('🔍 调试CodeWhisperer响应格式\n');

  try {
    const accessToken = await getToken();
    console.log('✅ Token获取成功');

    const testRequest = {
      model: "claude-sonnet-4-20250514",
      messages: [{ role: "user", content: "Hello" }]
    };

    const cwRequest = buildCodeWhispererRequest(testRequest);
    console.log('✅ 请求构建成功');
    console.log('请求内容:', JSON.stringify(cwRequest, null, 2));

    console.log('\n📤 发送API请求...');
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

    console.log('✅ API调用成功');
    console.log(`状态码: ${response.status}`);
    console.log(`响应大小: ${response.data.length} bytes`);

    const responseBuffer = Buffer.from(response.data);
    console.log('\n🔍 原始响应分析:');
    console.log(`Buffer长度: ${responseBuffer.length}`);
    console.log(`前64字节十六进制: ${responseBuffer.subarray(0, Math.min(64, responseBuffer.length)).toString('hex')}`);
    console.log(`前200字符UTF-8: ${responseBuffer.subarray(0, Math.min(200, responseBuffer.length)).toString('utf8')}`);

    // 尝试逐字节解析
    console.log('\n🔍 逐字节解析:');
    let offset = 0;
    let frameCount = 0;

    while (offset < responseBuffer.length && frameCount < 5) {
      console.log(`\n--- 帧 ${frameCount + 1} (偏移: ${offset}) ---`);
      
      if (responseBuffer.length - offset < 8) {
        console.log('剩余字节不足8，停止解析');
        break;
      }

      const totalLen = responseBuffer.readUInt32BE(offset);
      const headerLen = responseBuffer.readUInt32BE(offset + 4);
      
      console.log(`总长度: ${totalLen}`);
      console.log(`头部长度: ${headerLen}`);
      
      if (totalLen === 0) {
        console.log('总长度为0，跳过');
        offset += 8;
        frameCount++;
        continue;
      }

      if (totalLen > responseBuffer.length - offset) {
        console.log('总长度超出剩余数据，可能是解析错误');
        break;
      }

      offset += 8;

      // 跳过头部
      if (headerLen > 0) {
        const header = responseBuffer.subarray(offset, offset + headerLen);
        console.log(`头部内容: ${header.toString('hex')}`);
        offset += headerLen;
      }

      // 计算payload长度
      const payloadLen = totalLen - headerLen - 12; // 12 = 8字节长度 + 4字节CRC
      console.log(`Payload长度: ${payloadLen}`);

      if (payloadLen > 0) {
        const payload = responseBuffer.subarray(offset, offset + payloadLen);
        console.log(`Payload十六进制: ${payload.toString('hex')}`);
        console.log(`Payload UTF-8: ${payload.toString('utf8')}`);
        
        // 尝试移除vent前缀
        let payloadStr = payload.toString('utf8');
        if (payloadStr.startsWith('vent')) {
          payloadStr = payloadStr.substring(4);
          console.log(`移除vent后: ${payloadStr}`);
        }

        // 尝试JSON解析
        try {
          const data = JSON.parse(payloadStr);
          console.log(`JSON解析成功:`, data);
        } catch (e) {
          console.log(`JSON解析失败: ${e.message}`);
        }

        offset += payloadLen;
      }

      // 跳过CRC32
      if (offset + 4 <= responseBuffer.length) {
        const crc32 = responseBuffer.readUInt32BE(offset);
        console.log(`CRC32: 0x${crc32.toString(16)}`);
        offset += 4;
      }

      frameCount++;
    }

    console.log(`\n总共解析了 ${frameCount} 个帧`);

    // 保存原始响应到文件用于进一步分析
    const debugFile = path.join(__dirname, 'debug-codewhisperer-response.bin');
    fs.writeFileSync(debugFile, responseBuffer);
    console.log(`\n💾 原始响应已保存到: ${debugFile}`);

  } catch (error) {
    console.log('❌ 调试过程中发生错误');
    console.log(`错误: ${error.message}`);
    
    if (error.response) {
      console.log(`API状态码: ${error.response.status}`);
      if (error.response.data) {
        const errorBuffer = Buffer.from(error.response.data);
        console.log(`错误响应: ${errorBuffer.toString('utf8').substring(0, 200)}`);
      }
    }
  }
}

debugCodeWhispererResponse().catch(console.error);