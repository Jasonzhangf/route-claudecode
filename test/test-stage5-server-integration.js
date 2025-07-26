#!/usr/bin/env node
/**
 * Stage 5: 服务器集成测试
 * 模拟完整的服务器响应流程，从SSE事件到最终客户端输出
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Stage 5: 服务器集成测试');
console.log('===========================\n');

// 读取Stage 4的输出
const stage4OutputPath = path.join(__dirname, 'stage4-response-simulation.json');

if (!fs.existsSync(stage4OutputPath)) {
  console.error('❌ 找不到Stage 4的输出文件');
  console.log('💡 请先运行 test-stage4-response-simulation.js');
  process.exit(1);
}

const simulationResult = JSON.parse(fs.readFileSync(stage4OutputPath, 'utf8'));

console.log('📋 输入的模拟结果:');
console.log(`   请求模型: ${simulationResult.request.model}`);
console.log(`   响应文本: "${simulationResult.anthropicResponse.responseText}"`);
console.log(`   事件数量: ${simulationResult.anthropicResponse.events.length}`);
console.log(`   响应有效: ${simulationResult.validation.isValid}`);

// 模拟SSE流输出格式
function formatSSEEvents(events) {
  console.log('\n📡 格式化SSE流输出:');
  
  const sseOutput = [];
  
  events.forEach((event, index) => {
    const eventLine = `event: ${event.event}`;
    const dataLine = `data: ${JSON.stringify(event.data)}`;
    const emptyLine = '';
    
    sseOutput.push(eventLine);
    sseOutput.push(dataLine);
    sseOutput.push(emptyLine);
    
    console.log(`   事件 ${index + 1}: ${event.event} (${JSON.stringify(event.data).length} 字节)`);
  });
  
  const fullSSE = sseOutput.join('\n');
  console.log(`   总SSE输出: ${fullSSE.length} 字节`);
  
  return fullSSE;
}

// 模拟Claude Code客户端解析
function simulateClientParsing(sseOutput) {
  console.log('\n🖥️  模拟Claude Code客户端解析:');
  
  const lines = sseOutput.split('\n');
  const parsedEvents = [];
  
  let currentEvent = null;
  let currentData = null;
  
  lines.forEach((line, index) => {
    if (line.startsWith('event: ')) {
      currentEvent = line.substring(7);
    } else if (line.startsWith('data: ')) {
      currentData = line.substring(6);
    } else if (line === '' && currentEvent && currentData) {
      // 完整事件
      try {
        const data = JSON.parse(currentData);
        parsedEvents.push({
          event: currentEvent,
          data: data
        });
        console.log(`   解析事件: ${currentEvent}`);
      } catch (error) {
        console.log(`   ❌ 解析错误: ${error.message}`);
      }
      
      currentEvent = null;
      currentData = null;
    }
  });
  
  console.log(`   总共解析 ${parsedEvents.length} 个事件`);
  return parsedEvents;
}

// 提取最终文本内容
function extractFinalText(events) {
  console.log('\n📝 提取最终文本内容:');
  
  let finalText = '';
  let messageInfo = {
    id: null,
    model: null,
    role: null,
    stopReason: null,
    usage: null
  };
  
  events.forEach(event => {
    switch (event.event) {
      case 'message_start':
        if (event.data && event.data.message) {
          messageInfo.id = event.data.message.id;
          messageInfo.model = event.data.message.model;
          messageInfo.role = event.data.message.role;
          console.log(`   消息开始: ID=${messageInfo.id}, Model=${messageInfo.model}`);
        }
        break;
        
      case 'content_block_delta':
        if (event.data && event.data.delta && event.data.delta.text) {
          finalText += event.data.delta.text;
          console.log(`   文本块: "${event.data.delta.text}"`);
        }
        break;
        
      case 'message_delta':
        if (event.data && event.data.delta) {
          messageInfo.stopReason = event.data.delta.stop_reason;
          if (event.data.usage) {
            messageInfo.usage = event.data.usage;
          }
        }
        break;
        
      case 'message_stop':
        console.log(`   消息结束: 停止原因=${messageInfo.stopReason}`);
        break;
    }
  });
  
  console.log(`   最终文本: "${finalText}"`);
  console.log(`   文本长度: ${finalText.length} 字符`);
  
  return {
    text: finalText,
    messageInfo: messageInfo
  };
}

// 构建最终响应格式（非流式）
function buildFinalResponse(extractedContent, originalRequest) {
  console.log('\n🏗️  构建最终响应格式:');
  
  const response = {
    id: extractedContent.messageInfo.id || `msg_${Date.now()}`,
    type: "message",
    role: "assistant",
    content: [
      {
        type: "text",
        text: extractedContent.text
      }
    ],
    model: originalRequest.model,
    stop_reason: extractedContent.messageInfo.stopReason || "end_turn",
    stop_sequence: null,
    usage: extractedContent.messageInfo.usage || {
      input_tokens: Math.ceil(originalRequest.messages[0].content.length / 4),
      output_tokens: Math.ceil(extractedContent.text.length / 4)
    }
  };
  
  console.log(`   响应ID: ${response.id}`);
  console.log(`   响应模型: ${response.model}`);
  console.log(`   内容长度: ${response.content[0].text.length}`);
  console.log(`   停止原因: ${response.stop_reason}`);
  console.log(`   使用情况: ${response.usage.input_tokens} -> ${response.usage.output_tokens} tokens`);
  
  return response;
}

// 验证端到端流程
function validateE2EFlow(originalRequest, finalResponse) {
  console.log('\n🔍 验证端到端流程:');
  
  const checks = [];
  
  // 检查模型一致性
  const modelMatch = originalRequest.model === finalResponse.model;
  checks.push({ name: '模型一致性', passed: modelMatch, details: `${originalRequest.model} vs ${finalResponse.model}` });
  
  // 检查响应内容存在
  const hasContent = finalResponse.content && finalResponse.content.length > 0 && finalResponse.content[0].text.length > 0;
  checks.push({ name: '响应内容存在', passed: hasContent, details: `${finalResponse.content?.[0]?.text?.length || 0} 字符` });
  
  // 检查响应格式
  const validFormat = finalResponse.id && finalResponse.type === 'message' && finalResponse.role === 'assistant';
  checks.push({ name: '响应格式正确', passed: validFormat, details: `ID=${!!finalResponse.id}, Type=${finalResponse.type}, Role=${finalResponse.role}` });
  
  // 检查使用统计
  const hasUsage = finalResponse.usage && finalResponse.usage.input_tokens > 0 && finalResponse.usage.output_tokens > 0;
  checks.push({ name: '使用统计完整', passed: hasUsage, details: `${finalResponse.usage?.input_tokens || 0} -> ${finalResponse.usage?.output_tokens || 0}` });
  
  // 检查停止原因
  const validStopReason = finalResponse.stop_reason && ['end_turn', 'tool_use', 'max_tokens'].includes(finalResponse.stop_reason);
  checks.push({ name: '停止原因有效', passed: validStopReason, details: finalResponse.stop_reason });
  
  console.log('   检查结果:');
  checks.forEach(check => {
    const status = check.passed ? '✅' : '❌';
    console.log(`     ${status} ${check.name}: ${check.details}`);
  });
  
  const allPassed = checks.every(check => check.passed);
  console.log(`\n   总体结果: ${allPassed ? '✅ 通过' : '❌ 失败'}`);
  
  return { checks, allPassed };
}

// 执行完整的服务器集成测试
console.log('\n🚀 执行完整服务器集成测试:');

try {
  // 1. 格式化SSE输出
  const sseOutput = formatSSEEvents(simulationResult.anthropicResponse.events);
  
  // 2. 模拟客户端解析
  const clientEvents = simulateClientParsing(sseOutput);
  
  // 3. 提取最终内容
  const extractedContent = extractFinalText(clientEvents);
  
  // 4. 构建最终响应
  const finalResponse = buildFinalResponse(extractedContent, simulationResult.request);
  
  // 5. 验证端到端流程
  const validation = validateE2EFlow(simulationResult.request, finalResponse);
  
  console.log('\n📊 集成测试总结:');
  console.log(`   原始请求模型: ${simulationResult.request.model}`);
  console.log(`   CodeWhisperer模型: ${simulationResult.codewhispererRequest.conversationState.currentMessage.userInputMessage.modelId}`);
  console.log(`   响应事件数: ${simulationResult.anthropicResponse.events.length}`);
  console.log(`   SSE输出大小: ${sseOutput.length} 字节`);
  console.log(`   客户端解析事件: ${clientEvents.length}`);
  console.log(`   最终响应文本: "${extractedContent.text}"`);
  console.log(`   端到端验证: ${validation.allPassed ? '✅ 通过' : '❌ 失败'}`);
  
  // 构建完整结果
  const result = {
    originalRequest: simulationResult.request,
    codewhispererRequest: simulationResult.codewhispererRequest,
    responseProcessing: {
      anthropicEvents: simulationResult.anthropicResponse.events.length,
      sseOutput: sseOutput,
      sseSize: sseOutput.length,
      clientEvents: clientEvents.length,
      extractedText: extractedContent.text,
      finalResponse: finalResponse
    },
    validation: validation,
    performance: {
      originalRequestSize: JSON.stringify(simulationResult.request).length,
      codewhispererRequestSize: JSON.stringify(simulationResult.codewhispererRequest).length,
      responseSize: JSON.stringify(finalResponse).length,
      compressionRatio: JSON.stringify(finalResponse).length / sseOutput.length
    },
    timestamp: new Date().toISOString()
  };
  
  // 保存结果
  const outputPath = path.join(__dirname, 'stage5-server-integration.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  
  // 保存SSE输出样本
  const sseOutputPath = path.join(__dirname, 'stage5-sse-output.txt');
  fs.writeFileSync(sseOutputPath, sseOutput);
  
  // 保存最终响应
  const responsePath = path.join(__dirname, 'stage5-final-response.json');
  fs.writeFileSync(responsePath, JSON.stringify(finalResponse, null, 2));
  
  console.log(`\n✅ Stage 5 完成！结果已保存到: ${outputPath}`);
  console.log(`📁 SSE输出已保存到: ${sseOutputPath}`);
  console.log(`📁 最终响应已保存到: ${responsePath}`);
  
  if (validation.allPassed) {
    console.log('\n🎉 所有阶段测试通过！整个路由器流水线工作正常。');
  } else {
    console.log('\n⚠️  部分检查失败，需要进一步调试。');
  }
  
  console.log('\n💡 现在可以运行所有阶段: node test-all-stages.js');
  
} catch (error) {
  console.error('\n❌ 服务器集成测试过程中发生错误:', error.message);
  console.error('📚 错误堆栈:', error.stack);
  process.exit(1);
}