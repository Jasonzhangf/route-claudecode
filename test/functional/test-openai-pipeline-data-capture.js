#!/usr/bin/env node
/**
 * OpenAI流水线数据捕获系统
 * 实现完整6步流水线的非侵入式数据捕获和保存
 * Project: Claude Code Router Enhanced
 * Author: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class OpenAIDataCaptureSystem {
  constructor() {
    this.captureDir = '/tmp/openai-pipeline-captures';
    this.sessionId = `capture-${Date.now()}`;
    this.hooks = {
      step1: null, // Input processing
      step2: null, // Routing
      step3: null, // Transformation
      step4: null, // Raw API response  
      step5: null, // Transformer input
      step6: null  // Transformer output
    };
    this.capturedData = {};
  }

  /**
   * 初始化捕获目录
   */
  async initialize() {
    try {
      await fs.mkdir(this.captureDir, { recursive: true });
      console.log(`✅ Data capture system initialized: ${this.captureDir}`);
      console.log(`📋 Session ID: ${this.sessionId}`);
    } catch (error) {
      console.error('❌ Failed to initialize capture directory:', error);
      throw error;
    }
  }

  /**
   * Step 1: 捕获原始Anthropic输入请求
   */
  async captureStep1Input(request) {
    console.log('\n🔍 [STEP 1] Capturing input processing data...');
    
    const step1Data = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      step: 'input_processing',
      originalRequest: {
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature,
        metadata: request.metadata,
        stream: request.stream
      },
      tokenCount: this.estimateTokenCount(request.messages),
      hasTools: !!(request.metadata?.tools && request.metadata.tools.length > 0),
      toolCount: request.metadata?.tools?.length || 0
    };

    await this.saveCapture('step1-input-processing', step1Data);
    this.capturedData.step1 = step1Data;
    
    console.log(`   ✓ Model: ${request.model}`);
    console.log(`   ✓ Messages: ${request.messages.length}`);
    console.log(`   ✓ Tokens: ~${step1Data.tokenCount}`);
    console.log(`   ✓ Tools: ${step1Data.toolCount}`);
    
    return step1Data;
  }

  /**
   * Step 2: 捕获路由决策数据
   */
  async captureStep2Routing(routingResult) {
    console.log('\n🔍 [STEP 2] Capturing routing decision data...');
    
    const step2Data = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      step: 'routing',
      category: routingResult.category,
      selectedProvider: routingResult.provider,
      targetModel: routingResult.targetModel,
      originalModel: routingResult.originalModel,
      routingReason: routingResult.reason,
      modelMapping: {
        from: routingResult.originalModel,
        to: routingResult.targetModel,
        via: routingResult.provider
      }
    };

    await this.saveCapture('step2-routing', step2Data);
    this.capturedData.step2 = step2Data;
    
    console.log(`   ✓ Category: ${routingResult.category}`);
    console.log(`   ✓ Provider: ${routingResult.provider}`);
    console.log(`   ✓ Model: ${routingResult.originalModel} → ${routingResult.targetModel}`);
    
    return step2Data;
  }

  /**
   * Step 3: 捕获格式转换数据
   */
  async captureStep3Transformation(anthropicRequest, openaiRequest) {
    console.log('\n🔍 [STEP 3] Capturing transformation data...');
    
    const step3Data = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      step: 'transformation',
      anthropicRequest: {
        model: anthropicRequest.model,
        messages: anthropicRequest.messages,
        max_tokens: anthropicRequest.max_tokens,
        system: anthropicRequest.system,
        tools: anthropicRequest.tools
      },
      openaiRequest: {
        model: openaiRequest.model,
        messages: openaiRequest.messages,
        max_tokens: openaiRequest.max_tokens,
        temperature: openaiRequest.temperature,
        tools: openaiRequest.tools
      },
      transformationChanges: {
        systemPromptHandling: !!anthropicRequest.system,
        toolsTransformed: !!(anthropicRequest.tools && openaiRequest.tools),
        messageFormatChanged: this.compareMessageFormats(anthropicRequest.messages, openaiRequest.messages)
      }
    };

    await this.saveCapture('step3-transformation', step3Data);
    this.capturedData.step3 = step3Data;
    
    console.log(`   ✓ System prompt: ${step3Data.transformationChanges.systemPromptHandling ? 'Handled' : 'None'}`);
    console.log(`   ✓ Tools: ${step3Data.transformationChanges.toolsTransformed ? 'Transformed' : 'None'}`);
    console.log(`   ✓ Message format: ${step3Data.transformationChanges.messageFormatChanged ? 'Changed' : 'Preserved'}`);
    
    return step3Data;
  }

  /**
   * Step 4: 捕获原始OpenAI API响应
   */
  async captureStep4RawResponse(rawResponse, isStreaming = false) {
    console.log('\n🔍 [STEP 4] Capturing raw API response...');
    
    const step4Data = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      step: 'raw_api_response',
      isStreaming: isStreaming,
      responseData: rawResponse,
      responseAnalysis: {
        hasChoices: !!(rawResponse.choices && rawResponse.choices.length > 0),
        hasContent: !!(rawResponse.choices?.[0]?.message?.content || rawResponse.choices?.[0]?.delta?.content),
        hasToolCalls: !!(rawResponse.choices?.[0]?.message?.tool_calls || rawResponse.choices?.[0]?.delta?.tool_calls),
        contentLength: this.getContentLength(rawResponse),
        toolCallCount: this.getToolCallCount(rawResponse),
        finishReason: rawResponse.choices?.[0]?.finish_reason
      }
    };

    await this.saveCapture('step4-raw-response', step4Data);
    this.capturedData.step4 = step4Data;
    
    console.log(`   ✓ Streaming: ${isStreaming}`);
    console.log(`   ✓ Content length: ${step4Data.responseAnalysis.contentLength}`);
    console.log(`   ✓ Tool calls: ${step4Data.responseAnalysis.toolCallCount}`);
    console.log(`   ✓ Finish reason: ${step4Data.responseAnalysis.finishReason || 'none'}`);
    
    return step4Data;
  }

  /**
   * Step 5: 捕获转换器输入数据
   */
  async captureStep5TransformerInput(transformerInput) {
    console.log('\n🔍 [STEP 5] Capturing transformer input...');
    
    const step5Data = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      step: 'transformer_input',
      transformerReceived: transformerInput,
      inputAnalysis: {
        isValidOpenAI: this.validateOpenAIFormat(transformerInput),
        hasRequiredFields: this.checkRequiredFields(transformerInput),
        dataIntegrity: this.checkDataIntegrity(transformerInput)
      }
    };

    await this.saveCapture('step5-transformer-input', step5Data);
    this.capturedData.step5 = step5Data;
    
    console.log(`   ✓ Valid OpenAI format: ${step5Data.inputAnalysis.isValidOpenAI}`);
    console.log(`   ✓ Required fields: ${step5Data.inputAnalysis.hasRequiredFields}`);
    console.log(`   ✓ Data integrity: ${step5Data.inputAnalysis.dataIntegrity}`);
    
    return step5Data;
  }

  /**
   * Step 6: 捕获转换器输出数据
   */
  async captureStep6TransformerOutput(anthropicResponse) {
    console.log('\n🔍 [STEP 6] Capturing transformer output...');
    
    const step6Data = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      step: 'transformer_output',
      anthropicResponse: anthropicResponse,
      outputAnalysis: {
        hasContent: !!(anthropicResponse.content && anthropicResponse.content.length > 0),
        contentBlocks: anthropicResponse.content?.length || 0,
        hasTextBlocks: this.countTextBlocks(anthropicResponse.content),
        hasToolUseBlocks: this.countToolUseBlocks(anthropicResponse.content),
        hasUsageInfo: !!(anthropicResponse.usage),
        stopReason: anthropicResponse.stop_reason
      }
    };

    await this.saveCapture('step6-transformer-output', step6Data);
    this.capturedData.step6 = step6Data;
    
    console.log(`   ✓ Content blocks: ${step6Data.outputAnalysis.contentBlocks}`);
    console.log(`   ✓ Text blocks: ${step6Data.outputAnalysis.hasTextBlocks}`);
    console.log(`   ✓ Tool use blocks: ${step6Data.outputAnalysis.hasToolUseBlocks}`);
    console.log(`   ✓ Stop reason: ${step6Data.outputAnalysis.stopReason || 'none'}`);
    
    return step6Data;
  }

  /**
   * 保存捕获数据到文件
   */
  async saveCapture(filename, data) {
    const filepath = path.join(this.captureDir, `${this.sessionId}-${filename}.json`);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  }

  /**
   * 生成完整的捕获报告
   */
  async generateCaptureReport() {
    console.log('\n📊 Generating comprehensive pipeline capture report...');
    
    const report = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      summary: {
        totalSteps: Object.keys(this.capturedData).length,
        stepsCompleted: Object.keys(this.capturedData),
        hasPipelineBreak: this.detectPipelineBreaks(),
        dataConsistency: this.checkDataConsistency()
      },
      steps: this.capturedData,
      analysis: {
        modelMapping: this.analyzeModelMapping(),
        contentFlow: this.analyzeContentFlow(),
        toolHandling: this.analyzeToolHandling(),
        errorPoints: this.identifyErrorPoints()
      },
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(this.captureDir, `${this.sessionId}-complete-report.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📋 Capture Report Summary:`);
    console.log(`   📁 Capture directory: ${this.captureDir}`);
    console.log(`   🆔 Session ID: ${this.sessionId}`);
    console.log(`   ✅ Steps completed: ${report.summary.stepsCompleted.join(', ')}`);
    console.log(`   🔧 Pipeline breaks: ${report.summary.hasPipelineBreak ? 'Detected' : 'None'}`);
    console.log(`   📊 Data consistency: ${report.summary.dataConsistency ? 'Good' : 'Issues found'}`);
    console.log(`   📄 Report saved: ${reportPath}`);
    
    return report;
  }

  // Helper methods
  estimateTokenCount(messages) {
    let totalChars = 0;
    messages.forEach(msg => {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        msg.content.forEach(block => {
          if (block.text) totalChars += block.text.length;
        });
      }
    });
    return Math.ceil(totalChars / 4);
  }

  compareMessageFormats(anthropicMessages, openaiMessages) {
    return JSON.stringify(anthropicMessages) !== JSON.stringify(openaiMessages);
  }

  getContentLength(response) {
    const content = response.choices?.[0]?.message?.content || response.choices?.[0]?.delta?.content || '';
    return content.length;
  }

  getToolCallCount(response) {
    const toolCalls = response.choices?.[0]?.message?.tool_calls || response.choices?.[0]?.delta?.tool_calls || [];
    return toolCalls.length;
  }

  validateOpenAIFormat(data) {
    return !!(data && data.choices && Array.isArray(data.choices));
  }

  checkRequiredFields(data) {
    return !!(data.id && data.model && data.choices);
  }

  checkDataIntegrity(data) {
    return !!(data && typeof data === 'object' && !Array.isArray(data));
  }

  countTextBlocks(content) {
    if (!content) return 0;
    return content.filter(block => block.type === 'text').length;
  }

  countToolUseBlocks(content) {
    if (!content) return 0;
    return content.filter(block => block.type === 'tool_use').length;
  }

  detectPipelineBreaks() {
    const expectedSteps = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
    return !expectedSteps.every(step => this.capturedData[step]);
  }

  checkDataConsistency() {
    if (!this.capturedData.step1 || !this.capturedData.step6) return false;
    
    // Check if original model is preserved
    const originalModel = this.capturedData.step1.originalRequest.model;
    const finalModel = this.capturedData.step6.anthropicResponse.model;
    
    return originalModel === finalModel;
  }

  analyzeModelMapping() {
    if (!this.capturedData.step2) return null;
    
    return {
      originalModel: this.capturedData.step2.originalModel,
      targetModel: this.capturedData.step2.targetModel,
      provider: this.capturedData.step2.selectedProvider,
      category: this.capturedData.step2.category
    };
  }

  analyzeContentFlow() {
    const flow = {};
    
    if (this.capturedData.step1) {
      flow.inputTokens = this.capturedData.step1.tokenCount;
    }
    
    if (this.capturedData.step4) {
      flow.rawContentLength = this.capturedData.step4.responseAnalysis.contentLength;
    }
    
    if (this.capturedData.step6) {
      flow.finalContentBlocks = this.capturedData.step6.outputAnalysis.contentBlocks;
    }
    
    return flow;
  }

  analyzeToolHandling() {
    const toolAnalysis = {};
    
    if (this.capturedData.step1) {
      toolAnalysis.inputTools = this.capturedData.step1.toolCount;
    }
    
    if (this.capturedData.step4) {
      toolAnalysis.rawToolCalls = this.capturedData.step4.responseAnalysis.toolCallCount;
    }
    
    if (this.capturedData.step6) {
      toolAnalysis.finalToolUse = this.capturedData.step6.outputAnalysis.hasToolUseBlocks;
    }
    
    return toolAnalysis;
  }

  identifyErrorPoints() {
    const errors = [];
    
    if (this.capturedData.step5 && !this.capturedData.step5.inputAnalysis.isValidOpenAI) {
      errors.push('Invalid OpenAI format at step 5');
    }
    
    if (this.capturedData.step6 && !this.capturedData.step6.outputAnalysis.hasContent) {
      errors.push('No content in final output at step 6');
    }
    
    return errors;
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.detectPipelineBreaks()) {
      recommendations.push('Complete all 6 pipeline steps for full analysis');
    }
    
    if (!this.checkDataConsistency()) {
      recommendations.push('Check model mapping consistency between input and output');
    }
    
    const errors = this.identifyErrorPoints();
    if (errors.length > 0) {
      recommendations.push(`Address identified error points: ${errors.join(', ')}`);
    }
    
    return recommendations;
  }
}

