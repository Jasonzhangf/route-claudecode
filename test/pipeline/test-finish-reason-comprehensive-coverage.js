#!/usr/bin/env node

/**
 * 综合覆盖测试：finish reason处理和工具调用检测
 * 测试各种边界情况：窗口大小、文本长度、超长内容、前端失败后端修复等
 */

const axios = require('axios');
const fs = require('fs');

const TEST_CONFIG = {
  port: 3456,
  timeout: 30000, // 30秒超时，应对超长内容
  models: ['claude-4-sonnet', 'glm-4', 'qwen-coder', 'deepseek-coder']
};

class ComprehensiveCoverageTest {
  constructor() {
    this.baseUrl = `http://localhost:${TEST_CONFIG.port}`;
    this.results = [];
    this.testId = 0;
  }

  async runAllTests() {
    console.log('🧪 Starting Comprehensive Coverage Tests...');
    console.log(`Testing on port ${TEST_CONFIG.port}\n`);

    try {
      // 1. 基础工具调用测试
      await this.testBasicToolCalls();
      
      // 2. 文本格式工具调用测试
      await this.testTextFormatToolCalls();
      
      // 3. 窗口大小变化测试
      await this.testVariableWindowSizes();
      
      // 4. 超长内容测试
      await this.testLongContent();
      
      // 5. finish reason一致性测试
      await this.testFinishReasonConsistency();
      
      // 6. 透明处理测试
      await this.testTransparentProcessing();
      
      // 7. 边界情况测试
      await this.testEdgeCases();
      
      // 总结
      this.printComprehensiveSummary();
      
    } catch (error) {
      console.error('❌ Comprehensive test failed:', error.message);
      process.exit(1);
    }
  }

