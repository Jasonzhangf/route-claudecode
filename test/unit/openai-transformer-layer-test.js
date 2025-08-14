#!/usr/bin/env node

/**
 * OpenAI Transformer层单元测试
 * 测试OpenAI格式转换器的功能
 * 六层架构单元测试 - Transformer层
 */

const { OpenAITransformer } = require('../../dist/transformers/openai');
const { setDefaultPort } = require('../../dist/logging/logger-manager');

console.log('🧪 OpenAI Transformer层单元测试');
console.log('=' + '='.repeat(60));

/**
 * 测试数据集 - Anthropic格式输入
 */
const anthropicTestCases = {
  // 基础消息转换
  basicMessage: {
    name: '基础消息转换',
    input: {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hello, how are you?'
            }
          ]
        }
      ]
    },
    expected: {
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: 'Hello, how are you?'
        }
      ]
    }
  },

  // 工具定义转换
  toolDefinition: {
    name: '工具定义转换',
    input: {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Use the calculator tool' }]
        }
      ],
      tools: [
        {
          name: 'calculator',
          description: 'Perform mathematical calculations',
          input_schema: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'Mathematical expression to evaluate'
              }
            },
            required: ['expression']
          }
        }
      ]
    },
    expected: {
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: 'Use the calculator tool'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'calculator',
            description: 'Perform mathematical calculations',
            parameters: {
              type: 'object',
              properties: {
                expression: {
                  type: 'string',
                  description: 'Mathematical expression to evaluate'
                }
              },
              required: ['expression']
            }
          }
        }
      ]
    }
  },

  // 系统消息转换
  systemMessage: {
    name: '系统消息转换',
    input: {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system: 'You are a helpful assistant.',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello!' }]
        }
      ]
    },
    expected: {
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: 'Hello!'
        }
      ]
    }
  },

  // 复杂内容块转换
  complexContent: {
    name: '复杂内容块转换',
    input: {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this data:'
            },
            {
              type: 'text',
              text: 'Data: [1, 2, 3, 4, 5]'
            }
          ]
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'I will analyze the data.'
            },
            {
              type: 'tool_use',
              id: 'toolu_123',
              name: 'analyze_data',
              input: {
                data: [1, 2, 3, 4, 5]
              }
            }
          ]
        }
      ]
    },
    expected: {
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: 'Analyze this data:\nData: [1, 2, 3, 4, 5]'
        },
        {
          role: 'assistant',
          content: 'I will analyze the data.',
          tool_calls: [
            {
              id: 'toolu_123',
              type: 'function',
              function: {
                name: 'analyze_data',
                arguments: '{"data":[1,2,3,4,5]}'
              }
            }
          ]
        }
      ]
    }
  }
};

/**
 * 测试数据集 - OpenAI格式响应转换回Anthropic
 */
const openaiResponseTestCases = {
  // 基础响应转换
  basicResponse: {
    name: '基础响应转换',
    input: {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello! I am doing well, thank you for asking.'
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 9,
        completion_tokens: 12,
        total_tokens: 21
      }
    },
    expected: {
      id: 'chatcmpl-123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello! I am doing well, thank you for asking.'
        }
      ],
      model: 'gpt-4o-mini',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 9,
        output_tokens: 12
      }
    }
  },

  // 工具调用响应转换
  toolCallResponse: {
    name: '工具调用响应转换',
    input: {
      id: 'chatcmpl-456',
      object: 'chat.completion',
      created: 1677652288,
      model: 'gpt-4o-mini',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'calculator',
                  arguments: '{"expression": "2 + 2"}'
                }
              }
            ]
          },
          finish_reason: 'tool_calls'
        }
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 8,
        total_tokens: 23
      }
    },
    expected: {
      id: 'chatcmpl-456',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'call_123',
          name: 'calculator',
          input: {
            expression: '2 + 2'
          }
        }
      ],
      model: 'gpt-4o-mini',
      stop_reason: 'tool_use',
      usage: {
        input_tokens: 15,
        output_tokens: 8
      }
    }
  }
};

/**
 * 测试Anthropic到OpenAI的请求转换
 */
