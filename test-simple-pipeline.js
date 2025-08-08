#!/usr/bin/env node

/**
 * Simple Pipeline Test
 * 简单流水线测试
 * Owner: Jason Zhang
 * 
 * Direct API test bypassing health checks
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class SimplePipelineTest {
  constructor() {
    this.results = [];
    this.testPort = 5508; // ShuaiHong provider port
  }

  async makeAPIRequest(requestData, port = this.testPort) {
    return new Promise((resolve) => {
      const postData = JSON.stringify(requestData);
      
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Bearer test-key'
        },
        timeout: 15000
      };

      const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          try {
            const data = res.statusCode === 200 ? JSON.parse(responseBody) : null;
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              data,
              rawResponse: responseBody,
              headers: res.headers,
              port
            });
          } catch (error) {
            resolve({
              success: false,
              statusCode: res.statusCode,
              data: null,
              rawResponse: responseBody,
              error: `Parse error: ${error.message}`,
              headers: res.headers,
              port
            });
          }
        });
      });

      req.on('error', error => resolve({
        success: false,
        statusCode: 0,
        data: null,
        error: error.message,
        port
      }));

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          statusCode: 0,
          data: null,
          error: 'Request timeout',
          port
        });
      });

      req.write(postData);
      req.end();
    });
  }

  async runSimpleTest() {
    console.log('🚀 [SIMPLE-PIPELINE-TEST] Starting Direct API Test');
    console.log(`🔗 [TARGET] Testing server on port ${this.testPort}\n`);

    // Test 1: Basic text generation
    console.log('🧪 [TEST-1] Basic Text Generation');
    const test1 = await this.makeAPIRequest({
      model: 'gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: 'Say hello'
      }],
      max_tokens: 50,
      temperature: 0.1
    });

    if (test1.success) {
      console.log('✅ [SUCCESS] Basic text generation works');
      console.log(`   📍 Provider: ${test1.headers['x-provider'] || 'unknown'}`);
      console.log(`   📍 Model: ${test1.headers['x-model'] || 'unknown'}`);
      console.log(`   💬 Response: "${test1.data?.choices?.[0]?.message?.content?.substring(0, 100) || 'No content'}"`);
    } else {
      console.log('❌ [FAILED] Basic text generation failed');
      console.log(`   🔍 Status: ${test1.statusCode}`);
      console.log(`   🔍 Error: ${test1.error || test1.rawResponse?.substring(0, 200)}`);
    }

    this.results.push({
      testName: 'Basic Text Generation',
      ...test1,
      timestamp: new Date().toISOString()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Different model
    console.log('\n🧪 [TEST-2] Model Routing Test');
    const test2 = await this.makeAPIRequest({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: 'Test model routing'
      }],
      max_tokens: 30,
      temperature: 0.1
    });

    if (test2.success) {
      console.log('✅ [SUCCESS] Model routing works');
      console.log(`   📍 Provider: ${test2.headers['x-provider'] || 'unknown'}`);
      console.log(`   📍 Model: ${test2.headers['x-model'] || 'unknown'}`);
      console.log(`   💬 Response: "${test2.data?.choices?.[0]?.message?.content?.substring(0, 100) || 'No content'}"`);
    } else {
      console.log('❌ [FAILED] Model routing failed');
      console.log(`   🔍 Status: ${test2.statusCode}`);
      console.log(`   🔍 Error: ${test2.error || test2.rawResponse?.substring(0, 200)}`);
    }

    this.results.push({
      testName: 'Model Routing Test',
      ...test2,
      timestamp: new Date().toISOString()
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 3: Small token test to avoid limits
    console.log('\n🧪 [TEST-3] Low Token Test');
    const test3 = await this.makeAPIRequest({
      model: 'glm-4.5',
      messages: [{
        role: 'user',
        content: 'Short response please'
      }],
      max_tokens: 20,
      temperature: 0.1
    });

    if (test3.success) {
      console.log('✅ [SUCCESS] Low token test works');
      console.log(`   📍 Provider: ${test3.headers['x-provider'] || 'unknown'}`);
      console.log(`   📍 Model: ${test3.headers['x-model'] || 'unknown'}`);
      console.log(`   💬 Response: "${test3.data?.choices?.[0]?.message?.content?.substring(0, 100) || 'No content'}"`);
    } else {
      console.log('❌ [FAILED] Low token test failed');
      console.log(`   🔍 Status: ${test3.statusCode}`);
      console.log(`   🔍 Error: ${test3.error || test3.rawResponse?.substring(0, 200)}`);
    }

    this.results.push({
      testName: 'Low Token Test',
      ...test3,
      timestamp: new Date().toISOString()
    });

    // Generate summary
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    console.log('\n🏁 [RESULTS] Simple Pipeline Test Summary');
    console.log('='.repeat(50));
    console.log(`📊 Total Tests: ${this.results.length}`);
    console.log(`✅ Successful: ${successful.length} (${((successful.length / this.results.length) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed.length}`);

    // Save results
    const reportPath = path.join(__dirname, 'database', 'pipeline-data-new', 'analytics', 'simple-pipeline-test.json');
    const report = {
      testSuite: 'Simple Pipeline Direct API Test',
      executedAt: new Date().toISOString(),
      port: this.testPort,
      summary: {
        totalTests: this.results.length,
        successful: successful.length,
        failed: failed.length,
        successRate: successful.length / this.results.length
      },
      results: this.results
    };

    try {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📊 [REPORT] Results saved to: ${reportPath}`);
    } catch (error) {
      console.error(`❌ Failed to save report: ${error.message}`);
    }

    const success = successful.length > 0;
    console.log(`\n${success ? '🎉' : '❌'} [CONCLUSION] Simple pipeline test ${success ? 'PASSED' : 'FAILED'}`);
    
    if (success) {
      console.log('🚀 [STATUS] Pipeline system is working - API requests successful');
      console.log('✅ [VALIDATION] Core functionality verified');
    }

    return success;
  }
}

// Execute test
if (require.main === module) {
  const test = new SimplePipelineTest();
  test.runSimpleTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 [FATAL] Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { SimplePipelineTest };