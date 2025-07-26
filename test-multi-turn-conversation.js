#!/usr/bin/env node

/**
 * 测试多轮对话功能
 * 模拟Claude Code的多轮对话行为
 */

const axios = require('axios');

// 模拟Claude Code的会话管理
class ConversationSession {
  constructor(baseUrl = 'http://localhost:3456') {
    this.baseUrl = baseUrl;
    this.sessionId = `session_${Date.now()}`;
    this.conversationHistory = [];
  }

  async sendMessage(content, options = {}) {
    const message = {
      role: 'user',
      content: content
    };

    // 构建完整的消息历史
    const messages = [...this.conversationHistory, message];

    const request = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: messages,
      ...options
    };

    console.log(`\n📤 发送消息 (轮次 ${Math.floor(this.conversationHistory.length / 2) + 1}):`);
    console.log(`用户: ${content}`);
    console.log(`历史消息数: ${this.conversationHistory.length}`);

    try {
      const response = await axios.post(`${this.baseUrl}/v1/messages`, request, {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-session-id': this.sessionId // 添加会话ID
        },
        timeout: 30000
      });

      const assistantMessage = {
        role: 'assistant',
        content: this.extractTextContent(response.data.content)
      };

      // 更新对话历史
      this.conversationHistory.push(message);
      this.conversationHistory.push(assistantMessage);

      console.log(`✅ 助手回复: ${assistantMessage.content}`);
      console.log(`响应状态: ${response.status}`);
      console.log(`Content blocks: ${response.data.content?.length || 0}`);

