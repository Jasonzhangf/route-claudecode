#!/usr/bin/env node

/**
 * 测试用例: 工具调用被转换为文本问题复现和修复
 * 测试目标: 检测和修复工具调用被误认为文本内容的问题，确保工具调用事件正确处理
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

class ToolCallTextConversionTester {
  constructor() {
    this.serverUrl = 'http://127.0.0.1:3456';
    this.logFile = '/tmp/tool-call-text-conversion.log';
    this.issues = [];
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    console.log(logEntry);
    fs.appendFileSync(this.logFile, logEntry + '\n');
  }

  async testToolCallTextConversion() {
    this.log('🔍 开始工具调用文本转换问题测试');
    
    // 清空日志文件
    fs.writeFileSync(this.logFile, '');

    const testRequest = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 131072,
      stream: true,
      messages: [
        {
          role: "user", 
          content: "请使用Grep工具搜索当前目录中包含'test'的文件"
        }
      ],
      tools: [
        {
          name: "Grep",
          description: "搜索文件内容的工具",
          input_schema: {
            type: "object",
            properties: {
              pattern: {
                type: "string",
                description: "搜索模式"
              },
              path: {
                type: "string", 
                description: "搜索路径"
              }
            },
            required: ["pattern"]
          }
        }
      ]
    };

    try {
      const response = await axios.post(`${this.serverUrl}/v1/messages?beta=true`, testRequest, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': 'Bearer test-key',
          'anthropic-beta': 'claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
        },
        responseType: 'stream',
        timeout: 30000
      });

      this.log('📡 开始分析流式响应');

      let buffer = '';
      let eventCount = 0;
      let hasToolCall = false;
      let hasToolCallAsText = false;
      let toolCallEvents = [];
      let textEvents = [];

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              const eventType = line.slice(7).trim();
              eventCount++;
              
              this.log(`📋 Event ${eventCount}: ${eventType}`);
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              try {
                const parsed = JSON.parse(data);
                
                // 检查是否为工具调用开始事件
                if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
                  hasToolCall = true;
                  toolCallEvents.push({
                    type: 'tool_start',
                    name: parsed.content_block.name,
                    id: parsed.content_block.id
                  });
                  this.log(`🔧 工具调用开始: ${parsed.content_block.name}`);
                }
                
                // 检查是否为工具调用参数事件
                else if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
                  toolCallEvents.push({
                    type: 'tool_params',
                    partial_json: parsed.delta.partial_json
                  });
                  this.log(`📝 工具参数: ${parsed.delta.partial_json}`);
                }
                
                // 检查是否为文本内容事件
                else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  textEvents.push({
                    text: parsed.delta.text,
                    type: 'text_content'
                  });
                  
                  // 检查文本中是否包含"Tool call:"这样的内容
                  if (parsed.delta.text.includes('Tool call:')) {
                    hasToolCallAsText = true;
                    this.issues.push({
                      type: 'tool_call_as_text',
                      severity: 'high',
                      description: '工具调用被转换为文本内容',
                      evidence: parsed.delta.text,
                      timestamp: new Date().toISOString()
                    });
                    this.log(`❌ 发现问题: 工具调用被转换为文本: "${parsed.delta.text}"`);
                  } else {
                    this.log(`💬 正常文本内容: ${parsed.delta.text}`);
                  }
                }
                
                // 检查工具调用结束
                else if (parsed.type === 'content_block_stop') {
                  this.log(`✅ 内容块结束: index ${parsed.index}`);
                }
                
              } catch (e) {
                this.log('📦 无法解析的数据:', data);
              }
            }
          }
        });

        response.data.on('end', () => {
          this.log(`\n🔍 分析结果:`);
          this.log(`📊 总事件数: ${eventCount}`);
          this.log(`🔧 是否有工具调用: ${hasToolCall}`);
          this.log(`❌ 工具调用被转为文本: ${hasToolCallAsText}`);
          this.log(`📝 工具调用事件数: ${toolCallEvents.length}`);
          this.log(`💬 文本事件数: ${textEvents.length}`);
          
          const result = {
            eventCount,
            hasToolCall,
            hasToolCallAsText,
            toolCallEvents,
            textEvents,
            issues: this.issues
          };

          if (hasToolCallAsText) {
            this.log(`\n❌ 测试失败: 发现工具调用被转换为文本的问题`);
            this.log(`🔧 问题详情:`);
            this.issues.forEach((issue, index) => {
              this.log(`  ${index + 1}. ${issue.description}`);
              this.log(`     证据: "${issue.evidence}"`);
            });
          } else if (hasToolCall) {
            this.log(`\n✅ 测试通过: 工具调用正确处理为工具事件`);
          } else {
            this.log(`\n⚠️  警告: 没有检测到工具调用`);
          }

          resolve(result);
        });

        response.data.on('error', (error) => {
          this.log(`❌ 流式响应错误: ${error.message}`);
          reject(error);
        });

        setTimeout(() => {
          reject(new Error('测试超时'));
        }, 30000);
      });

    } catch (error) {
      this.log(`❌ 请求失败: ${error.message}`);
      throw error;
    }
  }

  async generateReport() {
    const result = await this.testToolCallTextConversion();
    
    this.log(`\n📋 最终测试报告:`);
    this.log(`状态: ${result.hasToolCallAsText ? 'FAILED' : 'PASSED'}`);
    this.log(`问题数量: ${result.issues.length}`);
    
    if (result.issues.length > 0) {
      this.log(`\n🔧 发现的问题:`);
      result.issues.forEach((issue, index) => {
        this.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
        this.log(`   证据: "${issue.evidence}"`);
        this.log(`   时间: ${issue.timestamp}`);
      });
    }

    this.log(`\n📄 详细日志保存在: ${this.logFile}`);
    
    return result;
  }
}

// 执行测试
async function main() {
  const tester = new ToolCallTextConversionTester();
  
  try {
    await tester.generateReport();
    process.exit(0);
  } catch (error) {
    console.error('测试执行失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}