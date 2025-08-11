#!/usr/bin/env node
/**
 * 全流程流水线测试系统
 * 逐节点验证，用真实数据模拟每个阶段
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Import our modules for testing
const { AnthropicInputProcessor } = require('../dist/input/anthropic');
const { RoutingEngine } = require('../dist/routing/engine');
const { CodeWhispererAuth } = require('../dist/providers/codewhisperer/auth');
const { CodeWhispererConverter } = require('../dist/providers/codewhisperer/converter');
const { parseEvents, convertEventsToAnthropic, parseNonStreamingResponse } = require('../dist/providers/codewhisperer/parser');
const { logger } = require('../dist/utils/logger');

// Test data storage
const TEST_DATA_DIR = path.join(__dirname, 'pipeline-data');
const REAL_CLAUDE_REQUEST_FILE = path.join(TEST_DATA_DIR, 'claude-request.json');
const REAL_CODEWHISPERER_RESPONSE_FILE = path.join(TEST_DATA_DIR, 'codewhisperer-response.raw');

/**
 * Ensure test data directory exists
 */
function ensureTestDataDir() {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
}

/**
 * Capture real Claude Code request data
 */
async function captureClaudeRequest() {
  console.log('🎯 Capturing real Claude Code request...\n');
  
  // We'll use a interceptor approach - start a temporary server to capture requests
  const express = require('express');
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  
  let capturedRequest = null;
  
  app.post('/v1/messages', (req, res) => {
    console.log('📥 Claude Code request captured!');
    capturedRequest = {
      timestamp: new Date().toISOString(),
      headers: req.headers,
      body: req.body,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type']
    };
    
    // Save to file
    fs.writeFileSync(REAL_CLAUDE_REQUEST_FILE, JSON.stringify(capturedRequest, null, 2));
    console.log(`✅ Request saved to: ${REAL_CLAUDE_REQUEST_FILE}`);
    
    // Return a dummy response to avoid hanging Claude
    res.json({
      id: 'msg_capture_test',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Test response for request capture' }],
      model: req.body.model,
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 }
    });
    
    // Shutdown server after capture
    setTimeout(() => {
      server.close(() => {
        console.log('🏁 Capture server stopped');
        console.log('💡 Now you can run the pipeline tests with real data!');
      });
    }, 1000);
  });
  
  const server = app.listen(3456, () => {
    console.log('🎯 Capture server listening on port 3456');
    console.log('📋 Instructions:');
    console.log('   1. In another terminal, run: export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"');
    console.log('   2. Run: export ANTHROPIC_API_KEY="test-key"');
    console.log('   3. Run: claude "hello test"');
    console.log('   4. This will capture the real request format\\n');
  });
  
  // Wait for capture or timeout
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (capturedRequest) {
        clearInterval(checkInterval);
        resolve(capturedRequest);
      }
    }, 1000);
    
    // Timeout after 60 seconds
    setTimeout(() => {
      if (!capturedRequest) {
        clearInterval(checkInterval);
        server.close();
        console.log('⏰ Capture timeout - no request received');
        resolve(null);
      }
    }, 60000);
  });
}

/**
 * Test Stage 1: Input Processing
 */
async function testInputProcessing(realRequest) {
  console.log('\\n🧪 Stage 1: Testing Input Processing...');
  
  try {
    const processor = new AnthropicInputProcessor();
    
    console.log('📋 Input request validation...');
    const canProcess = processor.canProcess(realRequest.body);
    console.log(`   ✅ Can process: ${canProcess}`);
    
    if (!canProcess) {
      throw new Error('Input processor cannot handle the request format');
    }
    
    console.log('🔄 Converting to BaseRequest...');
    const baseRequest = await processor.process(realRequest.body);
    
    console.log('✅ Input processing successful:');
    console.log(`   Model: ${baseRequest.model}`);
    console.log(`   Stream: ${baseRequest.stream}`);
    console.log(`   Messages: ${baseRequest.messages.length}`);
    console.log(`   First message: ${baseRequest.messages[0].content.substring(0, 100)}...`);
    
    // Save processed request for next stage
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, 'stage1-base-request.json'),
      JSON.stringify(baseRequest, null, 2)
    );
    
    return baseRequest;
  } catch (error) {
    console.error('❌ Input processing failed:', error.message);
    throw error;
  }
}

