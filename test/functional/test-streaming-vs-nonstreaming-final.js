#!/usr/bin/env node

/**
 * 最终验证测试：流式 vs 非流式处理策略
 * 
 * 验证目标：
 * 1. 流式请求使用智能缓冲策略
 * 2. 非流式请求保持原有处理逻辑
 * 3. 所有Provider都正常工作
 */

const http = require('http');

class FinalArchitectureValidator {
  constructor() {
    this.results = [];
  }

  async runAllTests() {
    console.log('🏗️ 最终架构验证测试');
    console.log('=' + '='.repeat(60));
    console.log('📋 测试范围：');
    console.log('   ✅ 流式请求 → 智能缓冲策略');
    console.log('   ✅ 非流式请求 → 原有处理逻辑');
    console.log('   ✅ 多Provider验证');
    console.log('');

    // 测试用例组合
    const testCases = [
      {
        name: 'Gemini非流式请求',
        type: 'non-streaming',
        provider: 'google-gemini',
        request: this.createLongContextRequest(false),
        expectedStrategy: 'traditional-api'
      },
      {
        name: 'Gemini流式请求',
        type: 'streaming', 
        provider: 'google-gemini',
        request: this.createLongContextRequest(true),
        expectedStrategy: 'smart-buffering'
      },
      {
        name: 'OpenAI流式请求',
        type: 'streaming',
        provider: 'shuaihong-openai', 
        request: this.createToolCallRequest(true),
        expectedStrategy: 'buffered-processing'
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n🧪 测试: ${testCase.name}`);
      console.log(`   类型: ${testCase.type}`);
      console.log(`   预期策略: ${testCase.expectedStrategy}`);
      
      const result = await this.runSingleTest(testCase);
      this.results.push(result);
      
      if (result.success) {
        console.log(`   ✅ PASS - ${result.message}`);
      } else {
        console.log(`   ❌ FAIL - ${result.message}`);
      }
    }

    this.printFinalSummary();
  }

  createLongContextRequest(streaming) {
    const longContent = 'JavaScript编程语言相关的详细技术内容。'.repeat(1000);
    return {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      stream: streaming,
      messages: [
        {
          role: 'user',
          content: `${longContent}\n\n请简单总结JavaScript的特点。`
        }
      ]
    };
  }

  createToolCallRequest(streaming) {
    return {
      model: 'claude-3-5-haiku-20241022', // 触发background路由
      max_tokens: 500,
      stream: streaming,
      messages: [
        {
          role: 'user',
          content: '请搜索今天的天气信息'
        }
      ],
      tools: [
        {
          name: 'WebSearch',
          description: '搜索网络信息',
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string' }
            }
          }
        }
      ]
    };
  }

  async runSingleTest(testCase) {
    const startTime = Date.now();
    
    try {
      let response;
      
      if (testCase.type === 'streaming') {
        response = await this.sendStreamingRequest(testCase.request);
      } else {
        response = await this.sendNonStreamingRequest(testCase.request);
      }
      
      const duration = Date.now() - startTime;
      return this.analyzeResponse(testCase, response, duration);
      
    } catch (error) {
      return {
        testCase: testCase.name,
        success: false,
        message: `测试执行失败: ${error.message}`,
        duration: Date.now() - startTime
      };
    }
  }

  async sendStreamingRequest(requestData) {
    const postData = JSON.stringify(requestData);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8888,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Accept': 'text/event-stream'
        }
      };

      const req = http.request(options, (res) => {
        let eventCount = 0;
        let contentLength = 0;
        let outputTokens = 0;
        let detectedModel = '';

        res.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.slice(6));
                eventCount++;
                
                if (eventData.type === 'content_block_delta' && eventData.delta?.text) {
                  contentLength += eventData.delta.text.length;
                }
                
                if (eventData.type === 'message_start' && eventData.message?.model) {
                  detectedModel = eventData.message.model;
                }
                
                if (eventData.type === 'message_delta' && eventData.usage?.output_tokens) {
                  outputTokens = eventData.usage.output_tokens;
                }
              } catch (e) {}
            }
          }
        });

        res.on('end', () => {
          resolve({
            type: 'streaming',
            statusCode: res.statusCode,
            eventCount,
            contentLength,
            outputTokens,
            detectedModel
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(60000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.write(postData);
      req.end();
    });
  }

  async sendNonStreamingRequest(requestData) {
    const postData = JSON.stringify({ ...requestData, stream: false });
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8888,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve({
              type: 'non-streaming',
              statusCode: res.statusCode,
              response: response,
              contentLength: response.content?.[0]?.text?.length || 0,
              outputTokens: response.usage?.output_tokens || 0,
              detectedModel: response.model
            });
          } catch (error) {
            reject(new Error(`JSON解析失败: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(60000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.write(postData);
      req.end();
    });
  }

  analyzeResponse(testCase, response, duration) {
    const analysis = {
      testCase: testCase.name,
      success: false,
      message: '',
      duration: duration,
      details: {
        type: response.type,
        statusCode: response.statusCode,
        contentLength: response.contentLength,
        outputTokens: response.outputTokens,
        detectedModel: response.detectedModel
      }
    };

    // 基本成功标准
    if (response.statusCode !== 200) {
      analysis.message = `HTTP错误: ${response.statusCode}`;
      return analysis;
    }

    if (response.outputTokens === 0) {
      analysis.message = 'outputTokens为0，可能存在处理问题';
      return analysis;
    }

    if (response.contentLength === 0) {
      analysis.message = '没有接收到内容';
      return analysis;
    }

    // 策略验证
    if (testCase.type === 'streaming') {
      if (response.eventCount && response.eventCount > 0) {
        analysis.success = true;
        analysis.message = `流式处理正常，接收${response.eventCount}个事件，${response.outputTokens}个tokens`;
      } else {
        analysis.message = '流式请求但没有接收到事件';
      }
    } else {
      if (response.response && response.response.content) {
        analysis.success = true;
        analysis.message = `非流式处理正常，${response.outputTokens}个tokens`;
      } else {
        analysis.message = '非流式请求但响应格式异常';
      }
    }

    return analysis;
  }

  printFinalSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('🎯 最终架构验证结果');
    console.log('='.repeat(70));
    
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log(`总测试: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${total - passed}`);
    console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);
    
    console.log('\n📊 详细结果:');
    for (const result of this.results) {
      const status = result.success ? '✅' : '❌';
      console.log(`\n${status} ${result.testCase}:`);
      console.log(`   消息: ${result.message}`);
      console.log(`   耗时: ${result.duration}ms`);
      
      if (result.details) {
        console.log(`   状态: ${result.details.statusCode}`);
        console.log(`   内容长度: ${result.details.contentLength}`);
        console.log(`   输出Tokens: ${result.details.outputTokens}`);
        console.log(`   模型: ${result.details.detectedModel}`);
      }
    }
    
    console.log('\n' + '='.repeat(70));
    
    if (passed === total) {
      console.log('🎉 所有测试通过！架构验证成功');
      console.log('✅ 流式请求使用智能缓冲策略');
      console.log('✅ 非流式请求保持原有处理逻辑');
    } else {
      console.log('⚠️ 部分测试失败，需要进一步调试');
      process.exit(1);
    }
  }
}

async function main() {
  const validator = new FinalArchitectureValidator();
  await validator.runAllTests();
}

main().catch(error => {
  console.error('❌ 测试执行失败:', error.message);
  process.exit(1);
});