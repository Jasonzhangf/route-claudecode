#!/usr/bin/env node

/**
 * 分析demo2响应数据，总结关键发现
 */

const fs = require('fs');
const path = require('path');

const dataDir = 'demo2-test-data';

function analyzeResponse(filename) {
  const filePath = path.join(dataDir, filename);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  console.log(`\n📄 ${filename}`);
  console.log(`   Test: ${data.description}`);
  console.log(`   Duration: ${data.duration}ms`);
  
  if (data.type === 'non-streaming') {
    const response = data.response.data;
    console.log(`   Response structure:`);
    console.log(`     - Keys: ${Object.keys(response).join(', ')}`);
    console.log(`     - Content blocks: ${response.content?.length || 0}`);
    console.log(`     - Model: ${response.model}`);
    console.log(`     - Stop reason: ${response.stop_reason}`);
    console.log(`     - Usage: input=${response.usage?.input_tokens}, output=${response.usage?.output_tokens}`);
    
    if (response.content && response.content.length > 0) {
      console.log(`     - Content types: ${response.content.map(c => c.type).join(', ')}`);
      response.content.forEach((block, i) => {
        if (block.type === 'text') {
          console.log(`       [${i}] Text: "${block.text?.substring(0, 50)}..."`);
        } else if (block.type === 'tool_use') {
          console.log(`       [${i}] Tool: ${block.name} (${block.id})`);
        }
      });
    }
  } else if (data.type === 'streaming') {
    const events = data.response.events;
    console.log(`   Streaming events: ${events.length}`);
    
    const eventTypes = {};
    events.forEach(event => {
      eventTypes[event.event] = (eventTypes[event.event] || 0) + 1;
    });
    
    console.log(`   Event types: ${Object.entries(eventTypes).map(([type, count]) => `${type}(${count})`).join(', ')}`);
  }
}

function compareWithIdealFormat() {
  console.log('\n🎯 与理想Anthropic格式的对比:');
  
  // 理想格式（基于Anthropic官方文档）
  const idealFormat = {
    "content": [
      {
        "type": "text",
        "text": "Hello! I'd be happy to help you with a simple task. What would you like assistance with?"
      }
    ],
    "id": "msg_01ABC123DEF456",
    "model": "claude-3-5-sonnet-20241022",
    "role": "assistant", 
    "stop_reason": "end_turn",
    "stop_sequence": null,
    "type": "message",
    "usage": {
      "input_tokens": 12,
      "output_tokens": 20
    }
  };
  
  // Demo2实际格式
  const demo2Data = JSON.parse(fs.readFileSync(path.join(dataDir, 'simple_greeting_non_streaming.json'), 'utf8'));
  const demo2Format = demo2Data.response.data;
  
  console.log('\n📊 字段对比:');
  console.log(`理想字段顺序: ${Object.keys(idealFormat).join(', ')}`);
  console.log(`Demo2字段顺序: ${Object.keys(demo2Format).join(', ')}`);
  
  console.log('\n🔍 关键差异:');
  
  // 字段顺序
  const idealOrder = Object.keys(idealFormat);
  const demo2Order = Object.keys(demo2Format);
  const orderMatch = JSON.stringify(idealOrder) === JSON.stringify(demo2Order);
  console.log(`字段顺序: ${orderMatch ? '✅ 匹配' : '❌ 不匹配'}`);
  
  // Content问题
  const hasContent = demo2Format.content && demo2Format.content.length > 0;
  console.log(`Content内容: ${hasContent ? '✅ 有内容' : '❌ 空数组'}`);
  
  // Model字段
  const modelMatch = idealFormat.model === demo2Format.model;
  console.log(`Model字段: ${modelMatch ? '✅ 匹配' : '❌ 不匹配'} (理想: ${idealFormat.model}, Demo2: ${demo2Format.model})`);
  
  return {
    orderMatch,
    hasContent,
    modelMatch,
    demo2Format
  };
}

function generateTestInputOutput() {
  console.log('\n📝 生成测试输入输出数据:');
  
  const testData = {
    timestamp: new Date().toISOString(),
    source: 'demo2 (kiro2cc)',
    testCases: {}
  };
  
  // 读取所有非流式响应作为参考
  const files = fs.readdirSync(dataDir).filter(f => f.includes('_non_streaming.json'));
  
  files.forEach(filename => {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8'));
    const testName = data.testCase;
    
    testData.testCases[testName] = {
      description: data.description,
      input: data.request,
      expectedOutput: data.response.data,
      metadata: {
        duration: data.duration,
        status: data.response.status
      }
    };
  });
  
  // 保存测试数据
  fs.writeFileSync('demo2-reference-data.json', JSON.stringify(testData, null, 2));
  console.log('✅ 测试参考数据已保存到: demo2-reference-data.json');
  
  return testData;
}

function identifyKeyIssues() {
  console.log('\n🚨 关键问题识别:');
  
  const issues = [];
  
  // 检查所有非流式响应的content
  const files = fs.readdirSync(dataDir).filter(f => f.includes('_non_streaming.json'));
  let emptyContentCount = 0;
  let totalCount = files.length;
  
  files.forEach(filename => {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, filename), 'utf8'));
    const content = data.response.data.content;
    
    if (!content || content.length === 0) {
      emptyContentCount++;
    }
  });
  
  if (emptyContentCount > 0) {
    issues.push(`${emptyContentCount}/${totalCount} 响应的content为空`);
  }
  
  // 检查字段顺序
  const comparison = compareWithIdealFormat();
  if (!comparison.orderMatch) {
    issues.push('字段顺序与Anthropic标准不匹配');
  }
  
  console.log('发现的问题:');
  issues.forEach((issue, i) => {
    console.log(`${i + 1}. ${issue}`);
  });
  
  if (issues.length === 0) {
    console.log('✅ 未发现明显问题');
  }
  
  return issues;
}

function main() {
  console.log('🔍 Demo2响应数据分析\n');
  
  if (!fs.existsSync(dataDir)) {
    console.error(`❌ 数据目录不存在: ${dataDir}`);
    console.log('请先运行: node test-demo2-responses.js');
    return;
  }
  
  const files = fs.readdirSync(dataDir);
  console.log(`📁 找到 ${files.length} 个数据文件`);
  
  // 分析每个响应文件
  files.forEach(filename => {
    analyzeResponse(filename);
  });
  
  // 与理想格式对比
  compareWithIdealFormat();
  
  // 生成测试数据
  generateTestInputOutput();
  
  // 识别关键问题
  identifyKeyIssues();
  
  console.log('\n✨ 分析完成!');
}

main();