/**
 * Test Stage 2: Routing
 */
async function testRouting(baseRequest) {
  console.log('\\n🧪 Stage 2: Testing Routing...');
  
  try {
    // Load router config
    const configPath = path.join(process.env.HOME, '.claude-code-router', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const routingEngine = new RoutingEngine(config.routing);
    const requestId = 'test-' + Date.now();
    
    console.log('🎯 Determining route...');
    const providerId = await routingEngine.route(baseRequest, requestId);
    
    console.log('✅ Routing successful:');
    console.log(`   Selected provider: ${providerId}`);
    console.log(`   Original model: ${baseRequest.model}`);
    
    // Save routing result for next stage
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, 'stage2-routing-result.json'),
      JSON.stringify({ providerId, modifiedRequest: baseRequest }, null, 2)
    );
    
    return { providerId, modifiedRequest: baseRequest };
  } catch (error) {
    console.error('❌ Routing failed:', error.message);
    throw error;
  }
}

/**
 * Test Stage 3: CodeWhisperer Request Conversion
 */
async function testCodeWhispererConversion(baseRequest, providerId) {
  console.log('\\n🧪 Stage 3: Testing CodeWhisperer Conversion...');
  
  try {
    const converter = new CodeWhispererConverter('arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK');
    const requestId = 'test-' + Date.now();
    
    console.log('🔄 Converting to CodeWhisperer format...');
    const cwRequest = converter.convertRequest(baseRequest, requestId);
    
    console.log('✅ Conversion successful:');
    console.log(`   Conversation ID: ${cwRequest.conversationState.conversationId}`);
    console.log(`   Model ID: ${cwRequest.conversationState.currentMessage.userInputMessage.modelId}`);
    console.log(`   Content length: ${cwRequest.conversationState.currentMessage.userInputMessage.content.length}`);
    console.log(`   Profile ARN: ${cwRequest.profileArn}`);
    
    // Save converted request for next stage
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, 'stage3-codewhisperer-request.json'),
      JSON.stringify(cwRequest, null, 2)
    );
    
    return cwRequest;
  } catch (error) {
    console.error('❌ CodeWhisperer conversion failed:', error.message);
    throw error;
  }
}

/**
 * Test Stage 4: Token Management
 */
async function testTokenManagement() {
  console.log('\\n🧪 Stage 4: Testing Token Management...');
  
  try {
    const auth = new CodeWhispererAuth();
    
    console.log('🔑 Getting authentication token...');
    const token = await auth.getToken();
    
    console.log('✅ Token management successful:');
    console.log(`   Token obtained: ${token ? 'Yes' : 'No'}`);
    console.log(`   Token length: ${token ? token.length : 0}`);
    console.log(`   Token preview: ${token ? token.substring(0, 20) + '...' : 'N/A'}`);
    
    // Get token info for debugging
    const tokenInfo = await auth.getTokenInfo();
    console.log('📊 Token info:', tokenInfo);
    
    return { token, headers: await auth.getAuthHeaders() };
  } catch (error) {
    console.error('❌ Token management failed:', error.message);
    throw error;
  }
}

/**
 * Test Stage 5: Real CodeWhisperer Request (Optional)
 */
