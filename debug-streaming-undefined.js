#!/usr/bin/env node
/**
 * Debug script to identify where undefined comes from in streaming transformer
 */

// Mock the parts we need
const mockSourceData = [
  'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1753531368,"model":"gemini-2.5-flash","system_fingerprint":null,"choices":[{"delta":{"content":"","role":"assistant"},"logprobs":null,"finish_reason":null,"index":0}],"usage":null}',
  'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1753531368,"model":"gemini-2.5-flash","system_fingerprint":null,"choices":[{"delta":{"content":""},"logprobs":null,"finish_reason":null,"index":0}],"usage":null}',
  'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1753531368,"model":"gemini-2.5-flash","system_fingerprint":null,"choices":[{"delta":{"content":"Hello world"},"logprobs":null,"finish_reason":null,"index":0}],"usage":null}',
  'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1753531368,"model":"gemini-2.5-flash","system_fingerprint":null,"choices":[{"delta":{},"logprobs":null,"finish_reason":"stop","index":0}],"usage":null}',
  'data: [DONE]'
];

// Simple streaming transformer based on our logic
function* debugStreamingTransformer() {
  console.log('Starting streaming transformer debug...');
  
  let hasStarted = false;
  let hasContentBlock = false;
  let outputTokens = 0;
  let stopReason = 'end_turn';
  
  // Send message start event
  if (!hasStarted) {
    const messageStartEvent = createAnthropicEvent('message_start', {
      type: 'message_start',
      message: {
        id: 'msg_debug',
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'gemini-2.5-flash',
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    });
    if (messageStartEvent) {
      console.log('Yielding message_start');
      yield messageStartEvent;
    }

    const pingEvent = createAnthropicEvent('ping', { type: 'ping' });
    if (pingEvent) {
      console.log('Yielding ping');
      yield pingEvent;
    }
    hasStarted = true;
  }
  
  // Process each chunk
  for (const line of mockSourceData) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        break;
      }
      
      try {
        const chunk = JSON.parse(data);
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        
        console.log('Processing chunk:', JSON.stringify(choice, null, 2));
        
        // Track if we handled this chunk
        let handledChunk = false;

        // Handle content deltas
        if (choice.delta?.content !== undefined) {
          handledChunk = true;
          console.log('  -> Handling content delta, content:', JSON.stringify(choice.delta.content));
          
          if (!hasContentBlock) {
            const startEvent = createAnthropicEvent('content_block_start', {
              type: 'content_block_start',
              index: 0,
              content_block: { type: 'text', text: '' }
            });
            if (startEvent) {
              console.log('  -> Yielding content_block_start');
              yield startEvent;
              hasContentBlock = true;
            }
          }

          // Only yield content delta if there is actual non-empty content
          if (choice.delta.content && choice.delta.content.length > 0) {
            const deltaEvent = createAnthropicEvent('content_block_delta', {
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: choice.delta.content }
            });
            if (deltaEvent) {
              console.log('  -> Yielding content_block_delta with text:', choice.delta.content);
              yield deltaEvent;
              outputTokens += Math.ceil(choice.delta.content.length / 4);
            }
          } else {
            console.log('  -> Skipping empty content delta');
          }
        }

        // Handle finish reason
        if (choice.finish_reason) {
          handledChunk = true;
          console.log('  -> Handling finish reason:', choice.finish_reason);
          stopReason = choice.finish_reason === 'stop' ? 'end_turn' : choice.finish_reason;
        }
        
        // Log unhandled chunks
        if (!handledChunk) {
          console.log('  -> Chunk not handled (this is normal for metadata chunks)');
        }
        
      } catch (error) {
        console.error('Failed to parse chunk:', error);
      }
    }
  }
  
  // Send completion events
  if (hasContentBlock) {
    const stopEvent = createAnthropicEvent('content_block_stop', {
      type: 'content_block_stop',
      index: 0
    });
    if (stopEvent) {
      console.log('Yielding content_block_stop');
      yield stopEvent;
    }
  }

  // Send message delta with usage
  const messageDeltaEvent = createAnthropicEvent('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: outputTokens }
  });
  if (messageDeltaEvent) {
    console.log('Yielding message_delta');
    yield messageDeltaEvent;
  }

  // Send message stop
  const messageStopEvent = createAnthropicEvent('message_stop', {
    type: 'message_stop'
  });
  if (messageStopEvent) {
    console.log('Yielding message_stop');
    yield messageStopEvent;
  }
}

function createAnthropicEvent(event, data) {
  try {
    // Defensive checks like demo1
    if (!event || event === undefined || event === null) {
      console.error('createAnthropicEvent: event is invalid:', event);
      return null;
    }
    if (!data || data === undefined || data === null) {
      console.error('createAnthropicEvent: data is invalid:', data);
      return null;
    }
    
    const jsonString = JSON.stringify(data);
    if (!jsonString || jsonString === 'null' || jsonString === 'undefined') {
      console.error('createAnthropicEvent: JSON string is invalid:', jsonString);
      return null;
    }
    
    return `event: ${event}\ndata: ${jsonString}\n\n`;
  } catch (error) {
    console.error('createAnthropicEvent: Failed to create event:', error);
    return null;
  }
}

// Run the test
console.log('=== Testing Streaming Transformer ===');
let eventCount = 0;
for (const event of debugStreamingTransformer()) {
  eventCount++;
  console.log(`\n--- Event ${eventCount} ---`);
  if (event === undefined || event === null) {
    console.error('ERROR: Received undefined/null event!');
    console.error('Event value:', event);
  } else {
    console.log('Event (first 100 chars):', event.substring(0, 100) + (event.length > 100 ? '...' : ''));
  }
}

console.log(`\n=== Test completed, total events: ${eventCount} ===`);