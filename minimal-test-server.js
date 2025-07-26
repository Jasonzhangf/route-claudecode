#!/usr/bin/env node
/**
 * Minimal test server to verify streaming works
 */

const express = require('express');
const app = express();
app.use(express.json());

// Import our enhanced client for testing
const { createEnhancedOpenAIClient } = require('./dist/providers/openai/enhanced-client.js');

const config = {
  endpoint: "https://ai.shuaihong.fun/v1/chat/completions",
  authentication: {
    credentials: {
      apiKey: "sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl"
    }
  }
};

const client = createEnhancedOpenAIClient(config, 'test-client');

app.post('/v1/messages', async (req, res) => {
  try {
    console.log('Received request for streaming test');
    
    // Create a simple request
    const request = {
      model: 'gemini-2.5-flash',
      messages: req.body.messages,
      max_tokens: req.body.max_tokens || 100,
      stream: req.body.stream || false,
      metadata: { requestId: 'test-' + Date.now() }
    };

    if (request.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      let chunkCount = 0;
      let undefinedCount = 0;
      
      try {
        for await (const chunk of client.sendStreamRequest(request)) {
          chunkCount++;
          
          if (chunk === undefined || chunk === null || chunk === '') {
            undefinedCount++;
            console.error(`Chunk ${chunkCount}: UNDEFINED/NULL/EMPTY detected!`);
            continue;
          }
          
          console.log(`Chunk ${chunkCount}: ${chunk.split('\n')[0]}`); // Log event line only
          res.write(chunk);
        }
        
        console.log(`Stream completed. Total chunks: ${chunkCount}, Undefined chunks: ${undefinedCount}`);
        res.end();
      } catch (error) {
        console.error('Streaming error:', error);
        res.write('event: error\ndata: {"error":"streaming_error"}\n\n');
        res.end();
      }
    } else {
      // Non-streaming
      const response = await client.sendRequest(request);
      res.json(response);
    }
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({ error: error.message });
  }
});

const port = 3457; // Use different port to avoid conflicts
app.listen(port, () => {
  console.log(`Minimal test server listening on http://localhost:${port}`);
  console.log('Test streaming with:');
  console.log(`curl -X POST http://localhost:${port}/v1/messages -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"hello"}],"stream":true}'`);
});