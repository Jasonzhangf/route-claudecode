/**
 * 基于日志中真实数据的工具调用解析测试
 * 测试5508和其他端口的工具解析问题
 */

const { AnthropicToolCallTextFixPatch } = require('./dist/patches/anthropic/tool-call-text-fix');

// 从日志中提取的真实测试数据
const TEST_CASES = {
  // 测试用例1: 正常的工具调用（来自5508端口日志）
  validToolCall: {
    description: '正常的工具调用 - 来自5508端口日志',
    input: {
      content: [
        {
          type: "tool_use",
          id: "extracted_1754407948995_7jndsei1h93",
          name: "Edit",
          input: {
            file_path: "/Users/fanzhang/Documents/github/AIstudioProxyAPI/launch_camoufox.py",
            old_string: "            # 使用Camoufox高级API启动浏览器\n            browser = Camoufox(**camoufox_kwargs)\n            print(f\"--- [内部Camoufox启动] Camoufox 高级API ({internal_mode_arg}模式) 启动成功。 ---\", flush=True)",
            new_string: "            # 使用Camoufox高级API启动浏览器\n            print(f\"--- [内部Camoufox启动] 准备调用 Camoufox 高级API... ---\", flush=True)\n            print(f\"--- [内部Camoufox启动] Camoufox 参数详情: {camoufox_kwargs} ---\", flush=True)\n            browser = Camoufox(**camoufox_kwargs)\n            print(f\"--- [内部Camoufox启动] Camoufox 高级API ({internal_mode_arg}模式) 启动成功。 ---\", flush=True)\n            print(f\"--- [内部Camoufox启动] 浏览器PID: {browser.pid if hasattr(browser, 'pid') else '未知'} ---\", flush=True)"
          }
        }
      ],
      id: "gen-1754407907-Jpj42hYtTifHX5DZILsq",
      model: "claude-sonnet-4-20250514",
      role: "assistant",
      stop_reason: "end_turn",
      type: "message"
    },
    expectedResult: {
      shouldApply: false, // 已经是正确格式，不需要修复
      toolCallCount: 1
    }
  },

  // 测试用例2: 工具调用在文本中（常见问题）
  toolCallInText: {
    description: '工具调用被解析为文本内容',
    input: {
      content: [
        {
          type: "text",
          text: 'I need to edit the file. {"type": "tool_use", "id": "toolu_123", "name": "Edit", "input": {"file_path": "/test.py", "old_string": "old code", "new_string": "new code"}}'
        }
      ],
      id: "test-message-1",
      model: "qwen3-coder",
      role: "assistant",
      stop_reason: "end_turn",
      type: "message"
    },
    expectedResult: {
      shouldApply: true,
      toolCallCount: 1,
      hasTextContent: true
    }
  },

  // 测试用例3: Tool call: 格式（ShuaiHong常见格式）
  toolCallFormat: {
    description: 'Tool call: 格式的工具调用',
    input: {
      content: [
        {
          type: "text",
          text: 'I will help you run the command. Tool call: Bash({"command": "source ./venv/bin/activate && python test_multi_auth_first_instance.py", "description": "激活虚拟环境并运行多实例认证测试脚本"})'
        }
      ],
      id: "test-message-2",
      model: "qwen3-coder",
      role: "assistant",
      stop_reason: "end_turn",
      type: "message"
    },
    expectedResult: {
      shouldApply: true,
      toolCallCount: 1,
      hasTextContent: true
    }
  },

  // 测试用例4: 混合内容（文本+工具调用）
  mixedContent: {
    description: '混合文本和工具调用内容',
    input: {
      content: [
        {
          type: "text",
          text: 'Let me analyze the code first and then make the necessary changes.\n\n{"type": "tool_use", "id": "toolu_456", "name": "Read", "input": {"file_path": "/src/main.py"}}\n\nAfter reading, I will edit the file.'
        }
      ],
      id: "test-message-3",
      model: "claude-3-sonnet",
      role: "assistant",
      stop_reason: "tool_use",
      type: "message"
    },
    expectedResult: {
      shouldApply: true,
      toolCallCount: 1,
      hasTextContent: true
    }
  },

  // 测试用例5: 多个工具调用
  multipleToolCalls: {
    description: '多个工具调用在文本中',
    input: {
      content: [
        {
          type: "text",
          text: 'I need to perform multiple operations:\n\nTool call: Read({"file_path": "/config.json"})\n\nThen I will:\n\nTool call: Edit({"file_path": "/config.json", "old_string": "old_value", "new_string": "new_value"})'
        }
      ],
      id: "test-message-4",
      model: "glm-4.5",
      role: "assistant",
      stop_reason: "tool_use",
      type: "message"
    },
    expectedResult: {
      shouldApply: true,
      toolCallCount: 2,
      hasTextContent: true
    }
  },

  // 测试用例6: 嵌套JSON的复杂工具调用
  complexToolCall: {
    description: '包含嵌套JSON的复杂工具调用',
    input: {
      content: [
        {
          type: "text",
          text: 'I will create a complex configuration. {"type": "tool_use", "id": "toolu_789", "name": "Write", "input": {"file_path": "/complex.json", "content": "{\\"nested\\": {\\"key\\": \\"value\\", \\"array\\": [1, 2, 3]}}"}}'
        }
      ],
      id: "test-message-5",
      model: "deepseek-v3",
      role: "assistant",
      stop_reason: "tool_use",
      type: "message"
    },
    expectedResult: {
      shouldApply: true,
      toolCallCount: 1,
      hasTextContent: true
    }
  },

  // 测试用例7: 错误格式（应该不被处理）
  invalidFormat: {
    description: '无效的工具调用格式',
    input: {
      content: [
        {
          type: "text",
          text: 'This is just regular text mentioning tools but not actual tool calls. Some JSON: {"not": "a tool call", "missing": "required fields"}'
        }
      ],
      id: "test-message-6",
      model: "gpt-4",
      role: "assistant",
      stop_reason: "end_turn",
      type: "message"
    },
    expectedResult: {
      shouldApply: false,
      toolCallCount: 0
    }
  },

  // 测试用例8: 来自实际5508日志的Bash工具调用
  realBashCall: {
    description: '来自5508端口实际日志的Bash工具调用',
    input: {
      content: [
        {
          type: "text",
          text: '我将激活虚拟环境并运行测试脚本。\n\n{"type": "tool_use", "id": "extracted_1754408257550_lbhg3unjepb", "name": "Bash", "input": {"command": "source ./venv/bin/activate && python test_multi_auth_first_instance.py", "description": "激活虚拟环境并运行多实例认证测试脚本"}}'
        }
      ],
      id: "gen-1754408235-fsG7HhmP4JYJ28hZVOmX",
      model: "qwen3-coder",
      role: "assistant",
      stop_reason: "end_turn",
      type: "message"
    },
    expectedResult: {
      shouldApply: true,
      toolCallCount: 1,
      hasTextContent: true
    }
  }
};

