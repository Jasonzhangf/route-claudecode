/**
 * Provider连接实际测试程序
 * 
 * 测试Anthropic和OpenAI protocol handlers与真实LM Studio的连接
 * 验证消息格式转换的准确性和性能
 * 
 * @author Jason Zhang
 */

const { AnthropicProtocolHandler } = require('../../dist/modules/providers/anthropic-protocol-handler');
const { OpenAIProtocolHandler } = require('../../dist/modules/providers/openai-protocol-handler');
const { ProviderManager } = require('../../dist/modules/providers/provider-manager');

/**
 * LM Studio连接配置
 */
const LM_STUDIO_CONFIG = {
  anthropic: {
    endpoint: 'http://localhost:1234/v1/messages',
    apiKey: 'lm-studio-key', // LM Studio通常不需要真实密钥
    model: 'llama-3.1-8b-instruct',
    timeout: 30000
  },
  openai: {
    endpoint: 'http://localhost:1234/v1/chat/completions',
    apiKey: 'lm-studio-key',
    model: 'llama-3.1-8b-instruct', 
    timeout: 30000
  }
};

/**
 * 测试消息
 */
const TEST_MESSAGES = {
  simple: {
    messages: [{
      role: 'user',
      content: 'Hello! Please respond with "Hello from LM Studio" to confirm the connection.'
    }]
  },
  complex: {
    messages: [
      {
        role: 'system', 
        content: 'You are a helpful assistant that responds in JSON format.'
      },
      {
        role: 'user',
        content: 'Please create a simple JSON object with your name and version.'
      }
    ]
  }
};

/**
 * 性能指标收集
 */
class PerformanceCollector {
  constructor() {
    this.metrics = [];
  }
  
  startMeasurement(testName) {
    return {
      testName,
      startTime: Date.now(),
      startMemory: process.memoryUsage().heapUsed
    };
  }
  
  endMeasurement(measurement, success, error = null) {
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    const result = {
      testName: measurement.testName,
      duration: endTime - measurement.startTime,
      memoryDelta: endMemory - measurement.startMemory,
      success,
      error: error ? error.message : null,
      timestamp: new Date().toISOString()
    };
    
    this.metrics.push(result);
    return result;
  }
  
  getReport() {
    const successful = this.metrics.filter(m => m.success);
    const failed = this.metrics.filter(m => !m.success);
    
    return {
      total: this.metrics.length,
      successful: successful.length,
      failed: failed.length,
      successRate: (successful.length / this.metrics.length * 100).toFixed(2) + '%',
      avgDuration: successful.length > 0 
        ? Math.round(successful.reduce((sum, m) => sum + m.duration, 0) / successful.length)
        : 0,
      maxDuration: successful.length > 0 
        ? Math.max(...successful.map(m => m.duration))
        : 0,
      avgMemoryUsage: successful.length > 0
        ? Math.round(successful.reduce((sum, m) => sum + Math.abs(m.memoryDelta), 0) / successful.length)
        : 0,
      details: this.metrics
    };
  }
}

/**
 * LM Studio连接检查
 */
