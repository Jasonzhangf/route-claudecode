#!/usr/bin/env node

/**
 * LMStudio工具调用解析单元测试
 * 测试LMStudio Provider的工具调用解析功能
 */

const { LMStudioToolCallParser } = require('./dist/cli.js');
const axios = require('axios');

class LMStudioToolParsingTester {
  constructor() {
    this.lmstudioEndpoint = 'http://localhost:1234/v1/chat/completions';
    this.testCases = [];
  }

  async testDirectLMStudioResponse() {
    console.log('🧪 测试1: 直接LMStudio响应格式...\n');
    
    try {
      const response = await axios.post(this.lmstudioEndpoint, {
        model: "gpt-oss-20b-mlx",
        messages: [{ role: "user", content: "创建一个名为test.txt的文件，内容是Hello World" }],
        max_tokens: 100,
        stream: false,
        tools: [{
          type: "function",
          function: {
            name: "create_file",
            description: "Create a file with specified content",
            parameters: {
              type: "object",
              properties: {
                filename: { type: "string" },
                content: { type: "string" }
              },
              required: ["filename", "content"]
            }
          }
        }]
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      console.log('✅ LMStudio直接调用成功');
      console.log('📊 响应结构检查:');
      console.log('  - choices存在:', !!response.data.choices);
      console.log('  - choices长度:', response.data.choices?.length || 0);
      
      if (response.data.choices?.[0]) {
        const choice = response.data.choices[0];
        console.log('  - message存在:', !!choice.message);
        console.log('  - message.content长度:', choice.message?.content?.length || 0);
        console.log('  - message.tool_calls:', choice.message?.tool_calls?.length || 0);
        console.log('  - finish_reason:', choice.finish_reason);
        
        if (choice.message?.content) {
          console.log('📄 响应内容预览:');
          console.log('   ', choice.message.content.substring(0, 200) + '...');
        }
        
        this.testCases.push({
          name: 'direct_lmstudio_response',
          response: response.data,
          hasValidChoices: true,
          needsParsing: !choice.message?.tool_calls && choice.message?.content?.includes('create_file')
        });
      }
      
      console.log('');
      
    } catch (error) {
      console.log('❌ LMStudio直接调用失败:', error.message);
      this.testCases.push({
        name: 'direct_lmstudio_response',
        error: error.message,
        hasValidChoices: false
      });
    }
  }

  async testLMStudioToolCallParser() {
    console.log('🧪 测试2: LMStudio工具调用解析器...\n');
    
    const testResponse = {
      choices: [{
        message: {
          role: 'assistant',
          content: 'I\'ll help you create that file. Let me call the create_file function.\n\n{"name": "create_file", "arguments": {"filename": "test.txt", "content": "Hello World"}}'
        },
        finish_reason: 'stop'
      }]
    };

    try {
      const parser = new LMStudioToolCallParser('test-request', [{
        type: "function",
        function: {
          name: "create_file",
          description: "Create a file with specified content",
          parameters: {
            type: "object",
            properties: {
              filename: { type: "string" },
              content: { type: "string" }
            },
            required: ["filename", "content"]
          }
        }
      }]);

      const parseResult = await parser.parseResponse(testResponse);
      
      console.log('✅ 解析器测试完成');
      console.log('📊 解析结果:');
      console.log('  - 解析成功:', parseResult.success);
      console.log('  - 解析方法:', parseResult.parseMethod);
      console.log('  - 置信度:', parseResult.confidence);
      console.log('  - 工具调用数量:', parseResult.toolCalls?.length || 0);
      console.log('  - 剩余内容长度:', parseResult.remainingContent?.length || 0);
      
      if (parseResult.toolCalls && parseResult.toolCalls.length > 0) {
        console.log('🔧 工具调用详情:');
        parseResult.toolCalls.forEach((call, index) => {
          console.log(`   ${index + 1}. 函数: ${call.function?.name}`);
          console.log(`      参数: ${JSON.stringify(call.function?.arguments)}`);
        });
      }
      
      this.testCases.push({
        name: 'lmstudio_parser_test',
        parseResult,
        success: parseResult.success
      });
      
      console.log('');
      
    } catch (error) {
      console.log('❌ 解析器测试失败:', error.message);
      this.testCases.push({
        name: 'lmstudio_parser_test',
        error: error.message,
        success: false
      });
    }
  }

  async testRouterLMStudioIntegration() {
    console.log('🧪 测试3: 路由器LMStudio集成...\n');
    
    try {
      const response = await axios.post('http://localhost:5506/v1/messages', {
        model: "claude-3-sonnet-20240229",
        messages: [{ role: "user", content: "简单回复：测试非流式" }],
        max_tokens: 50,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
          'anthropic-version': '2023-06-01'
        },
        timeout: 15000
      });

      console.log('✅ 路由器非流式调用成功');
      console.log('📊 响应状态:', response.status);
      console.log('📋 响应结构:');
      console.log('  - content存在:', !!response.data.content);
      console.log('  - content长度:', response.data.content?.length || 0);
      console.log('  - stop_reason:', response.data.stop_reason);
      
      this.testCases.push({
        name: 'router_lmstudio_non_streaming',
        success: true,
        statusCode: response.status
      });
      
    } catch (error) {
      console.log('❌ 路由器非流式调用失败:', error.message);
      if (error.response?.data) {
        console.log('📄 错误响应:', JSON.stringify(error.response.data, null, 2));
      }
      
      this.testCases.push({
        name: 'router_lmstudio_non_streaming',
        success: false,
        error: error.message,
        statusCode: error.response?.status
      });
    }
  }

  async testRouterLMStudioToolCall() {
    console.log('🧪 测试4: 路由器LMStudio工具调用...\n');
    
    try {
      const response = await axios.post('http://localhost:5506/v1/messages', {
        model: "claude-3-sonnet-20240229",
        messages: [{ role: "user", content: "请创建一个文件，文件名为test-router.txt" }],
        tools: [{
          type: "function",
          function: {
            name: "create_file",
            description: "Create a file with specified content",
            parameters: {
              type: "object",
              properties: {
                filename: { type: "string" },
                content: { type: "string" }
              },
              required: ["filename", "content"]
            }
          }
        }],
        max_tokens: 200,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
          'anthropic-version': '2023-06-01'
        },
        timeout: 15000
      });

      console.log('✅ 路由器工具调用成功');
      console.log('📊 响应状态:', response.status);
      
      const hasToolUse = response.data.content?.some(block => block.type === 'tool_use');
      console.log('🔧 工具调用检查:');
      console.log('  - 包含tool_use块:', hasToolUse);
      console.log('  - stop_reason:', response.data.stop_reason);
      
      if (hasToolUse) {
        const toolBlocks = response.data.content.filter(block => block.type === 'tool_use');
        console.log('  - 工具调用数量:', toolBlocks.length);
        toolBlocks.forEach((block, index) => {
          console.log(`    ${index + 1}. 工具: ${block.name}`);
        });
      }
      
      this.testCases.push({
        name: 'router_lmstudio_tool_call',
        success: true,
        hasToolUse,
        stopReason: response.data.stop_reason
      });
      
    } catch (error) {
      console.log('❌ 路由器工具调用失败:', error.message);
      if (error.response?.data) {
        console.log('📄 错误响应:', JSON.stringify(error.response.data, null, 2));
      }
      
      this.testCases.push({
        name: 'router_lmstudio_tool_call',
        success: false,
        error: error.message,
        statusCode: error.response?.status
      });
    }
  }

