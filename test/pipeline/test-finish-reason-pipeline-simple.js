#!/usr/bin/env node

/**
 * Simple Finish Reason Pipeline Test
 * 简化版finish reason处理流水线测试
 */

const axios = require('axios');
const fs = require('fs');

const TEST_CONFIG = {
  port: 3456,
  timeout: 15000
};

class FinishReasonTest {
  constructor() {
    this.baseUrl = `http://localhost:${TEST_CONFIG.port}`;
    this.results = [];
  }

  async runTest() {
    console.log('Starting Finish Reason Pipeline Test...');
    console.log(`Testing on port ${TEST_CONFIG.port}\n`);

    try {
      // Test 1: Normal tool call request
      await this.testNormalToolCall();
      
      // Test 2: Text with tools pattern  
      await this.testTextToolPattern();
      
      // Summary
      this.printSummary();
      
    } catch (error) {
      console.error('Test failed:', error.message);
      process.exit(1);
    }
  }

  async testNormalToolCall() {
    console.log('🧪 Test 1: Normal tool call');
    
    const request = {
      model: 'claude-4-sonnet',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: 'What is the weather like in San Francisco? Use the weather tool.'
      }],
      tools: [{
        name: 'get_weather',
        description: 'Get weather information',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          }
        }
      }]
    };

    try {
      const response = await axios.post(`${this.baseUrl}/v1/messages`, request, {
        timeout: TEST_CONFIG.timeout,
        headers: { 'Content-Type': 'application/json' }
      });

      const data = response.data;
      console.log('✅ Response received');
      console.log(`Stop reason: ${data.stop_reason}`);
      
      // Check for tool use blocks
      const hasToolBlocks = data.content && data.content.some(block => block.type === 'tool_use');
      console.log(`Has tool blocks: ${hasToolBlocks}`);
      
      // Validate consistency
      if (hasToolBlocks && data.stop_reason === 'tool_use') {
        console.log('✅ Correct: Tool blocks with tool_use stop_reason');
      } else if (hasToolBlocks && data.stop_reason !== 'tool_use') {
        console.log(`❌ Error: Has tools but stop_reason is '${data.stop_reason}'`);
      } else {
        console.log('ℹ️  No tool blocks found');
      }

      this.results.push({
        test: 'normal_tool_call',
        success: response.status === 200,
        hasToolBlocks,
        stopReason: data.stop_reason,
        consistent: hasToolBlocks ? data.stop_reason === 'tool_use' : true
      });

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      this.results.push({
        test: 'normal_tool_call',
        success: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  async testTextToolPattern() {
    console.log('🧪 Test 2: Text with tool pattern');
    
    const request = {
      model: 'claude-4-sonnet', 
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: 'Please edit a file for me. Use a tool call format like: Tool call: Edit({"file": "test.js", "content": "hello"})'
      }]
    };

    try {
      const response = await axios.post(`${this.baseUrl}/v1/messages`, request, {
        timeout: TEST_CONFIG.timeout,
        headers: { 'Content-Type': 'application/json' }
      });

      const data = response.data;
      console.log('✅ Response received');
      console.log(`Stop reason: ${data.stop_reason}`);
      
      // Check content
      const textBlocks = data.content ? data.content.filter(block => block.type === 'text') : [];
      const toolBlocks = data.content ? data.content.filter(block => block.type === 'tool_use') : [];
      
      console.log(`Text blocks: ${textBlocks.length}, Tool blocks: ${toolBlocks.length}`);
      
      // Check for unprocessed tool patterns in text
      let hasUnprocessedTools = false;
      textBlocks.forEach(block => {
        if (block.text && /Tool\s+call:\s*\w+\s*\(/i.test(block.text)) {
          hasUnprocessedTools = true;
          console.log(`❌ Found unprocessed tool pattern: ${block.text.substring(0, 100)}...`);
        }
      });
      
      if (!hasUnprocessedTools && toolBlocks.length > 0) {
        console.log('✅ Text tools properly converted to tool_use blocks');
      }

      this.results.push({
        test: 'text_tool_pattern',
        success: response.status === 200,
        textBlocks: textBlocks.length,
        toolBlocks: toolBlocks.length,
        hasUnprocessedTools,
        stopReason: data.stop_reason
      });

    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      this.results.push({
        test: 'text_tool_pattern',
        success: false,
        error: error.message
      });
    }
    
    console.log('');
  }

  printSummary() {
    console.log('='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    
    console.log(`Total tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Pass rate: ${(passed/total*100).toFixed(1)}%`);
    
    console.log('\n📋 DETAILED RESULTS:');
    this.results.forEach(result => {
      console.log(`\n• ${result.test}:`);
      console.log(`  Success: ${result.success}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      if (result.stopReason) {
        console.log(`  Stop reason: ${result.stopReason}`);
      }
      if (result.hasToolBlocks !== undefined) {
        console.log(`  Has tool blocks: ${result.hasToolBlocks}`);
      }
      if (result.consistent !== undefined) {
        console.log(`  Logic consistent: ${result.consistent}`);
      }
    });
    
    console.log('\n' + '='.repeat(50));
  }
}

// Main execution
async function main() {
  const tester = new FinishReasonTest();
  await tester.runTest();
  console.log('Test completed!');
}

if (require.main === module) {
  main();
}

module.exports = FinishReasonTest;