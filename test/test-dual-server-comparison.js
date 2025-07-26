#!/usr/bin/env node

/**
 * Dual Server Comparison Test
 * 对比测试：同时向demo2和我们的路由器发送相同请求，对比结果差异
 */

const fs = require('fs');
const axios = require('axios');
const { spawn } = require('child_process');

// 服务器配置
const SERVERS = {
  demo2: {
    name: 'Demo2 (Go)',
    port: 8080,
    url: 'http://127.0.0.1:8080/v1/messages',
    executable: './examples/demo2/demo2',
    args: ['server', '8080'],
    cwd: '/Users/fanzhang/Documents/github/claude-code-router'
  },
  router: {
    name: 'Claude Code Router (Node.js)',
    port: 3456,
    url: 'http://127.0.0.1:3456/v1/messages',
    executable: 'node',
    args: ['dist/cli.js', 'start'],
    cwd: '/Users/fanzhang/Documents/github/claude-code-router'
  }
};

// 测试用例
const TEST_CASES = [
  {
    name: 'Single Message - No Tools',
    request: {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Hello, how are you?"
        }
      ]
    }
  },
  {
    name: 'Single Message - With Tools',
    request: {
      model: "claude-3-5-haiku-20241022",
      max_tokens: 100,
      messages: [
        {
          role: "user", 
          content: "Could you help me read the file /tmp/test-single.json?"
        }
      ],
      tools: [
        {
          name: "Read",
          description: "Reads a file from the local filesystem",
          input_schema: {
            type: "object",
            properties: {
              file_path: {
                description: "The absolute path to the file to read",
                type: "string"
              }
            },
            required: ["file_path"]
          }
        }
      ]
    }
  },
  {
    name: 'Multi-turn Conversation',
    request: {
      model: "claude-3-5-haiku-20241022", 
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Hello"
        },
        {
          role: "assistant", 
          content: "Hi there! How can I help you today?"
        },
        {
          role: "user",
          content: "What's the weather like?"
        }
      ]
    }
  }
];

class ServerManager {
  constructor() {
    this.processes = new Map();
  }

  async startServer(serverKey) {
    const config = SERVERS[serverKey];
    console.log(`🚀 Starting ${config.name}...`);

    return new Promise((resolve, reject) => {
      const process = spawn(config.executable, config.args, {
        cwd: config.cwd,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('listening') || output.includes('Started') || output.includes('server')) {
          setTimeout(() => resolve(process), 2000); // Wait 2s for server to be ready
        }
      });

      process.stderr.on('data', (data) => {
        console.log(`${config.name} stderr:`, data.toString());
      });

      process.on('error', (error) => {
        reject(error);
      });

      process.on('exit', (code) => {
        console.log(`${config.name} exited with code ${code}`);
      });

      this.processes.set(serverKey, process);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.processes.has(serverKey)) {
          resolve(process); // Assume it started even if no output
        }
      }, 10000);
    });
  }

  async stopServer(serverKey) {
    const process = this.processes.get(serverKey);
    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(serverKey);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  async stopAllServers() {
    for (const serverKey of this.processes.keys()) {
      await this.stopServer(serverKey);
    }
  }
}

class DualServerTester {
  constructor() {
    this.serverManager = new ServerManager();
    this.results = [];
  }

  async runTest(testCase) {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log('=' .repeat(60));

    const results = {
      testCase: testCase.name,
      request: testCase.request,
      timestamp: new Date().toISOString(),
      servers: {}
    };

    // Test both servers
    for (const [serverKey, config] of Object.entries(SERVERS)) {
      console.log(`\n📤 Testing ${config.name}...`);
      
      try {
        const startTime = Date.now();
        const response = await axios.post(config.url, testCase.request, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test'
          },
          timeout: 30000
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;

        results.servers[serverKey] = {
          name: config.name,
          success: true,
          duration: duration,
          status: response.status,
          response: response.data,
          headers: response.headers,
          analysis: this.analyzeResponse(response.data, testCase.request)
        };

        console.log(`  ✅ ${config.name}: ${response.status} (${duration}ms)`);
        console.log(`     Content blocks: ${response.data.content?.length || 0}`);
        console.log(`     Input tokens: ${response.data.usage?.input_tokens || 0}`);
        console.log(`     Output tokens: ${response.data.usage?.output_tokens || 0}`);

      } catch (error) {
        results.servers[serverKey] = {
          name: config.name,
          success: false,
          error: {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
          }
        };

        console.log(`  ❌ ${config.name}: ${error.message}`);
        if (error.response) {
          console.log(`     Status: ${error.response.status}`);
          console.log(`     Data:`, error.response.data);
        }
      }
    }

    // Compare results
    results.comparison = this.compareResults(results.servers);
    this.results.push(results);

    return results;
  }

