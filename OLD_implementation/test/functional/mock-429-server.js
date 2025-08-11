#!/usr/bin/env node

/**
 * Mock Server for 429 Error Testing
 * Always returns 429 to test retry logic
 */

const express = require('express');
const app = express();
const port = 8429;

app.use(express.json());

let requestCount = 0;

app.post('/v1/chat/completions', (req, res) => {
  requestCount++;
  console.log(`📥 Request #${requestCount} received at ${new Date().toISOString()}`);
  console.log('Headers:', req.headers.authorization ? 'Bearer ***' : 'No auth');
  console.log('Model:', req.body.model);
  console.log('Messages count:', req.body.messages?.length || 0);
  
  // Always return 429 Rate Limit
  console.log('🚫 Returning 429 Rate Limit Error');
  
  res.status(429).json({
    error: {
      message: 'Rate limit exceeded',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded'
    }
  });
});

app.listen(port, () => {
  console.log(`🎭 Mock 429 Server running on http://localhost:${port}`);
  console.log('This server always returns 429 errors for testing retry logic');
  console.log('\nTo test with this server:');
  console.log('1. Update config to use http://localhost:8429/v1/chat/completions as endpoint');
  console.log('2. Run the 429 error handling test');
  console.log('3. Observe retry behavior with proper delays');
});