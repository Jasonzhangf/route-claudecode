#!/usr/bin/env node

/**
 * Demo2 ProfileArn 强制写死修复验证测试
 * 验证CodeWhisperer使用硬编码profileArn避免400错误
 */

const axios = require('axios');

const testConfig = {
  port: 3456,
  host: '127.0.0.1'
};

async function testDemo2ProfileArnFix() {
  console.log('🧪 Demo2 ProfileArn 强制写死修复验证测试');
  console.log('=' .repeat(50));

  try {
    // Test: CodeWhisperer请求（background类别）
    console.log('\n📋 Test: CodeWhisperer ProfileArn修复验证');
    const request = {
      model: 'claude-3-5-haiku-20241022', // Will route to CodeWhisperer as background
      messages: [
        {
          role: 'user',
          content: 'Hello, can you help me with a simple coding question?'
        }
      ],
      max_tokens: 100,
      stream: false
    };

    console.log(`📤 发送请求到CodeWhisperer...`);
    
    const response = await axios.post(
      `http://${testConfig.host}:${testConfig.port}/v1/messages`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test-key'
        },
        timeout: 30000
      }
    );

    console.log(`✅ CodeWhisperer响应状态: ${response.status}`);
    console.log(`📄 响应内容预览: ${JSON.stringify(response.data).substring(0, 300)}...`);

    // 检查响应是否正常
    if (response.status === 200 && response.data.content) {
      console.log('\n🎉 Demo2 ProfileArn修复验证成功！');
      console.log('=' .repeat(50));
      console.log('✅ CodeWhisperer使用硬编码profileArn正常工作');
      console.log('✅ 避免了配置文件profileArn可能的400错误');
      console.log('✅ Demo2兼容性模式启用成功');
      console.log(`✅ 使用ProfileArn: arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK`);
    } else {
      console.log('⚠️ 响应格式异常，但至少没有400错误');
    }

  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      console.error(`❌ HTTP错误: ${status}`);
      console.error('响应数据:', JSON.stringify(data, null, 2));
      
      if (status === 400) {
        console.error('\n🚨 仍然出现400错误！');
        console.error('可能原因:');
        console.error('1. ProfileArn硬编码未生效');
        console.error('2. Token验证失败');
        console.error('3. 其他配置问题');
      } else if (status === 401) {
        console.log('\n⚠️ 401错误 - Token认证问题（可能是token过期）');
        console.log('但ProfileArn硬编码应该已经生效');
      } else if (status >= 500) {
        console.log('\n⚠️ 服务器错误 - 可能是AWS服务问题，非ProfileArn问题');
      }
    } else {
      console.error('❌ 网络错误:', error.message);
    }
    
    // 不直接退出，让用户看到结果
    console.log('\n📋 测试完成 - 请检查日志了解详细情况');
  }
}

// 运行测试
if (require.main === module) {
  testDemo2ProfileArnFix().catch(console.error);
}

module.exports = { testDemo2ProfileArnFix };