#!/usr/bin/env node

function analyze400ErrorCause() {
  console.log('🔍 Analyzing CodeWhisperer 400 Error from Logs...\n');

  console.log('📋 Error Details from Log:');
  console.log('   - Error: "CodeWhisperer request failed: Request failed with status code 400"');
  console.log('   - Code: ERR_BAD_REQUEST');
  console.log('   - Status: 400');
  console.log('   - Provider: codewhisperer');
  console.log('   - Duration: 12874ms (12.8 seconds)');

  console.log('\n🔍 Analysis of Potential Causes:\n');

  console.log('1️⃣ Request Size Issue:');
  console.log('   - The request took 12.8 seconds, indicating a very large request');
  console.log('   - CodeWhisperer has request size limits');
  console.log('   - Large conversation history or tool specifications might exceed limits');

  console.log('\n2️⃣ Content Format Issue:');
  console.log('   - The request contains complex tool specifications');
  console.log('   - Tool schemas might be malformed or too complex');
  console.log('   - Special characters in content might cause parsing issues');

  console.log('\n3️⃣ Model ID Issue:');
  console.log('   - Using "CLAUDE_SONNET_4_20250514_V1_0" model ID');
  console.log('   - This might not be supported or might have different limits');

  console.log('\n4️⃣ Conversation History Issue:');
  console.log('   - Large conversation history with multiple tool calls');
  console.log('   - Complex nested tool specifications');
  console.log('   - Multiple system messages and instructions');

  console.log('\n5️⃣ Tool Specification Issue:');
  console.log('   - The request contains many complex tool specifications');
  console.log('   - Tool schemas might be too large or complex');
  console.log('   - Nested JSON schemas in tool definitions');

  console.log('\n💡 Recommended Solutions:\n');

  console.log('1. Request Size Reduction:');
  console.log('   - Limit conversation history length');
  console.log('   - Reduce tool specification complexity');
  console.log('   - Split large requests into smaller chunks');

  console.log('\n2. Content Sanitization:');
  console.log('   - Remove or escape special characters');
  console.log('   - Validate JSON structure before sending');
  console.log('   - Simplify tool descriptions');

  console.log('\n3. Model Configuration:');
  console.log('   - Verify model ID is correct and supported');
  console.log('   - Check model-specific limits');
  console.log('   - Consider using different model variants');

  console.log('\n4. Request Validation:');
  console.log('   - Add request size validation before sending');
  console.log('   - Implement request content sanitization');
  console.log('   - Add retry logic with smaller requests');

  console.log('\n🔧 Debugging Steps:\n');

  console.log('1. Check request size limits:');
  console.log('   - Monitor request body size');
  console.log('   - Log request content length');
  console.log('   - Compare with known limits');

  console.log('\n2. Validate request format:');
  console.log('   - Check JSON structure');
  console.log('   - Validate tool specifications');
  console.log('   - Test with minimal requests');

  console.log('\n3. Test different scenarios:');
  console.log('   - Simple requests without tools');
  console.log('   - Requests with limited history');
  console.log('   - Different model IDs');

  console.log('\n4. Implement safeguards:');
  console.log('   - Request size limits');
  console.log('   - Content validation');
  console.log('   - Graceful degradation');

  console.log('\n⚠️  Key Insight:');
  console.log('The 400 error appears to be triggered by very large or complex requests,');
  console.log('particularly those with extensive tool specifications and conversation history.');
  console.log('This suggests implementing request size limits and content validation.');
}

analyze400ErrorCause();