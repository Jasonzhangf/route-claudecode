#!/usr/bin/env node

/**
 * 直接调用CodeWhisperer API获取原始响应
 * 基于debug-completion-record-20250726-1237.md中的成功方法
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { homedir } = require('os');

async function getToken() {
  try {
    const tokenPath = path.join(homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token.json');
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    return tokenData.accessToken;
  } catch (error) {
    throw new Error(`Failed to read token: ${error.message}`);
  }
}

async function testDirectCodeWhispererAPI() {
  console.log('🔍 直接测试CodeWhisperer API');
  console.log('基于之前成功解决空响应问题的经验');
  
  try {
    const token = await getToken();
    console.log('✅ Token获取成功');
    
    // 构建CodeWhisperer API请求 (基于converter的正确格式)
    const codewhispererRequest = {
      conversationState: {
        chatTriggerType: 'MANUAL',
        conversationId: `conv_${Date.now()}_test`,
        currentMessage: {
          userInputMessage: {
            content: 'hello test',
            modelId: 'CLAUDE_SONNET_4_20250514_V1_0',  // 使用日志中显示的映射模型
            origin: 'AI_EDITOR',
            userInputMessageContext: {}
          }
        },
        history: []
      },
      profileArn: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
    };
    
    console.log('📤 CodeWhisperer请求:', JSON.stringify(codewhispererRequest, null, 2));
    
    // 直接调用CodeWhisperer API
    const response = await axios.post(
      'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
      codewhispererRequest,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'claude-code-router/2.0.0'
        },
        responseType: 'arraybuffer',  // 获取原始二进制数据
        timeout: 30000
      }
    );
    
    console.log('📥 API响应状态:', response.status);
    console.log('📥 响应头:', response.headers);
    
    const rawBuffer = Buffer.from(response.data);
    console.log('📥 原始响应长度:', rawBuffer.length, '字节');
    console.log('📥 前100字节 (hex):', rawBuffer.toString('hex').substring(0, 100));
    console.log('📥 前500字符 (text):', rawBuffer.toString('utf8', 0, Math.min(500, rawBuffer.length)));
    
    // 保存原始响应
    fs.writeFileSync('debug-codewhisperer-raw.bin', rawBuffer);
    console.log('💾 原始响应已保存到 debug-codewhisperer-raw.bin');
    
    // 尝试使用我们的解析器解析
    console.log('\n🔧 使用路由器解析器测试:');
    
    try {
      // 简单的二进制数据分析
      if (rawBuffer.length === 0) {
        console.log('❌ 响应为空');
      } else if (rawBuffer.length < 12) {
        console.log('❌ 响应太短，不符合AWS事件流格式');
      } else {
        // 读取AWS事件流头部
        const totalLength = rawBuffer.readUInt32BE(0);
        const headersLength = rawBuffer.readUInt32BE(4);
        const crc = rawBuffer.readUInt32BE(8);
        
        console.log('📊 AWS事件流分析:');
        console.log('- 总长度:', totalLength);
        console.log('- 头部长度:', headersLength);
        console.log('- CRC:', crc.toString(16));
        
        if (totalLength === rawBuffer.length) {
          console.log('✅ 事件流格式看起来正确');
        } else {
          console.log('⚠️ 事件流长度不匹配');
        }
      }
    } catch (parseError) {
      console.log('❌ 解析过程出错:', parseError.message);
    }
    
    // 保存调试信息
    const debugData = {
      timestamp: new Date().toISOString(),
      request: codewhispererRequest,
      response: {
        status: response.status,
        headers: response.headers,
        dataLength: rawBuffer.length,
        hexPreview: rawBuffer.toString('hex').substring(0, 200),
        textPreview: rawBuffer.toString('utf8', 0, Math.min(1000, rawBuffer.length))
      }
    };
    
    fs.writeFileSync('debug-codewhisperer-api-test.json', JSON.stringify(debugData, null, 2));
    console.log('💾 调试信息已保存到 debug-codewhisperer-api-test.json');
    
  } catch (error) {
    console.error('❌ 直接API测试失败:', error.message);
    if (error.response) {
      console.error('- 状态码:', error.response.status);
      console.error('- 状态文本:', error.response.statusText);
      if (error.response.data) {
        const errorData = Buffer.from(error.response.data);
        console.error('- 错误响应:', errorData.toString('utf8'));
      }
    }
  }
}

// 运行测试
testDirectCodeWhispererAPI();