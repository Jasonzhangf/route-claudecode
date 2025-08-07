#!/usr/bin/env node

/**
 * Claude Code Router - Timeline Visualizer Test Suite
 * 
 * 测试时序图生成工具的功能和正确性
 * 
 * @author Jason Zhang
 * @version 1.0.0
 * @created 2025-08-07
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const assert = require('assert');
const { JSDOM } = require('jsdom');

class TimelineVisualizerTest {
    constructor() {
        this.testDir = path.join(os.tmpdir(), 'ccr-timeline-test');
        this.configPath = path.resolve(__dirname, '../config.json');
        this.toolPath = path.resolve(__dirname, '../visualization/timeline-visualizer.js');
        this.testResults = [];
        this.stats = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    async initialize() {
        console.log('🕒 Claude Code Router - Timeline Visualizer Test Suite');
        console.log('═'.repeat(55));
        
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

        // 检查jsdom依赖（用于HTML测试）
        try {
            require('jsdom');
        } catch (error) {
            console.log('⚠️  jsdom未安装，跳过HTML验证测试');
        }
    }

    async runAllTests() {
        console.log('\n🚀 开始测试执行...\n');

        // 测试用例列表
        const testCases = [
            { name: '日志行解析功能', method: this.testLogLineParsing },
            { name: '时序事件创建', method: this.testTimelineEventCreation },
            { name: '事件类型识别', method: this.testEventTypeDetection },
            { name: '请求颜色分配', method: this.testRequestColorAssignment },
            { name: '时间戳提取和处理', method: this.testTimestampHandling },
            { name: '时序数据处理', method: this.testTimelineDataProcessing },
            { name: 'HTML内容生成', method: this.testHTMLGeneration },
            { name: 'CSS样式生成', method: this.testCSSGeneration },
            { name: 'JavaScript功能生成', method: this.testJavaScriptGeneration },
            { name: '统计信息计算', method: this.testStatisticsCalculation },
            { name: '时长格式化', method: this.testDurationFormatting },
            { name: '完整工作流程', method: this.testCompleteWorkflow }
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

    async testLogLineParsing() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        // 测试JSON日志解析
        const jsonLine = '{"timestamp":"2025-08-07T10:30:00.123Z","level":"info","requestId":"req_123","provider":"anthropic"}';
        const jsonResult = visualizer.parseLogLine(jsonLine);
        
        assert(jsonResult, 'JSON日志行应该被解析');
        assert.strictEqual(jsonResult.requestId, 'req_123', 'JSON中的requestId应该被正确解析');

        // 测试结构化日志解析
        const structuredLine = '[2025-08-07T10:30:00.123Z] [INFO] [router] Processing request req_456';
        const structuredResult = visualizer.parseLogLine(structuredLine);
        
        assert(structuredResult, '结构化日志行应该被解析');
        assert.strictEqual(structuredResult.timestamp, '2025-08-07T10:30:00.123Z', '时间戳应该被正确解析');
        assert.strictEqual(structuredResult.level, 'INFO', '日志级别应该被正确解析');

        // 测试无效输入
        const invalidResult = visualizer.parseLogLine('invalid log line');
        assert.strictEqual(invalidResult, null, '无效日志行应该返回null');
    }

    async testTimelineEventCreation() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        const logEntry = {
            timestamp: '2025-08-07T10:30:00.123Z',
            requestId: 'req_123',
            provider: 'anthropic',
            level: 'info',
            message: 'POST /'
        };

        const event = visualizer.createTimelineEvent(logEntry);
        
        assert(event, '时序事件应该被创建');
        assert.strictEqual(event.requestId, 'req_123', 'requestId应该正确设置');
        assert.strictEqual(event.provider, 'anthropic', 'provider应该正确设置');
        assert.strictEqual(event.type, 'request_start', '事件类型应该正确识别');
        assert(event.timestamp instanceof Date, 'timestamp应该是Date对象');
        assert(event.data, '事件数据应该存在');
    }

    async testEventTypeDetection() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        const testCases = [
            { input: { message: 'POST /' }, expected: 'request_start' },
            { input: { message: 'routing to provider' }, expected: 'routing' },
            { input: { message: 'transforming request' }, expected: 'transformation' },
            { input: { message: 'api call initiated' }, expected: 'api_request' },
            { input: { message: 'api response received' }, expected: 'api_response' },
            { input: { message: 'finish_reason: stop' }, expected: 'finish_reason' },
            { input: { message: 'response sent' }, expected: 'request_end' },
            { input: { message: 'tool_calls detected' }, expected: 'tool_call' },
            { input: { message: 'error occurred' }, expected: 'error' },
            { input: { message: 'random message' }, expected: 'other' }
        ];

        for (const testCase of testCases) {
            const eventType = visualizer.determineEventType(testCase.input);
            assert.strictEqual(eventType, testCase.expected, 
                `事件类型检测失败: ${testCase.input.message} -> 期望 ${testCase.expected}, 实际 ${eventType}`);
        }
    }

    async testRequestColorAssignment() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        // 测试不同requestId获得不同颜色
        const color1 = visualizer.getRequestColor('req_001');
        const color2 = visualizer.getRequestColor('req_002');
        const color1Again = visualizer.getRequestColor('req_001');

        assert(color1, 'requestId应该分配颜色');
        assert(color2, 'requestId应该分配颜色');
        assert.notStrictEqual(color1, color2, '不同requestId应该获得不同颜色');
        assert.strictEqual(color1, color1Again, '相同requestId应该获得相同颜色');

        // 测试颜色格式
        assert(color1.startsWith('#'), '颜色应该是十六进制格式');
        assert.strictEqual(color1.length, 7, '颜色应该是7位十六进制');
    }

    async testTimestampHandling() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        const testCases = [
            { input: { timestamp: '2025-08-07T10:30:00.123Z' }, expected: '2025-08-07T10:30:00.123Z' },
            { input: { '@timestamp': '2025-08-07T10:30:01.456Z' }, expected: '2025-08-07T10:30:01.456Z' },
            { input: { message: 'Time: 2025-08-07T10:30:02.789Z data' }, expected: '2025-08-07T10:30:02.789Z' },
            { input: { other: 'data' }, expected: null }
        ];

        for (const testCase of testCases) {
            const timestamp = visualizer.extractTimestamp(testCase.input);
            
            if (testCase.expected) {
                assert.strictEqual(timestamp, testCase.expected, 
                    `时间戳提取失败: 期望 ${testCase.expected}, 实际 ${timestamp}`);
            } else {
                assert.strictEqual(timestamp, null, '无时间戳的输入应该返回null');
            }
        }
    }

    async testTimelineDataProcessing() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        // 创建测试事件
        const startEvent = {
            requestId: 'req_123',
            provider: 'anthropic',
            timestamp: new Date('2025-08-07T10:30:00.000Z'),
            type: 'request_start',
            data: { message: 'start' }
        };

        const endEvent = {
            requestId: 'req_123',
            provider: 'anthropic',
            timestamp: new Date('2025-08-07T10:30:01.000Z'),
            type: 'request_end',
            data: { message: 'end' }
        };

        const events = [startEvent, endEvent];
        
        // 处理时序数据
        visualizer.processRequestTimeline(startEvent, events);
        
        assert.strictEqual(visualizer.timelineData.length, 1, '应该创建一个时序记录');
        
        const timeline = visualizer.timelineData[0];
        assert.strictEqual(timeline.requestId, 'req_123', 'requestId应该正确设置');
        assert.strictEqual(timeline.provider, 'anthropic', 'provider应该正确设置');
        assert.strictEqual(timeline.duration, 1000, '持续时间应该正确计算(1秒=1000ms)');
        assert.strictEqual(timeline.events.length, 2, '应该包含所有事件');
    }

    async testHTMLGeneration() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);
        
        // 设置测试数据
        visualizer.stats = {
            totalRequests: 5,
            totalEvents: 25,
            providers: new Set(['anthropic', 'openai']),
            timeSpan: { 
                start: new Date('2025-08-07T10:30:00.000Z'), 
                end: new Date('2025-08-07T10:31:00.000Z') 
            }
        };

        visualizer.timelineData = [{
            requestId: 'req_123',
            provider: 'anthropic',
            color: '#FF6B6B',
            startTime: new Date('2025-08-07T10:30:00.000Z'),
            endTime: new Date('2025-08-07T10:30:01.000Z'),
            duration: 1000,
            events: [{
                type: 'request_start',
                timestamp: new Date('2025-08-07T10:30:00.000Z'),
                relativeTime: 0,
                data: { message: 'start' }
            }]
        }];

        const htmlContent = visualizer.generateHTMLContent();
        
        // 基本HTML结构检查
        assert(htmlContent.includes('<!DOCTYPE html>'), 'HTML应该包含DOCTYPE声明');
        assert(htmlContent.includes('<html'), 'HTML应该包含html标签');
        assert(htmlContent.includes('<head>'), 'HTML应该包含head标签');
        assert(htmlContent.includes('<body>'), 'HTML应该包含body标签');
        assert(htmlContent.includes('<title>'), 'HTML应该包含title标签');

        // 内容检查
        assert(htmlContent.includes('Claude Code Router'), 'HTML应该包含项目标题');
        assert(htmlContent.includes('Total Requests'), 'HTML应该包含统计信息');
        assert(htmlContent.includes('5'), 'HTML应该包含正确的请求数量');
        assert(htmlContent.includes('anthropic'), 'HTML应该包含provider信息');
        assert(htmlContent.includes('req_123'), 'HTML应该包含requestId');

        // CSS和JavaScript检查
        assert(htmlContent.includes('<style>'), 'HTML应该包含CSS样式');
        assert(htmlContent.includes('<script>'), 'HTML应该包含JavaScript代码');

        // 交互功能检查
        assert(htmlContent.includes('providerFilter'), 'HTML应该包含provider过滤器');
        assert(htmlContent.includes('eventTypeFilter'), 'HTML应该包含事件类型过滤器');
        assert(htmlContent.includes('timeRange'), 'HTML应该包含时间范围控制');
    }

    async testCSSGeneration() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        const css = visualizer.generateCSS();
        
        // CSS基础结构检查
        assert(css.includes('body {'), 'CSS应该包含body样式');
        assert(css.includes('.container'), 'CSS应该包含container样式');
        assert(css.includes('.timeline'), 'CSS应该包含timeline样式');
        assert(css.includes('.event-point'), 'CSS应该包含事件点样式');

        // 响应式设计检查
        assert(css.includes('@media'), 'CSS应该包含媒体查询');
        assert(css.includes('max-width'), 'CSS应该包含响应式断点');

        // 动画检查
        assert(css.includes('@keyframes'), 'CSS应该包含动画定义');
        assert(css.includes('pulse'), 'CSS应该包含脉冲动画');

        // 颜色定义检查
        assert(css.includes('#FF6B6B') || css.includes('rgb(') || css.includes('rgba('), 
            'CSS应该包含颜色定义');
    }

    async testJavaScriptGeneration() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        // 设置测试数据
        visualizer.timelineData = [{
            requestId: 'req_123',
            provider: 'anthropic',
            events: [{ type: 'request_start', data: { message: 'test' } }]
        }];

        const js = visualizer.generateJavaScript();
        
        // JavaScript基础结构检查
        assert(js.includes('document.addEventListener'), 'JavaScript应该包含事件监听器');
        assert(js.includes('DOMContentLoaded'), 'JavaScript应该等待DOM加载');
        assert(js.includes('timelineData'), 'JavaScript应该包含时序数据');

        // 交互功能检查
        assert(js.includes('providerFilter'), 'JavaScript应该处理provider过滤');
        assert(js.includes('eventTypeFilter'), 'JavaScript应该处理事件类型过滤');
        assert(js.includes('timeRange'), 'JavaScript应该处理时间范围');
        assert(js.includes('click'), 'JavaScript应该处理点击事件');

        // 功能函数检查
        assert(js.includes('applyFilters'), 'JavaScript应该包含过滤功能');
        assert(js.includes('showEventDetails'), 'JavaScript应该包含详情显示功能');

        // 数据处理检查
        assert(js.includes('JSON.parse'), 'JavaScript应该处理JSON数据');
        assert(js.includes('req_123'), 'JavaScript应该包含测试数据');
    }

    async testStatisticsCalculation() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        // 创建测试时序数据
        const timeline = {
            requestId: 'req_123',
            provider: 'anthropic',
            startTime: new Date('2025-08-07T10:30:00.000Z'),
            endTime: new Date('2025-08-07T10:30:01.000Z'),
            events: [
                { type: 'request_start' },
                { type: 'api_request' },
                { type: 'request_end' }
            ]
        };

        // 重置统计
        visualizer.stats = {
            totalRequests: 0,
            totalEvents: 0,
            providers: new Set(),
            timeSpan: { start: null, end: null }
        };

        visualizer.updateStats(timeline);
        
        assert.strictEqual(visualizer.stats.totalRequests, 1, '请求总数应该正确更新');
        assert.strictEqual(visualizer.stats.totalEvents, 3, '事件总数应该正确更新');
        assert(visualizer.stats.providers.has('anthropic'), 'provider集合应该正确更新');
        assert(visualizer.stats.timeSpan.start, '开始时间应该被设置');
        assert(visualizer.stats.timeSpan.end, '结束时间应该被设置');
    }

    async testDurationFormatting() {
        const TimelineVisualizer = require(this.toolPath);
        const visualizer = new TimelineVisualizer(this.configPath);

        const testCases = [
            { input: 500, expected: '500ms' },
            { input: 1500, expected: '1.50s' },
            { input: 65000, expected: '1m 5.00s' },
            { input: 125000, expected: '2m 5.00s' },
            { input: 0, expected: '0ms' }
        ];

        for (const testCase of testCases) {
            const formatted = visualizer.formatDuration(testCase.input);
            assert.strictEqual(formatted, testCase.expected, 
                `时长格式化失败: ${testCase.input}ms -> 期望 ${testCase.expected}, 实际 ${formatted}`);
        }
    }

    async testCompleteWorkflow() {
        const TimelineVisualizer = require(this.toolPath);
        
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
            },
            visualization: {
                theme: 'light',
                colorScheme: 'automatic',
                maxColors: 20
            },
            performance: {
                logLevel: 'info'
            }
        };

        const testConfigPath = path.join(this.testDir, 'test-config.json');
        await fs.writeFile(testConfigPath, JSON.stringify(testConfig, null, 2));

        // 创建测试日志文件
        const testLogContent = `
[2025-08-07T10:30:00.000Z] [INFO] [router] Processing request req_123
{"timestamp":"2025-08-07T10:30:00.100Z","requestId":"req_123","provider":"anthropic","message":"POST /v1/chat/completions"}
{"timestamp":"2025-08-07T10:30:00.200Z","requestId":"req_123","message":"routing to anthropic"}
{"timestamp":"2025-08-07T10:30:00.300Z","requestId":"req_123","message":"api response received"}
{"timestamp":"2025-08-07T10:30:00.400Z","requestId":"req_123","message":"response sent"}
        `.trim();

        const testLogFile = path.join(this.testDir, 'test.log');
        await fs.writeFile(testLogFile, testLogContent);

        // 创建可视化器实例
        const visualizer = new TimelineVisualizer(testConfigPath);
        await visualizer.initialize();

        // 收集时序数据
        await visualizer.collectTimelineData('test.log');
        
        // 验证数据收集
        assert(visualizer.timelineData.length > 0, '应该收集到时序数据');
        assert(visualizer.stats.totalRequests > 0, '应该统计到请求数量');
        assert(visualizer.stats.providers.size > 0, '应该识别到provider');

        // 生成HTML
        const outputFile = path.join(this.testDir, 'test-timeline.html');
        await visualizer.generateHTMLVisualization(outputFile);
        
        // 验证HTML文件
        try {
            await fs.access(outputFile);
        } catch (error) {
            throw new Error('HTML文件未生成');
        }

        const htmlContent = await fs.readFile(outputFile, 'utf8');
        assert(htmlContent.length > 1000, 'HTML内容应该足够丰富');
        assert(htmlContent.includes('req_123'), 'HTML应该包含测试requestId');
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
            console.log('🎉 所有测试通过！时序图生成器工具运行正常。');
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
    const test = new TimelineVisualizerTest();
    
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

module.exports = TimelineVisualizerTest;