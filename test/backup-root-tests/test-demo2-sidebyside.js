#!/usr/bin/env node

/**
 * Demo2 Side-by-Side 对比测试
 * 同时测试我们的实现和demo2，逐级对比结果
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testBothImplementations() {
  console.log('🔍 Demo2 Side-by-Side 对比测试\n');

  const testCases = [
    {
      name: '简单文本请求',
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: "Hello! Please give me a brief greeting."
          }
        ]
      }
    },
    {
      name: '工具调用请求',
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: "请帮我创建一个todo项目：学习TypeScript"
          }
        ],
        tools: [
          {
            name: "TodoWrite",
            description: "创建和管理todo项目列表",
            input_schema: {
              type: "object",
              properties: {
                todos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      content: {
                        type: "string",
                        description: "todo内容"
                      },
                      status: {
                        type: "string",
                        enum: ["pending", "in_progress", "completed"],
                        description: "todo状态"
                      },
                      priority: {
                        type: "string",
                        enum: ["high", "medium", "low"],
                        description: "优先级"
                      },
                      id: {
                        type: "string",
                        description: "唯一标识符"
                      }
                    },
                    required: ["content", "status", "priority", "id"]
                  }
                }
              },
              required: ["todos"]
            }
          }
        ]
      }
    }
  ];

  // 测试我们的实现和demo2
  const implementations = [
    {
      name: "我们的实现 (TypeScript移植)",
      url: "http://127.0.0.1:3456/v1/messages",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      }
    },
    {
      name: "Demo2原始实现 (Go)",
      url: "http://127.0.0.1:8080/v1/messages", 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`🧪 测试用例: ${testCase.name}`);
    console.log(`${'='.repeat(100)}`);

    const results = {};

    for (const impl of implementations) {
      console.log(`\n📤 测试 ${impl.name}`);
      console.log(`   端点: ${impl.url}`);
      
      try {
        const startTime = Date.now();
        
        const response = await axios.post(
          impl.url,
          testCase.request,
          {
            headers: impl.headers,
            timeout: 60000
          }
        );

        const duration = Date.now() - startTime;
        
        console.log(`   ✅ 请求成功 (${duration}ms)`);
        console.log(`   - 状态码: ${response.status}`);
        console.log(`   - 响应模型: ${response.data.model}`);
        console.log(`   - 停止原因: ${response.data.stop_reason}`);
        console.log(`   - 内容块数量: ${response.data.content?.length || 0}`);
        
        if (response.data.usage) {
          console.log(`   - Token使用: 输入=${response.data.usage.input_tokens}, 输出=${response.data.usage.output_tokens}`);
        }

        // 分析内容
        if (response.data.content && response.data.content.length > 0) {
          console.log(`   📋 内容分析:`);
          response.data.content.forEach((block, index) => {
            console.log(`     [${index}] 类型: ${block.type}`);
            
            if (block.type === 'text' && block.text) {
              const preview = block.text.length > 80 ? 
                block.text.substring(0, 80) + '...' : 
                block.text;
              console.log(`         文本: "${preview}"`);
            }
            
            if (block.type === 'tool_use') {
              console.log(`         工具: ${block.name}`);
              console.log(`         ID: ${block.id}`);
              console.log(`         输入: ${JSON.stringify(block.input)}`);
            }
          });
        }

        results[impl.name] = {
          success: true,
          duration: duration,
          response: response.data,
          error: null
        };

      } catch (error) {
        console.log(`   ❌ 请求失败`);
        console.log(`   - 错误: ${error.message}`);
        
        if (error.response) {
          console.log(`   - 状态码: ${error.response.status}`);
          console.log(`   - 错误响应: ${JSON.stringify(error.response.data).substring(0, 200)}`);
        }

        results[impl.name] = {
          success: false,
          duration: null,
          response: null,
          error: error.message
        };
      }
    }

    // 对比分析
    console.log(`\n📊 对比分析:`);
    console.log(`${'='.repeat(50)}`);

    const ourImpl = results["我们的实现 (TypeScript移植)"];
    const demo2Impl = results["Demo2原始实现 (Go)"];

    if (ourImpl.success && demo2Impl.success) {
      console.log(`✅ 两个实现都成功`);
      
      // 对比响应时间
      const timeDiff = Math.abs(ourImpl.duration - demo2Impl.duration);
      const timePercent = ((timeDiff / Math.min(ourImpl.duration, demo2Impl.duration)) * 100).toFixed(1);
      console.log(`⏱️  响应时间对比:`);
      console.log(`   - 我们的实现: ${ourImpl.duration}ms`);
      console.log(`   - Demo2实现: ${demo2Impl.duration}ms`);
      console.log(`   - 差异: ${timeDiff}ms (${timePercent}%)`);
      
      // 对比内容结构
      const ourContent = ourImpl.response.content || [];
      const demo2Content = demo2Impl.response.content || [];
      
      console.log(`📋 内容结构对比:`);
      console.log(`   - 我们的内容块: ${ourContent.length}`);
      console.log(`   - Demo2内容块: ${demo2Content.length}`);
      
      if (ourContent.length === demo2Content.length) {
        console.log(`   ✅ 内容块数量一致`);
        
        // 逐块对比
        for (let i = 0; i < ourContent.length; i++) {
          const ourBlock = ourContent[i];
          const demo2Block = demo2Content[i];
          
          console.log(`   📦 块${i+1}对比:`);
          console.log(`     - 类型匹配: ${ourBlock.type === demo2Block.type ? '✅' : '❌'} (${ourBlock.type} vs ${demo2Block.type})`);
          
          if (ourBlock.type === 'text' && demo2Block.type === 'text') {
            const textMatch = ourBlock.text === demo2Block.text;
            console.log(`     - 文本匹配: ${textMatch ? '✅' : '❌'}`);
            if (!textMatch) {
              console.log(`       我们的: "${ourBlock.text?.substring(0, 50)}..."`);
              console.log(`       Demo2: "${demo2Block.text?.substring(0, 50)}..."`);
            }
          }
          
          if (ourBlock.type === 'tool_use' && demo2Block.type === 'tool_use') {
            const nameMatch = ourBlock.name === demo2Block.name;
            const inputMatch = JSON.stringify(ourBlock.input) === JSON.stringify(demo2Block.input);
            console.log(`     - 工具名匹配: ${nameMatch ? '✅' : '❌'} (${ourBlock.name} vs ${demo2Block.name})`);
            console.log(`     - 输入匹配: ${inputMatch ? '✅' : '❌'}`);
            if (!inputMatch) {
              console.log(`       我们的输入: ${JSON.stringify(ourBlock.input)}`);
              console.log(`       Demo2输入: ${JSON.stringify(demo2Block.input)}`);
            }
          }
        }
      } else {
        console.log(`   ❌ 内容块数量不一致`);
      }
      
      // 对比Token使用
      const ourUsage = ourImpl.response.usage;
      const demo2Usage = demo2Impl.response.usage;
      
      if (ourUsage && demo2Usage) {
        console.log(`🔢 Token使用对比:`);
        console.log(`   - 输入Token: ${ourUsage.input_tokens} vs ${demo2Usage.input_tokens} ${ourUsage.input_tokens === demo2Usage.input_tokens ? '✅' : '❌'}`);
        console.log(`   - 输出Token: ${ourUsage.output_tokens} vs ${demo2Usage.output_tokens} ${ourUsage.output_tokens === demo2Usage.output_tokens ? '✅' : '❌'}`);
      }
      
    } else if (ourImpl.success && !demo2Impl.success) {
      console.log(`⚠️  只有我们的实现成功，Demo2失败`);
      console.log(`   Demo2错误: ${demo2Impl.error}`);
    } else if (!ourImpl.success && demo2Impl.success) {
      console.log(`⚠️  只有Demo2成功，我们的实现失败`);
      console.log(`   我们的错误: ${ourImpl.error}`);
    } else {
      console.log(`❌ 两个实现都失败`);
      console.log(`   我们的错误: ${ourImpl.error}`);
      console.log(`   Demo2错误: ${demo2Impl.error}`);
    }

    // 保存详细对比结果
    const comparisonFile = path.join(__dirname, `comparison-${testCase.name.replace(/\s+/g, '-')}.json`);
    fs.writeFileSync(comparisonFile, JSON.stringify({
      testCase: testCase.name,
      results: results,
      timestamp: new Date().toISOString()
    }, null, 2));
    console.log(`📁 详细对比结果已保存到: ${comparisonFile}`);
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log('🏁 Side-by-Side对比测试完成');
  console.log(`${'='.repeat(100)}`);
  console.log('📋 总结:');
  console.log('   本测试对比了我们的TypeScript移植实现和Demo2原始Go实现');
  console.log('   通过并行测试相同请求，验证两个实现的兼容性和正确性');
  console.log('   详细的对比结果已保存到对应的JSON文件中');
}

// 运行对比测试
testBothImplementations().catch(console.error);