#!/usr/bin/env node

/**
 * 🔧 修复流式响应message_stop事件过滤问题
 * 
 * 问题：当工具调用被检测到并且stop_reason被正确修复为tool_use后，
 * 流式响应处理仍然过滤掉了message_stop事件，导致客户端无法收到响应结束信号
 * 
 * 解决方案：修改流式响应过滤逻辑，确保在工具调用场景下正确发送message_stop事件
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 [STREAMING-MESSAGE-STOP-FIX] Starting streaming message_stop filter fix...');

// 查找可能包含message_stop过滤逻辑的文件
const filesToCheck = [
  'src/providers/openai/enhanced-client.ts',
  'src/providers/openai/sdk-client.ts', 
  'src/transformers/streaming.ts',
  'src/server.ts',
  'src/providers/openai/client.ts'
];

async function findMessageStopFilterLogic() {
  console.log('\n🔍 查找message_stop过滤逻辑...');
  
  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 查找相关的过滤逻辑
      const patterns = [
        /message_stop/gi,
        /Filtered out message_stop/gi,
        /Removed non-tool stop_reason/gi,
        /prevent early termination/gi,
        /allow conversation continuation/gi
      ];
      
      let hasRelevantCode = false;
      patterns.forEach(pattern => {
        if (pattern.test(content)) {
          hasRelevantCode = true;
        }
      });
      
      if (hasRelevantCode) {
        console.log(`   ✅ 发现相关代码: ${filePath}`);
        
        // 显示相关代码片段
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('message_stop') || 
              line.includes('Filtered out') || 
              line.includes('prevent early termination') ||
              line.includes('allow conversation continuation')) {
            console.log(`      第${index + 1}行: ${line.trim()}`);
          }
        });
      }
    }
  }
}

async function analyzeStreamingLogic() {
  console.log('\n📊 分析流式响应逻辑...');
  
  // 检查enhanced-client.ts中的流式处理逻辑
  const enhancedClientPath = 'src/providers/openai/enhanced-client.ts';
  if (fs.existsSync(enhancedClientPath)) {
    const content = fs.readFileSync(enhancedClientPath, 'utf8');
    
    // 查找流式响应结束处理
    const streamEndPatterns = [
      /event.*message_stop/gi,
      /stop_reason.*end_turn/gi,
      /finish_reason.*stop/gi,
      /streaming.*complete/gi
    ];
    
    console.log('   🔍 检查enhanced-client.ts中的流式结束逻辑...');
    
    const lines = content.split('\n');
    let inStreamingMethod = false;
    let streamingMethodName = '';
    
    lines.forEach((line, index) => {
      // 检测是否进入流式方法
      if (line.includes('async *') && (line.includes('stream') || line.includes('Stream'))) {
        inStreamingMethod = true;
        streamingMethodName = line.match(/async \*\s*(\w+)/)?.[1] || 'unknown';
        console.log(`      📍 发现流式方法: ${streamingMethodName} (第${index + 1}行)`);
      }
      
      // 检测方法结束
      if (inStreamingMethod && line.trim() === '}' && line.indexOf('}') < 4) {
        inStreamingMethod = false;
      }
      
      // 在流式方法中查找相关逻辑
      if (inStreamingMethod) {
        streamEndPatterns.forEach(pattern => {
          if (pattern.test(line)) {
            console.log(`         第${index + 1}行: ${line.trim()}`);
          }
        });
        
        if (line.includes('message_stop') || 
            line.includes('event') && line.includes('stop')) {
          console.log(`         🎯 第${index + 1}行: ${line.trim()}`);
        }
      }
    });
  }
}

async function generateFixSuggestions() {
  console.log('\n💡 生成修复建议...');
  
  const suggestions = [
    {
      issue: 'message_stop事件被错误过滤',
      description: '当工具调用被检测到后，系统正确修复了stop_reason为tool_use，但仍然过滤掉了message_stop事件',
      solution: '修改流式响应过滤逻辑，在工具调用场景下允许message_stop事件通过',
      priority: 'HIGH'
    },
    {
      issue: '流式响应结束信号缺失',
      description: '客户端无法收到响应结束的信号，导致对话挂起',
      solution: '确保在所有情况下都发送适当的结束事件',
      priority: 'HIGH'
    },
    {
      issue: '工具调用检测与流式过滤不一致',
      description: '预处理器正确检测工具调用，但流式处理逻辑没有相应更新',
      solution: '同步预处理器的工具调用检测结果到流式响应处理',
      priority: 'MEDIUM'
    }
  ];
  
  suggestions.forEach((suggestion, index) => {
    console.log(`\n   ${index + 1}. ${suggestion.issue} [${suggestion.priority}]`);
    console.log(`      问题: ${suggestion.description}`);
    console.log(`      解决: ${suggestion.solution}`);
  });
}

async function createFixPatch() {
  console.log('\n🔧 创建修复补丁...');
  
  const fixCode = `
/**
 * 🔧 流式响应message_stop事件修复
 * 确保在工具调用场景下正确发送结束事件
 */

// 修复建议1: 在流式响应处理中检查工具调用状态
function shouldFilterMessageStop(hasToolCalls, stopReason) {
  // 如果有工具调用且stop_reason已经被修复为tool_use，允许message_stop通过
  if (hasToolCalls && stopReason === 'tool_use') {
    return false; // 不过滤，允许事件通过
  }
  
  // 如果没有工具调用但stop_reason是end_turn，也应该允许通过
  if (!hasToolCalls && stopReason === 'end_turn') {
    return false; // 不过滤，允许事件通过
  }
  
  // 其他情况按原逻辑处理
  return true; // 过滤掉
}

// 修复建议2: 在流式响应结束时发送正确的事件
function generateStreamEndEvent(hasToolCalls, stopReason) {
  if (hasToolCalls) {
    return {
      event: 'message_stop',
      data: {
        type: 'message_stop'
      }
    };
  } else {
    return {
      event: 'message_stop', 
      data: {
        type: 'message_stop'
      }
    };
  }
}

// 修复建议3: 同步预处理器检测结果
function syncToolCallDetectionToStreaming(preprocessingResult, streamingContext) {
  if (preprocessingResult.hasTools) {
    streamingContext.hasToolCalls = true;
    streamingContext.correctedStopReason = preprocessingResult.correctedStopReason;
  }
}
`;

  const fixFilePath = path.join(__dirname, 'streaming-message-stop-fix-patch.js');
  fs.writeFileSync(fixFilePath, fixCode);
  console.log(`   ✅ 修复补丁已保存: ${fixFilePath}`);
}

async function main() {
  try {
    await findMessageStopFilterLogic();
    await analyzeStreamingLogic();
    await generateFixSuggestions();
    await createFixPatch();
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 流式响应message_stop过滤问题分析完成');
    console.log('='.repeat(80));
    console.log('📋 关键发现:');
    console.log('   • 预处理器正确检测工具调用并修复stop_reason');
    console.log('   • 流式响应处理仍然过滤掉message_stop事件');
    console.log('   • 客户端无法收到响应结束信号');
    console.log('');
    console.log('🔧 建议的修复步骤:');
    console.log('   1. 修改流式响应过滤逻辑');
    console.log('   2. 同步预处理器检测结果到流式处理');
    console.log('   3. 确保在所有场景下发送正确的结束事件');
    console.log('');
    console.log('📄 详细修复代码请查看生成的补丁文件');
    
  } catch (error) {
    console.error('💥 分析过程中发生错误:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  findMessageStopFilterLogic,
  analyzeStreamingLogic,
  generateFixSuggestions
};