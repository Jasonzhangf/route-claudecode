#!/usr/bin/env node

/**
 * 响应数据收集测试
 * 收集各Provider真实响应数据建立响应数据库
 * 
 * @author Jason Zhang  
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const BASE_URL = 'http://localhost';
const PORTS = [5506, 5508, 5509]; // LM Studio, ShuaiHong, ModelScope
const RESPONSE_DB_DIR = '/Users/fanzhang/.route-claudecode/database/response-data';

console.log('🔄 启动响应数据收集测试...');

/**
 * 创建响应数据目录结构
 */
async function setupResponseDataDirectory() {
    const directories = [
        `${RESPONSE_DB_DIR}/openai-protocol/lmstudio/qwen3-30b`,
        `${RESPONSE_DB_DIR}/openai-protocol/lmstudio/glm-4.5-air`,
        `${RESPONSE_DB_DIR}/openai-protocol/shuaihong/claude-4-sonnet`,
        `${RESPONSE_DB_DIR}/openai-protocol/shuaihong/gemini-2.5-pro`,
        `${RESPONSE_DB_DIR}/openai-protocol/modelscope/zhipuai-glm-4.5`
    ];

    for (const dir of directories) {
        await fs.promises.mkdir(dir, { recursive: true });
        console.log(`✅ 创建目录: ${dir}`);
    }
}

/**
 * 测试请求配置
 */
const TEST_REQUESTS = [
    {
        name: 'simple-text',
        request: {
            model: 'gpt-4',
            messages: [
                { role: 'user', content: 'Hello, how are you?' }
            ],
            max_tokens: 100,
            temperature: 0.7
        }
    },
    {
        name: 'tool-call-request',
        request: {
            model: 'gpt-4',
            messages: [
                { role: 'user', content: 'Please create a todo item for me: Review the project documentation.' }
            ],
            tools: [
                {
                    type: 'function',
                    function: {
                        name: 'TodoWrite',
                        description: 'Create and manage todo items',
                        parameters: {
                            type: 'object',
                            properties: {
                                todos: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            content: { type: 'string' },
                                            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                                            priority: { type: 'string', enum: ['high', 'medium', 'low'] }
                                        },
                                        required: ['content', 'status', 'priority']
                                    }
                                }
                            },
                            required: ['todos']
                        }
                    }
                }
            ],
            max_tokens: 500,
            temperature: 0
        }
    },
    {
        name: 'multi-turn-conversation',
        request: {
            model: 'gpt-4',
            messages: [
                { role: 'user', content: 'What is the capital of France?' },
                { role: 'assistant', content: 'The capital of France is Paris.' },
                { role: 'user', content: 'What is its population?' }
            ],
            max_tokens: 150,
            temperature: 0.5
        }
    }
];

/**
 * 检查服务可用性
 */
