#!/usr/bin/env node

/**
 * 测试基于demo2移植的新CodeWhisperer实现
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

async function testDemo2Port() {
  console.log('🔍 测试基于demo2移植的新CodeWhisperer实现\n');

  const testCases = [
    {
      name: '简单文本请求',
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: "Hello, 这是一个测试请求"
          }
        ]
      }
    },
    {
      name: '工具调用请求',
      request: {
        model: "claude-sonnet-4-20250514", 
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: "请帮我读取文件 /tmp/test.txt"
          }
        ],
        tools: [
          {
            name: "Read",
            description: "读取文件内容",
            input_schema: {
              type: "object",
              properties: {
                file_path: {
                  type: "string",
                  description: "文件路径"
                }
              },
              required: ["file_path"]
            }
          }
        ]
      }
    },
    {
      name: '多轮对话请求',
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: "你好"
          },
          {
            role: "assistant", 
            content: "你好！我是Claude，很高兴为您服务。"
          },
          {
            role: "user",
            content: "请介绍一下你自己"
          }
        ]
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 测试用例: ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);

    try {
      const startTime = Date.now();
      
      console.log('📤 发送请求...');
      console.log(`   模型: ${testCase.request.model}`);
      console.log(`   消息数量: ${testCase.request.messages.length}`);
      console.log(`   包含工具: ${testCase.request.tools ? '是' : '否'}`);

      const response = await axios.post(
        'http://127.0.0.1:3456/v1/messages',
        testCase.request,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          timeout: 30000
        }
      );

      const duration = Date.now() - startTime;

      console.log(`\n📥 响应接收成功 (${duration}ms)`);
      console.log(`   状态码: ${response.status}`);
      console.log(`   响应模型: ${response.data.model}`);
      console.log(`   停止原因: ${response.data.stop_reason}`);
      console.log(`   内容块数量: ${response.data.content?.length || 0}`);

      if (response.data.usage) {
        console.log(`   Token使用: 输入=${response.data.usage.input_tokens}, 输出=${response.data.usage.output_tokens}`);
      }

      // 分析内容块
      if (response.data.content && response.data.content.length > 0) {
        console.log('\n📋 内容分析:');
        response.data.content.forEach((block, index) => {
          console.log(`   [${index}] 类型: ${block.type}`);
          
          if (block.type === 'text' && block.text) {
            const preview = block.text.length > 100 ? 
              block.text.substring(0, 100) + '...' : 
              block.text;
            console.log(`       文本预览: "${preview}"`);
          }
          
          if (block.type === 'tool_use') {
            console.log(`       工具名称: ${block.name}`);
            console.log(`       工具ID: ${block.id}`);
            console.log(`       工具输入: ${JSON.stringify(block.input)}`);
          }
        });
      }

      console.log('\n✅ 测试通过');

    } catch (error) {
      console.log('\n❌ 测试失败');
      console.log(`   错误: ${error.message}`);
      
      if (error.response) {
        console.log(`   状态码: ${error.response.status}`);
        console.log(`   响应数据:`, error.response.data);
      }
      
      if (error.code === 'ECONNREFUSED') {
        console.log('   💡 提示: 请确保服务器正在运行在端口3456 (./rcc start --debug)');
        break; // 如果连接被拒绝，不继续其他测试
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 测试完成');
  console.log(`${'='.repeat(60)}`);
}

// 运行测试
testDemo2Port().catch(console.error);