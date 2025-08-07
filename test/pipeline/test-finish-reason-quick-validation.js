#!/usr/bin/env node

/**
 * 快速验证测试：核心finish reason修复功能验证
 */

const axios = require('axios');

const TEST_CONFIG = {
  port: 3456,
  timeout: 10000
};

class QuickValidationTest {
  constructor() {
    this.baseUrl = `http://localhost:${TEST_CONFIG.port}`;
  }

  async runQuickTests() {
    console.log('⚡ Quick Validation Tests - Core Functionality');
    console.log('=' * 50);

    const tests = [
      {
        name: '正常工具调用',
        test: async () => {
          const response = await this.callAPI({
            model: 'claude-4-sonnet',
            max_tokens: 100,
            messages: [{ role: 'user', content: 'Get weather for Tokyo' }],
            tools: [{
              name: 'get_weather',
              description: 'Get weather',
              input_schema: { type: 'object', properties: { location: { type: 'string' } } }
            }]
          });
          
          const hasTools = response.content?.some(block => block.type === 'tool_use') || false;
          const stopReason = response.stop_reason;
          
          return {
            pass: hasTools && stopReason === 'tool_use',
            message: `工具调用: ${hasTools}, stop_reason: ${stopReason}`,
            details: { hasTools, stopReason, toolCount: hasTools ? 1 : 0 }
          };
        }
      },
      
      {
        name: '文本格式工具调用检测',
        test: async () => {
          const response = await this.callAPI({
            model: 'qwen-coder',
            max_tokens: 200,
            messages: [{
              role: 'user',
              content: 'Please respond with: Tool call: calculate({"a": 1, "b": 2})'
            }]
          });
          
          const hasTools = response.content?.some(block => block.type === 'tool_use') || false;
          const stopReason = response.stop_reason;
          const hasTextWithToolCall = response.content?.some(block => 
            block.type === 'text' && block.text && /Tool\s+call:/i.test(block.text)
          ) || false;
          
          return {
            pass: hasTools && !hasTextWithToolCall,
            message: `检测到工具: ${hasTools}, 透明处理: ${!hasTextWithToolCall}, stop_reason: ${stopReason}`,
            details: { hasTools, hasTextWithToolCall, stopReason }
          };
        }
      },
      
      {
        name: 'JSON格式工具调用检测',
        test: async () => {
          const response = await this.callAPI({
            model: 'glm-4',
            max_tokens: 150,
            messages: [{
              role: 'user',
              content: 'Output: {"type": "tool_use", "name": "test", "input": {"key": "value"}}'
            }]
          });
          
          const hasTools = response.content?.some(block => block.type === 'tool_use') || false;
          const stopReason = response.stop_reason;
          const hasJsonText = response.content?.some(block => 
            block.type === 'text' && block.text && /"type"\s*:\s*"tool_use"/i.test(block.text)
          ) || false;
          
          return {
            pass: hasTools && !hasJsonText,
            message: `JSON检测: ${hasTools}, 透明处理: ${!hasJsonText}, stop_reason: ${stopReason}`,
            details: { hasTools, hasJsonText, stopReason }
          };
        }
      },
      
      {
        name: 'finish reason一致性修复',
        test: async () => {
          // 发送可能产生不一致finish reason的请求
          const response = await this.callAPI({
            model: 'claude-4-sonnet',
            max_tokens: 100,
            messages: [{ role: 'user', content: 'Use get_time tool' }],
            tools: [{
              name: 'get_time',
              description: 'Get current time',
              input_schema: { type: 'object', properties: {} }
            }]
          });
          
          const hasTools = response.content?.some(block => block.type === 'tool_use') || false;
          const stopReason = response.stop_reason;
          const consistent = (hasTools && stopReason === 'tool_use') || (!hasTools && stopReason === 'end_turn');
          
          return {
            pass: consistent,
            message: `一致性检查: ${consistent ? '通过' : '失败'}, 有工具: ${hasTools}, stop_reason: ${stopReason}`,
            details: { hasTools, stopReason, consistent }
          };
        }
      },
      
      {
        name: '无工具调用场景',
        test: async () => {
          const response = await this.callAPI({
            model: 'claude-4-sonnet',
            max_tokens: 50,
            messages: [{ role: 'user', content: 'Say hello' }]
          });
          
          const hasTools = response.content?.some(block => block.type === 'tool_use') || false;
          const stopReason = response.stop_reason;
          
          return {
            pass: !hasTools && ['end_turn', 'max_tokens'].includes(stopReason),
            message: `无工具场景: 有工具=${hasTools}, stop_reason=${stopReason}`,
            details: { hasTools, stopReason }
          };
        }
      }
    ];

    let passed = 0;
    let total = tests.length;
    
    for (let i = 0; i < tests.length; i++) {
      const testCase = tests[i];
      console.log(`\n🧪 Test ${i + 1}: ${testCase.name}`);
      
      try {
        const startTime = Date.now();
        const result = await testCase.test();
        const duration = Date.now() - startTime;
        
        if (result.pass) {
          console.log(`  ✅ 通过 (${duration}ms): ${result.message}`);
          passed++;
        } else {
          console.log(`  ❌ 失败 (${duration}ms): ${result.message}`);
          if (result.details) {
            console.log(`    详情: ${JSON.stringify(result.details, null, 2)}`);
          }
        }
      } catch (error) {
        console.log(`  💥 错误: ${error.message}`);
        if (error.response?.data) {
          console.log(`    响应: ${JSON.stringify(error.response.data, null, 2)}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 快速验证结果总结');
    console.log(`通过: ${passed}/${total} (${(passed/total*100).toFixed(1)}%)`);
    
    if (passed === total) {
      console.log('🎉 所有核心功能测试通过！');
    } else {
      console.log('⚠️ 部分测试失败，需要进一步调试');
    }
    
    return passed === total;
  }

  async callAPI(request) {
    const response = await axios.post(`${this.baseUrl}/v1/messages`, request, {
      timeout: TEST_CONFIG.timeout,
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  }
}

// 执行
async function main() {
  const tester = new QuickValidationTest();
  const success = await tester.runQuickTests();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  });
}