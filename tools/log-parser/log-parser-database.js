#!/usr/bin/env node

/**
 * Claude Code Router - Log Parser Database Tool
 * 
 * 解析CCR日志文件，按Provider分类提取和存储服务器响应数据
 * 
 * @author Jason Zhang
 * @version 1.0.0
 * @created 2025-08-07
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { createReadStream } = require('fs');
const { createInterface } = require('readline');

class LogParserDatabase {
    constructor(configPath = '../config.json') {
        this.config = null;
        this.configPath = path.resolve(__dirname, configPath);
        this.providers = new Map();
        this.stats = {
            totalLines: 0,
            processedEntries: 0,
            errors: 0,
            providers: new Map()
        };
    }

    async initialize() {
        await this.loadConfig();
        await this.ensureDirectories();
        this.logInfo('Log Parser Database initialized');
    }

    async loadConfig() {
        try {
            const configContent = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(configContent);
            this.logInfo(`Configuration loaded from ${this.configPath}`);
        } catch (error) {
            throw new Error(`Failed to load configuration: ${error.message}`);
        }
    }

    async ensureDirectories() {
        const outputPath = this.expandPath(this.config.paths.outputData);
        const tempPath = this.expandPath(this.config.paths.tempDir);
        
        await fs.mkdir(outputPath, { recursive: true });
        await fs.mkdir(tempPath, { recursive: true });
        
        // 为每个Provider创建目录
        for (const provider of this.config.extraction.providers) {
            const providerPath = path.join(outputPath, provider);
            await fs.mkdir(providerPath, { recursive: true });
            
            // 为每个分类创建子目录
            for (const category of this.config.extraction.categories) {
                const categoryPath = path.join(providerPath, category);
                await fs.mkdir(categoryPath, { recursive: true });
            }
        }
    }

    expandPath(filePath) {
        if (filePath.startsWith('~')) {
            return path.join(os.homedir(), filePath.slice(1));
        }
        return path.resolve(filePath);
    }

    async parseLogFiles(logPattern = 'ccr-*.log') {
        const logsPath = this.expandPath(this.config.paths.inputLogs);
        
        try {
            const files = await fs.readdir(logsPath);
            const logFiles = files.filter(file => 
                file.match(logPattern.replace('*', '.*'))
            );

            this.logInfo(`Found ${logFiles.length} log files to process`);

            for (const logFile of logFiles) {
                const filePath = path.join(logsPath, logFile);
                await this.parseLogFile(filePath);
            }

            await this.generateSummaries();
            this.printStats();

        } catch (error) {
            this.logError(`Failed to process log files: ${error.message}`);
            throw error;
        }
    }

    async parseLogFile(filePath) {
        this.logInfo(`Processing log file: ${filePath}`);
        
        const fileStream = createReadStream(filePath);
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let currentRequest = null;
        let buffer = [];

        for await (const line of rl) {
            this.stats.totalLines++;
            
            try {
                const logEntry = this.parseLogLine(line);
                if (!logEntry) continue;

                if (this.isRequestStart(logEntry)) {
                    // 保存前一个请求的数据
                    if (currentRequest) {
                        await this.processRequest(currentRequest, buffer);
                        buffer = [];
                    }
                    currentRequest = logEntry;
                } else if (currentRequest) {
                    buffer.push(logEntry);
                }

            } catch (error) {
                this.stats.errors++;
                this.logError(`Error parsing line: ${error.message}`);
            }
        }

        // 处理最后一个请求
        if (currentRequest && buffer.length > 0) {
            await this.processRequest(currentRequest, buffer);
        }

        this.logInfo(`Completed processing ${filePath}`);
    }

    parseLogLine(line) {
        // 尝试解析JSON格式的日志行
        try {
            if (line.includes('{') && line.includes('}')) {
                const jsonStart = line.indexOf('{');
                const jsonPart = line.substring(jsonStart);
                return JSON.parse(jsonPart);
            }
        } catch (error) {
            // 如果不是JSON，尝试解析结构化日志
            return this.parseStructuredLog(line);
        }
        return null;
    }

    parseStructuredLog(line) {
        // 解析结构化日志格式：[timestamp] [level] [component] message
        const match = line.match(/\[(.*?)\] \[(.*?)\] \[(.*?)\] (.*)/);
        if (match) {
            const [, timestamp, level, component, message] = match;
            return {
                timestamp,
                level,
                component,
                message,
                raw: line
            };
        }
        return null;
    }

    isRequestStart(logEntry) {
        if (!logEntry) return false;
        
        const indicators = [
            'POST /',
            'request received',
            'processing request',
            '"method":"POST"',
            'requestId'
        ];

        const content = JSON.stringify(logEntry).toLowerCase();
        return indicators.some(indicator => content.includes(indicator.toLowerCase()));
    }

    async processRequest(requestEntry, logBuffer) {
        try {
            const requestData = this.extractRequestData(requestEntry, logBuffer);
            if (!requestData) return;

            await this.categorizeAndStore(requestData);
            this.stats.processedEntries++;
            
            // 更新Provider统计
            const provider = requestData.provider;
            if (!this.stats.providers.has(provider)) {
                this.stats.providers.set(provider, 0);
            }
            this.stats.providers.set(provider, this.stats.providers.get(provider) + 1);

        } catch (error) {
            this.stats.errors++;
            this.logError(`Error processing request: ${error.message}`);
        }
    }

    extractRequestData(requestEntry, logBuffer) {
        const requestId = this.extractRequestId(requestEntry, logBuffer);
        const provider = this.extractProvider(requestEntry, logBuffer);
        const responseContent = this.extractResponseContent(logBuffer);
        
        if (!requestId || !provider || !responseContent) {
            return null;
        }

        return {
            requestId,
            provider,
            timestamp: this.extractTimestamp(requestEntry),
            request: this.extractRequestContent(requestEntry, logBuffer),
            response: responseContent,
            metadata: this.extractMetadata(requestEntry, logBuffer)
        };
    }

    extractRequestId(requestEntry, logBuffer) {
        // 从请求或日志缓冲区中提取requestId
        const sources = [requestEntry, ...logBuffer];
        
        for (const entry of sources) {
            if (entry.requestId) return entry.requestId;
            
            const content = JSON.stringify(entry);
            const match = content.match(/["']?requestId["']?\s*:\s*["']?([^"',\s}]+)["']?/i);
            if (match) return match[1];
        }
        
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    extractProvider(requestEntry, logBuffer) {
        const sources = [requestEntry, ...logBuffer];
        
        for (const entry of sources) {
            if (entry.provider) return entry.provider.toLowerCase();
            
            const content = JSON.stringify(entry).toLowerCase();
            for (const provider of this.config.extraction.providers) {
                if (content.includes(provider.toLowerCase())) {
                    return provider;
                }
            }
        }
        
        return 'unknown';
    }

    extractResponseContent(logBuffer) {
        // 查找响应内容
        for (const entry of logBuffer.reverse()) {
            if (entry.response || entry.content || entry.data) {
                return entry.response || entry.content || entry.data;
            }
            
            // 检查消息中是否包含响应内容
            if (entry.message && typeof entry.message === 'string') {
                try {
                    const parsed = JSON.parse(entry.message);
                    if (parsed.content || parsed.choices || parsed.candidates) {
                        return parsed;
                    }
                } catch (e) {
                    // 如果不是JSON，检查是否是工具调用或长文本
                    if (entry.message.includes('tool_calls') || entry.message.length > 100) {
                        return entry.message;
                    }
                }
            }
        }
        
        return null;
    }

    extractTimestamp(entry) {
        if (entry.timestamp) return entry.timestamp;
        if (entry['@timestamp']) return entry['@timestamp'];
        
        // 从日志行中提取时间戳
        const timeMatch = JSON.stringify(entry).match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/);
        if (timeMatch) return timeMatch[1];
        
        return new Date().toISOString();
    }

    extractRequestContent(requestEntry, logBuffer) {
        // 提取请求内容
        for (const entry of [requestEntry, ...logBuffer]) {
            if (entry.request) return entry.request;
            if (entry.body) return entry.body;
            if (entry.data && typeof entry.data === 'object') return entry.data;
        }
        return null;
    }

    extractMetadata(requestEntry, logBuffer) {
        return {
            logLevel: requestEntry.level || 'info',
            component: requestEntry.component || 'unknown',
            processingTime: this.calculateProcessingTime(logBuffer),
            bufferSize: logBuffer.length,
            finishReason: this.extractFinishReason(logBuffer)
        };
    }

    calculateProcessingTime(logBuffer) {
        if (logBuffer.length < 2) return 0;
        
        const startTime = new Date(this.extractTimestamp(logBuffer[0])).getTime();
        const endTime = new Date(this.extractTimestamp(logBuffer[logBuffer.length - 1])).getTime();
        
        return endTime - startTime;
    }

    extractFinishReason(logBuffer) {
        for (const entry of logBuffer.reverse()) {
            const content = JSON.stringify(entry).toLowerCase();
            if (content.includes('finish_reason') || content.includes('stop_reason')) {
                const match = content.match(/["']?(?:finish_reason|stop_reason)["']?\s*:\s*["']?([^"',\s}]+)["']?/);
                if (match) return match[1];
            }
        }
        return 'unknown';
    }

    async categorizeAndStore(requestData) {
        const category = this.categorizeContent(requestData.response);
        const provider = requestData.provider;
        
        const outputPath = this.expandPath(this.config.paths.outputData);
        const filePath = path.join(
            outputPath, 
            provider, 
            category, 
            `${requestData.requestId}.json`
        );

        const dataToStore = {
            ...requestData,
            category,
            extractedAt: new Date().toISOString(),
            version: this.config.globalSettings.version
        };

        await fs.writeFile(filePath, JSON.stringify(dataToStore, null, 2));
        this.logDebug(`Stored ${category} data for ${provider}: ${filePath}`);
    }

    categorizeContent(content) {
        if (!content) return 'normal-text';
        
        const contentStr = typeof content === 'object' ? JSON.stringify(content) : String(content);
        
        // 检查是否为工具调用
        if (contentStr.includes('tool_calls') || 
            contentStr.includes('function_call') ||
            contentStr.includes('"name"') && contentStr.includes('"arguments"')) {
            return 'tool-calls';
        }
        
        // 检查是否为长文本
        if (contentStr.length > 2000) {
            return 'long-text';
        }
        
        return 'normal-text';
    }

    async generateSummaries() {
        this.logInfo('Generating provider summaries...');
        
        const outputPath = this.expandPath(this.config.paths.outputData);
        
        for (const provider of this.config.extraction.providers) {
            await this.generateProviderSummary(outputPath, provider);
        }
    }

    async generateProviderSummary(outputPath, provider) {
        const providerPath = path.join(outputPath, provider);
        
        try {
            const summary = {
                provider,
                generatedAt: new Date().toISOString(),
                toolInfo: {
                    name: 'log-parser-database',
                    version: this.config.globalSettings.version,
                    location: './tools/log-parser/log-parser-database.js'
                },
                dataFormat: {
                    structure: 'JSON files organized by category',
                    categories: this.config.extraction.categories,
                    fields: [
                        'requestId',
                        'provider', 
                        'timestamp',
                        'request',
                        'response',
                        'metadata',
                        'category',
                        'extractedAt',
                        'version'
                    ]
                },
                statistics: await this.generateProviderStats(providerPath)
            };

            const readmePath = path.join(providerPath, 'README.md');
            const readmeContent = this.generateProviderReadme(summary);
            
            await fs.writeFile(readmePath, readmeContent);
            this.logInfo(`Generated summary for ${provider}`);

        } catch (error) {
            this.logError(`Failed to generate summary for ${provider}: ${error.message}`);
        }
    }

    async generateProviderStats(providerPath) {
        const stats = {
            categories: {},
            totalFiles: 0,
            lastUpdated: new Date().toISOString()
        };

        for (const category of this.config.extraction.categories) {
            const categoryPath = path.join(providerPath, category);
            try {
                const files = await fs.readdir(categoryPath);
                const jsonFiles = files.filter(f => f.endsWith('.json'));
                stats.categories[category] = jsonFiles.length;
                stats.totalFiles += jsonFiles.length;
            } catch (error) {
                stats.categories[category] = 0;
            }
        }

        return stats;
    }

    generateProviderReadme(summary) {
        return `# ${summary.provider.toUpperCase()} Provider Data

## 工具信息
- **工具名称**: ${summary.toolInfo.name}
- **版本**: ${summary.toolInfo.version}
- **工具地址**: ${summary.toolInfo.location}
- **生成时间**: ${summary.generatedAt}

## 数据格式说明
- **存储结构**: ${summary.dataFormat.structure}
- **分类目录**: ${summary.dataFormat.categories.join(', ')}

### 数据字段
${summary.dataFormat.fields.map(field => `- \`${field}\``).join('\n')}

## 数据统计
- **总文件数**: ${summary.statistics.totalFiles}
- **最后更新**: ${summary.statistics.lastUpdated}

### 分类统计
${Object.entries(summary.statistics.categories)
    .map(([category, count]) => `- **${category}**: ${count} 个文件`)
    .join('\n')}

## 使用说明
1. 每个JSON文件代表一次完整的请求-响应链路
2. 文件名格式：\`{requestId}.json\`
3. 数据按时间顺序存储，支持批量分析和可视化

## 数据更新
使用以下命令更新数据：
\`\`\`bash
node ./tools/log-parser/log-parser-database.js
\`\`\`
`;
    }

    printStats() {
        console.log('\n📊 Log Parser Database - Processing Statistics');
        console.log('═'.repeat(50));
        console.log(`Total lines processed: ${this.stats.totalLines.toLocaleString()}`);
        console.log(`Extracted entries: ${this.stats.processedEntries.toLocaleString()}`);
        console.log(`Processing errors: ${this.stats.errors.toLocaleString()}`);
        
        console.log('\nProvider distribution:');
        for (const [provider, count] of this.stats.providers.entries()) {
            console.log(`  ${provider}: ${count} entries`);
        }
        console.log('═'.repeat(50));
    }

    logInfo(message) {
        if (this.config?.performance?.logLevel === 'info' || !this.config) {
            console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
        }
    }

    logError(message) {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    }

    logDebug(message) {
        if (this.config?.performance?.logLevel === 'debug') {
            console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
        }
    }
}

// CLI接口
if (require.main === module) {
    const parser = new LogParserDatabase();
    
    const args = process.argv.slice(2);
    const logPattern = args[0] || 'ccr-*.log';
    
    parser.initialize()
        .then(() => parser.parseLogFiles(logPattern))
        .then(() => {
            console.log('✅ Log parsing completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Log parsing failed:', error.message);
            process.exit(1);
        });
}

module.exports = LogParserDatabase;