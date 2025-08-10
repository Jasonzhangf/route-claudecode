#!/usr/bin/env node

/**
 * 调试LMStudio响应格式问题
 * 检查5506端口LMStudio的实际响应数据
 */

const axios = require('axios');

class LMStudioResponseDebugger {
  constructor() {
    this.lmstudioEndpoint = 'http://localhost:1234/v1/chat/completions';
    this.routerEndpoint = 'http://localhost:5506/v1/messages';
  }

  async debugDirectLMStudio() {
    console.log('🔍 测试1: 直接调用LMStudio API...\n');
    
    try {
      const response = await axios.post(this.lmstudioEndpoint, {
        model: "gpt-oss-20b-mlx",
        messages: [{ role: "user", content: "简短回复：测试" }],
        max_tokens: 20,
        stream: false
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log('✅ LMStudio直接调用成功');
      console.log('📊 响应状态:', response.status);
      console.log('📋 响应数据结构:');
      console.log('  - id:', response.data.id);
      console.log('  - object:', response.data.object);
      console.log('  - model:', response.data.model);
      console.log('  - choices存在:', !!response.data.choices);
      console.log('  - choices长度:', response.data.choices?.length || 0);
      
      if (response.data.choices?.[0]) {
        console.log('  - choice[0].message.role:', response.data.choices[0].message?.role);
        console.log('  - choice[0].message.content长度:', response.data.choices[0].message?.content?.length || 0);
        console.log('  - choice[0].finish_reason:', response.data.choices[0].finish_reason);
      }
      console.log('  - usage:', response.data.usage);
      console.log('');
      
    } catch (error) {
      console.log('❌ LMStudio直接调用失败:', error.message);
      if (error.response?.data) {
        console.log('📄 错误响应数据:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  async debugDirectLMStudioStream() {
    console.log('🔍 测试2: 直接调用LMStudio流式API...\n');
    
    try {
      const response = await axios.post(this.lmstudioEndpoint, {
        model: "gpt-oss-20b-mlx", 
        messages: [{ role: "user", content: "简短回复：测试流式" }],
        max_tokens: 20,
        stream: true
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        responseType: 'stream'
      });

      console.log('✅ LMStudio流式调用开始');
      console.log('📊 响应状态:', response.status);
      
      let chunkCount = 0;
      let hasChoices = false;
      let lastChunk = null;
      
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data = JSON.parse(line.slice(6));
              chunkCount++;
              lastChunk = data;
              
              if (data.choices) {
                hasChoices = true;
              }
              
              if (chunkCount <= 3) {
                console.log(`📦 chunk ${chunkCount}:`, {
                  id: data.id,
                  object: data.object,
                  hasChoices: !!data.choices,
                  choicesLength: data.choices?.length || 0,
                  deltaContent: data.choices?.[0]?.delta?.content || '',
                  finishReason: data.choices?.[0]?.finish_reason
                });
              }
            } catch (e) {
              // Skip parse errors
            }
          }
        }
      });
      
      response.data.on('end', () => {
        console.log(`📊 流式响应完成:`);
        console.log(`  - 总chunk数: ${chunkCount}`);
        console.log(`  - 包含choices: ${hasChoices}`);
        if (lastChunk) {
          console.log(`  - 最后chunk finish_reason: ${lastChunk.choices?.[0]?.finish_reason}`);
        }
        console.log('');
      });
      
      response.data.on('error', (error) => {
        console.log('❌ 流式响应错误:', error.message);
      });
      
    } catch (error) {
      console.log('❌ LMStudio流式调用失败:', error.message);
    }
  }

  async debugRouterRequest() {
    console.log('🔍 测试3: 通过5506端口调用路由器...\n');
    
    try {
      const response = await axios.post(this.routerEndpoint, {
        model: "claude-3-sonnet-20240229",
        messages: [{ role: "user", content: "简短回复：路由器测试" }],
        max_tokens: 20,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
          'anthropic-version': '2023-06-01'
        },
        timeout: 15000
      });

      console.log('✅ 路由器调用成功');
      console.log('📊 响应状态:', response.status);
      console.log('📋 响应数据结构:');
      console.log('  - id:', response.data.id);
      console.log('  - type:', response.data.type);
      console.log('  - role:', response.data.role);
      console.log('  - content存在:', !!response.data.content);
      console.log('  - content长度:', response.data.content?.length || 0);
      
      if (response.data.content?.[0]) {
        console.log('  - content[0].type:', response.data.content[0].type);
        console.log('  - content[0].text长度:', response.data.content[0].text?.length || 0);
      }
      
      console.log('  - stop_reason:', response.data.stop_reason);
      console.log('  - usage:', response.data.usage);
      console.log('');
      
    } catch (error) {
      console.log('❌ 路由器调用失败:', error.message);
      if (error.response?.data) {
        console.log('📄 错误响应数据:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  async debugProviderConfiguration() {
    console.log('🔍 测试4: 检查5506端口配置...\n');
    
    try {
      const healthResponse = await axios.get('http://localhost:5506/health', {
        timeout: 5000
      });
      
      console.log('✅ 5506端口健康检查通过');
      console.log('📋 服务信息:', healthResponse.data);
      console.log('');
      
    } catch (error) {
      console.log('❌ 5506端口不可用:', error.message);
    }
  }

  async runAllTests() {
    console.log('🧪 LMStudio响应格式调试开始...\n');
    
    await this.debugProviderConfiguration();
    await this.debugDirectLMStudio();
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.debugDirectLMStudioStream();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.debugRouterRequest();
    
    console.log('🏁 调试完成');
  }
}

async function main() {
  const debugInstance = new LMStudioResponseDebugger();
  await debugInstance.runAllTests();
}

main().catch(console.error);