#!/usr/bin/env node

/**
 * 尝试重现missing choices错误的精确条件
 * 基于日志分析，错误似乎发生在特定情况下
 */

const axios = require('axios');

async function reproduceExactErrorConditions() {
  console.log('🎯 尝试重现missing choices错误的精确条件...\n');
  
  const testCases = [
    {
      name: '基础请求 - 无工具',
      data: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello world' }]
      }
    },
    {
      name: '带工具请求 - 单个工具',
      data: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Create a file test.txt' }],
        tools: [{
          type: 'function',
          function: {
            name: 'create_file',
            description: 'Create a file',
            parameters: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                content: { type: 'string' }
              },
              required: ['filename', 'content']
            }
          }
        }]
      }
    },
    {
      name: '多工具请求 - 15个工具（像日志中的）',
      data: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Help me with file operations' }],
        tools: Array(15).fill(0).map((_, i) => ({
          type: 'function',
          function: {
            name: `tool_${i}`,
            description: `Tool ${i} description`,
            parameters: {
              type: 'object',
              properties: {
                param: { type: 'string' }
              },
              required: ['param']
            }
          }
        }))
      }
    },
    {
      name: '快速连续请求 - 模拟竞态条件',
      data: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Quick response' }]
      },
      concurrent: true
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n=== TEST ${i + 1}: ${testCase.name} ===`);
    
    if (testCase.concurrent) {
      // 并发请求测试
      console.log('🔄 发送5个并发请求...');
      const promises = Array(5).fill(0).map(async (_, index) => {
        try {
          const response = await axios.post('http://localhost:5506/v1/messages', testCase.data, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'test-key'
            },
            timeout: 10000
          });
          return { index, status: response.status, success: true };
        } catch (error) {
          return {
            index,
            status: error.response?.status || 'ERROR',
            success: false,
            error: error.response?.data?.error?.message || error.message
          };
        }
      });
      
      const results = await Promise.all(promises);
      console.log('📊 并发请求结果:');
      results.forEach(result => {
        if (result.success) {
          console.log(`  ✅ 请求${result.index}: 状态${result.status}`);
        } else {
          console.log(`  ❌ 请求${result.index}: 状态${result.status}, 错误: ${result.error}`);
          if (result.error && result.error.includes('missing choices')) {
            console.log('    🎯 发现missing choices错误！');
          }
        }
      });
      
      const errorCount = results.filter(r => !r.success).length;
      const choicesErrorCount = results.filter(r => !r.success && r.error?.includes('missing choices')).length;
      console.log(`📈 错误统计: ${errorCount}/5 失败, ${choicesErrorCount}/5 missing choices错误`);
      
    } else {
      // 单个请求测试
      try {
        const startTime = Date.now();
        const response = await axios.post('http://localhost:5506/v1/messages', testCase.data, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-key'
          },
          timeout: 30000
        });
        
        const duration = Date.now() - startTime;
        console.log(`✅ 成功 - 状态: ${response.status}, 耗时: ${duration}ms`);
        
        // 检查响应结构
        if (response.data.content) {
          console.log(`📦 响应内容长度: ${JSON.stringify(response.data.content).length}`);
        }
        if (response.data.usage) {
          console.log(`🔢 Token使用: input=${response.data.usage.input_tokens}, output=${response.data.usage.output_tokens}`);
        }
        
      } catch (error) {
        const duration = Date.now() - startTime;
        console.log(`❌ 失败 - 状态: ${error.response?.status || 'NETWORK'}, 耗时: ${duration}ms`);
        console.log(`🚨 错误: ${error.response?.data?.error?.message || error.message}`);
        
        if (error.response?.data?.error?.message?.includes('missing choices')) {
          console.log('🎯 发现missing choices错误！');
          console.log('📝 完整错误数据:');
          console.log(JSON.stringify(error.response.data, null, 2));
        }
      }
    }
    
    // 每次测试间隔
    if (i < testCases.length - 1) {
      console.log('⏳ 等待2秒...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n=== 压力测试：快速连续单个请求 ===');
  let successCount = 0;
  let errorCount = 0;
  let choicesErrorCount = 0;
  
  for (let i = 0; i < 10; i++) {
    try {
      const response = await axios.post('http://localhost:5506/v1/messages', {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 50,
        messages: [{ role: 'user', content: `Test ${i}` }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key'
        },
        timeout: 5000
      });
      
      successCount++;
      process.stdout.write('✅');
      
    } catch (error) {
      errorCount++;
      if (error.response?.data?.error?.message?.includes('missing choices')) {
        choicesErrorCount++;
        process.stdout.write('🎯');
      } else {
        process.stdout.write('❌');
      }
    }
    
    // 快速发送，间隔很短
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 压力测试结果: ${successCount}/10 成功, ${errorCount}/10 失败, ${choicesErrorCount}/10 missing choices`);
  
  console.log('\n🎯 结论:');
  if (choicesErrorCount > 0) {
    console.log('✅ 成功重现了missing choices错误！');
    console.log('📍 错误发生条件可能包括:');
    console.log('  - 高并发请求');
    console.log('  - 快速连续请求');
    console.log('  - 特定的工具配置');
    console.log('  - OpenAI SDK内部状态竞争');
  } else {
    console.log('❌ 未能重现missing choices错误');
    console.log('📍 可能的原因:');
    console.log('  - 错误是间歇性的');
    console.log('  - 需要特定的时序条件');
    console.log('  - 与外部LMStudio服务状态相关');
  }
}

// 运行测试
reproduceExactErrorConditions().then(() => {
  console.log('\n🏁 条件重现测试完成');
}).catch(console.error);