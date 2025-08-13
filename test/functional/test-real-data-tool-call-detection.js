#!/usr/bin/env node

/**
 * 真实数据工具调用检测测试
 * 使用已分类的database真实数据测试Provider-Protocol是否正确检测工具调用
 * 重点验证LM Studio "Tool call:" 格式与 finish_reason 不匹配的问题
 * 
 * @author Jason Zhang  
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库路径 - 优先使用响应数据，其次使用现有分类数据
const RESPONSE_DATA_DIR = '/Users/fanzhang/.route-claudecode/database/response-data';
const CLASSIFIED_DATA_DIR = '/Users/fanzhang/.route-claudecode/database/captures';

console.log('🧪 启动真实数据工具调用检测测试...');
console.log(`📁 响应数据源: ${RESPONSE_DATA_DIR}`);
console.log(`📁 分类数据源: ${CLASSIFIED_DATA_DIR}`);

/**
 * 工具调用检测器 - 检测各种工具调用格式
 */
class ToolCallDetector {
    constructor() {
        this.patterns = {
            // 标准OpenAI格式
            standard: (data) => {
                return data.choices?.[0]?.message?.tool_calls?.length > 0;
            },
            
            // LM Studio "Tool call:" 格式
            lmstudioContent: (data) => {
                const content = data.choices?.[0]?.message?.content;
                if (typeof content === 'string') {
                    return content.includes('Tool call:') || content.includes('tool_call');
                }
                return false;
            },
            
            // 嵌入式 <tool_call> 格式
            embedded: (data) => {
                const content = data.choices?.[0]?.message?.content;
                return typeof content === 'string' && /<tool_call>.*?<\/tool_call>/s.test(content);
            }
        };
    }

    analyzeResponse(data, filename) {
        const analysis = {
            filename,
            hasStandardToolCalls: false,
            hasContentToolCalls: false,
            hasEmbeddedToolCalls: false,
            finishReason: null,
            correctFinishReason: null,
            needsFix: false,
            toolCallsCount: 0,
            issues: []
        };

        if (!data.choices?.[0]) {
            return analysis;
        }

        const choice = data.choices[0];
        analysis.finishReason = choice.finish_reason;

        // 检测标准工具调用
        if (this.patterns.standard(data)) {
            analysis.hasStandardToolCalls = true;
            analysis.toolCallsCount = choice.message.tool_calls.length;
            analysis.correctFinishReason = 'tool_calls';
        }

        // 检测内容中的工具调用（LM Studio格式）
        if (this.patterns.lmstudioContent(data)) {
            analysis.hasContentToolCalls = true;
            analysis.correctFinishReason = 'tool_calls';
        }

        // 检测嵌入式工具调用
        if (this.patterns.embedded(data)) {
            analysis.hasEmbeddedToolCalls = true;
            analysis.correctFinishReason = 'tool_calls';
        }

        // 检查是否需要修复
        const hasAnyToolCalls = analysis.hasStandardToolCalls || 
                               analysis.hasContentToolCalls || 
                               analysis.hasEmbeddedToolCalls;

        if (hasAnyToolCalls && analysis.finishReason !== 'tool_calls') {
            analysis.needsFix = true;
            analysis.issues.push({
                type: 'finish_reason_mismatch',
                current: analysis.finishReason,
                expected: 'tool_calls',
                reason: analysis.hasContentToolCalls ? 'content_has_tool_call' : 'standard_tool_calls_present'
            });
        }

        return analysis;
    }
}

/**
 * 扫描指定Provider的数据文件 - 优先使用响应数据
 */
