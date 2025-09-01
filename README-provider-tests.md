# Provider Pipeline Test Suite

## Overview

This directory contains comprehensive test configurations for all four supported providers in RCC4:
- **Shuaihong AI**: Multi-model provider with Gemini, GPT, and Claude models
- **ModelScope**: Alibaba's model platform with GLM and Qwen models  
- **Qwen**: DashScope API with latest Qwen3 models
- **LM Studio**: Local inference server with open-source models

## Test Files

### Individual Provider Tests
- `shuaihong-pipeline-test.json` - ShuaiHong provider configuration and test
- `modelscope-pipeline-test.json` - ModelScope provider configuration and test
- `qwen-pipeline-test.json` - Qwen provider configuration and test
- `lmstudio-pipeline-test.json` - LM Studio provider configuration and test

### Unified Configuration
- `multi-provider-pipeline-test.json` - Master test configuration for all providers

## Test Specifications

Each test validates:
1. **Tool Calling**: Models should invoke `list_files` function
2. **OpenAI Format**: Requests/responses follow OpenAI tool calling format
3. **File Listing**: Expected to list project directory contents
4. **Parameter Handling**: Proper path parameter usage

## Provider Details

### Shuaihong AI
- **Endpoint**: `http://ai.shuaihong.xyz:3939/v1/chat/completions`
- **Model**: `gemini-2.5-pro`
- **Features**: Multi-model support, long context, multimodal

### ModelScope  
- **Endpoint**: `https://api-inference.modelscope.cn/v1/chat/completions`
- **Model**: `ZhipuAI/GLM-4.5`
- **Features**: Programming-focused, long context

### Qwen
- **Endpoint**: `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- **Model**: `qwen3-coder-plus`
- **Features**: Coding specialist, ultra-long context

### LM Studio
- **Endpoint**: `http://localhost:1234/v1/chat/completions`
- **Model**: `gpt-oss-20b-mlx`
- **Features**: Local inference, privacy-focused

## Security Notes

⚠️ **Important**: All test files contain real API keys and are excluded from git via `.gitignore`:
- `*-pipeline-test.json`
- `*-test-case.json`  
- `multi-provider-pipeline-test.json`
- `pipeline-test-report.json`

## Usage

### Manual Testing
```bash
# Test individual provider
curl -X POST "http://ai.shuaihong.xyz:3939/v1/chat/completions" \
  -H "Authorization: Bearer sk-g4hBumofoYFvLjLivj9uxeIYUR5uE3he2twZERTextAgsXPl" \
  -H "Content-Type: application/json" \
  -d @shuaihong-pipeline-test.json
```

### Expected Response
Each test should return:
- `tool_calls` array with `list_files` function call
- Function arguments containing `path: "."` or similar
- Response in OpenAI tool calling format

## Integration with RCC4

These tests validate the six-layer pipeline architecture:
1. **Client** → Anthropic format input
2. **Router** → Provider selection  
3. **Transformer** → Anthropic → OpenAI conversion
4. **Protocol** → OpenAI format processing
5. **ServerCompatibility** → Provider-specific adjustments
6. **Server** → HTTP API calls
7. **ResponseTransformer** → OpenAI → Anthropic conversion

## Next Steps

1. Run individual provider tests to validate connectivity
2. Integrate with RCC4 pipeline system for end-to-end testing
3. Monitor tool calling accuracy across providers
4. Performance benchmarking for response times