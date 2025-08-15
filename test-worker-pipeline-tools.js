/**
 * Test Worker Pipeline Tool Processing
 * 测试Worker Pipeline中工具处理的完整流程
 */

// 模拟已经转换好的OpenAI格式请求
const openAIRequest = {
    "model": "gpt-oss-20b-mlx",
    "messages": [
        {
            "role": "user", 
            "content": "Help me create a bash script"
        }
    ],
    "max_tokens": 4000,
    "stream": false,
    "tools": [
        {
            "type": "function",
            "function": {
                "name": "bash",
                "description": "Execute bash commands",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "The bash command to execute"
                        }
                    },
                    "required": ["command"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "edit_file",
                "description": "Edit file contents", 
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Path to the file"
                        },
                        "new_content": {
                            "type": "string",
                            "description": "New file content"
                        }
                    },
                    "required": ["file_path", "new_content"]
                }
            }
        }
    ],
    "tool_choice": "auto",
    "metadata": {
        "requestId": "test-worker-pipeline",
        "providerId": "lmstudio",
        "targetModel": "gpt-oss-20b-mlx"
    }
};

// 测试LM Studio preprocessor对工具的处理
async function testLMStudioPreprocessor() {
    console.log('🧪 Testing LM Studio Preprocessor Tool Processing...\n');
    
    try {
        // 导入LM Studio preprocessor
        const { LMStudioOpenAIPreprocessor } = await import('./dist/v3/server-layer-processor/lmstudio-openai-preprocessor.js');
        
        const config = {
            type: 'openai',
            endpoint: 'http://localhost:1234/v1/chat/completions',
            models: ['gpt-oss-20b-mlx']
        };
        
        const preprocessor = new LMStudioOpenAIPreprocessor(config);
        
        const context = {
            providerId: 'lmstudio',
            targetModel: 'gpt-oss-20b-mlx',
            requestId: 'test-worker-pipeline'
        };
        
        console.log('📥 Input OpenAI Request Tools:');
        openAIRequest.tools.forEach((tool, index) => {
            console.log(`Tool ${index}:`);
            console.log(`  - type: ${tool.type}`);
            console.log(`  - function.name: ${tool.function?.name}`);
            console.log(`  - function.description: ${tool.function?.description}`);
            console.log('');
        });
        
        // 处理请求
        console.log('🔄 Processing request through LM Studio preprocessor...');
        const processedRequest = await preprocessor.processRequest(openAIRequest, context);
        
        console.log('📤 Processed Request Tools:');
        if (processedRequest.tools && Array.isArray(processedRequest.tools)) {
            processedRequest.tools.forEach((tool, index) => {
                console.log(`Tool ${index}:`);
                console.log(`  - type: ${tool.type} ${tool.type === 'function' ? '✅' : '❌'}`);
                console.log(`  - has function object: ${!!tool.function ? '✅' : '❌'}`);
                if (tool.function) {
                    console.log(`  - function.name: ${tool.function.name || 'missing'}`);
                    console.log(`  - function.description: ${tool.function.description || 'missing'}`);
                    console.log(`  - function.parameters: ${!!tool.function.parameters ? '✅' : '❌'}`);
                } else {
                    console.log(`  - Raw tool object:`, JSON.stringify(tool, null, 4));
                }
                console.log('');
            });
            
            // 验证所有工具
            const allToolsValid = processedRequest.tools.every(tool => 
                tool.type === 'function' && 
                tool.function && 
                tool.function.name && 
                tool.function.parameters
            );
            
            console.log(`🎯 Tools After Preprocessing: ${allToolsValid ? '✅ PASS' : '❌ FAIL'}`);
            
            if (!allToolsValid) {
                console.log('❌ LM Studio preprocessor corrupted the tool format!');
                console.log('🔍 This is where the tools are being broken');
                
                // 输出完整的处理后请求用于调试
                console.log('\n📋 Full processed request:');
                console.log(JSON.stringify(processedRequest, null, 2));
                
                process.exit(1);
            } else {
                console.log('✅ LM Studio preprocessor preserved correct tool format');
            }
        } else {
            console.log('❌ No tools found after preprocessing!');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// 运行测试
testLMStudioPreprocessor();