/**
 * 完整的OpenAI流水线测试
 */
async function runOpenAIPipelineCapture() {
  console.log('🚀 Starting OpenAI Pipeline Data Capture System\n');
  
  const captureSystem = new OpenAIDataCaptureSystem();
  await captureSystem.initialize();
  
  try {
    // Step 1: 模拟输入处理
    const testRequest = {
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: 'Please help me create a simple Node.js HTTP server.' }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      metadata: {
        requestId: 'test-openai-pipeline',
        tools: [
          {
            name: 'WebSearch',
            description: 'Search for information on the web'
          }
        ]
      }
    };
    
    await captureSystem.captureStep1Input(testRequest);
    
    // Step 2: 模拟路由决策
    const routingResult = {
      category: 'search',
      provider: 'shuaihong-openai',
      targetModel: 'gemini-2.5-flash',
      originalModel: 'claude-sonnet-4-20250514',
      reason: 'Request contains search tools'
    };
    
    await captureSystem.captureStep2Routing(routingResult);
    
    // Step 3: 模拟格式转换
    const anthropicRequest = {
      model: testRequest.model,
      messages: testRequest.messages,
      max_tokens: testRequest.max_tokens,
      system: null,
      tools: testRequest.metadata.tools
    };
    
    const openaiRequest = {
      model: routingResult.targetModel,
      messages: [
        { role: 'user', content: 'Please help me create a simple Node.js HTTP server.' }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      tools: [
        {
          type: 'function',
          function: {
            name: 'WebSearch',
            description: 'Search for information on the web'
          }
        }
      ]
    };
    
    await captureSystem.captureStep3Transformation(anthropicRequest, openaiRequest);
    
    // Step 4: 模拟原始API响应
    const rawOpenAIResponse = {
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gemini-2.5-flash',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Here\'s a simple Node.js HTTP server:\n\n```javascript\nconst http = require(\'http\');\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { \'Content-Type\': \'text/plain\' });\n  res.end(\'Hello World!\');\n});\n\nserver.listen(3000, () => {\n  console.log(\'Server running on port 3000\');\n});\n```'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 25,
        completion_tokens: 120,
        total_tokens: 145
      }
    };
    
    await captureSystem.captureStep4RawResponse(rawOpenAIResponse, false);
    
    // Step 5: 模拟转换器输入
    await captureSystem.captureStep5TransformerInput(rawOpenAIResponse);
    
    // Step 6: 模拟转换器输出
    const anthropicResponse = {
      id: 'msg_test',
      model: 'claude-sonnet-4-20250514', // 恢复原始模型名
      role: 'assistant',
      content: [{
        type: 'text',
        text: 'Here\'s a simple Node.js HTTP server:\n\n```javascript\nconst http = require(\'http\');\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { \'Content-Type\': \'text/plain\' });\n  res.end(\'Hello World!\');\n});\n\nserver.listen(3000, () => {\n  console.log(\'Server running on port 3000\');\n});\n```'
      }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 25,
        output_tokens: 120
      }
    };
    
    await captureSystem.captureStep6TransformerOutput(anthropicResponse);
    
    // 生成完整报告
    const report = await captureSystem.generateCaptureReport();
    
    console.log('\n✅ OpenAI Pipeline Data Capture completed successfully!');
    console.log(`📊 Full analysis available in: ${captureSystem.captureDir}`);
    
    return report;
    
  } catch (error) {
    console.error('❌ Pipeline capture failed:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runOpenAIPipelineCapture()
    .then(report => {
      console.log('\n🎉 Capture system test completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Capture system test failed:', error);
      process.exit(1);
    });
}

module.exports = { OpenAIDataCaptureSystem, runOpenAIPipelineCapture };