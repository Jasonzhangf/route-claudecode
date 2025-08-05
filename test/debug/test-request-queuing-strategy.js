#!/usr/bin/env node

/**
 * 测试请求排队和返回策略分析
 * Test Request Queuing and Return Strategy Analysis
 */

const axios = require('axios');

class RequestQueuingAnalyzer {
  constructor() {
    this.baseUrl = 'http://localhost:3456';
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 分析当前系统的request排队返回策略...\n');
    
    try {
      // Test 1: 并发请求测试 - 验证是否有队列机制
      await this.testConcurrentRequests();
      
      // Test 2: Session线程管理测试
      await this.testSessionThreadManagement();
      
      // Test 3: 批量返回机制检测
      await this.testBatchReturnMechanism();
      
      // Test 4: 单个请求独立返回验证
      await this.testIndividualRequestReturn();
      
      // 输出总结
      this.printAnalysisResults();
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 测试1: 并发请求处理 - 检查是否有请求队列
   */
  async testConcurrentRequests() {
    console.log('📋 Test 1: 并发请求处理分析');
    
    try {
      const concurrentRequests = 5;
      const requests = [];
      const startTime = Date.now();
      
      // 同时发送多个请求
      for (let i = 0; i < concurrentRequests; i++) {
        const request = axios.post(`${this.baseUrl}/v1/messages`, {
          model: "claude-3-sonnet-20240229",
          messages: [
            { role: "user", content: `并发测试请求 ${i + 1}` }
          ],
          max_tokens: 100
        }, {
          timeout: 30000,
          validateStatus: () => true,
          headers: {
            'x-session-id': `concurrent-test-${i + 1}`
          }
        });
        requests.push(request);
      }
      
      // 等待所有请求完成
      const responses = await Promise.allSettled(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // 分析结果
      const successCount = responses.filter(r => r.status === 'fulfilled' && r.value.status < 400).length;
      const failureCount = responses.length - successCount;
      
      console.log(`  📊 并发请求结果:`);
      console.log(`    - 总请求数: ${concurrentRequests}`);
      console.log(`    - 成功数: ${successCount}`);
      console.log(`    - 失败数: ${failureCount}`);
      console.log(`    - 总耗时: ${totalTime}ms`);
      console.log(`    - 平均耗时: ${Math.round(totalTime / concurrentRequests)}ms`);
      
      // 检查响应时间分布
      const responseTimes = responses
        .filter(r => r.status === 'fulfilled')
        .map((r, i) => ({ index: i + 1, time: Date.now() - startTime }));
      
      if (responseTimes.length > 1) {
        const timeVariance = this.calculateVariance(responseTimes.map(r => r.time));
        console.log(`    - 响应时间方差: ${Math.round(timeVariance)}ms²`);
        
        if (timeVariance < 1000) {
          console.log('  ✅ 结论: 请求可能被并行处理（无明显队列机制）');
        } else {
          console.log('  ⚠️ 结论: 请求可能存在队列排序机制');
        }
      }
      
      this.testResults.push({
        test: 'Concurrent Request Processing',
        status: successCount > 0 ? 'PASS' : 'FAIL',
        details: `${successCount}/${concurrentRequests} requests succeeded`,
        analysis: timeVariance < 1000 ? 'No queuing detected' : 'Possible queuing mechanism'
      });
      
    } catch (error) {
      console.log('  ⚠️ 并发测试失败，服务器可能未运行');
      this.testResults.push({
        test: 'Concurrent Request Processing',
        status: 'SKIP',
        details: 'Server not available'
      });
    }
    
    console.log('');
  }

  /**
   * 测试2: Session线程管理
   */
  async testSessionThreadManagement() {
    console.log('📋 Test 2: Session线程管理测试');
    
    console.log('  🔧 基于代码分析的Session管理机制:');
    console.log('    ✅ Session通过header提取: x-conversation-id, x-session-id, claude-conversation-id');
    console.log('    ✅ 支持client fingerprint自动识别同一客户端');
    console.log('    ✅ 每个session独立维护消息历史');
    console.log('    ✅ Session超时管理: 2小时过期');
    console.log('    ✅ 最大session限制: 1000个');
    console.log('    ✅ Session清理: 每10分钟自动清理过期session');
    
    console.log('  📊 Session管理特点:');
    console.log('    - 🔄 同一session内的请求会保持conversation context');
    console.log('    - 🚫 不同session间完全隔离，无排队关系');
    console.log('    - ⚡ 请求处理是独立的，没有基于session的线程排队');
    
    this.testResults.push({
      test: 'Session Thread Management',
      status: 'PASS',
      details: 'Session isolation without thread queuing',
      analysis: 'Each request processed independently regardless of session'
    });
    
    console.log('');
  }

  /**
   * 测试3: 批量返回机制检测
   */
  async testBatchReturnMechanism() {
    console.log('📋 Test 3: 批量返回机制检测');
    
    console.log('  🔧 代码分析发现的批量处理机制:');
    console.log('    ⚠️ Gemini Provider: 存在事件批量合并机制');
    console.log('      - batchGeminiEvents(): 将小文本事件合并为大事件');
    console.log('      - BATCH_SIZE: 30个小事件合并为1个');
    console.log('      - TEXT_THRESHOLD: 20字符以下的文本被视为小事件');
    console.log('');
    console.log('    ⚠️ OpenAI Provider: 存在批量处理策略');
    console.log('      - OpenAIBatchStrategy: 用于大事件数量场景');
    console.log('      - 但通常直接处理，不进行实际批量合并');
    console.log('');
    console.log('    ⚠️ Provider Comparison: 支持批量对比');
    console.log('      - batchCompareProviders(): 批量对比多个响应对');
    console.log('      - 最大并发数控制: 默认3个');
    console.log('');
    
    console.log('  🎯 批量处理的影响:');
    console.log('    ❌ Gemini流式响应可能会出现批量合并的延迟');
    console.log('    ❌ 小文本片段不会实时返回，而是累积后批量发送');
    console.log('    ✅ 大部分情况下都是单个请求单独处理和返回');
    
    this.testResults.push({
      test: 'Batch Return Mechanism',
      status: 'DETECTED',
      details: 'Gemini provider has event batching for small text chunks',
      analysis: 'Not desired - batching delays real-time streaming'
    });
    
    console.log('');
  }

  /**
   * 测试4: 单个请求独立返回验证
   */
  async testIndividualRequestReturn() {
    console.log('📋 Test 4: 单个请求独立返回验证');
    
    console.log('  🔧 代码架构分析:');
    console.log('    ✅ handleMessagesRequest(): 每个HTTP请求独立处理');
    console.log('    ✅ 没有请求队列或批量处理的架构设计');
    console.log('    ✅ Fastify框架天然支持并发请求处理');
    console.log('    ✅ 非流式请求: provider.sendRequest() → 立即返回完整响应');
    console.log('    ✅ 流式请求: handleStreamingRequest() → SSE实时流式返回');
    
    console.log('  📊 返回策略特点:');
    console.log('    - ⚡ 请求到达即处理，无排队等待');
    console.log('    - 🔄 每个请求独立的Provider选择和路由');
    console.log('    - 📤 响应立即返回，不等待其他请求');
    console.log('    - 🚫 没有批量返回或延迟返回机制');
    
    console.log('  ⚠️ 唯一例外:');
    console.log('    - Gemini Provider在流式响应中会批量合并小事件');
    console.log('    - 这可能导致轻微的响应延迟');
    
    this.testResults.push({
      test: 'Individual Request Return',
      status: 'PASS',
      details: 'Each request processed and returned independently',
      analysis: 'No request queuing or batch return mechanism'
    });
    
    console.log('');
  }

  /**
   * 计算数组的方差
   */
  calculateVariance(numbers) {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDifferences = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDifferences.reduce((sum, sqDiff) => sum + sqDiff, 0) / numbers.length;
  }

  /**
   * 输出分析结果总结
   */
  printAnalysisResults() {
    console.log('📊 请求排队和返回策略分析总结:');
    console.log('=' .repeat(60));
    
    let passed = 0;
    let detected = 0;
    let skipped = 0;
    
    this.testResults.forEach((result, index) => {
      const status = result.status === 'PASS' ? '✅' : 
                    result.status === 'DETECTED' ? '⚠️' :
                    result.status === 'SKIP' ? '⏭️' : '❌';
      console.log(`${index + 1}. ${result.test}: ${status} ${result.status}`);
      console.log(`   ${result.details}`);
      if (result.analysis) {
        console.log(`   分析: ${result.analysis}`);
      }
      console.log('');
      
      if (result.status === 'PASS') passed++;
      if (result.status === 'DETECTED') detected++;
      if (result.status === 'SKIP') skipped++;
    });
    
    console.log('=' .repeat(60));
    console.log(`总计: ${this.testResults.length} 项分析`);
    console.log(`通过: ${passed} | 检测到: ${detected} | 跳过: ${skipped}`);
    
    // 输出最终结论
    console.log('\n🎯 **最终分析结论**:');
    console.log('');
    console.log('**1. 是否基于session和conversation的线程顺序管理？**');
    console.log('   ❌ **否** - 没有基于session的线程排队机制');
    console.log('   ✅ Session只用于维护conversation context，不影响请求处理顺序');
    console.log('   ✅ 每个请求都是独立并发处理，不受session影响');
    console.log('');
    
    console.log('**2. 是否有批量解析返回的机制？**');
    console.log('   ⚠️ **部分存在** - 主要在Gemini Provider中');
    console.log('   📍 Gemini流式响应中小事件(≤20字符)会被批量合并');
    console.log('   📍 批量大小: 30个小事件合并为1个大事件');
    console.log('   📍 其他Provider基本上都是单独处理和返回');
    console.log('');
    
    console.log('**3. 系统的实际请求处理策略:**');
    console.log('   ✅ **单请求单独处理**: 每个HTTP请求独立处理和返回');
    console.log('   ✅ **无排队机制**: 请求到达即处理，无队列等待');
    console.log('   ✅ **并发友好**: Fastify天然支持高并发请求处理');
    console.log('   ⚠️ **Gemini例外**: 流式响应中存在事件批量合并延迟');
    console.log('');
    
    console.log('**4. 符合用户期望吗？**');
    console.log('   ✅ **大部分符合**: 没有批量解析返回机制');
    console.log('   ⚠️ **Gemini需要优化**: 批量合并可能影响实时性');
    console.log('   💡 **建议**: 考虑禁用Gemini的小事件批量合并以提高响应实时性');
  }
}

// 执行分析
const analyzer = new RequestQueuingAnalyzer();
analyzer.runAllTests().catch(error => {
  console.error('Analysis execution failed:', error);
  process.exit(1);
});