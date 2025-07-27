#!/usr/bin/env node

/**
 * 测试Grep工具调用后会话是否能继续
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

async function testGrepContinuation() {
  console.log('🔍 测试Grep工具调用后会话继续性\n');
  
  const request = {
    model: "claude-3-5-haiku-20241022",
    max_tokens: 131072,
    messages: [
      {
        role: "user",
        content: "请使用Grep工具搜索项目中包含'token'的文件，然后告诉我搜索结果有什么发现"
      }
    ],
    tools: [
      {
        name: "Grep",
        description: "搜索文件内容",
        input_schema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "搜索模式"
            },
            path: {
              type: "string", 
              description: "搜索路径"
            },
            output_mode: {
              type: "string",
              description: "输出模式"
            }
          },
          required: ["pattern"]
        }
      }
    ]
  };

  try {
    console.log('📤 发送请求到Router (端口3456)...');
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 60000
    });

    console.log('✅ 响应成功');
    console.log(`   状态码: ${response.status}`);
    console.log(`   停止原因: ${response.data.stop_reason || '无'}`);
    console.log(`   内容块数量: ${response.data.content?.length || 0}`);
    
    if (response.data.content) {
      response.data.content.forEach((item, index) => {
        console.log(`   [${index}] 类型: ${item.type}`);
        if (item.type === 'tool_use') {
          console.log(`       工具: ${item.name} (ID: ${item.id})`);
          console.log(`       输入: ${JSON.stringify(item.input)}`);
        } else if (item.type === 'text') {
          console.log(`       文本长度: ${item.text?.length || 0} 字符`);
          if (item.text && item.text.length < 200) {
            console.log(`       内容: ${item.text}`);
          }
        }
      });
    }

    // 检查是否有停止信号
    const hasStopReason = response.data.stop_reason !== undefined && response.data.stop_reason !== null;
    const hasToolUse = response.data.content?.some(item => item.type === 'tool_use');
    
    console.log('\n🎯 测试结果:');
    console.log(`   包含工具调用: ${hasToolUse ? '✅' : '❌'}`);
    console.log(`   包含停止原因: ${hasStopReason ? '❌ (不应该有)' : '✅ (正确)'}`);
    console.log(`   会话应该可以继续: ${!hasStopReason ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误详情:`, error.response.data);
    }
  }
}

testGrepContinuation().catch(console.error);