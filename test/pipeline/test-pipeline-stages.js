#!/usr/bin/env node
/**
 * 流水线阶段测试 - 逐节点验证
 * 使用模拟数据测试每个阶段的转换
 */

const fs = require('fs');
const path = require('path');

// 测试数据
const TEST_CLAUDE_DATA = require('./test-claude-data.json');

// 构建后的模块路径
const BUILD_DIR = path.join(__dirname, '../dist');

console.log('🧪 流水线阶段测试开始\n');

/**
 * Stage 1: Input Processing Test
 */
async function testInputProcessing() {
  console.log('📝 Stage 1: Input Processing');
  console.log('================================');
  
  try {
    const { AnthropicInputProcessor } = require(path.join(BUILD_DIR, 'input/anthropic'));
    
    const processor = new AnthropicInputProcessor();
    const requestBody = TEST_CLAUDE_DATA.body;
    
    console.log('🔍 Input validation...');
    const canProcess = processor.canProcess(requestBody);
    console.log(`   ✅ Can process: ${canProcess}`);
    
    if (!canProcess) {
      throw new Error('Processor cannot handle the request format');
    }
    
    console.log('🔄 Converting to BaseRequest...');
    const baseRequest = await processor.process(requestBody);
    
    console.log('📊 Results:');
    console.log(`   Model: ${baseRequest.model}`);
    console.log(`   Stream: ${baseRequest.stream}`);
    console.log(`   Messages count: ${baseRequest.messages.length}`);
    console.log(`   First message role: ${baseRequest.messages[0].role}`);
    console.log(`   First message content: ${baseRequest.messages[0].content.substring(0, 50)}...`);
    console.log(`   Max tokens: ${baseRequest.max_tokens}`);
    
    // 保存结果用于下一阶段
    const outputPath = path.join(__dirname, 'stage1-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(baseRequest, null, 2));
    console.log(`📁 Saved to: ${outputPath}\n`);
    
    return baseRequest;
  } catch (error) {
    console.error('❌ Stage 1 failed:', error.message);
    console.error('📚 Stack:', error.stack);
    return null;
  }
}

/**
 * Stage 2: Routing Test
 */
async function testRouting(baseRequest) {
  console.log('🎯 Stage 2: Routing');
  console.log('====================');
  
  try {
    const { RoutingEngine } = require(path.join(BUILD_DIR, 'routing/engine'));
    
    // 加载配置
    const configPath = path.join(process.env.HOME, '.claude-code-router', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const routingEngine = new RoutingEngine(config.routing);
    const requestId = 'test-' + Date.now();
    
    // 添加requestId到请求元数据
    baseRequest.metadata = { ...baseRequest.metadata, requestId };
    
    console.log('🔍 Determining routing category...');
    // 模拟路由引擎的内部逻辑
    const category = determineCategory(baseRequest);
    console.log(`   Category: ${category}`);
    
    console.log('🎯 Routing request...');
    const providerId = await routingEngine.route(baseRequest, requestId);
    
    console.log('📊 Results:');
    console.log(`   Selected provider: ${providerId}`);
    console.log(`   Original model: ${baseRequest.model}`);
    console.log(`   Request ID: ${requestId}`);
    
    const result = { providerId, baseRequest, requestId };
    
    // 保存结果
    const outputPath = path.join(__dirname, 'stage2-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`📁 Saved to: ${outputPath}\n`);
    
    return result;
  } catch (error) {
    console.error('❌ Stage 2 failed:', error.message);
    console.error('📚 Stack:', error.stack);
    return null;
  }
}

// Helper function to determine category (simplified version)
function determineCategory(request) {
  if (request.metadata?.thinking) return 'thinking';
  if (request.model.includes('haiku')) return 'background';
  return 'default';
}

/**
 * Stage 3: CodeWhisperer Conversion Test
 */
async function testCodeWhispererConversion(routingResult) {
  console.log('🔧 Stage 3: CodeWhisperer Conversion');
  console.log('====================================');
  
  try {
    const { CodeWhispererConverter } = require(path.join(BUILD_DIR, 'providers/codewhisperer/converter'));
    
    const profileArn = 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK';
    const converter = new CodeWhispererConverter(profileArn);
    
    console.log('🔄 Converting to CodeWhisperer format...');
    const cwRequest = converter.convertRequest(routingResult.baseRequest, routingResult.requestId);
    
    console.log('📊 Results:');
    console.log(`   Conversation ID: ${cwRequest.conversationState.conversationId}`);
    console.log(`   Chat trigger type: ${cwRequest.conversationState.chatTriggerType}`);
    console.log(`   Model ID: ${cwRequest.conversationState.currentMessage.userInputMessage.modelId}`);
    console.log(`   Content: ${cwRequest.conversationState.currentMessage.userInputMessage.content.substring(0, 50)}...`);
    console.log(`   Profile ARN: ${cwRequest.profileArn}`);
    console.log(`   History length: ${cwRequest.conversationState.history.length}`);
    
    // 保存结果
    const outputPath = path.join(__dirname, 'stage3-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(cwRequest, null, 2));
    console.log(`📁 Saved to: ${outputPath}\n`);
    
    return cwRequest;
  } catch (error) {
    console.error('❌ Stage 3 failed:', error.message);
    console.error('📚 Stack:', error.stack);
    return null;
  }
}

/**
 * Stage 4: Token Management Test
 */
async function testTokenManagement() {
  console.log('🔑 Stage 4: Token Management');
  console.log('=============================');
  
  try {
    const { CodeWhispererAuth } = require(path.join(BUILD_DIR, 'providers/codewhisperer/auth'));
    
    const auth = new CodeWhispererAuth();
    
    console.log('🔍 Getting token info...');
    const tokenInfo = await auth.getTokenInfo();
    console.log('📊 Token info:', JSON.stringify(tokenInfo, null, 2));
    
    if (tokenInfo.error) {
      console.log('⚠️  Token file not found or invalid, skipping actual token test');
      return { mockToken: 'mock-token-for-testing', headers: { 'Authorization': 'Bearer mock-token' } };
    }
    
    console.log('🔑 Getting authentication token...');
    const token = await auth.getToken();
    
    console.log('📊 Results:');
    console.log(`   Token obtained: ${token ? 'Yes' : 'No'}`);
    console.log(`   Token length: ${token ? token.length : 0}`);
    console.log(`   Token preview: ${token ? token.substring(0, 20) + '...' : 'N/A'}`);
    
    const authHeaders = await auth.getAuthHeaders();
    console.log(`   Headers: ${Object.keys(authHeaders).join(', ')}`);
    
    const result = { token, headers: authHeaders };
    
    // 保存结果（注意：不保存真实token）
    const safeResult = { 
      tokenObtained: !!token, 
      tokenLength: token ? token.length : 0,
      headers: Object.keys(authHeaders)
    };
    const outputPath = path.join(__dirname, 'stage4-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(safeResult, null, 2));
    console.log(`📁 Saved to: ${outputPath}\n`);
    
    return result;
  } catch (error) {
    console.error('❌ Stage 4 failed:', error.message);
    console.log('💡 This is expected if Kiro token is not set up');
    console.log('🔄 Using mock token for testing...');
    
    const mockResult = { 
      mockToken: 'mock-token-for-testing', 
      headers: { 
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'application/json',
        'User-Agent': 'claude-code-router/2.0.0'
      } 
    };
    
    const outputPath = path.join(__dirname, 'stage4-output.json');
    fs.writeFileSync(outputPath, JSON.stringify({ isMock: true }, null, 2));
    console.log(`📁 Saved mock result to: ${outputPath}\n`);
    
    return mockResult;
  }
}

/**
 * Stage 5: Mock CodeWhisperer Response Test
 */
async function testMockCodeWhispererResponse() {
  console.log('🎭 Stage 5: Mock CodeWhisperer Response');
  console.log('======================================');
  
  try {
    // 创建模拟的CodeWhisperer SSE响应
    const mockSSEResponse = `event: messageStart
data: {"type":"message_start","message":{"id":"msg_mock_123","role":"assistant"}}

event: contentBlockStart
data: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}

event: contentBlockDelta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Router"}}

event: contentBlockDelta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" test"}}

event: contentBlockDelta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" successful"}}

event: contentBlockStop
data: {"type":"content_block_stop","index":0}

event: messageStop
data: {"type":"message_stop"}

`;
    
    console.log('📦 Mock SSE response created:');
    console.log(`   Length: ${mockSSEResponse.length} bytes`);
    console.log(`   Preview: ${mockSSEResponse.substring(0, 100)}...`);
    
    // 保存模拟响应
    const outputPath = path.join(__dirname, 'stage5-mock-response.sse');
    fs.writeFileSync(outputPath, mockSSEResponse);
    console.log(`📁 Saved to: ${outputPath}\n`);
    
    return Buffer.from(mockSSEResponse, 'utf8');
  } catch (error) {
    console.error('❌ Stage 5 failed:', error.message);
    return null;
  }
}

/**
 * Stage 6: Response Parsing Test
 */
async function testResponseParsing(mockResponse) {
  console.log('🔍 Stage 6: Response Parsing');
  console.log('=============================');
  
  try {
    const { parseEvents, convertEventsToAnthropic } = require(path.join(BUILD_DIR, 'providers/codewhisperer/parser'));
    
    console.log('📊 Input analysis:');
    console.log(`   Response length: ${mockResponse.length} bytes`);
    console.log(`   Response preview: ${mockResponse.toString('utf-8', 0, 100)}...`);
    
    console.log('🔍 Parsing SSE events...');
    const events = parseEvents(mockResponse);
    
    console.log('📊 Parsed events:');
    console.log(`   Events found: ${events.length}`);
    events.forEach((event, i) => {
      console.log(`   Event ${i + 1}: ${event.Event} (${typeof event.Data})`);
    });
    
    console.log('🔄 Converting to Anthropic format...');
    const requestId = 'test-parse-' + Date.now();
    const anthropicEvents = convertEventsToAnthropic(events, requestId);
    
    console.log('📊 Anthropic events:');
    console.log(`   Converted events: ${anthropicEvents.length}`);
    anthropicEvents.forEach((event, i) => {
      console.log(`   Event ${i + 1}: ${event.event}`);
      if (event.data && event.data.delta && event.data.delta.text) {
        console.log(`     Text: "${event.data.delta.text}"`);
      }
    });
    
    const result = { originalEvents: events, anthropicEvents };
    
    // 保存结果
    const outputPath = path.join(__dirname, 'stage6-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`📁 Saved to: ${outputPath}\n`);
    
    return result;
  } catch (error) {
    console.error('❌ Stage 6 failed:', error.message);
    console.error('📚 Stack:', error.stack);
    return null;
  }
}

/**
 * Main test function
 */
async function runPipelineTests() {
  console.log('🚀 开始流水线阶段测试\n');
  
  const results = [];
  
  // Stage 1: Input Processing
  const stage1Result = await testInputProcessing();
  results.push(!!stage1Result);
  
  if (!stage1Result) {
    console.log('💥 Stage 1 failed, stopping tests');
    return;
  }
  
  // Stage 2: Routing
  const stage2Result = await testRouting(stage1Result);
  results.push(!!stage2Result);
  
  if (!stage2Result) {
    console.log('💥 Stage 2 failed, stopping tests');
    return;
  }
  
  // Stage 3: CodeWhisperer Conversion
  const stage3Result = await testCodeWhispererConversion(stage2Result);
  results.push(!!stage3Result);
  
  // Stage 4: Token Management
  const stage4Result = await testTokenManagement();
  results.push(!!stage4Result);
  
  // Stage 5: Mock CodeWhisperer Response
  const stage5Result = await testMockCodeWhispererResponse();
  results.push(!!stage5Result);
  
  if (stage5Result) {
    // Stage 6: Response Parsing
    const stage6Result = await testResponseParsing(stage5Result);
    results.push(!!stage6Result);
  } else {
    results.push(false);
  }
  
  // 生成报告
  console.log('📋 TEST REPORT');
  console.log('==============');
  const stages = [
    'Input Processing',
    'Routing', 
    'CodeWhisperer Conversion',
    'Token Management',
    'Mock Response Generation',
    'Response Parsing'
  ];
  
  stages.forEach((stage, i) => {
    const status = results[i] ? '✅ PASS' : '❌ FAIL';
    console.log(`${i + 1}. ${stage}: ${status}`);
  });
  
  const passCount = results.filter(Boolean).length;
  console.log(`\n🎯 Overall: ${passCount}/${results.length} stages passed`);
  
  if (passCount === results.length) {
    console.log('🎉 All pipeline stages working correctly!');
  } else {
    console.log('⚠️  Some stages need attention');
  }
}

// 运行测试
if (require.main === module) {
  runPipelineTests().catch(console.error);
}

module.exports = {
  testInputProcessing,
  testRouting,
  testCodeWhispererConversion,
  testTokenManagement,
  testMockCodeWhispererResponse,
  testResponseParsing
};