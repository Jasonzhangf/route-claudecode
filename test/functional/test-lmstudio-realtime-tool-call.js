const axios = require('axios');
const assert = require('assert');

const API_URL = 'http://localhost:5506/v1/messages';

async function testLmStudioStreamingToolCall() {
  console.log('--- Running LM Studio Real-time Tool Call Test ---');
  
  const requestBody = {
    model: 'lmstudio-community/Meta-Llama-3-8B-Instruct-GGUF',
    messages: [
      {
        role: 'user',
        content: 'I need to know the files in my current directory. Use the LS tool for this.'
      }
    ],
    stream: true,
    tools: [
      {
        name: 'LS',
        description: 'Lists files and directories in a given path.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to the directory to list.'
            }
          },
          required: ['path']
        }
      }
    ]
  };

  let responseText = '';
  let toolCallDetected = false;
  let textStreamed = false;

  try {
    const response = await axios.post(API_URL, requestBody, { responseType: 'stream' });
    const stream = response.data;

    for await (const chunk of stream) {
      const chunkStr = chunk.toString();
      responseText += chunkStr;
      
      if (chunkStr.includes('event: content_block_delta')) {
          const dataLine = chunkStr.split('\n').find(line => line.startsWith('data: '));
          if (dataLine) {
              const data = JSON.parse(dataLine.slice(6));
              if (data.delta.type === 'text_delta' && data.delta.text) {
                  console.log(`Streamed text: "${data.delta.text}"`);
                  textStreamed = true;
              }
          }
      }

      if (chunkStr.includes('"type":"tool_use"')) {
        console.log('Tool call detected in stream.');
        toolCallDetected = true;
      }
    }

    console.log('--- Test Assertions ---');
    assert(textStreamed, 'Assertion failed: Text content was not streamed.');
    console.log('✅ PASSED: Text content was streamed in real-time.');
    assert(toolCallDetected, 'Assertion failed: Tool call was not detected in the stream.');
    console.log('✅ PASSED: Tool call was correctly identified and structured.');
    assert(responseText.includes('stop_reason":"tool_use"'), 'Assertion failed: The stream did not end with a tool_use stop_reason.');
    console.log('✅ PASSED: Stream correctly terminated with tool_use stop reason.');
    
    console.log('--- Test Successfully Completed ---');

  } catch (error) {
    console.error('--- Test Failed ---');
    console.error('Error during streaming test:', error.message);
    console.error('Full response text received before error:', responseText);
    process.exit(1);
  }
}

testLmStudioStreamingToolCall();
