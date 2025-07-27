#!/usr/bin/env node

/**
 * 综合工具测试 - 验证工具调用在各种场景下的工作情况
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');

// 测试场景配置
const TEST_SCENARIOS = [
  {
    name: "单个工具调用 - Read",
    request: {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 131072, // 128K
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
    name: "多个工具可选 - Read + Write",
    request: {
      model: "claude-3-5-haiku-20241022", 
      max_tokens: 131072, // 128K
      messages: [
        {
          role: "user",
          content: "请帮我列出当前目录的文件"
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
        },
        {
          name: "LS",
          description: "列出目录内容",
          input_schema: {
            type: "object", 
            properties: {
              path: {
                type: "string",
                description: "目录路径"
              }
            },
            required: ["path"]
          }
        }
      ]
    }
  },
  {
    name: "多轮对话工具调用",
    isMultiTurn: true,
    turns: [
      {
        role: "user",
        content: "请帮我读取文件 /tmp/test.txt"
      },
      {
        role: "assistant", 
        content: [
          {
            type: "tool_use",
            id: "test_tool_call_1",
            name: "Read",
            input: { file_path: "/tmp/test.txt" }
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "test_tool_call_1",
            content: "这是测试文件内容"
          },
          {
            type: "text",
            text: "现在请总结一下这个文件"
          }
        ]
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
];

async function runTest(scenario) {
  console.log(`\n🔍 测试场景: ${scenario.name}`);
  console.log('=' .repeat(50));
  
  try {
    let request;
    
    if (scenario.isMultiTurn) {
      // 多轮对话测试
      request = {
        model: scenario.turns[0].model || "claude-3-5-haiku-20241022",
        max_tokens: 131072,
        messages: scenario.turns,
        tools: scenario.tools
      };
    } else {
      // 单轮测试
      request = scenario.request;
    }
    
    console.log('📤 发送请求...');
    console.log(`   模型: ${request.model}`);
    console.log(`   Max Tokens: ${request.max_tokens}`);
    console.log(`   工具数量: ${request.tools ? request.tools.length : 0}`);
    console.log(`   消息数量: ${request.messages.length}`);
    
    const startTime = Date.now();
    const response = await axios.post('http://127.0.0.1:3456/v1/messages', request, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      },
      timeout: 30000
    });
    const endTime = Date.now();
    
    console.log(`✅ 响应成功 (耗时: ${endTime - startTime}ms)`);
    console.log(`   状态码: ${response.status}`);
    console.log(`   停止原因: ${response.data.stop_reason}`);
    console.log(`   输入Token: ${response.data.usage?.input_tokens || 'N/A'}`);
    console.log(`   输出Token: ${response.data.usage?.output_tokens || 'N/A'}`);
    
    // 分析内容
    if (response.data.content) {
      console.log('\n📋 内容分析:');
      response.data.content.forEach((item, index) => {
        console.log(`   [${index}] 类型: ${item.type}`);
        if (item.type === 'text') {
          const preview = item.text.length > 100 ? 
            item.text.substring(0, 100) + '...' : 
            item.text;
          console.log(`       文本: "${preview}"`);
        } else if (item.type === 'tool_use') {
          console.log(`       工具: ${item.name}`);
          console.log(`       ID: ${item.id}`);
          console.log(`       输入: ${JSON.stringify(item.input, null, 2)}`);
        }
      });
    }
    
    // 验证结果
    const hasToolUse = response.data.content?.some(item => item.type === 'tool_use');
    const hasValidToolStructure = response.data.content?.every(item => {
      if (item.type === 'tool_use') {
        return item.id && item.name && item.input;
      }
      return true;
    });
    
    console.log('\n🎯 验证结果:');
    console.log(`   包含工具调用: ${hasToolUse ? '✅' : '❌'}`);
    console.log(`   工具结构完整: ${hasValidToolStructure ? '✅' : '❌'}`);
    console.log(`   响应格式正确: ${response.data.type === 'message' ? '✅' : '❌'}`);
    console.log(`   Token配置正确: ${request.max_tokens === 131072 ? '✅' : '❌'}`);
    
    return {
      success: true,
      scenario: scenario.name,
      hasToolUse,
      hasValidToolStructure,
      responseTime: endTime - startTime,
      tokenUsage: response.data.usage
    };
    
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误详情:`, error.response.data);
    }
    
    return {
      success: false,
      scenario: scenario.name,
      error: error.message
    };
  }
}

async function runAllTests() {
  console.log('🚀 开始综合工具测试');
  console.log(`📊 测试场景数量: ${TEST_SCENARIOS.length}`);
  
  const results = [];
  
  for (const scenario of TEST_SCENARIOS) {
    const result = await runTest(scenario);
    results.push(result);
    
    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 生成测试报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结报告');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.success).length;
  const toolUseCount = results.filter(r => r.hasToolUse).length;
  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  
  console.log(`✅ 成功测试: ${successCount}/${results.length}`);
  console.log(`🔧 工具调用测试: ${toolUseCount}/${results.length}`);
  console.log(`⏱️  平均响应时间: ${Math.round(avgResponseTime)}ms`);
  
  console.log('\n📋 详细结果:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const toolStatus = result.hasToolUse ? '🔧' : '📝';
    console.log(`   ${index + 1}. ${status} ${toolStatus} ${result.scenario}`);
    if (!result.success) {
      console.log(`      错误: ${result.error}`);
    }
  });
  
  // 检查问题
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log('\n⚠️  发现问题:');
    failedTests.forEach(test => {
      console.log(`   - ${test.scenario}: ${test.error}`);
    });
  }
  
  // 总体状态
  if (successCount === results.length && toolUseCount >= 2) {
    console.log('\n🎉 所有测试通过！工具调用功能正常！');
    return true;
  } else {
    console.log('\n⚠️  测试发现问题，需要进一步调试');
    return false;
  }
}

// 运行测试
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});