#!/usr/bin/env node

/**
 * Demo2 vs Router 工具解析对比测试
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

async function testToolParsing() {
  console.log('🔍 Demo2 vs Router 工具解析对比测试\n');
  
  const request = {
    model: "claude-3-5-haiku-20241022",
    max_tokens: 131072,
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
  };

  try {
    console.log('📤 发送请求到Demo2 (端口3457)...');
    const demo2Response = await axios.post('http://127.0.0.1:3457/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 30000
    }).catch(error => {
      console.log('⚠️  Demo2不可用:', error.code);
      return null;
    });

    console.log('📤 发送请求到Router (端口3456)...');  
    const routerResponse = await axios.post('http://127.0.0.1:3456/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 30000
    });

    // 对比分析
    console.log('\n' + '='.repeat(60));
    console.log('📊 对比分析结果');
    console.log('='.repeat(60));

    if (demo2Response) {
      console.log('\n🔵 Demo2 响应:');
      console.log(`   状态: ${demo2Response.status}`);
      console.log(`   停止原因: ${demo2Response.data.stop_reason}`);
      console.log(`   内容块数量: ${demo2Response.data.content?.length || 0}`);
      
      if (demo2Response.data.content) {
        demo2Response.data.content.forEach((item, index) => {
          console.log(`   [${index}] 类型: ${item.type}`);
          if (item.type === 'tool_use') {
            console.log(`       工具: ${item.name} (ID: ${item.id})`);
            console.log(`       输入: ${JSON.stringify(item.input)}`);
          }
        });
      }
    }

    console.log('\n🟢 Router 响应:');
    console.log(`   状态: ${routerResponse.status}`);
    console.log(`   停止原因: ${routerResponse.data.stop_reason}`);
    console.log(`   内容块数量: ${routerResponse.data.content?.length || 0}`);
    
    if (routerResponse.data.content) {
      routerResponse.data.content.forEach((item, index) => {
        console.log(`   [${index}] 类型: ${item.type}`);
        if (item.type === 'tool_use') {
          console.log(`       工具: ${item.name} (ID: ${item.id})`);
          console.log(`       输入: ${JSON.stringify(item.input)}`);
        }
      });
    }

    // 差异分析
    console.log('\n🔍 差异分析:');
    
    if (demo2Response) {
      const demo2HasTool = demo2Response.data.content?.some(item => item.type === 'tool_use');
      const routerHasTool = routerResponse.data.content?.some(item => item.type === 'tool_use');
      
      console.log(`   Demo2 工具调用: ${demo2HasTool ? '✅' : '❌'}`);
      console.log(`   Router 工具调用: ${routerHasTool ? '✅' : '❌'}`);
      
      if (demo2HasTool && routerHasTool) {
        const demo2Tool = demo2Response.data.content.find(item => item.type === 'tool_use');
        const routerTool = routerResponse.data.content.find(item => item.type === 'tool_use');
        
        console.log(`   工具名称匹配: ${demo2Tool.name === routerTool.name ? '✅' : '❌'}`);
        console.log(`   工具输入匹配: ${JSON.stringify(demo2Tool.input) === JSON.stringify(routerTool.input) ? '✅' : '❌'}`);
        
        if (JSON.stringify(demo2Tool.input) !== JSON.stringify(routerTool.input)) {
          console.log(`     Demo2 输入: ${JSON.stringify(demo2Tool.input)}`);
          console.log(`     Router 输入: ${JSON.stringify(routerTool.input)}`);
        }
      }
      
      // Token使用量对比
      console.log('\n📊 Token使用量:');
      console.log(`   Demo2 - 输入: ${demo2Response.data.usage?.input_tokens || 'N/A'}, 输出: ${demo2Response.data.usage?.output_tokens || 'N/A'}`);
      console.log(`   Router - 输入: ${routerResponse.data.usage?.input_tokens || 'N/A'}, 输出: ${routerResponse.data.usage?.output_tokens || 'N/A'}`);
      
    } else {
      console.log('   ⚠️  无法对比 - Demo2服务不可用');
      console.log(`   Router 工具调用: ${routerResponse.data.content?.some(item => item.type === 'tool_use') ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误详情:`, error.response.data);
    }
  }
}

testToolParsing().catch(console.error);