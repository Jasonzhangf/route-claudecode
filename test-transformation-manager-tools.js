/**
 * Test Transformation Manager Tool Processing
 * 测试Transformation Manager是否正确处理工具转换
 */

// 模拟完整的Anthropic请求（包含工具）
const anthropicRequest = {
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 4000,
    "messages": [
        {
            "role": "user",
            "content": "Help me create a simple bash script"
        }
    ],
    "tools": [
        {
            "name": "bash",
            "description": "Execute bash commands",
            "input_schema": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The bash command to execute"
                    }
                },
                "required": ["command"]
            }
        },
        {
            "name": "edit_file", 
            "description": "Edit file contents",
            "input_schema": {
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
    ]
};

const transformationContext = {
    requestId: 'test-manager-request-id',
    provider: 'openai'  // This should trigger OpenAI transformation
};

// 测试Transformation Manager
async function testTransformationManager() {
    console.log('🧪 Testing Transformation Manager Tool Processing...\n');
    
    try {
        // 导入transformation manager
        const { transformationManager } = await import('./dist/v3/transformer/manager.js');
        
        console.log('📥 Input Anthropic Request:');
        console.log(JSON.stringify(anthropicRequest, null, 2));
        console.log('\n');
        
        // 测试输入转换 (Anthropic → OpenAI)
        console.log('🔄 Transforming input (Anthropic → OpenAI)...');
        const transformedRequest = await transformationManager.transformInput(anthropicRequest, transformationContext);
        
        console.log('📤 Transformed Request:');
        console.log(JSON.stringify(transformedRequest, null, 2));
        console.log('\n');
        
        // 验证工具转换结果
        console.log('✅ Tool Validation Results:');
        if (transformedRequest.tools && Array.isArray(transformedRequest.tools)) {
            console.log(`Tools count: ${transformedRequest.tools.length}`);
            
            transformedRequest.tools.forEach((tool, index) => {
                console.log(`Tool ${index}:`);
                console.log(`  - type: ${tool.type} ${tool.type === 'function' ? '✅' : '❌'}`);
                console.log(`  - has function object: ${!!tool.function ? '✅' : '❌'}`);
                if (tool.function) {
                    console.log(`  - function.name: ${tool.function.name || 'missing'}`);
                    console.log(`  - function.description: ${tool.function.description || 'missing'}`);
                    console.log(`  - function.parameters: ${!!tool.function.parameters ? '✅' : '❌'}`);
                }
                console.log('');
            });
            
            // 检查是否所有工具都是正确的OpenAI格式
            const allToolsValid = transformedRequest.tools.every(tool => 
                tool.type === 'function' && 
                tool.function && 
                tool.function.name && 
                tool.function.parameters
            );
            
            console.log(`🎯 Tools Validation: ${allToolsValid ? '✅ PASS' : '❌ FAIL'}`);
            
            if (!allToolsValid) {
                console.log('❌ Found invalid tools after Transformation Manager processing!');
                console.log('🔍 This means the issue is in Transformation Manager, not Transformer');
                process.exit(1);
            }
        } else {
            console.log('❌ No tools found in transformed request!');
            process.exit(1);
        }
        
        // 检查整体请求格式
        const isOpenAIFormat = transformedRequest.messages && 
                              transformedRequest.model && 
                              transformedRequest.max_tokens;
                              
        console.log(`🎯 Overall Request Format: ${isOpenAIFormat ? '✅ OpenAI Format' : '❌ Invalid Format'}`);
        
        if (isOpenAIFormat) {
            console.log('✅ Transformation Manager correctly converts tools to OpenAI format');
        } else {
            console.log('❌ Transformation Manager failed to create proper OpenAI format');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// 运行测试
testTransformationManager();