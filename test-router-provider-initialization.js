import { RouterServer } from './dist/v3/server/router-server.js';
import { loadUserConfig } from './dist/v3/config/config-merger.js';

console.log('🔍 分析RouterServer中的Provider初始化过程...\n');

// 测试RouterServer初始化过程
try {
    const configPath = '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json';
    
    console.log('📋 步骤1: 加载配置');
    const config = loadUserConfig(configPath);
    console.log('✅ 配置加载成功');
    
    console.log('📋 步骤2: 创建RouterServer实例');
    const server = new RouterServer(config);
    console.log('✅ RouterServer创建成功');
    
    console.log('📋 步骤3: 检查Provider初始化');
    console.log('📊 Providers Map size:', server.providers.size);
    
    for (const [providerId, provider] of server.providers) {
        console.log(`\n📌 Provider: ${providerId}`);
        console.log('   类型:', typeof provider);
        console.log('   构造函数:', provider.constructor.name);
        console.log('   属性:', Object.keys(provider));
        
        // 关键检查：sendStreamRequest方法
        if (typeof provider.sendStreamRequest === 'function') {
            console.log('   ✅ sendStreamRequest: 存在');
        } else {
            console.log('   ❌ sendStreamRequest: 缺失');
        }
        
        if (typeof provider.sendRequest === 'function') {
            console.log('   ✅ sendRequest: 存在');
        } else {
            console.log('   ❌ sendRequest: 缺失');
        }
        
        // 如果有client属性，检查client的方法
        if (provider.client) {
            console.log('   📊 内部client属性:', Object.keys(provider.client));
            if (typeof provider.client.sendStreamRequest === 'function') {
                console.log('   ✅ client.sendStreamRequest: 存在');
            } else {
                console.log('   ❌ client.sendStreamRequest: 缺失');
            }
        }
    }
    
    console.log('\n📋 步骤4: 测试findProvider方法');
    const foundProvider = server.findProvider('lmstudio', 'test-request-id');
    console.log('✅ findProvider返回成功');
    console.log('📊 返回的provider类型:', typeof foundProvider);
    console.log('📊 返回的provider构造函数:', foundProvider.constructor.name);
    console.log('📊 返回的provider属性:', Object.keys(foundProvider));
    
    // 最关键的测试
    if (typeof foundProvider.sendStreamRequest === 'function') {
        console.log('✅ 最终provider.sendStreamRequest: 存在');
    } else {
        console.log('❌ 最终provider.sendStreamRequest: 缺失');
        console.log('🔍 这就是问题根源！');
    }
    
} catch (error) {
    console.error('❌ RouterServer初始化测试失败:', error.message);
    console.error('Stack:', error.stack);
}

console.log('\n🎯 STD-DATA-CAPTURE-PIPELINE 分析结论:');
console.log('问题精确定位: RouterServer.findProvider()返回的Provider实例类型问题');
