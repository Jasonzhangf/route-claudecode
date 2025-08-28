#!/usr/bin/env node

/**
 * Google Gemini端到端测试脚本
 * 
 * 测试Google Gemini API的直接连接和多轮工具调用
 * 支持429频率检测和多key轮询策略
 */

const https = require('https');
const fs = require('fs');

// Gemini配置
const GEMINI_CONFIG = {
  endpoint: 'https://generativelanguage.googleapis.com',
  apiKeys: [
    'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4',
    'AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA',
    'AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ'
  ],
  models: {
    'gemini-2.5-pro': 'v1beta/models/gemini-2.5-pro:generateContent',
    'gemini-2.5-flash': 'v1beta/models/gemini-2.5-flash:generateContent',
    'gemini-2.0-flash-exp': 'v1beta/models/gemini-2.0-flash-exp:generateContent',
    'gemini-1.5-pro': 'v1beta/models/gemini-1.5-pro:generateContent',
    'gemini-1.5-flash': 'v1beta/models/gemini-1.5-flash:generateContent'
  },
  rateLimitStats: {
    // 用于追踪429频率的统计数据
    keyStats: new Map(),
    modelStats: new Map()
  }
};

/**
 * 发送HTTPS请求到Gemini API
 */
function makeGeminiRequest(modelPath, data, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const url = `${GEMINI_CONFIG.endpoint}/${modelPath}?key=${apiKey}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({ 
            status: res.statusCode, 
            data: response,
            headers: res.headers
          });
        } catch (error) {
          resolve({ 
            status: res.statusCode, 
            data: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 记录429统计信息
 */
function record429Stats(apiKey, model, is429) {
  const keyId = apiKey.substring(-8);
  
  // 更新API Key统计
  if (!GEMINI_CONFIG.rateLimitStats.keyStats.has(keyId)) {
    GEMINI_CONFIG.rateLimitStats.keyStats.set(keyId, {
      total: 0,
      success: 0,
      rateLimited: 0,
      successRate: 0,
      rateLimitRate: 0
    });
  }
  
  const keyStats = GEMINI_CONFIG.rateLimitStats.keyStats.get(keyId);
  keyStats.total++;
  if (is429) {
    keyStats.rateLimited++;
  } else {
    keyStats.success++;
  }
  keyStats.successRate = (keyStats.success / keyStats.total * 100).toFixed(2);
  keyStats.rateLimitRate = (keyStats.rateLimited / keyStats.total * 100).toFixed(2);
  
  // 更新模型统计
  if (!GEMINI_CONFIG.rateLimitStats.modelStats.has(model)) {
    GEMINI_CONFIG.rateLimitStats.modelStats.set(model, {
      total: 0,
      success: 0,
      rateLimited: 0,
      successRate: 0,
      rateLimitRate: 0
    });
  }
  
  const modelStats = GEMINI_CONFIG.rateLimitStats.modelStats.get(model);
  modelStats.total++;
  if (is429) {
    modelStats.rateLimited++;
  } else {
    modelStats.success++;
  }
  modelStats.successRate = (modelStats.success / modelStats.total * 100).toFixed(2);
  modelStats.rateLimitRate = (modelStats.rateLimited / modelStats.total * 100).toFixed(2);
}

/**
 * 测试Gemini基本连接
 */
async function testGeminiConnection() {
  console.log('🔍 测试Google Gemini API连接...');
  
  const testModels = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash'];
  
  console.log('\n📋 测试可用模型:');
  console.log(`端点: ${GEMINI_CONFIG.endpoint}`);
  console.log(`API Keys: ${GEMINI_CONFIG.apiKeys.length}个`);
  
  const workingConfigs = [];
  
  for (const model of testModels) {
    console.log(`\n🧪 测试模型: ${model}`);
    
    for (let keyIndex = 0; keyIndex < GEMINI_CONFIG.apiKeys.length; keyIndex++) {
      const apiKey = GEMINI_CONFIG.apiKeys[keyIndex];
      const keyId = apiKey.substring(-8);
      
      console.log(`  🔑 API Key ${keyIndex + 1} (${keyId}): `, end='');
      
      const requestData = {
        contents: [{
          parts: [{
            text: "Hello, please introduce yourself briefly in one sentence."
          }]
        }],
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.7
        }
      };
      
      try {
        const startTime = Date.now();
        const response = await makeGeminiRequest(
          GEMINI_CONFIG.models[model], 
          requestData, 
          apiKey
        );
        const duration = Date.now() - startTime;
        
        const is429 = response.status === 429;
        record429Stats(apiKey, model, is429);
        
        if (response.status === 200) {
          console.log(`✅ ${duration}ms`);
          if (response.data.candidates && response.data.candidates[0]) {
            const text = response.data.candidates[0].content.parts[0].text;
            console.log(`    💬 ${text.substring(0, 50)}...`);
          }
          workingConfigs.push({ model, apiKey, keyIndex });
        } else if (response.status === 429) {
          console.log(`⚠️ 429 Rate Limited`);
        } else {
          console.log(`❌ ${response.status}`);
          console.log(`    错误: ${JSON.stringify(response.data).substring(0, 100)}...`);
        }
        
      } catch (error) {
        console.log(`❌ 连接错误: ${error.message}`);
        record429Stats(apiKey, model, false);
      }
    }
  }
  
  return workingConfigs;
}

/**
 * 多轮工具调用测试 (Gemini格式)
 */
async function testGeminiToolCalling(config) {
  console.log(`\n🔄 开始Gemini工具调用测试: ${config.model}`);
  
  const inputContent = fs.readFileSync('/tmp/multi-turn-test-input.txt', 'utf8');
  
  const requestData = {
    contents: [{
      parts: [{
        text: inputContent
      }]
    }],
    tools: [{
      function_declarations: [
        {
          name: 'list_files',
          description: '列出指定目录下的文件和文件夹',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: '要列出的目录路径'
              }
            },
            required: ['path']
          }
        },
        {
          name: 'save_file',
          description: '保存内容到文件',
          parameters: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: '文件名'
              },
              content: {
                type: 'string',
                description: '文件内容'
              }
            },
            required: ['filename', 'content']
          }
        }
      ]
    }],
    generationConfig: {
      maxOutputTokens: 2000,
      temperature: 0.3
    }
  };
  
  console.log('📤 发送Gemini工具调用请求...');
  
  try {
    const startTime = Date.now();
    const response = await makeGeminiRequest(
      GEMINI_CONFIG.models[config.model], 
      requestData, 
      config.apiKey
    );
    const duration = Date.now() - startTime;
    
    const is429 = response.status === 429;
    record429Stats(config.apiKey, config.model, is429);
    
    console.log(`⏱️  响应时间: ${duration}ms`);
    console.log(`📊 状态码: ${response.status}`);
    
    if (response.status === 200 && response.data.candidates) {
      const candidate = response.data.candidates[0];
      console.log('✅ Gemini工具调用测试成功');
      
      if (candidate.content && candidate.content.parts) {
        const textParts = candidate.content.parts.filter(p => p.text);
        if (textParts.length > 0) {
          console.log('🤖 AI响应:', textParts[0].text);
        }
        
        const functionCalls = candidate.content.parts.filter(p => p.functionCall);
        if (functionCalls.length > 0) {
          console.log('🔧 触发的工具调用:');
          functionCalls.forEach((call, index) => {
            console.log(`  ${index + 1}. ${call.functionCall.name}(${JSON.stringify(call.functionCall.args)})`);
          });
          
          console.log('\n📊 工具调用分析:');
          console.log(`总计工具调用: ${functionCalls.length}`);
          console.log('这证明了Gemini支持工具调用功能！');
        } else {
          console.log('⚠️ 未检测到工具调用，可能模型不支持或请求格式不正确');
        }
      }
    } else if (response.status === 429) {
      console.log('⚠️ 遇到429频率限制');
    } else {
      console.log('❌ Gemini工具调用测试失败');
      console.log('响应:', JSON.stringify(response.data).substring(0, 200) + '...');
    }
  } catch (error) {
    console.log('❌ Gemini工具调用测试错误:', error.message);
  }
}

/**
 * 显示429统计报告
 */
function show429StatsReport() {
  console.log('\n📊 429频率限制统计报告');
  console.log('═'.repeat(80));
  
  console.log('\n🔑 API Key统计:');
  for (const [keyId, stats] of GEMINI_CONFIG.rateLimitStats.keyStats) {
    console.log(`  ${keyId}: 成功率 ${stats.successRate}%, 限制率 ${stats.rateLimitRate}% (${stats.total}次请求)`);
  }
  
  console.log('\n🧠 模型统计:');
  for (const [model, stats] of GEMINI_CONFIG.rateLimitStats.modelStats) {
    console.log(`  ${model}: 成功率 ${stats.successRate}%, 限制率 ${stats.rateLimitRate}% (${stats.total}次请求)`);
  }
  
  // 推荐策略
  console.log('\n💡 多Key轮询策略建议:');
  
  // 找出最好的API Key
  let bestKey = null;
  let bestSuccessRate = 0;
  for (const [keyId, stats] of GEMINI_CONFIG.rateLimitStats.keyStats) {
    if (parseFloat(stats.successRate) > bestSuccessRate) {
      bestSuccessRate = parseFloat(stats.successRate);
      bestKey = keyId;
    }
  }
  
  if (bestKey) {
    console.log(`  - 优先使用Key: ${bestKey} (成功率: ${bestSuccessRate}%)`);
  }
  
  // 找出最好的模型
  let bestModel = null;
  let bestModelSuccessRate = 0;
  for (const [model, stats] of GEMINI_CONFIG.rateLimitStats.modelStats) {
    if (parseFloat(stats.successRate) > bestModelSuccessRate) {
      bestModelSuccessRate = parseFloat(stats.successRate);
      bestModel = model;
    }
  }
  
  if (bestModel) {
    console.log(`  - 推荐模型: ${bestModel} (成功率: ${bestModelSuccessRate}%)`);
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🚀 Google Gemini端到端测试开始');
  console.log('═'.repeat(80));
  
  try {
    // 测试基本连接并获取工作配置
    const workingConfigs = await testGeminiConnection();
    
    if (workingConfigs.length === 0) {
      throw new Error('没有找到可用的Gemini配置');
    }
    
    console.log(`\n✅ 找到 ${workingConfigs.length} 个可用配置`);
    
    // 测试工具调用功能
    const bestConfig = workingConfigs[0]; // 使用第一个可用配置
    await testGeminiToolCalling(bestConfig);
    
    // 显示429统计报告
    show429StatsReport();
    
    console.log('\n🎯 Google Gemini测试完成！');
    console.log('📋 请检查测试结果和429频率统计，用于优化多key轮询策略。');
    
  } catch (error) {
    console.log('\n❌ Google Gemini测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}