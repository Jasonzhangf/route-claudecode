#!/usr/bin/env node

/**
 * 调试Gemini路由问题
 * 验证请求是否正确路由到Gemini provider而不是CodeWhisperer
 * 检查路由配置的问题所在
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

async function analyzeRoutingConfig() {
  console.log('🔧 分析路由配置...');
  
  const configPath = path.expanduser ? path.expanduser('~/.route-claude-code/config.json') : 
                     path.join(process.env.HOME || process.env.USERPROFILE, '.route-claude-code/config.json');
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    console.log('📋 当前路由配置:');
    console.log('   routing.default:', config.routing?.default);
    console.log('   routing.background:', config.routing?.background);
    console.log('   routing.thinking:', config.routing?.thinking);
    console.log('   routing.longcontext:', config.routing?.longcontext);
    console.log('   routing.search:', config.routing?.search);
    
    console.log('\n🔍 可用的Providers:');
    if (config.providers) {
      Object.keys(config.providers).forEach(providerId => {
        const provider = config.providers[providerId];
        console.log(`   ${providerId}: ${provider.type} (${provider.endpoint || 'N/A'})`);
      });
    }
    
    // 检查是否有Gemini provider
    const geminiProviders = Object.keys(config.providers || {}).filter(id => 
      id.includes('gemini') || config.providers[id].type === 'gemini'
    );
    
    console.log('\n⚠️ 问题分析:');
    if (geminiProviders.length === 0) {
      console.log('   ❌ 配置中没有找到Gemini provider');
      console.log('   💡 建议: 需要添加Gemini provider到配置文件');
    } else {
      console.log(`   ✅ 找到 ${geminiProviders.length} 个Gemini provider: ${geminiProviders.join(', ')}`);
    }
    
    // 检查路由配置
    const allRoutesToCodewhisperer = Object.values(config.routing || {}).every(route => 
      route.provider && route.provider.includes('codewhisperer')
    );
    
    if (allRoutesToCodewhisperer) {
      console.log('   ❌ 所有路由类别都指向CodeWhisperer');
      console.log('   💡 建议: search和longcontext应该路由到Gemini provider');
    }
    
    return {
      hasGeminiProvider: geminiProviders.length > 0,
      geminiProviders,
      routingConfig: config.routing,
      allProviders: Object.keys(config.providers || {})
    };
    
  } catch (error) {
    console.log('❌ 无法读取配置文件:', error.message);
    return null;
  }
}

async function testSearchRouting() {
  console.log('\n🔍 测试search类别路由...');
  
  // 创建包含搜索工具的请求，应该路由到search类别
  const searchRequest = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    stream: true,
    messages: [
      {
        role: 'user',
        content: '请搜索最新的JavaScript框架信息'
      }
    ],
    tools: [
      {
        name: 'WebSearch',
        description: 'Search the web for information',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string' }
          }
        }
      }
    ]
  };

  return testRequest(searchRequest, 'search', 'WebSearch工具');
}

async function testLongContextRouting() {
  console.log('\n🔍 测试longcontext类别路由...');
  
  // 创建超长请求，应该路由到longcontext类别
  const longContent = '这是一个超长内容用于测试longcontext路由功能。'.repeat(3000); // 约150KB
  const longContextRequest = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    stream: true,
    messages: [
      {
        role: 'user',
        content: `超长内容: ${longContent}\n\n请总结这段内容的主要信息。`
      }
    ]
  };

  const estimatedTokens = Math.round(JSON.stringify(longContextRequest).length / 4);
  console.log(`   估算tokens: ${estimatedTokens} (应该 > 45000)`);

  return testRequest(longContextRequest, 'longcontext', '超长内容');
}

async function testRequest(request, expectedCategory, description) {
  const postData = JSON.stringify(request);
  
  console.log(`📊 测试${description}:`);
  console.log(`   预期路由类别: ${expectedCategory}`);
  console.log(`   请求大小: ${Math.round(postData.length / 1024)}KB`);

  const options = {
    hostname: 'localhost',
    port: 3456, // 使用正确的端口
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'text/event-stream'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let rawData = '';
      let eventCount = 0;
      let detectedModel = '';
      let detectedProvider = '';

      console.log(`📡 开始接收响应 (HTTP ${res.statusCode})...`);

      if (res.statusCode >= 400) {
        let errorData = '';
        res.on('data', (chunk) => errorData += chunk.toString());
        res.on('end', () => {
          console.log(`❌ HTTP错误 ${res.statusCode}:`);
          console.log(errorData);
          resolve({
            statusCode: res.statusCode,
            error: errorData,
            detectedModel: '',
            detectedProvider: 'unknown',
            routedCorrectly: false
          });
        });
        return;
      }

      res.on('data', (chunk) => {
        const data = chunk.toString();
        rawData += data;
        
        const lines = data.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6));
              eventCount++;
              
              if (eventData.type === 'message_start' && eventData.message?.model) {
                detectedModel = eventData.message.model;
                // 推断provider
                if (detectedModel.includes('gemini')) {
                  detectedProvider = 'gemini';
                } else if (detectedModel.includes('CLAUDE') || detectedModel.includes('claude')) {
                  detectedProvider = 'codewhisperer';
                } else if (detectedModel.includes('Qwen') || detectedModel.includes('qwen')) {
                  detectedProvider = 'modelscope';
                } else {
                  detectedProvider = 'unknown';
                }
              }
            } catch (e) {}
          }
        }
      });

      res.on('end', () => {
        console.log(`✅ 响应完成:`);
        console.log(`   事件数: ${eventCount}`);
        console.log(`   检测模型: ${detectedModel}`);
        console.log(`   推断Provider: ${detectedProvider}`);
        
        // 关键分析
        const expectedProvider = expectedCategory === 'search' || expectedCategory === 'longcontext' ? 'gemini' : 'codewhisperer';
        const routedCorrectly = detectedProvider === expectedProvider;
        
        console.log(`   预期Provider: ${expectedProvider}`);
        console.log(`   路由结果: ${routedCorrectly ? '✅ 路由正确' : '❌ 路由错误'}`);
        
        if (!routedCorrectly) {
          console.log(`   ⚠️ 问题: ${expectedCategory}类别应该路由到${expectedProvider}，但实际路由到了${detectedProvider}`);
        }
        
        resolve({
          statusCode: res.statusCode,
          eventCount,
          detectedModel,
          detectedProvider,
          routedCorrectly,
          expectedCategory,
          expectedProvider
        });
      });
    });

    req.on('error', (error) => {
      console.log(`❌ 请求失败:`, error.message);
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    console.log('🔍 开始Gemini路由问题诊断...\n');
    
    // Step 1: 分析配置
    const configAnalysis = await analyzeRoutingConfig();
    
    if (!configAnalysis) {
      console.log('❌ 无法分析配置，中止测试');
      process.exit(1);
    }
    
    // Step 2: 测试search路由
    const searchResult = await testSearchRouting();
    
    // Step 3: 测试longcontext路由
    const longContextResult = await testLongContextRouting();
    
    // Step 4: 总结问题
    console.log('\n📋 诊断总结:');
    console.log('='.repeat(50));
    
    if (!configAnalysis.hasGeminiProvider) {
      console.log('🔥 根本问题: 配置中缺少Gemini provider');
      console.log('💡 解决方案: 需要在~/.route-claude-code/config.json中添加Gemini provider配置');
      console.log('💡 然后更新routing.search和routing.longcontext指向Gemini provider');
    } else {
      console.log('✅ 配置中有Gemini provider:', configAnalysis.geminiProviders.join(', '));
      
      if (!searchResult.routedCorrectly) {
        console.log('❌ search路由问题: 应该路由到Gemini但路由到了', searchResult.detectedProvider);
      }
      
      if (!longContextResult.routedCorrectly) {
        console.log('❌ longcontext路由问题: 应该路由到Gemini但路由到了', longContextResult.detectedProvider);
      }
      
      if (searchResult.routedCorrectly && longContextResult.routedCorrectly) {
        console.log('✅ 路由配置正确，问题可能在其他地方');
      }
    }
    
    console.log('\n🔍 调试完成');
    
  } catch (error) {
    console.log('❌ 调试失败:', error.message);
    process.exit(1);
  }
}

main();