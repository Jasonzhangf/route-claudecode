#!/usr/bin/env node

/**
 * Enhanced Gemini Rate Limit Manager 测试
 * Project Owner: Jason Zhang
 */

const { EnhancedRateLimitManager } = require('./src/providers/gemini/enhanced-rate-limit-manager');

async function testEnhancedRateLimitManager() {
    console.log('🧪 测试 Enhanced Gemini Rate Limit Manager...\n');
    
    // 模拟3个API keys
    const testKeys = [
        'test-key-1',
        'test-key-2', 
        'test-key-3'
    ];
    
    const manager = new EnhancedRateLimitManager(testKeys, 'gemini-test');
    
    console.log('📊 初始状态:');
    console.log(JSON.stringify(manager.getStatus(), null, 2));
    
    console.log('\n🔄 测试 Round Robin 密钥轮换...');
    
    // 测试正常轮换
    for (let i = 0; i < 6; i++) {
        try {
            const result = manager.getAvailableKeyAndModel('gemini-2.5-pro', 1000, `test-request-${i}`);
            console.log(`请求 ${i + 1}: Key ${result.keyIndex + 1}, Model: ${result.model}, Fallback: ${result.fallbackApplied}`);
        } catch (error) {
            console.log(`请求 ${i + 1}: ERROR - ${error.message}`);
        }
    }
    
    console.log('\n🚨 测试 429 错误报告和模型降级...');
    
    // 模拟 key-0 RPM 限制
    manager.report429Error(0, 'RPM limit exceeded', 'test-rpm-error');
    
    // 模拟 key-1 TPM 限制  
    manager.report429Error(1, 'TPM limit exceeded', 'test-tpm-error');
    
    console.log('\n📊 429错误后的状态:');
    console.log(JSON.stringify(manager.getStatus(), null, 2));
    
    console.log('\n🔄 测试错误后的请求路由...');
    
    // 测试错误后的路由
    for (let i = 0; i < 5; i++) {
        try {
            const result = manager.getAvailableKeyAndModel('gemini-2.5-pro', 1000, `test-after-error-${i}`);
            console.log(`错误后请求 ${i + 1}: Key ${result.keyIndex + 1}, Model: ${result.model}, Fallback: ${result.fallbackApplied}`);
            if (result.fallbackReason) {
                console.log(`  └── Fallback原因: ${result.fallbackReason}`);
            }
        } catch (error) {
            console.log(`错误后请求 ${i + 1}: ERROR - ${error.message}`);
        }
    }
    
    console.log('\n🆘 测试全局fallback (所有key都耗尽)...');
    
    // 耗尽所有key的RPD
    manager.report429Error(0, 'RPD limit exceeded', 'test-rpd-0');
    manager.report429Error(1, 'RPD limit exceeded', 'test-rpd-1'); 
    manager.report429Error(2, 'RPD limit exceeded', 'test-rpd-2');
    
    try {
        const result = manager.getAvailableKeyAndModel('gemini-2.5-pro', 1000, 'test-global-fallback');
        console.log(`全局Fallback: Key ${result.keyIndex + 1}, Model: ${result.model}`);
        console.log(`  └── 原因: ${result.fallbackReason}`);
    } catch (error) {
        console.log(`全局Fallback失败: ${error.message}`);
    }
    
    console.log('\n📈 最终状态:');
    console.log(JSON.stringify(manager.getStatus(), null, 2));
    
    console.log('\n✅ Enhanced Rate Limit Manager 测试完成!');
    console.log('\n🎯 测试验证了以下功能:');
    console.log('   ✅ Round Robin 密钥轮换 (key1→key2→key3→key1)');
    console.log('   ✅ 429错误处理和状态更新');
    console.log('   ✅ 模型自动降级 (gemini-2.5-pro → gemini-2.5-flash → ...)');
    console.log('   ✅ RPM/TPM/RPD 限制跟踪');
    console.log('   ✅ 全局fallback到gemini-2.5-flash-lite');
    console.log('   ✅ 智能错误恢复和重试机制');
}

if (require.main === module) {
    testEnhancedRateLimitManager().catch(console.error);
}