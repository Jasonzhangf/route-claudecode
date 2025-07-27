#!/usr/bin/env node

/**
 * 测试用例: CLI工具调用问题诊断
 * 测试目标: 检测流式响应中工具调用的token计算是否正确，确保不出现outputTokens为0的问题
 * 模拟真实Claude Code的请求格式和beta headers
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

class CLIToolIssueAnalyzer {
  constructor() {
    this.serverUrl = 'http://127.0.0.1:3456';
    this.logFile = '/tmp/cli-tool-analysis.log';
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    console.log(logEntry);
    fs.appendFileSync(this.logFile, logEntry + '\n');
  }

  /**
   * 模拟真实的Claude Code请求
   */
  async testRealCLIRequest() {
    this.log('🔍 测试真实CLI请求模式');
    
    // 第一个请求：简单对话
    const simpleRequest = {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 131072,
      stream: true,
      messages: [
        {
          role: "user",
          content: "你好"
        }
      ]
    };

    await this.sendCLIRequest('简单对话', simpleRequest);

    // 第二个请求：带工具的请求，模拟CLI的beta headers
    const toolRequest = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 131072,
      stream: true,
      messages: [
        {
          role: "user",
          content: "请帮我读取文件 /tmp/test.txt"
        }
      ],
      tools: [
        {
          name: "Read",
          description: "读取文件内容",
          input_schema: {
            type: "object",
            properties: {
              file_path: {
                type: "string",
                description: "文件路径"
              }
            },
            required: ["file_path"]
          }
        }
      ]
    };

    await this.sendCLIRequest('工具调用请求', toolRequest);

    // 第三个请求：继续对话（模拟工具调用后的情况）
    const followupRequest = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 131072,
      stream: true,
      messages: [
        {
          role: "user",
          content: "请帮我读取文件 /tmp/test.txt"
        },
        {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "我来帮您读取文件 /tmp/test.txt 的内容。"
            },
            {
              type: "tool_use",
              id: "tooluse_test123",
              name: "Read",
              input: {
                file_path: "/tmp/test.txt"
              }
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tooluse_test123",
              content: "文件内容: Hello World"
            }
          ]
        },
        {
          role: "user",
          content: "很好，请继续帮我列出当前目录的文件"
        }
      ],
      tools: [
        {
          name: "LS",
          description: "列出目录内容",
          input_schema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "目录路径"
              }
            },
            required: ["path"]
          }
        }
      ]
    };

    await this.sendCLIRequest('工具调用后继续对话', followupRequest);
  }

  async sendCLIRequest(testName, request) {
    this.log(`\n📤 ${testName}`);
    
    try {
      const headers = {
        'host': '127.0.0.1:3456',
        'connection': 'keep-alive',
        'accept': 'application/json',
        'x-stainless-retry-count': '0',
        'x-stainless-timeout': '600',
        'x-stainless-lang': 'js',
        'x-stainless-package-version': '0.55.1',
        'x-stainless-os': 'MacOS',
        'x-stainless-arch': 'arm64',
        'x-stainless-runtime': 'node',
        'x-stainless-runtime-version': 'v22.16.0',
        'anthropic-dangerous-direct-browser-access': 'true',
        'anthropic-version': '2023-06-01',
        'authorization': 'Bearer undefined',
        'x-api-key': 'any-string-is-ok',
        'x-app': 'cli',
        'user-agent': 'claude-cli/1.0.56 (external, cli)',
        'content-type': 'application/json',
        'x-stainless-helper-method': 'stream',
        'accept-language': '*',
        'sec-fetch-mode': 'cors',
        'accept-encoding': 'gzip, deflate'
      };

      // 根据请求内容添加适当的beta headers
      if (request.tools && request.tools.length > 0) {
        headers['anthropic-beta'] = 'claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14';
      } else {
        headers['anthropic-beta'] = 'fine-grained-tool-streaming-2025-05-14';
      }

      const response = await axios.post(`${this.serverUrl}/v1/messages?beta=true`, request, {
        headers,
        responseType: 'stream',
        timeout: 30000
      });

      // 分析流式响应
      const analysis = await this.analyzeStreamResponse(response.data);
      
      this.log(`✅ ${testName} 完成`, {
        statusCode: response.status,
        analysis
      });

      return analysis;

    } catch (error) {
      this.log(`❌ ${testName} 失败`, {
        error: error.message,
        status: error.response?.status
      });
      throw error;
    }
  }

  async analyzeStreamResponse(stream) {
    return new Promise((resolve, reject) => {
      const events = [];
      let buffer = '';
      let hasToolCall = false;
      let hasTextContent = false;
      let suspiciousContent = [];
      let toolEvents = [];
      let textEvents = [];

      const timeout = setTimeout(() => {
        reject(new Error('Stream analysis timeout'));
      }, 30000);

      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim();
            events.push({ type: 'event', value: eventType, timestamp: Date.now() });
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              events.push({ type: 'data', value: parsed, timestamp: Date.now() });

              // 分析数据内容
              if (parsed.content_block) {
                if (parsed.content_block.type === 'tool_use') {
                  hasToolCall = true;
                  toolEvents.push({
                    name: parsed.content_block.name,
                    id: parsed.content_block.id,
                    input: parsed.content_block.input
                  });
                } else if (parsed.content_block.type === 'text') {
                  hasTextContent = true;
                  const text = parsed.content_block.text || '';
                  textEvents.push(text);

                  // 检查是否包含可疑的工具调用文本
                  if (text.includes('<function_calls>') || 
                      text.includes('function_calls') ||
                      text.includes('tool_use') ||
                      text.includes('<invoke>')) {
                    suspiciousContent.push({
                      text: text,
                      event: parsed
                    });
                  }
                }
              }

              // 检查delta内容
              if (parsed.delta && parsed.delta.text) {
                const deltaText = parsed.delta.text;
                if (deltaText.includes('<function_calls>') || 
                    deltaText.includes('function_calls') ||
                    deltaText.includes('tool_use') ||
                    deltaText.includes('<invoke>')) {
                  suspiciousContent.push({
                    text: deltaText,
                    event: parsed,
                    type: 'delta'
                  });
                }
              }
            } catch (e) {
              events.push({ type: 'data', value: data, timestamp: Date.now() });
            }
          }
        }
      });

      stream.on('end', () => {
        clearTimeout(timeout);

        const analysis = {
          totalEvents: events.length,
          hasToolCall,
          hasTextContent,
          toolEvents,
          textEventCount: textEvents.length,
          suspiciousContent,
          issues: []
        };

        // 问题诊断
        if (suspiciousContent.length > 0) {
          analysis.issues.push({
            type: 'tool_calls_in_text',
            severity: 'critical',
            description: '工具调用被误认为文本内容',
            evidence: suspiciousContent
          });
        }

        if (hasToolCall && textEvents.some(text => 
          text.includes('function_calls') || 
          text.includes('<function_calls>')
        )) {
          analysis.issues.push({
            type: 'mixed_tool_text',
            severity: 'high',
            description: '工具调用和文本内容混合出现'
          });
        }

        // 检查输出tokens为0的情况
        const outputTokensZero = events.some(e => 
          e.type === 'data' && 
          e.value.usage && 
          e.value.usage.output_tokens === 0
        );

        if (outputTokensZero && hasToolCall) {
          analysis.issues.push({
            type: 'zero_output_tokens_with_tools',
            severity: 'medium',
            description: '工具调用时输出tokens为0，可能表明内容处理异常'
          });
        }

        resolve(analysis);
      });

      stream.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async run() {
    console.log('🔍 开始CLI工具调用问题分析...\n');
    
    // 清空日志文件
    fs.writeFileSync(this.logFile, '');

    try {
      await this.testRealCLIRequest();
      
      console.log(`\n📝 详细分析日志保存在: ${this.logFile}`);
      
    } catch (error) {
      this.log('❌ 分析过程失败', { error: error.message });
      throw error;
    }
  }
}

// 运行分析
const analyzer = new CLIToolIssueAnalyzer();
analyzer.run().catch(console.error);