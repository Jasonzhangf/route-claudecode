#!/usr/bin/env node

/**
 * 测试历史消息转换逻辑 - 更复杂的场景
 */

// 模拟更复杂的多轮对话
const scenarios = [
  {
    name: "简单多轮对话",
    messages: [
      { role: "user", content: "Hello, what's the capital of France?" },
      { role: "assistant", content: "The capital of France is Paris." },
      { role: "user", content: "What about Germany?" }
    ]
  },
  {
    name: "连续用户消息",
    messages: [
      { role: "user", content: "Hello" },
      { role: "user", content: "What's the capital of France?" },
      { role: "assistant", content: "The capital of France is Paris." },
      { role: "user", content: "What about Germany?" }
    ]
  },
  {
    name: "单轮对话",
    messages: [
      { role: "user", content: "Hello, what's the capital of France?" }
    ]
  }
];

function analyzeScenario(scenario) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📋 场景: ${scenario.name}`);
  console.log(`${'='.repeat(50)}`);
  
  const messages = scenario.messages;
  console.log('消息数组:');
  messages.forEach((msg, i) => {
    console.log(`  [${i}] ${msg.role}: "${msg.content}"`);
  });
  
  console.log(`\n总消息数: ${messages.length}`);
  console.log(`需要处理的历史消息: ${messages.length - 1} (排除最后一条)`);
  
  // 模拟我们当前的逻辑
  const history = [];
  
  for (let i = 0; i < messages.length - 1; i++) {
    const message = messages[i];
    console.log(`\n处理消息 [${i}]: ${message.role}`);
    
    if (message.role === 'user') {
      history.push({
        type: 'user',
        content: message.content
      });
      console.log(`  ✅ 添加用户消息`);
      
      // 检查下一条消息是否是助手回复
      const nextIndex = i + 1;
      if (nextIndex < messages.length - 1 && messages[nextIndex].role === 'assistant') {
        history.push({
          type: 'assistant',
          content: messages[nextIndex].content
        });
        console.log(`  ✅ 添加助手消息 [${nextIndex}]`);
        i++; // 跳过已处理的助手消息
      } else {
        console.log(`  ❌ 跳过下一条消息 [${nextIndex}] (条件不满足或不是助手消息)`);
        if (nextIndex < messages.length) {
          console.log(`    下一条消息: ${messages[nextIndex].role}`);
          console.log(`    条件检查: ${nextIndex} < ${messages.length - 1} = ${nextIndex < messages.length - 1}`);
        }
      }
    } else {
      console.log(`  ⏭️ 跳过非用户消息`);
    }
  }
  
  console.log(`\n最终历史记录长度: ${history.length}`);
  history.forEach((item, i) => {
    console.log(`  [${i}] ${item.type}: "${item.content}"`);
  });
  
  // 分析是否有遗漏的助手消息
  const assistantMessages = messages.slice(0, -1).filter(m => m.role === 'assistant');
  const capturedAssistant = history.filter(h => h.type === 'assistant');
  
  console.log(`\n📊 统计:`);
  console.log(`历史中的助手消息: ${assistantMessages.length}`);
  console.log(`捕获的助手消息: ${capturedAssistant.length}`);
  console.log(`是否完整捕获: ${assistantMessages.length === capturedAssistant.length ? '✅' : '❌'}`);
  
  return {
    totalHistory: messages.length - 1,
    capturedHistory: history.length,
    assistantInHistory: assistantMessages.length,
    capturedAssistant: capturedAssistant.length,
    complete: assistantMessages.length === capturedAssistant.length
  };
}

function main() {
  console.log('🔍 历史消息转换逻辑测试\n');
  
  const results = scenarios.map(analyzeScenario);
  
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 总结');
  console.log(`${'='.repeat(50)}`);
  
  results.forEach((result, i) => {
    const scenario = scenarios[i];
    console.log(`${scenario.name}: ${result.complete ? '✅' : '❌'}`);
    if (!result.complete) {
      console.log(`  助手消息遗漏: ${result.assistantInHistory - result.capturedAssistant}`);
    }
  });
  
  const allComplete = results.every(r => r.complete);
  console.log(`\n整体转换逻辑: ${allComplete ? '✅ 正确' : '❌ 有问题'}`);
  
  if (!allComplete) {
    console.log('\n🔧 可能的问题:');
    console.log('1. 条件 `i + 1 < messages.length - 1` 可能过于严格');
    console.log('2. 可能需要处理连续的用户消息或助手消息');
    console.log('3. 边界条件处理可能有问题');
  }
}

main();