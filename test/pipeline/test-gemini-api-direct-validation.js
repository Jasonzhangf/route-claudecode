#!/usr/bin/env node

/**
 * Direct Gemini API Validation Test
 * 
 * This script directly tests the Gemini API with the exact schema conversion
 * from our pipeline to identify the root cause of MALFORMED_FUNCTION_CALL errors.
 * 
 * It uses the same schema cleaning and conversion logic as the actual Gemini client.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test data from our debug session
const TEST_TOOLS = [
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
];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

/**
 * Clean JSON Schema for Gemini API compatibility (exact replica from client)
 */
function cleanJsonSchemaForGemini(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const cleaned = {};
  const supportedFields = ['type', 'properties', 'required', 'items', 'description', 'enum'];

  for (const [key, value] of Object.entries(schema)) {
    if (supportedFields.includes(key)) {
      if (key === 'properties' && typeof value === 'object') {
        cleaned[key] = {};
        for (const [propKey, propValue] of Object.entries(value)) {
          cleaned[key][propKey] = cleanJsonSchemaForGemini(propValue);
        }
      } else if (key === 'items' && typeof value === 'object') {
        cleaned[key] = cleanJsonSchemaForGemini(value);
      } else {
        cleaned[key] = value;
      }
    }
  }

  return cleaned;
}

/**
 * Convert tools to Gemini format (exact replica from client)
 */
function convertToolsToGeminiFormat(tools) {
  const functionDeclarations = tools.map(tool => {
    let name = tool.name;
    let description = tool.description || '';
    let rawParameters = tool.input_schema || {};

    const parameters = cleanJsonSchemaForGemini(rawParameters);

    return {
      name: name,
      description: description,
      parameters: parameters
    };
  });

  return {
    functionDeclarations: functionDeclarations
  };
}

/**
 * Test different schema variations to isolate the issue
 */
async function testSchemaVariations() {
  console.log('🧪 Testing Schema Variations for MALFORMED_FUNCTION_CALL...\n');

  const variations = [
    {
      name: 'baseline-exact-replica',
      description: 'Exact schema from our conversion pipeline',
      schema: TEST_TOOLS[0].input_schema
    },
    {
      name: 'minimal-schema',
      description: 'Minimal valid schema',
      schema: {
        type: 'object',
        properties: {
          city: { type: 'string' }
        },
        required: ['city']
      }
    },
    {
      name: 'no-description',
      description: 'Schema without property descriptions',
      schema: {
        type: 'object',
        properties: {
          city: { type: 'string' }
        },
        required: ['city']
      }
    },
    {
      name: 'with-enum',
      description: 'Schema with enum values',
      schema: {
        type: 'object',
        properties: {
          city: { 
            type: 'string',
            enum: ['Tokyo', 'Beijing', 'London']
          }
        },
        required: ['city']
      }
    }
  ];

  const results = [];

  for (const variation of variations) {
    console.log(`🔍 Testing: ${variation.name} - ${variation.description}`);
    
    try {
      const testTool = {
        name: 'get_weather',
        description: 'Get weather information',
        input_schema: variation.schema
      };

      const result = await testGeminiAPICall([testTool]);
      results.push({
        variation: variation.name,
        success: result.success,
        finishReason: result.finishReason,
        hasContent: result.hasContent,
        error: result.error,
        requestPayload: result.requestPayload
      });

      console.log(`   Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`   Finish Reason: ${result.finishReason || 'N/A'}`);
      console.log(`   Has Content: ${result.hasContent}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

    } catch (error) {
      console.log(`   ❌ EXCEPTION: ${error.message}`);
      results.push({
        variation: variation.name,
        success: false,
        error: error.message
      });
    }

    console.log(''); // Empty line for readability
  }

  return results;
}

/**
 * Test Gemini API call with specific tool configuration
 */
async function testGeminiAPICall(tools) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
    throw new Error('GEMINI_API_KEY environment variable not set');
  }

  // Convert using our exact logic
  const convertedTools = convertToolsToGeminiFormat(tools);
  
  // Build request exactly like our client does
  const requestPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'What is the weather in Tokyo?' }]
      }
    ],
    tools: [convertedTools],
    toolConfig: {
      functionCallingConfig: {
        mode: "AUTO"
      }
    }
  };

  console.log(`   📤 Request payload preview:`, JSON.stringify(requestPayload, null, 2).substring(0, 200) + '...');

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      requestPayload,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const candidate = response.data.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const hasContent = !!(candidate?.content?.parts?.length > 0);

    return {
      success: finishReason !== 'MALFORMED_FUNCTION_CALL' && finishReason !== 'UNEXPECTED_TOOL_CALL',
      finishReason: finishReason,
      hasContent: hasContent,
      responseData: response.data,
      requestPayload: requestPayload
    };

  } catch (error) {
    if (error.response) {
      return {
        success: false,
        error: `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`,
        requestPayload: requestPayload
      };
    } else {
      return {
        success: false,
        error: error.message,
        requestPayload: requestPayload
      };
    }
  }
}

