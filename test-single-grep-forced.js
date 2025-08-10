#!/usr/bin/env node

/**
 * 单独测试grep强制工具调用
 * Project Owner: Jason Zhang
 */

const axios = require('axios');

const LM_STUDIO_PORT = 5506;

// 单个grep工具调用测试
const grepTestCase = {
    category: "搜索功能",
    name: "grep-character-forced",
    message: "使用grep搜索包含'character'的行",
    expectedTool: "grep",
    priority: "高"
};

const commonTools = [
    {
        name: "bash",
        description: "Execute shell commands",
        input_schema: {
            type: "object",
            properties: {
                command: { type: "string", description: "Shell command to execute" },
                description: { type: "string", description: "Description of what the command does" }
            },
            required: ["command"]
        }
    },
    {
        name: "grep",
        description: "Search for patterns in files using ripgrep",
        input_schema: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "The regex pattern to search for" },
                path: { type: "string", description: "Directory or file to search in" },
                glob: { type: "string", description: "File pattern to match (e.g., '*.ts')" },
                output_mode: { type: "string", description: "Output mode: content/files_with_matches/count" },
                "-i": { type: "boolean", description: "Case insensitive search" },
                "-C": { type: "number", description: "Lines of context to show" },
                "-n": { type: "boolean", description: "Show line numbers" }
            },
            required: ["pattern"]
        }
    },
    {
        name: "read",
        description: "Read file contents from the filesystem",
        input_schema: {
            type: "object", 
            properties: {
                file_path: { type: "string", description: "Absolute path to the file to read" },
                limit: { type: "number", description: "Number of lines to read" },
                offset: { type: "number", description: "Starting line number" }
            },
            required: ["file_path"]
        }
    },
    {
        name: "ls", 
        description: "List directory contents",
        input_schema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory path to list (must be absolute)" },
                ignore: { type: "array", items: { type: "string" }, description: "Glob patterns to ignore" }
            },
            required: ["path"]
        }
    }
];

async function testSingleGrep() {
    console.log('🧪 测试强制grep工具调用');
    console.log(`📝 测试消息: "${grepTestCase.message}"`);
    
    const requestBody = {
        model: "gpt-oss-20b-mlx",
        messages: [
            {
                role: "user",
                content: grepTestCase.message
            }
        ],
        tools: commonTools,
        max_tokens: 1024,
        temperature: 0.1
    };
    
    try {
        const startTime = Date.now();
        const response = await axios.post(`http://localhost:${LM_STUDIO_PORT}/v1/messages`, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer any-key'
            },
            timeout: 30000
        });
        const responseTime = Date.now() - startTime;
        
        console.log('📊 Response received:', {
            responseTime,
            statusCode: response.status,
            hasContent: !!response.data.content,
            contentBlocks: response.data.content?.length || 0
        });
        
        // 详细分析响应
        if (response.data.content) {
            response.data.content.forEach((block, index) => {
                console.log(`📝 Content Block ${index + 1}:`, {
                    type: block.type,
                    name: block.name,
                    id: block.id,
                    hasText: !!block.text,
                    textPreview: block.text?.substring(0, 100) + '...'
                });
                
                if (block.type === 'tool_use') {
                    console.log('🎯 Tool Call Detected:', {
                        toolName: block.name,
                        toolId: block.id,
                        inputParams: Object.keys(block.input || {})
                    });
                }
            });
        }
        
        console.log('📋 Stop Reason:', response.data.stop_reason);
        
        // 检查是否成功
        const toolUseBlocks = response.data.content?.filter(block => block.type === 'tool_use') || [];
        const hasGrepCall = toolUseBlocks.some(block => block.name === 'grep');
        
        if (hasGrepCall) {
            console.log('✅ SUCCESS: Grep tool call detected!');
        } else {
            console.log('❌ FAILURE: No grep tool call found');
            if (toolUseBlocks.length > 0) {
                console.log('🔄 Other tools called:', toolUseBlocks.map(b => b.name));
            } else {
                console.log('📝 Text-only response detected');
            }
        }
        
    } catch (error) {
        console.error('💥 Test failed:', {
            message: error.message,
            status: error.response?.status,
            timeout: error.code === 'ECONNABORTED'
        });
    }
}

testSingleGrep();