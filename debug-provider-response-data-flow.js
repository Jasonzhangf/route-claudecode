#!/usr/bin/env node

/**
 * 追踪Provider层面的响应数据流
 * 目标：确定response.choices在provider层面还是transformer层面丢失
 */

const fs = require('fs');
const path = require('path');

// 临时修改源码添加调试日志
function addProviderLogging() {
  const lmstudioClientPath = path.join(__dirname, 'src/providers/lmstudio/client.ts');
  const openaiTransformerPath = path.join(__dirname, 'src/transformers/openai.ts');
  
  console.log('🔧 添加临时调试日志...');
  
  // 1. 在LMStudio Client的sendRequest方法添加响应日志
  let clientContent = fs.readFileSync(lmstudioClientPath, 'utf8');
  
  // 检查是否已经添加了调试代码，避免重复添加
  if (!clientContent.includes('PROVIDER-RESPONSE-DEBUG')) {
    const insertPoint = clientContent.indexOf('const response = await super.sendRequest(request);');
    if (insertPoint !== -1) {
      const afterResponseLine = clientContent.indexOf('\\n', insertPoint) + 1;
      const debugCode = `    
    // 🔍 PROVIDER-RESPONSE-DEBUG: 记录Provider响应数据
    console.log('🔍 [PROVIDER-RESPONSE-DEBUG] LMStudio response received:', {
      hasChoices: !!response.choices,
      choicesLength: response.choices?.length || 0,
      responseKeys: Object.keys(response || {}),
      responseId: response.id,
      responseObject: response.object,
      requestId: request.metadata?.requestId
    });
    
    if (response.choices && response.choices[0]) {
      console.log('🔍 [PROVIDER-RESPONSE-DEBUG] First choice details:', {
        hasMessage: !!response.choices[0].message,
        hasContent: !!response.choices[0].message?.content,
        finishReason: response.choices[0].finish_reason,
        requestId: request.metadata?.requestId
      });
    } else {
      console.log('🚨 [PROVIDER-RESPONSE-DEBUG] NO CHOICES FOUND in provider response!', {
        responseData: JSON.stringify(response, null, 2),
        requestId: request.metadata?.requestId
      });
    }
`;
      clientContent = clientContent.slice(0, afterResponseLine) + debugCode + clientContent.slice(afterResponseLine);
      fs.writeFileSync(lmstudioClientPath, clientContent);
      console.log('✅ 已添加LMStudio Client调试日志');
    }
  }
  
  // 2. 在OpenAI Transformer的transformOpenAIResponseToBase方法添加日志
  let transformerContent = fs.readFileSync(openaiTransformerPath, 'utf8');
  
  if (!transformerContent.includes('TRANSFORMER-INPUT-DEBUG')) {
    const insertPoint = transformerContent.indexOf('transformOpenAIResponseToBase(response: any, originalRequest: BaseRequest): BaseResponse {');
    if (insertPoint !== -1) {
      const afterMethodStart = transformerContent.indexOf('{', insertPoint) + 1;
      const debugCode = `
    // 🔍 TRANSFORMER-INPUT-DEBUG: 记录Transformer输入数据
    console.log('🔍 [TRANSFORMER-INPUT-DEBUG] Received response in transformer:', {
      hasResponse: !!response,
      hasChoices: !!response?.choices,
      choicesLength: response?.choices?.length || 0,
      responseKeys: Object.keys(response || {}),
      responseType: typeof response,
      requestId: originalRequest.metadata?.requestId
    });
    
    if (!response?.choices || response.choices.length === 0) {
      console.log('🚨 [TRANSFORMER-INPUT-DEBUG] Missing choices detected in transformer input!', {
        fullResponse: JSON.stringify(response, null, 2),
        requestId: originalRequest.metadata?.requestId
      });
    }
`;
      transformerContent = transformerContent.slice(0, afterMethodStart) + debugCode + transformerContent.slice(afterMethodStart);
      fs.writeFileSync(openaiTransformerPath, transformerContent);
      console.log('✅ 已添加OpenAI Transformer调试日志');
    }
  }
  
  console.log('✅ 调试日志添加完成');
}

