#!/usr/bin/env node

/**
 * 模拟实际的请求流程，查看转换结果
 */

// 模拟多轮对话请求（Claude Code发送的）
const multiTurnRequest = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  messages: [
    {
      role: "user",
      content: "Hello, what's the capital of France?"
    },
    {
      role: "assistant", 
      content: "The capital of France is Paris."
    },
    {
      role: "user",
      content: "What about Germany?"
    }
  ]
};

// 模拟我们的转换逻辑
function simulateConversion(request) {
  console.log('🔄 模拟转换过程\n');
  
  console.log('📥 输入请求:');
  console.log(`模型: ${request.model}`);
  console.log(`消息数量: ${request.messages.length}`);
  request.messages.forEach((msg, i) => {
    console.log(`  [${i}] ${msg.role}: "${msg.content}"`);
  });
  
  // 模拟转换逻辑
  const modelId = "CLAUDE_SONNET_4_20250514_V1_0";
  const conversationId = `test-conversation-${Date.now()}`;
  
  // 当前消息（最后一条）
  const currentMessage = request.messages[request.messages.length - 1];
  console.log(`\n📝 当前消息: ${currentMessage.role} - "${currentMessage.content}"`);
  
  // 构建历史记录
  const history = [];
  const hasMultipleMessages = request.messages.length > 1;
  
  console.log(`\n📚 构建历史记录:`);
  console.log(`有多条消息: ${hasMultipleMessages}`);
  
  if (hasMultipleMessages) {
    console.log(`处理 ${request.messages.length - 1} 条历史消息:`);
    
    for (let i = 0; i < request.messages.length - 1; i++) {
      const message = request.messages[i];
      console.log(`\n  处理消息 [${i}]: ${message.role}`);
      
      if (message.role === 'user') {
        const userMsg = {
          userInputMessage: {
            content: message.content,
            modelId: modelId,
            origin: "AI_EDITOR"
          }
        };
        history.push(userMsg);
        console.log(`    ✅ 添加用户消息`);
        
        // 检查下一条是否是助手消息
        if (i + 1 < request.messages.length - 1 && request.messages[i + 1].role === 'assistant') {
          const assistantMsg = {
            assistantResponseMessage: {
              content: request.messages[i + 1].content,
              toolUses: []
            }
          };
          history.push(assistantMsg);
          console.log(`    ✅ 添加助手消息 [${i + 1}]`);
          i++; // 跳过已处理的助手消息
        } else {
          console.log(`    ❌ 没有对应的助手消息或条件不满足`);
          if (i + 1 < request.messages.length) {
            console.log(`      下一条消息 [${i + 1}]: ${request.messages[i + 1].role}`);
            console.log(`      条件: ${i + 1} < ${request.messages.length - 1} = ${i + 1 < request.messages.length - 1}`);
          }
        }
      }
    }
  }
  
  // 构建CodeWhisperer请求
  const cwRequest = {
    conversationState: {
      chatTriggerType: "MANUAL",
      conversationId: conversationId,
      currentMessage: {
        userInputMessage: {
          content: currentMessage.content,
          modelId: modelId,
          origin: "AI_EDITOR",
          userInputMessageContext: {}
        }
      },
      history: history
    },
    profileArn: "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK"
  };
  
  console.log(`\n📤 转换结果:`);
  console.log(`ConversationId: ${cwRequest.conversationState.conversationId}`);
  console.log(`当前消息内容: "${cwRequest.conversationState.currentMessage.userInputMessage.content}"`);
  console.log(`历史记录长度: ${cwRequest.conversationState.history.length}`);
  
  console.log(`\n📋 历史记录详情:`);
  cwRequest.conversationState.history.forEach((item, i) => {
    if (item.userInputMessage) {
      console.log(`  [${i}] USER: "${item.userInputMessage.content}"`);
    } else if (item.assistantResponseMessage) {
      console.log(`  [${i}] ASSISTANT: "${item.assistantResponseMessage.content}"`);
    }
  });
  
  // 分析问题
  console.log(`\n🔍 问题分析:`);
  const expectedHistoryLength = 2; // 应该有1个用户消息 + 1个助手消息
  const actualHistoryLength = cwRequest.conversationState.history.length;
  
  console.log(`期望历史长度: ${expectedHistoryLength}`);
  console.log(`实际历史长度: ${actualHistoryLength}`);
  console.log(`历史记录正确: ${actualHistoryLength === expectedHistoryLength ? '✅' : '❌'}`);
  
  // 检查是否包含了助手的回复
  const hasAssistantInHistory = cwRequest.conversationState.history.some(item => item.assistantResponseMessage);
  console.log(`包含助手回复: ${hasAssistantInHistory ? '✅' : '❌'}`);
  
  if (!hasAssistantInHistory) {
    console.log(`\n🚨 问题: 历史记录中缺少助手回复！`);
    console.log(`这会导致CodeWhisperer无法理解对话上下文。`);
  }
  
  return cwRequest;
}

function main() {
  console.log('🧪 多轮对话转换测试\n');
  
  const result = simulateConversion(multiTurnRequest);
  
  console.log('\n✨ 测试完成!');
  
  // 保存结果用于进一步分析
  require('fs').writeFileSync('debug-conversion-result.json', JSON.stringify(result, null, 2));
  console.log('📄 转换结果已保存到: debug-conversion-result.json');
}

main();