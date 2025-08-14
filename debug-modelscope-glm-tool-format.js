#!/usr/bin/env node

/**
 * Debug ModelScope GLM Tool Format Validation Error
 * 调试ModelScope GLM工具调用格式验证错误
 * 
 * 错误信息：400 Invalid type for 'tools.0', expected an json object.
 */

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 Debug ModelScope GLM工具调用格式验证错误');
console.log('==========================================');

// 测试不同工具格式到ModelScope GLM
async function testToolFormats() {
    console.log('\n📋 测试不同的工具格式');
    
    const testData = {
        // 标准OpenAI格式
        openai_standard: {
            tools: [
                {
                    type: "function",
                    function: {
                        name: "search_files",
                        description: "Search for files in the project",
                        parameters: {
                            type: "object",
                            properties: {
                                pattern: { type: "string", description: "Search pattern" }
                            },
                            required: ["pattern"]
                        }
                    }
                }
            ]
        },
        
        // 可能的GLM期望格式1
        glm_object_format: {
            tools: {
                type: "function",
                function: {
                    name: "search_files",
                    description: "Search for files in the project",
                    parameters: {
                        type: "object",
                        properties: {
                            pattern: { type: "string", description: "Search pattern" }
                        },
                        required: ["pattern"]
                    }
                }
            }
        },
        
        // 可能的GLM期望格式2 - 不同的包装方式
        glm_functions_array: {
            tools: [{
                name: "search_files",
                description: "Search for files in the project",
                parameters: {
                    type: "object",
                    properties: {
                        pattern: { type: "string", description: "Search pattern" }
                    },
                    required: ["pattern"]
                }
            }]
        }
    };
    
    // 输出不同格式的JSON结构
    Object.entries(testData).forEach(([formatName, format]) => {
        console.log(`\n${formatName}:`);
        console.log(JSON.stringify(format, null, 2));
    });
    
    return testData;
}

// 分析错误消息
function analyzeError() {
    console.log('\n🚨 错误分析');
    console.log('错误信息: "400 Invalid type for \'tools.0\', expected an json object."');
    console.log('');
    console.log('🔍 分析结果:');
    console.log('1. 错误位置: tools.0 - 表示工具数组的第一个元素');
    console.log('2. 期望格式: json object - 期望一个JSON对象');  
    console.log('3. 问题原因: 当前发送的tools[0]不是预期的JSON对象格式');
    console.log('');
    console.log('🎯 可能的修复方案:');
    console.log('1. 检查tools数组第一个元素的数据类型');
    console.log('2. 确保tools[0]是有效的JSON对象，不是字符串或其他类型');
    console.log('3. 可能需要为ModelScope GLM创建特定的工具格式补丁');
    console.log('4. 检查是否有序列化/反序列化问题导致对象变成字符串');
}

// 检查当前系统中的工具格式转换
function checkCurrentTransformation() {
    console.log('\n🔧 检查当前系统工具格式转换');
    console.log('');
    console.log('根据transformer代码分析:');
    console.log('convertAnthropicToolsToOpenAI方法生成的格式:');
    console.log(`{
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description || '',
    parameters: tool.input_schema || {}
  }
}`);
    console.log('');
    console.log('🤔 问题可能在于:');
    console.log('1. ModelScope GLM可能期望不同的工具格式');
    console.log('2. 可能存在序列化问题，对象被转换为字符串');
    console.log('3. 需要特定的GLM兼容补丁');
}

// 生成修复建议
function generateFixSuggestions() {
    console.log('\n💡 修复建议');
    console.log('');
    console.log('1. 创建ModelScope GLM特定的工具格式补丁');
    console.log('2. 在预处理阶段检查和修正工具格式');
    console.log('3. 添加工具格式验证日志');
    console.log('4. 创建针对性的单元测试');
    console.log('');
    console.log('🔨 具体实施步骤:');
    console.log('1. 检查发送到ModelScope GLM的实际数据');
    console.log('2. 对比标准OpenAI格式和GLM期望格式');
    console.log('3. 创建格式转换补丁');
    console.log('4. 在unified-patch-preprocessor中添加条件匹配');
}

// 主函数
async function main() {
    try {
        await testToolFormats();
        analyzeError();
        checkCurrentTransformation();
        generateFixSuggestions();
        
        console.log('\n✅ 调试分析完成');
        console.log('下一步: 检查发送到ModelScope GLM的实际请求数据');
        
    } catch (error) {
        console.error('❌ 调试过程出错:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}