      return {
        success: true,
        response: response.data,
        assistantMessage: assistantMessage.content
      };

    } catch (error) {
      console.error(`❌ 请求失败: ${error.message}`);
      if (error.response) {
        console.error(`状态码: ${error.response.status}`);
        console.error(`错误数据:`, error.response.data);
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  extractTextContent(content) {
    if (!content || !Array.isArray(content)) {
      return 'No content';
    }

    return content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join(' ')
      .trim() || 'Empty response';
  }

  getConversationSummary() {
    return {
      sessionId: this.sessionId,
      totalMessages: this.conversationHistory.length,
      userMessages: this.conversationHistory.filter(m => m.role === 'user').length,
      assistantMessages: this.conversationHistory.filter(m => m.role === 'assistant').length
    };
  }
}

async function testMultiTurnConversation() {
  console.log('🚀 开始多轮对话测试\n');

  const session = new ConversationSession();

  // 第一轮对话
  console.log('=' .repeat(60));
  console.log('第一轮对话');
  console.log('=' .repeat(60));

  const turn1 = await session.sendMessage("Hello, what's the capital of France?");
  if (!turn1.success) {
    console.error('第一轮对话失败，停止测试');
    return;
  }

  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 第二轮对话 - 测试上下文理解
  console.log('=' .repeat(60));
  console.log('第二轮对话');
  console.log('=' .repeat(60));

  const turn2 = await session.sendMessage("What about Germany?");
  if (!turn2.success) {
    console.error('第二轮对话失败');
    return;
  }

  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 第三轮对话 - 测试更深的上下文
  console.log('=' .repeat(60));
  console.log('第三轮对话');
  console.log('=' .repeat(60));

  const turn3 = await session.sendMessage("Can you compare these two countries?");
  if (!turn3.success) {
    console.error('第三轮对话失败');
    return;
  }

  // 显示对话总结
  console.log('\n' + '=' .repeat(60));
  console.log('对话总结');
  console.log('=' .repeat(60));

  const summary = session.getConversationSummary();
  console.log(`会话ID: ${summary.sessionId}`);
  console.log(`总消息数: ${summary.totalMessages}`);
  console.log(`用户消息: ${summary.userMessages}`);
  console.log(`助手消息: ${summary.assistantMessages}`);

  // 分析多轮对话质量
  console.log('\n📊 多轮对话质量分析:');
  
  const turn2Quality = analyzeTurnQuality(turn2.assistantMessage, "Germany", ["Berlin", "capital"]);
  const turn3Quality = analyzeTurnQuality(turn3.assistantMessage, "compare", ["France", "Germany", "Paris", "Berlin"]);

  console.log(`第二轮质量: ${turn2Quality.score}/10 (${turn2Quality.reason})`);
  console.log(`第三轮质量: ${turn3Quality.score}/10 (${turn3Quality.reason})`);

  const overallQuality = (turn2Quality.score + turn3Quality.score) / 2;
  console.log(`\n总体多轮对话质量: ${overallQuality.toFixed(1)}/10`);

  if (overallQuality >= 7) {
    console.log('✅ 多轮对话功能正常');
  } else if (overallQuality >= 4) {
    console.log('⚠️ 多轮对话功能部分正常，需要改进');
  } else {
    console.log('❌ 多轮对话功能存在问题');
  }

  return {
    success: true,
    summary,
    quality: overallQuality,
    turns: [turn1, turn2, turn3]
  };
}

function analyzeTurnQuality(response, expectedTopic, expectedKeywords) {
  let score = 0;
  let reasons = [];

  // 检查是否有实际内容
  if (response && response !== 'No content' && response !== 'Empty response') {
    score += 3;
    reasons.push('有实际回复');
  } else {
    reasons.push('无实际回复');
    return { score: 0, reason: reasons.join(', ') };
  }

  // 检查是否包含预期主题
  if (response.toLowerCase().includes(expectedTopic.toLowerCase())) {
    score += 3;
    reasons.push('包含预期主题');
  } else {
    reasons.push('缺少预期主题');
  }

  // 检查是否包含预期关键词
  const foundKeywords = expectedKeywords.filter(keyword => 
    response.toLowerCase().includes(keyword.toLowerCase())
  );

  if (foundKeywords.length > 0) {
    score += Math.min(4, foundKeywords.length * 2);
    reasons.push(`包含${foundKeywords.length}个关键词`);
  } else {
    reasons.push('缺少关键词');
  }

  return {
    score: Math.min(10, score),
    reason: reasons.join(', ')
  };
}

async function compareWithDemo2() {
  console.log('\n🔍 与Demo2对比测试...');

  try {
    // 测试demo2的多轮对话
    const demo2Session = new ConversationSession('http://localhost:8080');
    
    console.log('\n📤 Demo2 - 第一轮:');
    const demo2Turn1 = await demo2Session.sendMessage("Hello, what's the capital of France?");
    
    if (demo2Turn1.success) {
      console.log('\n📤 Demo2 - 第二轮:');
      const demo2Turn2 = await demo2Session.sendMessage("What about Germany?");
      
      if (demo2Turn2.success) {
        console.log('\n📊 Demo2多轮对话结果:');
        const demo2Quality = analyzeTurnQuality(demo2Turn2.assistantMessage, "Germany", ["Berlin", "capital"]);
        console.log(`Demo2第二轮质量: ${demo2Quality.score}/10 (${demo2Quality.reason})`);
        
        return demo2Quality.score;
      }
    }
  } catch (error) {
    console.log('❌ Demo2测试失败:', error.message);
  }
  
  return 0;
}

async function main() {
  console.log('🧪 多轮对话功能测试\n');

  // 检查服务器状态
  try {
    await axios.get('http://localhost:3456/health', { timeout: 5000 });
    console.log('✅ 我们的路由器运行正常');
  } catch (error) {
    console.error('❌ 我们的路由器未运行');
    return;
  }

  // 测试我们的多轮对话
  const ourResult = await testMultiTurnConversation();

  // 与demo2对比
  const demo2Quality = await compareWithDemo2();

  // 最终对比
  if (ourResult && demo2Quality > 0) {
    console.log('\n🏆 最终对比:');
    console.log(`我们的质量: ${ourResult.quality.toFixed(1)}/10`);
    console.log(`Demo2质量: ${demo2Quality}/10`);
    
    if (ourResult.quality >= demo2Quality) {
      console.log('✅ 我们的多轮对话质量不低于Demo2');
    } else {
      console.log('❌ 我们的多轮对话质量低于Demo2');
    }
  }

  console.log('\n✨ 测试完成!');
}

main().catch(console.error);