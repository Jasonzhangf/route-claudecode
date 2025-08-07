#!/usr/bin/env node

/**
 * Universal Pipeline Debug Architecture for Gemini Tool Calling
 * 
 * This script implements comprehensive debugging infrastructure for ANY type of pipeline system.
 * Specifically targeting the Gemini tool calling issue with MALFORMED_FUNCTION_CALL and UNEXPECTED_TOOL_CALL errors.
 * 
 * Features:
 * - Universal data capture at each pipeline stage
 * - Hierarchical debug data storage
 * - Stage-specific replay capabilities  
 * - Comprehensive test matrix generation
 * - Problem isolation framework
 * - Schema conversion validation
 * 
 * Author: Jason Zhang
 * Project: Claude Code Output Router v2.7.0
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Universal Debug Configuration
const DEBUG_CONFIG = {
  pipeline_name: 'gemini-tool-calling',
  base_debug_dir: path.join(__dirname, '../debug/output/gemini-pipeline'),
  session_id: `debug-${Date.now()}`,
  enable_detailed_logging: true,
  capture_raw_data: true,
  enable_replay: true,
  stages: [
    'input-processing',     // Stage 1: Anthropic format input validation
    'schema-conversion',    // Stage 2: Anthropic → Gemini schema transformation  
    'tool-config-setup',   // Stage 3: Gemini toolConfig and functionDeclarations
    'api-request',         // Stage 4: Raw Gemini API request
    'api-response',        // Stage 5: Raw Gemini API response  
    'response-processing', // Stage 6: Response parsing and error handling
    'output-transformation' // Stage 7: Final output formatting
  ]
};

class UniversalPipelineDebugger {
  constructor(config = DEBUG_CONFIG) {
    this.config = config;
    this.sessionDir = path.join(config.base_debug_dir, config.session_id);
    this.stageData = new Map();
    this.errors = [];
    this.initializeDebugEnvironment();
  }

  /**
   * Initialize hierarchical debug data storage system
   */
  initializeDebugEnvironment() {
    console.log('\n🚀 Universal Pipeline Debugger Initialized');
    console.log(`📁 Session Directory: ${this.sessionDir}`);
    
    // Create hierarchical directory structure
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    // Create stage-specific subdirectories
    this.config.stages.forEach(stage => {
      const stageDir = path.join(this.sessionDir, stage);
      if (!fs.existsSync(stageDir)) {
        fs.mkdirSync(stageDir, { recursive: true });
      }
    });

    console.log(`✅ Debug environment ready for ${this.config.stages.length} pipeline stages`);
  }

  /**
   * Capture data at any pipeline stage with timestamp and metadata
   */
  captureStageData(stageName, data, metadata = {}) {
    const timestamp = new Date().toISOString();
    const captureData = {
      stage: stageName,
      timestamp,
      sessionId: this.config.session_id,
      data: this.deepClone(data),
      metadata: {
        ...metadata,
        captureSize: JSON.stringify(data).length,
        dataType: typeof data,
        isArray: Array.isArray(data)
      }
    };

    // Store in memory for quick access
    if (!this.stageData.has(stageName)) {
      this.stageData.set(stageName, []);
    }
    this.stageData.get(stageName).push(captureData);

    // Persist to disk for permanence
    const stageDir = path.join(this.sessionDir, stageName);
    const filename = `${stageName}-${Date.now()}.json`;
    const filepath = path.join(stageDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(captureData, null, 2));
    
    if (this.config.enable_detailed_logging) {
      console.log(`📊 Captured ${stageName} data: ${captureData.metadata.captureSize} bytes → ${filename}`);
    }

    return captureData;
  }

  /**
   * Generate comprehensive test matrix for schema conversion validation
   */
  generateTestMatrix() {
    console.log('\n🧪 Generating Universal Test Matrix for Schema Conversion...');
    
    const testCases = {
      // Basic schema conversion tests
      basic_conversion: [
        {
          name: 'simple-string-parameter',
          input: {
            name: 'get_weather',
            description: 'Get weather information',
            input_schema: {
              type: 'object',
              properties: {
                city: { type: 'string', description: 'City name' }
              },
              required: ['city']
            }
          },
          expected_gemini_format: {
            name: 'get_weather',
            description: 'Get weather information',
            parameters: {
              type: 'object',
              properties: {
                city: { type: 'string', description: 'City name' }
              },
              required: ['city']
            }
          }
        },
        {
          name: 'complex-nested-parameters',
          input: {
            name: 'LS',
            description: 'List directory contents',
            input_schema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path' },
                ignore: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Patterns to ignore'
                }
              },
              required: ['path']
            }
          },
          expected_gemini_format: {
            name: 'LS',
            description: 'List directory contents',
            parameters: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path' },
                ignore: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Patterns to ignore'
                }
              },
              required: ['path']
            }
          }
        }
      ],
      
      // Schema cleaning tests (Gemini API compatibility)
      schema_cleaning: [
        {
          name: 'remove-unsupported-fields',
          input: {
            name: 'Read',
            description: 'Read file contents',
            input_schema: {
              type: 'object',
              $schema: 'http://json-schema.org/draft-07/schema#', // Should be removed
              additionalProperties: false, // Should be removed
              properties: {
                file_path: { type: 'string', description: 'File path' }
              },
              required: ['file_path'],
              minItems: 1, // Should be removed
              maxItems: 10 // Should be removed
            }
          },
          expected_cleaned_schema: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'File path' }
            },
            required: ['file_path']
          }
        }
      ],

      // Tool config validation tests
      tool_config: [
        {
          name: 'auto-mode-single-tool',
          tools: [
            {
              name: 'get_weather',
              description: 'Get weather info',
              input_schema: {
                type: 'object',
                properties: { city: { type: 'string' } },
                required: ['city']
              }
            }
          ],
          expected_config: {
            functionCallingConfig: { mode: 'AUTO' }
          }
        },
        {
          name: 'auto-mode-multiple-tools',
          tools: [
            { name: 'get_weather', description: 'Weather', input_schema: { type: 'object', properties: { city: { type: 'string' } } } },
            { name: 'LS', description: 'List files', input_schema: { type: 'object', properties: { path: { type: 'string' } } } },
            { name: 'Read', description: 'Read file', input_schema: { type: 'object', properties: { file_path: { type: 'string' } } } }
          ],
          expected_config: {
            functionCallingConfig: { mode: 'AUTO' }
          }
        }
      ],

      // API request format validation  
      api_request_format: [
        {
          name: 'complete-gemini-request',
          input_message: 'What is the weather in Tokyo?',
          tools: [
            {
              name: 'get_weather',
              description: 'Get weather information',
              input_schema: {
                type: 'object',
                properties: { city: { type: 'string' } },
                required: ['city']
              }
            }
          ],
          expected_structure: {
            contents: 'array',
            tools: 'array_with_functionDeclarations',
            toolConfig: 'object_with_functionCallingConfig',
            generationConfig: 'optional_object'
          }
        }
      ]
    };

    // Save test matrix to disk
    const testMatrixFile = path.join(this.sessionDir, 'test-matrix.json');
    fs.writeFileSync(testMatrixFile, JSON.stringify(testCases, null, 2));
    
    console.log(`✅ Generated ${Object.keys(testCases).length} test categories`);
    console.log(`📄 Test matrix saved to: test-matrix.json`);
    
    return testCases;
  }

  /**
   * Execute stage-specific validation tests
   */
  async runStageValidation(stageName, testData = null) {
    console.log(`\n🔍 Running Stage Validation: ${stageName}`);
    
    switch (stageName) {
      case 'input-processing':
        return this.validateInputProcessing(testData);
      case 'schema-conversion':
        return this.validateSchemaConversion(testData);  
      case 'tool-config-setup':
        return this.validateToolConfigSetup(testData);
      case 'api-request':
        return this.validateApiRequest(testData);
      case 'api-response':
        return this.validateApiResponse(testData);
      default:
        console.log(`⚠️  No specific validation for stage: ${stageName}`);
        return { passed: false, message: 'No validation implemented' };
    }
  }

  /**
   * Validate input processing stage (Anthropic format validation)
   */
  validateInputProcessing(testData) {
    console.log('🔎 Validating Input Processing...');
    
    if (!testData || !testData.tools) {
      return { passed: false, message: 'Missing tools in input data' };
    }

    const validationResults = {
      passed: true,
      issues: [],
      tools: []
    };

    testData.tools.forEach((tool, index) => {
      const toolValidation = {
        index,
        name: tool.name,
        issues: []
      };

      // Check required fields
      if (!tool.name) {
        toolValidation.issues.push('Missing tool name');
        validationResults.passed = false;
      }
      if (!tool.description) {
        toolValidation.issues.push('Missing tool description');
      }
      if (!tool.input_schema) {
        toolValidation.issues.push('Missing input_schema');
        validationResults.passed = false;
      }

      // Check schema structure
      if (tool.input_schema && tool.input_schema.type !== 'object') {
        toolValidation.issues.push('input_schema must be type "object"');
      }

      validationResults.tools.push(toolValidation);
    });

    this.captureStageData('input-processing', validationResults, { 
      testType: 'validation',
      toolCount: testData.tools?.length || 0 
    });

    return validationResults;
  }

  /**
   * Validate schema conversion stage (Critical for MALFORMED_FUNCTION_CALL fix)
   */
  validateSchemaConversion(testData) {
    console.log('🔧 Validating Schema Conversion (Critical for MALFORMED_FUNCTION_CALL)...');
    
    if (!testData || !testData.tools) {
      return { passed: false, message: 'No tools to convert' };
    }

    const results = {
      passed: true,
      conversions: [],
      errors: []
    };

    testData.tools.forEach(tool => {
      try {
        // Simulate the actual convertTools method logic
        const converted = this.simulateConvertTools([tool]);
        const validation = this.validateGeminiSchema(converted);
        
        results.conversions.push({
          original: tool,
          converted: converted,
          validation: validation
        });

        if (!validation.passed) {
          results.passed = false;
          results.errors.push(`Tool ${tool.name}: ${validation.message}`);
        }

      } catch (error) {
        results.passed = false;
        results.errors.push(`Tool ${tool.name}: ${error.message}`);
      }
    });

    this.captureStageData('schema-conversion', results, {
      testType: 'conversion_validation',
      toolCount: testData.tools.length
    });

    return results;
  }

  /**
   * Simulate the actual convertTools method from Gemini client
   */
  simulateConvertTools(tools) {
    const functionDeclarations = tools.map(tool => {
      let name = tool.name;
      let description = tool.description || '';
      let rawParameters = tool.input_schema || {};

      // Clean schema for Gemini API compatibility (this is where bugs often occur)
      const parameters = this.cleanJsonSchemaForGemini(rawParameters);

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
   * Clean JSON Schema for Gemini API compatibility (replica of actual method)
   */
  cleanJsonSchemaForGemini(schema) {
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
            cleaned[key][propKey] = this.cleanJsonSchemaForGemini(propValue);
          }
        } else if (key === 'items' && typeof value === 'object') {
          cleaned[key] = this.cleanJsonSchemaForGemini(value);
        } else {
          cleaned[key] = value;
        }
      }
    }

    return cleaned;
  }

  /**
   * Validate converted schema meets Gemini API requirements
   */
  validateGeminiSchema(convertedTools) {
    if (!convertedTools.functionDeclarations) {
      return { passed: false, message: 'Missing functionDeclarations' };
    }

    if (!Array.isArray(convertedTools.functionDeclarations)) {
      return { passed: false, message: 'functionDeclarations must be array' };
    }

    for (const func of convertedTools.functionDeclarations) {
      if (!func.name) {
        return { passed: false, message: 'Function missing name' };
      }
      if (!func.description) {
        return { passed: false, message: `Function ${func.name} missing description` };
      }
      if (!func.parameters) {
        return { passed: false, message: `Function ${func.name} missing parameters` };
      }
      
      // Validate parameters schema structure
      const paramValidation = this.validateParametersSchema(func.parameters);
      if (!paramValidation.passed) {
        return { passed: false, message: `Function ${func.name}: ${paramValidation.message}` };
      }
    }

    return { passed: true, message: 'Schema validation passed' };
  }

  /**
   * Validate parameters schema structure for Gemini compatibility
   */
  validateParametersSchema(params) {
    if (typeof params !== 'object') {
      return { passed: false, message: 'Parameters must be object' };
    }

    if (params.type && params.type !== 'object') {
      return { passed: false, message: 'Parameters type must be "object"' };
    }

    // Check for unsupported fields that could cause MALFORMED_FUNCTION_CALL
    const unsupportedFields = ['$schema', 'additionalProperties', 'minItems', 'maxItems', 'minLength', 'maxLength'];
    for (const field of unsupportedFields) {
      if (params.hasOwnProperty(field)) {
        return { passed: false, message: `Unsupported field in schema: ${field}` };
      }
    }

    return { passed: true, message: 'Parameters schema valid' };
  }

  /**
   * Validate tool config setup stage
   */
  validateToolConfigSetup(testData) {
    console.log('⚙️  Validating Tool Config Setup...');
    
    const results = {
      passed: true,
      config: null,
      issues: []
    };

    if (!testData || !testData.tools || testData.tools.length === 0) {
      results.passed = false;
      results.issues.push('No tools provided for config setup');
      return results;
    }

    // Simulate toolConfig creation (based on actual Gemini client logic)
    results.config = {
      functionCallingConfig: {
        mode: "AUTO"
      }
    };

    // Validate config structure
    if (!results.config.functionCallingConfig) {
      results.passed = false;
      results.issues.push('Missing functionCallingConfig');
    }

    if (results.config.functionCallingConfig.mode !== 'AUTO') {
      results.passed = false;
      results.issues.push('Mode should be AUTO for tool calling');
    }

    this.captureStageData('tool-config-setup', results, {
      testType: 'config_validation',
      toolCount: testData.tools.length
    });

    return results;
  }

  /**
   * Validate API request format
   */
  validateApiRequest(requestData) {
    console.log('📡 Validating API Request Format...');
    
    const results = {
      passed: true,
      structure: {},
      issues: []
    };

    // Check required fields for Gemini API request
    const requiredFields = ['contents'];
    const optionalFields = ['tools', 'toolConfig', 'generationConfig'];

    requiredFields.forEach(field => {
      if (!requestData.hasOwnProperty(field)) {
        results.passed = false;
        results.issues.push(`Missing required field: ${field}`);
      } else {
        results.structure[field] = typeof requestData[field];
      }
    });

    optionalFields.forEach(field => {
      if (requestData.hasOwnProperty(field)) {
        results.structure[field] = typeof requestData[field];
      }
    });

    // Validate tools array structure specifically
    if (requestData.tools) {
      if (!Array.isArray(requestData.tools)) {
        results.passed = false;
        results.issues.push('tools must be array');
      } else if (requestData.tools.length > 0) {
        const firstTool = requestData.tools[0];
        if (!firstTool.functionDeclarations) {
          results.passed = false;
          results.issues.push('tools[0] missing functionDeclarations');
        }
      }
    }

    this.captureStageData('api-request', results, {
      testType: 'request_validation',
      hasTools: !!requestData.tools
    });

    return results;
  }

  /**
   * Validate API response and identify error patterns
   */
  validateApiResponse(responseData) {
    console.log('📥 Validating API Response...');
    
    const results = {
      passed: true,
      finishReason: null,
      hasContent: false,
      errorType: null,
      issues: []
    };

    if (!responseData) {
      results.passed = false;
      results.issues.push('No response data');
      return results;
    }

    // Extract finish reason (key indicator of tool calling issues)
    if (responseData.candidates && responseData.candidates[0]) {
      const candidate = responseData.candidates[0];
      results.finishReason = candidate.finishReason;
      results.hasContent = !!(candidate.content && candidate.content.parts && candidate.content.parts.length > 0);

      // Identify specific error patterns
      if (candidate.finishReason === 'MALFORMED_FUNCTION_CALL') {
        results.passed = false;
        results.errorType = 'MALFORMED_FUNCTION_CALL';
        results.issues.push('Tool schema format is invalid for Gemini API');
      } else if (candidate.finishReason === 'UNEXPECTED_TOOL_CALL') {
        results.passed = false;
        results.errorType = 'UNEXPECTED_TOOL_CALL';
        results.issues.push('Tool configuration mismatch - Gemini did not expect tool calls');
      }
    }

    this.captureStageData('api-response', results, {
      testType: 'response_validation',
      finishReason: results.finishReason
    });

    return results;
  }

  /**
   * Execute complete pipeline test with real data
   */
  async runCompletePipelineTest() {
    console.log('\n🚀 Running Complete Pipeline Test...');
    
    const testData = {
      message: 'What is the weather in Tokyo? Also list the files in the current directory.',
      tools: [
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
        },
        {
          name: 'LS',
          description: 'List files and directories',
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path' },
              ignore: { type: 'array', items: { type: 'string' } }
            },
            required: ['path']
          }
        }
      ]
    };

    console.log('📊 Testing with real data:');
    console.log(`  - Tools: ${testData.tools.map(t => t.name).join(', ')}`);
    console.log(`  - Message: ${testData.message}`);

    const results = {
      stages: {},
      overall_passed: true,
      critical_errors: []
    };

    // Run through each pipeline stage
    for (const stage of this.config.stages) {
      console.log(`\n⏯️  Testing Stage: ${stage}`);
      
      try {
        const stageResult = await this.runStageValidation(stage, testData);
        results.stages[stage] = stageResult;
        
        if (!stageResult.passed) {
          results.overall_passed = false;
          results.critical_errors.push(`${stage}: ${stageResult.message || 'Validation failed'}`);
        }
        
        console.log(`   ${stageResult.passed ? '✅' : '❌'} ${stage}: ${stageResult.passed ? 'PASSED' : 'FAILED'}`);
        
      } catch (error) {
        results.stages[stage] = { passed: false, error: error.message };
        results.overall_passed = false;
        results.critical_errors.push(`${stage}: ${error.message}`);
        console.log(`   ❌ ${stage}: ERROR - ${error.message}`);
      }
    }

    // Save complete test results
    const resultsFile = path.join(this.sessionDir, 'complete-pipeline-test-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

    console.log(`\n📊 Complete Pipeline Test Results:`);
    console.log(`   Overall Status: ${results.overall_passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Stages Tested: ${Object.keys(results.stages).length}`);
    console.log(`   Critical Errors: ${results.critical_errors.length}`);
    
    if (results.critical_errors.length > 0) {
      console.log(`\n🚨 Critical Errors Found:`);
      results.critical_errors.forEach(error => console.log(`   - ${error}`));
    }

    return results;
  }

  /**
   * Generate problem isolation report
   */
  generateProblemIsolationReport() {
    console.log('\n🔍 Generating Problem Isolation Report...');
    
    const report = {
      session_id: this.config.session_id,
      timestamp: new Date().toISOString(),
      pipeline_name: this.config.pipeline_name,
      captured_stages: Array.from(this.stageData.keys()),
      total_captures: Array.from(this.stageData.values()).reduce((sum, captures) => sum + captures.length, 0),
      analysis: {
        likely_root_causes: [],
        recommended_fixes: [],
        validation_failures: []
      }
    };

    // Analyze captured data for patterns
    this.stageData.forEach((captures, stageName) => {
      captures.forEach(capture => {
        if (capture.data.passed === false) {
          report.analysis.validation_failures.push({
            stage: stageName,
            issues: capture.data.issues || [capture.data.message],
            timestamp: capture.timestamp
          });
        }
      });
    });

    // Generate specific recommendations based on Gemini tool calling issues
    report.analysis.likely_root_causes = [
      'Schema conversion from Anthropic input_schema to Gemini parameters format',
      'Unsupported JSON Schema fields causing MALFORMED_FUNCTION_CALL',
      'Tool configuration mismatch in functionCallingConfig',
      'Missing or incorrect functionDeclarations structure'
    ];

    report.analysis.recommended_fixes = [
      'Verify cleanJsonSchemaForGemini removes all unsupported fields',
      'Ensure parameters schema uses only: type, properties, required, items, description, enum',
      'Validate toolConfig.functionCallingConfig.mode is set to AUTO',
      'Check tools array contains single object with functionDeclarations array',
      'Test schema conversion with real Gemini API validation endpoint'
    ];

    const reportFile = path.join(this.sessionDir, 'problem-isolation-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📄 Problem isolation report saved: problem-isolation-report.json`);
    console.log(`📊 Analysis Summary:`);
    console.log(`   - Captured Stages: ${report.captured_stages.length}`);
    console.log(`   - Total Data Points: ${report.total_captures}`);
    console.log(`   - Validation Failures: ${report.analysis.validation_failures.length}`);
    
    return report;
  }

  /**
   * Generate replay scripts for reproducing issues
   */
  generateReplayScripts() {
    console.log('\n🎬 Generating Replay Scripts...');
    
    const replayDir = path.join(this.sessionDir, 'replay');
    if (!fs.existsSync(replayDir)) {
      fs.mkdirSync(replayDir);
    }

    // Generate individual stage replay scripts
    this.config.stages.forEach(stage => {
      const replayScript = this.createStageReplayScript(stage);
      const scriptFile = path.join(replayDir, `replay-${stage}.js`);
      fs.writeFileSync(scriptFile, replayScript);
    });

    // Generate complete pipeline replay script
    const fullReplayScript = this.createFullPipelineReplayScript();
    const fullScriptFile = path.join(replayDir, 'replay-full-pipeline.js');
    fs.writeFileSync(fullScriptFile, fullReplayScript);

    console.log(`🎬 Generated ${this.config.stages.length + 1} replay scripts in ./replay/`);
    
    return replayDir;
  }

  createStageReplayScript(stageName) {
    return `#!/usr/bin/env node
/**
 * Replay Script for ${stageName} Stage
 * Generated by Universal Pipeline Debugger
 */

const fs = require('fs');
const path = require('path');

async function replay${stageName.replace(/-/g, '')}() {
  console.log('🎬 Replaying ${stageName} stage...');
  
  // Load captured data
  const dataFiles = fs.readdirSync(path.join(__dirname, '../${stageName}'))
    .filter(f => f.endsWith('.json'))
    .sort();
  
  for (const file of dataFiles) {
    const filePath = path.join(__dirname, '../${stageName}', file);
    const capturedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(\`📊 Replaying: \${file}\`);
    console.log(\`   Timestamp: \${capturedData.timestamp}\`);
    console.log(\`   Data Size: \${capturedData.metadata.captureSize} bytes\`);
    
    // Add stage-specific replay logic here
    await replayStageData(capturedData);
  }
}

async function replayStageData(capturedData) {
  // Implement stage-specific replay logic
  console.log('🔄 Processing captured data...');
  console.log(JSON.stringify(capturedData.data, null, 2));
}

if (require.main === module) {
  replay${stageName.replace(/-/g, '')}().catch(console.error);
}

module.exports = { replay${stageName.replace(/-/g, '')} };
`;
  }

  createFullPipelineReplayScript() {
    return `#!/usr/bin/env node
/**
 * Complete Pipeline Replay Script
 * Generated by Universal Pipeline Debugger
 */

const fs = require('fs');
const path = require('path');

const stages = ${JSON.stringify(this.config.stages, null, 2)};

async function replayFullPipeline() {
  console.log('🚀 Replaying Complete Pipeline...');
  
  for (const stage of stages) {
    console.log(\`\n⏯️  Replaying Stage: \${stage}\`);
    
    try {
      const { [\`replay\${stage.replace(/-/g, '')}\`]: replayFunc } = require(\`./replay-\${stage}.js\`);
      await replayFunc();
      console.log(\`✅ \${stage} replay completed\`);
    } catch (error) {
      console.error(\`❌ \${stage} replay failed:\`, error.message);
    }
  }
  
  console.log('\\n🎬 Full pipeline replay completed');
}

if (require.main === module) {
  replayFullPipeline().catch(console.error);
}

module.exports = { replayFullPipeline };
`;
  }

  /**
   * Deep clone object to avoid reference issues
   */
  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Generate execution guidance documentation
   */
  generateExecutionGuide() {
    const guide = `# Universal Pipeline Debug Execution Guide

## 🎯 Session Information
- **Session ID**: ${this.config.session_id}
- **Pipeline**: ${this.config.pipeline_name}
- **Debug Directory**: ${this.sessionDir}

## 🔧 How to Use Debug Data

### 1. Stage-Specific Data Analysis
Each pipeline stage has its own directory with captured data:

${this.config.stages.map(stage => `- **${stage}**: Analyze \`${stage}/*.json\` files for stage-specific issues`).join('\n')}

