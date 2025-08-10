#!/usr/bin/env node

/**
 * 测试LMStudio增强工具解析功能
 * 使用真实样本数据验证工具调用解析是否正常工作
 */

const axios = require('axios');
const { spawn } = require('child_process');

async function testEnhancedToolParsing() {
  console.log('🎯 测试LMStudio增强工具解析功能...\n');
  
  // 启动服务
  console.log('📡 启动服务...');
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
  
  const testCases = [
    {
      name: '创建文件工具调用',
      request: {
        model: 'gpt-oss-20b-mlx',
        max_tokens: 200,
        stream: false,
        messages: [{ role: 'user', content: 'Create a file named test.txt with content "Hello World"' }],
        tools: [{
          type: 'function',
          function: {
            name: 'create_file',
            description: 'Create a file with specified content',
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
      },
      expectedToolCall: {
        name: 'create_file',
        parameters: {
          filename: 'test.txt',
          content: 'Hello World'
        }
      }
    },
    {
      name: '读取文件工具调用',
      request: {
        model: 'gpt-oss-20b-mlx',
        max_tokens: 150,
        stream: false,
        messages: [{ role: 'user', content: 'Read the contents of config.json file' }],
        tools: [{
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Read the contents of a file',
            parameters: {
              type: 'object',
              properties: {
                filename: { type: 'string' }
              },
              required: ['filename']
            }
          }
        }]
      },
      expectedToolCall: {
        name: 'read_file',
        parameters: {
          filename: 'config.json'
        }
      }
    },
    {
      name: 'Bash命令工具调用',
      request: {
        model: 'gpt-oss-20b-mlx',
        max_tokens: 150,
        stream: false,
        messages: [{ role: 'user', content: 'List all files in the current directory' }],
        tools: [{
          type: 'function',
          function: {
            name: 'bash',
            description: 'Execute a bash command',
            parameters: {
              type: 'object',
              properties: {
                command: { type: 'string' }
              },
              required: ['command']
            }
          }
        }]
      },
      expectedToolCall: {
        name: 'bash',
        parameters: {
          command: 'ls -la'
        }
      }
    }
  ];
  
  let totalTests = 0;
  let successfulParses = 0;
  let correctToolNames = 0;
  let correctParameters = 0;
  
  try {
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      console.log(`=== TEST ${i + 1}: ${testCase.name} ===`);
      totalTests++;
      
      try {
        const response = await axios.post('http://localhost:5506/v1/messages', testCase.request, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-key'
          },
          timeout: 15000
        });
        
        console.log('✅ 请求成功, 状态:', response.status);
        
        // 分析响应内容
        const content = response.data.content || [];
        const hasToolUse = content.some(item => item.type === 'tool_use');
        
        console.log('📦 响应分析:');
        console.log('  - 内容块数量:', content.length);
        console.log('  - 包含工具调用:', hasToolUse);
        
        if (hasToolUse) {
          successfulParses++;
          
          const toolUseBlocks = content.filter(item => item.type === 'tool_use');
          console.log('  - 工具调用数量:', toolUseBlocks.length);
          
          toolUseBlocks.forEach((toolUse, index) => {
            console.log(`  - 工具${index + 1}:`, {
              name: toolUse.name,
              input: toolUse.input
            });
            
            // 验证工具名是否正确
            if (toolUse.name === testCase.expectedToolCall.name) {
              correctToolNames++;
              console.log('    ✅ 工具名正确');
              
              // 验证参数是否正确
              const expectedParams = testCase.expectedToolCall.parameters;
              const actualParams = toolUse.input;
              
              let paramsMatch = true;
              for (const [key, expectedValue] of Object.entries(expectedParams)) {
                if (actualParams[key] !== expectedValue) {
                  console.log(`    ❌ 参数不匹配: ${key}`, {
                    expected: expectedValue,
                    actual: actualParams[key]
                  });
                  paramsMatch = false;
                } else {
                  console.log(`    ✅ 参数正确: ${key} = ${expectedValue}`);
                }
              }
              
              if (paramsMatch) {
                correctParameters++;
              }
            } else {
              console.log('    ❌ 工具名不正确:', {
                expected: testCase.expectedToolCall.name,
                actual: toolUse.name
              });
            }
          });
          
        } else {
          console.log('  - ❌ 未检测到工具调用');
          
          // 显示文本内容以进行分析
          const textBlocks = content.filter(item => item.type === 'text');
          if (textBlocks.length > 0) {
            console.log('  - 文本内容预览:', textBlocks[0].text.substring(0, 200) + '...');
          }
        }
        
      } catch (error) {
        console.log('❌ 请求失败:', error.response?.status || error.message);
        console.log('🚨 错误详情:', error.response?.data?.error?.message || 'Network error');
      }
      
      console.log(''); // 空行分隔
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } finally {
    // 清理服务
    console.log('🧹 清理服务...');
    serverProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('=== 测试结果总结 ===');
  console.log(`📊 总测试数: ${totalTests}`);
  console.log(`✅ 成功解析工具调用: ${successfulParses}/${totalTests} (${Math.round(successfulParses/totalTests*100)}%)`);
  console.log(`🎯 工具名正确: ${correctToolNames}/${totalTests} (${Math.round(correctToolNames/totalTests*100)}%)`);
  console.log(`📋 参数正确: ${correctParameters}/${totalTests} (${Math.round(correctParameters/totalTests*100)}%)`);
  
  if (successfulParses === totalTests && correctToolNames === totalTests && correctParameters === totalTests) {
    console.log('🎉 恭喜！LMStudio工具解析功能完全正常！');
    return true;
  } else {
    console.log('❌ 工具解析功能仍需改进');
    return false;
  }
}

// 运行测试
testEnhancedToolParsing().then((success) => {
  console.log(`\n🏁 测试完成，结果: ${success ? '成功' : '失败'}`);
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.log('\n❌ 测试过程出错:', error.message);
  process.exit(1);
});