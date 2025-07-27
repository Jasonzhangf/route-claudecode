/**
 * Transformation Examples and Usage Patterns
 * Demonstrates how to use the new transformation system
 */

import { 
  transformationManager,
  transformOpenAIToAnthropic,
  transformAnthropicToOpenAI,
  transformOpenAIResponseToAnthropic,
  transformAnthropicResponseToOpenAI,
  TransformationContext
} from './manager';

/**
 * Example: Basic message transformation
 */
export function exampleBasicTransformation() {
  // OpenAI format request
  const openaiRequest = {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Hello, how are you?' },
      { role: 'assistant', content: 'I am doing well, thank you!' },
      { role: 'user', content: 'What can you help me with?' }
    ],
    max_tokens: 131072,
    temperature: 0.7
  };

  // Transform to Anthropic format
  const anthropicRequest = transformOpenAIToAnthropic(openaiRequest);
  console.log('Anthropic Request:', JSON.stringify(anthropicRequest, null, 2));

  // Transform back to OpenAI format
  const backToOpenAI = transformAnthropicToOpenAI(anthropicRequest);
  console.log('Back to OpenAI:', JSON.stringify(backToOpenAI, null, 2));
}

/**
 * Example: Tool call transformation
 */
export function exampleToolCallTransformation() {
  // OpenAI request with tool calls
  const openaiWithTools = {
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'What is the weather like in New York?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"location": "New York", "unit": "celsius"}'
            }
          }
        ]
      },
      {
        role: 'tool',
        content: '{"temperature": 22, "condition": "sunny"}',
        tool_call_id: 'call_123'
      },
      {
        role: 'assistant',
        content: 'The weather in New York is sunny with a temperature of 22°C.'
      }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather information',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
            },
            required: ['location']
          }
        }
      }
    ]
  };

  // Transform to Anthropic format
  const anthropicWithTools = transformOpenAIToAnthropic(openaiWithTools);
  console.log('Anthropic with Tools:', JSON.stringify(anthropicWithTools, null, 2));
}

/**
 * Example: Response transformation
 */
export function exampleResponseTransformation() {
  // OpenAI response
  const openaiResponse = {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: 1677652288,
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello! I can help you with various tasks including answering questions, writing, coding, analysis, and more.'
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 20,
      completion_tokens: 25,
      total_tokens: 45
    }
  };

  // Transform to Anthropic format
  const anthropicResponse = transformOpenAIResponseToAnthropic(openaiResponse);
  console.log('Anthropic Response:', JSON.stringify(anthropicResponse, null, 2));
}

/**
 * Example: Custom transformation context
 */
export function exampleCustomTransformation() {
  const request = {
    model: 'claude-3-sonnet',
    messages: [
      { role: 'user', content: 'Explain quantum computing' }
    ]
  };

  const context: TransformationContext = {
    sourceProvider: 'anthropic',
    targetProvider: 'openai',
    preserveToolCalls: true,
    preserveSystemMessages: true
  };

  const transformed = transformationManager.transformRequest(request, context, 'example-123');
  console.log('Custom Transformation:', JSON.stringify(transformed, null, 2));
}

/**
 * Example: Format detection
 */
export function exampleFormatDetection() {
  const requests = [
    // OpenAI format
    {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Hello' }],
      tools: [{ type: 'function', function: { name: 'test' } }]
    },
    // Anthropic format
    {
      model: 'claude-3-sonnet',
      messages: [{ role: 'user', content: 'Hello' }],
      system: [{ type: 'text', text: 'You are helpful' }]
    },
    // Ambiguous format
    {
      model: 'unknown',
      messages: [{ role: 'user', content: 'Hello' }]
    }
  ];

  requests.forEach((req, index) => {
    const format = transformationManager.detectRequestFormat(req);
    console.log(`Request ${index + 1} format:`, format);
  });
}

/**
 * Example: Streaming transformation setup
 */
export function exampleStreamingSetup() {
  // This would be used in actual streaming scenarios
  const streamOptions = {
    sourceFormat: 'openai' as const,
    targetFormat: 'anthropic' as const,
    model: 'gpt-4',
    requestId: 'stream-example-123'
  };

  const streamingTransformer = transformationManager.createStreamingTransformer(streamOptions);
  console.log('Streaming transformer created for:', streamOptions);
  
  // In real usage, you would pass a ReadableStream to the transformer
  // const transformedStream = streamingTransformer.transformOpenAIToAnthropic(originalStream);
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('=== Basic Transformation ===');
  exampleBasicTransformation();
  
  console.log('\n=== Tool Call Transformation ===');
  exampleToolCallTransformation();
  
  console.log('\n=== Response Transformation ===');
  exampleResponseTransformation();
  
  console.log('\n=== Custom Transformation ===');
  exampleCustomTransformation();
  
  console.log('\n=== Format Detection ===');
  exampleFormatDetection();
  
  console.log('\n=== Streaming Setup ===');
  exampleStreamingSetup();
  
  console.log('\n=== Transformation Manager Stats ===');
  console.log(transformationManager.getStats());
}