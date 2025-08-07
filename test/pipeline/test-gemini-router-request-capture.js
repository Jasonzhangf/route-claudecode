#!/usr/bin/env node

/**
 * Gemini Router Request Capture Test
 * 
 * This test captures the actual request being sent by our router to the Gemini API
 * and compares it with what we expect, helping identify the exact root cause
 * of MALFORMED_FUNCTION_CALL and UNEXPECTED_TOOL_CALL errors.
 * 
 * Author: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ROUTER_URL = 'http://localhost:5502';
const TIMEOUT = 30000;

const TEST_CASES = [
  {
    name: 'simple-weather-tool',
    description: 'Simple weather tool call that should work',
    payload: {
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'What is the weather in Tokyo?'
        }
      ],
      tools: [
        {
          name: 'get_weather',
          description: '获取指定城市的天气信息',
          input_schema: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: '城市名称'
              }
            },
            required: ['city']
          }
        }
      ],
      max_tokens: 100
    }
  },
  {
    name: 'complex-multi-tool',
    description: 'Multiple tools with complex schemas',
    payload: {
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: 'List files in the current directory and get weather for Tokyo'
        }
      ],
      tools: [
        {
          name: 'LS',
          description: 'List files and directories',
          input_schema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path'
              },
              ignore: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Patterns to ignore'
              }
            },
            required: ['path']
          }
        },
        {
          name: 'get_weather',
          description: 'Get weather information',
          input_schema: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'City name' }
            },
            required: ['city']
          }
        }
      ],
      max_tokens: 200
    }
  }
];

/**
 * Intercept and capture actual requests to Gemini API
 */
class RequestInterceptor {
  constructor() {
    this.capturedRequests = [];
    this.capturedResponses = [];
  }

  /**
   * Monkey patch axios to capture requests
   */
  setupInterception() {
    const originalPost = axios.post;
    const self = this;

    axios.post = async function(url, data, config) {
      // Check if this is a Gemini API request
      if (url.includes('generativelanguage.googleapis.com')) {
        console.log('🔍 Intercepted Gemini API request');
        
        // Capture the request
        self.capturedRequests.push({
          timestamp: new Date().toISOString(),
          url: url,
          data: data,
          headers: config?.headers
        });

        console.log('📤 Request URL:', url);
        console.log('📤 Request Data:', JSON.stringify(data, null, 2));
      }

      // Make the actual request
      try {
        const response = await originalPost.call(this, url, data, config);
        
        // Capture Gemini API responses
        if (url.includes('generativelanguage.googleapis.com')) {
          console.log('📥 Intercepted Gemini API response');
          
          self.capturedResponses.push({
            timestamp: new Date().toISOString(),
            url: url,
            status: response.status,
            data: response.data
          });

          const candidate = response.data.candidates?.[0];
          console.log('📥 Response status:', response.status);
          console.log('📥 Finish reason:', candidate?.finishReason);
          console.log('📥 Has content:', !!(candidate?.content?.parts?.length > 0));
          
          if (candidate?.finishReason === 'MALFORMED_FUNCTION_CALL' || candidate?.finishReason === 'UNEXPECTED_TOOL_CALL') {
            console.log('🚨 ERROR DETECTED:', candidate.finishReason);
          }
        }

        return response;
      } catch (error) {
        // Capture errors
        if (url.includes('generativelanguage.googleapis.com')) {
          console.log('❌ Gemini API error:', error.response?.status, error.response?.data);
          
          self.capturedResponses.push({
            timestamp: new Date().toISOString(),
            url: url,
            error: true,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
          });
        }
        
        throw error;
      }
    };
  }

  /**
   * Restore original axios
   */
  restoreAxios() {
    delete axios.post.__intercepted;
    // Note: In a real implementation, we'd properly restore the original method
  }

  /**
   * Get captured data
   */
  getCapturedData() {
    return {
      requests: this.capturedRequests,
      responses: this.capturedResponses
    };
  }
}

/**
 * Test a specific case through our router
 */