async function checkLMStudioConnection() {
  console.log('🔍 检查LM Studio连接状态...');
  
  try {
    const response = await fetch('http://localhost:1234/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const models = await response.json();
      console.log('✅ LM Studio连接成功');
      console.log('📋 可用模型:', models.data?.map(m => m.id) || ['未知模型']);
      return true;
    } else {
      console.log('❌ LM Studio响应错误:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ LM Studio连接失败:', error.message);
    console.log('💡 请确保LM Studio正在运行并监听端口1234');
    return false;
  }
}

/**
 * 测试Anthropic Protocol Handler
 */
async function testAnthropicHandler(collector) {
  console.log('\\n🧪 测试Anthropic Protocol Handler...');
  
  const handler = new AnthropicProtocolHandler('test-anthropic', {
    apiKey: LM_STUDIO_CONFIG.anthropic.apiKey,
    baseURL: LM_STUDIO_CONFIG.anthropic.endpoint.replace('/v1/messages', '/v1'),
    defaultModel: LM_STUDIO_CONFIG.anthropic.model,
    timeout: LM_STUDIO_CONFIG.anthropic.timeout
  });
  
  try {
    await handler.start();
    
    // 简单消息测试
    const measurement1 = collector.startMeasurement('Anthropic-Simple');
    try {
      const result1 = await handler.handleRequest({
        model: LM_STUDIO_CONFIG.anthropic.model,
        messages: TEST_MESSAGES.simple.messages,
        max_tokens: 100
      });
      
      const metric1 = collector.endMeasurement(measurement1, true);
      console.log(`✅ 简单消息测试通过 (${metric1.duration}ms)`);
      console.log('📤 响应:', result1?.content?.[0]?.text?.substring(0, 100) || '无响应内容');
      
    } catch (error) {
      collector.endMeasurement(measurement1, false, error);
      console.log('❌ 简单消息测试失败:', error.message);
    }
    
    // 复杂消息测试
    const measurement2 = collector.startMeasurement('Anthropic-Complex');
    try {
      const result2 = await handler.handleRequest({
        model: LM_STUDIO_CONFIG.anthropic.model,
        messages: TEST_MESSAGES.complex.messages,
        max_tokens: 200
      });
      
      const metric2 = collector.endMeasurement(measurement2, true);
      console.log(`✅ 复杂消息测试通过 (${metric2.duration}ms)`);
      console.log('📤 响应:', result2?.content?.[0]?.text?.substring(0, 100) || '无响应内容');
      
    } catch (error) {
      collector.endMeasurement(measurement2, false, error);
      console.log('❌ 复杂消息测试失败:', error.message);
    }
    
    await handler.stop();
    
  } catch (error) {
    console.log('❌ Anthropic Handler初始化失败:', error.message);
  }
}

/**
 * 测试OpenAI Protocol Handler
 */
async function testOpenAIHandler(collector) {
  console.log('\\n🧪 测试OpenAI Protocol Handler...');
  
  const handler = new OpenAIProtocolHandler('test-openai', {
    apiKey: LM_STUDIO_CONFIG.openai.apiKey,
    baseURL: LM_STUDIO_CONFIG.openai.endpoint.replace('/v1/chat/completions', '/v1'),
    defaultModel: LM_STUDIO_CONFIG.openai.model,
    timeout: LM_STUDIO_CONFIG.openai.timeout
  });
  
  try {
    await handler.start();
    
    // 简单消息测试
    const measurement1 = collector.startMeasurement('OpenAI-Simple');
    try {
      const result1 = await handler.handleRequest({
        model: LM_STUDIO_CONFIG.openai.model,
        messages: TEST_MESSAGES.simple.messages,
        max_tokens: 100
      });
      
      const metric1 = collector.endMeasurement(measurement1, true);
      console.log(`✅ 简单消息测试通过 (${metric1.duration}ms)`);
      console.log('📤 响应:', result1?.choices?.[0]?.message?.content?.substring(0, 100) || '无响应内容');
      
    } catch (error) {
      collector.endMeasurement(measurement1, false, error);
      console.log('❌ 简单消息测试失败:', error.message);
    }
    
    // 复杂消息测试
    const measurement2 = collector.startMeasurement('OpenAI-Complex');
    try {
      const result2 = await handler.handleRequest({
        model: LM_STUDIO_CONFIG.openai.model,
        messages: TEST_MESSAGES.complex.messages,
        max_tokens: 200
      });
      
      const metric2 = collector.endMeasurement(measurement2, true);
      console.log(`✅ 复杂消息测试通过 (${metric2.duration}ms)`);
      console.log('📤 响应:', result2?.choices?.[0]?.message?.content?.substring(0, 100) || '无响应内容');
      
    } catch (error) {
      collector.endMeasurement(measurement2, false, error);
      console.log('❌ 复杂消息测试失败:', error.message);
    }
    
    await handler.stop();
    
  } catch (error) {
    console.log('❌ OpenAI Handler初始化失败:', error.message);
  }
}

/**
 * 并发测试
 */
async function testConcurrentRequests(collector) {
  console.log('\\n🚀 并发性能测试...');
  
  const handler = new OpenAIProtocolHandler('test-concurrent', {
    apiKey: LM_STUDIO_CONFIG.openai.apiKey,
    baseURL: LM_STUDIO_CONFIG.openai.endpoint.replace('/v1/chat/completions', '/v1'),
    defaultModel: LM_STUDIO_CONFIG.openai.model,
    timeout: LM_STUDIO_CONFIG.openai.timeout
  });
  
  try {
    await handler.start();
    
    const concurrency = 3; // 并发3个请求
    const promises = [];
    
    for (let i = 0; i < concurrency; i++) {
      const measurement = collector.startMeasurement(`Concurrent-${i + 1}`);
      const promise = handler.handleRequest({
        model: LM_STUDIO_CONFIG.openai.model,
        messages: [{
          role: 'user',
          content: `Concurrent test request ${i + 1}. Please respond briefly.`
        }],
        max_tokens: 50
      }).then(result => {
        collector.endMeasurement(measurement, true);
        return result;
      }).catch(error => {
        collector.endMeasurement(measurement, false, error);
        throw error;
      });
      
      promises.push(promise);
    }
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`✅ 并发测试完成: ${successful}/${concurrency} 成功`);
    
    await handler.stop();
    
  } catch (error) {
    console.log('❌ 并发测试失败:', error.message);
  }
}

