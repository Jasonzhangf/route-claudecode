#!/usr/bin/env node
/**
 * 实时finish_reason验证测试
 * 检查工具调用时finish_reason的正确传递和覆盖
 * 项目所有者: Jason Zhang
 */

const axios = require('axios');
const { spawn } = require('child_process');

class FinishReasonValidator {
  constructor() {
    this.port = 5505;
    this.baseUrl = `http://localhost:${this.port}`;
  }

  /**
   * 监控日志输出
   */
  startLogMonitor() {
    console.log('🔍 启动finish_reason日志监控...');
    
    // 监控finish_reason日志
    const logMonitor = spawn('tail', ['-f', '/Users/fanzhang/.route-claude-code/logs/port-5505/finish-reason-debug.log'], {
      stdio: 'pipe'
    });

    logMonitor.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        if (line.includes('finish_reason') || line.includes('stop_reason') || line.includes('tool')) {
          console.log(`📋 [LOG] ${line}`);
        }
      });
    });

    logMonitor.stderr.on('data', (data) => {
      console.log(`🚨 [LOG-ERROR] ${data}`);
    });

    return logMonitor;
  }

  /**
   * 测试简单文本请求（应该是end_turn/stop）
   */
  async testSimpleText() {
    console.log('\n🧪 测试1: 简单文本请求 (期望finish_reason: stop)');
    console.log('=============================================');
    
    const request = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'Hello, please just say "Hi there!" and nothing else.' }
      ],
      max_tokens: 100,
      stream: false
    };

    try {
      const startTime = Date.now();
      const response = await axios.post(`${this.baseUrl}/v1/chat/completions`, request, {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
        timeout: 30000
      });

      console.log(`✅ 状态: ${response.status}`);
      console.log(`📊 响应时间: ${Date.now() - startTime}ms`);
      
      if (response.data.choices && response.data.choices[0]) {
        const choice = response.data.choices[0];
        console.log(`🎯 finish_reason: "${choice.finish_reason}" (Anthropic格式)`);
        console.log(`🎯 stop_reason: "${response.data.stop_reason}" (原始格式)`);
        console.log(`📝 内容: "${choice.message?.content || response.data.content}"`);
        
        // 验证finish_reason正确性
        if (response.data.stop_reason === 'end_turn' || choice.finish_reason === 'stop') {
          console.log('✅ finish_reason正确: 简单文本应该是stop/end_turn');
        } else {
          console.log(`⚠️ finish_reason可能有问题: 期望stop/end_turn, 实际${choice.finish_reason || response.data.stop_reason}`);
        }
      }
      
    } catch (error) {
      console.log(`❌ 请求失败: ${error.message}`);
      if (error.response) {
        console.log(`📊 状态码: ${error.response.status}`);
        console.log(`📋 响应数据: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
  }

  /**
   * 测试工具调用请求（必须是tool_use）
   */
  async testToolCall() {
    console.log('\n🧪 测试2: 工具调用请求 (期望finish_reason: tool_use)');
    console.log('================================================');
    
    const request = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'What is the weather like in Beijing?' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather information for a city',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city name'
                }
              },
              required: ['location']
            }
          }
        }
      ],
      max_tokens: 1000,
      stream: false
    };

    try {
      const startTime = Date.now();
      const response = await axios.post(`${this.baseUrl}/v1/chat/completions`, request, {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-key' },
        timeout: 30000
      });

      console.log(`✅ 状态: ${response.status}`);
      console.log(`📊 响应时间: ${Date.now() - startTime}ms`);
      
      if (response.data.choices && response.data.choices[0]) {
        const choice = response.data.choices[0];
        console.log(`🎯 finish_reason: "${choice.finish_reason}" (OpenAI格式)`);
        console.log(`🎯 stop_reason: "${response.data.stop_reason}" (Anthropic格式)`);
        
        // 检查工具调用
        const hasToolCalls = choice.message?.tool_calls && choice.message.tool_calls.length > 0;
        const hasToolUse = response.data.content && response.data.content.some(c => c.type === 'tool_use');
        
        console.log(`🔧 工具调用检测:`);
        console.log(`   OpenAI格式: ${hasToolCalls ? '✅' : '❌'} (${choice.message?.tool_calls?.length || 0} 个工具调用)`);
        console.log(`   Anthropic格式: ${hasToolUse ? '✅' : '❌'} (${response.data.content?.filter(c => c.type === 'tool_use').length || 0} 个工具使用)`);
        
        // 验证finish_reason正确性
        if (response.data.stop_reason === 'tool_use' && choice.finish_reason === 'tool_calls') {
          console.log('✅ finish_reason正确: 工具调用被正确识别和覆盖');
        } else if (response.data.stop_reason === 'tool_use' || choice.finish_reason === 'tool_calls') {
          console.log(`⚠️ 部分正确: stop_reason=${response.data.stop_reason}, finish_reason=${choice.finish_reason}`);
        } else {
          console.log(`❌ finish_reason错误: 期望tool_use/tool_calls, 实际 stop_reason=${response.data.stop_reason}, finish_reason=${choice.finish_reason}`);
        }
        
        // 详细信息
        if (hasToolCalls) {
          console.log(`📋 工具调用详情:`);
          choice.message.tool_calls.forEach((tool, index) => {
            console.log(`   ${index + 1}. ${tool.function.name}(${tool.function.arguments})`);
          });
        }
        
        if (hasToolUse) {
          console.log(`📋 工具使用详情:`);
          response.data.content.filter(c => c.type === 'tool_use').forEach((tool, index) => {
            console.log(`   ${index + 1}. ${tool.name}(${JSON.stringify(tool.input)})`);
          });
        }
        
      }
      
    } catch (error) {
      console.log(`❌ 请求失败: ${error.message}`);
      if (error.response) {
        console.log(`📊 状态码: ${error.response.status}`);
        console.log(`📋 响应数据: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
  }

  /**
   * 测试流式工具调用（也必须是tool_use）
   */
  async testStreamingToolCall() {
    console.log('\n🧪 测试3: 流式工具调用请求 (期望finish_reason: tool_use)');
    console.log('====================================================');
    
    const request = {
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: 'Get me the weather forecast for Tokyo and Paris.' }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather_forecast',
            description: 'Get weather forecast for a city',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string', description: 'The city name' },
                days: { type: 'number', description: 'Number of days', default: 3 }
              },
              required: ['city']
            }
          }
        }
      ],
      max_tokens: 1000,
      stream: true
    };

    try {
      console.log(`📡 发送流式请求...`);
      const startTime = Date.now();
      
      const response = await axios.post(`${this.baseUrl}/v1/chat/completions`, request, {
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': 'Bearer test-key',
          'Accept': 'text/event-stream'
        },
        responseType: 'stream',
        timeout: 30000
      });

      console.log(`✅ 流式连接建立: ${response.status}`);

      let buffer = '';
      let lastFinishReason = null;
      let toolCallDetected = false;

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data.trim() === '[DONE]') {
              const duration = Date.now() - startTime;
              console.log(`🏁 流式结束 (${duration}ms)`);
              console.log(`🎯 最终finish_reason: "${lastFinishReason}"`);
              
              if (toolCallDetected && lastFinishReason === 'tool_use') {
                console.log('✅ 流式finish_reason正确: 检测到工具调用，正确覆盖为tool_use');
              } else if (toolCallDetected && lastFinishReason !== 'tool_use') {
                console.log(`❌ 流式finish_reason错误: 检测到工具调用但finish_reason是 "${lastFinishReason}"，应该是"tool_use"`);
              } else {
                console.log(`ℹ️ 流式完成，工具调用检测: ${toolCallDetected}, finish_reason: ${lastFinishReason}`);
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              // 检查工具调用
              if (parsed.choices && parsed.choices[0]) {
                const choice = parsed.choices[0];
                
                if (choice.delta?.tool_calls) {
                  toolCallDetected = true;
                  console.log(`🔧 检测到工具调用: ${choice.delta.tool_calls.length} 个`);
                }
                
                if (choice.finish_reason) {
                  lastFinishReason = choice.finish_reason;
                  console.log(`🎯 finish_reason更新: "${choice.finish_reason}"`);
                }
              }
              
            } catch (parseError) {
              // 忽略解析错误
            }
          }
        }
      });

      response.data.on('error', (error) => {
        console.log(`❌ 流式错误: ${error.message}`);
      });

    } catch (error) {
      console.log(`❌ 流式请求失败: ${error.message}`);
    }
  }

  /**
   * 运行完整验证
   */
  async runValidation() {
    console.log('🚀 启动finish_reason验证测试');
    console.log('=================================\n');
    
    // 启动日志监控
    const logMonitor = this.startLogMonitor();
    
    try {
      // 等待一下让日志监控启动
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 测试1: 简单文本
      await this.testSimpleText();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 测试2: 工具调用
      await this.testToolCall();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 测试3: 流式工具调用
      await this.testStreamingToolCall();
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } finally {
      // 停止日志监控
      logMonitor.kill();
    }
    
    console.log('\n🎉 finish_reason验证测试完成！');
    console.log('关键检查点:');
    console.log('1. ✅ 简单文本请求应该返回 stop/end_turn');
    console.log('2. ✅ 工具调用请求必须返回 tool_use/tool_calls');  
    console.log('3. ✅ 流式工具调用也必须返回 tool_use');
    console.log('4. ✅ 不能吃掉任何响应内容');
  }
}

// 运行验证
if (require.main === module) {
  const validator = new FinishReasonValidator();
  validator.runValidation().catch(console.error);
}

module.exports = { FinishReasonValidator };