### 2. Test Matrix Validation
Run the generated test cases:
\`\`\`bash
node replay/replay-schema-conversion.js  # Test schema conversion
node replay/replay-tool-config-setup.js  # Test tool configuration
\`\`\`

### 3. Problem Isolation Workflow
1. **Check Input Processing**: Verify Anthropic format is correctly parsed
2. **Schema Conversion**: Ensure input_schema → parameters transformation
3. **Tool Config**: Validate functionCallingConfig setup
4. **API Request**: Check final Gemini API request format
5. **Response Analysis**: Identify MALFORMED_FUNCTION_CALL / UNEXPECTED_TOOL_CALL patterns

### 4. Replay Failed Scenarios
\`\`\`bash
cd replay/
node replay-full-pipeline.js  # Complete pipeline replay
\`\`\`

## 🚨 Known Issue Patterns

### MALFORMED_FUNCTION_CALL
- **Root Cause**: Invalid JSON Schema in parameters
- **Check**: \`schema-conversion/*.json\` for unsupported fields
- **Fix**: Verify cleanJsonSchemaForGemini removes: $schema, additionalProperties, minItems, maxItems

### UNEXPECTED_TOOL_CALL  
- **Root Cause**: Tool configuration mismatch
- **Check**: \`tool-config-setup/*.json\` for proper functionCallingConfig
- **Fix**: Ensure toolConfig.functionCallingConfig.mode = "AUTO"

## 📊 Data Analysis Commands
\`\`\`bash
# Find all validation failures
grep -r "passed.*false" . | grep -v node_modules

# Check schema conversion results
cat schema-conversion/*.json | jq '.data.conversions[].validation'

# Analyze API response patterns
cat api-response/*.json | jq '.data.finishReason'
\`\`\`
`;

    const guideFile = path.join(this.sessionDir, 'EXECUTION-GUIDE.md');
    fs.writeFileSync(guideFile, guide);
    
    console.log('📋 Execution guide generated: EXECUTION-GUIDE.md');
    return guide;
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🚀 Universal Pipeline Debug Architecture for Gemini Tool Calling');
  console.log('================================================================================');
  
  try {
    // Initialize debugger
    const pipelineDebugger = new UniversalPipelineDebugger();
    
    // Generate test matrix
    const testMatrix = pipelineDebugger.generateTestMatrix();
    
    // Run complete pipeline test
    const pipelineResults = await pipelineDebugger.runCompletePipelineTest();
    
    // Generate problem isolation report
    const problemReport = pipelineDebugger.generateProblemIsolationReport();
    
    // Generate replay scripts
    const replayDir = pipelineDebugger.generateReplayScripts();
    
    // Generate execution guide
    const guide = pipelineDebugger.generateExecutionGuide();
    
    console.log('\n🎯 Universal Pipeline Debug Session Complete!');
    console.log('================================================================================');
    console.log(`📁 Session Directory: ${pipelineDebugger.sessionDir}`);
    console.log(`🧪 Test Matrix: Generated ${Object.keys(testMatrix).length} test categories`);
    console.log(`📊 Pipeline Test: ${pipelineResults.overall_passed ? 'PASSED' : 'FAILED'} (${Object.keys(pipelineResults.stages).length} stages)`);
    console.log(`🔍 Problem Report: ${problemReport.analysis.validation_failures.length} validation failures found`);
    console.log(`🎬 Replay Scripts: Generated in ${path.basename(replayDir)}/`);
    console.log(`📋 Execution Guide: Available in session directory`);
    
    if (!pipelineResults.overall_passed) {
      console.log('\n🚨 CRITICAL ISSUES FOUND:');
      pipelineResults.critical_errors.forEach(error => console.log(`   - ${error}`));
      console.log('\n📋 Next Steps:');
      console.log('   1. Review problem-isolation-report.json for detailed analysis');
      console.log('   2. Run stage-specific replay scripts to reproduce issues');
      console.log('   3. Focus on schema-conversion and tool-config-setup stages');
      console.log('   4. Test fixes with replay-full-pipeline.js');
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Debug session failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { UniversalPipelineDebugger };