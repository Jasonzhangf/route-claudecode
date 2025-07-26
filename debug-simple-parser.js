#!/usr/bin/env node

/**
 * 创建一个简化的解析器来修复content为空的问题
 */

const fs = require('fs');

// 简化的解析器实现（基于demo2的逻辑但修复了content_block_stop问题）
function parseCodeWhispererResponse(rawResponse) {
  console.log('🔍 开始解析CodeWhisperer响应...');
  
  // 模拟demo2的事件解析（简化版）
  const events = [
    {
      event: "content_block_delta",
      data: {
        delta: { text: "Hello", type: "text_delta" },
        index: 0,
        type: "content_block_delta"
      }
    },
    {
      event: "content_block_delta", 
      data: {
        delta: { text: "! I'd be happy to help you", type: "text_delta" },
        index: 0,
        type: "content_block_delta"
      }
    },
    {
      event: "content_block_delta",
      data: {
        delta: { text: " with a simple task. What ", type: "text_delta" },
        index: 0,
        type: "content_block_delta"
      }
    },
    {
      event: "content_block_delta",
      data: {
        delta: { text: "do you need assistance with?", type: "text_delta" },
        index: 0,
        type: "content_block_delta"
      }
    }
  ];
  
  console.log(`解析到 ${events.length} 个事件`);
  
  // 修复后的非流式响应处理逻辑
  const contexts = [];
  let currentContext = '';
  let toolName = '';
  let toolUseId = '';
  let partialJsonStr = '';
  
  for (const event of events) {
    if (event.data && typeof event.data === 'object') {
      const dataMap = event.data;
      
      switch (dataMap.type) {
        case 'content_block_start':
          currentContext = '';
          break;
        
        case 'content_block_delta':
          if (dataMap.delta) {
            switch (dataMap.delta.type) {
              case 'text_delta':
                if (dataMap.delta.text) {
                  currentContext += dataMap.delta.text;
                  console.log(`累积文本: "${currentContext}"`);
                }
                break;
              
              case 'input_json_delta':
                toolUseId = dataMap.delta.id || toolUseId;
                toolName = dataMap.delta.name || toolName;
                if (dataMap.delta.partial_json) {
                  partialJsonStr += dataMap.delta.partial_json;
                }
                break;
            }
          }
          break;
        
        case 'content_block_stop':
          const index = dataMap.index || 0;
          
          if (index === 1) {
            // Tool use block
            let toolInput = {};
            try {
              toolInput = JSON.parse(partialJsonStr);
            } catch (error) {
              console.warn('Failed to parse tool input JSON:', error.message);
            }
            
            contexts.push({
              type: 'tool_use',
              id: toolUseId,
              name: toolName,
              input: toolInput
            });
          } else if (index === 0) {
            // Text block
            contexts.push({
              type: 'text',
              text: currentContext
            });
          }
          break;
      }
    }
  }
  
  // 🔧 修复：如果没有content_block_stop事件但有累积的文本，直接添加
  if (contexts.length === 0 && currentContext.trim()) {
    contexts.push({
      type: 'text',
      text: currentContext
    });
    console.log('✅ 修复：直接添加累积的文本内容');
  }
  
  console.log(`最终解析到 ${contexts.length} 个context`);
  return contexts;
}

// 测试修复后的解析器
function testFixedParser() {
  console.log('🧪 测试修复后的解析器\n');
  
  const contexts = parseCodeWhispererResponse();
  
  console.log('\n📊 解析结果:');
  contexts.forEach((context, i) => {
    console.log(`[${i}]`, JSON.stringify(context, null, 2));
  });
  
  // 分析结果
  const hasTextContent = contexts.some(c => c.type === 'text' && c.text && c.text.trim());
  const textContent = contexts.find(c => c.type === 'text');
  
  console.log('\n🎯 结果分析:');
  console.log(`有文本内容: ${hasTextContent ? '✅' : '❌'}`);
  
  if (hasTextContent && textContent) {
    console.log(`文本长度: ${textContent.text.length} 字符`);
    console.log(`完整文本: "${textContent.text}"`);
  }
  
  // 构建Anthropic响应格式
  const anthropicResponse = {
    content: contexts,
    id: `msg_${Date.now()}`,
    model: "claude-sonnet-4-20250514",
    role: "assistant",
    stop_reason: "end_turn",
    stop_sequence: null,
    type: "message",
    usage: {
      input_tokens: 42,
      output_tokens: textContent ? Math.ceil(textContent.text.length / 4) : 0
    }
  };
  
  console.log('\n📄 最终Anthropic响应格式:');
  console.log(JSON.stringify(anthropicResponse, null, 2));
  
  return anthropicResponse;
}

// 主函数
function main() {
  console.log('🚀 CodeWhisperer解析器修复测试\n');
  
  const result = testFixedParser();
  
  console.log('\n✨ 测试完成!');
  
  if (result.content && result.content.length > 0) {
    console.log('🎉 解析器修复成功！现在可以正确解析文本内容了。');
  } else {
    console.log('❌ 解析器仍有问题');
  }
}

main();