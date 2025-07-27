#!/usr/bin/env node

/**
 * 测试工具调用文本转换修复验证
 * 使用真实API请求验证parser中的工具调用文本检测和转换逻辑
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

class ToolCallParsingFixTester {
  constructor() {
    this.baseURL = 'http://127.0.0.1:3456';
    this.logFile = '/tmp/tool-call-parsing-fix-test.log';
    this.testResults = [];
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    console.log(logEntry);
    fs.appendFileSync(this.logFile, logEntry + '\n');
  }

  async testToolCallParsing() {
    this.log('🔍 测试工具调用解析修复');

    try {
      // 构造一个会触发工具调用的请求
      const testRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: 'Please use the Grep tool to search for "ProviderConfig" in the codebase.'
          }
        ],
        tools: [
          {
            name: 'Grep',
            description: 'Search for patterns in files',
            input_schema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: 'The pattern to search for'
                }
              },
              required: ['pattern']
            }
          }
        ],
        stream: true
      };

      this.log('📤 发送测试请求', { 
        url: `${this.baseURL}/v1/messages`,
        requestBody: testRequest 
      });

      // 发送请求并收集流式响应
      const response = await axios.post(`${this.baseURL}/v1/messages`, testRequest, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer any-key'
        },
        responseType: 'stream'
      });

      this.log('📡 收到响应', { 
        status: response.status,
        headers: response.headers 
      });

      // 解析流式响应
      let responseText = '';
      let eventCount = 0;
      let toolCallEvents = 0;
      let textDeltaEvents = 0;
      let foundToolCallAsText = false;

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const chunkStr = chunk.toString();
          responseText += chunkStr;
          
          // 解析SSE事件
          const lines = chunkStr.split('\n');
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.substring(7);
              eventCount++;
              
              this.log(`📊 Event ${eventCount}: ${eventType}`);

              // 检查是否有工具调用相关事件
              if (eventType === 'content_block_start' || eventType === 'content_block_delta') {
                if (eventType === 'content_block_start') {
                  toolCallEvents++;
                }
                if (eventType === 'content_block_delta') {
                  textDeltaEvents++;
                }
              }
            } else if (line.startsWith('data: ')) {
              try {
                const eventData = JSON.parse(line.substring(6));
                
                // 检查是否有包含工具调用文本的text_delta事件（这表示问题仍然存在）
                if (eventData.type === 'content_block_delta' && 
                    eventData.delta && 
                    eventData.delta.type === 'text_delta' && 
                    eventData.delta.text && 
                    eventData.delta.text.includes('Tool call:')) {
                  foundToolCallAsText = true;
                  this.log('❌ 发现工具调用被转换为文本', eventData);
                }

                // 检查是否有正确的工具调用事件
                if (eventData.type === 'content_block_start' && 
                    eventData.content_block && 
                    eventData.content_block.type === 'tool_use') {
                  this.log('✅ 发现正确的工具调用事件', eventData);
                }

                this.log(`📊 Event data:`, eventData);
              } catch (parseError) {
                // 忽略JSON解析错误，可能是ping事件等
              }
            }
          }
        });

        response.data.on('end', () => {
          this.log('🏁 响应完成');
          
          const testResult = {
            status: foundToolCallAsText ? 'FAILED' : 'PASSED',
            eventCount,
            toolCallEvents,
            textDeltaEvents,
            foundToolCallAsText,
            summary: foundToolCallAsText ? 
              '工具调用仍然被转换为文本，修复未生效' : 
              '工具调用正确处理，修复生效'
          };

          this.testResults.push(testResult);
          resolve(testResult);
        });

        response.data.on('error', (error) => {
          this.log('❌ 响应错误', error.message);
          reject(error);
        });
      });

    } catch (error) {
      this.log('❌ 请求失败', { 
        error: error.message,
        response: error.response?.data 
      });
      throw error;
    }
  }

  async testServerStatus() {
    this.log('🏥 测试服务器状态');
    
    try {
      const response = await axios.get(`${this.baseURL}/status`);
      this.log('✅ 服务器状态正常', response.data);
      return true;
    } catch (error) {
      this.log('❌ 服务器状态检查失败', error.message);
      return false;
    }
  }

  async runFullTest() {
    this.log('🚀 开始工具调用解析修复验证测试');
    fs.writeFileSync(this.logFile, '');

    try {
      // 1. 检查服务器状态
      const serverHealthy = await this.testServerStatus();
      if (!serverHealthy) {
        throw new Error('服务器不可用，无法进行测试');
      }

      // 2. 测试工具调用解析
      const testResult = await this.testToolCallParsing();

      // 3. 生成测试报告
      this.log('\n📊 测试报告');
      this.log('==================');
      this.log(`测试状态: ${testResult.status}`);
      this.log(`事件总数: ${testResult.eventCount}`);
      this.log(`工具调用事件: ${testResult.toolCallEvents}`);
      this.log(`文本增量事件: ${testResult.textDeltaEvents}`);
      this.log(`发现工具调用转文本: ${testResult.foundToolCallAsText}`);
      this.log(`测试总结: ${testResult.summary}`);

      if (testResult.status === 'PASSED') {
        this.log('\n🎉 测试通过：工具调用文本转换修复成功！');
        return { success: true, result: testResult };
      } else {
        this.log('\n❌ 测试失败：工具调用仍然被转换为文本');
        return { success: false, result: testResult };
      }

    } catch (error) {
      this.log('❌ 测试执行失败', error.message);
      return { success: false, error: error.message };
    }
  }
}

// 执行测试
async function main() {
  const tester = new ToolCallParsingFixTester();
  
  try {
    const result = await tester.runFullTest();
    
    console.log(`\n📋 测试完成`);
    console.log(`📄 详细日志: ${tester.logFile}`);
    
    if (result.success) {
      console.log('✅ 修复验证成功');
      process.exit(0);
    } else {
      console.log('❌ 修复验证失败');
      process.exit(1);
    }
  } catch (error) {
    console.error('测试执行失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}