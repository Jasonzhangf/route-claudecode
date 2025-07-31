# Model Name Pipeline Debug Test

## Test Purpose
Comprehensive test to trace model name transformations through the entire Claude Code Router pipeline and identify where the model name conversion issue occurs.

## Test Objective
Verify that original model names are preserved in final responses and identify any points in the pipeline where model names are incorrectly converted.

## Most Recent Execution

**Date**: 2025-07-31  
**Status**: Ready for execution  
**Duration**: N/A (not yet run)  
**Log File**: `/tmp/test-model-name-debug.log`

## Test Scenarios

### 1. Default Routing (claude-sonnet-4-20250514)
- **Category**: default
- **Expected Provider**: codewhisperer-primary
- **Expected Target Model**: CLAUDE_SONNET_4_20250514_V1_0
- **Expected Final Model**: claude-sonnet-4-20250514

### 2. Background Routing (claude-3-5-haiku-20241022)
- **Category**: background
- **Expected Provider**: shuaihong-openai
- **Expected Target Model**: gemini-2.5-flash
- **Expected Final Model**: claude-3-5-haiku-20241022

### 3. Search Tools Routing
- **Category**: search
- **Expected Provider**: shuaihong-openai
- **Expected Target Model**: gemini-2.5-flash
- **Expected Final Model**: claude-sonnet-4-20250514

### 4. Long Context Routing
- **Category**: longcontext
- **Expected Provider**: shuaihong-openai
- **Expected Target Model**: gemini-2.5-pro
- **Expected Final Model**: claude-3-5-sonnet-20241022

### 5. Streaming Response Test
- **Category**: background (streaming)
- **Expected Provider**: shuaihong-openai
- **Expected Target Model**: gemini-2.5-flash
- **Expected Final Model**: claude-3-5-haiku-20241022

## Validation Points

Each test validates:
1. **Model Name Preservation**: Original request model == Final response model
2. **Pipeline Stage Tracking**: Model names at each pipeline stage
3. **Debug Data Capture**: Complete pipeline data saved for analysis
4. **Issue Identification**: Specific stage where model name conversion fails

## Debug Data Output

All debug data is saved to: `~/.route-claude-code/database/test-sessions/`

Each test creates:
- JSON file with complete pipeline data
- Model name analysis results
- Issue identification if present

## Execution Instructions

```bash
# Run the comprehensive debug test
node /Users/fanzhang/Documents/github/claude-code-router/test/debug/test-model-name-pipeline-debug.js

# View results
cat /tmp/test-model-name-debug.log

# Check debug data
ls -la ~/.route-claude-code/database/test-sessions/
```

## Expected Results

**SUCCESS**: All 5 tests pass with model names preserved correctly  
**FAILURE**: Any test shows model name mismatch indicating pipeline issue

## Known Issues

Based on current pipeline analysis:
- CodeWhisperer provider authentication failures preventing successful test execution
- Streaming response model name handling requires verification
- Provider blacklisting may affect test results

## Related Files

- **Test Script**: `/Users/fanzhang/Documents/github/claude-code-router/test/debug/test-model-name-pipeline-debug.js`
- **Debug Infrastructure**: `/Users/fanzhang/Documents/github/claude-code-router/src/debug/model-name-tracer.ts`
- **Problem Isolation**: `/Users/fanzhang/Documents/github/claude-code-router/src/debug/problem-isolation.ts`
- **Pipeline Replay**: `/Users/fanzhang/Documents/github/claude-code-router/src/debug/pipeline-replay.ts`

## Integration Status

Debug hooks have been integrated into:
- ✅ Server.ts (input processing, routing, provider requests, streaming, output processing)
- ✅ Model name tracer activated with --debug flag
- ✅ Comprehensive data capture system
- ✅ Replay and problem isolation frameworks

## Next Steps

1. Execute the debug test to identify current status
2. Analyze captured debug data for model name conversion issues
3. Use problem isolation framework to pinpoint exact failure stage
4. Apply targeted fixes based on isolation results
5. Validate fixes using replay system