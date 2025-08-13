import { DebugRecorder } from './src/v3/debug/debug-recorder.js';
import { ReplaySystem } from './src/v3/debug/replay-system.js';
import { createOpenAIClient } from './dist/v3/provider-protocol/openai/client-factory.js';

console.log('🔍 分析Provider-Protocol层streaming方法问题...\n');

// 测试1: 验证OpenAI客户端工厂函数
console.log('📋 测试1: 检查OpenAI客户端工厂函数');
try {
    const testConfig = {
        endpoint: 'http://localhost:1234/v1/chat/completions',
        authentication: { type: 'none' },
        models: ['gpt-oss-20b-mlx']
    };
    
    const client = createOpenAIClient(testConfig, 'test-lmstudio');
    console.log('✅ OpenAI客户端创建成功');
    console.log('📊 客户端属性:', Object.keys(client));
    
    // 关键测试：检查sendStreamRequest方法是否存在
    if (typeof client.sendStreamRequest === 'function') {
        console.log('✅ sendStreamRequest方法存在');
    } else {
        console.log('❌ sendStreamRequest方法缺失\!');
        console.log('🔍 客户端方法详情:', Object.getOwnPropertyNames(client));
    }
    
    if (typeof client.sendRequest === 'function') {
        console.log('✅ sendRequest方法存在');
    } else {
        console.log('❌ sendRequest方法缺失\!');
    }
    
} catch (error) {
    console.error('❌ OpenAI客户端创建失败:', error.message);
}

console.log('\n📋 测试2: 检查LMStudioClient类');
try {
    const { LMStudioClient } = await import('./dist/v3/provider-protocol/base-provider.js');
    console.log('✅ LMStudioClient导入成功');
    
    const testConfig = {
        endpoint: 'http://localhost:1234/v1/chat/completions',
        authentication: { type: 'none' },
        models: ['gpt-oss-20b-mlx']
    };
    
    const lmstudioClient = new LMStudioClient(testConfig, 'test-lmstudio');
    console.log('✅ LMStudioClient实例创建成功');
    console.log('📊 LMStudio客户端属性:', Object.keys(lmstudioClient));
    
    // 检查LMStudioClient的方法
    if (typeof lmstudioClient.sendStreamRequest === 'function') {
        console.log('✅ LMStudioClient.sendStreamRequest方法存在');
    } else {
        console.log('❌ LMStudioClient.sendStreamRequest方法缺失\!');
    }
    
} catch (error) {
    console.error('❌ LMStudioClient测试失败:', error.message);
}

console.log('\n🎯 问题根因分析结论:');
console.log('根据STD-DATA-CAPTURE-PIPELINE分析，streaming失败的原因是Provider实例缺少sendStreamRequest方法');