  analyzeResponse(response, request) {
    return {
      hasContent: !!(response.content && response.content.length > 0),
      contentBlocks: response.content?.length || 0,
      contentTypes: response.content?.map(c => c.type) || [],
      textContent: response.content?.filter(c => c.type === 'text').map(c => c.text).join('') || '',
      toolCalls: response.content?.filter(c => c.type === 'tool_use') || [],
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      stopReason: response.stop_reason,
      model: response.model,
      hasTools: !!(request.tools && request.tools.length > 0),
      isMultiTurn: request.messages.length > 1
    };
  }

  compareResults(servers) {
    const serverKeys = Object.keys(servers);
    if (serverKeys.length < 2) return { status: 'insufficient_data' };

    const [server1Key, server2Key] = serverKeys;
    const server1 = servers[server1Key];
    const server2 = servers[server2Key];

    if (!server1.success || !server2.success) {
      return { 
        status: 'comparison_failed',
        reason: 'One or both servers failed'
      };
    }

    const analysis1 = server1.analysis;
    const analysis2 = server2.analysis;

    return {
      status: 'compared',
      differences: {
        contentMatch: analysis1.textContent === analysis2.textContent,
        contentBlocksMatch: analysis1.contentBlocks === analysis2.contentBlocks,
        tokenUsageMatch: {
          input: analysis1.inputTokens === analysis2.inputTokens,
          output: analysis1.outputTokens === analysis2.outputTokens
        },
        stopReasonMatch: analysis1.stopReason === analysis2.stopReason,
        toolCallsMatch: JSON.stringify(analysis1.toolCalls) === JSON.stringify(analysis2.toolCalls)
      },
      details: {
        [server1Key]: analysis1,
        [server2Key]: analysis2
      }
    };
  }

  async runAllTests() {
    console.log('🔧 Starting dual server comparison tests...\n');

    try {
      // Start servers
      console.log('🚀 Starting servers...');
      for (const serverKey of Object.keys(SERVERS)) {
        await this.serverManager.startServer(serverKey);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between starts
      }

      console.log('✅ All servers started, beginning tests...\n');

      // Run all test cases
      for (const testCase of TEST_CASES) {
        await this.runTest(testCase);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
      }

      // Generate report
      this.generateReport();

    } catch (error) {
      console.error('❌ Test execution failed:', error);
    } finally {
      // Cleanup
      console.log('\n🛑 Stopping servers...');
      await this.serverManager.stopAllServers();
    }
  }

  generateReport() {
    const reportFile = 'dual-server-comparison-report.json';
    const summaryFile = 'dual-server-comparison-summary.txt';

    // Save detailed report
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      testCases: this.results.length,
      results: this.results
    }, null, 2));

    // Generate summary
    let summary = 'DUAL SERVER COMPARISON SUMMARY\n';
    summary += '=' .repeat(50) + '\n\n';

    for (const result of this.results) {
      summary += `Test: ${result.testCase}\n`;
      summary += '-' .repeat(30) + '\n';

      for (const [serverKey, serverResult] of Object.entries(result.servers)) {
        if (serverResult.success) {
          summary += `${serverResult.name}:\n`;
          summary += `  Status: ✅ ${serverResult.status} (${serverResult.duration}ms)\n`;
          summary += `  Content: ${serverResult.analysis.contentBlocks} blocks, ${serverResult.analysis.textContent.length} chars\n`;
          summary += `  Tokens: ${serverResult.analysis.inputTokens} input, ${serverResult.analysis.outputTokens} output\n`;
          summary += `  Tools: ${serverResult.analysis.toolCalls.length} calls\n`;
        } else {
          summary += `${SERVERS[serverKey].name}:\n`;
          summary += `  Status: ❌ ${serverResult.error.message}\n`;
        }
      }

      if (result.comparison.status === 'compared') {
        summary += '\nComparison:\n';
        const diff = result.comparison.differences;
        summary += `  Content Match: ${diff.contentMatch ? '✅' : '❌'}\n`;
        summary += `  Content Blocks Match: ${diff.contentBlocksMatch ? '✅' : '❌'}\n`;
        summary += `  Token Usage Match: ${diff.tokenUsageMatch.input && diff.tokenUsageMatch.output ? '✅' : '❌'}\n`;
        summary += `  Tool Calls Match: ${diff.toolCallsMatch ? '✅' : '❌'}\n`;
      }

      summary += '\n';
    }

    fs.writeFileSync(summaryFile, summary);

    console.log(`\n📊 Reports generated:`);
    console.log(`   Detailed: ${reportFile}`);
    console.log(`   Summary: ${summaryFile}`);
  }
}

// Main execution
if (require.main === module) {
  const tester = new DualServerTester();
  
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, cleaning up...');
    await tester.serverManager.stopAllServers();
    process.exit(0);
  });

  tester.runAllTests().then(() => {
    console.log('\n✅ Dual server comparison completed!');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = { DualServerTester };