async function runToolCallParsingTests() {
  console.log('🧪 开始基于日志真实数据的工具调用解析测试...\n');

  const patch = new AnthropicToolCallTextFixPatch();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const [testName, testCase] of Object.entries(TEST_CASES)) {
    totalTests++;
    console.log(`📋 测试: ${testCase.description}`);
    console.log(`   测试名称: ${testName}`);

    try {
      // 创建测试上下文
      const context = {
        provider: 'openai',
        model: testCase.input.model,
        requestId: `test-${testName}-${Date.now()}`
      };

      // 测试shouldApply方法
      const shouldApply = patch.shouldApply(context, testCase.input);
      console.log(`   shouldApply: ${shouldApply} (期望: ${testCase.expectedResult.shouldApply})`);

      if (shouldApply !== testCase.expectedResult.shouldApply) {
        console.log(`   ❌ shouldApply测试失败`);
        failedTests++;
        continue;
      }

      // 如果应该应用patch，测试apply方法
      if (shouldApply) {
        const result = await patch.apply(context, testCase.input);
        console.log(`   apply结果: ${result.success ? '成功' : '失败'}`);

        if (!result.success) {
          console.log(`   ❌ apply执行失败: ${result.metadata?.error}`);
          failedTests++;
          continue;
        }

        // 检查工具调用数量
        const actualToolCallCount = result.data.content.filter(block => block.type === 'tool_use').length;
        console.log(`   工具调用数量: ${actualToolCallCount} (期望: ${testCase.expectedResult.toolCallCount})`);

        if (actualToolCallCount !== testCase.expectedResult.toolCallCount) {
          console.log(`   ❌ 工具调用数量不匹配`);
          failedTests++;
          continue;
        }

        // 显示提取的工具调用
        const toolCalls = result.data.content.filter(block => block.type === 'tool_use');
        if (toolCalls.length > 0) {
          console.log(`   提取的工具调用:`);
          toolCalls.forEach((tool, index) => {
            console.log(`     ${index + 1}. ${tool.name} (ID: ${tool.id})`);
            console.log(`        输入: ${JSON.stringify(tool.input).substring(0, 100)}...`);
          });
        }

        // 检查是否还有文本内容
        const textBlocks = result.data.content.filter(block => block.type === 'text');
        if (textBlocks.length > 0) {
          console.log(`   剩余文本块: ${textBlocks.length}个`);
          textBlocks.forEach((text, index) => {
            console.log(`     ${index + 1}. "${text.text.substring(0, 50)}..."`);
          });
        }
      }

      console.log(`   ✅ 测试通过`);
      passedTests++;

    } catch (error) {
      console.log(`   ❌ 测试异常: ${error.message}`);
      failedTests++;
    }

    console.log('');
  }

  // 测试总结
  console.log('='.repeat(60));
  console.log('📊 测试总结:');
  console.log(`   总测试数: ${totalTests}`);
  console.log(`   通过: ${passedTests}`);
  console.log(`   失败: ${failedTests}`);
  console.log(`   成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log('\n🎉 所有测试通过！工具调用解析功能正常工作。');
  } else {
    console.log(`\n⚠️  有 ${failedTests} 个测试失败，需要检查工具调用解析逻辑。`);
  }

  // 额外的边界情况测试
  console.log('\n🔍 边界情况测试:');
  await testEdgeCases(patch);
}

async function testEdgeCases(patch) {
  const edgeCases = [
    {
      name: '空内容',
      data: { content: [] },
      shouldApply: false
    },
    {
      name: '无content字段',
      data: { id: 'test', model: 'test' },
      shouldApply: false
    },
    {
      name: '非数组content',
      data: { content: 'not an array' },
      shouldApply: false
    },
    {
      name: '只有非文本块',
      data: { 
        content: [
          { type: 'image', source: { type: 'base64', data: 'abc123' } }
        ]
      },
      shouldApply: false
    },
    {
      name: '包含工具调用但格式错误的JSON',
      data: {
        content: [
          {
            type: 'text',
            text: '这是一个格式错误的工具调用: {"type": "tool_use", "name": "Test", missing_id_and_input}'
          }
        ]
      },
      shouldApply: false // 因为JSON格式错误，不应该应用
    }
  ];

  for (const testCase of edgeCases) {
    try {
      const context = { provider: 'openai', model: 'test', requestId: 'edge-test' };
      const shouldApply = patch.shouldApply(context, testCase.data);
      
      if (shouldApply === testCase.shouldApply) {
        console.log(`   ✅ ${testCase.name}: 正确 (${shouldApply})`);
      } else {
        console.log(`   ❌ ${testCase.name}: 错误 (期望: ${testCase.shouldApply}, 实际: ${shouldApply})`);
      }
    } catch (error) {
      console.log(`   ❌ ${testCase.name}: 异常 - ${error.message}`);
    }
  }
}

// 运行测试
runToolCallParsingTests().catch(console.error);