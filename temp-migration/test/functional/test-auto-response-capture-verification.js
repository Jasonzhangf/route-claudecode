#!/usr/bin/env node

/**
 * 自动响应数据捕获验证测试
 * 验证增强的数据捕获系统是否正确按照三层结构保存响应数据
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
const TEST_PORTS = [5506, 5508, 5509]; // LM Studio, ShuaiHong, ModelScope
const CAPTURE_BASE_DIR = '/Users/fanzhang/.route-claudecode/database/captures';

console.log('🔍 启动自动响应数据捕获验证测试...');

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
 * 发送测试请求触发数据捕获
 */
async function triggerDataCapture(port) {
    const url = `${BASE_URL}:${port}/v1/chat/completions`;
    
    const testRequest = {
        model: 'gpt-4',
        messages: [
            { role: 'user', content: 'Hello! This is a test to verify automatic data capture.' }
        ],
        max_tokens: 50,
        temperature: 0.7
    };
    
    try {
        console.log(`📤 发送测试请求到端口 ${port}...`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(testRequest)
        });

        if (!response.ok) {
            console.log(`❌ 请求失败 (${port}): ${response.status} ${response.statusText}`);
            return null;
        }

        const responseData = await response.json();
        console.log(`✅ 请求成功 (${port}): ${responseData.model || 'unknown-model'}`);
        
        return {
            port,
            model: responseData.model,
            requestTime: new Date().toISOString(),
            hasContent: !!(responseData.choices?.[0]?.message?.content),
            contentLength: responseData.choices?.[0]?.message?.content?.length || 0
        };

    } catch (error) {
        console.log(`❌ 请求异常 (${port}): ${error.message}`);
        return null;
    }
}

/**
 * 检查数据捕获结果
 */
async function verifyDataCapture(port, requestResult) {
    // 等待捕获系统完成写入
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const expectedPaths = [
        // 新的三层结构路径
        path.join(CAPTURE_BASE_DIR, 'openai-protocol', 'lmstudio'),
        path.join(CAPTURE_BASE_DIR, 'openai-protocol', 'shuaihong'), 
        path.join(CAPTURE_BASE_DIR, 'openai-protocol', 'modelscope'),
        // 旧的路径作为fallback
        path.join(CAPTURE_BASE_DIR, 'openai')
    ];
    
    const captureResults = {
        port,
        requestTime: requestResult?.requestTime,
        foundCaptures: [],
        totalFiles: 0,
        latestFile: null,
        captureStructure: 'unknown'
    };
    
    for (const basePath of expectedPaths) {
        if (fs.existsSync(basePath)) {
            // 递归搜索捕获文件
            const foundFiles = await searchCaptureFiles(basePath, requestResult?.requestTime);
            captureResults.foundCaptures.push({
                path: basePath,
                fileCount: foundFiles.length,
                files: foundFiles
            });
            captureResults.totalFiles += foundFiles.length;
            
            if (foundFiles.length > 0) {
                const latestFile = foundFiles[foundFiles.length - 1];
                if (!captureResults.latestFile || latestFile.timestamp > captureResults.latestFile.timestamp) {
                    captureResults.latestFile = latestFile;
                    
                    // 确定捕获结构类型
                    if (basePath.includes('openai-protocol')) {
                        captureResults.captureStructure = 'three-tier';
                    } else {
                        captureResults.captureStructure = 'legacy';
                    }
                }
            }
        }
    }
    
    return captureResults;
}

/**
 * 递归搜索捕获文件
 */
async function searchCaptureFiles(dirPath, requestTime) {
    const files = [];
    
    if (!fs.existsSync(dirPath)) {
        return files;
    }
    
    const entries = fs.readdirSync(dirPath);
    
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // 递归搜索子目录
            const subFiles = await searchCaptureFiles(fullPath, requestTime);
            files.push(...subFiles);
        } else if (entry.endsWith('.json') && entry.includes('openai')) {
            // 检查文件时间戳
            const fileTime = stat.mtime.toISOString();
            const requestTimeMs = requestTime ? new Date(requestTime).getTime() : 0;
            const fileTimeMs = stat.mtime.getTime();
            
            // 只包含请求后创建的文件（5分钟内）
            if (fileTimeMs >= requestTimeMs - 5 * 60 * 1000) {
                files.push({
                    path: fullPath,
                    filename: entry,
                    timestamp: fileTime,
                    size: stat.size
                });
            }
        }
    }
    
    return files.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * 分析捕获文件内容
 */
async function analyzeCaptureContent(captureFile) {
    try {
        const content = JSON.parse(fs.readFileSync(captureFile.path, 'utf8'));
        
        return {
            hasRequest: !!content.request,
            hasResponse: !!content.response,
            hasClassification: !!content.classification,
            hasToolCallAnalysis: !!content.toolCallAnalysis,
            provider: content.provider || 'unknown',
            model: content.model || 'unknown',
            captureType: content.classification?.captureType || 'unknown',
            dataStructure: content.classification ? 'enhanced' : 'legacy'
        };
    } catch (error) {
        return {
            error: error.message
        };
    }
}

/**
 * 主验证流程
 */
