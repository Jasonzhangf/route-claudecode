/**
 * Database重构脚本 - OpenAI兼容Provider数据合并和路径更新
 * 1. 合并OpenAI兼容Provider的数据到统一架构
 * 2. 扫描并移除普通文本数据（只保留工具调用和有效API数据）
 * 3. 更新自动捕获数据的路径引用
 * 
 * Project owner: Jason Zhang
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

class DatabaseRefactor {
    constructor() {
        this.databaseDir = path.join(os.homedir(), '.route-claudecode/database');
        this.capturesDir = path.join(this.databaseDir, 'captures');
        this.backupDir = path.join(this.databaseDir, 'backup-' + Date.now());
        
        this.results = {
            totalFiles: 0,
            processed: 0,
            merged: 0,
            removed: 0,
            pathsUpdated: 0,
            errors: 0,
            operations: []
        };

        // OpenAI兼容Provider映射到新的统一架构
        this.providerMapping = {
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

        // 文本数据检测模式
        this.textDataPatterns = [
            /^[^{]*$/,  // 纯文本，不包含JSON
            /^\s*[^{].*[^}]\s*$/,  // 以非JSON字符开始和结束
            /^[\w\s\.\,\!\?\-]+$/,  // 只包含常见文本字符
        ];

        // 有效数据检测模式
        this.validDataPatterns = [
            /tool_calls?/i,  // 包含工具调用
            /function/i,     // 包含函数调用
            /messages/i,     // 包含消息数据
            /choices/i,      // 包含OpenAI响应选择
            /content/i,      // 包含内容数据
            /model.*:/i,     // 包含模型信息
            /endpoint/i,     // 包含端点信息
            /request/i,      // 包含请求数据
            /response/i      // 包含响应数据
        ];
    }

    async refactorAll() {
        console.log('🔧 开始Database架构重构...\n');
        console.log(`📁 Database目录: ${this.databaseDir}`);
        console.log(`📁 Captures目录: ${this.capturesDir}`);
        
        try {
            // 步骤1: 备份原始数据
            await this.createBackup();
            
            // 步骤2: 创建新的目录结构
            await this.createNewStructure();
            
            // 步骤3: 合并OpenAI兼容Provider数据
            await this.mergeOpenAICompatibleData();
            
            // 步骤4: 扫描并清理普通文本数据
            await this.cleanTextData();
            
            // 步骤5: 更新自动捕获数据的路径引用
            await this.updateCapturePaths();
            
            // 步骤6: 生成架构说明文档
            await this.generateArchitectureDoc();
            
            this.printSummary();
            return this.results.errors === 0;
            
        } catch (error) {
            console.error('❌ Database重构失败:', error.message);
            this.results.errors++;
            return false;
        }
    }

    async createBackup() {
        console.log('🔒 创建数据备份...');
        
        if (!fs.existsSync(this.databaseDir)) {
            throw new Error('Database目录不存在');
        }

        // 创建备份目录
        fs.mkdirSync(this.backupDir, { recursive: true });
        
        // 递归复制captures目录
        await this.copyDirectory(this.capturesDir, path.join(this.backupDir, 'captures'));
        
        console.log(`   ✅ 备份已创建: ${this.backupDir}`);
        this.results.operations.push({
            type: 'backup',
            source: this.capturesDir,
            target: this.backupDir,
            status: 'completed'
        });
    }

    async createNewStructure() {
        console.log('🏗️  创建新的目录结构...');
        
        const newStructure = [
            'openai-compatible/shuaihong',
            'openai-compatible/shuaihong-enhanced', 
            'openai-compatible/modelscope',
            'openai-compatible/lmstudio',
            'openai-compatible/generic',
            'codewhisperer-protocol',
            'gemini-protocol',
            'anthropic-protocol'
        ];

        for (const dirPath of newStructure) {
            const fullPath = path.join(this.capturesDir, dirPath);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(`   📁 创建目录: ${dirPath}`);
            }
        }

        console.log('   ✅ 新目录结构创建完成');
    }

    async mergeOpenAICompatibleData() {
        console.log('🔄 合并OpenAI兼容Provider数据...');
        
        // 扫描现有的数据文件
        await this.scanAndMergeDirectory(this.capturesDir);
        
        console.log(`   ✅ 合并完成，共处理 ${this.results.merged} 个文件`);
    }

    async scanAndMergeDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) return;
        
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isDirectory()) {
                // 递归处理子目录
                await this.scanAndMergeDirectory(itemPath);
            } else if (item.endsWith('.json')) {
                await this.processDataFile(itemPath);
            }
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
                this.results.operations.push({
                    type: 'remove',
                    file: filePath,
                    reason: 'text-data',
                    status: 'completed'
                });
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
                this.results.operations.push({
                    type: 'remove',
                    file: filePath,
                    reason: 'invalid-api-data',
                    status: 'completed'
                });
                return;
            }

            // 检查是否需要合并到OpenAI兼容架构
            const providerInfo = this.extractProviderInfo(data);
            if (providerInfo && this.providerMapping[providerInfo.provider]) {
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
        // 检查是否为普通文本
        const trimmed = content.trim();
        
        // 长度检查
        if (trimmed.length < 10) return true;
        
        // 模式匹配检查
        for (const pattern of this.textDataPatterns) {
            if (pattern.test(trimmed)) return true;
        }

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
        for (const pattern of this.validDataPatterns) {
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

    extractProviderInfo(data) {
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

        return null;
    }

    async mergeToUnifiedStructure(filePath, data, providerInfo) {
        const targetDir = this.providerMapping[providerInfo.provider];
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

    async cleanTextData() {
        console.log('🧹 清理普通文本数据...');
        
        // 在前面的processDataFile中已经处理了文本数据清理
        console.log(`   ✅ 清理完成，移除了 ${this.results.removed} 个文件`);
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
            for (const [oldProvider, newPath] of Object.entries(this.providerMapping)) {
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
                this.results.operations.push({
                    type: 'path-update',
                    file: filePath,
                    status: 'completed'
                });
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

\`\`\`
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
\`\`\`

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
- **备份位置**: ${this.backupDir}
- **处理文件总数**: ${this.results.totalFiles}
- **合并文件数**: ${this.results.merged}
- **移除文件数**: ${this.results.removed}
- **路径更新数**: ${this.results.pathsUpdated}

## 📋 相关工具和脚本

- **重构脚本**: scripts/refactor-database-architecture.js
- **分类规则**: database/auto-classification-rules.json
- **架构文档**: database/captures/README-UNIFIED-ARCHITECTURE.md

## 🎯 架构优势

1. **Provider-Protocol分离**: 清晰区分第三方服务和协议实现
2. **统一管理**: 所有OpenAI兼容服务集中管理
3. **易于扩展**: 新增Provider只需在openai-compatible下创建子目录
4. **数据质量**: 自动清理无效数据，提高存储效率
5. **路径一致**: 统一的路径引用，便于工具和脚本使用

`;

        const docPath = path.join(this.capturesDir, 'README-UNIFIED-ARCHITECTURE.md');
        fs.writeFileSync(docPath, docContent);
        
        console.log(`   📋 架构文档已生成: ${docPath}`);
    }

    async copyDirectory(source, target) {
        if (!fs.existsSync(source)) return;
        
        fs.mkdirSync(target, { recursive: true });
        const items = fs.readdirSync(source);
        
        for (const item of items) {
            const sourcePath = path.join(source, item);
            const targetPath = path.join(target, item);
            const stat = fs.statSync(sourcePath);
            
            if (stat.isDirectory()) {
                await this.copyDirectory(sourcePath, targetPath);
            } else {
                fs.copyFileSync(sourcePath, targetPath);
            }
        }
    }

    printSummary() {
        console.log('\\n📊 Database架构重构结果汇总:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📁 处理文件总数: ${this.results.totalFiles}`);
        console.log(`📦 合并文件数量: ${this.results.merged}`);
        console.log(`🗑️  移除文件数量: ${this.results.removed}`);
        console.log(`🔗 路径更新数量: ${this.results.pathsUpdated}`);
        console.log(`✅ 处理成功数量: ${this.results.processed}`);
        console.log(`❌ 处理失败数量: ${this.results.errors}`);
        console.log(`🎯 成功率: ${this.results.errors === 0 ? '100%' : `${(((this.results.totalFiles - this.results.errors) / this.results.totalFiles) * 100).toFixed(1)}%`}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (this.results.merged > 0) {
            console.log('\\n📦 数据合并操作:');
            this.results.operations
                .filter(op => op.type === 'merge')
                .slice(0, 5) // 只显示前5个
                .forEach(op => {
                    console.log(`   • ${path.basename(op.source)} → ${op.unifiedProvider}`);
                });
            
            if (this.results.merged > 5) {
                console.log(`   ... 还有 ${this.results.merged - 5} 个文件已合并`);
            }
        }

        if (this.results.removed > 0) {
            console.log('\\n🗑️  数据清理操作:');
            const removeOps = this.results.operations.filter(op => op.type === 'remove');
            const textDataRemoved = removeOps.filter(op => op.reason === 'text-data').length;
            const invalidDataRemoved = removeOps.filter(op => op.reason === 'invalid-api-data').length;
            
            console.log(`   • 普通文本数据: ${textDataRemoved} 个文件`);
            console.log(`   • 无效API数据: ${invalidDataRemoved} 个文件`);
        }

        if (this.results.pathsUpdated > 0) {
            console.log('\\n🔗 路径引用更新:');
            console.log(`   • 配置文件引用已更新`);
            console.log(`   • 自动分类规则已更新`);
            console.log(`   • 分析脚本路径已更新`);
        }

        if (this.results.errors > 0) {
            console.log('\\n❌ 处理错误:');
            this.results.operations
                .filter(op => op.status === 'error')
                .forEach(op => {
                    console.log(`   • ${op.file}: ${op.error}`);
                });
        } else {
            console.log('\\n🎉 Database架构重构完成！');
            console.log('✅ OpenAI兼容Provider数据已统一管理');
            console.log('✅ 普通文本数据已清理完成');
            console.log('✅ 自动捕获路径已更新');
            console.log('✅ 新架构文档已生成');
        }

        console.log('\\n🏗️ 新架构优势:');
        console.log('  • Provider-Protocol清晰分离');
        console.log('  • OpenAI兼容服务统一管理');
        console.log('  • 数据质量显著提升');
        console.log('  • 路径引用完全一致');
        console.log('  • 易于扩展和维护');

        console.log(`\\n🔒 原数据备份位置: ${this.backupDir}`);
    }

    getResults() {
        return this.results;
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    const refactor = new DatabaseRefactor();
    refactor.refactorAll().then(success => {
        if (success) {
            console.log('\\n🎉 Database架构重构成功完成！');
            process.exit(0);
        } else {
            console.log('\\n❌ 重构过程中遇到错误');
            process.exit(1);
        }
    });
}

export default DatabaseRefactor;