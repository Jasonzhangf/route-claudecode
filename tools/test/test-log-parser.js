#!/usr/bin/env node

/**
 * Claude Code Router - Log Parser Database Test Suite
 * 
 * 测试日志解析数据库工具的功能和正确性
 * 
 * @author Jason Zhang
 * @version 1.0.0
 * @created 2025-08-07
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawn } = require('child_process');

class LogParserTest {
    constructor() {
        this.testDir = path.join(os.tmpdir(), 'ccr-tools-test');
        this.configPath = path.resolve(__dirname, '../config.json');
        this.toolPath = path.resolve(__dirname, '../log-parser/log-parser-database.js');
        this.testResults = [];
        this.stats = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    async initialize() {
        console.log('🧪 Claude Code Router - Log Parser Test Suite');
        console.log('═'.repeat(50));
        
        // 创建测试目录
        await fs.mkdir(this.testDir, { recursive: true });
        console.log(`📁 测试目录: ${this.testDir}`);
        
        // 检查依赖
        await this.checkDependencies();
        console.log('✅ 依赖检查完成');
    }

    async checkDependencies() {
        // 检查配置文件
        try {
            await fs.access(this.configPath);
        } catch (error) {
            throw new Error(`配置文件不存在: ${this.configPath}`);
        }

        // 检查工具文件
        try {
            await fs.access(this.toolPath);
        } catch (error) {
            throw new Error(`工具文件不存在: ${this.toolPath}`);
        }
    }

    async runAllTests() {
        console.log('\n🚀 开始测试执行...\n');

        // 测试用例列表
        const testCases = [
            { name: 'JSON日志格式解析', method: this.testJsonLogParsing },
            { name: '结构化日志格式解析', method: this.testStructuredLogParsing },
            { name: 'Provider分类识别', method: this.testProviderIdentification },
            { name: '内容分类功能', method: this.testContentCategorization },
            { name: '请求ID提取', method: this.testRequestIdExtraction },
            { name: '时间戳处理', method: this.testTimestampExtraction },
            { name: '工具调用检测', method: this.testToolCallDetection },
            { name: '错误处理', method: this.testErrorHandling },
            { name: '输出目录结构', method: this.testOutputStructure },
            { name: 'README生成', method: this.testReadmeGeneration }
        ];

        // 执行测试
        for (const testCase of testCases) {
            await this.runTest(testCase.name, testCase.method.bind(this));
        }

        // 显示结果
        this.showResults();
    }

    async runTest(testName, testMethod) {
        this.stats.total++;
        const startTime = Date.now();
        
        try {
            console.log(`🧪 ${testName}...`);
            await testMethod();
            
            const duration = Date.now() - startTime;
            this.stats.passed++;
            console.log(`   ✅ 通过 (${duration}ms)\n`);
            
            this.testResults.push({
                name: testName,
                status: 'passed',
                duration
            });
            
        } catch (error) {
            const duration = Date.now() - startTime;
            this.stats.failed++;
            this.stats.errors.push({ test: testName, error: error.message });
            console.log(`   ❌ 失败: ${error.message} (${duration}ms)\n`);
            
            this.testResults.push({
                name: testName,
                status: 'failed',
                duration,
                error: error.message
            });
        }
    }

    async testJsonLogParsing() {
        // 创建测试JSON日志
        const logContent = `
[2025-08-07T10:30:00.123Z] [INFO] [router] Starting request processing
{"timestamp":"2025-08-07T10:30:00.123Z","level":"info","requestId":"req_123","provider":"anthropic","message":"POST /v1/chat/completions"}
{"timestamp":"2025-08-07T10:30:00.456Z","level":"info","requestId":"req_123","response":{"content":"Hello world"}}
[2025-08-07T10:30:00.789Z] [INFO] [router] Request completed
        `.trim();

        const testLogFile = path.join(this.testDir, 'test-json.log');
        await fs.writeFile(testLogFile, logContent);

        // 模拟工具解析（简化版测试）
        const LogParserDatabase = require(this.toolPath);
        const parser = new LogParserDatabase(this.configPath);
        
        // 测试JSON解析功能
        const testLine = '{"timestamp":"2025-08-07T10:30:00.123Z","level":"info","requestId":"req_123","provider":"anthropic"}';
        const parsed = parser.parseLogLine(testLine);
        
        assert(parsed, 'JSON日志行应该被解析');
        assert.strictEqual(parsed.requestId, 'req_123', '应该正确提取requestId');
        assert.strictEqual(parsed.provider, 'anthropic', '应该正确提取provider');
    }

    async testStructuredLogParsing() {
        const testLine = '[2025-08-07T10:30:00.123Z] [INFO] [router] Processing request req_456';
        
        const LogParserDatabase = require(this.toolPath);
        const parser = new LogParserDatabase(this.configPath);
        
        const parsed = parser.parseLogLine(testLine);
        
        assert(parsed, '结构化日志行应该被解析');
        assert.strictEqual(parsed.timestamp, '2025-08-07T10:30:00.123Z', '应该正确提取时间戳');
        assert.strictEqual(parsed.level, 'INFO', '应该正确提取日志级别');
        assert.strictEqual(parsed.component, 'router', '应该正确提取组件名');
    }

    async testProviderIdentification() {
        const LogParserDatabase = require(this.toolPath);
        const parser = new LogParserDatabase(this.configPath);

        const testCases = [
            { input: '{"provider":"anthropic"}', expected: 'anthropic' },
            { input: '{"message":"Using codewhisperer client"}', expected: 'codewhisperer' },
            { input: '{"content":"gemini response"}', expected: 'gemini' },
            { input: '{"openai":"true"}', expected: 'openai' },
            { input: '{"unknown":"data"}', expected: 'unknown' }
        ];

        for (const testCase of testCases) {
            const entry = JSON.parse(testCase.input);
            const provider = parser.extractProvider(entry, []);
            assert.strictEqual(provider, testCase.expected, 
                `Provider识别失败: ${testCase.input} -> 期望 ${testCase.expected}, 实际 ${provider}`);
        }
    }

    async testContentCategorization() {
        const LogParserDatabase = require(this.toolPath);
        const parser = new LogParserDatabase(this.configPath);

        const testCases = [
            { 
                input: '{"tool_calls":[{"name":"test"}]}', 
                expected: 'tool-calls',
                description: '工具调用内容'
            },
            { 
                input: 'a'.repeat(2500), 
                expected: 'long-text',
                description: '长文本内容'
            },
            { 
                input: 'Hello world', 
                expected: 'normal-text',
                description: '普通文本内容'
            },
            { 
                input: null, 
                expected: 'normal-text',
                description: '空内容'
            }
        ];

        for (const testCase of testCases) {
            const category = parser.categorizeContent(testCase.input);
            assert.strictEqual(category, testCase.expected, 
                `内容分类失败 (${testCase.description}): 期望 ${testCase.expected}, 实际 ${category}`);
        }
    }

    async testRequestIdExtraction() {
        const LogParserDatabase = require(this.toolPath);
        const parser = new LogParserDatabase(this.configPath);

        const testCases = [
            { input: { requestId: 'direct_123' }, expected: 'direct_123' },
            { input: { message: '"requestId": "embedded_456"' }, expected: 'embedded_456' },
            { input: { other: 'data' }, expected: null } // 应该生成随机ID
        ];

        for (const testCase of testCases) {
            const requestId = parser.extractRequestId(testCase.input, []);
            
            if (testCase.expected) {
                assert.strictEqual(requestId, testCase.expected, 
                    `RequestId提取失败: 期望 ${testCase.expected}, 实际 ${requestId}`);
            } else {
                assert(requestId && requestId.startsWith('req_'), 
                    '应该生成以req_开头的随机ID');
            }
        }
    }

    async testTimestampExtraction() {
        const LogParserDatabase = require(this.toolPath);
        const parser = new LogParserDatabase(this.configPath);

        const testCases = [
            { input: { timestamp: '2025-08-07T10:30:00.123Z' }, expected: '2025-08-07T10:30:00.123Z' },
            { input: { '@timestamp': '2025-08-07T10:30:01.456Z' }, expected: '2025-08-07T10:30:01.456Z' },
            { input: { message: 'Time: 2025-08-07T10:30:02.789Z' }, expected: '2025-08-07T10:30:02.789Z' },
            { input: { other: 'data' }, expected: null } // 应该生成当前时间
        ];

        for (const testCase of testCases) {
            const timestamp = parser.extractTimestamp(testCase.input);
            
            if (testCase.expected) {
                assert.strictEqual(timestamp, testCase.expected, 
                    `时间戳提取失败: 期望 ${testCase.expected}, 实际 ${timestamp}`);
            } else {
                assert(timestamp && !isNaN(Date.parse(timestamp)), 
                    '应该生成有效的ISO时间戳');
            }
        }
    }

    async testToolCallDetection() {
        const LogParserDatabase = require(this.toolPath);
        const parser = new LogParserDatabase(this.configPath);

        const testCases = [
            { input: { message: '{"tool_calls":[]}' }, expected: true },
            { input: { content: 'function_call detected' }, expected: true },
            { input: { data: '{"name":"test","arguments":"{}"}' }, expected: true },
            { input: { message: 'normal response' }, expected: false }
        ];

        for (const testCase of testCases) {
            const eventType = parser.determineEventType(testCase.input);
            const isToolCall = eventType === 'tool_call';
            
            assert.strictEqual(isToolCall, testCase.expected, 
                `工具调用检测失败: ${JSON.stringify(testCase.input)} -> 期望 ${testCase.expected}, 实际 ${isToolCall}`);
        }
    }

    async testErrorHandling() {
        const LogParserDatabase = require(this.toolPath);
        const parser = new LogParserDatabase(this.configPath);

        // 测试无效JSON处理
        const invalidJson = '{invalid json}';
        const result = parser.parseLogLine(invalidJson);
        
        // 应该返回null而不是抛出异常
        assert.strictEqual(result, null, '无效JSON应该返回null');

        // 测试空输入处理
        const emptyResult = parser.parseLogLine('');
        assert.strictEqual(emptyResult, null, '空输入应该返回null');

        // 测试null输入处理
        const nullResult = parser.parseLogLine(null);
        assert.strictEqual(nullResult, null, 'null输入应该返回null');
    }

    async testOutputStructure() {
        // 测试输出目录结构是否正确创建
        const LogParserDatabase = require(this.toolPath);
        
        // 创建测试配置
        const testConfig = {
            paths: {
                inputLogs: this.testDir,
                outputData: path.join(this.testDir, 'providers'),
                tempDir: path.join(this.testDir, 'temp')
            },
            extraction: {
                providers: ['anthropic', 'openai'],
                categories: ['long-text', 'normal-text', 'tool-calls']
            }
        };

        const testConfigPath = path.join(this.testDir, 'test-config.json');
        await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

        const parser = new LogParserDatabase(testConfigPath);
        await parser.loadConfig();
        await parser.ensureDirectories();

        // 检查目录结构
        for (const provider of testConfig.extraction.providers) {
            for (const category of testConfig.extraction.categories) {
                const categoryPath = path.join(testConfig.paths.outputData, provider, category);
                try {
                    await fs.access(categoryPath);
                } catch (error) {
                    throw new Error(`目录未创建: ${categoryPath}`);
                }
            }
        }
    }

    async testReadmeGeneration() {
        const LogParserDatabase = require(this.toolPath);
        
        // 模拟生成README内容
        const testSummary = {
            provider: 'anthropic',
            generatedAt: '2025-08-07T10:30:00.000Z',
            toolInfo: {
                name: 'log-parser-database',
                version: '1.0.0',
                location: './tools/log-parser/log-parser-database.js'
            },
            dataFormat: {
                structure: 'JSON files organized by category',
                categories: ['long-text', 'normal-text', 'tool-calls'],
                fields: ['requestId', 'provider', 'timestamp', 'request', 'response']
            },
            statistics: {
                categories: { 'long-text': 5, 'normal-text': 10, 'tool-calls': 3 },
                totalFiles: 18,
                lastUpdated: '2025-08-07T10:30:00.000Z'
            }
        };

        const parser = new LogParserDatabase();
        const readmeContent = parser.generateProviderReadme(testSummary);

        // 检查README内容
        assert(readmeContent.includes('ANTHROPIC Provider Data'), 'README应该包含Provider标题');
        assert(readmeContent.includes('log-parser-database'), 'README应该包含工具名称');
        assert(readmeContent.includes('总文件数: 18'), 'README应该包含统计信息');
        assert(readmeContent.includes('long-text: 5'), 'README应该包含分类统计');
    }

    showResults() {
        console.log('\n📊 测试结果总览');
        console.log('═'.repeat(50));
        
        const passRate = this.stats.total > 0 ? (this.stats.passed / this.stats.total * 100).toFixed(2) : 0;
        
        console.log(`总测试数: ${this.stats.total}`);
        console.log(`通过数量: ${this.stats.passed}`);
        console.log(`失败数量: ${this.stats.failed}`);
        console.log(`通过率: ${passRate}%`);
        
        if (this.stats.failed > 0) {
            console.log('\n❌ 失败的测试:');
            for (const error of this.stats.errors) {
                console.log(`   • ${error.test}: ${error.error}`);
            }
        }
        
        console.log('\n📝 详细结果:');
        for (const result of this.testResults) {
            const status = result.status === 'passed' ? '✅' : '❌';
            const duration = `${result.duration}ms`;
            console.log(`   ${status} ${result.name} (${duration})`);
            if (result.error) {
                console.log(`      错误: ${result.error}`);
            }
        }
        
        console.log('═'.repeat(50));
        
        if (this.stats.failed === 0) {
            console.log('🎉 所有测试通过！日志解析器工具运行正常。');
        } else {
            console.log('⚠️  存在测试失败，请检查工具实现。');
        }
    }

    async cleanup() {
        try {
            // 清理测试目录
            await fs.rm(this.testDir, { recursive: true, force: true });
            console.log(`\n🧹 清理测试目录: ${this.testDir}`);
        } catch (error) {
            console.log(`清理失败: ${error.message}`);
        }
    }
}

// CLI接口
if (require.main === module) {
    const test = new LogParserTest();
    
    test.initialize()
        .then(() => test.runAllTests())
        .then(() => test.cleanup())
        .then(() => {
            if (test.stats.failed === 0) {
                process.exit(0);
            } else {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ 测试运行失败:', error.message);
            process.exit(1);
        });
}

module.exports = LogParserTest;