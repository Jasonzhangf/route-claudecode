#!/usr/bin/env node

/**
 * 测试demo2的多轮对话功能
 */

const axios = require('axios');

async function testDemo2MultiTurn() {
  console.log('🔍 测试Demo2的多轮对话功能\n');

  try {
    // 第一轮对话
    console.log('=== 第一轮对话 ===');
    const turn1Request = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: "Hello, what's the capital of France?"
        }
      ]
    };

    const turn1Response = await axios.post('http://localhost:8080/v1/messages', turn1Request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });

    console.log('第一轮响应:');
    console.log(`Status: ${turn1Response.status}`);
    console.log(`Content: ${JSON.stringify(turn1Response.data.content)}`);
    
    const turn1Text = turn1Response.data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join(' ');
    console.log(`助手回复: "${turn1Text}"`);

    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 第二轮对话 - 测试上下文理解
    console.log('\n=== 第二轮对话 ===');
    const turn2Request = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: "Hello, what's the capital of France?"
        },
        {
          role: "assistant",
          content: turn1Text || "The capital of France is Paris."
        },
        {
          role: "user",
          content: "What about Germany?"
        }
      ]
    };

    const turn2Response = await axios.post('http://localhost:8080/v1/messages', turn2Request, {
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });

    console.log('第二轮响应:');
    console.log(`Status: ${turn2Response.status}`);
    console.log(`Content: ${JSON.stringify(turn2Response.data.content)}`);
    
    const turn2Text = turn2Response.data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join(' ');
    console.log(`助手回复: "${turn2Text}"`);

    // 分析多轮对话质量
    console.log('\n📊 多轮对话质量分析:');
    
    const mentionsGermany = turn2Text.toLowerCase().includes('germany');
    const mentionsBerlin = turn2Text.toLowerCase().includes('berlin');
    const hasContextualResponse = mentionsGermany || mentionsBerlin;
    
    console.log(`提到Germany: ${mentionsGermany ? '✅' : '❌'}`);
    console.log(`提到Berlin: ${mentionsBerlin ? '✅' : '❌'}`);
    console.log(`有上下文理解: ${hasContextualResponse ? '✅' : '❌'}`);
    
    if (hasContextualResponse) {
      console.log('🎉 Demo2的多轮对话功能正常');
    } else {
      console.log('❌ Demo2的多轮对话功能可能有问题');
    }

    return {
      success: true,
      turn1Text,
      turn2Text,
      hasContext: hasContextualResponse
    };

  } catch (error) {
    console.error('❌ Demo2多轮对话测试失败:', error.message);
    if (error.response) {
      console.error(`状态码: ${error.response.status}`);
      console.error(`错误数据:`, error.response.data);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('🧪 Demo2多轮对话测试\n');

  // 检查demo2服务器状态
  try {
    await axios.get('http://localhost:8080/health', { timeout: 5000 });
    console.log('✅ Demo2服务器运行正常\n');
  } catch (error) {
    console.error('❌ Demo2服务器未运行');
    return;
  }

  const result = await testDemo2MultiTurn();
  
  console.log('\n✨ 测试完成!');
  
  if (result.success) {
    console.log(`Demo2多轮对话结果: ${result.hasContext ? '成功' : '失败'}`);
  }
}

main().catch(console.error);