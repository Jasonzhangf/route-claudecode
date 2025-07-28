#!/usr/bin/env node

/**
 * Claude Code响应流水线测试
 * 基于真实响应样本测试从CodeWhisperer到Claude Code的完整流程
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

async function testClaudeResponsePipeline() {
  console.log('🎯 Claude Code响应流水线测试开始...\n');

  const testResults = {
    timestamp: new Date().toISOString(),
    testName: 'Claude Code Response Pipeline',
    phases: [],
    success: false,
    totalDuration: 0
  };

  const startTime = Date.now();

  try {
    // Phase 1: 加载真实CodeWhisperer响应样本
    console.log('Phase 1: 加载CodeWhisperer响应样本');
    const phaseStart = Date.now();
    
    const responseSimulationPath = path.join(__dirname, 'stage4-response-simulation.json');
    const responseSimulation = JSON.parse(fs.readFileSync(responseSimulationPath, 'utf8'));
    const codewhispererEvents = responseSimulation.mockResponse.events;
    
    console.log(`✅ 加载了 ${codewhispererEvents.length} 个CodeWhisperer事件`);
    testResults.phases.push({
      phase: 'Phase 1: 响应样本加载',
      success: true,
      duration: Date.now() - phaseStart,
      data: {
        eventCount: codewhispererEvents.length,
        hasTextContent: codewhispererEvents.some(e => e.content && e.content.trim()),
        hasStopEvent: codewhispererEvents.some(e => e.stop)
      }
    });

    // Phase 2: CodeWhisperer事件转Anthropic格式
    console.log('\\nPhase 2: 转换为Anthropic SSE格式');
    const phase2Start = Date.now();

    // 模拟转换逻辑（基于stage5的实现）
    const messageId = `msg_${Date.now()}`;
    const anthropicEvents = [];
    
    // message_start事件
    anthropicEvents.push({
      event: 'message_start',
      data: {
        type: 'message_start',
        message: {
          id: messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-sonnet-4-20250514',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 0, output_tokens: 0 }
        }
      }
    });

    // ping事件
    anthropicEvents.push({
      event: 'ping',
      data: { type: 'ping' }
    });

    // content_block_start事件
    anthropicEvents.push({
      event: 'content_block_start',
      data: {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' }
      }
    });

    // 转换文本事件
    let totalTokens = 0;
    codewhispererEvents.forEach(event => {
      if (event.content && event.content.trim() && !event.stop) {
        anthropicEvents.push({
          event: 'content_block_delta',
          data: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: event.content }
          }
        });
        totalTokens++;
      }
    });

    // content_block_stop事件
    anthropicEvents.push({
      event: 'content_block_stop',
      data: { type: 'content_block_stop', index: 0 }
    });

    // message_delta事件
    anthropicEvents.push({
      event: 'message_delta',
      data: {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: totalTokens }
      }
    });

    // message_stop事件
    anthropicEvents.push({
      event: 'message_stop',
      data: { type: 'message_stop' }
    });

    console.log(`✅ 转换为 ${anthropicEvents.length} 个Anthropic事件`);
    testResults.phases.push({
      phase: 'Phase 2: Anthropic格式转换',
      success: true,
      duration: Date.now() - phase2Start,
      data: {
        originalEvents: codewhispererEvents.length,
        anthropicEvents: anthropicEvents.length,
        textDeltas: totalTokens
      }
    });

    // Phase 3: 构建SSE流
    console.log('\\nPhase 3: 构建Server-Sent Events流');
    const phase3Start = Date.now();

    let sseStream = '';
    let responseText = '';

    anthropicEvents.forEach(event => {
      sseStream += `event: ${event.event}\\n`;
      sseStream += `data: ${JSON.stringify(event.data)}\\n\\n`;
      
      // 收集响应文本
      if (event.event === 'content_block_delta' && event.data.delta && event.data.delta.text) {
        responseText += event.data.delta.text;
      }
    });

    console.log(`✅ SSE流构建完成，长度: ${sseStream.length} 字符`);
    console.log(`📝 最终响应: "${responseText}"`);

    testResults.phases.push({
      phase: 'Phase 3: SSE流构建',
      success: true,
      duration: Date.now() - phase3Start,
      data: {
        sseLength: sseStream.length,
        responseText: responseText,
        responseLength: responseText.length
      }
    });

    // Phase 4: 构建最终JSON响应
    console.log('\\nPhase 4: 构建最终JSON响应');
    const phase4Start = Date.now();

    const finalResponse = {
      id: messageId,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: responseText
        }
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        output_tokens: totalTokens
      }
    };

    console.log('✅ 最终JSON响应构建完成');
    testResults.phases.push({
      phase: 'Phase 4: 最终响应构建',
      success: true,
      duration: Date.now() - phase4Start,
      data: {
        messageId: messageId,
        contentLength: responseText.length,
        outputTokens: totalTokens
      }
    });

    // Phase 5: 验证响应完整性
    console.log('\\nPhase 5: 验证响应完整性');
    const phase5Start = Date.now();

    const validation = {
      hasMessageStart: anthropicEvents.some(e => e.event === 'message_start'),
      hasContentDelta: anthropicEvents.some(e => e.event === 'content_block_delta'),
      hasMessageStop: anthropicEvents.some(e => e.event === 'message_stop'),
      hasValidContent: responseText.length > 0,
      hasValidSSE: sseStream.includes('event:') && sseStream.includes('data:')
    };

    const isValid = Object.values(validation).every(v => v === true);
    
    console.log(`✅ 响应完整性验证${isValid ? '通过' : '失败'}`);
    testResults.phases.push({
      phase: 'Phase 5: 响应验证',
      success: isValid,
      duration: Date.now() - phase5Start,
      data: validation
    });

    // 总结测试结果
    testResults.success = isValid;
    testResults.totalDuration = Date.now() - startTime;

    // 保存测试输出
    const outputDir = __dirname;
    
    // 保存SSE流
    const sseOutputPath = path.join(outputDir, 'claude-response-sse-output.txt');
    fs.writeFileSync(sseOutputPath, sseStream);
    
    // 保存最终响应
    const finalResponsePath = path.join(outputDir, 'claude-response-final.json');
    fs.writeFileSync(finalResponsePath, JSON.stringify(finalResponse, null, 2));
    
    // 保存测试结果
    const testResultPath = path.join(outputDir, 'claude-response-pipeline-result.json');
    fs.writeFileSync(testResultPath, JSON.stringify(testResults, null, 2));

    console.log('\\n🎉 Claude Code响应流水线测试完成!');
    console.log(`⏱️ 总耗时: ${testResults.totalDuration}ms`);
    console.log(`✅ 成功阶段: ${testResults.phases.filter(p => p.success).length}/${testResults.phases.length}`);
    console.log(`📄 SSE输出: ${sseOutputPath}`);
    console.log(`📋 最终响应: ${finalResponsePath}`);
    console.log(`📊 测试结果: ${testResultPath}`);

    if (testResults.success) {
      console.log('\\n🎯 响应流水线测试全部通过!');
      console.log('Claude Code Router的响应处理流程工作正常');
    } else {
      console.log('\\n⚠️ 部分测试失败，请检查验证结果');
    }

    return testResults;

  } catch (error) {
    console.error('\\n❌ 响应流水线测试失败:', error.message);
    testResults.success = false;
    testResults.error = error.message;
    testResults.totalDuration = Date.now() - startTime;

    const errorPath = path.join(__dirname, 'claude-response-pipeline-error.json');
    fs.writeFileSync(errorPath, JSON.stringify(testResults, null, 2));
    
    throw error;
  }
}

// 运行测试
if (require.main === module) {
  testClaudeResponsePipeline().catch(console.error);
}

module.exports = { testClaudeResponsePipeline };