async function scanProviderData(protocolType, providerName, modelName = null) {
    // 首先检查响应数据目录
    const responseProviderPath = path.join(RESPONSE_DATA_DIR, protocolType, providerName);
    // 其次检查分类数据目录
    const classifiedProviderPath = path.join(CLASSIFIED_DATA_DIR, protocolType, providerName);
    
    let providerPath = null;
    let dataSource = '';
    
    if (fs.existsSync(responseProviderPath)) {
        providerPath = responseProviderPath;
        dataSource = 'response-data';
        console.log(`✅ 使用响应数据: ${responseProviderPath}`);
    } else if (fs.existsSync(classifiedProviderPath)) {
        providerPath = classifiedProviderPath;
        dataSource = 'classified-data';
        console.log(`📁 使用分类数据: ${classifiedProviderPath}`);
    } else {
        console.log(`⚠️ Provider路径不存在: ${responseProviderPath} 和 ${classifiedProviderPath}`);
        return [];
    }

    const results = [];
    const detector = new ToolCallDetector();

    // 如果指定了model，只扫描该model的数据
    let dirsToScan;
    if (modelName) {
        dirsToScan = [modelName];
    } else {
        try {
            dirsToScan = fs.readdirSync(providerPath).filter(d => {
                const fullPath = path.join(providerPath, d);
                try {
                    return fs.statSync(fullPath).isDirectory();
                } catch (error) {
                    return false;
                }
            });
        } catch (error) {
            console.log(`⚠️ 无法读取目录: ${providerPath} - ${error.message}`);
            return [];
        }
    }

    for (const modelDir of dirsToScan) {
        const modelPath = path.join(providerPath, modelDir);
        
        try {
            if (!fs.existsSync(modelPath) || !fs.statSync(modelPath).isDirectory()) {
                console.log(`⚠️ 模型目录不存在或不是目录: ${modelPath}`);
                continue;
            }
        } catch (error) {
            console.log(`⚠️ 无法访问模型目录: ${modelPath} - ${error.message}`);
            continue;
        }

        console.log(`🔍 扫描模型数据: ${protocolType}/${providerName}/${modelDir}`);
        
        let files;
        try {
            files = fs.readdirSync(modelPath)
                .filter(f => f.endsWith('.json'))
                .slice(0, 50); // 限制每个模型最多50个文件以提高效率
        } catch (error) {
            console.log(`⚠️ 无法读取模型目录文件: ${modelPath} - ${error.message}`);
            continue;
        }

        console.log(`   📊 发现 ${files.length} 个JSON文件`);

        for (const file of files) {
            const filePath = path.join(modelPath, file);
            
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                // 根据数据源选择正确的数据结构
                let responseData;
                if (dataSource === 'response-data') {
                    // 新的增强数据结构：data.response包含实际响应
                    responseData = data.response || data;
                } else {
                    // 现有分类数据结构：直接使用data
                    responseData = data;
                }
                
                const analysis = detector.analyzeResponse(responseData, file);
                
                // 调试：检查特定文件
                if (file === 'openai-capture-2025-08-03T23-35-56-138Z-356b21fc-5f77-4d5f-92f6-986136dcfd6d.json') {
                    console.log(`🔍 调试文件 ${file}:`, {
                        hasStandardToolCalls: analysis.hasStandardToolCalls,
                        hasContentToolCalls: analysis.hasContentToolCalls,
                        hasEmbeddedToolCalls: analysis.hasEmbeddedToolCalls,
                        finishReason: analysis.finishReason,
                        needsFix: analysis.needsFix,
                        contentSample: JSON.stringify(data).substring(0, 200)
                    });
                }
                
                // 始终推送结果以便统计所有处理的文件
                results.push({
                    protocolType,
                    providerName,
                    modelName: modelDir,
                    filePath,
                    ...analysis
                });
                
            } catch (error) {
                console.log(`⚠️ 解析文件失败: ${file} - ${error.message}`);
            }
        }
    }

    return results;
}

/**
 * 生成修复建议
 */
function generateFixRecommendations(results) {
    const recommendations = {
        summary: {
            totalFiles: results.length,
            needsFixCount: results.filter(r => r.needsFix).length,
            byProvider: {}
        },
        fixes: []
    };

    // 按Provider分组统计
    for (const result of results) {
        const key = `${result.protocolType}/${result.providerName}`;
        if (!recommendations.summary.byProvider[key]) {
            recommendations.summary.byProvider[key] = {
                total: 0,
                needsFix: 0,
                issues: []
            };
        }
        
        recommendations.summary.byProvider[key].total++;
        if (result.needsFix) {
            recommendations.summary.byProvider[key].needsFix++;
            recommendations.summary.byProvider[key].issues.push(...result.issues);
        }
    }

    // 生成具体修复建议
    if (recommendations.summary.needsFixCount > 0) {
        recommendations.fixes.push({
            type: 'lmstudio_finish_reason_fix',
            description: '在LM Studio预处理器中添加finish_reason修复逻辑',
            implementation: 'src/transformers/lmstudio-fixer.ts',
            priority: 'high'
        });

        recommendations.fixes.push({
            type: 'provider_response_validation',  
            description: '在Provider层添加响应格式验证',
            implementation: 'src/provider/*/preprocessor.ts',
            priority: 'medium'
        });

        recommendations.fixes.push({
            type: 'unit_test_enhancement',
            description: '添加使用真实数据的工具调用检测测试',
            implementation: 'test/unit/tool-call-detection-real-data.test.ts',
            priority: 'medium'
        });
    }

    return recommendations;
}

/**
 * 主测试流程
 */
