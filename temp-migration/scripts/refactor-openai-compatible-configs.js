/**
 * 重构OpenAI兼容配置文件脚本
 * 将所有OpenAI兼容的第三方Provider统一到openai-compatible架构
 * 
 * Project owner: Jason Zhang
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

class OpenAICompatibleRefactor {
    constructor() {
        this.v3ConfigDir = path.join(os.homedir(), '.route-claudecode/config/v3');
        this.results = {
            totalFiles: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
            details: []
        };
    }

    async refactorAll() {
        console.log('🔧 开始重构OpenAI兼容配置文件...\n');

        // 需要重构的文件映射
        const refactorMap = {
            'single-provider/config-openai-shuaihong-v3-5508.json': this.refactorShuaiHong.bind(this),
            'single-provider/config-openai-shuaihong-enhanced-v3-5508.json': this.refactorShuaiHongEnhanced.bind(this),
            'single-provider/config-openai-modelscope-v3-5507.json': this.refactorModelScope.bind(this),
            'load-balancing/config-multi-provider-v3-3456.json': this.refactorMultiProvider.bind(this)
        };

        for (const [relativePath, refactorFn] of Object.entries(refactorMap)) {
            await this.refactorConfigFile(relativePath, refactorFn);
        }

        this.printSummary();
        return this.results.errors === 0;
    }

    async refactorConfigFile(relativePath, refactorFn) {
        this.results.totalFiles++;
        const fullPath = path.join(this.v3ConfigDir, relativePath);
        
        try {
            console.log(`🔧 重构配置文件: ${relativePath}`);
            
            if (!fs.existsSync(fullPath)) {
                console.log(`   ⚠️  文件不存在，跳过: ${relativePath}`);
                this.results.skipped++;
                this.results.details.push({
                    file: relativePath,
                    status: 'skipped',
                    reason: '文件不存在'
                });
                return;
            }

            // 读取配置文件
            const config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            
            // 备份原文件
            const backupPath = fullPath + '.backup-openai-refactor';
            fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
            
            // 执行重构
            const refactoredConfig = refactorFn(config);
            
            // 保存重构后的配置
            fs.writeFileSync(fullPath, JSON.stringify(refactoredConfig, null, 2));
            
            this.results.updated++;
            this.results.details.push({
                file: relativePath,
                status: 'updated',
                changes: this.getChangeSummary(config, refactoredConfig)
            });
            
            console.log(`   ✅ ${relativePath} 重构完成`);
            
        } catch (error) {
            this.results.errors++;
            this.results.details.push({
                file: relativePath,
                status: 'error',
                error: error.message
            });
            
            console.log(`   ❌ ${relativePath} 重构失败: ${error.message}`);
        }
    }

    refactorShuaiHong(config) {
        // 将shuaihong-openai-v3重命名为shuaihong-openai-compatible-v3
        const oldProviderName = 'shuaihong-openai-v3';
        const newProviderName = 'shuaihong-openai-compatible-v3';
        
        // 更新provider配置
        if (config.providers && config.providers[oldProviderName]) {
            config.providers[newProviderName] = config.providers[oldProviderName];
            delete config.providers[oldProviderName];
        }
        
        // 更新路由配置
        if (config.routing) {
            for (const category of Object.keys(config.routing)) {
                if (config.routing[category].provider === oldProviderName) {
                    config.routing[category].provider = newProviderName;
                }
            }
        }
        
        // 更新名称和描述
        config.name = config.name.replace('ShuaiHong OpenAI-Compatible', 'ShuaiHong OpenAI-Compatible Unified');
        config.description = config.description.replace('Updated v3.0 configuration', 'Unified OpenAI-Compatible v3.0 configuration');
        
        // 更新元数据
        if (config.metadata) {
            config.metadata.updateInfo = {
                ...config.metadata.updateInfo,
                updatedAt: new Date().toISOString(),
                updateReason: 'OpenAI-Compatible architecture unification',
                refactorType: 'provider-protocol-unification'
            };
        }
        
        return config;
    }

    refactorShuaiHongEnhanced(config) {
        // 将shuaihong-enhanced-v3重命名为shuaihong-enhanced-openai-compatible-v3
        const oldProviderName = 'shuaihong-enhanced-v3';
        const newProviderName = 'shuaihong-enhanced-openai-compatible-v3';
        
        // 更新provider配置
        if (config.providers && config.providers[oldProviderName]) {
            config.providers[newProviderName] = config.providers[oldProviderName];
            delete config.providers[oldProviderName];
        }
        
        // 更新路由配置
        if (config.routing) {
            for (const category of Object.keys(config.routing)) {
                if (config.routing[category].provider === oldProviderName) {
                    config.routing[category].provider = newProviderName;
                }
            }
        }
        
        // 更新名称和描述
        config.name = config.name.replace('ShuaiHong Enhanced OpenAI-Compatible', 'ShuaiHong Enhanced OpenAI-Compatible Unified');
        config.description = config.description.replace('Updated v3.0 configuration', 'Unified OpenAI-Compatible v3.0 configuration');
        
        // 更新元数据
        if (config.metadata) {
            config.metadata.updateInfo = {
                ...config.metadata.updateInfo,
                updatedAt: new Date().toISOString(),
                updateReason: 'OpenAI-Compatible architecture unification',
                refactorType: 'provider-protocol-unification'
            };
        }
        
        return config;
    }

    refactorModelScope(config) {
        // 将modelscope-openai-v3重命名为modelscope-openai-compatible-v3
        const oldProviderName = 'modelscope-openai-v3';
        const newProviderName = 'modelscope-openai-compatible-v3';
        
        // 更新provider配置
        if (config.providers && config.providers[oldProviderName]) {
            config.providers[newProviderName] = config.providers[oldProviderName];
            delete config.providers[oldProviderName];
        }
        
        // 更新路由配置
        if (config.routing) {
            for (const category of Object.keys(config.routing)) {
                if (config.routing[category].provider === oldProviderName) {
                    config.routing[category].provider = newProviderName;
                }
            }
        }
        
        // 更新名称和描述
        config.name = config.name.replace('ModelScope OpenAI-Compatible', 'ModelScope OpenAI-Compatible Unified');
        config.description = config.description.replace('Updated v3.0 configuration', 'Unified OpenAI-Compatible v3.0 configuration');
        
        // 更新元数据
        if (config.metadata) {
            config.metadata.updateInfo = {
                ...config.metadata.updateInfo,
                updatedAt: new Date().toISOString(),
                updateReason: 'OpenAI-Compatible architecture unification',
                refactorType: 'provider-protocol-unification'
            };
        }
        
        return config;
    }

    refactorMultiProvider(config) {
        // 重命名多个providers
        const providerRenames = {
            'shuaihong-openai-v3': 'shuaihong-openai-compatible-v3',
            'google-gemini-v3': 'google-gemini-v3', // 保持不变
            'codewhisperer-primary-v3': 'codewhisperer-primary-v3', // 保持不变
            'lmstudio-enhanced': 'lmstudio-enhanced' // 保持不变
        };
        
        // 更新provider配置
        if (config.providers) {
            for (const [oldName, newName] of Object.entries(providerRenames)) {
                if (config.providers[oldName] && oldName !== newName) {
                    config.providers[newName] = config.providers[oldName];
                    delete config.providers[oldName];
                }
            }
        }
        
        // 更新路由配置
        if (config.routing) {
            for (const category of Object.keys(config.routing)) {
                const oldProvider = config.routing[category].provider;
                const newProvider = providerRenames[oldProvider];
                if (newProvider && newProvider !== oldProvider) {
                    config.routing[category].provider = newProvider;
                }
            }
        }
        
        // 更新名称和描述
        config.name = config.name.replace('Multi-Provider Load Balancing', 'Unified Multi-Provider Load Balancing');
        config.description = config.description.replace('Updated v3.0 configuration', 'Unified OpenAI-Compatible v3.0 configuration');
        
        // 更新元数据
        if (config.metadata) {
            config.metadata.updateInfo = {
                ...config.metadata.updateInfo,
                updatedAt: new Date().toISOString(),
                updateReason: 'OpenAI-Compatible architecture unification',
                refactorType: 'multi-provider-protocol-unification'
            };
        }
        
        return config;
    }

    getChangeSummary(oldConfig, newConfig) {
        const changes = [];
        
        // 检查provider名称变化
        const oldProviders = Object.keys(oldConfig.providers || {});
        const newProviders = Object.keys(newConfig.providers || {});
        
        oldProviders.forEach(oldName => {
            if (!newProviders.includes(oldName)) {
                const newName = newProviders.find(name => name.includes(oldName.split('-')[0]));
                if (newName) {
                    changes.push(`Provider重命名: ${oldName} → ${newName}`);
                }
            }
        });
        
        // 检查名称变化
        if (oldConfig.name !== newConfig.name) {
            changes.push(`配置名称更新`);
        }
        
        return changes;
    }

    printSummary() {
        console.log('\\n📊 OpenAI兼容配置文件重构结果汇总:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📁 总文件数: ${this.results.totalFiles}`);
        console.log(`✅ 重构成功: ${this.results.updated}`);
        console.log(`⚠️  跳过文件: ${this.results.skipped}`);
        console.log(`❌ 重构失败: ${this.results.errors}`);
        console.log(`🎯 成功率: ${((this.results.updated / this.results.totalFiles) * 100).toFixed(1)}%`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (this.results.updated > 0) {
            console.log('\\n✅ 重构成功的文件:');
            this.results.details
                .filter(r => r.status === 'updated')
                .forEach(result => {
                    console.log(`   • ${result.file}`);
                    if (result.changes && result.changes.length > 0) {
                        result.changes.forEach(change => {
                            console.log(`     - ${change}`);
                        });
                    }
                });
        }

        if (this.results.errors > 0) {
            console.log('\\n❌ 重构失败的文件:');
            this.results.details
                .filter(r => r.status === 'error')
                .forEach(result => {
                    console.log(`   • ${result.file}: ${result.error}`);
                });
        }

        if (this.results.skipped > 0) {
            console.log('\\n⚠️  跳过的文件:');
            this.results.details
                .filter(r => r.status === 'skipped')
                .forEach(result => {
                    console.log(`   • ${result.file}: ${result.reason}`);
                });
        }

        console.log('\\n🏗️ 架构重构目标:');
        console.log('  • 统一OpenAI兼容Provider-Protocol架构');
        console.log('  • 将第三方服务统一到openai-compatible类型');
        console.log('  • 保持Provider-Protocol分离原则');
        console.log('  • 简化配置管理和维护');
    }

    getResults() {
        return this.results;
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    const refactor = new OpenAICompatibleRefactor();
    refactor.refactorAll().then(success => {
        if (success) {
            console.log('\\n🎉 OpenAI兼容配置文件重构完成！');
            process.exit(0);
        } else {
            console.log('\\n❌ 重构过程中遇到错误');
            process.exit(1);
        }
    });
}

export default OpenAICompatibleRefactor;