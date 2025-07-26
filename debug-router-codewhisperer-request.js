#!/usr/bin/env node

/**
 * 调试路由器发送给CodeWhisperer的实际请求
 * 对比直接API调用找出差异
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

async function interceptCodeWhispererCall() {
  console.log('🔍 监控路由器调用CodeWhisperer的过程');
  
  try {
    const token = await getToken();
    console.log('✅ Token获取成功');
    
    // 这里我们模拟路由器内部的请求构建过程
    // 基于converter.ts的逻辑
    const anthropicRequest = {
      model: 'claude-3-5-haiku-20241022',
      messages: [
        {
          role: 'user',
          content: 'hello test'
        }
      ],
      stream: false
    };
    
    console.log('📥 模拟Anthropic请求:', JSON.stringify(anthropicRequest, null, 2));
    
    // 模拟converter的转换过程
    const codewhispererRequest = {
      conversationState: {
        chatTriggerType: 'MANUAL',
        conversationId: `conv_${Date.now()}_router_test`,
        currentMessage: {
          userInputMessage: {
            content: 'hello test',
            modelId: 'CLAUDE_SONNET_4_20250514_V1_0',  // 使用日志中显示的映射
            origin: 'AI_EDITOR',
            userInputMessageContext: {}
          }
        },
        history: []  // 模拟空历史
      },
      profileArn: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK'
    };
    
    console.log('📤 转换后的CodeWhisperer请求:', JSON.stringify(codewhispererRequest, null, 2));
    
    // 检查请求差异
    console.log('\n🔍 关键配置对比:');
    console.log('- chatTriggerType:', codewhispererRequest.conversationState.chatTriggerType);
    console.log('- modelId:', codewhispererRequest.conversationState.currentMessage.userInputMessage.modelId);
    console.log('- origin:', codewhispererRequest.conversationState.currentMessage.userInputMessage.origin);
    console.log('- history length:', codewhispererRequest.conversationState.history.length);
    console.log('- profileArn:', codewhispererRequest.profileArn);
    
    // 发送请求到CodeWhisperer
    console.log('\n📡 发送请求到CodeWhisperer API...');
    
    const response = await axios.post(
      'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
      codewhispererRequest,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'claude-code-router/2.0.0'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );
    
    console.log('📥 CodeWhisperer响应状态:', response.status);
    console.log('📥 响应头:', response.headers);
    
    const rawBuffer = Buffer.from(response.data);
    console.log('📥 响应长度:', rawBuffer.length, '字节');
    
    if (rawBuffer.length > 0) {
      console.log('📥 前200字节 (hex):', rawBuffer.toString('hex').substring(0, 200));
      console.log('📥 前500字符 (text):', rawBuffer.toString('utf8', 0, Math.min(500, rawBuffer.length)));
      
      // 保存响应用于对比
      fs.writeFileSync('debug-router-codewhisperer-raw.bin', rawBuffer);
      console.log('💾 响应已保存到 debug-router-codewhisperer-raw.bin');
      
      console.log('\n✅ 路由器模拟请求成功，有内容返回!');
      console.log('这表明问题不在请求格式，而可能在路由器内部处理');
      
    } else {
      console.log('\n❌ 路由器模拟请求也返回空内容');
      console.log('这表明请求格式或配置有问题');
    }
    
    // 保存调试信息
    const debugData = {
      timestamp: new Date().toISOString(),
      anthropicRequest: anthropicRequest,
      codewhispererRequest: codewhispererRequest,
      response: {
        status: response.status,
        headers: response.headers,
        dataLength: rawBuffer.length
      }
    };
    
    fs.writeFileSync('debug-router-codewhisperer-test.json', JSON.stringify(debugData, null, 2));
    console.log('💾 调试信息已保存到 debug-router-codewhisperer-test.json');
    
  } catch (error) {
    console.error('❌ 模拟调用失败:', error.message);
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
interceptCodeWhispererCall();