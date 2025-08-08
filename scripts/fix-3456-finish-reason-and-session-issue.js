#!/usr/bin/env node

/**
 * 修复3456端口finish reason没有更新和会话停止的问题
 * 
 * 修复点：
 * 1. 确保预处理器正确检测工具调用
 * 2. 确保finish_reason被正确修复为tool_use
 * 3. 确保hasToolUse变量被正确设置
 * 4. 确保message_stop事件在工具调用场景下被正确过滤
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 修复3456端口finish reason和会话停止问题...\n');

// 1. 修复服务器中的hasToolUse检测逻辑
function fixServerToolUseDetection() {
  console.log('1️⃣ 修复服务器中的hasToolUse检测逻辑...');
  
  const serverPath = path.join(process.cwd(), 'src/server.ts');
  let content = fs.readFileSync(serverPath, 'utf8');
  
  // 确保hasToolUse在检测到工具调用时被正确设置
  const hasToolUsePattern = /if \(isToolUse\) \{[\s\S]*?hasToolUse = true;/;
  
  if (!hasToolUsePattern.test(content)) {
    console.log('❌ 未找到hasToolUse设置逻辑，需要添加');
    
    // 查找message_delta处理逻辑
    const messageDeltaPattern = /(if \(processedChunk\.event === 'message_delta'[\s\S]*?const isToolUse = stopReason === 'tool_use';)/;
    const match = content.match(messageDeltaPattern);
    
    if (match) {
      const replacement = match[1] + `
          
          // 🔧 Critical Fix: 确保hasToolUse被正确设置
          if (isToolUse) {
            hasToolUse = true;
            console.log('🎯 [SERVER] hasToolUse set to true for tool_use stop_reason', { requestId, stopReason });
          }`;
      
      content = content.replace(match[1], replacement);
      console.log('✅ 添加了hasToolUse设置逻辑');
    }
  } else {
    console.log('✅ hasToolUse设置逻辑已存在');
  }
  
  // 确保message_stop事件处理逻辑正确
  const messageStopPattern = /} else if \(processedChunk\.event === 'message_stop'\) \{[\s\S]*?if \(hasToolUse\) \{[\s\S]*?} else \{[\s\S]*?}/;
  
  if (!messageStopPattern.test(content)) {
    console.log('❌ message_stop处理逻辑需要修复');
    
    // 查找现有的message_stop处理
    const existingPattern = /} else if \(processedChunk\.event === 'message_stop'\) \{[\s\S]*?}/;
    const existingMatch = content.match(existingPattern);
    
    if (existingMatch) {
      const replacement = `} else if (processedChunk.event === 'message_stop') {
          // 🔧 Critical Fix: 工具调用场景下不发送message_stop，保持对话开放
          if (hasToolUse) {
            console.log('🚫 [SERVER] Skipping message_stop for tool_use scenario to keep conversation open', { 
              requestId, 
              hasToolUse,
              stopReason: 'tool_use'
            });
            
            this.logger.debug('Skipping message_stop for tool_use scenario to keep conversation open', { 
              requestId, 
              hasToolUse 
            }, requestId, 'server');
            
            // 不发送message_stop，让对话保持开放状态等待工具执行结果
          } else {
            // 非工具调用场景正常发送message_stop
            this.sendSSEEvent(reply, processedChunk.event, processedChunk.data);
            console.log('✅ [SERVER] Sent message_stop for non-tool scenario', { requestId });
            
            this.logger.debug('Sent message_stop event for non-tool scenario', { requestId }, requestId, 'server');
          }
        }`;
      
      content = content.replace(existingMatch[0], replacement);
      console.log('✅ 修复了message_stop处理逻辑');
    }
  } else {
    console.log('✅ message_stop处理逻辑已正确');
  }
  
  fs.writeFileSync(serverPath, content);
  console.log('✅ 服务器修复完成\n');
}

// 2. 修复预处理器的工具调用检测
function fixPreprocessorToolDetection() {
  console.log('2️⃣ 修复预处理器的工具调用检测...');
  
  const preprocessorPath = path.join(process.cwd(), 'src/preprocessing/unified-patch-preprocessor.ts');
  let content = fs.readFileSync(preprocessorPath, 'utf8');
  
  // 确保工具调用检测逻辑正确
  const toolDetectionPattern = /detectToolCalls\(data: any\): number/;
  
  if (toolDetectionPattern.test(content)) {
    console.log('✅ 工具调用检测方法已存在');
    
    // 检查是否有详细的调试日志
    const debugLogPattern = /console\.log\(`🔍 \[PREPROCESSING\] Tool detection result:/;
    
    if (!debugLogPattern.test(content)) {
      console.log('❌ 缺少详细的调试日志，添加中...');
      
      // 查找detectToolCalls方法的结尾
      const methodPattern = /(detectToolCalls\(data: any\): number \{[\s\S]*?return toolCount;)/;
      const match = content.match(methodPattern);
      
      if (match) {
        const replacement = match[1].replace(
          'return toolCount;',
          `console.log(\`🔍 [PREPROCESSING] Tool detection result: \${toolCount} tools found\`, {
            hasChoices: !!(data.choices && data.choices.length > 0),
            hasContent: !!(data.content && data.content.length > 0),
            dataKeys: Object.keys(data)
          });
          
          return toolCount;`
        );
        
        content = content.replace(match[1], replacement);
        console.log('✅ 添加了详细的调试日志');
      }
    } else {
      console.log('✅ 调试日志已存在');
    }
  } else {
    console.log('❌ 工具调用检测方法不存在，需要检查');
  }
  
  // 确保finish_reason强制覆盖逻辑正确
  const forceOverridePattern = /forceFinishReasonOverride\(data: any, toolCount: number\): any/;
  
  if (forceOverridePattern.test(content)) {
    console.log('✅ finish_reason强制覆盖方法已存在');
    
    // 检查是否有详细的调试日志
    const overrideLogPattern = /console\.log\(`🔧 \[PREPROCESSING\] Forced finish_reason override/;
    
    if (!overrideLogPattern.test(content)) {
      console.log('❌ 缺少覆盖调试日志，添加中...');
      
      // 查找forceFinishReasonOverride方法
      const overrideMethodPattern = /(forceFinishReasonOverride\(data: any, toolCount: number\): any \{[\s\S]*?return data;)/;
      const overrideMatch = content.match(overrideMethodPattern);
      
      if (overrideMatch) {
        const replacement = overrideMatch[1].replace(
          'return data;',
          `console.log(\`🔧 [PREPROCESSING] Forced finish_reason override for \${toolCount} tools\`, {
            targetReason: 'tool_use',
            hasChoices: !!(data.choices && data.choices.length > 0),
            hasStopReason: data.stop_reason !== undefined
          });
          
          return data;`
        );
        
        content = content.replace(overrideMatch[1], replacement);
        console.log('✅ 添加了覆盖调试日志');
      }
    } else {
      console.log('✅ 覆盖调试日志已存在');
    }
  } else {
    console.log('❌ finish_reason强制覆盖方法不存在，需要检查');
  }
  
  fs.writeFileSync(preprocessorPath, content);
  console.log('✅ 预处理器修复完成\n');
}

// 3. 验证SDK客户端的工具调用处理
function verifySdkClientToolHandling() {
  console.log('3️⃣ 验证SDK客户端的工具调用处理...');
  
  const sdkClientPath = path.join(process.cwd(), 'src/providers/openai/sdk-client.ts');
  let content = fs.readFileSync(sdkClientPath, 'utf8');
  
  // 检查是否有工具调用检测逻辑
  const toolCallPattern = /content_block.*tool_use/;
  
  if (toolCallPattern.test(content)) {
    console.log('✅ SDK客户端包含工具调用处理逻辑');
  } else {
    console.log('❌ SDK客户端缺少工具调用处理逻辑');
  }
  
  // 检查finish_reason映射
  const finishReasonPattern = /mapFinishReason.*tool/;
  
  if (finishReasonPattern.test(content)) {
    console.log('✅ SDK客户端包含finish_reason映射逻辑');
  } else {
    console.log('❌ SDK客户端缺少finish_reason映射逻辑');
  }
  
  console.log('✅ SDK客户端验证完成\n');
}

// 4. 创建测试脚本
function createTestScript() {
  console.log('4️⃣ 创建测试脚本...');
  
  const testScript = `#!/usr/bin/env node

/**
 * 快速测试3456端口的工具调用功能
 */

