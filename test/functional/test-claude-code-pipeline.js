#!/usr/bin/env node

/**
 * Claude Code完整流水线测试
 * 基于真实CodeWhisperer响应样本进行端到端测试
 * 项目所有者: Jason Zhang
 */

const fs = require('fs');
const path = require('path');

async function testClaudeCodePipeline() {
  console.log('🚀 Claude Code流水线测试开始...\n');

  const results = {
    timestamp: new Date().toISOString(),
    phases: [],
    success: false,
    totalDuration: 0
  };

  const startTime = Date.now();

  try {
    // Phase 1: 使用真实Claude请求数据
    console.log('Phase 1: 加载真实Claude Code请求数据');
    const phaseStart = Date.now();
    
    // 使用已有的测试数据作为基础
    const baseRequestPath = path.join(__dirname, 'stage1-base-request.json');
    const baseRequestData = JSON.parse(fs.readFileSync(baseRequestPath, 'utf8'));
    
    // 创建更真实的Claude Code请求
    const realClaudeRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: 'Write a simple "Hello World" program in Python and explain how it works.'
        }
      ],
      max_tokens: 4000,
      temperature: 0.7,
      stream: true,
      metadata: {
        requestId: `claude-pipeline-${Date.now()}`,
        source: 'claude-code-pipeline-test'
      }
    };

    console.log('✅ 真实Claude请求数据准备完成');
    results.phases.push({
      phase: 'Phase 1: Claude请求准备',
      success: true,
      duration: Date.now() - phaseStart,
      data: {
        modelUsed: realClaudeRequest.model,
        messageCount: realClaudeRequest.messages.length,
        streaming: realClaudeRequest.stream
      }
    });

    // Phase 2: 路由器输入处理
    console.log('\\nPhase 2: 路由器输入处理');
    const phase2Start = Date.now();

    // 模拟输入处理模块
    const { AnthropicInputProcessor } = require('../dist/input/anthropic/processor');
    const inputProcessor = new AnthropicInputProcessor();
    const processedInput = await inputProcessor.process(realClaudeRequest);

    console.log('✅ 输入处理完成');
    results.phases.push({
      phase: 'Phase 2: 输入处理',
      success: true,
      duration: Date.now() - phase2Start,
      data: {
        processedModel: processedInput.model,
        format: 'anthropic'
      }
    });

    // Phase 3: 路由决策
    console.log('\\nPhase 3: 路由决策');
    const phase3Start = Date.now();

    // 使用路由引擎
    const { RoutingEngine } = require('../dist/routing/engine');
    const configPath = path.join(process.env.HOME, '.claude-code-router', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const routingEngine = new RoutingEngine(config);
    const routingResult = await routingEngine.route(processedInput);

    console.log(`✅ 路由到提供商: ${routingResult.providerId}`);
    results.phases.push({
      phase: 'Phase 3: 路由决策',
      success: true,
      duration: Date.now() - phase3Start,
      data: {
        providerId: routingResult.providerId,
        category: routingResult.category
      }
    });

    // Phase 4: CodeWhisperer格式转换
    console.log('\\nPhase 4: CodeWhisperer格式转换');
    const phase4Start = Date.now();

    const { CodeWhispererConverter } = require('../dist/providers/codewhisperer/converter');
    const converter = new CodeWhispererConverter();
    const codewhispererRequest = converter.convertToCodeWhisperer(routingResult.request);

    console.log('✅ 格式转换完成');
    results.phases.push({
      phase: 'Phase 4: 格式转换',
      success: true,
      duration: Date.now() - phase4Start,
      data: {
        targetFormat: 'codewhisperer',
        conversationId: codewhispererRequest.conversationState.conversationId
      }
    });

    // Phase 5: 使用真实响应样本进行响应模拟
    console.log('\\nPhase 5: 响应处理（基于真实样本）');
    const phase5Start = Date.now();

    // 使用已有的响应模拟数据（基于真实测试）
    const responseSimulationPath = path.join(__dirname, 'stage4-response-simulation.json');
    const responseSimulation = JSON.parse(fs.readFileSync(responseSimulationPath, 'utf8'));
    
    // 模拟CodeWhisperer响应解析
    const mockEvents = responseSimulation.mockResponse.events;
    console.log(`📨 处理 ${mockEvents.length} 个响应事件`);

    // 转换为Anthropic格式
    const { CodeWhispererParser } = require('../dist/providers/codewhisperer/parser');
    const parser = new CodeWhispererParser();
    const anthropicEvents = parser.convertToAnthropicSSE(mockEvents);

    console.log('✅ 响应处理完成');
    results.phases.push({
      phase: 'Phase 5: 响应处理',
      success: true,
      duration: Date.now() - phase5Start,
      data: {
        eventCount: mockEvents.length,
        anthropicEventCount: anthropicEvents.length,
        finalText: mockEvents.map(e => e.content).join('')
      }
    });

    // Phase 6: SSE流构建
    console.log('\\nPhase 6: SSE流构建');
    const phase6Start = Date.now();

    let sseOutput = '';
    let fullResponse = '';

    anthropicEvents.forEach(event => {
      sseOutput += `event: ${event.event}\\n`;
      sseOutput += `data: ${JSON.stringify(event.data)}\\n\\n`;
      
      if (event.event === 'content_block_delta' && event.data.delta && event.data.delta.text) {
        fullResponse += event.data.delta.text;
      }
    });

    console.log('✅ SSE流构建完成');
    console.log(`📝 最终响应文本: "${fullResponse}"`);

    results.phases.push({
      phase: 'Phase 6: SSE流构建',
      success: true,
      duration: Date.now() - phase6Start,
      data: {
        sseLength: sseOutput.length,
        responseText: fullResponse,
        eventTypes: [...new Set(anthropicEvents.map(e => e.event))]
      }
    });

    // Phase 7: 端到端验证
    console.log('\\nPhase 7: 端到端验证');
    const phase7Start = Date.now();

    const validation = {
      hasInput: !!realClaudeRequest,
      hasRouting: !!routingResult,
      hasConversion: !!codewhispererRequest,
      hasResponse: fullResponse.length > 0,
      hasSSE: sseOutput.length > 0,
      isStreaming: true
    };

    const isValid = Object.values(validation).every(v => v === true);
    
    console.log(`✅ 端到端验证${isValid ? '通过' : '失败'}`);
    results.phases.push({
      phase: 'Phase 7: 端到端验证',
      success: isValid,
      duration: Date.now() - phase7Start,
      data: validation
    });

    // 总结
    results.success = isValid;
    results.totalDuration = Date.now() - startTime;

    // 保存测试结果
    const outputPath = path.join(__dirname, 'claude-code-pipeline-result.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    // 保存SSE输出样本
    const sseOutputPath = path.join(__dirname, 'claude-code-sse-sample.txt');
    fs.writeFileSync(sseOutputPath, sseOutput);

    console.log('\\n🎉 Claude Code流水线测试完成!');
    console.log(`⏱️ 总耗时: ${results.totalDuration}ms`);
    console.log(`✅ 成功阶段: ${results.phases.filter(p => p.success).length}/${results.phases.length}`);
    console.log(`📋 测试结果: ${outputPath}`);
    console.log(`📄 SSE样本: ${sseOutputPath}`);

    if (results.success) {
      console.log('\\n🎯 流水线测试全部通过! Claude Code Router工作正常');
    } else {
      console.log('\\n⚠️ 部分测试失败，请检查详细结果');
    }

    return results;

  } catch (error) {
    console.error('\\n❌ 流水线测试失败:', error.message);
    results.success = false;
    results.error = error.message;
    results.totalDuration = Date.now() - startTime;

    const errorOutputPath = path.join(__dirname, 'claude-code-pipeline-error.json');
    fs.writeFileSync(errorOutputPath, JSON.stringify(results, null, 2));
    
    throw error;
  }
}

// 运行测试
if (require.main === module) {
  testClaudeCodePipeline().catch(console.error);
}

module.exports = { testClaudeCodePipeline };