  generateTestReport() {
    console.log('📊 LMStudio工具调用解析测试报告');
    console.log('========================================');
    
    const successful = this.testCases.filter(t => t.success || t.hasValidChoices).length;
    const total = this.testCases.length;
    
    console.log(`✅ 通过测试: ${successful}/${total}`);
    console.log('\n📋 详细结果:');
    
    this.testCases.forEach((testCase, index) => {
      const status = testCase.success || testCase.hasValidChoices ? '✅' : '❌';
      console.log(`${index + 1}. ${testCase.name}: ${status}`);
      
      if (testCase.error) {
        console.log(`   错误: ${testCase.error}`);
      }
      
      if (testCase.needsParsing) {
        console.log(`   🔧 需要文本解析: ${testCase.needsParsing}`);
      }
      
      if (testCase.parseResult) {
        console.log(`   解析成功: ${testCase.parseResult.success}, 方法: ${testCase.parseResult.parseMethod}`);
      }
    });

    console.log('\n🎯 问题诊断:');
    const hasChoicesIssue = this.testCases.some(t => !t.hasValidChoices && !t.success);
    const hasParsingIssue = this.testCases.some(t => t.needsParsing);
    
    if (hasChoicesIssue) {
      console.log('🚨 发现missing choices问题 - 需要检查响应格式兼容性');
    }
    
    if (hasParsingIssue) {
      console.log('🔧 需要启用文本解析 - LMStudio返回文本格式的工具调用');
    }
    
    console.log('\n💡 建议:');
    console.log('1. 检查LMStudio响应格式兼容性patch是否正确应用');
    console.log('2. 确保工具调用文本解析器正常工作');
    console.log('3. 验证流式vs非流式处理的差异');
  }

  async runAllTests() {
    console.log('🧪 LMStudio工具调用解析单元测试开始...\n');
    
    await this.testDirectLMStudioResponse();
    await this.testLMStudioToolCallParser();
    await this.testRouterLMStudioIntegration();
    await this.testRouterLMStudioToolCall();
    
    this.generateTestReport();
    console.log('\n🏁 测试完成');
  }
}

async function main() {
  const tester = new LMStudioToolParsingTester();
  await tester.runAllTests();
}

main().catch(console.error);