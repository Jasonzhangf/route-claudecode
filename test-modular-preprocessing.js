#!/usr/bin/env node

/**
 * 模块化预处理功能测试
 * 测试拆分后的各个预处理模块
 * @author Jason Zhang
 */

import { 
    OpenAICompatiblePreprocessor,
    FeatureDetector,
    TextToolParser,
    JSONToolFixer,
    StandardToolFixer 
} from './src/v3/preprocessor/index.js';

console.log('🧪 模块化预处理功能测试');
console.log('=' * 50);

// 测试数据
const testContext = {
    providerId: 'modelscope-openai',
    config: {
        endpoint: 'https://api-inference.modelscope.cn/v1/chat/completions',
        modelSpecific: {
            'GLM-4.5': { toolCallFormat: 'text-based' }
        }
    }
};

const testRequest = {
    model: 'ZhipuAI/GLM-4.5',
    messages: [{ role: 'user', content: 'Search for AI info' }],
    tools: [{ function: { name: 'search' } }]
};

async function testModules() {
    console.log('\n📋 1. 特征检测器测试');
    console.log('-' * 30);
    
    const needsTextParsing = FeatureDetector.needsTextBasedToolCallParsing(testRequest, testContext);
    const needsEnhancedJSON = FeatureDetector.needsEnhancedJSONFormat(testRequest, testContext);
    const needsStandardFormat = FeatureDetector.needsStandardOpenAIFormat(testRequest, testContext);
    
    console.log(`✅ 需要文本工具调用解析: ${needsTextParsing}`);
    console.log(`✅ 需要增强JSON格式: ${needsEnhancedJSON}`);
    console.log(`✅ 需要标准OpenAI格式: ${needsStandardFormat}`);
    
    console.log('\n📋 2. 预处理器测试');
    console.log('-' * 30);
    
    try {
        const preprocessor = new OpenAICompatiblePreprocessor(testContext.config);
        const processed = await preprocessor.processRequest(testRequest, testContext);
        
        console.log(`✅ 预处理成功`);
        console.log(`   - 温度: ${processed.temperature}`);
        console.log(`   - 工具数量: ${processed.tools?.length || 0}`);
        console.log(`   - 工具选择: ${processed.tool_choice}`);
        
    } catch (error) {
        console.log(`❌ 预处理失败: ${error.message}`);
    }
    
    console.log('\n📋 3. 响应处理器测试');
    console.log('-' * 30);
    
    // 文本工具调用响应测试
    const textResponse = {
        choices: [{
            message: {
                content: 'I will search. Tool call: search(query: "AI information")'
            }
        }]
    };
    
    const hasTextCalls = FeatureDetector.hasTextBasedToolCallsInResponse(textResponse);
    console.log(`✅ 文本工具调用检测: ${hasTextCalls}`);
    
    if (hasTextCalls) {
        const parsed = TextToolParser.parseTextBasedToolCallResponse(textResponse, testRequest, testContext);
        console.log(`✅ 文本工具解析: ${parsed.choices[0].message.tool_calls?.length || 0} 个工具调用`);
    }
    
    // JSON修复测试
    const malformedResponse = {
        choices: [{
            message: {
                tool_calls: [{
                    function: {
                        name: 'search',
                        arguments: '{"query": "test",}'  // 格式错误
                    }
                }]
            }
        }]
    };
    
    const needsJSONFix = FeatureDetector.hasmalformedJSONToolCalls(malformedResponse);
    console.log(`✅ JSON修复检测: ${needsJSONFix}`);
    
    if (needsJSONFix) {
        const fixed = JSONToolFixer.parseAndFixJSONToolCallResponse(malformedResponse, testRequest, testContext);
        console.log(`✅ JSON修复完成: ${fixed.choices[0].message.tool_calls?.length || 0} 个工具调用`);
    }
    
    console.log('\n🎉 所有模块测试完成！');
    console.log('\n📊 模块化架构优势:');
    console.log('✅ 单一职责: 每个模块专注于特定功能');
    console.log('✅ 易于测试: 可独立测试各个模块');
    console.log('✅ 易于维护: 修改单个功能不影响其他模块');
    console.log('✅ 易于扩展: 可轻松添加新的特征检测或处理器');
}

testModules().catch(console.error);