/**
 * Detailed schema analysis
 */
function analyzeSchemaConversion() {
  console.log('🔬 Analyzing Schema Conversion Process...\n');

  const originalSchema = TEST_TOOLS[0].input_schema;
  const cleanedSchema = cleanJsonSchemaForGemini(originalSchema);
  const convertedTool = convertToolsToGeminiFormat([TEST_TOOLS[0]]);

  console.log('📋 Original Anthropic Schema:');
  console.log(JSON.stringify(originalSchema, null, 2));

  console.log('\n🧹 Cleaned Schema (after cleanJsonSchemaForGemini):');
  console.log(JSON.stringify(cleanedSchema, null, 2));

  console.log('\n🔧 Final Gemini Tool Format:');
  console.log(JSON.stringify(convertedTool, null, 2));

  // Analyze potential issues
  console.log('\n🚨 Potential Issues Analysis:');
  
  const issues = [];

  // Check for unsupported fields in original schema
  const unsupportedFields = ['$schema', 'additionalProperties', 'minItems', 'maxItems', 'minLength', 'maxLength'];
  for (const field of unsupportedFields) {
    if (hasNestedProperty(originalSchema, field)) {
      issues.push(`Unsupported field found: ${field}`);
    }
  }

  // Check Chinese characters in descriptions
  if (TEST_TOOLS[0].description.match(/[\u4e00-\u9fff]/)) {
    issues.push('Non-ASCII characters in description (Chinese)');
  }

  if (issues.length === 0) {
    console.log('   ✅ No obvious issues detected in schema');
  } else {
    issues.forEach(issue => console.log(`   ⚠️  ${issue}`));
  }

  return {
    originalSchema,
    cleanedSchema,
    convertedTool,
    issues
  };
}

/**
 * Check if object has nested property
 */
function hasNestedProperty(obj, propName) {
  if (typeof obj !== 'object' || obj === null) return false;
  
  if (obj.hasOwnProperty(propName)) return true;
  
  for (const value of Object.values(obj)) {
    if (hasNestedProperty(value, propName)) return true;
  }
  
  return false;
}

/**
 * Save test results
 */
function saveResults(analysisResults, testResults) {
  const timestamp = new Date().toISOString().replace(/[:]/g, '-').substring(0, 19);
  const outputDir = path.join(__dirname, '../debug/output/gemini-api-validation');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resultsFile = path.join(outputDir, `gemini-api-test-results-${timestamp}.json`);
  const results = {
    timestamp: new Date().toISOString(),
    analysis: analysisResults,
    testVariations: testResults,
    summary: {
      totalTests: testResults.length,
      successfulTests: testResults.filter(r => r.success).length,
      failedTests: testResults.filter(r => !r.success).length,
      malformedCalls: testResults.filter(r => r.finishReason === 'MALFORMED_FUNCTION_CALL').length,
      unexpectedCalls: testResults.filter(r => r.finishReason === 'UNEXPECTED_TOOL_CALL').length
    }
  };

  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  
  console.log(`📊 Test results saved to: ${resultsFile}`);
  return results;
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Direct Gemini API Validation Test');
  console.log('=====================================\n');

  try {
    // Analyze schema conversion
    const analysisResults = analyzeSchemaConversion();

    // Test schema variations
    const testResults = await testSchemaVariations();

    // Save results
    const fullResults = saveResults(analysisResults, testResults);

    // Summary
    console.log('📊 Test Summary:');
    console.log(`   Total Variations Tested: ${fullResults.summary.totalTests}`);
    console.log(`   Successful: ${fullResults.summary.successfulTests}`);
    console.log(`   Failed: ${fullResults.summary.failedTests}`);
    console.log(`   MALFORMED_FUNCTION_CALL: ${fullResults.summary.malformedCalls}`);
    console.log(`   UNEXPECTED_TOOL_CALL: ${fullResults.summary.unexpectedCalls}`);

    if (fullResults.summary.failedTests > 0) {
      console.log('\n🚨 Failed test details:');
      testResults.filter(r => !r.success).forEach(result => {
        console.log(`   - ${result.variation}: ${result.error || result.finishReason}`);
      });
    }

    if (fullResults.summary.malformedCalls > 0 || fullResults.summary.unexpectedCalls > 0) {
      console.log('\n💡 Recommendations:');
      console.log('   1. Check if API key has proper permissions');
      console.log('   2. Verify Gemini API model supports tool calling');
      console.log('   3. Test with simpler schema structure');
      console.log('   4. Check for regional API differences');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}