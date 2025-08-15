/**
 * Test Transformer Tool Conversion
 * 测试Transformer层工具转换是否正确输出OpenAI格式
 */

// 模拟Anthropic工具格式（Claude Code工具调用格式）
const anthropicTools = [
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
];

// 测试Transformer工具转换
async function testTransformerToolConversion() {
    console.log('🧪 Testing Transformer Tool Conversion...\n');
    
    try {
        // 动态导入OpenAI transformer
        const { OpenAITransformer } = await import('./dist/v3/transformer/openai-transformer.js');
        const transformer = new OpenAITransformer();
        
        console.log('📥 Input Anthropic Tools:');
        console.log(JSON.stringify(anthropicTools, null, 2));
        console.log('\n');
        
        // 测试工具转换
        console.log('🔄 Converting tools...');
        const convertedTools = transformer.convertAnthropicToolsToOpenAI(anthropicTools, 'test-request-id');
        
        console.log('📤 Output OpenAI Tools:');
        console.log(JSON.stringify(convertedTools, null, 2));
        console.log('\n');
        
        // 验证转换结果
        console.log('✅ Validation Results:');
        convertedTools.forEach((tool, index) => {
            console.log(`Tool ${index}: ${tool.name || 'unnamed'}`);
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
        const allValid = convertedTools.every(tool => 
            tool.type === 'function' && 
            tool.function && 
            tool.function.name && 
            tool.function.parameters
        );
        
        console.log(`🎯 Overall Validation: ${allValid ? '✅ PASS' : '❌ FAIL'}`);
        
        if (!allValid) {
            console.log('❌ Found invalid tools - Transformer conversion is broken!');
            process.exit(1);
        } else {
            console.log('✅ All tools converted correctly to OpenAI format');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// 运行测试
testTransformerToolConversion();