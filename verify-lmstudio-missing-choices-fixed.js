#!/usr/bin/env node

/**
 * 验证LMStudio missing choices问题是否已经解决
 * 进行多种测试场景验证
 */

const axios = require('axios');

async function verifyMissingChoicesFixed() {
  console.log('🔍 验证LMStudio missing choices问题是否已经解决...\n');
  
  const testCases = [
    {
      name: '基础请求（无工具）',
      data: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Hello world' }]
      }
    },
    {
      name: '工具调用请求（单工具）',
      data: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Create a file named test.txt' }],
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
      name: '多工具请求（模拟Claude Code的15个工具）',
      data: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Help me with file operations' }],
        tools: [
          'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob', 'LS', 
          'Task', 'TodoWrite', 'WebSearch', 'WebFetch', 'NotebookRead', 
          'NotebookEdit', 'ExitPlanMode'
        ].map(name => ({
          type: 'function',
          function: {
            name: name.toLowerCase(),
            description: `${name} tool`,
            parameters: {
              type: 'object',
              properties: { param: { type: 'string' } },
              required: ['param']
            }
          }
        }))
      }
    }
  ];
  
  let successCount = 0;
  let errorCount = 0;
  let choicesErrorCount = 0;
  
  console.log('📡 启动服务进行测试...');
  
  // 启动服务
  const { spawn } = require('child_process');
  const serverProcess = spawn('rcc', [
    'start', 
    '--config', 
    '/Users/fanzhang/.route-claude-code/config/single-provider/config-openai-lmstudio-5506.json',
    '--debug'
  ], {
    detached: true,
    stdio: 'pipe'
  });
  
  // 等待服务启动
  await new Promise(resolve => setTimeout(resolve, 4000));
  console.log('✅ 服务启动完成\n');
  
  try {
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`=== TEST ${i + 1}: ${testCase.name} ===`);
      
      try {
        const response = await axios.post('http://localhost:5506/v1/messages', testCase.data, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-key'
          },
          timeout: 15000
        });
        
        console.log(`✅ 成功 - 状态: ${response.status}`);
        console.log(`📦 响应长度: ${JSON.stringify(response.data).length} 字符`);
        console.log(`🎯 stop_reason: ${response.data.stop_reason}`);
        
        if (response.data.content && response.data.content.length > 0) {
          console.log(`📝 内容类型: ${response.data.content[0].type}`);
        }
        
        successCount++;
        
      } catch (error) {
        errorCount++;
        console.log(`❌ 失败 - 状态: ${error.response?.status || 'NETWORK'}`);
        console.log(`🚨 错误: ${error.response?.data?.error?.message || error.message}`);
        
        if (error.response?.data?.error?.message?.includes('missing choices')) {
          choicesErrorCount++;
          console.log('🎯 发现missing choices错误！');
        }
      }
      
      console.log(''); // 空行
      
      // 每个测试间稍作等待
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 压力测试：快速连续请求
    console.log('=== 压力测试：快速连续请求 ===');
    const rapidTests = 5;
    let rapidSuccess = 0;
    let rapidErrors = 0;
    let rapidChoicesErrors = 0;
    
    const promises = Array(rapidTests).fill(0).map(async (_, index) => {
      try {
        const response = await axios.post('http://localhost:5506/v1/messages', {
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 30,
          messages: [{ role: 'user', content: `Quick test ${index}` }]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-key'
          },
          timeout: 10000
        });
        
        rapidSuccess++;
        return { success: true, status: response.status };
        
      } catch (error) {
        rapidErrors++;
        const isMissingChoices = error.response?.data?.error?.message?.includes('missing choices');
        if (isMissingChoices) rapidChoicesErrors++;
        
        return {
          success: false,
          status: error.response?.status || 'NETWORK',
          error: error.response?.data?.error?.message || error.message,
          isMissingChoices
        };
      }
    });
    
    const rapidResults = await Promise.all(promises);
    
    rapidResults.forEach((result, index) => {
      if (result.success) {
        process.stdout.write('✅');
      } else if (result.isMissingChoices) {
        process.stdout.write('🎯');
      } else {
        process.stdout.write('❌');
      }
    });
    
    console.log(`\n📊 压力测试结果: ${rapidSuccess}/${rapidTests} 成功, ${rapidErrors}/${rapidTests} 失败, ${rapidChoicesErrors}/${rapidTests} missing choices`);
    
  } finally {
    // 清理服务
    console.log('\n🧹 清理服务...');
    serverProcess.kill('SIGTERM');
    
    // 等待一下确保服务关闭
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n=== 总结结果 ===');
  console.log(`📊 基础测试: ${successCount}/${testCases.length} 成功, ${errorCount}/${testCases.length} 失败`);
  console.log(`🎯 Missing choices错误: ${choicesErrorCount + rapidChoicesErrors} 次`);
  
  if (choicesErrorCount + rapidChoicesErrors === 0) {
    console.log('✅ 恭喜！Missing choices问题已经完全解决！');
    return true;
  } else {
    console.log('❌ Missing choices问题仍然存在，需要进一步调试');
    return false;
  }
}

// 运行验证
verifyMissingChoicesFixed().then((fixed) => {
  console.log(`\n🏁 验证完成，问题${fixed ? '已解决' : '未解决'}`);
  process.exit(fixed ? 0 : 1);
}).catch(error => {
  console.log('\n❌ 验证过程出错:', error.message);
  process.exit(1);
});