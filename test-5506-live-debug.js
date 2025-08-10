#!/usr/bin/env node

/**
 * 实时调试5506端口的预处理逻辑
 * 发送真实请求并监控日志输出
 */

const http = require('http');

const testRequest = {
  model: 'qwen3-30b',
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text: '请直接使用LS工具列出当前目录' }]
    }
  ],
  max_tokens: 1000,
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

console.log('🔍 实时调试5506端口预处理...');
console.log('=' + '='.repeat(70));

async function testWithLiveDebugging() {
  console.log('\n📤 发送请求...');
  
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
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n📊 响应状态: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            console.log('❌ 请求失败:', response.error?.message);
            resolve({ success: false, error: response.error });
            return;
          }
          
          console.log('✅ 请求成功');
          
          // 详细分析响应
          console.log('\n🔍 详细响应分析:');
          console.log(`- Stop Reason: ${response.stop_reason}`);
          console.log(`- 内容块数量: ${response.content?.length || 0}`);
          
          if (response.content && response.content.length > 0) {
            response.content.forEach((block, i) => {
              console.log(`\n内容块 ${i + 1}:`);
              console.log(`- 类型: ${block.type}`);
              
              if (block.type === 'text' && block.text) {
                console.log(`- 文本内容: "${block.text}"`);
                
                // 检查是否包含LMStudio格式
                const hasLMStudioPattern = block.text.includes('<|start|>assistant<|channel|>commentary to=functions.');
                console.log(`- 包含LMStudio模式: ${hasLMStudioPattern ? '✅ 是' : '❌ 否'}`);
                
                if (hasLMStudioPattern) {
                  console.log('🚨 发现LMStudio格式但未转换!');
                  console.log('这说明预处理没有正确应用');
                  
                  // 尝试手动匹配
                  const pattern = /<\|start\|>assistant<\|channel\|>commentary to=functions\.(\w+)\s*<\|constrain\|>(?:JSON|json)<\|message\|>(\{[^}]*\})/g;
                  const match = pattern.exec(block.text);
                  
                  if (match) {
                    console.log('🔧 手动模式匹配成功:');
                    console.log(`- 函数名: ${match[1]}`);
                    console.log(`- 参数: ${match[2]}`);
                    
                    try {
                      const args = JSON.parse(match[2]);
                      console.log(`- 参数解析: ✅`);
                      console.log(`- 解析结果:`, args);
                    } catch (e) {
                      console.log(`- 参数解析: ❌ ${e.message}`);
                    }
                  } else {
                    console.log('❌ 手动模式匹配失败 - 检查正则表达式');
                  }
                }
              } else if (block.type === 'tool_use') {
                console.log('🎯 工具调用块:');
                console.log(`- ID: ${block.id}`);
                console.log(`- 名称: ${block.name}`);
                console.log(`- 参数:`, block.input);
              }
            });
          }
          
          // 判断预处理是否工作
          const hasToolCalls = response.content?.some(b => b.type === 'tool_use');
          const hasLMStudioText = response.content?.some(b => 
            b.type === 'text' && b.text && b.text.includes('<|start|>assistant<|channel|>')
          );
          
          console.log('\n📋 预处理诊断:');
          if (hasLMStudioText && !hasToolCalls) {
            console.log('❌ 预处理失败: LMStudio格式存在但未转换');
            console.log('可能原因:');
            console.log('1. 预处理未被调用');
            console.log('2. Provider匹配失败'); 
            console.log('3. 正则表达式不匹配');
            console.log('4. JSON解析失败');
          } else if (hasToolCalls) {
            console.log('✅ 预处理成功: 工具调用已转换');
          } else if (!hasLMStudioText) {
            console.log('ℹ️  无需预处理: 未检测到LMStudio格式');
          }
          
          resolve({
            success: true,
            hasToolCalls,
            hasLMStudioText,
            stopReason: response.stop_reason,
            response
          });
          
        } catch (err) {
          console.log('❌ 响应解析失败:', err.message);
          resolve({ success: false, parseError: err.message });
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
    console.log('💡 提示: 请同时监控日志以查看预处理消息:');
    console.log('tail -f ~/.route-claude-code/logs/port-5506/*/system.log | grep -i "preprocessing\\|lmstudio"');
    
    const result = await testWithLiveDebugging();
    
    console.log('\n' + '='.repeat(70));
    console.log('🏁 实时调试总结:');
    
    if (result.hasLMStudioText && !result.hasToolCalls) {
      console.log('🚨 确认问题: LMStudio文本格式未被预处理转换');
      console.log('下一步: 检查服务器日志中的预处理消息');
    } else if (result.hasToolCalls) {
      console.log('🎉 SUCCESS: 预处理工作正常');
    } else {
      console.log('ℹ️  未检测到LMStudio格式 - 可能是模型行为差异');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

main();