async function testRouterCase(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name} - ${testCase.description}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const response = await axios.post(
      `${ROUTER_URL}/v1/messages`,
      testCase.payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key',
          'anthropic-version': '2023-06-01'
        },
        timeout: TIMEOUT
      }
    );

    console.log('✅ Router response received');
    console.log('📊 Status:', response.status);
    console.log('📊 Stop reason:', response.data.stop_reason);
    
    return {
      success: true,
      status: response.status,
      data: response.data,
      stopReason: response.data.stop_reason
    };

  } catch (error) {
    console.log('❌ Router test failed');
    if (error.response) {
      console.log('📊 Error status:', error.response.status);
      console.log('📊 Error data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('📊 Error message:', error.message);
    }

    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
}

/**
 * Analyze captured requests for issues
 */
function analyzeRequests(capturedData) {
  console.log('\n🔬 Analyzing Captured Requests...');
  console.log('═══════════════════════════════════════════════');

  const analysis = {
    requestCount: capturedData.requests.length,
    responseCount: capturedData.responses.length,
    issues: [],
    observations: []
  };

  capturedData.requests.forEach((request, index) => {
    console.log(`\n📋 Request ${index + 1}:`);
    
    // Check for required fields
    const data = request.data;
    if (!data.contents) {
      analysis.issues.push(`Request ${index + 1}: Missing contents field`);
      console.log('   ❌ Missing contents field');
    } else {
      console.log(`   ✅ Has contents (${data.contents.length} items)`);
    }

    if (!data.tools) {
      analysis.observations.push(`Request ${index + 1}: No tools field`);
      console.log('   ℹ️  No tools field');
    } else {
      console.log(`   ✅ Has tools (${data.tools.length} items)`);
      
      // Analyze tool structure
      data.tools.forEach((tool, toolIndex) => {
        if (!tool.functionDeclarations) {
          analysis.issues.push(`Request ${index + 1}, Tool ${toolIndex}: Missing functionDeclarations`);
          console.log(`   ❌ Tool ${toolIndex}: Missing functionDeclarations`);
        } else {
          console.log(`   ✅ Tool ${toolIndex}: Has functionDeclarations (${tool.functionDeclarations.length} items)`);
          
          // Check each function declaration
          tool.functionDeclarations.forEach((func, funcIndex) => {
            if (!func.name) {
              analysis.issues.push(`Request ${index + 1}, Function ${funcIndex}: Missing name`);
            }
            if (!func.parameters) {
              analysis.issues.push(`Request ${index + 1}, Function ${funcIndex}: Missing parameters`);
            } else {
              // Check for unsupported fields in parameters
              const unsupportedFields = ['$schema', 'additionalProperties', 'minItems', 'maxItems'];
              const checkForUnsupported = (obj, path = '') => {
                if (typeof obj !== 'object') return;
                for (const [key, value] of Object.entries(obj)) {
                  if (unsupportedFields.includes(key)) {
                    analysis.issues.push(`Request ${index + 1}, Function ${funcIndex}: Unsupported field ${path}.${key}`);
                  }
                  if (typeof value === 'object') {
                    checkForUnsupported(value, path ? `${path}.${key}` : key);
                  }
                }
              };
              checkForUnsupported(func.parameters);
            }
          });
        }
      });
    }

    if (!data.toolConfig) {
      analysis.observations.push(`Request ${index + 1}: No toolConfig field`);
      console.log('   ℹ️  No toolConfig field');
    } else {
      console.log('   ✅ Has toolConfig');
      if (data.toolConfig.functionCallingConfig?.mode !== 'AUTO') {
        analysis.issues.push(`Request ${index + 1}: toolConfig mode is not AUTO`);
      }
    }
  });

  // Analyze responses
  capturedData.responses.forEach((response, index) => {
    console.log(`\n📋 Response ${index + 1}:`);
    
    if (response.error) {
      analysis.issues.push(`Response ${index + 1}: HTTP error ${response.status}`);
      console.log(`   ❌ HTTP error: ${response.status}`);
    } else {
      const candidate = response.data.candidates?.[0];
      const finishReason = candidate?.finishReason;
      
      console.log(`   📊 Finish reason: ${finishReason}`);
      
      if (finishReason === 'MALFORMED_FUNCTION_CALL') {
        analysis.issues.push(`Response ${index + 1}: MALFORMED_FUNCTION_CALL error`);
        console.log('   🚨 MALFORMED_FUNCTION_CALL detected');
      } else if (finishReason === 'UNEXPECTED_TOOL_CALL') {
        analysis.issues.push(`Response ${index + 1}: UNEXPECTED_TOOL_CALL error`);
        console.log('   🚨 UNEXPECTED_TOOL_CALL detected');
      }
    }
  });

  return analysis;
}

/**
 * Save captured data and analysis
 */
function saveAnalysis(capturedData, analysis, testResults) {
  const timestamp = new Date().toISOString().replace(/[:]/g, '-').substring(0, 19);
  const outputDir = path.join(__dirname, '../debug/output/gemini-request-capture');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    testResults: testResults,
    capturedData: capturedData,
    analysis: analysis,
    summary: {
      totalTests: testResults.length,
      successfulTests: testResults.filter(t => t.success).length,
      failedTests: testResults.filter(t => !t.success).length,
      requestsCaptured: capturedData.requests.length,
      responsesCaptured: capturedData.responses.length,
      issuesFound: analysis.issues.length
    }
  };

  const reportFile = path.join(outputDir, `gemini-request-capture-${timestamp}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  console.log(`\n📊 Analysis Report Saved: ${reportFile}`);
  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Gemini Router Request Capture Test');
  console.log('=====================================');

  // Setup request interception
  const interceptor = new RequestInterceptor();
  interceptor.setupInterception();

  const testResults = [];

  try {
    // Run all test cases
    for (const testCase of TEST_CASES) {
      const result = await testRouterCase(testCase);
      testResults.push({
        testCase: testCase.name,
        ...result
      });
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Get captured data
    const capturedData = interceptor.getCapturedData();
    
    // Analyze captured requests
    const analysis = analyzeRequests(capturedData);
    
    // Save analysis
    const report = saveAnalysis(capturedData, analysis, testResults);

    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`   Tests Run: ${report.summary.totalTests}`);
    console.log(`   Successful: ${report.summary.successfulTests}`);
    console.log(`   Failed: ${report.summary.failedTests}`);
    console.log(`   Requests Captured: ${report.summary.requestsCaptured}`);
    console.log(`   Responses Captured: ${report.summary.responsesCaptured}`);
    console.log(`   Issues Found: ${report.summary.issuesFound}`);

    if (analysis.issues.length > 0) {
      console.log('\n🚨 Issues Identified:');
      analysis.issues.forEach(issue => console.log(`   - ${issue}`));
      
      console.log('\n💡 Recommendations:');
      console.log('   1. Review request format against Gemini API documentation');
      console.log('   2. Check schema conversion logic for unsupported fields');
      console.log('   3. Verify toolConfig setup matches API requirements');
      console.log('   4. Test with minimal schema to isolate the issue');
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    interceptor.restoreAxios();
  }
}

if (require.main === module) {
  main();
}