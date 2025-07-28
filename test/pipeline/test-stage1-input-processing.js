#!/usr/bin/env node
/**
 * Stage 1: 输入处理测试
 * 测试Anthropic输入格式的解析和BaseRequest转换
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Stage 1: 输入处理测试');
console.log('========================\n');

// 使用捕获的真实Claude Code请求数据
const capturedDataPath = path.join(__dirname, 'captured-data', 'claude-request-1.json');

if (!fs.existsSync(capturedDataPath)) {
  console.error('❌ 找不到捕获的Claude Code请求数据');
  console.log('💡 请先运行拦截器捕获真实请求数据');
  process.exit(1);
}

// 读取真实请求数据
const capturedRequest = JSON.parse(fs.readFileSync(capturedDataPath, 'utf8'));
const realAnthropicRequest = capturedRequest.body;

console.log('📋 真实Claude Code请求分析:');
console.log(`   Model: ${realAnthropicRequest.model}`);
console.log(`   Stream: ${realAnthropicRequest.stream}`);
console.log(`   Max tokens: ${realAnthropicRequest.max_tokens}`);
console.log(`   Messages count: ${realAnthropicRequest.messages?.length || 0}`);

if (realAnthropicRequest.messages && realAnthropicRequest.messages[0]) {
  const firstMessage = realAnthropicRequest.messages[0];
  console.log(`   First message role: ${firstMessage.role}`);
  
  if (Array.isArray(firstMessage.content)) {
    console.log(`   Content blocks: ${firstMessage.content.length}`);
    firstMessage.content.forEach((block, i) => {
      console.log(`     Block ${i + 1}: ${block.type} (${block.text ? block.text.length : 0} chars)`);
    });
  } else {
    console.log(`   Content: ${typeof firstMessage.content} (${firstMessage.content?.length || 0} chars)`);
  }
}

console.log('\n🔄 模拟输入处理器逻辑:');

// 模拟AnthropicInputProcessor的处理逻辑
function mockCanProcess(requestBody) {
  // 检查必需字段
  if (!requestBody.model) {
    console.log('   ❌ 缺少model字段');
    return false;
  }
  
  if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
    console.log('   ❌ 缺少或无效的messages字段'); 
    return false;
  }
  
  if (requestBody.messages.length === 0) {
    console.log('   ❌ messages数组为空');
    return false;
  }
  
  console.log('   ✅ 请求格式验证通过');
  return true;
}

function mockProcessRequest(requestBody) {
  // 创建BaseRequest对象
  const baseRequest = {
    model: requestBody.model,
    max_tokens: requestBody.max_tokens || 1024,
    temperature: requestBody.temperature,
    stream: requestBody.stream || false,
    messages: [],
    metadata: {
      requestId: 'test-' + Date.now(),
      originalRequest: {
        anthropicBeta: requestBody.anthropic_beta || 'unknown',
        userAgent: 'claude-code-test'
      }
    }
  };
  
  // 处理messages
  requestBody.messages.forEach((msg, index) => {
    const processedMessage = {
      role: msg.role,
      content: msg.content
    };
    
    // 如果content是数组，处理各种类型的content block
    if (Array.isArray(msg.content)) {
      const textBlocks = [];
      msg.content.forEach(block => {
        if (block.type === 'text') {
          textBlocks.push(block.text);
        }
        // 这里可以处理其他类型的block，如image等
      });
      
      // 简化：合并所有text block
      processedMessage.content = textBlocks.join('\n');
    }
    
    baseRequest.messages.push(processedMessage);
  });
  
  return baseRequest;
}

// 执行测试
const canProcess = mockCanProcess(realAnthropicRequest);

if (!canProcess) {
  console.log('❌ 输入处理失败');
  process.exit(1);
}

console.log('\n🔧 处理请求...');
const baseRequest = mockProcessRequest(realAnthropicRequest);

console.log('\n📊 处理结果:');
console.log(`   Model: ${baseRequest.model}`);
console.log(`   Stream: ${baseRequest.stream}`);
console.log(`   Max tokens: ${baseRequest.max_tokens}`);
console.log(`   Messages count: ${baseRequest.messages.length}`);
console.log(`   Request ID: ${baseRequest.metadata.requestId}`);

baseRequest.messages.forEach((msg, i) => {
  console.log(`   Message ${i + 1}:`);
  console.log(`     Role: ${msg.role}`);
  console.log(`     Content length: ${msg.content.length} chars`);
  if (msg.content.length > 0) {
    const preview = msg.content.substring(0, 100).replace(/\n/g, '\\n');
    console.log(`     Preview: ${preview}${msg.content.length > 100 ? '...' : ''}`);
  }
});

// 保存处理结果
const outputPath = path.join(__dirname, 'stage1-base-request.json');
fs.writeFileSync(outputPath, JSON.stringify(baseRequest, null, 2));

console.log(`\n✅ Stage 1 完成！处理结果已保存到: ${outputPath}`);
console.log('💡 可以继续运行 Stage 2: test-stage2-routing.js');