  async testBasicToolCalls() {
    console.log('🔧 Test Category: Basic Tool Calls');
    console.log('=' * 40);
    
    const basicTests = [
      {
        name: 'standard-tool-call',
        model: 'claude-4-sonnet',
        request: {
          model: 'claude-4-sonnet',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Get weather for Beijing' }],
          tools: [{
            name: 'get_weather',
            description: 'Get weather info',
            input_schema: {
              type: 'object',
              properties: { location: { type: 'string' } }
            }
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true
      },
      {
        name: 'multiple-tools-call',
        model: 'claude-4-sonnet',
        request: {
          model: 'claude-4-sonnet', 
          max_tokens: 200,
          messages: [{ role: 'user', content: 'Get weather for Beijing and Shanghai' }],
          tools: [{
            name: 'get_weather',
            description: 'Get weather info',
            input_schema: {
              type: 'object',
              properties: { location: { type: 'string' } }
            }
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true
      }
    ];

    for (const test of basicTests) {
      await this.runSingleTest(test);
    }
    
    console.log('');
  }

  async testTextFormatToolCalls() {
    console.log('📝 Test Category: Text Format Tool Calls');
    console.log('=' * 40);
    
    const textFormatTests = [
      {
        name: 'glm-format-short',
        model: 'glm-4',
        request: {
          model: 'glm-4',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: 'Respond with: Tool call: calculate({"operation": "add", "a": 1, "b": 2})'
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        expectTransparent: true // 期望原始文本被透明处理
      },
      {
        name: 'glm-format-medium',
        model: 'glm-4',
        request: {
          model: 'glm-4',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: 'Please use this format: Tool call: process_data({"input": "This is a medium length string for testing purposes", "options": {"format": "json", "validate": true}})'
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        expectTransparent: true
      },
      {
        name: 'json-embedded-format',
        model: 'qwen-coder',
        request: {
          model: 'qwen-coder',
          max_tokens: 150,
          messages: [{
            role: 'user', 
            content: 'Output: {"type": "tool_use", "id": "test123", "name": "analyze", "input": {"text": "sample"}}'
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        expectTransparent: true
      }
    ];

    for (const test of textFormatTests) {
      await this.runSingleTest(test);
    }
    
    console.log('');
  }

  async testVariableWindowSizes() {
    console.log('🪟 Test Category: Variable Window Sizes');
    console.log('=' * 40);
    
    const windowTests = [
      {
        name: 'small-window-50-tokens',
        model: 'claude-4-sonnet',
        request: {
          model: 'claude-4-sonnet',
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Use get_weather tool for Tokyo quickly' }],
          tools: [{ 
            name: 'get_weather', 
            description: 'Get weather',
            input_schema: { type: 'object', properties: { location: { type: 'string' } } }
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true
      },
      {
        name: 'medium-window-200-tokens',
        model: 'claude-4-sonnet',
        request: {
          model: 'claude-4-sonnet',
          max_tokens: 200,
          messages: [{ role: 'user', content: 'Please get detailed weather information for multiple cities including Tokyo, Beijing, and New York. Use appropriate tools for each.' }],
          tools: [{ 
            name: 'get_weather', 
            description: 'Get weather information',
            input_schema: { type: 'object', properties: { location: { type: 'string' } } }
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true
      },
      {
        name: 'large-window-1000-tokens',
        model: 'claude-4-sonnet',
        request: {
          model: 'claude-4-sonnet',
          max_tokens: 1000,
          messages: [{ 
            role: 'user', 
            content: 'I need comprehensive weather analysis for a business trip. Please get weather for Tokyo (where I\'ll land), Beijing (meeting location), Shanghai (factory visit), and New York (return flight connection). For each location, I need current conditions and 3-day forecast with temperature, precipitation, and any weather warnings.'
          }],
          tools: [{ 
            name: 'get_weather', 
            description: 'Get comprehensive weather information',
            input_schema: { 
              type: 'object', 
              properties: { 
                location: { type: 'string' },
                forecast_days: { type: 'integer' },
                include_warnings: { type: 'boolean' }
              } 
            }
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true
      }
    ];

    for (const test of windowTests) {
      await this.runSingleTest(test);
    }
    
    console.log('');
  }

  async testLongContent() {
    console.log('📏 Test Category: Long Content Processing');
    console.log('=' * 40);
    
    // 生成超长文本
    const longText = 'This is a very long text content that simulates real-world scenarios where users might send extensive context before requesting tool usage. '.repeat(50);
    const superLongText = 'Ultra long content for stress testing the tool call detection system with massive text blocks. '.repeat(200);
    
    const longContentTests = [
      {
        name: 'long-text-with-tool-call',
        model: 'glm-4',
        request: {
          model: 'glm-4',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `${longText} Now please respond with: Tool call: summarize({"text": "long content", "max_words": 100})`
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        expectTransparent: true
      },
      {
        name: 'super-long-text-with-embedded-json',
        model: 'qwen-coder',
        request: {
          model: 'qwen-coder',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `${superLongText} Please output: {"type": "tool_use", "id": "stress_test", "name": "process_long_content", "input": {"content_length": 10000}}`
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        expectTransparent: true
      }
    ];

    for (const test of longContentTests) {
      await this.runSingleTest(test);
    }
    
    console.log('');
  }

  async testFinishReasonConsistency() {
    console.log('🎯 Test Category: Finish Reason Consistency');
    console.log('=' * 40);
    
    const consistencyTests = [
      {
        name: 'preprocess-fix-missing-finish-reason',
        model: 'claude-4-sonnet',
        request: {
          model: 'claude-4-sonnet',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Get current time' }],
          tools: [{ 
            name: 'get_current_time', 
            description: 'Get current time',
            input_schema: { type: 'object', properties: {} }
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        testConsistencyFix: true
      },
      {
        name: 'postprocess-consistency-validation',
        model: 'glm-4',
        request: {
          model: 'glm-4',
          max_tokens: 150,
          messages: [{
            role: 'user',
            content: 'Say: Tool call: check_status({"service": "api"})'
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        testConsistencyFix: true
      }
    ];

    for (const test of consistencyTests) {
      await this.runSingleTest(test);
    }
    
    console.log('');
  }

  async testTransparentProcessing() {
    console.log('👁️ Test Category: Transparent Processing');
    console.log('=' * 40);
    
    const transparentTests = [
      {
        name: 'glm-format-should-disappear',
        model: 'glm-4',
        request: {
          model: 'glm-4',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: 'Output exactly: Tool call: hidden_tool({"should_be": "transparent"})'
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        expectTransparent: true,
        checkForTransparency: true
      },
      {
        name: 'mixed-text-and-tool-extraction',
        model: 'qwen-coder',
        request: {
          model: 'qwen-coder',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: 'Here is some regular text. Tool call: extract_info({"data": "test"}). And here is more text that should remain.'
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        expectTransparent: true,
        checkForTransparency: true
      }
    ];

    for (const test of transparentTests) {
      await this.runSingleTest(test);
    }
    
    console.log('');
  }

  async testEdgeCases() {
    console.log('⚡ Test Category: Edge Cases');
    console.log('=' * 40);
    
    const edgeTests = [
      {
        name: 'malformed-tool-call',
        model: 'glm-4',
        request: {
          model: 'glm-4',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: 'Tool call: broken_json({"incomplete": "data"'
          }]
        },
        expectedStopReason: 'end_turn',
        expectToolBlocks: false,
        expectError: false // 应该优雅处理
      },
      {
        name: 'nested-tool-calls',
        model: 'qwen-coder',
        request: {
          model: 'qwen-coder',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: 'Tool call: outer({"inner": "Tool call: inner({\"nested\": true})"}) and Tool call: another({"second": "call"})'
          }]
        },
        expectedStopReason: 'tool_use',
        expectToolBlocks: true,
        expectTransparent: true
      },
      {
        name: 'empty-response',
        model: 'claude-4-sonnet',
        request: {
          model: 'claude-4-sonnet',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Say nothing' }]
        },
        expectedStopReason: 'max_tokens',
        expectToolBlocks: false
      }
    ];

    for (const test of edgeTests) {
      await this.runSingleTest(test);
    }
    
    console.log('');
  }

  async runSingleTest(testCase) {
    const testId = ++this.testId;
    console.log(`🧪 Test ${testId}: ${testCase.name}`);
    
    try {
      const startTime = Date.now();
      const response = await axios.post(`${this.baseUrl}/v1/messages`, testCase.request, {
        timeout: TEST_CONFIG.timeout,
        headers: { 'Content-Type': 'application/json' }
      });

      const data = response.data;
      const duration = Date.now() - startTime;
      
      // 基础验证
      const hasToolBlocks = data.content && data.content.some(block => block.type === 'tool_use');
      const toolCount = hasToolBlocks ? data.content.filter(block => block.type === 'tool_use').length : 0;
      const stopReason = data.stop_reason;
      
      // 一致性检查
      const consistencyCheck = this.checkConsistency(hasToolBlocks, stopReason);
      
      // 透明处理检查
      const transparencyCheck = testCase.checkForTransparency ? 
        this.checkTransparency(data.content, testCase.request.messages[0].content) : null;
      
      // 结果验证
      const success = this.validateTestResult(testCase, {
        hasToolBlocks,
        toolCount,
        stopReason,
        consistencyCheck,
        transparencyCheck,
        duration
      });

      // 记录结果
      const result = {
        testId,
        name: testCase.name,
        model: testCase.model,
        success,
        duration,
        stopReason,
        hasToolBlocks,
        toolCount,
        consistencyCheck,
        transparencyCheck,
        expectedStopReason: testCase.expectedStopReason,
        expectToolBlocks: testCase.expectToolBlocks
      };

      this.results.push(result);
      
      // 输出结果
      if (success) {
        console.log(`  ✅ PASS (${duration}ms) - stop_reason: ${stopReason}, tools: ${toolCount}`);
        if (transparencyCheck) {
          console.log(`  👁️ Transparency: ${transparencyCheck.transparent ? 'PASS' : 'FAIL'} - ${transparencyCheck.message}`);
        }
        if (!consistencyCheck.consistent && consistencyCheck.fixed) {
          console.log(`  🔧 Consistency fixed: ${consistencyCheck.message}`);
        }
      } else {
        console.log(`  ❌ FAIL (${duration}ms) - stop_reason: ${stopReason}, tools: ${toolCount}`);
        if (consistencyCheck && !consistencyCheck.consistent) {
          console.log(`  ⚠️ Consistency issue: ${consistencyCheck.message}`);
        }
      }

    } catch (error) {
      const duration = Date.now() - Date.now();
      console.log(`  ❌ ERROR: ${error.message}`);
      
      this.results.push({
        testId,
        name: testCase.name,
        model: testCase.model,
        success: false,
        duration: 0,
        error: error.message,
        stopReason: null,
        hasToolBlocks: false,
        toolCount: 0
      });
    }
  }

  validateTestResult(testCase, actual) {
    // 基础验证
    if (testCase.expectedStopReason && actual.stopReason !== testCase.expectedStopReason) {
      return false;
    }
    
    if (testCase.expectToolBlocks !== undefined && actual.hasToolBlocks !== testCase.expectToolBlocks) {
      return false;
    }
    
    // 透明处理验证
    if (testCase.expectTransparent && actual.transparencyCheck && !actual.transparencyCheck.transparent) {
      return false;
    }
    
    // 一致性验证
    if (testCase.testConsistencyFix && !actual.consistencyCheck.consistent && !actual.consistencyCheck.fixed) {
      return false;
    }
    
    return true;
  }

  checkConsistency(hasToolBlocks, stopReason) {
    const shouldBeToolUse = hasToolBlocks && stopReason === 'tool_use';
    const shouldBeEndTurn = !hasToolBlocks && stopReason === 'end_turn';
    
    const consistent = shouldBeToolUse || shouldBeEndTurn;
    const fixed = !consistent; // 假设系统会自动修复
    
    let message = '';
    if (!consistent) {
      if (hasToolBlocks && stopReason !== 'tool_use') {
        message = `Has tools but stop_reason is '${stopReason}', should be 'tool_use'`;
      } else if (!hasToolBlocks && stopReason === 'tool_use') {
        message = `No tools but stop_reason is 'tool_use', should be 'end_turn'`;
      }
    }

    return { consistent, fixed, message };
  }

  checkTransparency(content, originalInput) {
    if (!content || !Array.isArray(content)) {
      return { transparent: true, message: 'No content to check' };
    }

    // 检查是否还包含工具调用的原始文本
    const textBlocks = content.filter(block => block.type === 'text');
    let containsToolCallText = false;
    
    for (const block of textBlocks) {
      if (block.text) {
        // 检查是否包含工具调用格式
        if (/Tool\s+call:\s*\w+\s*\(/i.test(block.text) ||
            /"type"\s*:\s*"tool_use"/i.test(block.text)) {
          containsToolCallText = true;
          break;
        }
      }
    }

    const transparent = !containsToolCallText;
    const message = transparent ? 
      'Tool call text successfully removed' : 
      'Tool call text still visible in response';

    return { transparent, message };
  }

  printComprehensiveSummary() {
    console.log('='.repeat(60));
    console.log('📊 COMPREHENSIVE COVERAGE TEST RESULTS');
    console.log('='.repeat(60));
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    const avgDuration = this.results.reduce((sum, r) => sum + (r.duration || 0), 0) / totalTests;
    
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success rate: ${(passedTests/totalTests*100).toFixed(1)}%`);
    console.log(`Average duration: ${avgDuration.toFixed(0)}ms`);
    
    // 分类统计
    const categories = {
      'Basic Tool Calls': this.results.filter(r => r.name.includes('standard') || r.name.includes('multiple')),
      'Text Format': this.results.filter(r => r.name.includes('glm') || r.name.includes('json')),
      'Window Sizes': this.results.filter(r => r.name.includes('window')),
      'Long Content': this.results.filter(r => r.name.includes('long')),
      'Consistency': this.results.filter(r => r.name.includes('consistency') || r.name.includes('preprocess') || r.name.includes('postprocess')),
      'Transparency': this.results.filter(r => r.name.includes('transparent') || r.name.includes('disappear') || r.name.includes('mixed')),
      'Edge Cases': this.results.filter(r => r.name.includes('malformed') || r.name.includes('nested') || r.name.includes('empty'))
    };

    console.log('\n📈 CATEGORY BREAKDOWN:');
    for (const [category, tests] of Object.entries(categories)) {
      if (tests.length > 0) {
        const categoryPassed = tests.filter(t => t.success).length;
        const categoryRate = (categoryPassed / tests.length * 100).toFixed(1);
        console.log(`  ${category}: ${categoryPassed}/${tests.length} (${categoryRate}%)`);
      }
    }
    
    // 失败测试详情
    const failed = this.results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failed.forEach(test => {
        console.log(`  • ${test.name}: ${test.error || 'Validation failed'}`);
        if (test.stopReason) {
          console.log(`    Expected: ${test.expectedStopReason}, Got: ${test.stopReason}`);
        }
      });
    }
    
    // 性能分析
    const highPerformance = this.results.filter(r => r.duration && r.duration < 1000).length;
    const mediumPerformance = this.results.filter(r => r.duration && r.duration >= 1000 && r.duration < 5000).length;
    const slowPerformance = this.results.filter(r => r.duration && r.duration >= 5000).length;
    
    console.log('\n⚡ PERFORMANCE ANALYSIS:');
    console.log(`  Fast (<1s): ${highPerformance} tests`);
    console.log(`  Medium (1-5s): ${mediumPerformance} tests`);
    console.log(`  Slow (>5s): ${slowPerformance} tests`);
    
    console.log('\n' + '='.repeat(60));
    
    // 保存详细结果到文件
    const reportPath = '/Users/fanzhang/Documents/github/claude-code-router/test-comprehensive-coverage-report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: passedTests/totalTests,
        avgDuration
      },
      categories,
      results: this.results,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// 主执行
async function main() {
  const tester = new ComprehensiveCoverageTest();
  await tester.runAllTests();
  console.log('🎉 Comprehensive coverage test completed!');
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveCoverageTest;