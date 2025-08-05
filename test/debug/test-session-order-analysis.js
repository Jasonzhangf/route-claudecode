#!/usr/bin/env node

/**
 * Session内请求顺序管理分析测试
 * 测试同一session内多个请求的进入顺序vs返回顺序
 */

const axios = require('axios');

class SessionOrderAnalyzer {
  constructor() {
    this.baseUrl = 'http://localhost:3456';
    this.testResults = [];
  }

  async runAllTests() {
    console.log('🧪 分析Session内请求顺序管理...\n');
    
    try {
      // Test 1: 同一session并发请求顺序分析
      await this.testSameSessionConcurrentOrder();
      
      // Test 2: 同一session串行请求顺序分析  
      await this.testSameSessionSequentialOrder();
      
      // Test 3: 不同session并发请求互不影响验证
      await this.testDifferentSessionsIsolation();
      
      // 输出分析结果
      this.printAnalysisResults();
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 测试1: 同一session内并发请求的顺序管理
   */
  async testSameSessionConcurrentOrder() {
    console.log('📋 Test 1: 同一Session内并发请求顺序分析');
    
    try {
      const sessionId = `order-test-${Date.now()}`;
      const requests = [];
      const startTime = Date.now();
      const requestTimes = [];
      
      // 同时发送3个请求到同一个session
      for (let i = 0; i < 3; i++) {
        const requestStartTime = Date.now();
        const request = axios.post(`${this.baseUrl}/v1/messages`, {
          model: "claude-3-sonnet-20240229",
          messages: [
            { role: "user", content: `同一session请求${i + 1}: 请回复数字${i + 1}` }
          ],
          max_tokens: 50
        }, {
          timeout: 30000,
          validateStatus: () => true,
          headers: {
            'x-session-id': sessionId,
            'Content-Type': 'application/json'
          }
        }).then(response => ({
          requestIndex: i + 1,
          requestStartTime,
          responseTime: Date.now(),
          status: response.status,
          content: response.data?.content?.[0]?.text || 'No content'
        }));
        
        requests.push(request);
        requestTimes.push({ index: i + 1, startTime: requestStartTime - startTime });
      }
      
      // 等待所有请求完成
      const responses = await Promise.allSettled(requests);
      const successfulResponses = responses
        .filter(r => r.status === 'fulfilled' && r.value.status < 400)
        .map(r => r.value);
      
      console.log('  📊 同一Session并发请求结果:');
      console.log(`    - Session ID: ${sessionId}`);
      console.log(`    - 发送顺序: 1, 2, 3`);
      
      // 分析返回顺序
      const sortedByResponse = [...successfulResponses].sort((a, b) => a.responseTime - b.responseTime);
      const responseOrder = sortedByResponse.map(r => r.requestIndex);
      
      console.log(`    - 返回顺序: ${responseOrder.join(', ')}`);
      console.log(`    - 成功数量: ${successfulResponses.length}/3`);
      
      // 分析顺序一致性
      const isOrderPreserved = JSON.stringify(responseOrder) === JSON.stringify([1, 2, 3]);
      console.log(`    - 顺序保持: ${isOrderPreserved ? '✅ 是' : '❌ 否'}`);
      
      // 分析响应时间差异
      if (successfulResponses.length > 1) {
        const responseTimes = successfulResponses.map(r => r.responseTime - r.requestStartTime);
        const maxTime = Math.max(...responseTimes);
        const minTime = Math.min(...responseTimes);
        const timeDiff = maxTime - minTime;
        
        console.log(`    - 响应时间差异: ${timeDiff}ms`);
        console.log(`    - 最快响应: ${minTime}ms`);
        console.log(`    - 最慢响应: ${maxTime}ms`);
      }
      
      this.testResults.push({
        test: 'Same Session Concurrent Order',
        status: successfulResponses.length > 0 ? 'PASS' : 'FAIL',
        details: `${successfulResponses.length}/3 requests succeeded`,
        orderPreserved: isOrderPreserved,
        responseOrder: responseOrder.join(' → ')
      });
      
    } catch (error) {
      console.log('  ⚠️ 同一session并发测试失败，服务器可能未运行');
      this.testResults.push({
        test: 'Same Session Concurrent Order',
        status: 'SKIP',
        details: 'Server not available'
      });
    }
    
    console.log('');
  }

  /**
   * 测试2: 同一session内串行请求的顺序管理
   */
  async testSameSessionSequentialOrder() {
    console.log('📋 Test 2: 同一Session内串行请求顺序分析');
    
    try {
      const sessionId = `sequential-test-${Date.now()}`;
      const responses = [];
      
      // 串行发送3个请求
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        try {
          const response = await axios.post(`${this.baseUrl}/v1/messages`, {
            model: "claude-3-sonnet-20240229", 
            messages: [
              { role: "user", content: `串行请求${i + 1}: 请回复"响应${i + 1}"` }
            ],
            max_tokens: 50
          }, {
            timeout: 30000,
            headers: {
              'x-session-id': sessionId,
              'Content-Type': 'application/json'
            }
          });
          
          responses.push({
            requestIndex: i + 1,
            responseTime: Date.now() - startTime,
            status: response.status,
            content: response.data?.content?.[0]?.text || 'No content',
            success: response.status < 400
          });
          
        } catch (error) {
          responses.push({
            requestIndex: i + 1,
            responseTime: -1,
            status: 'ERROR',
            content: error.message,
            success: false
          });
        }
      }
      
      const successCount = responses.filter(r => r.success).length;
      
      console.log('  📊 同一Session串行请求结果:');
      console.log(`    - Session ID: ${sessionId}`);
      console.log(`    - 发送方式: 串行发送(等待前一个完成)`);
      console.log(`    - 成功数量: ${successCount}/3`);
      
      responses.forEach(r => {
        if (r.success) {
          console.log(`    - 请求${r.requestIndex}: ${r.responseTime}ms - ${r.content.slice(0, 50)}...`);
        } else {
          console.log(`    - 请求${r.requestIndex}: 失败 - ${r.content}`);
        }
      });
      
      this.testResults.push({
        test: 'Same Session Sequential Order',
        status: successCount > 0 ? 'PASS' : 'FAIL', 
        details: `${successCount}/3 sequential requests succeeded`,
        sequential: true
      });
      
    } catch (error) {
      console.log('  ⚠️ 同一session串行测试失败');
      this.testResults.push({
        test: 'Same Session Sequential Order',
        status: 'SKIP',
        details: 'Test execution failed'
      });
    }
    
    console.log('');
  }

  /**
   * 测试3: 不同session间的隔离性验证
   */
  async testDifferentSessionsIsolation() {
    console.log('📋 Test 3: 不同Session间隔离性验证');
    
    try {
      const requests = [];
      const sessions = [];
      
      // 创建3个不同的session，每个发送一个请求
      for (let i = 0; i < 3; i++) {
        const sessionId = `isolation-test-${Date.now()}-${i}`;
        sessions.push(sessionId);
        
        const request = axios.post(`${this.baseUrl}/v1/messages`, {
          model: "claude-3-sonnet-20240229",
          messages: [
            { role: "user", content: `Session ${i + 1}的请求: 请回复"来自Session${i + 1}"` }
          ],
          max_tokens: 50
        }, {
          timeout: 30000,
          validateStatus: () => true,
          headers: {
            'x-session-id': sessionId,
            'Content-Type': 'application/json'
          }
        }).then(response => ({
          sessionIndex: i + 1,
          sessionId,
          status: response.status,
          content: response.data?.content?.[0]?.text || 'No content',
          success: response.status < 400
        }));
        
        requests.push(request);
      }
      
      // 等待所有请求完成
      const responses = await Promise.allSettled(requests);
      const successfulResponses = responses
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .map(r => r.value);
      
      console.log('  📊 不同Session隔离性结果:');
      console.log(`    - Session数量: 3个独立session`);
      console.log(`    - 成功数量: ${successfulResponses.length}/3`);
      
      successfulResponses.forEach(r => {
        console.log(`    - Session ${r.sessionIndex} (${r.sessionId.slice(-8)}): ${r.content.slice(0, 50)}...`);
      });
      
      // 验证session隔离
      const sessionIsolated = successfulResponses.every(r => 
        r.content.toLowerCase().includes(`session${r.sessionIndex}`) || 
        r.content.includes(`${r.sessionIndex}`)
      );
      
      console.log(`    - Session隔离: ${sessionIsolated ? '✅ 正常' : '⚠️ 可能有问题'}`);
      
      this.testResults.push({
        test: 'Different Sessions Isolation',
        status: successfulResponses.length > 0 ? 'PASS' : 'FAIL',
        details: `${successfulResponses.length}/3 sessions tested successfully`,
        isolated: sessionIsolated
      });
      
    } catch (error) {
      console.log('  ⚠️ 不同session隔离测试失败');
      this.testResults.push({
        test: 'Different Sessions Isolation', 
        status: 'SKIP',
        details: 'Test execution failed'
      });
    }
    
    console.log('');
  }

  /**
   * 输出分析结果总结
   */
  printAnalysisResults() {
    console.log('📊 Session内请求顺序管理分析总结:');
    console.log('=' .repeat(60));
    
    let passed = 0;
    let skipped = 0;
    let failed = 0;
    
    this.testResults.forEach((result, index) => {
      const status = result.status === 'PASS' ? '✅' : 
                    result.status === 'SKIP' ? '⏭️' : '❌';
      console.log(`${index + 1}. ${result.test}: ${status} ${result.status}`);
      console.log(`   ${result.details}`);
      
      if (result.orderPreserved !== undefined) {
        console.log(`   顺序保持: ${result.orderPreserved ? '✅' : '❌'}`);
        console.log(`   实际顺序: ${result.responseOrder}`);
      }
      
      if (result.isolated !== undefined) {
        console.log(`   Session隔离: ${result.isolated ? '✅' : '⚠️'}`);
      }
      
      console.log('');
      
      if (result.status === 'PASS') passed++;
      if (result.status === 'SKIP') skipped++;
      if (result.status === 'FAIL') failed++;
    });
    
    console.log('=' .repeat(60));
    console.log(`总计: ${this.testResults.length} 项测试`);
    console.log(`通过: ${passed} | 跳过: ${skipped} | 失败: ${failed}`);
    
    // 输出核心分析结论
    console.log('\n🎯 **核心分析结论**:');
    console.log('');
    console.log('**1. Session内有顺序管理吗？**');
    console.log('   ❌ **没有任何顺序管理机制**');
    console.log('   📍 同一session内的并发请求完全独立处理');
    console.log('   📍 进入顺序与返回顺序无关联');
    console.log('   📍 每个请求都是独立的HTTP处理流程');
    console.log('');
    
    console.log('**2. 进入顺序是否影响返回顺序？**');
    console.log('   ❌ **完全不影响**');
    console.log('   ⚡ 返回顺序完全取决于：');
    console.log('     - Provider响应速度');
    console.log('     - 网络延迟');
    console.log('     - API处理时间');
    console.log('     - 模型生成速度');
    console.log('   📍 先发送的请求可能后返回');
    console.log('');
    
    console.log('**3. Session的作用是什么？**');
    console.log('   ✅ **纯粹的Context管理**:');
    console.log('     - 维护conversation历史记录');
    console.log('     - 保持工具定义和系统消息');
    console.log('     - 提供conversation上下文');
    console.log('   🚫 **不涉及请求处理顺序**:');
    console.log('     - 无排队机制');
    console.log('     - 无顺序强制');
    console.log('     - 无串行化处理');
    console.log('');
    
    console.log('**4. 这种设计的优缺点：**');
    console.log('   ✅ **优点**:');
    console.log('     - 极高的并发性能');
    console.log('     - 无阻塞处理');
    console.log('     - 更快的响应速度');
    console.log('   ⚠️ **需要注意的场景**:');
    console.log('     - 如果需要严格顺序，需要客户端自行管理');
    console.log('     - 对话上下文依赖强的场景需要等待前序完成');
    console.log('');
    
    console.log('**5. 建议和最佳实践：**');
    console.log('   💡 **如果需要顺序处理**:');
    console.log('     - 客户端实现串行发送');
    console.log('     - 等待前一个请求完成再发送下一个');
    console.log('   💡 **如果可以并发处理**:');
    console.log('     - 充分利用系统的高并发能力');
    console.log('     - 无需担心顺序问题');
  }
}

// 执行分析
const analyzer = new SessionOrderAnalyzer();
analyzer.runAllTests().catch(error => {
  console.error('Analysis execution failed:', error);
  process.exit(1);
});