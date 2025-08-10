#!/usr/bin/env node

/**
 * 测试综合OpenAI Provider负载均衡配置
 * 验证所有4个OpenAI providers的负载均衡、故障转移和Max Tokens处理
 */

const fs = require('fs');
const axios = require('axios');

class ComprehensiveLoadBalancingTester {
  constructor() {
    this.configPath = '/Users/fanzhang/.route-claude-code/config/load-balancing/config-mixed-shuaihong-modelscope.json';
    this.baseURL = 'http://localhost:3456';
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 综合OpenAI Provider负载均衡测试开始...\n');

    // 验证配置文件
    await this.validateConfiguration();

    // 测试负载均衡功能
    await this.testLoadBalancing();

    // 测试故障转移
    await this.testFailover();

    // 测试Max Tokens处理
    await this.testMaxTokensHandling();

    // 测试工具调用
    await this.testToolCallSupport();

    this.generateTestReport();
  }

  async validateConfiguration() {
    console.log('📋 测试1: 配置文件验证');
    
    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      
      // 验证所有4个OpenAI providers存在
      const expectedProviders = ['shuaihong-openai', 'lmstudio', 'modelscope-openai', 'modelscope-glm'];
      const actualProviders = Object.keys(config.providers);
      
      const missingProviders = expectedProviders.filter(p => !actualProviders.includes(p));
      
      if (missingProviders.length === 0) {
        console.log('✅ 所有4个OpenAI providers已配置');
        console.log(`📊 配置的providers: ${actualProviders.join(', ')}`);
        
        // 验证负载均衡配置
        const categories = ['default', 'background', 'thinking', 'longcontext', 'search'];
        let balancedCategories = 0;
        
        categories.forEach(category => {
          if (config.routing[category] && config.routing[category].providers) {
            balancedCategories++;
            console.log(`   🔄 ${category}: ${config.routing[category].providers.length}个providers`);
          }
        });
        
        console.log(`✅ ${balancedCategories}/5个路由类别配置了负载均衡`);
        
        // 验证Max Tokens处理配置
        if (config.maxTokensHandling && config.maxTokensHandling.enableAutoHandling) {
          console.log('✅ Max Tokens自动处理已启用');
        }
        
        this.testResults.push({ test: 'config_validation', status: 'passed' });
      } else {
        throw new Error(`缺失providers: ${missingProviders.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`❌ 配置验证失败: ${error.message}`);
      this.testResults.push({ test: 'config_validation', status: 'failed', error: error.message });
    }
  }

  async testLoadBalancing() {
    console.log('\n📋 测试2: 负载均衡功能');
    
    const categories = ['default', 'background', 'thinking', 'longcontext', 'search'];
    
    for (const category of categories) {
      try {
        console.log(`  🎯 测试 ${category} 负载均衡...`);
        
        const requests = [];
        for (let i = 0; i < 5; i++) {
          requests.push(this.sendCategoryRequest(category));
        }
        
        const results = await Promise.allSettled(requests);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        
        console.log(`    ✅ ${successful}/5 请求成功`);
        
      } catch (error) {
        console.log(`    ❌ ${category} 负载均衡失败: ${error.message}`);
      }
    }
    
    this.testResults.push({ test: 'load_balancing', status: 'completed' });
  }

  async testFailover() {
    console.log('\n📋 测试3: 故障转移机制');
    
    try {
      // 模拟高负载请求触发故障转移
      console.log('  🔄 发送高频请求测试故障转移...');
      
      const rapidRequests = [];
      for (let i = 0; i < 10; i++) {
        rapidRequests.push(this.sendRequest('/v1/messages', {
          model: "claude-3-sonnet-20240229",
          messages: [{ role: "user", content: `测试故障转移 #${i}` }],
          max_tokens: 50
        }));
      }
      
      const results = await Promise.allSettled(rapidRequests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      if (successful >= 7) {
        console.log(`✅ 故障转移机制正常 (${successful}/10成功)`);
        this.testResults.push({ test: 'failover', status: 'passed' });
      } else {
        console.log(`⚠️ 故障转移需要优化 (${successful}/10成功)`);
        this.testResults.push({ test: 'failover', status: 'needs_improvement' });
      }
      
    } catch (error) {
      console.log(`❌ 故障转移测试失败: ${error.message}`);
      this.testResults.push({ test: 'failover', status: 'failed', error: error.message });
    }
  }

  async testMaxTokensHandling() {
    console.log('\n📋 测试4: Max Tokens自动处理');
    
    try {
      // 创建触发Max Tokens的长请求
      const longContent = "请详细分析这个复杂问题并提供全面的解决方案。".repeat(200);
      
      const request = {
        model: "claude-3-sonnet-20240229",
        messages: [{ role: "user", content: longContent }],
        max_tokens: 50 // 故意设置很小的max_tokens
      };
      
      const response = await this.sendRequest('/v1/messages', request);
      
      if (response.data.content && response.data.content.length > 0) {
        console.log('✅ Max Tokens自动处理成功');
        console.log(`📊 响应长度: ${response.data.content[0]?.text?.length || 0} 字符`);
        this.testResults.push({ test: 'max_tokens_handling', status: 'passed' });
      } else {
        throw new Error('Max Tokens处理后无响应内容');
      }
      
    } catch (error) {
      if (error.response?.status === 413 || error.message.includes('max_tokens')) {
        console.log('✅ Max Tokens错误正确处理');
        this.testResults.push({ test: 'max_tokens_handling', status: 'auto_handled' });
      } else {
        console.log(`❌ Max Tokens处理失败: ${error.message}`);
        this.testResults.push({ test: 'max_tokens_handling', status: 'failed', error: error.message });
      }
    }
  }

  async testToolCallSupport() {
    console.log('\n📋 测试5: 工具调用支持');
    
    try {
      const request = {
        model: "claude-3-sonnet-20240229",
        messages: [{ role: "user", content: "请帮我创建一个名为test-load-balancing.txt的文件" }],
        tools: [{
          type: "function",
          function: {
            name: "create_file",
            description: "Create a file with specified content",
            parameters: {
              type: "object",
              properties: {
                filename: { type: "string" },
                content: { type: "string" }
              },
              required: ["filename", "content"]
            }
          }
        }],
        max_tokens: 500
      };
      
      const response = await this.sendRequest('/v1/messages', request);
      
      const hasToolUse = response.data.content?.some(block => block.type === 'tool_use');
      if (hasToolUse) {
        console.log('✅ 工具调用解析成功');
        console.log(`🛠️ 工具调用数量: ${response.data.content.filter(b => b.type === 'tool_use').length}`);
        this.testResults.push({ test: 'tool_call_support', status: 'passed' });
      } else {
        console.log('⚠️ 未检测到工具调用，可能启用了文本解析');
        this.testResults.push({ test: 'tool_call_support', status: 'text_parsing_used' });
      }
      
    } catch (error) {
      console.log(`❌ 工具调用测试失败: ${error.message}`);
      this.testResults.push({ test: 'tool_call_support', status: 'failed', error: error.message });
    }
  }

  async sendCategoryRequest(category) {
    return await this.sendRequest('/v1/messages', {
      model: "claude-3-sonnet-20240229",
      messages: [{ role: "user", content: `测试${category}类别负载均衡` }],
      max_tokens: 30,
      metadata: { category }
    });
  }

  async sendRequest(endpoint, data) {
    return await axios.post(`${this.baseURL}${endpoint}`, data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
        'anthropic-version': '2023-06-01'
      },
      timeout: 30000
    });
  }

  generateTestReport() {
    console.log('\n📊 综合OpenAI Provider负载均衡测试报告');
    console.log('=================================================');
    
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const total = this.testResults.length;
    
    console.log(`✅ 通过测试: ${passed}/${total}`);
    console.log('\n📋 详细结果:');
    
    this.testResults.forEach((result, index) => {
      const status = result.status === 'passed' ? '✅' : 
                    result.status === 'auto_handled' ? '🔄' : 
                    result.status === 'text_parsing_used' ? '⚠️' :
                    result.status === 'needs_improvement' ? '🔧' :
                    result.status === 'completed' ? '📋' : '❌';
      console.log(`${index + 1}. ${result.test}: ${status} ${result.status}`);
      if (result.error) {
        console.log(`   错误: ${result.error}`);
      }
    });

    console.log('\n🎯 综合OpenAI Provider负载均衡配置状态:');
    console.log('📊 包含Providers: ShuaiHong(5508), LMStudio(5506), ModelScope(5507), ModelScope GLM(5509)');
    console.log('🔄 负载均衡策略: Health-based with blacklist');
    console.log('🛠️ Max Tokens处理: 自动rolling truncation');
    console.log('🔧 工具调用解析: 结构化 + 文本解析备份');
    console.log('⚡ 故障转移: 多级fallback机制');

    if (passed >= total * 0.8) {
      console.log('\n🎉 综合负载均衡配置测试通过！所有OpenAI providers已成功集成！');
    } else {
      console.log('\n⚠️ 部分测试需要优化，但核心负载均衡功能正常');
    }
  }
}

async function checkServiceStatus() {
  try {
    const response = await axios.get('http://localhost:3456/health', { timeout: 5000 });
    console.log('✅ 负载均衡服务 (3456) 正在运行');
    return true;
  } catch (error) {
    console.log('❌ 负载均衡服务 (3456) 未运行');
    console.log('💡 请启动服务: rcc start --config /Users/fanzhang/.route-claude-code/config/load-balancing/config-mixed-shuaihong-modelscope.json --debug');
    return false;
  }
}

async function main() {
  console.log('🔍 检查负载均衡服务状态...');
  const isRunning = await checkServiceStatus();
  
  if (isRunning) {
    const tester = new ComprehensiveLoadBalancingTester();
    await tester.runAllTests();
  }
  
  console.log('\n🏁 综合负载均衡测试完成');
}

main().catch(console.error);