async function runCaptureVerificationTest() {
    console.log('🚀 开始自动响应数据捕获验证...\n');

    const verificationResults = {
        timestamp: new Date().toISOString(),
        totalTests: 0,
        successfulRequests: 0,
        capturedResponses: 0,
        enhancedCaptures: 0,
        legacyCaptures: 0,
        results: [],
        summary: {}
    };

    // 检查服务可用性
    const availablePorts = [];
    for (const port of TEST_PORTS) {
        const isHealthy = await checkServiceHealth(port);
        if (isHealthy) {
            availablePorts.push(port);
            console.log(`✅ 端口 ${port} 服务正常`);
        } else {
            console.log(`❌ 端口 ${port} 服务不可用`);
        }
    }

    if (availablePorts.length === 0) {
        console.log('❌ 没有可用的服务端口，无法验证数据捕获');
        return verificationResults;
    }

    // 对每个可用端口执行测试
    for (const port of availablePorts) {
        verificationResults.totalTests++;
        
        console.log(`\n🔄 测试端口 ${port}...`);
        
        // 发送请求触发数据捕获
        const requestResult = await triggerDataCapture(port);
        if (requestResult) {
            verificationResults.successfulRequests++;
            
            // 验证数据捕获
            const captureResult = await verifyDataCapture(port, requestResult);
            
            if (captureResult.totalFiles > 0) {
                verificationResults.capturedResponses++;
                
                // 分析最新捕获文件
                if (captureResult.latestFile) {
                    const contentAnalysis = await analyzeCaptureContent(captureResult.latestFile);
                    
                    if (contentAnalysis.dataStructure === 'enhanced') {
                        verificationResults.enhancedCaptures++;
                    } else {
                        verificationResults.legacyCaptures++;
                    }
                    
                    captureResult.contentAnalysis = contentAnalysis;
                    
                    console.log(`✅ 检测到数据捕获 (${port}): ${captureResult.totalFiles} 个文件`);
                    console.log(`   📁 最新文件: ${captureResult.latestFile.filename}`);
                    console.log(`   🏗️ 结构类型: ${captureResult.captureStructure}`);
                    console.log(`   📊 数据格式: ${contentAnalysis.dataStructure}`);
                    
                    if (contentAnalysis.hasClassification) {
                        console.log(`   🎯 分类信息: ${contentAnalysis.provider}/${contentAnalysis.model}`);
                    }
                    if (contentAnalysis.hasToolCallAnalysis) {
                        console.log(`   🔧 工具调用分析: 已包含`);
                    }
                } else {
                    console.log(`⚠️ 检测到捕获但无法分析内容 (${port})`);
                }
            } else {
                console.log(`❌ 未检测到数据捕获 (${port})`);
            }
            
            verificationResults.results.push(captureResult);
        }
        
        // 短暂延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 生成总结
    verificationResults.summary = {
        captureRate: verificationResults.capturedResponses / verificationResults.successfulRequests,
        enhancedCaptureRate: verificationResults.enhancedCaptures / Math.max(verificationResults.capturedResponses, 1),
        hasThreeTierStructure: verificationResults.results.some(r => r.captureStructure === 'three-tier'),
        hasEnhancedData: verificationResults.enhancedCaptures > 0
    };

    // 保存验证报告
    const reportPath = path.join(__dirname, '../output/functional', `auto-response-capture-verification-${Date.now()}.json`);
    await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.promises.writeFile(reportPath, JSON.stringify(verificationResults, null, 2));

    // 输出结果
    console.log('\n' + '='.repeat(80));
    console.log('🔍 自动响应数据捕获验证结果');
    console.log('='.repeat(80));
    console.log(`📊 总测试数: ${verificationResults.totalTests}`);
    console.log(`✅ 成功请求: ${verificationResults.successfulRequests}`);
    console.log(`💾 捕获响应: ${verificationResults.capturedResponses}`);
    console.log(`🔧 增强捕获: ${verificationResults.enhancedCaptures}`);
    console.log(`📁 传统捕获: ${verificationResults.legacyCaptures}`);
    console.log(`📄 详细报告: ${reportPath}`);

    if (verificationResults.summary.hasThreeTierStructure) {
        console.log('\n✅ 三层目录结构: 已启用');
    } else {
        console.log('\n⚠️ 三层目录结构: 未检测到');
    }

    if (verificationResults.summary.hasEnhancedData) {
        console.log('✅ 增强数据格式: 已启用');
    } else {
        console.log('⚠️ 增强数据格式: 未检测到');
    }

    console.log(`\n📈 捕获率: ${(verificationResults.summary.captureRate * 100).toFixed(1)}%`);
    console.log(`📈 增强数据率: ${(verificationResults.summary.enhancedCaptureRate * 100).toFixed(1)}%`);

    if (verificationResults.capturedResponses === 0) {
        console.log('\n🚨 注意: 未检测到任何数据捕获');
        console.log('   可能原因: 服务未启用数据捕获，或捕获路径配置错误');
    } else if (verificationResults.enhancedCaptures === 0) {
        console.log('\n🚨 注意: 未检测到增强数据格式');
        console.log('   可能原因: 数据捕获系统尚未更新到最新版本');
    } else {
        console.log('\n🎉 数据捕获系统工作正常！');
    }

    return verificationResults;
}

// 执行测试
if (import.meta.url === `file://${process.argv[1]}`) {
    runCaptureVerificationTest()
        .then(results => {
            process.exit(results.capturedResponses > 0 ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 验证测试失败:', error);
            process.exit(1);
        });
}

export { runCaptureVerificationTest };