async function testAnthropicToOpenAITransformation(testCase) {
  console.log(`\n🔄 测试: ${testCase.name}`);
  
  try {
    setDefaultPort(3456);
    const transformer = new OpenAITransformer();
    
    console.log('📥 输入 (Anthropic格式):');
    console.log(`   模型: ${testCase.input.model}`);
    console.log(`   消息数: ${testCase.input.messages?.length || 0}`);
    console.log(`   工具数: ${testCase.input.tools?.length || 0}`);
    console.log(`   系统消息: ${!!testCase.input.system}`);
    
    // 执行转换
    const result = transformer.transformAnthropicToOpenAI(testCase.input);
    
    console.log('📤 输出 (OpenAI格式):');
    console.log(`   模型: ${result.model}`);
    console.log(`   消息数: ${result.messages?.length || 0}`);
    console.log(`   工具数: ${result.tools?.length || 0}`);
    
    // 验证转换结果
    const validations = [];
    
    // 验证模型转换
    if (result.model) {
      validations.push({
        check: '模型映射',
        passed: typeof result.model === 'string',
        expected: 'string',
        actual: typeof result.model
      });
    }
    
    // 验证消息转换
    if (result.messages) {
      validations.push({
        check: '消息格式',
        passed: Array.isArray(result.messages) && result.messages.every(msg => 
          msg.role && (typeof msg.content === 'string' || msg.tool_calls)
        ),
        expected: 'OpenAI消息格式',
        actual: 'valid'
      });
    }
    
    // 验证工具转换
    if (testCase.input.tools && result.tools) {
      validations.push({
        check: '工具格式转换',
        passed: result.tools.every(tool => 
          tool.type === 'function' && 
          tool.function && 
          tool.function.name && 
          tool.function.parameters
        ),
        expected: 'OpenAI工具格式',
        actual: 'valid'
      });
    }
    
    // 验证系统消息处理
    if (testCase.input.system) {
      const systemMessage = result.messages.find(msg => msg.role === 'system');
      validations.push({
        check: '系统消息转换',
        passed: !!systemMessage && systemMessage.content === testCase.input.system,
        expected: testCase.input.system,
        actual: systemMessage?.content || 'missing'
      });
    }
    
    // 打印验证结果
    console.log('✅ 验证结果:');
    let allPassed = true;
    validations.forEach(validation => {
      const status = validation.passed ? '✅' : '❌';
      console.log(`   ${status} ${validation.check}: ${validation.passed ? 'PASS' : 'FAIL'}`);
      if (!validation.passed) {
        console.log(`      期望: ${validation.expected}`);
        console.log(`      实际: ${validation.actual}`);
        allPassed = false;
      }
    });
    
    return { success: allPassed, result, validations };
    
  } catch (error) {
    console.log(`❌ 转换失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 测试OpenAI到Anthropic的响应转换
 */
async function testOpenAIToAnthropicTransformation(testCase) {
  console.log(`\n🔄 测试: ${testCase.name}`);
  
  try {
    const transformer = new OpenAITransformer();
    
    console.log('📥 输入 (OpenAI响应格式):');
    console.log(`   响应ID: ${testCase.input.id}`);
    console.log(`   模型: ${testCase.input.model}`);
    console.log(`   选择数: ${testCase.input.choices?.length || 0}`);
    console.log(`   内容类型: ${testCase.input.choices?.[0]?.message?.content ? '文本' : '工具调用'}`);
    
    // 执行转换
    const result = transformer.transformOpenAIToAnthropic(
      testCase.input, 
      testCase.input.model,
      'test-request-id'
    );
    
    console.log('📤 输出 (Anthropic格式):');
    console.log(`   类型: ${result.type}`);
    console.log(`   角色: ${result.role}`);
    console.log(`   内容块数: ${result.content?.length || 0}`);
    console.log(`   停止原因: ${result.stop_reason}`);
    
    // 验证转换结果
    const validations = [];
    
    // 验证基础结构
    validations.push({
      check: 'Anthropic格式结构',
      passed: result.type === 'message' && result.role === 'assistant' && Array.isArray(result.content),
      expected: 'type=message, role=assistant, content=array',
      actual: `type=${result.type}, role=${result.role}, content=${Array.isArray(result.content) ? 'array' : typeof result.content}`
    });
    
    // 验证内容转换
    if (testCase.input.choices?.[0]?.message?.content) {
      const textContent = result.content?.find(block => block.type === 'text');
      validations.push({
        check: '文本内容转换',
        passed: textContent && textContent.text === testCase.input.choices[0].message.content,
        expected: testCase.input.choices[0].message.content,
        actual: textContent?.text || 'missing'
      });
    }
    
    // 验证工具调用转换
    if (testCase.input.choices?.[0]?.message?.tool_calls) {
      const toolUseBlocks = result.content?.filter(block => block.type === 'tool_use') || [];
      validations.push({
        check: '工具调用转换',
        passed: toolUseBlocks.length === testCase.input.choices[0].message.tool_calls.length,
        expected: testCase.input.choices[0].message.tool_calls.length,
        actual: toolUseBlocks.length
      });
    }
    
    // 验证停止原因转换
    const expectedStopReason = testCase.input.choices?.[0]?.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn';
    validations.push({
      check: '停止原因转换',
      passed: result.stop_reason === expectedStopReason,
      expected: expectedStopReason,
      actual: result.stop_reason
    });
    
    // 验证使用统计转换
    if (testCase.input.usage) {
      validations.push({
        check: '使用统计转换',
        passed: result.usage?.input_tokens === testCase.input.usage.prompt_tokens &&
                result.usage?.output_tokens === testCase.input.usage.completion_tokens,
        expected: `input=${testCase.input.usage.prompt_tokens}, output=${testCase.input.usage.completion_tokens}`,
        actual: `input=${result.usage?.input_tokens}, output=${result.usage?.output_tokens}`
      });
    }
    
    // 打印验证结果
    console.log('✅ 验证结果:');
    let allPassed = true;
    validations.forEach(validation => {
      const status = validation.passed ? '✅' : '❌';
      console.log(`   ${status} ${validation.check}: ${validation.passed ? 'PASS' : 'FAIL'}`);
      if (!validation.passed) {
        console.log(`      期望: ${validation.expected}`);
        console.log(`      实际: ${validation.actual}`);
        allPassed = false;
      }
    });
    
    return { success: allPassed, result, validations };
    
  } catch (error) {
    console.log(`❌ 转换失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 运行完整的Transformer层测试套件
 */
async function runTransformerLayerTests() {
  console.log('\n🚀 开始OpenAI Transformer层完整测试套件...\n');
  
  const testResults = {
    anthropicToOpenAI: {},
    openaiToAnthropic: {}
  };
  
  // 测试Anthropic到OpenAI转换
  console.log('\n' + '='.repeat(70));
  console.log('📥 Anthropic → OpenAI 请求转换测试');
  console.log('='.repeat(70));
  
  for (const [testKey, testCase] of Object.entries(anthropicTestCases)) {
    const result = await testAnthropicToOpenAITransformation(testCase);
    testResults.anthropicToOpenAI[testKey] = result;
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 测试OpenAI到Anthropic转换
  console.log('\n' + '='.repeat(70));
  console.log('📤 OpenAI → Anthropic 响应转换测试');
  console.log('='.repeat(70));
  
  for (const [testKey, testCase] of Object.entries(openaiResponseTestCases)) {
    const result = await testOpenAIToAnthropicTransformation(testCase);
    testResults.openaiToAnthropic[testKey] = result;
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return testResults;
}

/**
 * 生成测试报告
 */
function generateTestReport(testResults) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 OpenAI Transformer层测试报告');
  console.log('='.repeat(70));
  
  const summary = {
    total: 0,
    passed: 0,
    failed: 0,
    categories: {
      anthropicToOpenAI: { total: 0, passed: 0, failed: 0 },
      openaiToAnthropic: { total: 0, passed: 0, failed: 0 }
    }
  };
  
  // 统计结果
  for (const [category, tests] of Object.entries(testResults)) {
    for (const [testKey, result] of Object.entries(tests)) {
      summary.total++;
      summary.categories[category].total++;
      
      if (result.success) {
        summary.passed++;
        summary.categories[category].passed++;
      } else {
        summary.failed++;
        summary.categories[category].failed++;
      }
    }
  }
  
  // 打印详细结果
  console.log('\n🔍 详细测试结果:');
  
  console.log('\n📥 Anthropic → OpenAI 转换:');
  for (const [testKey, result] of Object.entries(testResults.anthropicToOpenAI)) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${status} ${anthropicTestCases[testKey].name}`);
  }
  
  console.log('\n📤 OpenAI → Anthropic 转换:');
  for (const [testKey, result] of Object.entries(testResults.openaiToAnthropic)) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${status} ${openaiResponseTestCases[testKey].name}`);
  }
  
  // 打印统计摘要
  console.log('\n📈 统计摘要:');
  console.log(`   总测试数: ${summary.total}`);
  console.log(`   通过数: ${summary.passed}`);
  console.log(`   失败数: ${summary.failed}`);
  console.log(`   通过率: ${((summary.passed / summary.total) * 100).toFixed(1)}%`);
  
  console.log('\n📊 分类统计:');
  for (const [category, stats] of Object.entries(summary.categories)) {
    const categoryName = category === 'anthropicToOpenAI' ? 'Anthropic→OpenAI' : 'OpenAI→Anthropic';
    console.log(`   ${categoryName}: ${stats.passed}/${stats.total} (${((stats.passed / stats.total) * 100).toFixed(1)}%)`);
  }
  
  const allPassed = summary.failed === 0;
  console.log(`\n🏁 测试结果: ${allPassed ? '✅ 全部通过' : '❌ 存在失败'}`);
  
  if (allPassed) {
    console.log('🎉 OpenAI Transformer层测试完成，格式转换功能正常！');
  } else {
    console.log('⚠️  部分转换测试失败，需要检查转换逻辑');
  }
  
  return summary;
}

/**
 * 主测试函数
 */
async function main() {
  try {
    console.log('🎯 目标: 验证OpenAI Transformer的双向格式转换功能');
    console.log('📋 测试内容: Anthropic→OpenAI请求转换、OpenAI→Anthropic响应转换');
    console.log('🏗️  架构层级: Transformer层 (六层架构的第四层)');
    
    const testResults = await runTransformerLayerTests();
    const summary = generateTestReport(testResults);
    
    // 保存测试结果
    const reportPath = `test/reports/openai-transformer-layer-test-${Date.now()}.json`;
    console.log(`\n💾 测试结果已保存到: ${reportPath}`);
    
    process.exit(summary.failed === 0 ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Transformer层测试执行失败:', error);
    process.exit(1);
  }
}

// 直接执行测试
if (require.main === module) {
  main();
}

module.exports = {
  runTransformerLayerTests,
  testAnthropicToOpenAITransformation,
  testOpenAIToAnthropicTransformation
};