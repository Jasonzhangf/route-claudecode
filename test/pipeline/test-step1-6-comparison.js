#!/usr/bin/env node

/**
 * Demo2 Six-Step Process Comparison Test
 * 
 * This test script replicates the demo2 six-step process to compare with our current system:
 * 1. Input Processing - Send real Anthropic API request to our system
 * 2. Routing Logic - Check how model routing works
 * 3. Request Transformation - Compare Anthropic to CodeWhisperer conversion
 * 4. Raw API Response - Get CodeWhisperer raw response
 * 5. Parser Input - Check what parser receives
 * 6. Final Output - Compare final Anthropic response
 * 
 * Based on demo2/main.go analysis:
 * - Model mapping: "claude-sonnet-4-20250514" -> "CLAUDE_SONNET_4_20250514_V1_0"
 * - Request structure: buildCodeWhispererRequest() function shows proper format
 * - Response parsing: Uses parser.ParseEvents() for SSE parsing
 * - Authentication: Bearer token from ~/.aws/sso/cache/kiro-auth-token.json
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const OUR_SYSTEM_URL = 'http://localhost:3456';
const CODEWHISPERER_URL = 'https://codewhisperer.us-east-1.amazonaws.com';
const OUTPUT_DIR = path.join(__dirname, '../../');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// Test configuration following demo2
const TEST_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  expectedCodeWhispererModel: 'CLAUDE_SONNET_4_20250514_V1_0',
  profileArn: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK',
  testMessage: 'Hello, how are you today?'
};

// Output file paths
const OUTPUT_FILES = {
  step1: path.join(OUTPUT_DIR, 'step1-output.json'),
  step2: path.join(OUTPUT_DIR, 'step2-output.json'),
  step3: path.join(OUTPUT_DIR, 'step3-output.json'),
  step4: path.join(OUTPUT_DIR, 'step4-output.json'),
  step5: path.join(OUTPUT_DIR, 'step5-output.json'),
  step6: path.join(OUTPUT_DIR, 'step6-output.json'),
  comparison: path.join(OUTPUT_DIR, `demo2-comparison-${TIMESTAMP}.json`)
};

// Demo2 model mapping (from main.go)
const DEMO2_MODEL_MAP = {
  'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3-5-haiku-20241022': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3.5-haiku': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3-5-haiku': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3.5-sonnet': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3-5-sonnet': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3-sonnet': 'CLAUDE_SONNET_4_20250514_V1_0',
  'claude-3.7': 'CLAUDE_SONNET_4_20250514_V1_0'
};

// Demo2 request builder (from main.go buildCodeWhispererRequest function)
function buildDemo2CodeWhispererRequest(anthropicRequest) {
  const cwRequest = {
    profileArn: TEST_CONFIG.profileArn,
    conversationState: {
      chatTriggerType: 'MANUAL',
      conversationId: generateUUID(),
      currentMessage: {
        userInputMessage: {
          content: getMessageContent(anthropicRequest.messages[anthropicRequest.messages.length - 1].content),
          modelId: DEMO2_MODEL_MAP[anthropicRequest.model] || 'CLAUDE_SONNET_4_20250514_V1_0',
          origin: 'AI_EDITOR',
          userInputMessageContext: {
            toolResults: []
          }
        }
      },
      history: []
    }
  };

  // Handle tools (from demo2)
  if (anthropicRequest.tools && anthropicRequest.tools.length > 0) {
    cwRequest.conversationState.currentMessage.userInputMessage.userInputMessageContext.tools = 
      anthropicRequest.tools.map(tool => ({
        toolSpecification: {
          name: tool.name,
          description: tool.description,
          inputSchema: {
            json: tool.input_schema
          }
        }
      }));
  }

  // Build history (from demo2 logic)
  if (anthropicRequest.system && anthropicRequest.system.length > 0 || anthropicRequest.messages.length > 1) {
    const history = [];
    const assistantDefaultMsg = {
      assistantResponseMessage: {
        content: 'I will follow these instructions',
        toolUses: []
      }
    };

    // Add system messages as history
    if (anthropicRequest.system && anthropicRequest.system.length > 0) {
      anthropicRequest.system.forEach(sysMsg => {
        const userMsg = {
          userInputMessage: {
            content: sysMsg.text,
            modelId: cwRequest.conversationState.currentMessage.userInputMessage.modelId,
            origin: 'AI_EDITOR'
          }
        };
        history.push(userMsg);
        history.push(assistantDefaultMsg);
      });
    }

    // Add regular message history
    for (let i = 0; i < anthropicRequest.messages.length - 1; i++) {
      if (anthropicRequest.messages[i].role === 'user') {
        const userMsg = {
          userInputMessage: {
            content: getMessageContent(anthropicRequest.messages[i].content),
            modelId: cwRequest.conversationState.currentMessage.userInputMessage.modelId,
            origin: 'AI_EDITOR'
          }
        };
        history.push(userMsg);

        // Check for assistant response
        if (i + 1 < anthropicRequest.messages.length && anthropicRequest.messages[i + 1].role === 'assistant') {
          const assistantMsg = {
            assistantResponseMessage: {
              content: getMessageContent(anthropicRequest.messages[i + 1].content),
              toolUses: []
            }
          };
          history.push(assistantMsg);
          i++; // Skip processed assistant message
        } else {
          history.push(assistantDefaultMsg);
        }
      }
    }

    cwRequest.conversationState.history = history;
  }

  return cwRequest;
}

// Helper functions (from demo2)
function generateUUID() {
  return uuidv4();
}

function getMessageContent(content) {
  if (typeof content === 'string') {
    return content.length === 0 ? 'answer for user qeustion' : content;
  }
  
  if (Array.isArray(content)) {
    const texts = [];
    content.forEach(block => {
      if (block && typeof block === 'object') {
        switch (block.type) {
          case 'tool_result':
            texts.push(block.content);
            break;
          case 'text':
            texts.push(block.text);
            break;
        }
      }
    });
    
    if (texts.length === 0) {
      return 'answer for user qeustion';
    }
    return texts.join('\n');
  }
  
  return 'answer for user qeustion';
}

// Get CodeWhisperer token (from demo2 auth)
async function getCodeWhispererToken() {
  try {
    const homeDir = require('os').homedir();
    const tokenPath = path.join(homeDir, '.aws', 'sso', 'cache', 'kiro-auth-token.json');
    
    if (!fs.existsSync(tokenPath)) {
      console.error('❌ Token file not found:', tokenPath);
      return null;
    }

    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    console.log('✅ Found token:', tokenData.accessToken.substring(0, 20) + '...');
    return tokenData.accessToken;
  } catch (error) {
    console.error('❌ Failed to get CodeWhisperer token:', error.message);
    return null;
  }
}

// Save step output
function saveStepOutput(step, data) {
  const output = {
    step,
    timestamp: new Date().toISOString(),
    data
  };
  
  fs.writeFileSync(OUTPUT_FILES[`step${step}`], JSON.stringify(output, null, 2));
  console.log(`✅ Step ${step} output saved to ${OUTPUT_FILES[`step${step}`]}`);
  return output;
}

// Step 1: Input Processing - Send real Anthropic API request to our system
async function step1_inputProcessing() {
  console.log('\n🔄 Step 1: Input Processing');
  console.log('Sending real Anthropic API request to our system...');

  const anthropicRequest = {
    model: TEST_CONFIG.model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: TEST_CONFIG.testMessage
      }
    ],
    stream: false
  };

  try {
    console.log('Request:', JSON.stringify(anthropicRequest, null, 2));
    
    const response = await axios.post(`${OUR_SYSTEM_URL}/v1/messages`, anthropicRequest, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-key' // Our system should route this
      },
      timeout: 30000
    });

    const result = {
      success: true,
      request: anthropicRequest,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      },
      error: null
    };

    console.log('✅ Step 1 completed successfully');
    console.log('Response status:', response.status);
    console.log('Response preview:', JSON.stringify(response.data, null, 2).substring(0, 300) + '...');

    return saveStepOutput(1, result);
  } catch (error) {
    const result = {
      success: false,
      request: anthropicRequest,
      response: null,
      error: {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      }
    };

    console.log('❌ Step 1 failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }

    return saveStepOutput(1, result);
  }
}

// Step 2: Routing Logic - Check how model routing works
async function step2_routingLogic(step1Output) {
  console.log('\n🔄 Step 2: Routing Logic');
  console.log('Analyzing model routing and provider selection...');

  const anthropicRequest = step1Output.data.request;
  
  // Simulate our routing logic
  const routingAnalysis = {
    inputModel: anthropicRequest.model,
    expectedRoute: {
      category: 'default', // Based on simple message
      provider: 'codewhisperer-primary',
      reason: 'Default routing for claude-sonnet-4 model'
    },
    demo2Mapping: {
      originalModel: anthropicRequest.model,
      mappedModel: DEMO2_MODEL_MAP[anthropicRequest.model] || 'CLAUDE_SONNET_4_20250514_V1_0',
      matches: DEMO2_MODEL_MAP[anthropicRequest.model] === TEST_CONFIG.expectedCodeWhispererModel
    }
  };

  const result = {
    success: true,
    inputRequest: anthropicRequest,
    routingAnalysis,
    step1Success: step1Output.data.success,
    timestamp: new Date().toISOString()
  };

  console.log('✅ Step 2 completed');
  console.log('Input model:', routingAnalysis.inputModel);
  console.log('Expected route:', routingAnalysis.expectedRoute.provider);
  console.log('Demo2 model mapping:', routingAnalysis.demo2Mapping.mappedModel);
  console.log('Mapping matches expected:', routingAnalysis.demo2Mapping.matches);

  return saveStepOutput(2, result);
}

// Step 3: Request Transformation - Compare Anthropic to CodeWhisperer conversion
async function step3_requestTransformation(step2Output) {
  console.log('\n🔄 Step 3: Request Transformation');
  console.log('Comparing Anthropic to CodeWhisperer request conversion...');

  const anthropicRequest = step2Output.data.inputRequest;

  // Build request using demo2 logic
  const demo2Request = buildDemo2CodeWhispererRequest(anthropicRequest);

  // Analyze the transformation
  const transformationAnalysis = {
    demo2Request,
    comparison: {
      profileArn: {
        demo2: demo2Request.profileArn,
        expected: TEST_CONFIG.profileArn,
        matches: demo2Request.profileArn === TEST_CONFIG.profileArn
      },
      conversationId: {
        demo2: demo2Request.conversationState.conversationId,
        isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(demo2Request.conversationState.conversationId)
      },
      modelMapping: {
        original: anthropicRequest.model,
        demo2Mapped: demo2Request.conversationState.currentMessage.userInputMessage.modelId,
        expected: TEST_CONFIG.expectedCodeWhispererModel,
        matches: demo2Request.conversationState.currentMessage.userInputMessage.modelId === TEST_CONFIG.expectedCodeWhispererModel
      },
      content: {
        original: anthropicRequest.messages[0].content,
        demo2: demo2Request.conversationState.currentMessage.userInputMessage.content,
        matches: demo2Request.conversationState.currentMessage.userInputMessage.content === anthropicRequest.messages[0].content
      },
      structure: {
        hasProfileArn: !!demo2Request.profileArn,
        hasConversationState: !!demo2Request.conversationState,
        hasCurrentMessage: !!demo2Request.conversationState.currentMessage,
        hasUserInputMessage: !!demo2Request.conversationState.currentMessage.userInputMessage,
        hasHistory: Array.isArray(demo2Request.conversationState.history),
        historyLength: demo2Request.conversationState.history.length
      }
    }
  };

  const result = {
    success: true,
    transformationAnalysis,
    demo2RequestSize: JSON.stringify(demo2Request).length,
    timestamp: new Date().toISOString()
  };

  console.log('✅ Step 3 completed');
  console.log('Demo2 request size:', result.demo2RequestSize, 'bytes');
  console.log('Profile ARN matches:', transformationAnalysis.comparison.profileArn.matches);
  console.log('Model mapping matches:', transformationAnalysis.comparison.modelMapping.matches);
  console.log('Content matches:', transformationAnalysis.comparison.content.matches);
  console.log('Conversation ID is UUID:', transformationAnalysis.comparison.conversationId.isUUID);

  return saveStepOutput(3, result);
}

// Step 4: Raw API Response - Get CodeWhisperer raw response
async function step4_rawApiResponse(step3Output) {
  console.log('\n🔄 Step 4: Raw API Response');
  console.log('Getting CodeWhisperer raw response using demo2 request...');

  const demo2Request = step3Output.data.transformationAnalysis.demo2Request;
  const token = await getCodeWhispererToken();

  if (!token) {
    const result = {
      success: false,
      error: 'No CodeWhisperer token available',
      demo2Request,
      timestamp: new Date().toISOString()
    };
    console.log('❌ Step 4 failed: No token available');
    return saveStepOutput(4, result);
  }

  try {
    console.log('Sending request to CodeWhisperer API...');
    console.log('Request size:', JSON.stringify(demo2Request).length, 'bytes');

    const response = await axios.post(
      `${CODEWHISPERER_URL}/generateAssistantResponse`,
      demo2Request,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    const responseBuffer = Buffer.from(response.data);

    const result = {
      success: true,
      demo2Request,
      rawResponse: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        dataLength: responseBuffer.length,
        dataHex: responseBuffer.toString('hex').substring(0, 200), // First 100 hex chars
        dataPreview: responseBuffer.toString('utf8', 0, Math.min(500, responseBuffer.length))
      },
      timestamp: new Date().toISOString()
    };

    // Save raw binary response for analysis
    const rawFile = path.join(OUTPUT_DIR, `step4-raw-response-${TIMESTAMP}.bin`);
    fs.writeFileSync(rawFile, responseBuffer);
    result.rawResponseFile = rawFile;

    console.log('✅ Step 4 completed successfully');
    console.log('Response status:', response.status);
    console.log('Response length:', responseBuffer.length, 'bytes');
    console.log('Raw response saved to:', rawFile);

    return saveStepOutput(4, result);
  } catch (error) {
    const result = {
      success: false,
      demo2Request,
      error: {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data ? Buffer.from(error.response.data).toString('utf8') : null
      },
      timestamp: new Date().toISOString()
    };

    console.log('❌ Step 4 failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', error.response.data);
    }

    return saveStepOutput(4, result);
  }
}

// Step 5: Parser Input - Check what parser receives
async function step5_parserInput(step4Output) {
  console.log('\n🔄 Step 5: Parser Input');
  console.log('Analyzing what demo2 parser would receive...');

  if (!step4Output.data.success) {
    const result = {
      success: false,
      error: 'Step 4 failed, no raw response to parse',
      timestamp: new Date().toISOString()
    };
    console.log('❌ Step 5 skipped: Step 4 failed');
    return saveStepOutput(5, result);
  }

  try {
    // Load the raw response
    const rawFile = step4Output.data.rawResponseFile;
    const responseBuffer = fs.readFileSync(rawFile);

    // Simulate demo2 parser input analysis
    const parserInput = {
      bufferLength: responseBuffer.length,
      hexPreview: responseBuffer.toString('hex').substring(0, 200),
      utf8Preview: responseBuffer.toString('utf8', 0, Math.min(500, responseBuffer.length)),
      binaryStructure: analyzeBinaryStructure(responseBuffer),
      frameAnalysis: analyzeFrameStructure(responseBuffer)
    };

    const result = {
      success: true,
      parserInput,
      rawResponseFile: rawFile,
      timestamp: new Date().toISOString()
    };

    console.log('✅ Step 5 completed');
    console.log('Buffer length:', parserInput.bufferLength);
    console.log('Detected frames:', parserInput.frameAnalysis.frameCount);
    console.log('First frame size:', parserInput.frameAnalysis.firstFrameSize);

    return saveStepOutput(5, result);
  } catch (error) {
    const result = {
      success: false,
      error: {
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    };

    console.log('❌ Step 5 failed:', error.message);
    return saveStepOutput(5, result);
  }
}

// Step 6: Final Output - Compare final Anthropic response
async function step6_finalOutput(step5Output) {
  console.log('\n🔄 Step 6: Final Output');
  console.log('Analyzing final output and comparing with step 1...');

  const step1Data = JSON.parse(fs.readFileSync(OUTPUT_FILES.step1, 'utf8'));
  const step4Data = JSON.parse(fs.readFileSync(OUTPUT_FILES.step4, 'utf8'));

  const comparison = {
    step1Success: step1Data.data.success,
    step4Success: step4Data.data.success,
    step5Success: step5Output.data.success,
    pipeline: {
      inputProcessingWorked: step1Data.data.success,
      directCodeWhispererWorked: step4Data.data.success,
      parsingWorked: step5Output.data.success,
      fullPipelineWorked: step1Data.data.success && step4Data.data.success && step5Output.data.success
    }
  };

  // If step 1 succeeded, compare the responses
  if (step1Data.data.success) {
    const ourResponse = step1Data.data.response.data;
    comparison.ourSystemResponse = {
      hasContent: !!ourResponse.content,
      contentLength: Array.isArray(ourResponse.content) ? ourResponse.content.length : 0,
      hasUsage: !!ourResponse.usage,
      model: ourResponse.model,
      role: ourResponse.role,
      stopReason: ourResponse.stop_reason,
      responseStructure: Object.keys(ourResponse)
    };
  }

  // API Error Analysis
  if (!step1Data.data.success && step1Data.data.error) {
    comparison.apiErrorAnalysis = {
      errorMessage: step1Data.data.error.message,
      httpStatus: step1Data.data.error.status,
      errorType: classifyApiError(step1Data.data.error),
      possibleCauses: identifyPossibleCauses(step1Data.data.error)
    };
  }

  if (!step4Data.data.success && step4Data.data.error) {
    comparison.directApiErrorAnalysis = {
      errorMessage: step4Data.data.error.message,
      httpStatus: step4Data.data.error.status,
      errorType: classifyApiError(step4Data.data.error),
      possibleCauses: identifyPossibleCauses(step4Data.data.error)
    };
  }

  const result = {
    success: true,
    comparison,
    recommendations: generateRecommendations(comparison),
    timestamp: new Date().toISOString()
  };

  console.log('✅ Step 6 completed');
  console.log('Full pipeline worked:', comparison.pipeline.fullPipelineWorked);
  console.log('Our system worked:', comparison.step1Success);
  console.log('Direct CodeWhisperer worked:', comparison.step4Success);

  return saveStepOutput(6, result);
}

// Helper functions for analysis
function analyzeBinaryStructure(buffer) {
  const analysis = {
    hasAwsHeader: false,
    firstBytes: buffer.toString('hex', 0, Math.min(16, buffer.length)),
    possibleFrames: 0
  };

  // Look for AWS binary frame structure
  if (buffer.length >= 8) {
    const totalLen = buffer.readUInt32BE(0);
    const headerLen = buffer.readUInt32BE(4);
    
    analysis.firstFrameTotalLen = totalLen;
    analysis.firstFrameHeaderLen = headerLen;
    analysis.hasAwsHeader = totalLen > 0 && headerLen > 0 && totalLen < buffer.length + 1000;
  }

  return analysis;
}

function analyzeFrameStructure(buffer, maxFrames = 10) {
  const frames = [];
  let offset = 0;

  while (offset < buffer.length - 8 && frames.length < maxFrames) {
    try {
      const totalLen = buffer.readUInt32BE(offset);
      const headerLen = buffer.readUInt32BE(offset + 4);

      if (totalLen === 0 || headerLen === 0 || totalLen > buffer.length - offset + 100) {
        break;
      }

      const payloadLen = totalLen - headerLen - 12;
      
      frames.push({
        offset,
        totalLen,
        headerLen,
        payloadLen,
        nextOffset: offset + totalLen + 4 // +4 for CRC32
      });

      offset += totalLen + 4; // Move to next frame
    } catch (error) {
      break;
    }
  }

  return {
    frameCount: frames.length,
    frames: frames.slice(0, 3), // Keep first 3 frames for analysis
    firstFrameSize: frames.length > 0 ? frames[0].totalLen : 0,
    totalAnalyzed: frames.reduce((sum, frame) => sum + frame.totalLen + 4, 0)
  };
}

function classifyApiError(error) {
  if (error.status === 400) return 'Bad Request - Invalid request format';
  if (error.status === 401) return 'Unauthorized - Authentication failed';
  if (error.status === 403) return 'Forbidden - Token invalid or expired';
  if (error.status === 404) return 'Not Found - Endpoint not found';
  if (error.status === 429) return 'Rate Limited - Too many requests';
  if (error.status >= 500) return 'Server Error - Internal server issue';
  if (error.code === 'ECONNREFUSED') return 'Connection Refused - Service not running';
  if (error.code === 'ETIMEDOUT') return 'Timeout - Request took too long';
  return 'Unknown Error';
}

function identifyPossibleCauses(error) {
  const causes = [];
  
  if (error.status === 400) {
    causes.push('Request format doesn\'t match expected Anthropic API structure');
    causes.push('Missing required fields in request body');
    causes.push('Invalid model name or parameters');
  }
  
  if (error.status === 401 || error.status === 403) {
    causes.push('CodeWhisperer token is expired or invalid');
    causes.push('Authentication headers not properly set');
    causes.push('Token doesn\'t have required permissions');
  }
  
  if (error.code === 'ECONNREFUSED') {
    causes.push('Claude Code Router service is not running on port 3456');
    causes.push('Port 3456 is blocked or occupied by another service');
    causes.push('Server failed to start due to configuration issues');
  }
  
  return causes;
}

function generateRecommendations(comparison) {
  const recommendations = [];
  
  if (!comparison.step1Success && comparison.step4Success) {
    recommendations.push('Our system has issues but direct CodeWhisperer works - check request transformation');
    recommendations.push('Verify model mapping and request format conversion');
    recommendations.push('Check authentication token handling in our system');
  }
  
  if (comparison.step1Success && !comparison.step4Success) {
    recommendations.push('Our system works but direct CodeWhisperer fails - check token or network');
    recommendations.push('Verify CodeWhisperer token is valid and not expired');
    recommendations.push('Check network connectivity to AWS CodeWhisperer API');
  }
  
  if (!comparison.step1Success && !comparison.step4Success) {
    recommendations.push('Both systems fail - likely token or network issue');
    recommendations.push('Check if CodeWhisperer token exists and is valid');
    recommendations.push('Verify network connectivity to AWS services');
  }
  
  if (comparison.step1Success && comparison.step4Success) {
    recommendations.push('Both systems work - compare response formats for consistency');
    recommendations.push('Verify response parsing and format conversion is correct');
    recommendations.push('Test with more complex requests (tools, multi-turn conversations)');
  }
  
  return recommendations;
}

// Generate final comparison report
async function generateComparisonReport() {
  console.log('\n📊 Generating Final Comparison Report...');

  const allSteps = {};
  for (let i = 1; i <= 6; i++) {
    try {
      const stepData = JSON.parse(fs.readFileSync(OUTPUT_FILES[`step${i}`], 'utf8'));
      allSteps[`step${i}`] = stepData;
    } catch (error) {
      allSteps[`step${i}`] = { error: `Failed to load step ${i}: ${error.message}` };
    }
  }

  const report = {
    testName: 'Demo2 Six-Step Process Comparison',
    timestamp: new Date().toISOString(),
    testConfig: TEST_CONFIG,
    summary: {
      step1_inputProcessing: allSteps.step1?.data?.success || false,
      step2_routingLogic: allSteps.step2?.data?.success || false,
      step3_requestTransformation: allSteps.step3?.data?.success || false,
      step4_rawApiResponse: allSteps.step4?.data?.success || false,
      step5_parserInput: allSteps.step5?.data?.success || false,
      step6_finalOutput: allSteps.step6?.data?.success || false,
      overallSuccess: Object.values(allSteps).every(step => step.data?.success)
    },
    detailedResults: allSteps,
    finalAnalysis: allSteps.step6?.data?.comparison || {},
    recommendations: allSteps.step6?.data?.recommendations || [],
    outputFiles: OUTPUT_FILES
  };

  fs.writeFileSync(OUTPUT_FILES.comparison, JSON.stringify(report, null, 2));
  
  console.log('📋 Final Report Summary:');
  console.log('========================');
  Object.entries(report.summary).forEach(([step, success]) => {
    const status = success ? '✅' : '❌';
    console.log(`${status} ${step.replace('_', ' ').toUpperCase()}: ${success ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log('\n📝 Recommendations:');
  report.recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });
  
  console.log(`\n📁 Full report saved to: ${OUTPUT_FILES.comparison}`);
  console.log('\n📁 All step outputs saved to:');
  Object.entries(OUTPUT_FILES).forEach(([key, file]) => {
    if (fs.existsSync(file) && key !== 'comparison') {
      console.log(`   ${key}: ${file}`);
    }
  });

  return report;
}

// Main execution
async function main() {
  console.log('🚀 Starting Demo2 Six-Step Process Comparison Test');
  console.log('==================================================');
  console.log('This test replicates demo2 six-step process to identify API 400 errors');
  console.log(`Our system: ${OUR_SYSTEM_URL}`);
  console.log(`CodeWhisperer: ${CODEWHISPERER_URL}`);
  console.log(`Test model: ${TEST_CONFIG.model}`);
  console.log(`Expected CW model: ${TEST_CONFIG.expectedCodeWhispererModel}`);

  try {
    // Execute all steps
    const step1 = await step1_inputProcessing();
    const step2 = await step2_routingLogic(step1);
    const step3 = await step3_requestTransformation(step2);
    const step4 = await step4_rawApiResponse(step3);
    const step5 = await step5_parserInput(step4);
    const step6 = await step6_finalOutput(step5);

    // Generate final report
    const report = await generateComparisonReport();

    console.log('\n🎉 Demo2 Six-Step Process Comparison Test Completed!');
    console.log(`Overall success: ${report.summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);

    process.exit(report.summary.overallSuccess ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  main,
  buildDemo2CodeWhispererRequest,
  DEMO2_MODEL_MAP,
  TEST_CONFIG
};