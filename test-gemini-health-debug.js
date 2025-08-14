#!/usr/bin/env node

/**
 * Gemini健康检查调试工具
 * 诊断Gemini provider健康状态问题
 * @author Jason Zhang
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

console.log('🔍 Gemini健康检查调试');
console.log('=' .repeat(50));

/**
 * 测试Google AI直接连接
 */
async function testDirectGeminiConnection() {
    console.log('\n📡 测试直接Gemini API连接');
    console.log('-'.repeat(30));
    
    // 从配置文件读取API密钥
    const apiKeys = [
        'AIzaSyB59-hG3lluhWoucvz-qOQKWTrygIxZ2e4',
        'AIzaSyBwrFU85pzvJtAmV-Rh48FuocRYbkuzpiA',
        'AIzaSyBGVrcTiEDko1jZW0wmaGC_oYxK-AL3mEQ'
    ];
    
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        const keyPreview = apiKey.substring(0, 12) + '***';
        
        console.log(`\n🔑 测试API密钥 ${i + 1}: ${keyPreview}`);
        
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            
            console.log('   ✅ 客户端初始化成功');
            
            // 简单的健康检查请求
            const result = await model.generateContent('Hello, this is a health check. Please respond with "OK".');
            const response = await result.response;
            const text = response.text();
            
            console.log(`   ✅ API调用成功`);
            console.log(`   📝 响应: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
            console.log(`   📊 响应长度: ${text.length} 字符`);
            
            return {
                success: true,
                keyIndex: i,
                apiKey: keyPreview,
                responseLength: text.length
            };
            
        } catch (error) {
            console.log(`   ❌ API调用失败: ${error.message}`);
            console.log(`   🔍 错误类型: ${error.constructor.name}`);
            console.log(`   📋 错误代码: ${error.status || error.code || 'Unknown'}`);
            
            if (error.message.includes('API_KEY_INVALID')) {
                console.log('   ⚠️  API密钥无效');
            } else if (error.message.includes('PERMISSION_DENIED')) {
                console.log('   ⚠️  权限被拒绝');
            } else if (error.message.includes('QUOTA_EXCEEDED')) {
                console.log('   ⚠️  配额已超出');
            } else if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
                console.log('   ⚠️  速率限制');
            }
        }
    }
    
    return { success: false };
}

/**
 * 测试路由器健康状态
 */
async function testRouterHealth() {
    console.log('\n🏥 测试路由器健康状态');
    console.log('-'.repeat(30));
    
    try {
        const response = await fetch('http://localhost:5502/health');
        const healthData = await response.json();
        
        console.log(`📊 健康检查响应: ${response.status}`);
        console.log(`   - 整体状态: ${healthData.overall}`);
        console.log(`   - 健康提供商: ${healthData.healthy}/${healthData.total}`);
        console.log(`   - 时间戳: ${new Date(healthData.timestamp).toLocaleString()}`);
        
        if (healthData.providers) {
            console.log(`   - 提供商详情:`);
            Object.entries(healthData.providers).forEach(([provider, healthy]) => {
                const status = healthy ? '✅' : '❌';
                console.log(`     ${status} ${provider}: ${healthy ? '健康' : '不健康'}`);
            });
        }
        
        return {
            success: response.ok,
            overall: healthData.overall,
            healthyProviders: healthData.healthy,
            totalProviders: healthData.total
        };
        
    } catch (error) {
        console.log(`❌ 路由器健康检查失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 测试路由器状态
 */
async function testRouterStatus() {
    console.log('\n📊 测试路由器状态');
    console.log('-'.repeat(30));
    
    try {
        const response = await fetch('http://localhost:5502/status');
        const statusData = await response.json();
        
        console.log(`📋 状态响应: ${response.status}`);
        console.log(`   - 服务器状态: ${statusData.status || 'Unknown'}`);
        console.log(`   - 版本: ${statusData.version || 'Unknown'}`);
        console.log(`   - 启动时间: ${statusData.startTime ? new Date(statusData.startTime).toLocaleString() : 'Unknown'}`);
        console.log(`   - 运行时间: ${statusData.uptime || 'Unknown'}`);
        
        if (statusData.providers) {
            console.log(`   - 配置的提供商: ${Object.keys(statusData.providers).length}`);
            Object.entries(statusData.providers).forEach(([provider, config]) => {
                console.log(`     📡 ${provider}: ${config.type || 'Unknown'} (${config.endpoint || 'No endpoint'})`);
            });
        }
        
        if (statusData.routes) {
            console.log(`   - 配置的路由: ${Object.keys(statusData.routes).length}`);
            Object.entries(statusData.routes).forEach(([route, config]) => {
                console.log(`     🛣️  ${route}: ${config.provider || 'Unknown'} / ${config.model || 'Unknown'}`);
            });
        }
        
        return {
            success: response.ok,
            status: statusData.status,
            providers: Object.keys(statusData.providers || {}),
            routes: Object.keys(statusData.routes || {})
        };
        
    } catch (error) {
        console.log(`❌ 路由器状态检查失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 主诊断函数
 */
async function runGeminiHealthDiagnostic() {
    console.log('🎯 开始Gemini健康诊断');
    
    const results = {
        directConnection: null,
        routerHealth: null,
        routerStatus: null,
        recommendation: ''
    };
    
    // 测试直接连接
    results.directConnection = await testDirectGeminiConnection();
    
    // 测试路由器健康
    results.routerHealth = await testRouterHealth();
    
    // 测试路由器状态
    results.routerStatus = await testRouterStatus();
    
    // 分析结果并给出建议
    console.log('\n🔍 诊断结果分析');
    console.log('=' .repeat(50));
    
    if (results.directConnection.success) {
        console.log('✅ 直接Gemini API连接正常');
        console.log(`   使用API密钥: ${results.directConnection.apiKey}`);
    } else {
        console.log('❌ 直接Gemini API连接失败');
        console.log('   建议检查: API密钥有效性、网络连接、配额限制');
    }
    
    if (results.routerHealth.success) {
        console.log('✅ 路由器服务运行正常');
        if (results.routerHealth.overall === 'healthy') {
            console.log('✅ 所有提供商健康');
        } else {
            console.log(`⚠️  提供商健康状态: ${results.routerHealth.healthyProviders}/${results.routerHealth.totalProviders}`);
        }
    } else {
        console.log('❌ 路由器健康检查失败');
    }
    
    if (results.routerStatus.success) {
        console.log('✅ 路由器状态查询正常');
        console.log(`   配置提供商: ${results.routerStatus.providers.length}`);
        console.log(`   配置路由: ${results.routerStatus.routes.length}`);
    } else {
        console.log('❌ 路由器状态查询失败');
    }
    
    // 给出建议
    console.log('\n💡 建议措施');
    console.log('-'.repeat(30));
    
    if (results.directConnection.success && !results.routerHealth.success) {
        console.log('1. 直接API正常但路由器不健康，可能是路由器配置问题');
        console.log('2. 检查路由器的API密钥配置是否与直接测试一致');
        console.log('3. 检查路由器的健康检查逻辑');
    } else if (!results.directConnection.success) {
        console.log('1. 直接API连接失败，可能是API密钥或网络问题');
        console.log('2. 验证API密钥是否有效且有足够配额');
        console.log('3. 检查网络连接到Google API');
    } else {
        console.log('1. 所有连接正常，可以继续端到端测试');
        console.log('2. 如果仍有问题，检查具体的请求参数');
    }
    
    return results;
}

// 运行诊断
if (import.meta.url === `file://${process.argv[1]}`) {
    runGeminiHealthDiagnostic()
        .then(results => {
            const allHealthy = results.directConnection.success && 
                             results.routerHealth.success && 
                             results.routerStatus.success;
            
            console.log(`\n🎉 诊断完成: ${allHealthy ? '所有检查通过' : '存在问题需要修复'}`);
            process.exit(allHealthy ? 0 : 1);
        })
        .catch(error => {
            console.error('\n💥 诊断失败:', error.message);
            console.error(error.stack);
            process.exit(1);
        });
}

export { runGeminiHealthDiagnostic };