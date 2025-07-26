#!/usr/bin/env node
/**
 * Stage 3: CodeWhisperer格式转换测试
 * 基于demo2的转换逻辑测试BaseRequest到CodeWhisperer格式的转换
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🧪 Stage 3: CodeWhisperer格式转换测试');
console.log('====================================\n');

// 读取Stage 2的输出
const stage2OutputPath = path.join(__dirname, 'stage2-routing-result.json');

if (!fs.existsSync(stage2OutputPath)) {
  console.error('❌ 找不到Stage 2的输出文件');
  console.log('💡 请先运行 test-stage2-routing.js');
  process.exit(1);
}

const routingResult = JSON.parse(fs.readFileSync(stage2OutputPath, 'utf8'));
const baseRequest = routingResult.baseRequest;

console.log('📋 输入的路由结果:');
console.log(`   Provider: ${routingResult.routing.providerId}`);
console.log(`   Category: ${routingResult.routing.category}`);
console.log(`   Model: ${baseRequest.model}`);
console.log(`   Messages: ${baseRequest.messages.length}`);

// 基于demo2的模型映射
const ModelMap = {
  "claude-sonnet-4-20250514": "CLAUDE_SONNET_4_20250514_V1_0",
  "claude-3-5-haiku-20241022": "CLAUDE_3_7_SONNET_20250219_V1_0"
};

// 生成UUID（基于demo2）
function generateUUID() {
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant bits
  
  const hex = bytes.toString('hex');
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}

// 从消息中提取文本内容（基于demo2）
function getMessageContent(content) {
  if (typeof content === 'string') {
    return content.length === 0 ? "answer for user question" : content;
  }
  
  if (Array.isArray(content)) {
    const texts = [];
    content.forEach(block => {
      if (block && typeof block === 'object') {
        switch (block.type) {
          case 'tool_result':
            if (block.content) texts.push(block.content);
            break;
          case 'text':
            if (block.text) texts.push(block.text);
            break;
        }
      }
    });
    
    if (texts.length === 0) {
      console.log(`   ⚠️  复杂content结构: ${JSON.stringify(content).substring(0, 100)}...`);
      return "answer for user question";
    }
    
    return texts.join('\n');
  }
  
  console.log(`   ⚠️  未知content类型: ${typeof content}`);
  return "answer for user question";
}

// 构建CodeWhisperer请求（基于demo2）
function buildCodeWhispererRequest(anthropicReq) {
  console.log('\n🔧 构建CodeWhisperer请求:');
  
  const profileArn = "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK";
  const conversationId = generateUUID();
  
  console.log(`   Profile ARN: ${profileArn}`);
  console.log(`   Conversation ID: ${conversationId}`);
  
  const cwReq = {
    conversationState: {
      chatTriggerType: "MANUAL",
      conversationId: conversationId,
      currentMessage: {
        userInputMessage: {
          content: "",
          modelId: "",
          origin: "AI_EDITOR",
          userInputMessageContext: {
            toolResults: [],
            tools: []
          }
        }
      },
      history: []
    },
    profileArn: profileArn
  };
  
  // 设置当前消息内容
  const lastMessage = anthropicReq.messages[anthropicReq.messages.length - 1];
  const messageContent = getMessageContent(lastMessage.content);
  cwReq.conversationState.currentMessage.userInputMessage.content = messageContent;
  
  console.log(`   消息内容长度: ${messageContent.length} 字符`);
  console.log(`   消息预览: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}`);
  
  // 设置模型ID
  const originalModel = anthropicReq.model;
  const mappedModelId = ModelMap[originalModel];
  
  if (mappedModelId) {
    cwReq.conversationState.currentMessage.userInputMessage.modelId = mappedModelId;
    console.log(`   模型映射: ${originalModel} -> ${mappedModelId}`);
  } else {
    console.log(`   ⚠️  未找到模型映射: ${originalModel}`);
    cwReq.conversationState.currentMessage.userInputMessage.modelId = originalModel;
  }
  
  // 处理工具（如果有）
  if (anthropicReq.tools && anthropicReq.tools.length > 0) {
    console.log(`   处理 ${anthropicReq.tools.length} 个工具...`);
    
    const tools = [];
    anthropicReq.tools.forEach((tool, index) => {
      const cwTool = {
        toolSpecification: {
          name: tool.name,
          description: tool.description,
          inputSchema: {
            json: tool.input_schema
          }
        }
      };
      tools.push(cwTool);
      console.log(`     工具 ${index + 1}: ${tool.name}`);
    });
    
    cwReq.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools = tools;
  }
  
  // 构建历史消息
  if (anthropicReq.messages.length > 1) {
    console.log(`   构建历史消息: ${anthropicReq.messages.length - 1} 条历史记录`);
    
    const history = [];
    
    // 处理除最后一条消息外的所有消息
    for (let i = 0; i < anthropicReq.messages.length - 1; i++) {
      const message = anthropicReq.messages[i];
      
      if (message.role === 'user') {
        const userMsg = {
          userInputMessage: {
            content: getMessageContent(message.content),
            modelId: mappedModelId || originalModel,
            origin: "AI_EDITOR"
          }
        };
        history.push(userMsg);
        
        // 如果下一条消息是assistant回复，也添加进去
        if (i + 1 < anthropicReq.messages.length - 1 && 
            anthropicReq.messages[i + 1].role === 'assistant') {
          const assistantMsg = {
            assistantResponseMessage: {
              content: getMessageContent(anthropicReq.messages[i + 1].content),
              toolUses: []
            }
          };
          history.push(assistantMsg);
          i++; // 跳过已处理的assistant消息
        }
      }
    }
    
    cwReq.conversationState.history = history;
    console.log(`     实际历史记录数: ${history.length}`);
  }
  
  return cwReq;
}

// 执行转换
console.log('\n🔄 执行格式转换...');

try {
  const cwRequest = buildCodeWhispererRequest(baseRequest);
  
  console.log('\n📊 转换结果分析:');
  console.log(`   对话ID: ${cwRequest.conversationState.conversationId}`);
  console.log(`   触发类型: ${cwRequest.conversationState.chatTriggerType}`);
  console.log(`   当前消息长度: ${cwRequest.conversationState.currentMessage.userInputMessage.content.length}`);
  console.log(`   模型ID: ${cwRequest.conversationState.currentMessage.userInputMessage.modelId}`);
  console.log(`   历史记录数: ${cwRequest.conversationState.history.length}`);
  console.log(`   工具数: ${cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools.length}`);
  
  // 验证请求完整性
  console.log('\n🔍 验证请求完整性:');
  
  const requiredFields = [
    'conversationState.conversationId',
    'conversationState.currentMessage.userInputMessage.content',
    'conversationState.currentMessage.userInputMessage.modelId',
    'profileArn'
  ];
  
  let isValid = true;
  requiredFields.forEach(fieldPath => {
    const value = fieldPath.split('.').reduce((obj, key) => obj?.[key], cwRequest);
    if (!value) {
      console.log(`   ❌ 缺少必需字段: ${fieldPath}`);
      isValid = false;
    } else {
      console.log(`   ✅ ${fieldPath}: ${typeof value === 'string' ? value.substring(0, 50) + '...' : typeof value}`);
    }
  });
  
  if (isValid) {
    console.log('\n✅ 请求格式验证通过');
  } else {
    console.log('\n❌ 请求格式验证失败');
  }
  
  // 计算请求大小
  const requestJson = JSON.stringify(cwRequest);
  const requestSize = Buffer.byteLength(requestJson, 'utf8');
  console.log(`\n📏 请求大小: ${requestSize} 字节 (${(requestSize / 1024).toFixed(2)} KB)`);
  
  // 构建完整结果
  const result = {
    originalRequest: baseRequest,
    routing: routingResult.routing,
    codewhispererRequest: cwRequest,
    conversion: {
      originalModel: baseRequest.model,
      mappedModelId: cwRequest.conversationState.currentMessage.userInputMessage.modelId,
      contentLength: cwRequest.conversationState.currentMessage.userInputMessage.content.length,
      historyCount: cwRequest.conversationState.history.length,
      toolsCount: cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools.length,
      requestSize: requestSize,
      valid: isValid
    },
    timestamp: new Date().toISOString()
  };
  
  // 保存转换结果
  const outputPath = path.join(__dirname, 'stage3-codewhisperer-request.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  
  console.log(`\n✅ Stage 3 完成！转换结果已保存到: ${outputPath}`);
  console.log('💡 可以继续运行 Stage 4: test-stage4-response-simulation.js');
  
} catch (error) {
  console.error('\n❌ 转换过程中发生错误:', error.message);
  console.error('📚 错误堆栈:', error.stack);
  process.exit(1);
}