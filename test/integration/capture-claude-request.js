#!/usr/bin/env node
/**
 * 捕获真实Claude Code请求的简化工具
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const TEST_DATA_DIR = path.join(__dirname, 'pipeline-data');
const CLAUDE_REQUEST_FILE = path.join(TEST_DATA_DIR, 'claude-request.json');

// Ensure test data directory exists
if (!fs.existsSync(TEST_DATA_DIR)) {
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

const app = express();
app.use(express.json({ limit: '10mb' }));

let requestCaptured = false;

app.post('/v1/messages', (req, res) => {
  if (requestCaptured) {
    return res.status(429).json({ error: 'Already captured' });
  }

  console.log('📥 Claude Code request captured!');
  
  const capturedData = {
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body,
    url: req.url,
    method: req.method
  };
  
  // Save to file
  fs.writeFileSync(CLAUDE_REQUEST_FILE, JSON.stringify(capturedData, null, 2));
  console.log(`✅ Request saved to: ${CLAUDE_REQUEST_FILE}`);
  
  // Analyze the request
  console.log('\\n📊 Request Analysis:');
  console.log(`   Model: ${req.body.model}`);
  console.log(`   Stream: ${req.body.stream}`);
  console.log(`   Messages: ${req.body.messages?.length || 0}`);
  console.log(`   Max tokens: ${req.body.max_tokens}`);
  if (req.body.messages && req.body.messages[0]) {
    console.log(`   First message: ${req.body.messages[0].content.substring(0, 100)}...`);
  }
  
  requestCaptured = true;
  
  // Return a simple response
  res.json({
    id: 'msg_capture_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Request captured successfully for pipeline testing!' }],
    model: req.body.model,
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 8 }
  });
  
  // Close server after capture
  setTimeout(() => {
    console.log('\\n🏁 Shutting down capture server...');
    process.exit(0);
  }, 2000);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ready_to_capture' });
});

const server = app.listen(3456, '127.0.0.1', () => {
  console.log('🎯 Claude request capture server started on port 3456');
  console.log('\\n📋 Instructions:');
  console.log('   1. In another terminal, run:');
  console.log('      export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"');
  console.log('      export ANTHROPIC_API_KEY="test-key"');
  console.log('   2. Then run Claude Code:');
  console.log('      claude "hello test"');
  console.log('   3. The request will be captured and saved\\n');
  console.log('⏳ Waiting for Claude Code request...');
});

// Timeout after 2 minutes
setTimeout(() => {
  if (!requestCaptured) {
    console.log('\\n⏰ Timeout - no request received in 2 minutes');
    console.log('💡 Make sure to set the environment variables and run Claude Code');
    process.exit(1);
  }
}, 120000);