/**
 * 主测试函数
 */
async function runConnectionTests() {
  console.log('🧪 RCC v4.0 Provider连接测试启动');
  console.log('===============================================');
  
  const collector = new PerformanceCollector();
  
  // 检查LM Studio连接
  const lmStudioAvailable = await checkLMStudioConnection();
  if (!lmStudioAvailable) {
    console.log('\\n⚠️  测试终止：LM Studio不可用');
    return;
  }
  
  // 等待一下让LM Studio准备好
  console.log('⏳ 等待LM Studio准备就绪...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 运行各项测试
  await testAnthropicHandler(collector);
  await testOpenAIHandler(collector);
  await testConcurrentRequests(collector);
  
  // 生成测试报告
  console.log('\\n📊 测试报告');
  console.log('===============================================');
  const report = collector.getReport();
  
  console.log(`📋 总测试数: ${report.total}`);
  console.log(`✅ 成功: ${report.successful}`);
  console.log(`❌ 失败: ${report.failed}`);
  console.log(`📈 成功率: ${report.successRate}`);
  console.log(`⏱️  平均响应时间: ${report.avgDuration}ms`);
  console.log(`🚀 最大响应时间: ${report.maxDuration}ms`);
  console.log(`💾 平均内存使用: ${(report.avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
  
  // 性能评估
  if (report.avgDuration < 100) {
    console.log('🎯 性能评估: 优秀 (<100ms)');
  } else if (report.avgDuration < 500) {
    console.log('✅ 性能评估: 良好 (<500ms)');
  } else if (report.avgDuration < 1000) {
    console.log('⚠️  性能评估: 一般 (<1s)');
  } else {
    console.log('❌ 性能评估: 需要优化 (>1s)');
  }
  
  // 保存详细报告到文件
  const fs = require('fs');
  const reportPath = './provider-connection-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    lmStudioConfig: LM_STUDIO_CONFIG,
    summary: report,
    recommendations: generateRecommendations(report)
  }, null, 2));
  
  console.log(`\\n📄 详细测试报告已保存到: ${reportPath}`);
}

/**
 * 生成优化建议
 */
function generateRecommendations(report) {
  const recommendations = [];
  
  if (report.successRate < 100) {
    recommendations.push({
      type: 'reliability',
      message: '存在失败的请求，需要改进错误处理和重试机制',
      priority: 'high'
    });
  }
  
  if (report.avgDuration > 100) {
    recommendations.push({
      type: 'performance',
      message: '平均响应时间超过100ms，建议优化请求处理逻辑',
      priority: 'medium'
    });
  }
  
  if (report.maxDuration > 1000) {
    recommendations.push({
      type: 'performance',
      message: '存在超过1秒的慢请求，需要添加超时控制',
      priority: 'high'
    });
  }
  
  if (report.avgMemoryUsage > 50 * 1024 * 1024) { // 50MB
    recommendations.push({
      type: 'memory',
      message: '内存使用较高，建议优化对象创建和垃圾回收',
      priority: 'medium'
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      message: 'Provider系统表现优秀，所有指标都达到预期',
      priority: 'info'
    });
  }
  
  return recommendations;
}

// 运行测试
if (require.main === module) {
  runConnectionTests().catch(error => {
    console.error('💥 测试执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  runConnectionTests,
  checkLMStudioConnection,
  PerformanceCollector
};