async function testRealCodeWhispererRequest(cwRequest, authHeaders) {
  console.log('\\n🧪 Stage 5: Testing Real CodeWhisperer Request...');
  
  try {
    console.log('🌐 Sending request to CodeWhisperer...');
    
    const response = await axios.post(
      'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
      cwRequest,
      {
        headers: {
          ...authHeaders,
          'Accept': 'text/event-stream'
        },
        responseType: 'stream',
        timeout: 30000
      }
    );
    
    console.log(`✅ CodeWhisperer responded: ${response.status}`);
    
    // Collect response data
    const chunks = [];
    for await (const chunk of response.data) {
      chunks.push(Buffer.from(chunk));
    }
    
    const fullResponse = Buffer.concat(chunks);
    
    console.log('📊 Response details:');
    console.log(`   Response length: ${fullResponse.length} bytes`);
    console.log(`   Response preview: ${fullResponse.toString('utf-8', 0, 200)}...`);
    
    // Save raw response for parsing tests
    fs.writeFileSync(REAL_CODEWHISPERER_RESPONSE_FILE, fullResponse);
    
    return fullResponse;
  } catch (error) {
    console.error('❌ CodeWhisperer request failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response headers:', error.response.headers);
    }
    throw error;
  }
}

/**
 * Test Stage 6: Response Parsing
 */
async function testResponseParsing(rawResponse) {
  console.log('\\n🧪 Stage 6: Testing Response Parsing...');
  
  try {
    console.log('📊 Raw response analysis:');
    console.log(`   Length: ${rawResponse.length} bytes`);
    console.log(`   Starts with: ${rawResponse.toString('utf-8', 0, 50)}`);
    
    console.log('🔍 Parsing SSE events...');
    const events = parseEvents(rawResponse);
    
    console.log('✅ Event parsing results:');
    console.log(`   Events found: ${events.length}`);
    console.log('   Event types:', events.map(e => e.Event));
    
    // Save parsed events
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, 'stage6-parsed-events.json'),
      JSON.stringify(events, null, 2)
    );
    
    console.log('🔄 Converting to Anthropic format...');
    const requestId = 'test-' + Date.now();
    const anthropicEvents = convertEventsToAnthropic(events, requestId);
    
    console.log('✅ Anthropic conversion results:');
    console.log(`   Anthropic events: ${anthropicEvents.length}`);
    console.log('   Event types:', anthropicEvents.map(e => e.event));
    
    // Save converted events
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, 'stage6-anthropic-events.json'),
      JSON.stringify(anthropicEvents, null, 2)
    );
    
    return { events, anthropicEvents };
  } catch (error) {
    console.error('❌ Response parsing failed:', error.message);
    throw error;
  }
}

/**
 * Test Stage 7: Non-streaming Response Parsing
 */
async function testNonStreamingParsing(rawResponse) {
  console.log('\\n🧪 Stage 7: Testing Non-streaming Response Parsing...');
  
  try {
    const requestId = 'test-' + Date.now();
    
    console.log('🔄 Parsing as non-streaming response...');
    const contexts = parseNonStreamingResponse(rawResponse, requestId);
    
    console.log('✅ Non-streaming parsing results:');
    console.log(`   Contexts found: ${contexts.length}`);
    console.log('   Context types:', contexts.map(c => c.type));
    
    if (contexts.length > 0) {
      contexts.forEach((ctx, i) => {
        console.log(`   Context ${i + 1}:`, {
          type: ctx.type,
          textLength: ctx.text ? ctx.text.length : 0,
          hasToolUse: ctx.type === 'tool_use'
        });
      });
    }
    
    // Save parsed contexts
    fs.writeFileSync(
      path.join(TEST_DATA_DIR, 'stage7-parsed-contexts.json'),
      JSON.stringify(contexts, null, 2)
    );
    
    return contexts;
  } catch (error) {
    console.error('❌ Non-streaming parsing failed:', error.message);
    throw error;
  }
}

/**
 * Generate test report
 */
function generateTestReport(results) {
  console.log('\\n📋 PIPELINE TEST REPORT');
  console.log('=======================');
  
  const stages = [
    'Input Processing',
    'Routing',
    'CodeWhisperer Conversion', 
    'Token Management',
    'CodeWhisperer Request',
    'Response Parsing',
    'Non-streaming Parsing'
  ];
  
  stages.forEach((stage, i) => {
    const status = results[i] ? '✅ PASS' : '❌ FAIL';
    console.log(`${i + 1}. ${stage}: ${status}`);
  });
  
  const passCount = results.filter(Boolean).length;
  const totalCount = results.length;
  
  console.log(`\\n🎯 Overall: ${passCount}/${totalCount} stages passed`);
  console.log(`📁 Test data saved to: ${TEST_DATA_DIR}`);
}