async function checkServiceHealth(port) {
    try {
        const response = await fetch(`${BASE_URL}:${port}/health`);
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * 发送测试请求并收集响应
 */
async function collectResponseData(port, testRequest) {
    const url = `${BASE_URL}:${port}/v1/chat/completions`;
    
    try {
        console.log(`📤 发送请求到端口 ${port}: ${testRequest.name}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                ...testRequest.request,
                stream: false  // 先收集非流式响应
            })
        });

        if (!response.ok) {
            console.log(`❌ 请求失败 (${port}): ${response.status} ${response.statusText}`);
            return null;
        }

        const responseData = await response.json();
        
        // 添加元数据
        const enrichedData = {
            timestamp: new Date().toISOString(),
            port: port,
            testName: testRequest.name,
            responseMetadata: {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            },
            request: testRequest.request,
            response: responseData
        };

        console.log(`✅ 收到响应 (${port}): ${responseData.model || 'unknown-model'}`);
        
        // 检测工具调用
        if (responseData.choices && responseData.choices[0]) {
            const choice = responseData.choices[0];
            const hasToolCalls = choice.message?.tool_calls && choice.message.tool_calls.length > 0;
            const hasToolCallInContent = choice.message?.content && 
                (choice.message.content.includes('Tool call:') || choice.message.content.includes('function'));
            const finishReason = choice.finish_reason;

            enrichedData.toolCallAnalysis = {
                hasStandardToolCalls: hasToolCalls,
                hasToolCallInContent: hasToolCallInContent,
                finishReason: finishReason,
                needsFix: (hasToolCalls || hasToolCallInContent) && finishReason !== 'tool_calls'
            };

            if (hasToolCalls || hasToolCallInContent) {
                console.log(`🔧 检测到工具调用 (${port}): finish_reason=${finishReason}`);
            }
        }

        return enrichedData;

    } catch (error) {
        console.log(`❌ 请求异常 (${port}): ${error.message}`);
        return null;
    }
}

/**
 * 确定保存路径
 */
function determineResponseDataPath(port, responseData) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 根据端口确定provider路径
    let providerPath;
    switch (port) {
        case 5506:
            // LM Studio - 需要根据实际返回的模型名确定
            if (responseData.response.model?.includes('glm')) {
                providerPath = 'openai-protocol/lmstudio/glm-4.5-air';
            } else {
                providerPath = 'openai-protocol/lmstudio/qwen3-30b';
            }
            break;
        case 5508:
            providerPath = 'openai-protocol/shuaihong/claude-4-sonnet';
            break;
        case 5509:
            providerPath = 'openai-protocol/modelscope/zhipuai-glm-4.5';
            break;
        default:
            providerPath = `unknown-provider/port-${port}`;
    }

    const filename = `response-${responseData.testName}-${timestamp}.json`;
    return path.join(RESPONSE_DB_DIR, providerPath, filename);
}

/**
 * 保存响应数据
 */
async function saveResponseData(responseData) {
    if (!responseData) return null;
    
    const filePath = determineResponseDataPath(responseData.port, responseData);
    
    // 确保目录存在
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    
    // 保存数据
    await fs.promises.writeFile(filePath, JSON.stringify(responseData, null, 2));
    
    console.log(`💾 保存响应数据: ${filePath}`);
    return filePath;
}

/**
 * 主收集流程
 */
async function runResponseDataCollection() {
    console.log('🚀 开始响应数据收集...\n');

    const collectionResults = {
        timestamp: new Date().toISOString(),
        totalRequests: 0,
        successfulResponses: 0,
        toolCallResponses: 0,
        savedFiles: [],
        errors: []
    };

    // 设置目录结构
    await setupResponseDataDirectory();

    // 检查服务可用性
    const availablePorts = [];
    for (const port of PORTS) {
        const isHealthy = await checkServiceHealth(port);
        if (isHealthy) {
            availablePorts.push(port);
            console.log(`✅ 端口 ${port} 服务正常`);
        } else {
            console.log(`❌ 端口 ${port} 服务不可用`);
            collectionResults.errors.push(`Port ${port} service unavailable`);
        }
    }

    if (availablePorts.length === 0) {
        console.log('❌ 没有可用的服务端口');
        return collectionResults;
    }

    // 对每个可用端口执行所有测试请求
    for (const port of availablePorts) {
        console.log(`\n🔄 测试端口 ${port}...`);
        
        for (const testRequest of TEST_REQUESTS) {
            collectionResults.totalRequests++;
            
            const responseData = await collectResponseData(port, testRequest);
            if (responseData) {
                collectionResults.successfulResponses++;
                
                if (responseData.toolCallAnalysis?.hasStandardToolCalls || 
                    responseData.toolCallAnalysis?.hasToolCallInContent) {
                    collectionResults.toolCallResponses++;
                }
                
                const savedPath = await saveResponseData(responseData);
                if (savedPath) {
                    collectionResults.savedFiles.push(savedPath);
                }
            } else {
                collectionResults.errors.push(`Failed to collect data from port ${port} for test ${testRequest.name}`);
            }
            
            // 短暂延迟避免请求过于频繁
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // 保存收集报告
    const reportPath = path.join(__dirname, '../output/functional', `response-data-collection-${Date.now()}.json`);
    await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.promises.writeFile(reportPath, JSON.stringify(collectionResults, null, 2));

    // 输出结果
    console.log('\n' + '='.repeat(80));
    console.log('🧪 响应数据收集测试结果');
    console.log('='.repeat(80));
    console.log(`📊 总请求数: ${collectionResults.totalRequests}`);
    console.log(`✅ 成功响应: ${collectionResults.successfulResponses}`);
    console.log(`🔧 工具调用响应: ${collectionResults.toolCallResponses}`);
    console.log(`💾 保存文件数: ${collectionResults.savedFiles.length}`);
    console.log(`❌ 错误数量: ${collectionResults.errors.length}`);
    console.log(`📄 详细报告: ${reportPath}`);

    if (collectionResults.errors.length > 0) {
        console.log('\n🚨 错误列表:');
        collectionResults.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
    }

    console.log('\n💡 收集的响应数据保存在:');
    console.log(`   ${RESPONSE_DB_DIR}`);
    console.log('\n🎯 下一步: 使用收集的响应数据更新工具调用检测测试');

    return collectionResults;
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    runResponseDataCollection()
        .then(results => {
            process.exit(results.errors.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('💥 响应数据收集失败:', error);
            process.exit(1);
        });
}

export { runResponseDataCollection };