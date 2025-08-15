/**
 * Transformer到Provider流水线测试
 * 测试数据从Transformer到Provider-Protocol的完整传递
 */

console.log('🧪 Transformer → Provider-Protocol Pipeline Test');
console.log('=================================================');

// 模拟Transformer Module的输出
const transformerOutput = {
    id: 'transformer_test_001',
    type: 'provider-protocol',
    model: 'qwen3-30b',
    success: true,
    data: {
        id: 'transformed_12345',
        type: 'provider-protocol',
        model: 'qwen3-30b',
        data: {
            model: 'qwen3-30b',
            messages: [
                {
                    role: 'user',
                    content: '测试工具调用功能：请帮我创建一个简单的Python函数来计算两个数字的和'
                }
            ],
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'Write',
                        description: 'Writes a file to the local filesystem.',
                        parameters: {
                            type: 'object',
                            properties: {
                                file_path: { type: 'string', description: 'The absolute path to the file to write' },
                                content: { type: 'string', description: 'The content to write to the file' }
                            },
                            required: ['file_path', 'content']
                        }
                    }
                }
            ],
            max_tokens: 1000,
            stream: false
        },
        metadata: {
            originalType: 'anthropic',
            providerId: 'lmstudio',
            transformedAt: new Date().toISOString()
        }
    }
};

console.log('🔧 Transformer Module输出 (模拟):');
console.log(JSON.stringify(transformerOutput, null, 2));

console.log('\n🔍 分析数据结构:');
console.log('- transformerOutput.data.data.tools:', transformerOutput.data.data.tools ? '✅ 存在' : '❌ 不存在');
console.log('- tools[0].type:', transformerOutput.data.data.tools[0].type);
console.log('- tools[0].function:', transformerOutput.data.data.tools[0].function ? '✅ 存在' : '❌ 不存在');
console.log('- tools[0].function.name:', transformerOutput.data.data.tools[0].function.name);

// 模拟Provider-Protocol Module接收数据
console.log('\n🔄 Provider-Protocol Module处理流程:');

// 这是Provider-Protocol Module的parseRequest函数模拟
function parseRequest(input) {
    console.log('📥 parseRequest接收的input类型:', typeof input);
    console.log('📥 parseRequest接收的input:', JSON.stringify(input, null, 2));
    
    // 如果输入已经是标准格式
    if (input.id && input.type && input.data) {
        console.log('✅ 输入已经是标准格式，直接返回');
        return input;
    }
    
    // 自动检测格式类型
    let type;
    if (input.messages && Array.isArray(input.messages)) {
        type = 'anthropic';
    } else if (input.choices || input.model) {
        type = 'provider-specific';
    } else {
        type = 'provider-protocol';
    }
    
    console.log(`🔍 自动检测到格式类型: ${type}`);
    
    return {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        model: 'qwen3-30b',
        data: input
    };
}

// 模拟Provider-Protocol Module接收transformerOutput.data
const providerInput = transformerOutput.data;
console.log('\n📨 Provider-Protocol Module接收到的数据:');
const parsedRequest = parseRequest(providerInput);

console.log('📤 parseRequest解析结果:');
console.log(JSON.stringify(parsedRequest, null, 2));

// 模拟sendToProvider函数
console.log('\n🚀 sendToProvider函数处理:');
console.log('📍 发送到Provider客户端的数据 (request.data):');
const dataToProvider = parsedRequest.data;
console.log(JSON.stringify(dataToProvider, null, 2));

console.log('\n🔍 检查工具字段:');
console.log('- dataToProvider.tools存在:', dataToProvider.tools ? '✅' : '❌');
if (dataToProvider.tools) {
    console.log('- tools数量:', dataToProvider.tools.length);
    console.log('- tools[0].type:', dataToProvider.tools[0].type);
    console.log('- tools[0].function存在:', dataToProvider.tools[0].function ? '✅' : '❌');
    if (dataToProvider.tools[0].function) {
        console.log('- tools[0].function.name:', dataToProvider.tools[0].function.name);
        console.log('- tools[0].function.parameters存在:', dataToProvider.tools[0].function.parameters ? '✅' : '❌');
    }
}

console.log('\n🎯 最终结论:');
console.log('从Transformer到Provider-Protocol的数据传递链路分析完成');