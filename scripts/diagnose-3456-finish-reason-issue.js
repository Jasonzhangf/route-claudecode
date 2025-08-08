#!/usr/bin/env node

/**
 * 诊断3456端口finish reason没有更新和会话停止的问题
 * 
 * 检查点：
 * 1. 预处理器是否正确检测工具调用
 * 2. finish_reason是否被正确修复
 * 3. hasToolUse变量是否被正确设置
 * 4. message_stop事件是否被正确处理
 */

const axios = require('axios');

const TEST_CONFIG = {
  baseURL: 'http://localhost:3456',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream'
  }
};

const TEST_REQUEST = {
  model: 'claude-sonnet-4-20250514',
  messages: [
    {
      role: 'user',
      content: '请帮我读取项目根目录的README.md文件内容。'
    }
  ],
  tools: [
    {
      name: 'Read',
      description: 'Read and return the contents of a file',
      input_schema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The path to the file to read'
          }
        },
        required: ['file_path']
      }
    }
  ],
  stream: true
};

async function diagnose3456Issue() {
  console.log('🔍 诊断3456端口finish reason和会话停止问题...\n');

  try {
    const response = await axios.post('/v1/messages', TEST_REQUEST, {
      ...TEST_CONFIG,
      responseType: 'stream'
    });

    console.log(`📡 响应状态: ${response.status}`);
    console.log(`📋 响应头: ${JSON.stringify(response.headers, null, 2)}\n`);

    let eventCount = 0;
    let hasToolCallDetection = false;
    let hasFinishReasonUpdate = false;
    let hasToolUseStopReason = false;
    let hasMessageStop = false;
    let toolCallEvents = [];
    let finishReasonEvents = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('\n⏰ 测试超时 (30秒)');
        resolve({
          success: false,
          reason: 'timeout',
          eventCount,
          hasToolCallDetection,
          hasFinishReasonUpdate,
          hasToolUseStopReason,
          hasMessageStop
        });
      }, 30000);

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              eventCount++;
              
              console.log(`📨 事件 ${eventCount}: ${data.event}`);
              
              // 检查工具调用检测
              if (data.event === 'content_block_start' && data.data?.content_block?.type === 'tool_use') {
                hasToolCallDetection = true;
                toolCallEvents.push({
                  event: eventCount,
                  toolName: data.data.content_block.name,
                  toolId: data.data.content_block.id
                });
                console.log(`   🔧 工具调用检测: ${data.data.content_block.name}`);
              }
              
              // 检查finish reason更新
              if (data.event === 'message_delta' && data.data?.delta?.stop_reason) {
                const stopReason = data.data.delta.stop_reason;
                finishReasonEvents.push({
                  event: eventCount,
                  stopReason: stopReason
                });
                
                console.log(`   🎯 收到stop_reason: ${stopReason}`);
                
                if (stopReason === 'tool_use') {
                  hasToolUseStopReason = true;
                  hasFinishReasonUpdate = true;
                  console.log(`   ✅ finish_reason已正确更新为tool_use`);
                } else {
                  console.log(`   ❌ finish_reason未更新为tool_use，当前值: ${stopReason}`);
                }
              }
              
              // 检查message_stop事件
              if (data.event === 'message_stop') {
                hasMessageStop = true;
                console.log(`   🏁 收到message_stop事件`);
                
                if (hasToolUseStopReason) {
                  console.log(`   ❌ 错误：工具调用场景下不应该收到message_stop事件`);
                } else {
                  console.log(`   ✅ 非工具调用场景，正常收到message_stop事件`);
                }
              }
              
              // 显示事件详情
              if (data.data) {
                const summary = {};
                if (data.data.delta) summary.delta = data.data.delta;
                if (data.data.content_block) summary.content_block = data.data.content_block;
                if (data.data.type) summary.type = data.data.type;
                
                if (Object.keys(summary).length > 0) {
                  console.log(`   📄 数据: ${JSON.stringify(summary, null, 2)}`);
                }
              }
              
              console.log('');
              
            } catch (error) {
              console.log(`   ❌ 解析事件失败: ${line}`);
            }
          }
        }
      });

      response.data.on('end', () => {
        clearTimeout(timeout);
        console.log('\n📊 诊断结果汇总:');
        console.log('================================================================================');
        console.log(`⏱️ 总事件数: ${eventCount}`);
        console.log(`🔧 工具调用检测: ${hasToolCallDetection ? '✅ 通过' : '❌ 失败'}`);
        console.log(`🎯 finish_reason更新: ${hasFinishReasonUpdate ? '✅ 通过' : '❌ 失败'}`);
        console.log(`🛑 tool_use stop_reason: ${hasToolUseStopReason ? '✅ 收到' : '❌ 未收到'}`);
        console.log(`🏁 message_stop事件: ${hasMessageStop ? '❌ 收到(不应该)' : '✅ 未收到(正确)'}`);
        
        console.log('\n🔍 详细分析:');
        
        if (toolCallEvents.length > 0) {
          console.log(`📋 工具调用事件 (${toolCallEvents.length}个):`);
          toolCallEvents.forEach(event => {
            console.log(`   • 事件${event.event}: ${event.toolName} (ID: ${event.toolId})`);
          });
        } else {
          console.log('❌ 未检测到工具调用事件');
        }
        
        if (finishReasonEvents.length > 0) {
          console.log(`📋 finish_reason事件 (${finishReasonEvents.length}个):`);
          finishReasonEvents.forEach(event => {
            console.log(`   • 事件${event.event}: ${event.stopReason}`);
          });
        } else {
          console.log('❌ 未收到finish_reason事件');
        }
        
        // 问题诊断
        console.log('\n🩺 问题诊断:');
        
        if (!hasToolCallDetection) {
          console.log('❌ 问题1: 工具调用未被检测到');
          console.log('   可能原因: 请求格式不正确或工具定义有问题');
        }
        
        if (!hasFinishReasonUpdate) {
          console.log('❌ 问题2: finish_reason未被更新为tool_use');
          console.log('   可能原因: 预处理器未正确工作或工具调用检测失败');
        }
        
        if (hasMessageStop && hasToolUseStopReason) {
          console.log('❌ 问题3: 工具调用场景下错误收到message_stop事件');
          console.log('   可能原因: hasToolUse变量未被正确设置');
        }
        
        if (!hasMessageStop && !hasToolUseStopReason) {
          console.log('❌ 问题4: 既没有tool_use也没有message_stop');
          console.log('   可能原因: 响应流程异常或提前终止');
        }
        
        // 修复建议
        console.log('\n🔧 修复建议:');
        
        if (!hasToolCallDetection) {
          console.log('1. 检查工具定义格式是否正确');
          console.log('2. 验证模型是否支持工具调用');
          console.log('3. 检查请求路由是否正确');
        }
        
        if (!hasFinishReasonUpdate) {
          console.log('1. 检查预处理器是否启用');
          console.log('2. 验证工具调用检测逻辑');
          console.log('3. 检查finish_reason映射逻辑');
        }
        
        if (hasMessageStop && hasToolUseStopReason) {
          console.log('1. 检查服务器中hasToolUse变量的设置逻辑');
          console.log('2. 验证message_stop事件的过滤逻辑');
          console.log('3. 确保工具调用检测结果正确传递');
        }
        
        const success = hasToolCallDetection && hasFinishReasonUpdate && hasToolUseStopReason && !hasMessageStop;
        
        console.log(`\n🎯 总体状态: ${success ? '✅ 正常' : '❌ 有问题'}`);
        
        resolve({
          success,
          eventCount,
          hasToolCallDetection,
          hasFinishReasonUpdate,
          hasToolUseStopReason,
          hasMessageStop,
          toolCallEvents,
          finishReasonEvents
        });
      });

      response.data.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ 流式响应错误:', error.message);
        reject(error);
      });
    });

  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    
    if (error.response) {
      console.error(`📡 响应状态: ${error.response.status}`);
      console.error(`📋 响应数据: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 运行诊断
diagnose3456Issue()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 诊断完成：系统工作正常！');
      process.exit(0);
    } else {
      console.log('\n⚠️ 诊断完成：发现问题需要修复');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 诊断过程出错:', error.message);
    process.exit(1);
  });