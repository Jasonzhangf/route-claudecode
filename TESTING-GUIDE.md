# How to Test Individual Providers with RCC v4.0

This document explains how to use the separate pipeline test cases for each provider in the RCC v4.0 system.

## Overview

The RCC v4.0 system supports multiple AI providers through separate pipelines. This setup allows you to test each provider individually using the same tool call request ("list files in this project") in Anthropic format that can be recognized by Claude Code.

## Available Providers

1. **Qwen** - Alibaba's Qwen models
2. **Shuaihong** - Shuaihong AI platform
3. **ModelScope** - ModelScope platform
4. **LM Studio** - Local LM Studio server

## Test Files

The following test files have been created for each provider:

- `qwen-test-request.json` - Test request for Qwen provider
- `shuaihong-test-request.json` - Test request for Shuaihong provider
- `modelscope-test-request.json` - Test request for ModelScope provider
- `lmstudio-test-request.json` - Test request for LM Studio provider

Each file contains the same tool call request in Anthropic format:

```json
{
  "model": "default",
  "messages": [
    {
      "role": "user",
      "content": "列出本项目下文件列表"
    }
  ],
  "tools": [
    {
      "name": "list_files",
      "description": "列出指定目录下的文件",
      "input_schema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "要列出文件的目录路径"
          }
        },
        "required": ["path"]
      }
    }
  ]
}
```

## Automated Testing Script

An automated testing script `test-individual-providers.sh` has been created to test all providers sequentially:

```bash
chmod +x test-individual-providers.sh
./test-individual-providers.sh
```

This script will:
1. Start each provider's server on a specific port
2. Send the test request using curl
3. Display the response
4. Stop the server
5. Move to the next provider

## Manual Testing

You can also test each provider manually using curl commands:

### Start Server
```bash
# For Qwen (port 5507)
rcc4 start --config config/config.json --port 5507

# For Shuaihong (port 5508)
rcc4 start --config config/config.json --port 5508

# For ModelScope (port 5509)
rcc4 start --config config/config.json --port 5509

# For LM Studio (port 5510)
rcc4 start --config config/config.json --port 5510
```

### Send Test Request
```bash
# Test Qwen
curl -X POST http://localhost:5507/v1/messages \
  -H "Authorization: Bearer rcc4-proxy-key" \
  -H "Content-Type: application/json" \
  -d @qwen-test-request.json

# Test Shuaihong
curl -X POST http://localhost:5508/v1/messages \
  -H "Authorization: Bearer rcc4-proxy-key" \
  -H "Content-Type: application/json" \
  -d @shuaihong-test-request.json

# Test ModelScope
curl -X POST http://localhost:5509/v1/messages \
  -H "Authorization: Bearer rcc4-proxy-key" \
  -H "Content-Type: application/json" \
  -d @modelscope-test-request.json

# Test LM Studio
curl -X POST http://localhost:5510/v1/messages \
  -H "Authorization: Bearer rcc4-proxy-key" \
  -H "Content-Type: application/json" \
  -d @lmstudio-test-request.json
```

## Expected Pipeline Flow

For each provider, the request follows this pipeline flow:

1. **Router Layer**: Maps the model category to the specific provider and model
2. **Transformer Layer**: Converts Anthropic format to OpenAI format
3. **Protocol Layer**: Sets the specific model name for the provider
4. **Server Compatibility Layer**: Applies provider-specific formatting
5. **Server Layer**: Calls the provider's API endpoint
6. **Response Transformer**: Converts OpenAI response back to Anthropic format

## Expected Response Format

All providers should return a response in Anthropic format that Claude Code can recognize:

```json
{
  "id": "msg_0123456789",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "我将帮您列出项目文件。"
    },
    {
      "type": "tool_use",
      "id": "toolu_0123456789",
      "name": "list_files",
      "input": {
        "path": "."
      }
    }
  ],
  "model": "rcc4-router",
  "stop_reason": "tool_use",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 100,
    "output_tokens": 50
  }
}
```

## Troubleshooting

1. **Server fails to start**: Check that the provider's API endpoint is accessible and the API key is valid
2. **Authentication errors**: Verify the API keys in `config/config.json`
3. **Model not found**: Check that the specified model is available and not blacklisted
4. **Connection timeouts**: Ensure the provider's server is running and accessible

## Notes

- The test requests use the "default" model category which will be routed according to the routing rules in `config/config.json`
- For testing specific models, you can modify the "model" field in the test request files
- The tool call requests are designed to be recognized by Claude Code for file listing operations