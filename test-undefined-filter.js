#!/usr/bin/env node
/**
 * Test the undefined filter mechanism
 */

// Simulate a stream that produces undefined values
async function* problematicStream() {
  yield 'event: message_start\ndata: {"type":"message_start"}\n\n';
  yield undefined;  // This is the problem
  yield null;       // Another problem
  yield '';         // Another problem
  yield 'event: ping\ndata: {"type":"ping"}\n\n';
  yield undefined;  // More problems
  yield 'event: content_block_start\ndata: {"type":"content_block_start"}\n\n';
  yield undefined;
  yield undefined;
  yield undefined;
  yield 'event: content_block_stop\ndata: {"type":"content_block_stop"}\n\n';
  yield 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
}

// Apply the same filter as enhanced-client.ts
async function* filterStream(stream) {
  for await (const transformedChunk of stream) {
    // Defensive programming - comprehensive filtering like demo1
    if (
      transformedChunk === undefined ||
      transformedChunk === null ||
      transformedChunk === '' ||
      typeof transformedChunk !== 'string' ||
      transformedChunk.length === 0
    ) {
      // Skip invalid chunks silently (this is expected for some metadata chunks)
      console.log('Filtered out invalid chunk:', JSON.stringify(transformedChunk));
      continue;
    }
    
    // Additional validation for SSE format
    if (!transformedChunk.startsWith('event:') && !transformedChunk.startsWith('data:')) {
      // Not a valid SSE chunk format, skip it
      console.log('Filtered out non-SSE chunk:', transformedChunk.substring(0, 50));
      continue;
    }
    
    yield transformedChunk;
  }
}

// Test the filter
async function testFilter() {
  console.log('=== Testing Undefined Filter ===');
  
  let validChunks = 0;
  let totalIterations = 0;
  
  for await (const chunk of filterStream(problematicStream())) {
    totalIterations++;
    if (chunk !== undefined && chunk !== null && chunk !== '') {
      validChunks++;
      console.log(`Valid chunk ${validChunks}:`, chunk.split('\n')[0]); // Show just the event line
    } else {
      console.error('ERROR: Invalid chunk passed through filter!', JSON.stringify(chunk));
    }
  }
  
  console.log(`\n=== Test Results ===`);
  console.log(`Total iterations: ${totalIterations}`);
  console.log(`Valid chunks: ${validChunks}`);
  console.log(`Filter working: ${totalIterations === validChunks ? 'YES' : 'NO'}`);
}

testFilter().catch(console.error);