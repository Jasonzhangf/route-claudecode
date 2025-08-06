/**
 * 测试500错误响应是否包含完整的错误信息
 * 验证错误响应包含：提供商名称、模型名称、错误原因
 */

const axios = require('axios');

async function test500ErrorResponse() {
  console.log('🧪 测试500错误响应格式...\n');

  const testCases = [
    {
      name: '无效模型测试 (应该返回404或500)',
      port: 6689,
      request: {
        model: 'invalid-model-that-does-not-exist',
        messages: [
          { role: 'user', content: 'Test with invalid model' }
        ],
        stream: false
      }
    },
    {
      name: '无效端点测试 (应该返回500)',
      port: 9999, // 不存在的端口
      request: {
        model: 'gpt-4',
        messages: [
          { role: 'user', content: 'Test with invalid endpoint' }
        ],
        stream: false
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`📋 ${testCase.name}:`);
    
    try {
      const response = await axios.post(`http://localhost:${testCase.port}/v1/chat/completions`, testCase.request, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('  ⚠️  预期错误但请求成功了');
      console.log(`  状态: ${response.status}`);
      
    } catch (error) {
      console.log('  ✅ 收到预期的错误响应');
      console.log(`  HTTP状态: ${error.response?.status || 'N/A'}`);
      
      if (error.response?.data) {
        const errorData = error.response.data;
        console.log(`  错误响应结构:`);
        console.log(`    ${JSON.stringify(errorData, null, 4)}`);
        
        // 验证错误响应是否包含必要信息
        console.log('\n  📊 错误信息完整性检查:');
        
        // 检查基本错误结构
        if (errorData.error) {
          console.log('    ✅ 包含error对象');
          
          // 检查错误类型
          if (errorData.error.type) {
            console.log(`    ✅ 错误类型: ${errorData.error.type}`);
          } else {
            console.log('    ❌ 缺少错误类型');
          }
          
          // 检查错误消息
          if (errorData.error.message) {
            console.log(`    ✅ 错误消息: ${errorData.error.message}`);
          } else {
            console.log('    ❌ 缺少错误消息');
          }
          
          // 检查详细信息
          if (errorData.error.details) {
            console.log('    ✅ 包含详细信息:');
            
            // 检查提供商名称
            if (errorData.error.details.provider) {
              console.log(`      ✅ 提供商: ${errorData.error.details.provider}`);
            } else {
              console.log('      ❌ 缺少提供商名称');
            }
            
            // 检查模型名称
            if (errorData.error.details.model) {
              console.log(`      ✅ 模型: ${errorData.error.details.model}`);
            } else {
              console.log('      ❌ 缺少模型名称');
            }
            
            // 检查原始错误
            if (errorData.error.details.originalError) {
              console.log(`      ✅ 原始错误: ${errorData.error.details.originalError}`);
            } else {
              console.log('      ❌ 缺少原始错误信息');
            }
            
            // 检查其他有用信息
            if (errorData.error.details.stage) {
              console.log(`      ✅ 错误阶段: ${errorData.error.details.stage}`);
            }
            
            if (errorData.error.details.retryCount !== undefined) {
              console.log(`      ✅ 重试次数: ${errorData.error.details.retryCount}`);
            }
            
          } else {
            console.log('    ❌ 缺少详细信息对象');
          }
          
        } else {
          console.log('    ❌ 缺少error对象');
        }
        
        // 评估错误响应质量
        console.log('\n  🎯 错误响应质量评估:');
        const hasProvider = errorData.error?.details?.provider;
        const hasModel = errorData.error?.details?.model;
        const hasOriginalError = errorData.error?.details?.originalError;
        const hasMessage = errorData.error?.message;
        
        const completeness = [hasProvider, hasModel, hasOriginalError, hasMessage].filter(Boolean).length;
        const totalChecks = 4;
        const score = (completeness / totalChecks * 100).toFixed(0);
        
        console.log(`    完整性评分: ${score}% (${completeness}/${totalChecks})`);
        
        if (score >= 75) {
          console.log('    ✅ 错误响应质量良好');
        } else if (score >= 50) {
          console.log('    ⚠️  错误响应质量一般，建议改进');
        } else {
          console.log('    ❌ 错误响应质量较差，需要改进');
        }
        
      } else {
        console.log('  ❌ 没有错误响应数据');
      }
    }
    
    console.log('\n' + '-'.repeat(60) + '\n');
  }

  console.log('🎯 测试总结:');
  console.log('✅ 验证500错误响应是否包含:');
  console.log('   • 提供商名称 (provider)');
  console.log('   • 模型名称 (model)');
  console.log('   • 错误原因 (originalError/message)');
  console.log('   • 错误类型 (type)');
  console.log('   • 其他调试信息 (stage, retryCount等)');
  
  console.log('\n💡 如果发现缺失信息，需要增强错误处理系统');
}

test500ErrorResponse().catch(console.error);