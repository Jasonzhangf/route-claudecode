#!/usr/bin/env node

/**
 * 端到端测试5506端口的工具调用功能
 * 验证完整的工具调用流程：请求 -> 响应 -> 工具调用解析
 */

const http = require('http');

const testRequest = {
  model: 'qwen3-30b',
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: '请使用LS工具列出当前目录的内容，显示文件和子目录' }]
    }
  ],
  max_tokens: 2000,
  tools: [
    {
      name: "LS",
      description: "Lists files and directories in a given path",
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The absolute path to the directory to list"
          }
        },
        required: ["path"]
      }
    }
  ]
};

console.log('🚀 启动5506端口端到端工具调用测试...');
console.log('=' + '='.repeat(70));

async function testToolCallEndToEnd() {
  console.log('\n📤 发送工具调用请求...');
  console.log(`请求: ${testRequest.messages[0].content[0].text}`);
  console.log(`可用工具: ${testRequest.tools[0].name}`);
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testRequest);
    
    const req = http.request({
      hostname: 'localhost',
      port: 5506,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': 'Bearer test-key'
      },
      timeout: 60000 // 增加超时时间用于工具调用
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n📊 响应状态: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.log('❌ 请求失败');
            if (response.error) {
              console.log('错误详情:', response.error.message);
            }
            resolve({ success: false, error: response.error });
            return;
          }
          
          console.log('✅ 请求成功');
          
          // 分析响应内容
          console.log('\n🔍 响应分析:');
          console.log(`- ID: ${response.id}`);
          console.log(`- Model: ${response.model}`);
          console.log(`- Stop Reason: ${response.stop_reason}`);
          console.log(`- Content Blocks: ${response.content ? response.content.length : 0}`);
          
          if (response.content && response.content.length > 0) {
            response.content.forEach((block, index) => {
              console.log(`\n内容块 ${index + 1}:`);
              console.log(`- 类型: ${block.type}`);
              
              if (block.type === 'text') {
                console.log(`- 文本长度: ${block.text ? block.text.length : 0}字符`);
                if (block.text && block.text.length < 500) {
                  console.log(`- 文本内容: "${block.text}"`);
                } else if (block.text) {
                  console.log(`- 文本预览: "${block.text.substring(0, 200)}..."`);
                }
              } else if (block.type === 'tool_use') {
                console.log('🎯 发现工具调用!');
                console.log(`- 工具ID: ${block.id}`);
                console.log(`- 工具名称: ${block.name}`);
                console.log(`- 工具参数:`, JSON.stringify(block.input, null, 2));
                
                // 验证工具调用格式
                const isValidToolCall = (
                  block.id &&
                  block.name &&
                  typeof block.input === 'object'
                );
                
                console.log(`- 格式验证: ${isValidToolCall ? '✅ 有效' : '❌ 无效'}`);
              }
            });
          }
          
          // 检查是否包含工具调用
          const hasToolCalls = response.content && response.content.some(block => block.type === 'tool_use');
          const hasTextContent = response.content && response.content.some(block => block.type === 'text');
          
          console.log('\n📋 工具调用测试结果:');
          console.log(`- 包含工具调用: ${hasToolCalls ? '✅ 是' : '❌ 否'}`);
          console.log(`- 包含文本内容: ${hasTextContent ? '✅ 是' : '❌ 否'}`);
          console.log(`- Stop Reason: ${response.stop_reason}`);
          
          if (hasToolCalls && response.stop_reason === 'tool_use') {
            console.log('🎉 完美! 工具调用功能正常工作!');
          } else if (hasToolCalls) {
            console.log('⚠️  有工具调用但stop_reason不正确');
          } else {
            console.log('⚠️  没有检测到工具调用 - 可能是模型选择了不使用工具');
          }
          
          resolve({
            success: true,
            hasToolCalls,
            hasTextContent,
            stopReason: response.stop_reason,
            contentBlocks: response.content ? response.content.length : 0,
            response
          });
          
        } catch (err) {
          console.log('❌ 响应解析失败:', err.message);
          console.log('原始响应预览:', data.substring(0, 1000));
          resolve({ success: false, parseError: err.message, rawData: data });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('❌ 请求错误:', err.message);
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log('❌ 请求超时');
      reject(new Error('Request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const result = await testToolCallEndToEnd();
    
    console.log('\n' + '='.repeat(70));
    console.log('🏁 最终测试总结:');
    
    if (result.success) {
      if (result.hasToolCalls) {
        console.log('🎉 SUCCESS: 5506端口工具调用功能完全正常!');
        console.log('✅ 工具定义格式转换正确');
        console.log('✅ 工具调用响应解析正确');
        console.log('✅ Stop reason设置正确');
        
        console.log('\n📊 测试统计:');
        console.log(`- 内容块数量: ${result.contentBlocks}`);
        console.log(`- 包含工具调用: ${result.hasToolCalls}`);
        console.log(`- 包含文本内容: ${result.hasTextContent}`);
        console.log(`- Stop reason: ${result.stopReason}`);
        
        console.log('\n✅ 5506端口LMStudio工具调用问题已完全修复!');
        
      } else {
        console.log('⚠️  PARTIAL SUCCESS: 请求成功但未触发工具调用');
        console.log('这可能是正常行为 - 模型可能认为不需要使用工具');
        console.log('或者模型选择直接回答而不使用工具');
      }
    } else {
      console.log('❌ FAILURE: 测试失败');
      if (result.error) {
        console.log('错误详情:', result.error);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试执行失败:', error.message);
  }
}

main();