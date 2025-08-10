#!/usr/bin/env node

/**
 * grep工具调用失败调试测试
 * 专门测试LMStudio的grep工具调用解析问题
 * Project Owner: Jason Zhang
 */

const axios = require('axios');
const fs = require('fs');

const LM_STUDIO_PORT = 5506;
const DEBUG_LOG_PATH = '/tmp/grep-tool-debug.log';

// 清理之前的日志
if (fs.existsSync(DEBUG_LOG_PATH)) {
    fs.unlinkSync(DEBUG_LOG_PATH);
}

function log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    if (data) {
        console.log(JSON.stringify(data, null, 2));
        fs.appendFileSync(DEBUG_LOG_PATH, `${logMessage}\n${JSON.stringify(data, null, 2)}\n\n`);
    } else {
        fs.appendFileSync(DEBUG_LOG_PATH, `${logMessage}\n`);
    }
}

async function testGrepToolCall() {
    log('🔍 开始测试grep工具调用解析');
    
    const requestBody = {
        model: "gpt-oss-20b-mlx",
        messages: [
            {
                role: "user",
                content: "Please search for the pattern 'function.*parseResponse' in TypeScript files using grep."
            }
        ],
        tools: [
            {
                name: "grep",
                description: "Search for patterns in files",
                input_schema: {
                    type: "object",
                    properties: {
                        pattern: {
                            type: "string",
                            description: "The regex pattern to search for"
                        },
                        glob: {
                            type: "string", 
                            description: "File pattern to search in (e.g., '*.ts')"
                        },
                        path: {
                            type: "string",
                            description: "Directory to search in"
                        }
                    },
                    required: ["pattern"]
                }
            }
        ],
        max_tokens: 1024,
        temperature: 0.1
    };
    
    try {
        log('📤 发送grep工具调用请求', {
            url: `http://localhost:${LM_STUDIO_PORT}/v1/messages`,
            toolsCount: requestBody.tools.length,
            toolName: requestBody.tools[0].name,
            message: requestBody.messages[0].content
        });
        
        const response = await axios.post(`http://localhost:${LM_STUDIO_PORT}/v1/messages`, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer any-key'
            }
        });
        
        log('📥 收到响应', {
            status: response.status,
            statusText: response.statusText,
            hasData: !!response.data
        });
        
        if (response.data) {
            log('📊 响应数据分析', {
                responseId: response.data.id,
                model: response.data.model,
                role: response.data.role,
                stopReason: response.data.stop_reason,
                contentBlocks: response.data.content?.length || 0,
                usage: response.data.usage
            });
            
            // 分析内容块
            if (response.data.content) {
                response.data.content.forEach((block, index) => {
                    if (block.type === 'text') {
                        log(`📝 文本块 ${index}`, {
                            type: block.type,
                            contentPreview: block.text?.substring(0, 200) + (block.text?.length > 200 ? '...' : '')
                        });
                    } else if (block.type === 'tool_use') {
                        log(`🔧 工具调用块 ${index}`, {
                            type: block.type,
                            toolId: block.id,
                            toolName: block.name,
                            toolInput: block.input
                        });
                    }
                });
            }
            
            // 检查是否成功解析了grep工具调用
            const hasGrepToolCall = response.data.content?.some(block => 
                block.type === 'tool_use' && block.name === 'grep'
            );
            
            if (hasGrepToolCall) {
                log('✅ grep工具调用解析成功');
            } else {
                log('❌ grep工具调用解析失败');
                
                // 如果只有文本响应，尝试手动解析
                const textContent = response.data.content?.find(block => block.type === 'text')?.text;
                if (textContent) {
                    log('🔍 检查文本内容中的工具调用模式', {
                        hasLMStudioFormat: textContent.includes('<|start|>assistant<|channel|>'),
                        hasGrepMention: textContent.toLowerCase().includes('grep'),
                        hasFunctionMention: textContent.toLowerCase().includes('function'),
                        textPreview: textContent.substring(0, 500)
                    });
                }
            }
            
            // 保存完整响应
            fs.writeFileSync('/tmp/grep-test-response.json', JSON.stringify(response.data, null, 2));
            log('💾 完整响应已保存到 /tmp/grep-test-response.json');
        }
        
    } catch (error) {
        log('❌ 请求失败', {
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: error.response?.data
        });
        
        if (error.response?.data) {
            fs.writeFileSync('/tmp/grep-test-error.json', JSON.stringify(error.response.data, null, 2));
        }
    }
}

async function checkServiceStatus() {
    try {
        const response = await axios.get(`http://localhost:${LM_STUDIO_PORT}/health`);
        log('🏥 服务健康检查', {
            status: response.status,
            data: response.data
        });
        return true;
    } catch (error) {
        log('❌ 服务不可用', {
            error: error.message,
            code: error.code
        });
        return false;
    }
}

async function main() {
    log('🚀 开始grep工具调用调试测试');
    
    // 检查服务状态
    const serviceAvailable = await checkServiceStatus();
    if (!serviceAvailable) {
        log('💡 提示：请确保LMStudio服务在5506端口运行');
        log('💡 启动命令：rcc start --config ~/.route-claude-code/config/single-provider/config-openai-lmstudio-5506.json --debug');
        process.exit(1);
    }
    
    // 执行grep工具调用测试
    await testGrepToolCall();
    
    log('📋 调试日志已保存到:', DEBUG_LOG_PATH);
    log('🔚 测试完成');
}

main().catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
});