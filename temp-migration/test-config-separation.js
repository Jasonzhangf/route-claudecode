/**
 * 测试配置分离系统
 * 验证用户配置和系统配置能够正确合并
 */

import { ConfigMerger, loadUserConfig } from './src/v3/config/config-merger.js';
import fs from 'fs';

console.log('🔧 配置分离系统测试开始...\n');

async function testConfigSeparation() {
    try {
        const userConfigFiles = [
            './config/user/user-config-lmstudio.json',
            './config/user/user-config-mixed-providers.json'
        ];

        for (const userConfigFile of userConfigFiles) {
            console.log(`\n📋 测试用户配置: ${userConfigFile}`);
            
            if (!fs.existsSync(userConfigFile)) {
                console.log(`⚠️  用户配置文件不存在，跳过: ${userConfigFile}`);
                continue;
            }

            try {
                // 使用ConfigMerger合并配置
                const mergedConfig = loadUserConfig(userConfigFile);
                
                console.log('✅ 配置合并成功');
                console.log(`   - 服务器端口: ${mergedConfig.server.port}`);
                console.log(`   - 架构版本: ${mergedConfig.server.architecture}`);
                console.log(`   - 环境: ${mergedConfig.server.environment}`);
                console.log(`   - Provider数量: ${Object.keys(mergedConfig.providers).length}`);
                console.log(`   - 路由策略: ${mergedConfig.routing.strategy}`);
                console.log(`   - 路由类别: ${Object.keys(mergedConfig.routing.categories).join(', ')}`);
                
                // 显示详细的Provider信息
                console.log('   📊 Provider详情:');
                for (const [providerName, providerConfig] of Object.entries(mergedConfig.providers)) {
                    console.log(`      - ${providerName}:`);
                    console.log(`        * 类型: ${providerConfig.type}`);
                    console.log(`        * 端点: ${providerConfig.endpoint}`);
                    console.log(`        * 认证: ${providerConfig.authentication.type}`);
                    console.log(`        * 超时: ${providerConfig.timeout}ms`);
                    console.log(`        * 模型: [${providerConfig.models.join(', ')}]`);
                }
                
                // 显示路由配置
                console.log('   🎯 路由配置:');
                for (const [category, categoryConfig] of Object.entries(mergedConfig.routing.categories)) {
                    console.log(`      - ${category}: ${categoryConfig.provider} → ${categoryConfig.model}`);
                }
                
                // 保存合并后的配置用于调试
                const outputFile = `./test-merged-config-${userConfigFile.split('/').pop()}`;
                fs.writeFileSync(outputFile, JSON.stringify(mergedConfig, null, 2));
                console.log(`   💾 合并配置已保存: ${outputFile}`);
                
            } catch (error) {
                console.error(`❌ 配置合并失败: ${error.message}`);
            }
        }
        
        console.log('\n🎉 配置分离系统测试完成！');
        console.log('\n📝 用户配置优势:');
        console.log('   ✅ 简化配置 - 用户只需填写基本信息');
        console.log('   ✅ 自动合并 - 系统配置自动应用');
        console.log('   ✅ 标准化 - 统一的协议映射和错误处理');
        console.log('   ✅ 可维护 - 系统配置统一管理和更新');
        
    } catch (error) {
        console.error('\n❌ 配置分离系统测试失败:');
        console.error('错误消息:', error.message);
        console.error('错误堆栈:\n', error.stack);
        throw error;
    }
}

// 运行测试
testConfigSeparation();