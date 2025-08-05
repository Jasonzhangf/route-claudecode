#!/usr/bin/env node

/**
 * End-to-end test for 6689 port patch system effectiveness
 * Tests the complete flow: request -> routing -> patch -> response
 */

const http = require('http');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  port: 6689,
  timeout: 30000,
  testData: {
    model: 'ZhipuAI/GLM-4.5',
    messages: [
      {
        role: 'user',
        content: 'Please edit the file /tmp/test.md to add a new section about testing'
      }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'Edit',
          description: 'Edit a file by replacing old content with new content',
          parameters: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'The path to the file to edit'
              },
              old_string: {
                type: 'string', 
                description: 'The exact string to replace'
              },
              new_string: {
                type: 'string',
                description: 'The new string to replace with'
              }
            },
            required: ['file_path', 'old_string', 'new_string']
          }
        }
      }
    ]
  }
};

class EndToEndTester {
  constructor() {
    this.results = {
      serverCheck: false,
      requestSent: false,
      responseReceived: false,
      toolCallsDetected: false,
      patchSystemWorking: false,
      finishReasonRecorded: false,
      errors: []
    };
  }

  async runTest() {
    console.log('🧪 Running end-to-end test for 6689 port patch system');
    console.log('==================================================');
    
    try {
      // Step 1: Check server availability
      await this.checkServerAvailability();
      
      // Step 2: Send test request
      await this.sendTestRequest();
      
      // Step 3: Verify logs
      await this.verifyLogs();
      
      // Step 4: Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      this.results.errors.push(error.message);
      this.generateReport();
    }
  }

  async checkServerAvailability() {
    console.log('🔍 Step 1: Checking server availability...');
    
    return new Promise((resolve, reject) => {
      const healthCheck = http.request({
        hostname: 'localhost',
        port: TEST_CONFIG.port,
        path: '/health',
        method: 'GET',
        timeout: 5000
      }, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Server is running on port', TEST_CONFIG.port);
          this.results.serverCheck = true;
          resolve();
        } else {
          reject(new Error(`Server health check failed: ${res.statusCode}`));
        }
      });
      
      healthCheck.on('error', (error) => {
        reject(new Error(`Server not available: ${error.message}`));
      });
      
      healthCheck.on('timeout', () => {
        reject(new Error('Server health check timeout'));
      });
      
      healthCheck.end();
    });
  }

  async sendTestRequest() {
    console.log('📤 Step 2: Sending test request...');
    
    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify(TEST_CONFIG.testData);
      
      const options = {
        hostname: 'localhost',
        port: TEST_CONFIG.port,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData),
          'Authorization': 'Bearer test-key'
        },
        timeout: TEST_CONFIG.timeout
      };

      const req = http.request(options, (res) => {
        console.log('📡 Response status:', res.statusCode);
        console.log('📡 Response headers:', res.headers);
        
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
          // console.log('📨 Received chunk:', chunk.toString().substring(0, 200) + '...');
        });
        
        res.on('end', () => {
          console.log('✅ Response received');
          this.results.requestSent = true;
          this.results.responseReceived = true;
          
          try {
            // Try to parse response
            if (responseData) {
              console.log('📊 Response preview:', responseData.substring(0, 300) + '...');
              
              // Check for tool calls in response
              if (responseData.includes('tool_use') || responseData.includes('tool_calls')) {
                this.results.toolCallsDetected = true;
                console.log('🔧 Tool calls detected in response');
              }
              
              // Check if "Tool call: Edit(" format appears (should not if patch works)
              if (responseData.includes('Tool call: Edit(')) {
                console.log('⚠️  Found unprocessed tool call text - patch may not be working');
                this.results.patchSystemWorking = false;
              } else {
                console.log('✅ No unprocessed tool call text found - patch system working');
                this.results.patchSystemWorking = true;
              }
            }
            
            resolve(responseData);
          } catch (parseError) {
            console.log('⚠️  Response parsing issues:', parseError.message);
            resolve(responseData);
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        reject(new Error('Request timeout'));
      });

      console.log('📤 Sending request to:', `http://localhost:${TEST_CONFIG.port}/v1/chat/completions`);
      req.write(requestData);
      req.end();
      
      this.results.requestSent = true;
    });
  }

  async verifyLogs() {
    console.log('📋 Step 3: Verifying logs...');
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
      // Check for finish reason logs
      const logDir = `${process.env.HOME}/.route-claude-code/logs/port-${TEST_CONFIG.port}`;
      console.log('📁 Checking log directory:', logDir);
      
      const ls = spawn('ls', ['-la', logDir], { shell: true });
      
      ls.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('📂 Log directory contents:');
        console.log(output);
        
        if (output.includes('finish_reason.log')) {
          this.results.finishReasonRecorded = true;
          console.log('✅ Finish reason log file found');
        }
      });
      
      ls.on('close', (code) => {
        // Also check for recent log entries
        const grep = spawn('find', [
          logDir,
          '-name', '*.log',
          '-mmin', '-5',
          '-exec', 'tail', '-10', '{}', ';'
        ], { shell: true });
        
        grep.stdout.on('data', (data) => {
          const logData = data.toString();
          console.log('📊 Recent log entries:');
          console.log(logData.substring(0, 500) + '...');
          
          // Check for patch application logs
          if (logData.includes('anthropic-tool-call-text-fix') || 
              logData.includes('Patch applied') ||
              logData.includes('Tool call fix')) {
            console.log('🔧 Patch system activity detected in logs');
            this.results.patchSystemWorking = true;
          }
        });
        
        grep.on('close', () => {
          resolve();
        });
      });
    });
  }

  generateReport() {
    console.log('\n📊 Test Results Report');
    console.log('======================');
    
    const checks = [
      { name: 'Server Availability', result: this.results.serverCheck },
      { name: 'Request Sent', result: this.results.requestSent },
      { name: 'Response Received', result: this.results.responseReceived },
      { name: 'Tool Calls Detected', result: this.results.toolCallsDetected },
      { name: 'Patch System Working', result: this.results.patchSystemWorking },
      { name: 'Finish Reason Recorded', result: this.results.finishReasonRecorded }
    ];
    
    let passCount = 0;
    checks.forEach(check => {
      const status = check.result ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${check.name}`);
      if (check.result) passCount++;
    });
    
    console.log(`\n📈 Overall Score: ${passCount}/${checks.length} (${Math.round(passCount/checks.length*100)}%)`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (!this.results.serverCheck) {
      console.log('- Start the server on port 6689 using: rcc start config-multi-openai-full.json');
    }
    if (!this.results.patchSystemWorking) {
      console.log('- Check patch system configuration and logs');
      console.log('- Verify AnthropicToolCallTextFixPatch is properly loaded');
    }
    if (!this.results.finishReasonRecorded) {
      console.log('- Check unified logger configuration');
      console.log('- Verify finish reason logging is enabled');
    }
    
    console.log('\n🏁 Test completed');
  }
}

// Run the test
const tester = new EndToEndTester();
tester.runTest().catch(console.error);