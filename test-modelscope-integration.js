#!/usr/bin/env node

/**
 * 测试ModelScope Qwen3-Coder-480B集成
 * 验证API连接、路由配置和响应处理
 */

const axios = require('axios');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function testModelScopeIntegration() {
  console.log('🔍 测试ModelScope Qwen3-Coder-480B集成');
  console.log('=====================================');
  
  const testCases = [
    {
      name: "Default Category - ModelScope Qwen3-Coder",
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: "写一个简单的Python函数来计算斐波那契数列，并解释代码逻辑。"
          }
        ]
      },
      expectedProvider: "modelscope-qwen",
      expectedModel: "Qwen/Qwen3-Coder-480B-A35B-Instruct"
    },
    {
      name: "Thinking Category - ModelScope Qwen3-Coder",
      request: {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: "分析这个算法的时间复杂度并提供优化建议：\n\ndef find_duplicates(arr):\n    duplicates = []\n    for i in range(len(arr)):\n        for j in range(i+1, len(arr)):\n            if arr[i] == arr[j] and arr[i] not in duplicates:\n                duplicates.append(arr[i])\n    return duplicates"
          }
        ],
        metadata: { thinking: true }
      },
      expectedProvider: "modelscope-qwen", 
      expectedModel: "Qwen/Qwen3-Coder-480B-A35B-Instruct"
    }
  ];

  let successCount = 0;
  const totalTests = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n🧪 Test ${i + 1}: ${testCase.name}`);
    console.log('=' + '='.repeat(testCase.name.length + 10));
    
    try {
      console.log('📤 发送测试请求...');
      console.log('   输入模型:', testCase.request.model);
      console.log('   期望路由:', `${testCase.expectedProvider} → ${testCase.expectedModel}`);
      
      const startTime = Date.now();
      const response = await axios.post(`${BASE_URL}/v1/messages`, testCase.request, {
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 60000
      });
      const responseTime = Date.now() - startTime;
      
      console.log('✅ 请求成功');
      console.log('📊 响应分析:');
      console.log(`   响应时间: ${responseTime}ms`);
      console.log('   响应模型:', response.data.model || '未找到');
      console.log('   Content blocks:', response.data.content?.length || 0);
      
      // 验证模型路由
      const modelMatches = response.data.model === testCase.expectedModel;
      console.log('   模型路由验证:', modelMatches ? '✅ 正确' : '❌ 错误');
      
      // 检查响应内容
      let hasValidContent = false;
      let contentPreview = '';
      
      if (response.data.content && response.data.content.length > 0) {
        const firstBlock = response.data.content[0];
        if (firstBlock.type === 'text' && firstBlock.text) {
          hasValidContent = true;
          contentPreview = firstBlock.text.slice(0, 100) + (firstBlock.text.length > 100 ? '...' : '');
        }
      }
      
      console.log('   响应内容验证:', hasValidContent ? '✅ 有效' : '❌ 无效');
      if (hasValidContent) {
        console.log('   内容预览:', JSON.stringify(contentPreview));
      }
      
      // 检查是否包含编程相关内容（因为是编程模型）
      const isProgrammingResponse = contentPreview.toLowerCase().includes('python') || 
                                   contentPreview.toLowerCase().includes('def ') ||
                                   contentPreview.toLowerCase().includes('function') ||
                                   contentPreview.toLowerCase().includes('算法') ||
                                   contentPreview.toLowerCase().includes('代码');
      
      console.log('   编程内容验证:', isProgrammingResponse ? '✅ 相关' : '❌ 不相关');
      
      // 检查工具调用文本问题
      let hasToolCallText = false;
      if (response.data.content) {
        response.data.content.forEach((block, index) => {
          if (block.type === 'text' && block.text.includes('Tool call:')) {
            hasToolCallText = true;
            console.log(`   ❌ Block ${index + 1} 包含工具调用文本问题`);
          }
        });
      }
      console.log('   工具调用文本检查:', hasToolCallText ? '❌ 存在问题' : '✅ 无问题');
      
      // 综合评分
      const testPassed = modelMatches && hasValidContent && !hasToolCallText;
      if (testPassed) {
        successCount++;
        console.log('🎉 测试通过');
      } else {
        console.log('❌ 测试失败');
      }
      
    } catch (error) {
      console.error('❌ 测试失败:', error.message);
      if (error.response) {
        console.error('   状态码:', error.response.status);
        console.error('   错误详情:', error.response.data);
        
        if (error.response.status === 401) {
          console.error('💡 可能的API Key问题，请检查ModelScope API Key是否正确');
        } else if (error.response.status === 403) {
          console.error('💡 可能的权限问题，请检查ModelScope账户配额和权限');
        } else if (error.response.status === 429) {
          console.error('💡 请求频率限制，请稍后重试');
        }
      }
    }
  }

  return { successCount, totalTests };
}

async function testDirectModelScopeAPI() {
  console.log('\n🔍 直接测试ModelScope API连接');
  console.log('===============================');
  
  try {
    const directRequest = {
      model: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      messages: [
        {
          role: "user",
          content: "Hello, please write a simple Python function to add two numbers."
        }
      ],
      max_tokens: 512
    };
    
    console.log('📤 直接请求ModelScope API...');
    
    const response = await axios.post('https://api-inference.modelscope.cn/v1/chat/completions', directRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ms-cc2f461b-8228-427f-99aa-1d44fab73e67'
      },
      timeout: 30000
    });
    
    console.log('✅ 直接API测试成功');
    console.log('📊 响应信息:');
    console.log('   模型:', response.data.model || '未找到');
    console.log('   选择数量:', response.data.choices?.length || 0);
    
    if (response.data.choices && response.data.choices[0]) {
      const content = response.data.choices[0].message?.content || '';
      console.log('   内容长度:', content.length);
      console.log('   内容预览:', JSON.stringify(content.slice(0, 100)));
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ 直接API测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   错误内容:', error.response.data);
    }
    return false;
  }
}

async function main() {
  console.log('🚀 ModelScope Qwen3-Coder-480B 集成测试');
  console.log('=========================================\n');
  
  // 等待服务器启动
  console.log('⏱️  等待服务器启动...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 首先测试直接API连接
  const directAPISuccess = await testDirectModelScopeAPI();
  
  if (!directAPISuccess) {
    console.log('\n❌ 直接API测试失败，跳过路由测试');
    process.exit(1);
  }
  
  // 测试路由集成
  const result = await testModelScopeIntegration();
  
  console.log('\n📋 测试总结:');
  console.log('=============');
  console.log(`通过测试: ${result.successCount}/${result.totalTests}`);
  console.log(`成功率: ${Math.round(result.successCount / result.totalTests * 100)}%`);
  
  if (result.successCount === result.totalTests) {
    console.log('\n🎉 ModelScope 集成测试全部通过！');
    console.log('✅ Qwen3-Coder-480B 已成功集成到路由系统');
    console.log('✅ Default 和 Thinking 类别已正确路由到 ModelScope');
    console.log('✅ API Key 和端点配置正确');
    console.log('✅ 响应处理和格式转换正常');
  } else {
    console.log('\n⚠️  部分测试失败，请检查配置和网络连接');
  }
  
  process.exit(result.successCount === result.totalTests ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}