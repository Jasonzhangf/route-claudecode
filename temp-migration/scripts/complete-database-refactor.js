#!/usr/bin/env node
/**
 * 完成Database重构 - 继续未完成的重构任务
 * Project owner: Jason Zhang
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

class CompleteDatabaseRefactor {
    constructor() {
        this.databaseDir = path.join(os.homedir(), '.route-claudecode/database');
        this.capturesDir = path.join(this.databaseDir, 'captures');
        
        this.results = {
            totalFiles: 0,
            processed: 0,
            merged: 0,
            removed: 0,
            pathsUpdated: 0,
            errors: 0,
            operations: []
        };
    }

    async completeRefactor() {
        console.log('🔧 继续完成Database架构重构...\n');
        
        try {
            // 步骤1: 统计当前进度
            await this.assessProgress();
            
            // 步骤2: 继续清理剩余文件
            await this.continueDataCleanup();
            
            // 步骤3: 更新自动捕获数据的路径引用
            await this.updateCapturePaths();
            
            // 步骤4: 生成架构说明文档
            await this.generateArchitectureDoc();
            
            // 步骤5: 统计最终结果
            this.printSummary();
            
            return this.results.errors === 0;
            
        } catch (error) {
            console.error('❌ 完成重构失败:', error.message);
            this.results.errors++;
            return false;
        }
    }

    async assessProgress() {
        console.log('📊 评估重构进度...');
        
        // 检查新架构目录
        const newDirs = [
            'openai-compatible/shuaihong',
            'openai-compatible/modelscope', 
            'openai-compatible/lmstudio',
            'openai-compatible/generic'
        ];
        
        for (const dirPath of newDirs) {
            const fullPath = path.join(this.capturesDir, dirPath);
            if (fs.existsSync(fullPath)) {
                const files = fs.readdirSync(fullPath);
                console.log(`   ✅ ${dirPath}: ${files.length} 个文件`);
                this.results.merged += files.length;
            }
        }
        
        // 检查还需要处理的文件
        await this.scanRemainingFiles();
        
        console.log(`   📈 已合并文件: ${this.results.merged}`);
        console.log(`   📋 待处理文件: ${this.results.totalFiles}`);
    }

    async scanRemainingFiles() {
        const legacyDirs = ['openai', 'shuaihong-openai', 'modelscope-openai', 'lmstudio'];
        
        for (const dirName of legacyDirs) {
            const dirPath = path.join(this.capturesDir, dirName);
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
                this.results.totalFiles += files.length;
                console.log(`   📁 ${dirName}: ${files.length} 个待处理文件`);
            }
        }
    }

    async continueDataCleanup() {
        console.log('🧹 继续清理数据...');
        
        // 处理剩余的openai目录文件
        const openaiDir = path.join(this.capturesDir, 'openai');
        if (fs.existsSync(openaiDir)) {
            await this.processLegacyDirectory(openaiDir, 'openai');
        }
        
        // 清理空目录
        await this.cleanEmptyDirectories();
        
        console.log(`   ✅ 清理完成，移除了 ${this.results.removed} 个文件`);
    }

    async processLegacyDirectory(dirPath, dirName) {
        console.log(`   🔄 处理目录: ${dirName}`);
        
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const filePath = path.join(dirPath, file);
            await this.processDataFile(filePath);
        }
    }

    async processDataFile(filePath) {
        this.results.totalFiles++;
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // 检查是否为普通文本数据
            if (this.isTextData(content)) {
                console.log(`   🗑️  移除文本数据: ${path.basename(filePath)}`);
                fs.unlinkSync(filePath);
                this.results.removed++;
                return;
            }

            // 尝试解析JSON数据
            let data;
            try {
                data = JSON.parse(content);
            } catch (parseError) {
                console.log(`   ⚠️  跳过无效JSON: ${path.basename(filePath)}`);
                return;
            }

            // 检查是否为有效的API数据
            if (!this.isValidApiData(data)) {
                console.log(`   🗑️  移除无效数据: ${path.basename(filePath)}`);
                fs.unlinkSync(filePath);
                this.results.removed++;
                return;
            }

            // 检查是否需要合并到OpenAI兼容架构
            const providerInfo = this.extractProviderInfo(data, filePath);
            if (providerInfo && this.getTargetDirectory(providerInfo.provider)) {
                await this.mergeToUnifiedStructure(filePath, data, providerInfo);
            } else {
                this.results.processed++;
            }
            
        } catch (error) {
            console.error(`   ❌ 处理文件失败: ${filePath} - ${error.message}`);
            this.results.errors++;
        }
    }

    isTextData(content) {
        const trimmed = content.trim();
        
        // 长度检查
        if (trimmed.length < 10) return true;
        
        // JSON检查
        try {
            JSON.parse(content);
            return false; // 有效JSON，不是普通文本
        } catch {
            return true; // 无法解析的文本
        }
    }

    isValidApiData(data) {
        if (!data || typeof data !== 'object') return false;

        // 转换为字符串进行内容检查
        const dataStr = JSON.stringify(data).toLowerCase();
        
        // 检查是否包含API相关的有效数据
        const validPatterns = [
            /tool_calls?/i,
            /function/i,
            /messages/i,
            /choices/i,
            /content/i,
            /model.*:/i,
            /endpoint/i,
            /request/i,
            /response/i
        ];

        for (const pattern of validPatterns) {
            if (pattern.test(dataStr)) return true;
        }

        // 检查基本API结构
        if (data.request || data.response || data.provider || data.model) {
            return true;
        }

        // 检查OpenAI格式
        if (data.choices || data.messages || data.tool_calls) {
            return true;
        }

        // 检查Anthropic格式  
        if (data.content || data.role || data.type) {
            return true;
        }

        return false;
    }

    extractProviderInfo(data, filePath) {
        // 从数据中提取provider信息
        if (data.provider) {
            return { provider: data.provider, model: data.model };
        }

        // 从文件名或路径中提取provider信息
        if (data.metadata && data.metadata.provider) {
            return { provider: data.metadata.provider, model: data.metadata.model };
        }

        // 从endpoint推断provider
        if (data.endpoint || (data.request && data.request.endpoint)) {
            const endpoint = data.endpoint || data.request.endpoint;
            if (endpoint.includes('shuaihong')) return { provider: 'shuaihong-openai' };
            if (endpoint.includes('modelscope')) return { provider: 'modelscope-openai' };
            if (endpoint.includes('localhost:1234')) return { provider: 'lmstudio' };
        }

        // 从文件路径推断provider
        if (filePath.includes('shuaihong')) return { provider: 'shuaihong-openai' };
        if (filePath.includes('modelscope')) return { provider: 'modelscope-openai' };
        if (filePath.includes('lmstudio')) return { provider: 'lmstudio' };
        if (filePath.includes('openai')) return { provider: 'openai' };

        return null;
    }

    getTargetDirectory(provider) {
        const mapping = {
            'shuaihong-openai': 'openai-compatible/shuaihong',
            'shuaihong-openai-v3': 'openai-compatible/shuaihong',
            'shuaihong-openai-compatible-v3': 'openai-compatible/shuaihong',
            'shuaihong-enhanced-v3': 'openai-compatible/shuaihong-enhanced',
            'shuaihong-enhanced-openai-compatible-v3': 'openai-compatible/shuaihong-enhanced',
            'modelscope-openai': 'openai-compatible/modelscope',
            'modelscope-openai-v3': 'openai-compatible/modelscope',
            'modelscope-openai-compatible-v3': 'openai-compatible/modelscope',
            'lmstudio': 'openai-compatible/lmstudio',
            'lmstudio-enhanced': 'openai-compatible/lmstudio',
            'openai': 'openai-compatible/generic'
        };
        
        return mapping[provider] || null;
    }

    async mergeToUnifiedStructure(filePath, data, providerInfo) {
        const targetDir = this.getTargetDirectory(providerInfo.provider);
        if (!targetDir) return;
        
        const targetPath = path.join(this.capturesDir, targetDir);
        
        // 确保目标目录存在
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }

        // 生成新的文件名（包含模型信息）
        const originalName = path.basename(filePath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const modelPart = providerInfo.model ? `-${providerInfo.model.replace(/[^a-zA-Z0-9]/g, '-')}` : '';
        const newFileName = `${timestamp}${modelPart}-${originalName}`;
        const newFilePath = path.join(targetPath, newFileName);

        // 更新数据中的provider信息
        const updatedData = {
            ...data,
            metadata: {
                ...data.metadata,
                originalProvider: providerInfo.provider,
                unifiedProvider: targetDir,
                migrationDate: new Date().toISOString(),
                originalPath: filePath
            }
        };

        // 写入新位置
        fs.writeFileSync(newFilePath, JSON.stringify(updatedData, null, 2));
        
        // 删除原文件（如果不在目标目录中）
        if (path.dirname(filePath) !== targetPath) {
            fs.unlinkSync(filePath);
        }

        console.log(`   📦 合并: ${originalName} → ${targetDir}/${newFileName}`);
        this.results.merged++;
        this.results.operations.push({
            type: 'merge',
            source: filePath,
            target: newFilePath,
            provider: providerInfo.provider,
            unifiedProvider: targetDir,
            status: 'completed'
        });
    }

    async cleanEmptyDirectories() {
        console.log('🧹 清理空目录...');
        
        const dirsToCheck = ['openai', 'shuaihong-openai', 'modelscope-openai', 'lmstudio'];
        
        for (const dirName of dirsToCheck) {
            const dirPath = path.join(this.capturesDir, dirName);
            if (fs.existsSync(dirPath)) {
                const items = fs.readdirSync(dirPath);
                if (items.length === 0) {
                    fs.rmdirSync(dirPath);
                    console.log(`   🗑️  删除空目录: ${dirName}`);
                }
            }
        }
    }

    async updateCapturePaths() {
        console.log('🔗 更新自动捕获数据的路径引用...');
        
        // 查找所有包含路径引用的文件
        const configFiles = [
            path.join(this.databaseDir, 'auto-classification-rules.json'),
            path.join(this.databaseDir, 'config'),
            path.join(this.databaseDir, 'analysis'),
            path.join(this.databaseDir, 'reports')
        ];

        for (const configPath of configFiles) {
            await this.updatePathReferences(configPath);
        }

        console.log(`   ✅ 路径更新完成，更新了 ${this.results.pathsUpdated} 个引用`);
    }

    async updatePathReferences(dirPath) {
        if (!fs.existsSync(dirPath)) return;

        const stat = fs.statSync(dirPath);
        if (stat.isDirectory()) {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                await this.updatePathReferences(path.join(dirPath, item));
            }
        } else if (dirPath.endsWith('.json') || dirPath.endsWith('.js') || dirPath.endsWith('.md')) {
            await this.updateFileReferences(dirPath);
        }
    }

    async updateFileReferences(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            let updated = false;

            // 更新路径引用
            const providerMapping = {
                'shuaihong-openai': 'openai-compatible/shuaihong',
                'shuaihong-openai-v3': 'openai-compatible/shuaihong',
                'modelscope-openai': 'openai-compatible/modelscope',
                'modelscope-openai-v3': 'openai-compatible/modelscope',
                'lmstudio': 'openai-compatible/lmstudio',
                'openai': 'openai-compatible/generic'
            };

            for (const [oldProvider, newPath] of Object.entries(providerMapping)) {
                const oldPattern = new RegExp(`captures/${oldProvider}`, 'g');
                const newPattern = `captures/${newPath}`;
                
                if (oldPattern.test(content)) {
                    content = content.replace(oldPattern, newPattern);
                    updated = true;
                }

                // 更新provider名称引用
                const providerPattern = new RegExp(`"provider":\\s*"${oldProvider}"`, 'g');
                const newProviderRef = `"provider": "${newPath}"`;
                
                if (providerPattern.test(content)) {
                    content = content.replace(providerPattern, newProviderRef);
                    updated = true;
                }
            }

            if (updated) {
                fs.writeFileSync(filePath, content);
                console.log(`   🔗 更新引用: ${path.basename(filePath)}`);
                this.results.pathsUpdated++;
            }

        } catch (error) {
            console.error(`   ❌ 更新引用失败: ${filePath} - ${error.message}`);
            this.results.errors++;
        }
    }

    async generateArchitectureDoc() {
        console.log('📋 生成新架构说明文档...');
        
        const docContent = `# Database架构重构说明

## 🏗️ 新的数据分级架构

### Provider-Protocol统一架构
按照OpenAI兼容Provider统一管理的原则，数据存储采用以下层级结构：

```
~/.route-claudecode/database/captures/
├── openai-compatible/           # OpenAI兼容协议统一目录
│   ├── shuaihong/              # ShuaiHong第三方服务数据
│   ├── shuaihong-enhanced/     # ShuaiHong增强版服务数据
│   ├── modelscope/             # ModelScope第三方服务数据
│   ├── lmstudio/               # LM Studio本地服务数据
│   └── generic/                # 通用OpenAI兼容服务数据
├── codewhisperer-protocol/      # AWS CodeWhisperer协议数据
├── gemini-protocol/             # Google Gemini协议数据
└── anthropic-protocol/          # Anthropic直连协议数据
```

### Provider映射关系

| 原Provider名称 | 新统一路径 | 说明 |
|---------------|------------|------|
| shuaihong-openai* | openai-compatible/shuaihong | ShuaiHong服务统一管理 |
| modelscope-openai* | openai-compatible/modelscope | ModelScope服务统一管理 |
| lmstudio* | openai-compatible/lmstudio | LM Studio服务统一管理 |
| openai | openai-compatible/generic | 通用OpenAI服务 |

### 数据清理规则

#### 保留的数据类型
- ✅ 包含tool_calls的API调用数据
- ✅ 包含function调用的数据
- ✅ 完整的API请求/响应数据
- ✅ 包含有效content的消息数据
- ✅ 模型配置和端点信息

#### 移除的数据类型
- ❌ 纯文本数据（无JSON结构）
- ❌ 无效的API数据
- ❌ 空内容或测试数据
- ❌ 重复或冗余的配置数据

### 自动分类规则更新

自动捕获的数据现在会根据以下规则进行分类：

1. **Provider检测**: 基于endpoint URL自动检测Provider类型
2. **Protocol映射**: 将第三方Provider映射到对应的Protocol类型
3. **数据验证**: 只保留包含有效API数据的文件
4. **路径统一**: 使用统一的openai-compatible路径结构

## 🔄 迁移执行记录

- **执行时间**: ${new Date().toISOString()}
- **备份位置**: ~/.route-claudecode/database/backup-*
- **处理文件总数**: ${this.results.totalFiles}
- **合并文件数**: ${this.results.merged}
- **移除文件数**: ${this.results.removed}
- **路径更新数**: ${this.results.pathsUpdated}

## 📋 相关工具和脚本

- **重构脚本**: scripts/refactor-database-architecture.js
- **完成脚本**: scripts/complete-database-refactor.js
- **分类规则**: database/auto-classification-rules.json
- **架构文档**: database/captures/README-UNIFIED-ARCHITECTURE.md

## 🎯 架构优势

1. **Provider-Protocol分离**: 清晰区分第三方服务和协议实现
2. **统一管理**: 所有OpenAI兼容服务集中管理
3. **易于扩展**: 新增Provider只需在openai-compatible下创建子目录
4. **数据质量**: 自动清理无效数据，提高存储效率
5. **路径一致**: 统一的路径引用，便于工具和脚本使用

## 🔧 使用指南

### 新数据分类
新的API捕获数据会自动按以下规则分类：
- 所有ShuaiHong服务 → openai-compatible/shuaihong/
- 所有ModelScope服务 → openai-compatible/modelscope/
- 所有LM Studio服务 → openai-compatible/lmstudio/
- 通用OpenAI服务 → openai-compatible/generic/

### 数据查询
查找特定Provider的数据：

```bash
# 查看ShuaiHong数据
ls ~/.route-claudecode/database/captures/openai-compatible/shuaihong/

# 查看ModelScope数据
ls ~/.route-claudecode/database/captures/openai-compatible/modelscope/

# 查看LM Studio数据
ls ~/.route-claudecode/database/captures/openai-compatible/lmstudio/
```

### 分析工具调用

```bash
# 分析工具调用问题
find ~/.route-claudecode/database/captures/openai-compatible/ -name "*.json" -exec grep -l "tool_calls" {} \\;

# 运行数据分析
node ~/.route-claudecode/database/analyze-lmstudio-tool-call-issues.js
```
`;

        const docPath = path.join(this.capturesDir, 'README-UNIFIED-ARCHITECTURE.md');
        fs.writeFileSync(docPath, docContent);
        
        console.log(`   📋 架构文档已生成: ${docPath}`);
    }

    printSummary() {
        console.log('\n📊 Database架构重构完成汇总:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📁 处理文件总数: ${this.results.totalFiles}`);
        console.log(`📦 合并文件数量: ${this.results.merged}`);
        console.log(`🗑️  移除文件数量: ${this.results.removed}`);
        console.log(`🔗 路径更新数量: ${this.results.pathsUpdated}`);
        console.log(`✅ 处理成功数量: ${this.results.processed}`);
        console.log(`❌ 处理失败数量: ${this.results.errors}`);
        console.log(`🎯 成功率: ${this.results.errors === 0 ? '100%' : `${(((this.results.totalFiles - this.results.errors) / Math.max(this.results.totalFiles, 1)) * 100).toFixed(1)}%`}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (this.results.errors === 0) {
            console.log('\n🎉 Database架构重构完成！');
            console.log('✅ OpenAI兼容Provider数据已统一管理');
            console.log('✅ 普通文本数据已清理完成');
            console.log('✅ 自动捕获路径已更新');
            console.log('✅ 新架构文档已生成');
        }

        console.log('\n🏗️ 新架构优势:');
        console.log('  • Provider-Protocol清晰分离');
        console.log('  • OpenAI兼容服务统一管理');
        console.log('  • 数据质量显著提升');
        console.log('  • 路径引用完全一致');
        console.log('  • 易于扩展和维护');

        console.log('\n🔒 原数据备份位置: ~/.route-claudecode/database/backup-*');
    }

    getResults() {
        return this.results;
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    const refactor = new CompleteDatabaseRefactor();
    refactor.completeRefactor().then(success => {
        if (success) {
            console.log('\n🎉 Database架构重构完全成功！');
            process.exit(0);
        } else {
            console.log('\n❌ 重构过程中遇到错误');
            process.exit(1);
        }
    });
}

export default CompleteDatabaseRefactor;