async function runRealDataToolCallDetectionTest() {
    console.log('🚀 开始真实数据工具调用检测测试...\n');

    const testResults = {
        timestamp: new Date().toISOString(),
        totalScanned: 0,
        toolCallFiles: 0,
        needsFixFiles: 0,
        providers: [],
        issues: [],
        recommendations: null
    };

    // 测试主要的Provider数据
    const providersToTest = [
        { protocol: 'openai-protocol', provider: 'lmstudio', models: ['glm-4.5-air', 'qwen3-30b'] },
        { protocol: 'openai-protocol', provider: 'modelscope', models: ['zhipuai-glm-4.5'] },
        { protocol: 'openai-protocol', provider: 'shuaihong', models: ['claude-4-sonnet'] }
    ];

    let allResults = [];

    for (const config of providersToTest) {
        console.log(`\n📊 测试Provider: ${config.protocol}/${config.provider}`);
        
        for (const model of config.models) {
            const results = await scanProviderData(config.protocol, config.provider, model);
            allResults.push(...results);
            
            const modelStats = {
                protocol: config.protocol,
                provider: config.provider,
                model: model,
                scannedFiles: results.length,
                toolCallFiles: results.filter(r => r.hasStandardToolCalls || r.hasContentToolCalls || r.hasEmbeddedToolCalls).length,
                needsFixFiles: results.filter(r => r.needsFix).length
            };
            
            testResults.providers.push(modelStats);
            testResults.totalScanned += modelStats.scannedFiles;
            testResults.toolCallFiles += modelStats.toolCallFiles;
            testResults.needsFixFiles += modelStats.needsFixFiles;
            
            console.log(`   📁 ${model}: 扫描${modelStats.scannedFiles}个文件, 工具调用${modelStats.toolCallFiles}个, 需修复${modelStats.needsFixFiles}个`);
        }
    }

    // 分析问题并生成建议
    const problemFiles = allResults.filter(r => r.needsFix);
    testResults.issues = problemFiles.map(r => ({
        file: `${r.protocolType}/${r.providerName}/${r.modelName}/${r.filename}`,
        finishReason: r.finishReason,
        expectedReason: r.correctFinishReason,
        hasContentToolCalls: r.hasContentToolCalls,
        hasEmbeddedToolCalls: r.hasEmbeddedToolCalls,
        issues: r.issues
    }));

    testResults.recommendations = generateFixRecommendations(allResults);

    // 输出测试结果
    console.log('\n' + '='.repeat(80));
    console.log('🧪 真实数据工具调用检测测试结果');
    console.log('='.repeat(80));
    console.log(`📊 总扫描文件: ${testResults.totalScanned}`);
    console.log(`🔧 包含工具调用: ${testResults.toolCallFiles}`);
    console.log(`⚠️ 需要修复: ${testResults.needsFixFiles}`);
    console.log(`📅 测试时间: ${testResults.timestamp}`);

    if (testResults.needsFixFiles > 0) {
        console.log('\n🚨 发现的问题:');
        for (const issue of testResults.issues.slice(0, 10)) { // 显示前10个问题
            console.log(`   ❌ ${issue.file}`);
            console.log(`      finish_reason: "${issue.finishReason}" → "${issue.expectedReason}"`);
            if (issue.hasContentToolCalls) {
                console.log('      问题: 内容包含"Tool call:"但finish_reason错误');
            }
        }
        
        if (testResults.issues.length > 10) {
            console.log(`   ... 还有 ${testResults.issues.length - 10} 个问题`);
        }
    }

    console.log('\n📋 Provider统计:');
    for (const provider of testResults.providers) {
        const status = provider.needsFixFiles > 0 ? '❌ 需修复' : provider.toolCallFiles > 0 ? '✅ 正常' : '⚪ 无工具调用';
        console.log(`   ${status} ${provider.protocol}/${provider.provider}/${provider.model}: ${provider.needsFixFiles}/${provider.toolCallFiles}/${provider.scannedFiles}`);
    }

    console.log('\n🔧 修复建议:');
    for (const fix of testResults.recommendations.fixes) {
        console.log(`   ${fix.priority === 'high' ? '🔥' : '📋'} ${fix.description}`);
        console.log(`      实现位置: ${fix.implementation}`);
    }

    // 保存详细结果
    const outputDir = path.join(__dirname, '../output/functional');
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    const resultsFile = path.join(outputDir, `real-data-tool-call-detection-${Date.now()}.json`);
    await fs.promises.writeFile(resultsFile, JSON.stringify(testResults, null, 2));

    console.log(`\n📄 详细结果保存至: ${resultsFile}`);

    // 最终评估
    if (testResults.needsFixFiles === 0) {
        console.log('\n✅ 测试结果: 所有Provider工具调用检测正常');
    } else {
        console.log(`\n⚠️ 测试结果: 发现${testResults.needsFixFiles}个文件需要修复工具调用检测`);
        console.log('🎯 主要问题: LM Studio "Tool call:" 格式的finish_reason不正确');
        console.log('🔧 建议: 启用LM Studio预处理器的finish_reason修复功能');
    }

    return testResults;
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    runRealDataToolCallDetectionTest()
        .then(results => {
            process.exit(results.needsFixFiles > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('💥 测试执行失败:', error);
            process.exit(1);
        });
}

export { runRealDataToolCallDetectionTest };