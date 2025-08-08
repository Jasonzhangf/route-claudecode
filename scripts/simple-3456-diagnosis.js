#!/usr/bin/env node

/**
 * 简单诊断3456端口的问题
 * 重点检查：预处理器调用、工具检测、finish_reason更新
 */

const axios = require('axios');

async function simpleDiagnosis() {
  console.log('🔍 简单诊断3456端口问题...\n');

  const testRequest = {
    model: 'claude-sonnet-4-20250514',
    messages: [
      {
        role: 'user',
        content: '请帮我读取README.md文件的内容。'
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

  try {
    console.log('📡 发送请求到 http://localhost:3456/v1/messages');
    console.log('📋 请求内容:', JSON.stringify(testRequest, null, 2));
    console.log('\n⏳ 等待响应...\n');

    const response = await axios.post('http://localhost:3456/v1/messages', testRequest, {
      responseType: 'stream',
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      }
    });

    console.log(`📡 响应状态: ${response.status}`);
    console.log(`📋 响应头: Content-Type = ${response.headers['content-type']}\n`);

    let eventCount = 0;
    let toolCallDetected = false;
    let finishReasonUpdated = false;
    let messageStopReceived = false;
    let lastStopReason = null;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('\n⏰ 诊断超时 (20秒)');
        console.log('\n📊 诊断结果:');
        console.log(`   事件数: ${eventCount}`);
        console.log(`   工具调用检测: ${toolCallDetected ? '✅' : '❌'}`);
        console.log(`   finish_reason更新: ${finishReasonUpdated ? '✅' : '❌'}`);
        console.log(`   message_stop接收: ${messageStopReceived ? '❌ (不应该)' : '✅ (正确)'}`);
        console.log(`   最后stop_reason: ${lastStopReason}`);
        
        resolve({
          timeout: true,
          eventCount,
          toolCallDetected,
          finishReasonUpdated,
          messageStopReceived,
          lastStopReason
        });
      }, 20000);

      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              eventCount++;
              
              console.log(`📨 [${eventCount}] ${data.event}`);
              
              // 检查工具调用检测
              if (data.event === 'content_block_start' && 
                  data.data?.content_block?.type === 'tool_use') {
                toolCallDetected = true;
                console.log(`   🔧 工具调用: ${data.data.content_block.name}`);
                console.log(`   🆔 工具ID: ${data.data.content_block.id}`);
              }
              
              // 检查finish_reason更新
              if (data.event === 'message_delta' && 
                  data.data?.delta?.stop_reason) {
                lastStopReason = data.data.delta.stop_reason;
                console.log(`   🎯 stop_reason: ${lastStopReason}`);
                
                if (lastStopReason === 'tool_use') {
                  finishReasonUpdated = true;
                  console.log(`   ✅ finish_reason已更新为tool_use`);
                } else {
                  console.log(`   ❌ finish_reason未更新为tool_use`);
                }
              }
              
              // 检查message_stop
              if (data.event === 'message_stop') {
                messageStopReceived = true;
                console.log(`   🏁 收到message_stop事件`);
                
                if (toolCallDetected) {
                  console.log(`   ❌ 错误：工具调用场景不应收到message_stop`);
                } else {
                  console.log(`   ✅ 正常：非工具调用场景收到message_stop`);
                }
              }
              
              // 显示重要数据
              if (data.data) {
                if (data.data.delta && Object.keys(data.data.delta).length > 0) {
                  console.log(`   📄 delta: ${JSON.stringify(data.data.delta)}`);
                }
                if (data.data.content_block) {
                  const block = data.data.content_block;
                  if (block.type === 'tool_use') {
                    console.log(`   📄 tool_use: ${block.name}`);
                  }
                }
              }
              
            } catch (error) {
              console.log(`   ❌ 解析失败: ${line.slice(0, 100)}...`);
            }
          }
        }
      });

      response.data.on('end', () => {
        clearTimeout(timeout);
        
        console.log('\n📊 最终诊断结果:');
        console.log('================================================================================');
        console.log(`⏱️ 总事件数: ${eventCount}`);
        console.log(`🔧 工具调用检测: ${toolCallDetected ? '✅ 成功' : '❌ 失败'}`);
        console.log(`🎯 finish_reason更新: ${finishReasonUpdated ? '✅ 成功' : '❌ 失败'}`);
        console.log(`🏁 message_stop接收: ${messageStopReceived ? '❌ 错误接收' : '✅ 正确未接收'}`);
        console.log(`📋 最后stop_reason: ${lastStopReason || '无'}`);
        
        // 问题分析
        console.log('\n🩺 问题分析:');
        
        if (!toolCallDetected) {
          console.log('❌ 问题1: 工具调用未被检测到');
          console.log('   - 可能原因: 请求格式问题、路由问题、或Provider不支持工具调用');
          console.log('   - 建议: 检查请求路由和Provider配置');
        }
        
        if (toolCallDetected && !finishReasonUpdated) {
          console.log('❌ 问题2: 工具调用检测到但finish_reason未更新');
          console.log('   - 可能原因: 预处理器未正确工作或finish_reason覆盖逻辑有问题');
          console.log('   - 建议: 检查预处理器配置和工具调用检测逻辑');
        }
        
        if (toolCallDetected && finishReasonUpdated && messageStopReceived) {
          console.log('❌ 问题3: 工具调用场景下错误收到message_stop');
          console.log('   - 可能原因: 服务器中hasToolUse变量未正确设置');
          console.log('   - 建议: 检查服务器中的hasToolUse检测和message_stop过滤逻辑');
        }
        
        if (!toolCallDetected && !finishReasonUpdated && !messageStopReceived) {
          console.log('❌ 问题4: 完全没有响应或响应异常');
          console.log('   - 可能原因: 服务器错误、网络问题、或请求被拒绝');
          console.log('   - 建议: 检查服务器日志和网络连接');
        }
        
        const success = toolCallDetected && finishReasonUpdated && !messageStopReceived;
        
        console.log(`\n🎯 总体状态: ${success ? '✅ 正常' : '❌ 有问题'}`);
        
        if (success) {
          console.log('🎉 3456端口工具调用功能正常！');
        } else {
          console.log('⚠️ 3456端口工具调用功能存在问题，需要修复');
        }
        
        resolve({
          success,
          eventCount,
          toolCallDetected,
          finishReasonUpdated,
          messageStopReceived,
          lastStopReason
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
      console.error(`📋 响应数据:`, error.response.data);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 连接被拒绝 - 请确保3456端口的服务器正在运行');
    }
    
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

// 运行诊断
simpleDiagnosis()
  .then(result => {
    if (result.success) {
      console.log('\n✅ 诊断完成：功能正常');
      process.exit(0);
    } else {
      console.log('\n❌ 诊断完成：发现问题');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 诊断失败:', error.message);
    process.exit(1);
  });