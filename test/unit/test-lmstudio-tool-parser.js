/**
 * LMStudio工具解析器单元测试
 * 自动解析database中的数据，测试工具兼容性
 * 
 * Project owner: Jason Zhang
 */

import { LMStudioToolCompatibility } from '../../src/v3/preprocessor/lmstudio-tool-compatibility.js';
import DatabaseCleanupScanner from '../../database/database-cleanup-scanner.js';
import fs from 'fs';
import path from 'path';

class LMStudioToolParserTest {
  constructor() {
    this.processor = new LMStudioToolCompatibility();
    this.scanner = new DatabaseCleanupScanner();
    this.testResults = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      results: []
    };
  }

  async runAllTests() {
    console.log('🧪 开始LMStudio工具解析器单元测试...\n');

    // 运行基础单元测试
    await this.runBasicUnitTests();

    // 运行数据库数据测试
    await this.runDatabaseDataTests();

    this.printSummary();
  }

  async runBasicUnitTests() {
    console.log('📋 运行基础单元测试...');

    const tests = [
      {
        name: '测试Anthropic格式工具转换',
        test: () => this.testAnthropicToolConversion()
      },
      {
        name: '测试OpenAI格式工具验证',
        test: () => this.testOpenAIToolValidation()
      },
      {
        name: '测试字符串工具处理',
        test: () => this.testStringToolHandling()
      },
      {
        name: '测试无效工具fallback',
        test: () => this.testInvalidToolFallback()
      },
      {
        name: '测试工具名称清理',
        test: () => this.testToolNameSanitization()
      },
      {
        name: '测试参数schema标准化',
        test: () => this.testSchemaNormalization()
      },
      {
        name: '测试工具调用响应后处理',
        test: () => this.testResponsePostprocessing()
      }
    ];

    for (const test of tests) {
      try {
        console.log(`   🔧 ${test.name}...`);
        await test.test();
        this.recordResult(test.name, true);
        console.log(`   ✅ ${test.name} 通过`);
      } catch (error) {
        this.recordResult(test.name, false, error.message);
        console.log(`   ❌ ${test.name} 失败: ${error.message}`);
      }
    }
    console.log('');
  }

  async runDatabaseDataTests() {
    console.log('📋 运行数据库数据测试...');

    // 扫描数据库获取正常工具调用数据
    await this.scanner.scanAll();
    const results = this.scanner.getResults();

    const toolCallSamples = results.normalToolCalls.slice(0, 10); // 取前10个样本
    console.log(`   发现 ${results.normalToolCalls.length} 个正常工具调用记录，测试前 ${toolCallSamples.length} 个样本`);

    for (let i = 0; i < toolCallSamples.length; i++) {
      const sample = toolCallSamples[i];
      try {
        console.log(`   🔧 测试数据库样本 ${i + 1}/${toolCallSamples.length}...`);
        await this.testDatabaseSample(sample, i);
        this.recordResult(`数据库样本 ${i + 1}`, true);
      } catch (error) {
        this.recordResult(`数据库样本 ${i + 1}`, false, error.message);
        console.log(`   ❌ 数据库样本 ${i + 1} 测试失败: ${error.message}`);
      }
    }
    console.log('');
  }

  testAnthropicToolConversion() {
    const anthropicTool = {
      name: 'get_weather',
      description: 'Get weather information',
      input_schema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name'
          }
        },
        required: ['location']
      }
    };

    const request = { tools: [anthropicTool] };
    const processed = this.processor.preprocessRequest(request);

    const result = processed.tools[0];
    if (result.type !== 'function') {
      throw new Error('工具类型应该是function');
    }
    if (result.function.name !== 'get_weather') {
      throw new Error('工具名称应该是get_weather');
    }
    if (!result.function.parameters.properties.location) {
      throw new Error('参数应该包含location字段');
    }
  }

  testOpenAIToolValidation() {
    const openAITool = {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Perform calculation',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string' }
          },
          required: ['expression']
        }
      }
    };

    const request = { tools: [openAITool] };
    const processed = this.processor.preprocessRequest(request);

    const result = processed.tools[0];
    if (result.function.name !== 'calculate') {
      throw new Error('工具名称应该保持calculate');
    }
  }

  testStringToolHandling() {
    const stringTool = 'search_function';
    const request = { tools: [stringTool] };
    const processed = this.processor.preprocessRequest(request);

    const result = processed.tools[0];
    if (result.type !== 'function') {
      throw new Error('字符串工具应该被转换为function类型');
    }
    if (result.function.name !== 'search_function') {
      throw new Error('工具名称应该从字符串转换而来');
    }
  }

  testInvalidToolFallback() {
    const invalidTool = null;
    const request = { tools: [invalidTool] };
    const processed = this.processor.preprocessRequest(request);

    const result = processed.tools[0];
    if (!result.function.name.includes('fallback')) {
      throw new Error('无效工具应该创建fallback');
    }
  }

  testToolNameSanitization() {
    const testCases = [
      { input: 'get-weather', expected: 'get_weather' },
      { input: 'search 123', expected: 'search_123' },
      { input: '123invalid', expected: '_123invalid' },
      { input: 'UPPERCASE', expected: 'uppercase' },
      { input: '', expected: 'unnamed_function' }
    ];

    for (const testCase of testCases) {
      const result = this.processor.sanitizeToolName(testCase.input);
      if (result !== testCase.expected) {
        throw new Error(`工具名称清理失败: '${testCase.input}' -> '${result}', 期望 '${testCase.expected}'`);
      }
    }
  }

  testSchemaNormalization() {
    const schema = {
      properties: {
        name: { description: 'Name field' }, // 缺少type
        age: { type: 'number' }
      }
    };

    const normalized = this.processor.normalizeSchema(schema);
    
    if (normalized.type !== 'object') {
      throw new Error('Schema类型应该是object');
    }
    if (normalized.properties.name.type !== 'string') {
      throw new Error('缺少类型的字段应该默认为string');
    }
  }

  testResponsePostprocessing() {
    const response = {
      choices: [{
        message: {
          tool_calls: [{
            id: 'call_123',
            type: 'function',
            function: {
              name: 'test_function',
              arguments: '{"param": "value"}'
            }
          }]
        }
      }]
    };

    const processed = this.processor.postprocessResponse(response);
    const toolCall = processed.choices[0].message.tool_calls[0];
    
    if (toolCall.function.name !== 'test_function') {
      throw new Error('工具调用名称应该保持不变');
    }
  }

  async testDatabaseSample(sample, index) {
    try {
      const content = fs.readFileSync(sample.path, 'utf8');
      const data = JSON.parse(content);

      if (data.request && data.request.tools) {
        const request = { tools: data.request.tools };
        const processed = this.processor.preprocessRequest(request);

        // 验证处理结果
        if (!processed.tools || !Array.isArray(processed.tools)) {
          throw new Error('处理结果应该包含tools数组');
        }

        for (const tool of processed.tools) {
          if (tool.type !== 'function') {
            throw new Error('所有工具类型应该是function');
          }
          if (!tool.function || !tool.function.name) {
            throw new Error('所有工具应该有function.name');
          }
        }
      }

      if (data.response && data.response.choices && data.response.choices[0]) {
        const message = data.response.choices[0].message;
        if (message && message.tool_calls) {
          const processed = this.processor.postprocessResponse(data.response);
          
          if (!processed.choices[0].message.tool_calls) {
            throw new Error('后处理应该保留工具调用');
          }
        }
      }
    } catch (parseError) {
      throw new Error(`解析数据库文件失败: ${parseError.message}`);
    }
  }

  recordResult(testName, passed, error = null) {
    this.testResults.totalTests++;
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }

    this.testResults.results.push({
      name: testName,
      passed,
      error,
      timestamp: new Date().toISOString()
    });
  }

  printSummary() {
    console.log('📊 LMStudio工具解析器测试结果汇总:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 总测试数: ${this.testResults.totalTests}`);
    console.log(`✅ 通过: ${this.testResults.passed}`);
    console.log(`❌ 失败: ${this.testResults.failed}`);
    console.log(`🎯 成功率: ${((this.testResults.passed / this.testResults.totalTests) * 100).toFixed(1)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (this.testResults.failed > 0) {
      console.log('\n❌ 失败的测试:');
      this.testResults.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`   • ${result.name}: ${result.error}`);
        });
    }

    console.log('\n🎉 LMStudio工具解析器单元测试完成！');
  }

  getResults() {
    return this.testResults;
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new LMStudioToolParserTest();
  tester.runAllTests();
}

export default LMStudioToolParserTest;