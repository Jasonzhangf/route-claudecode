#!/usr/bin/env node

/**
 * Live CodeWhisperer Integration Test
 * 
 * This script tests the complete CodeWhisperer pipeline with real API calls
 * Run with: node test/test-codewhisperer-live.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const TEST_CONFIG = {
  serverPort: 3457,
  configFile: 'config.test-codewhisperer.json',
  testTimeout: 60000,
  serverStartupTime: 5000
};

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function logStep(step, message) {
  log(`\n${COLORS.blue}[${step}]${COLORS.reset} ${message}`);
}

function logSuccess(message) {
  log(`${COLORS.green}✅ ${message}${COLORS.reset}`);
}

function logError(message) {
  log(`${COLORS.red}❌ ${message}${COLORS.reset}`);
}

function logWarning(message) {
  log(`${COLORS.yellow}⚠️  ${message}${COLORS.reset}`);
}

class CodeWhispererTester {
  constructor() {
    this.serverProcess = null;
    this.baseURL = `http://127.0.0.1:${TEST_CONFIG.serverPort}`;
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runAllTests() {
    try {
      log(`${COLORS.cyan}🧪 CodeWhisperer Live Integration Test${COLORS.reset}`);
      log(`${COLORS.cyan}======================================${COLORS.reset}`);

      await this.checkPrerequisites();
      await this.startTestServer();
      await this.runHealthChecks();
      await this.runBasicTests();
      await this.runAdvancedTests();
      await this.runStreamingTests();
      
      this.printResults();
      
    } catch (error) {
      logError(`Test suite failed: ${error.message}`);
      this.results.failed++;
      this.results.errors.push(error.message);
    } finally {
      await this.cleanup();
    }

    process.exit(this.results.failed > 0 ? 1 : 0);
  }

  async checkPrerequisites() {
    logStep('PREREQ', 'Checking prerequisites');

    // Check config file
    const configPath = path.join(process.cwd(), TEST_CONFIG.configFile);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Test config file not found: ${configPath}`);
    }
    logSuccess('Test configuration file found');

    // Check if token file exists
    const tokenPath = path.expanduser?.('~/.aws/sso/cache/kiro-auth-token.json') || 
                      path.join(process.env.HOME, '.aws/sso/cache/kiro-auth-token.json');
    
    if (!fs.existsSync(tokenPath)) {
      logWarning('Kiro token file not found - CodeWhisperer auth may fail');
      logWarning('Run "kiro refresh" if you have the kiro2cc tool installed');
    } else {
      // Check if token is expired
      try {
        const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        const expiryTime = new Date(tokenData.expiresAt);
        const now = new Date();
        
        if (expiryTime <= now) {
          logWarning('Kiro token appears to be expired');
          logWarning('Run "kiro refresh" to refresh the token');
        } else {
          logSuccess('Valid Kiro token found');
        }
      } catch (error) {
        logWarning('Could not parse token file');
      }
    }

    // Check port availability
    try {
      await axios.get(`${this.baseURL}/health`, { timeout: 1000 });
      throw new Error(`Test port ${TEST_CONFIG.serverPort} is already in use`);
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logSuccess('Test port is available');
      } else {
        throw error;
      }
    }
  }

  async startTestServer() {
    logStep('SERVER', 'Starting test server');

    // Build project first
    logSuccess('Building project...');
    const buildProcess = spawn('npm', ['run', 'build'], { 
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    await new Promise((resolve, reject) => {
      buildProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Build failed'));
        }
      });
    });

    logSuccess('Build completed');

    // Start server
    this.serverProcess = spawn('node', [
      'dist/cli.js', 
      'start',
      '--config', TEST_CONFIG.configFile,
      '--port', TEST_CONFIG.serverPort.toString(),
      '--debug'
    ], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    // Wait for server to start
    log('Waiting for server startup...');
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.serverStartupTime));

    // Verify server is running
    try {
      const response = await axios.get(`${this.baseURL}/status`, { timeout: 5000 });
      logSuccess(`Server started successfully (PID: ${this.serverProcess.pid})`);
      logSuccess(`Server version: ${response.data.version}`);
    } catch (error) {
      throw new Error(`Server failed to start: ${error.message}`);
    }
  }

  async runHealthChecks() {
    logStep('HEALTH', 'Running health checks');

    try {
      // Status check
      const statusResponse = await axios.get(`${this.baseURL}/status`);
      if (statusResponse.data.server === 'claude-code-router') {
        logSuccess('Status endpoint working');
        this.results.passed++;
      } else {
        throw new Error('Invalid status response');
      }

      // Health check
      const healthResponse = await axios.get(`${this.baseURL}/health`);
      if (healthResponse.data.overall) {
        logSuccess(`Health check: ${healthResponse.data.overall}`);
        logSuccess(`Providers: ${Object.keys(healthResponse.data.providers).join(', ')}`);
        this.results.passed++;
      } else {
        throw new Error('Health check failed');
      }

    } catch (error) {
      logError(`Health checks failed: ${error.message}`);
      this.results.failed++;
      this.results.errors.push(`Health: ${error.message}`);
    }
  }

  async runBasicTests() {
    logStep('BASIC', 'Running basic request tests');

    const testCases = [
      {
        name: 'Simple greeting',
        request: {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          messages: [
            { role: 'user', content: 'Hello! Please respond with a brief greeting.' }
          ]
        }
      },
      {
        name: 'Code generation',
        request: {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [
            { role: 'user', content: 'Write a simple Python function to calculate the factorial of a number.' }
          ]
        }
      },
      {
        name: 'System message',
        request: {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 100,
          system: 'You are a helpful assistant that responds in exactly 10 words.',
          messages: [
            { role: 'user', content: 'What is artificial intelligence?' }
          ]
        }
      }
    ];

    for (const testCase of testCases) {
      try {
        log(`\n  Testing: ${testCase.name}`);
        
        const startTime = Date.now();
        const response = await axios.post(`${this.baseURL}/v1/messages`, testCase.request, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          timeout: 30000
        });
        const duration = Date.now() - startTime;

        if (response.status === 200 && response.data.role === 'assistant') {
          logSuccess(`${testCase.name} - Response received (${duration}ms)`);
          log(`    Content: ${response.data.content[0].text.substring(0, 100)}...`);
          log(`    Tokens: ${response.data.usage?.input_tokens}/${response.data.usage?.output_tokens}`);
          this.results.passed++;
        } else {
          throw new Error(`Unexpected response format`);
        }

      } catch (error) {
        logError(`${testCase.name} failed: ${error.message}`);
        this.results.failed++;
        this.results.errors.push(`${testCase.name}: ${error.message}`);
      }
    }
  }

  async runAdvancedTests() {
    logStep('ADVANCED', 'Running advanced feature tests');

    // Tool use test
    try {
      log('\n  Testing: Tool use');
      
      const toolRequest = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          { role: 'user', content: 'What is the current time? Use the get_time tool.' }
        ],
        tools: [
          {
            name: 'get_time',
            description: 'Get the current time',
            input_schema: {
              type: 'object',
              properties: {
                timezone: { type: 'string', description: 'Timezone (optional)' }
              }
            }
          }
        ]
      };

      const response = await axios.post(`${this.baseURL}/v1/messages`, toolRequest, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      });

      if (response.status === 200) {
        logSuccess('Tool use request processed');
        
        // Check if tool was actually used (depends on model behavior)
        const hasToolUse = response.data.content.some(item => item.type === 'tool_use');
        if (hasToolUse) {
          logSuccess('Tool use detected in response');
        } else {
          logWarning('No tool use in response (model choice)');
        }
        this.results.passed++;
      }

    } catch (error) {
      logError(`Tool use test failed: ${error.message}`);
      this.results.failed++;
      this.results.errors.push(`Tool use: ${error.message}`);
    }

    // Multi-turn conversation test
    try {
      log('\n  Testing: Multi-turn conversation');
      
      const conversation = [
        { role: 'user', content: 'Please remember that my name is Alice.' },
        { role: 'assistant', content: 'Hello Alice! I will remember your name.' },
        { role: 'user', content: 'What is my name?' }
      ];

      const response = await axios.post(`${this.baseURL}/v1/messages`, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        messages: conversation
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        timeout: 30000
      });

      if (response.status === 200 && response.data.content[0].text.toLowerCase().includes('alice')) {
        logSuccess('Multi-turn conversation working');
        this.results.passed++;
      } else {
        logWarning('Multi-turn conversation may not be working correctly');
        this.results.failed++;
      }

    } catch (error) {
      logError(`Multi-turn conversation failed: ${error.message}`);
      this.results.failed++;
      this.results.errors.push(`Multi-turn: ${error.message}`);
    }
  }

  async runStreamingTests() {
    logStep('STREAMING', 'Testing streaming responses');

    try {
      log('\n  Testing: Streaming response');

      const streamRequest = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        stream: true,
        messages: [
          { role: 'user', content: 'Count from 1 to 5, with each number on a new line.' }
        ]
      };

      const response = await axios.post(`${this.baseURL}/v1/messages`, streamRequest, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        responseType: 'stream',
        timeout: 30000
      });

      if (response.status === 200 && response.headers['content-type'] === 'text/event-stream') {
        logSuccess('Streaming response initiated');
        
        // Simple check - we can't easily parse SSE in this script
        // But we can verify the response format is correct
        this.results.passed++;
      } else {
        throw new Error('Invalid streaming response format');
      }

    } catch (error) {
      logError(`Streaming test failed: ${error.message}`);
      this.results.failed++;
      this.results.errors.push(`Streaming: ${error.message}`);
    }
  }

  printResults() {
    logStep('RESULTS', 'Test Summary');
    
    log(`\n${COLORS.bright}Test Results:${COLORS.reset}`);
    log(`${COLORS.green}✅ Passed: ${this.results.passed}${COLORS.reset}`);
    log(`${COLORS.red}❌ Failed: ${this.results.failed}${COLORS.reset}`);
    
    if (this.results.errors.length > 0) {
      log(`\n${COLORS.red}Errors:${COLORS.reset}`);
      this.results.errors.forEach((error, index) => {
        log(`${COLORS.red}  ${index + 1}. ${error}${COLORS.reset}`);
      });
    }

    if (this.results.failed === 0) {
      log(`\n${COLORS.green}🎉 All tests passed! CodeWhisperer integration is working correctly.${COLORS.reset}`);
    } else {
      log(`\n${COLORS.red}💥 ${this.results.failed} test(s) failed. Check the errors above.${COLORS.reset}`);
    }
  }

  async cleanup() {
    logStep('CLEANUP', 'Cleaning up');

    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise(resolve => {
        this.serverProcess.on('close', resolve);
        setTimeout(() => {
          this.serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
      
      logSuccess('Test server stopped');
    }
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  log('\n\nReceived SIGINT, cleaning up...');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// Run tests
if (require.main === module) {
  const tester = new CodeWhispererTester();
  tester.runAllTests();
}