/**
 * Main test pipeline
 */
async function runPipelineTest() {
  console.log('🚀 Starting Full Pipeline Test\\n');
  
  ensureTestDataDir();
  
  const results = [];
  let realRequest = null;
  let baseRequest = null;
  let routingResult = null;
  let cwRequest = null;
  let authData = null;
  let rawResponse = null;
  
  try {
    // Check if we have saved request data
    if (fs.existsSync(REAL_CLAUDE_REQUEST_FILE)) {
      console.log('📋 Using existing Claude request data...');
      realRequest = JSON.parse(fs.readFileSync(REAL_CLAUDE_REQUEST_FILE, 'utf8'));
    } else {
      console.log('📥 Need to capture Claude request first...');
      realRequest = await captureClaudeRequest();
      if (!realRequest) {
        throw new Error('Failed to capture Claude request');
      }
    }
    
    // Stage 1: Input Processing
    try {
      baseRequest = await testInputProcessing(realRequest);
      results.push(true);
    } catch (error) {
      results.push(false);
    }
    
    // Stage 2: Routing
    if (baseRequest) {
      try {
        routingResult = await testRouting(baseRequest);
        results.push(true);
      } catch (error) {
        results.push(false);
      }
    } else {
      results.push(false);
    }
    
    // Stage 3: CodeWhisperer Conversion
    if (routingResult) {
      try {
        cwRequest = await testCodeWhispererConversion(routingResult.modifiedRequest, routingResult.providerId);
        results.push(true);
      } catch (error) {
        results.push(false);
      }
    } else {
      results.push(false);
    }
    
    // Stage 4: Token Management
    try {
      authData = await testTokenManagement();
      results.push(true);
    } catch (error) {
      results.push(false);
    }
    
    // Stage 5: Real CodeWhisperer Request
    if (cwRequest && authData) {
      try {
        rawResponse = await testRealCodeWhispererRequest(cwRequest, authData.headers);
        results.push(true);
      } catch (error) {
        results.push(false);
        // Try to use saved response if available
        if (fs.existsSync(REAL_CODEWHISPERER_RESPONSE_FILE)) {
          console.log('📋 Using saved CodeWhisperer response...');
          rawResponse = fs.readFileSync(REAL_CODEWHISPERER_RESPONSE_FILE);
        }
      }
    } else {
      results.push(false);
    }
    
    // Stage 6: Response Parsing
    if (rawResponse) {
      try {
        await testResponseParsing(rawResponse);
        results.push(true);
      } catch (error) {
        results.push(false);
      }
    } else {
      results.push(false);
    }
    
    // Stage 7: Non-streaming Parsing
    if (rawResponse) {
      try {
        await testNonStreamingParsing(rawResponse);
        results.push(true);
      } catch (error) {
        results.push(false);
      }
    } else {
      results.push(false);
    }
    
  } catch (error) {
    console.error('\\n💥 Pipeline test failed:', error.message);
  }
  
  generateTestReport(results);
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--capture')) {
    await captureClaudeRequest();
  } else if (args.includes('--help')) {
    console.log('📋 Pipeline Test Commands:');
    console.log('   node pipeline-full-test.js          - Run full pipeline test');
    console.log('   node pipeline-full-test.js --capture - Capture real Claude request');
    console.log('   node pipeline-full-test.js --help   - Show this help');
  } else {
    await runPipelineTest();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  captureClaudeRequest,
  testInputProcessing,
  testRouting,
  testCodeWhispererConversion,
  testTokenManagement,
  testRealCodeWhispererRequest,
  testResponseParsing,
  testNonStreamingParsing
};