const axios = require('axios');

async function quickTest() {
  console.log('🧪 快速测试3456端口工具调用...');
  
  try {
    const response = await axios.post('http://localhost:3456/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: '请读取README.md文件' }],
      tools: [{
        name: 'Read',
        description: 'Read file contents',
        input_schema: {
          type: 'object',
          properties: { file_path: { type: 'string' } },
          required: ['file_path']
        }
      }],
      stream: true
    }, {
      responseType: 'stream',
      timeout: 15000
    });
    
    let hasToolUse = false;
    let hasMessageStop = false;
    
    return new Promise((resolve) => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.event === 'content_block_start' && data.data?.content_block?.type === 'tool_use') {
                console.log('✅ 检测到工具调用');
                hasToolUse = true;
              }
              
              if (data.event === 'message_delta' && data.data?.delta?.stop_reason === 'tool_use') {
                console.log('✅ 收到tool_use stop_reason');
              }
              
              if (data.event === 'message_stop') {
                console.log('❌ 收到message_stop (不应该)');
                hasMessageStop = true;
              }
            } catch (e) {}
          }
        }
      });
      
      response.data.on('end', () => {
        const success = hasToolUse && !hasMessageStop;
        console.log(\`\\n🎯 测试结果: \${success ? '✅ 成功' : '❌ 失败'}\`);
        resolve(success);
      });
      
      setTimeout(() => {
        console.log('⏰ 测试超时');
        resolve(false);
      }, 15000);
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    return false;
  }
}

quickTest().then(success => process.exit(success ? 0 : 1));`;
  
  const testPath = path.join(process.cwd(), 'scripts/quick-test-3456-fix.js');
  fs.writeFileSync(testPath, testScript);
  fs.chmodSync(testPath, '755');
  
  console.log('✅ 测试脚本创建完成: scripts/quick-test-3456-fix.js\n');
}

// 执行所有修复
async function runAllFixes() {
  try {
    fixServerToolUseDetection();
    fixPreprocessorToolDetection();
    verifySdkClientToolHandling();
    createTestScript();
    
    console.log('🎉 所有修复完成！');
    console.log('\n📋 下一步操作:');
    console.log('1. 重启服务器: npm run dev');
    console.log('2. 运行诊断: node scripts/diagnose-3456-finish-reason-issue.js');
    console.log('3. 快速测试: node scripts/quick-test-3456-fix.js');
    console.log('4. 检查日志中的调试信息');
    
  } catch (error) {
    console.error('❌ 修复过程出错:', error.message);
    process.exit(1);
  }
}

runAllFixes();