function removeProviderLogging() {
  const lmstudioClientPath = path.join(__dirname, 'src/providers/lmstudio/client.ts');
  const openaiTransformerPath = path.join(__dirname, 'src/transformers/openai.ts');
  
  console.log('🧹 清理调试日志...');
  
  // 清理LMStudio Client
  let clientContent = fs.readFileSync(lmstudioClientPath, 'utf8');
  if (clientContent.includes('PROVIDER-RESPONSE-DEBUG')) {
    // 移除调试代码块
    clientContent = clientContent.replace(/\\s*\\/\\/ 🔍 PROVIDER-RESPONSE-DEBUG[\\s\\S]*?\\};\\s*/g, '\\n    ');
    fs.writeFileSync(lmstudioClientPath, clientContent);
    console.log('✅ 已清理LMStudio Client调试日志');
  }
  
  // 清理OpenAI Transformer
  let transformerContent = fs.readFileSync(openaiTransformerPath, 'utf8');
  if (transformerContent.includes('TRANSFORMER-INPUT-DEBUG')) {
    // 移除调试代码块
    transformerContent = transformerContent.replace(/\\s*\\/\\/ 🔍 TRANSFORMER-INPUT-DEBUG[\\s\\S]*?\\};\\s*/g, '\\n    ');
    fs.writeFileSync(openaiTransformerPath, transformerContent);
    console.log('✅ 已清理OpenAI Transformer调试日志');
  }
  
  console.log('✅ 调试日志清理完成');
}

async function testWithDebugLogs() {
  console.log('🎯 开始Provider响应数据流追踪...');
  
  // 添加调试日志
  addProviderLogging();
  
  try {
    // 重新构建项目
    console.log('🔨 重新构建项目...');
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec('./build.sh', (error, stdout, stderr) => {
        if (error) {
          console.log('❌ 构建失败:', error.message);
          reject(error);
        } else {
          console.log('✅ 构建成功');
          resolve();
        }
      });
    });
    
    // 重启服务
    console.log('🔄 重启服务...');
    exec('pkill -f "rcc start"');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    exec('rcc start --config ~/.route-claude-code/config/single-provider/config-openai-lmstudio-5506.json --debug &');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📡 发送测试请求...');
    const axios = require('axios');
    
    // 发送几个测试请求来触发错误
    for (let i = 0; i < 3; i++) {
      try {
        const response = await axios.post('http://localhost:5506/v1/messages', {
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 100,
          messages: [{ role: 'user', content: `Test request ${i}` }],
          tools: [{
            type: 'function',
            function: {
              name: 'test_tool',
              description: 'Test tool',
              parameters: {
                type: 'object',
                properties: { test: { type: 'string' } },
                required: ['test']
              }
            }
          }]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-key'
          },
          timeout: 10000
        });
        
        console.log(`✅ 请求${i}: 成功`);
        
      } catch (error) {
        console.log(`❌ 请求${i}: 失败 - ${error.response?.data?.error?.message || error.message}`);
        
        if (error.response?.data?.error?.message?.includes('missing choices')) {
          console.log('🎯 触发了missing choices错误！查看上面的调试日志');
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\\n📊 测试完成，请查看服务日志中的调试信息');
    console.log('🔍 查找以下标识的日志:');
    console.log('  - [PROVIDER-RESPONSE-DEBUG] - Provider层面响应数据');
    console.log('  - [TRANSFORMER-INPUT-DEBUG] - Transformer层面输入数据');
    
  } catch (error) {
    console.log('❌ 测试过程出错:', error.message);
  } finally {
    // 清理调试日志
    removeProviderLogging();
  }
}

// 检查是否要清理
if (process.argv.includes('--clean')) {
  removeProviderLogging();
} else {
  testWithDebugLogs().then(() => {
    console.log('\\n🏁 Provider响应数据流追踪完成');
  }).catch(console.error);
}