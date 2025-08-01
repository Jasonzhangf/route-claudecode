#!/usr/bin/env node

/**
 * 调试空文本响应问题
 * 检查是OpenAI还是Gemini provider导致的
 */

const fetch = require('node-fetch');

async function testProvider(port, providerName) {
  console.log(`\n🧪 测试 ${providerName} (端口 ${port})`);
  
  try {
    const response = await fetch(`http://localhost:${port}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'test'
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user", 
            content: "Hello, please respond with a simple greeting."
          }
        ]
      })
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log(`✅ ${providerName} 响应成功`);
      
      try {
        const jsonResponse = JSON.parse(responseText);
        console.log(`📋 内容类型: ${jsonResponse.content?.map(c => c.type).join(', ')}`);
        
        // 检查空文本问题
        const textBlocks = jsonResponse.content?.filter(c => c.type === 'text') || [];
        const emptyTextBlocks = textBlocks.filter(c => !c.text || c.text.trim() === '');
        
        if (emptyTextBlocks.length > 0) {
          console.log(`❌ 发现 ${emptyTextBlocks.length} 个空文本块!`);
          console.log('空文本详情:', emptyTextBlocks);
        } else {
          console.log(`✅ 文本内容正常`);
          textBlocks.forEach((block, i) => {
            console.log(`   文本块 ${i + 1}: "${block.text?.substring(0, 50)}..."`);
          });
        }
        
      } catch (parseError) {
        console.log(`❌ JSON解析失败: ${parseError.message}`);
        console.log('原始响应前100字符:', responseText.substring(0, 100));
      }
    } else {
      console.log(`❌ ${providerName} 请求失败: ${response.status}`);
      console.log('错误响应:', responseText.substring(0, 200));
    }
    
  } catch (error) {
    console.log(`❌ ${providerName} 连接失败: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 调试空文本响应问题\n');
  
  // 测试3456端口 (dev - 主要是CodeWhisperer)
  await testProvider(3456, '开发环境 (CodeWhisperer/ModelScope)');
  
  // 测试8888端口 (release - 包含Gemini)
  await testProvider(8888, '发布环境 (Gemini/Shuaihong)');
  
  console.log('\n🎯 检查完成');
}

main().catch(console.error);