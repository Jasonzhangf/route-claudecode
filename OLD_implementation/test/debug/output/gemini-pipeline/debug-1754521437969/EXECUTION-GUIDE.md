# Universal Pipeline Debug Execution Guide

## 🎯 Session Information
- **Session ID**: debug-1754521437969
- **Pipeline**: gemini-tool-calling
- **Debug Directory**: /Users/fanzhang/Documents/github/claude-code-router/test/debug/output/gemini-pipeline/debug-1754521437969

## 🔧 How to Use Debug Data

### 1. Stage-Specific Data Analysis
Each pipeline stage has its own directory with captured data:

- **input-processing**: Analyze `input-processing/*.json` files for stage-specific issues
- **schema-conversion**: Analyze `schema-conversion/*.json` files for stage-specific issues
- **tool-config-setup**: Analyze `tool-config-setup/*.json` files for stage-specific issues
- **api-request**: Analyze `api-request/*.json` files for stage-specific issues
- **api-response**: Analyze `api-response/*.json` files for stage-specific issues
- **response-processing**: Analyze `response-processing/*.json` files for stage-specific issues
- **output-transformation**: Analyze `output-transformation/*.json` files for stage-specific issues

### 2. Test Matrix Validation
Run the generated test cases:
```bash
node replay/replay-schema-conversion.js  # Test schema conversion
node replay/replay-tool-config-setup.js  # Test tool configuration
```

### 3. Problem Isolation Workflow
1. **Check Input Processing**: Verify Anthropic format is correctly parsed
2. **Schema Conversion**: Ensure input_schema → parameters transformation
3. **Tool Config**: Validate functionCallingConfig setup
4. **API Request**: Check final Gemini API request format
5. **Response Analysis**: Identify MALFORMED_FUNCTION_CALL / UNEXPECTED_TOOL_CALL patterns

### 4. Replay Failed Scenarios
```bash
cd replay/
node replay-full-pipeline.js  # Complete pipeline replay
```

## 🚨 Known Issue Patterns

### MALFORMED_FUNCTION_CALL
- **Root Cause**: Invalid JSON Schema in parameters
- **Check**: `schema-conversion/*.json` for unsupported fields
- **Fix**: Verify cleanJsonSchemaForGemini removes: $schema, additionalProperties, minItems, maxItems

### UNEXPECTED_TOOL_CALL  
- **Root Cause**: Tool configuration mismatch
- **Check**: `tool-config-setup/*.json` for proper functionCallingConfig
- **Fix**: Ensure toolConfig.functionCallingConfig.mode = "AUTO"

## 📊 Data Analysis Commands
```bash
# Find all validation failures
grep -r "passed.*false" . | grep -v node_modules

# Check schema conversion results
cat schema-conversion/*.json | jq '.data.conversions[].validation'

# Analyze API response patterns
cat api-response/*.json | jq '.data.finishReason'
```
