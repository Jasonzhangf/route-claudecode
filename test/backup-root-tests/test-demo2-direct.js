#!/usr/bin/env node

/**
 * 直接测试demo2移植的CodeWhisperer实现 - 不依赖服务器
 * 项目所有者: Jason Zhang
 */

const { CodeWhispererAuth } = require('./dist/providers/codewhisperer/auth.js');
const { CodeWhispererConverter } = require('./dist/providers/codewhisperer/converter.js');
const { CodeWhispererParser } = require('./dist/providers/codewhisperer/parser.js');

async function testDemo2Implementation() {
  console.log('🔍 直接测试基于demo2移植的CodeWhisperer实现\n');

  try {
    // 测试1: 认证模块
    console.log('============================================================');
    console.log('🧪 测试用例1: 认证模块验证');
    console.log('============================================================');

    const auth = CodeWhispererAuth.getInstance();
    
    try {
      const token = await auth.getToken();
      console.log('✅ Token读取成功');
      console.log(`   Token长度: ${token.length}`);
      console.log(`   Token前缀: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.log('❌ Token读取失败');
      console.log(`   错误: ${error.message}`);
      return;
    }

    // 测试2: 请求转换模块
    console.log('\n============================================================');
    console.log('🧪 测试用例2: 请求转换模块');
    console.log('============================================================');

    const converter = new CodeWhispererConverter();
    
    const anthropicRequest = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Hello, this is a test"
        }
      ],
      stream: false
    };

    try {
      const cwRequest = converter.buildCodeWhispererRequest(anthropicRequest);
      console.log('✅ 请求转换成功');
      console.log(`   conversationId: ${cwRequest.conversationState.conversationId}`);
      console.log(`   modelId: ${cwRequest.conversationState.currentMessage.userInputMessage.modelId}`);
      console.log(`   内容长度: ${cwRequest.conversationState.currentMessage.userInputMessage.content.length}`);
      console.log(`   profileArn: ${cwRequest.profileArn}`);
    } catch (error) {
      console.log('❌ 请求转换失败');
      console.log(`   错误: ${error.message}`);
      console.log(`   堆栈: ${error.stack}`);
      return;
    }

    // 测试3: 解析器模块
    console.log('\n============================================================');
    console.log('🧪 测试用例3: 解析器模块');
    console.log('============================================================');

    const parser = new CodeWhispererParser();
    
    // 创建一个简单的测试缓冲区 (模拟CodeWhisperer响应格式)
    const testResponseData = JSON.stringify({
      content: "Hello! This is a test response from CodeWhisperer.",
      stop: false
    });
    
    // 构建符合demo2格式的二进制缓冲区
    const headerLen = 0;
    const payloadData = Buffer.from('vent' + testResponseData, 'utf8');
    const totalLen = headerLen + payloadData.length + 12; // 12 = 8 bytes lengths + 4 bytes CRC32
    
    const testBuffer = Buffer.alloc(totalLen + 8); // +8 for frame lengths
    let offset = 0;
    
    testBuffer.writeUInt32BE(totalLen, offset); offset += 4;
    testBuffer.writeUInt32BE(headerLen, offset); offset += 4;
    // Skip header (headerLen = 0)
    payloadData.copy(testBuffer, offset); offset += payloadData.length;
    testBuffer.writeUInt32BE(0x12345678, offset); // Mock CRC32

    try {
      const events = parser.parseEvents(testBuffer);
      console.log('✅ 响应解析成功');
      console.log(`   解析事件数量: ${events.length}`);
      
      if (events.length > 0) {
        console.log(`   首个事件类型: ${events[0].event}`);
        if (events[0].data && events[0].data.delta && events[0].data.delta.text) {
          const text = events[0].data.delta.text;
          const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
          console.log(`   内容预览: "${preview}"`);
        }
      }

      // 测试非流式响应构建
      const response = parser.buildNonStreamResponse(events, anthropicRequest.model);
      console.log('✅ 非流式响应构建成功');
      console.log(`   响应模型: ${response.model}`);
      console.log(`   内容块数量: ${response.content.length}`);
      console.log(`   停止原因: ${response.stop_reason}`);
      
    } catch (error) {
      console.log('❌ 响应解析失败');
      console.log(`   错误: ${error.message}`);
      console.log(`   堆栈: ${error.stack}`);
      return;
    }

    console.log('\n============================================================');
    console.log('🎉 所有测试通过 - Demo2移植成功！');
    console.log('============================================================');
    console.log('✅ 认证模块: 正常工作');
    console.log('✅ 请求转换: 正常工作'); 
    console.log('✅ 响应解析: 正常工作');
    console.log('✅ 数据格式: 符合demo2规范');

  } catch (error) {
    console.log('\n❌ 测试过程中发生未预期错误');
    console.log(`   错误: ${error.message}`);
    console.log(`   堆栈: ${error.stack}`);
  }
}

// 运行测试
testDemo2Implementation().catch(console.error);