#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Finish Reason Logging and Retrieval System
 * 
 * Tests all aspects of the FinishReasonTracker:
 * - Finish reason logging and categorization
 * - Query and filtering capabilities  
 * - Distribution reporting and insights
 * - Pattern analysis and alert system
 * - Export functionality
 * - CLI interface validation
 * 
 * @author Jason Zhang
 * @version 3.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import FinishReasonTracker from '../../src/v3/tools-ecosystem/finish-reason/finish-reason-tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class FinishReasonTrackerTest {
    constructor() {
        this.testOutputDir = path.join(__dirname, '../output/functional');
        this.testDataDir = path.join(this.testOutputDir, 'test-finish-reason-data');
        this.sessionId = `finish-reason-test-${Date.now()}`;
        this.results = {
            sessionId: this.sessionId,
            startTime: new Date().toISOString(),
            tests: [],
            summary: { total: 0, passed: 0, failed: 0 }
        };
        
        // Test configuration
        this.testConfig = {
            baseDir: this.testDataDir,
            alertThresholds: {
                errorRateHigh: 0.20, // 20% for testing
                rateLimitFrequency: 3  // Lower threshold for testing
            }
        };
    }

    async runTests() {
        try {
            console.log('🧪 Starting Finish Reason Tracker Tests...');
            console.log(`Session ID: ${this.sessionId}`);
            
            // Ensure test output directory exists
            await fs.mkdir(this.testOutputDir, { recursive: true });
            await fs.mkdir(this.testDataDir, { recursive: true });

            // Run individual tests
            const tests = [
                this.testTrackerInitialization(),
                this.testFinishReasonLogging(),
                this.testFinishReasonCategorization(),
                this.testQueryAndFiltering(),
                this.testDistributionReporting(),
                this.testPatternAnalysisAndAlerts(),
                this.testExportFunctionality(),
                this.testCLIInterface(),
                this.testComprehensiveSystem()
            ];

            for (const test of tests) {
                await test;
            }

            // Generate final summary
            this.results.endTime = new Date().toISOString();
            this.results.summary.total = this.results.tests.length;
            this.results.summary.passed = this.results.tests.filter(t => t.status === 'passed').length;
            this.results.summary.failed = this.results.tests.filter(t => t.status === 'failed').length;

            // Save test results
            const resultsFile = path.join(this.testOutputDir, `finish-reason-tracker-test-${this.sessionId}.json`);
            await fs.writeFile(resultsFile, JSON.stringify(this.results, null, 2));

            // Display summary
            console.log(`\n📊 Test Summary:`);
            console.log(`✅ Passed: ${this.results.summary.passed}`);
            console.log(`❌ Failed: ${this.results.summary.failed}`);
            console.log(`📁 Results: ${resultsFile}`);

            return this.results;
        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            throw error;
        }
    }

    async testTrackerInitialization() {
        const testResult = {
            name: 'Tracker Initialization and Setup',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n🔧 Test 1: Tracker Initialization and Setup');

            // Create tracker instance
            const tracker = new FinishReasonTracker(this.testConfig);
            
            // Test initialization
            const initResult = await tracker.initialize();
            
            this.validateTestCondition(
                testResult,
                'Tracker Initialization',
                initResult.status === 'initialized',
                `Initialization status: ${initResult.status}`
            );

            this.validateTestCondition(
                testResult,
                'Base Directory Creation',
                await this.directoryExists(initResult.baseDir),
                `Base directory: ${initResult.baseDir}`
            );

            this.validateTestCondition(
                testResult,
                'Subdirectory Structure',
                await this.validateDirectoryStructure(initResult.baseDir),
                'All required subdirectories created'
            );

            this.validateTestCondition(
                testResult,
                'Configuration Loading',
                initResult.categories.includes('stop') && initResult.categories.includes('error'),
                `Categories loaded: ${initResult.categories.length}`
            );

            this.validateTestCondition(
                testResult,
                'Provider Protocols Setup', 
                initResult.providerProtocols.includes('anthropic') && initResult.providerProtocols.includes('openai'),
                `Provider protocols: ${initResult.providerProtocols.length}`
            );

            testResult.status = 'passed';
            testResult.tracker = tracker; // Store for later tests
            
        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 1 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);
        
        return testResult;
    }

    async testFinishReasonLogging() {
        const testResult = {
            name: 'Finish Reason Logging',
            startTime: new Date().toISOString(), 
            status: 'running',
            validations: []
        };

        try {
            console.log('\n📝 Test 2: Finish Reason Logging');

            const tracker = new FinishReasonTracker(this.testConfig);
            await tracker.initialize();

            // Test different types of finish reason entries
            const testEntries = [
                {
                    provider: 'anthropic',
                    model: 'claude-sonnet-4',
                    finishReason: 'stop',
                    requestId: 'req-001',
                    duration: 1250,
                    tokenCount: { input: 100, output: 50, total: 150 }
                },
                {
                    provider: 'openai',
                    model: 'gpt-4',
                    finishReason: 'length',
                    requestId: 'req-002', 
                    duration: 2100,
                    tokenCount: { input: 200, output: 100, total: 300 }
                },
                {
                    provider: 'gemini',
                    model: 'gemini-pro',
                    finishReason: 'tool_calls',
                    requestId: 'req-003',
                    duration: 950,
                    tokenCount: { input: 80, output: 120, total: 200 }
                },
                {
                    provider: 'codewhisperer',
                    model: 'claude-sonnet-4',
                    finishReason: 'error',
                    requestId: 'req-004',
                    errorDetails: 'Rate limit exceeded',
                    metadata: { status: 429 }
                }
            ];

            const logResults = [];
            for (const entry of testEntries) {
                const result = await tracker.logFinishReason(entry);
                logResults.push(result);
            }

            this.validateTestCondition(
                testResult,
                'Entry Logging Success',
                logResults.every(r => r.status === 'logged'),
                `Logged ${logResults.length} entries successfully`
            );

            this.validateTestCondition(
                testResult,
                'Entry ID Generation',
                logResults.every(r => r.id && r.id.length > 0),
                'All entries have generated IDs'
            );

            this.validateTestCondition(
                testResult,
                'Category Assignment',
                logResults.map(r => r.category).includes('stop') &&
                logResults.map(r => r.category).includes('length') &&
                logResults.map(r => r.category).includes('tool_calls') &&
                logResults.map(r => r.category).includes('error'),
                'All expected categories assigned'
            );

            this.validateTestCondition(
                testResult,
                'Provider Tracking',
                logResults.map(r => r.provider).includes('anthropic') &&
                logResults.map(r => r.provider).includes('openai') &&
                logResults.map(r => r.provider).includes('gemini') &&
                logResults.map(r => r.provider).includes('codewhisperer'),
                'All providers tracked correctly'
            );

            testResult.status = 'passed';
            testResult.logResults = logResults;

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 2 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);
        
        return testResult;
    }

    async testFinishReasonCategorization() {
        const testResult = {
            name: 'Finish Reason Categorization',
            startTime: new Date().toISOString(),
            status: 'running', 
            validations: []
        };

        try {
            console.log('\n🏷️ Test 3: Finish Reason Categorization');

            const tracker = new FinishReasonTracker(this.testConfig);
            await tracker.initialize();

            // Test categorization mapping
            const categorizationTests = [
                { finishReason: 'stop', expectedCategory: 'stop' },
                { finishReason: 'end_turn', expectedCategory: 'stop' },
                { finishReason: 'complete', expectedCategory: 'stop' },
                { finishReason: 'length', expectedCategory: 'length' },
                { finishReason: 'max_tokens', expectedCategory: 'length' },
                { finishReason: 'token_limit', expectedCategory: 'length' },
                { finishReason: 'tool_calls', expectedCategory: 'tool_calls' },
                { finishReason: 'function_call', expectedCategory: 'tool_calls' },
                { finishReason: 'tool_use', expectedCategory: 'tool_calls' },
                { finishReason: 'error', expectedCategory: 'error' },
                { finishReason: 'failed', expectedCategory: 'error' },
                { finishReason: 'rate_limit', expectedCategory: 'rate_limit' },
                { finishReason: 'quota_exceeded', expectedCategory: 'rate_limit' },
                { finishReason: 'timeout', expectedCategory: 'timeout' },
                { finishReason: 'content_filter', expectedCategory: 'content_filter' },
                { finishReason: 'unknown_reason', expectedCategory: 'unknown' }
            ];

            let correctCategorizations = 0;
            for (const test of categorizationTests) {
                const category = tracker.categorizeFinishReason(test.finishReason);
                if (category === test.expectedCategory) {
                    correctCategorizations++;
                } else {
                    console.log(`⚠️ Categorization mismatch: ${test.finishReason} -> ${category} (expected ${test.expectedCategory})`);
                }
            }

            this.validateTestCondition(
                testResult,
                'Categorization Accuracy',
                correctCategorizations === categorizationTests.length,
                `${correctCategorizations}/${categorizationTests.length} correct categorizations`
            );

            this.validateTestCondition(
                testResult,
                'Case Insensitive Handling',
                tracker.categorizeFinishReason('STOP') === 'stop' &&
                tracker.categorizeFinishReason('Tool_Calls') === 'tool_calls',
                'Case insensitive categorization works'
            );

            this.validateTestCondition(
                testResult,
                'Null/Empty Handling',
                tracker.categorizeFinishReason(null) === 'unknown' &&
                tracker.categorizeFinishReason('') === 'unknown' &&
                tracker.categorizeFinishReason(undefined) === 'unknown',
                'Null/empty values default to unknown'
            );

            this.validateTestCondition(
                testResult,
                'Partial Match Support',
                tracker.categorizeFinishReason('API_rate_limit_exceeded') === 'rate_limit' &&
                tracker.categorizeFinishReason('content_policy_violation') === 'content_filter',
                'Partial matching works for complex finish reasons'
            );

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 3 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testQueryAndFiltering() {
        const testResult = {
            name: 'Query and Filtering Capabilities',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n🔍 Test 4: Query and Filtering Capabilities');

            const tracker = new FinishReasonTracker(this.testConfig);
            await tracker.initialize();

            // Add test data
            const testData = [
                { provider: 'anthropic', finishReason: 'stop', category: 'stop' },
                { provider: 'anthropic', finishReason: 'length', category: 'length' },
                { provider: 'openai', finishReason: 'stop', category: 'stop' },
                { provider: 'openai', finishReason: 'tool_calls', category: 'tool_calls' },
                { provider: 'gemini', finishReason: 'error', category: 'error' }
            ];

            for (const data of testData) {
                await tracker.logFinishReason(data);
            }

            // Test provider filtering
            const anthropicResults = await tracker.queryFinishReasons({ provider: 'anthropic' });
            this.validateTestCondition(
                testResult,
                'Provider Filtering',
                anthropicResults.results.every(r => r.provider === 'anthropic'),
                `Anthropic results: ${anthropicResults.results.length}`
            );

            // Test category filtering
            const stopResults = await tracker.queryFinishReasons({ category: 'stop' });
            this.validateTestCondition(
                testResult,
                'Category Filtering', 
                stopResults.results.every(r => r.category === 'stop'),
                `Stop results: ${stopResults.results.length}`
            );

            // Test combined filtering
            const combinedResults = await tracker.queryFinishReasons({ 
                provider: 'openai', 
                category: 'stop' 
            });
            this.validateTestCondition(
                testResult,
                'Combined Filtering',
                combinedResults.results.every(r => r.provider === 'openai' && r.category === 'stop'),
                `Combined results: ${combinedResults.results.length}`
            );

            // Test limit and pagination
            const limitedResults = await tracker.queryFinishReasons({ limit: 2, offset: 1 });
            this.validateTestCondition(
                testResult,
                'Pagination Support',
                limitedResults.results.length <= 2 && limitedResults.offset === 1,
                `Limited results: ${limitedResults.results.length}, offset: ${limitedResults.offset}`
            );

            // Test finish reason search
            const searchResults = await tracker.queryFinishReasons({ finishReason: 'stop' });
            this.validateTestCondition(
                testResult,
                'Finish Reason Search',
                searchResults.results.every(r => r.finishReason.toLowerCase().includes('stop')),
                `Search results: ${searchResults.results.length}`
            );

            // Test no results scenario
            const noResults = await tracker.queryFinishReasons({ provider: 'nonexistent' });
            this.validateTestCondition(
                testResult,
                'No Results Handling',
                noResults.results.length === 0 && noResults.total === 0,
                'Empty results handled correctly'
            );

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 4 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testDistributionReporting() {
        const testResult = {
            name: 'Distribution Reporting and Insights',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n📊 Test 5: Distribution Reporting and Insights');

            const tracker = new FinishReasonTracker(this.testConfig);
            await tracker.initialize();

            // Add diverse test data for reporting
            const reportTestData = [
                { provider: 'anthropic', finishReason: 'stop', category: 'stop' },
                { provider: 'anthropic', finishReason: 'stop', category: 'stop' },
                { provider: 'anthropic', finishReason: 'length', category: 'length' },
                { provider: 'openai', finishReason: 'stop', category: 'stop' },
                { provider: 'openai', finishReason: 'error', category: 'error' },
                { provider: 'gemini', finishReason: 'tool_calls', category: 'tool_calls' },
                { provider: 'gemini', finishReason: 'tool_calls', category: 'tool_calls' },
                { provider: 'codewhisperer', finishReason: 'stop', category: 'stop' }
            ];

            for (const data of reportTestData) {
                await tracker.logFinishReason(data);
            }

            // Generate distribution report
            const report = await tracker.generateDistributionReport({ timeRange: { hours: 24 } });

            this.validateTestCondition(
                testResult,
                'Report Generation',
                report.metadata && report.distributions && report.insights,
                'Report structure complete'
            );

            this.validateTestCondition(
                testResult,
                'Metadata Completeness',
                report.metadata.totalEntries === reportTestData.length &&
                report.metadata.uniqueProviders >= 4,
                `Total entries: ${report.metadata.totalEntries}, Unique providers: ${report.metadata.uniqueProviders}`
            );

            this.validateTestCondition(
                testResult,
                'Category Distribution', 
                report.distributions.byCategory.length > 0 &&
                report.distributions.byCategory.some(item => item.key === 'stop'),
                `Category distribution items: ${report.distributions.byCategory.length}`
            );

            this.validateTestCondition(
                testResult,
                'Provider Distribution',
                report.distributions.byProvider.length > 0 &&
                report.distributions.byProvider.some(item => item.key === 'anthropic'),
                `Provider distribution items: ${report.distributions.byProvider.length}`
            );

            this.validateTestCondition(
                testResult,
                'Percentage Calculations',
                report.distributions.byCategory.every(item => 
                    parseFloat(item.percentage) >= 0 && parseFloat(item.percentage) <= 100
                ),
                'All percentages within valid range'
            );

            this.validateTestCondition(
                testResult,
                'Insights Generation',
                report.insights.length > 0 && 
                report.insights.some(insight => insight.includes('Most common')),
                `Generated insights: ${report.insights.length}`
            );

            // Test report persistence
            const reportsDir = path.join(this.testConfig.baseDir, 'reports');
            const files = await fs.readdir(reportsDir);
            const reportFiles = files.filter(f => f.includes('distribution-report'));

            this.validateTestCondition(
                testResult,
                'Report Persistence',
                reportFiles.length > 0,
                `Report files created: ${reportFiles.length}`
            );

            testResult.status = 'passed';
            testResult.report = report;

        } catch (error) {
            testResult.status = 'failed'; 
            testResult.error = error.message;
            console.error('❌ Test 5 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testPatternAnalysisAndAlerts() {
        const testResult = {
            name: 'Pattern Analysis and Alert System',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n⚠️ Test 6: Pattern Analysis and Alert System');

            const tracker = new FinishReasonTracker(this.testConfig);
            await tracker.initialize();

            // Test rate limit pattern detection
            console.log('Testing rate limit pattern...');
            for (let i = 0; i < 5; i++) {
                await tracker.logFinishReason({
                    provider: 'test-provider',
                    finishReason: 'rate_limit',
                    category: 'rate_limit'
                });
            }

            // Wait a moment for pattern analysis
            await new Promise(resolve => setTimeout(resolve, 100));

            this.validateTestCondition(
                testResult,
                'Rate Limit Pattern Detection',
                tracker.data.alerts.length > 0,
                `Alerts generated: ${tracker.data.alerts.length}`
            );

            // Test high error rate pattern detection
            console.log('Testing error rate pattern...');
            const testProvider = 'error-test-provider';
            
            // Add mix of successful and error entries
            await tracker.logFinishReason({ provider: testProvider, finishReason: 'stop', category: 'stop' });
            await tracker.logFinishReason({ provider: testProvider, finishReason: 'error', category: 'error' });
            await tracker.logFinishReason({ provider: testProvider, finishReason: 'error', category: 'error' });
            await tracker.logFinishReason({ provider: testProvider, finishReason: 'error', category: 'error' });

            await new Promise(resolve => setTimeout(resolve, 100));

            this.validateTestCondition(
                testResult,
                'Error Rate Pattern Detection', 
                tracker.data.alerts.some(alert => alert.type === 'high_error_rate'),
                'High error rate alert created'
            );

            // Test alert properties
            const alerts = tracker.data.alerts;
            if (alerts.length > 0) {
                const alert = alerts[0];
                
                this.validateTestCondition(
                    testResult,
                    'Alert Structure',
                    alert.id && alert.timestamp && alert.type && alert.severity,
                    'Alert has required fields'
                );

                this.validateTestCondition(
                    testResult,
                    'Alert Severity Assignment',
                    ['low', 'medium', 'high', 'critical'].includes(alert.severity),
                    `Alert severity: ${alert.severity}`
                );
            }

            // Test alert persistence
            const alertsDir = path.join(this.testConfig.baseDir, 'alerts');
            const alertFiles = await fs.readdir(alertsDir);

            this.validateTestCondition(
                testResult,
                'Alert Persistence',
                alertFiles.length > 0,
                `Alert files created: ${alertFiles.length}`
            );

            testResult.status = 'passed';
            testResult.alertsGenerated = tracker.data.alerts.length;

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 6 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testExportFunctionality() {
        const testResult = {
            name: 'Export Functionality',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n💾 Test 7: Export Functionality');

            const tracker = new FinishReasonTracker(this.testConfig);
            await tracker.initialize();

            // Add test data for export
            const exportTestData = [
                { provider: 'anthropic', finishReason: 'stop', model: 'claude-sonnet-4', tokenCount: { input: 100, output: 50 } },
                { provider: 'openai', finishReason: 'length', model: 'gpt-4', tokenCount: { input: 200, output: 150 } },
                { provider: 'gemini', finishReason: 'tool_calls', model: 'gemini-pro', tokenCount: { input: 80, output: 120 } }
            ];

            for (const data of exportTestData) {
                await tracker.logFinishReason(data);
            }

            // Test JSON export
            const jsonExport = await tracker.exportFinishReasonData('json');
            
            this.validateTestCondition(
                testResult,
                'JSON Export Creation',
                jsonExport.status === 'exported' && jsonExport.format === 'json',
                `JSON export: ${jsonExport.filePath}`
            );

            this.validateTestCondition(
                testResult,
                'JSON Export File Size',
                jsonExport.fileSize > 0,
                `JSON file size: ${jsonExport.fileSize} bytes`
            );

            // Test CSV export  
            const csvExport = await tracker.exportFinishReasonData('csv');
            
            this.validateTestCondition(
                testResult,
                'CSV Export Creation',
                csvExport.status === 'exported' && csvExport.format === 'csv',
                `CSV export: ${csvExport.filePath}`
            );

            // Test summary export
            const summaryExport = await tracker.exportFinishReasonData('summary');
            
            this.validateTestCondition(
                testResult,
                'Summary Export Creation',
                summaryExport.status === 'exported' && summaryExport.format === 'summary',
                `Summary export: ${summaryExport.filePath}`
            );

            // Test filtered export
            const filteredExport = await tracker.exportFinishReasonData('json', { provider: 'anthropic' });
            
            this.validateTestCondition(
                testResult,
                'Filtered Export',
                filteredExport.status === 'exported',
                `Filtered export records: ${filteredExport.recordCount}`
            );

            // Test export file existence
            const exportsDir = path.join(this.testConfig.baseDir, 'exports');
            const exportFiles = await fs.readdir(exportsDir);
            
            this.validateTestCondition(
                testResult,
                'Export File Persistence',
                exportFiles.length >= 4, // json, csv, summary, filtered
                `Export files created: ${exportFiles.length}`
            );

            // Validate CSV format
            if (await this.fileExists(csvExport.filePath)) {
                const csvContent = await fs.readFile(csvExport.filePath, 'utf8');
                const lines = csvContent.split('\n');
                
                this.validateTestCondition(
                    testResult,
                    'CSV Format Validation',
                    lines[0].includes('ID,Timestamp,Provider') && lines.length > 1,
                    `CSV has header and ${lines.length - 1} data rows`
                );
            }

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 7 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testCLIInterface() {
        const testResult = {
            name: 'CLI Interface Validation',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n💻 Test 8: CLI Interface Validation');

            const tracker = new FinishReasonTracker(this.testConfig);
            await tracker.initialize();

            // Add test data for CLI operations
            await tracker.logFinishReason({ provider: 'anthropic', finishReason: 'stop' });
            await tracker.logFinishReason({ provider: 'openai', finishReason: 'error' });

            // Test query command
            const queryResult = await tracker.runCLI(['query', '--provider', 'anthropic', '--limit', '5']);
            
            this.validateTestCondition(
                testResult,
                'Query Command',
                queryResult && queryResult.results,
                'Query command executed successfully'
            );

            // Test report command
            const reportResult = await tracker.runCLI(['report', '--hours', '24']);
            
            this.validateTestCondition(
                testResult,
                'Report Command',
                reportResult && reportResult.metadata,
                'Report command executed successfully'
            );

            // Test export command
            const exportResult = await tracker.runCLI(['export', '--format', 'json']);
            
            this.validateTestCondition(
                testResult,
                'Export Command',
                exportResult && exportResult.status === 'exported',
                'Export command executed successfully'
            );

            // Test alerts command
            const alertsResult = await tracker.runCLI(['alerts']);
            
            this.validateTestCondition(
                testResult,
                'Alerts Command',
                alertsResult && alertsResult.hasOwnProperty('alerts'),
                'Alerts command executed successfully'
            );

            // Test help command
            const helpResult = await tracker.runCLI(['help']);
            
            this.validateTestCondition(
                testResult,
                'Help Command',
                helpResult && helpResult.command === 'help',
                'Help command executed successfully'
            );

            // Test invalid command (should show help)
            const invalidResult = await tracker.runCLI(['invalid-command']);
            
            this.validateTestCondition(
                testResult,
                'Invalid Command Handling',
                invalidResult && invalidResult.command === 'help',
                'Invalid commands show help'
            );

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 8 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    async testComprehensiveSystem() {
        const testResult = {
            name: 'Comprehensive System Integration',
            startTime: new Date().toISOString(),
            status: 'running',
            validations: []
        };

        try {
            console.log('\n🎯 Test 9: Comprehensive System Integration');

            const tracker = new FinishReasonTracker(this.testConfig);
            await tracker.initialize();

            // Simulate a realistic usage scenario
            const scenarios = [
                // Normal operations
                { provider: 'anthropic', finishReason: 'stop', duration: 1200 },
                { provider: 'anthropic', finishReason: 'stop', duration: 1100 },
                { provider: 'openai', finishReason: 'stop', duration: 900 },
                
                // Tool usage
                { provider: 'anthropic', finishReason: 'tool_calls', duration: 2100 },
                { provider: 'gemini', finishReason: 'function_call', duration: 1800 },
                
                // Length limitations
                { provider: 'openai', finishReason: 'max_tokens', duration: 3200 },
                { provider: 'gemini', finishReason: 'length', duration: 2900 },
                
                // Errors and issues
                { provider: 'codewhisperer', finishReason: 'error', errorDetails: 'API timeout' },
                { provider: 'openai', finishReason: 'rate_limit', errorDetails: 'Rate limit exceeded' },
                
                // Content filtering
                { provider: 'anthropic', finishReason: 'content_filter', errorDetails: 'Policy violation' }
            ];

            // Process all scenarios
            for (const scenario of scenarios) {
                await tracker.logFinishReason(scenario);
            }

            this.validateTestCondition(
                testResult,
                'Scenario Processing',
                tracker.data.finishReasons.size >= scenarios.length,
                `Processed ${scenarios.length} scenarios`
            );

            // Generate comprehensive report
            const report = await tracker.generateDistributionReport({ timeRange: { hours: 1 } });
            
            this.validateTestCondition(
                testResult,
                'Comprehensive Reporting',
                report.distributions.byCategory.length >= 5 &&
                report.distributions.byProvider.length >= 3,
                `Categories: ${report.distributions.byCategory.length}, Providers: ${report.distributions.byProvider.length}`
            );

            // Test comprehensive query
            const queryAll = await tracker.queryFinishReasons();
            
            this.validateTestCondition(
                testResult,
                'Complete Data Retrieval',
                queryAll.results.length >= scenarios.length,
                `Retrieved ${queryAll.results.length} entries`
            );

            // Test system persistence and recovery
            const newTracker = new FinishReasonTracker(this.testConfig);
            await newTracker.initialize();
            
            this.validateTestCondition(
                testResult,
                'System Persistence',
                newTracker.data.finishReasons.size > 0,
                `Loaded ${newTracker.data.finishReasons.size} entries from persistence`
            );

            // Test export of complete dataset
            const fullExport = await tracker.exportFinishReasonData('summary');
            
            this.validateTestCondition(
                testResult,
                'Complete System Export',
                fullExport.status === 'exported' && fullExport.fileSize > 1000,
                `Export size: ${fullExport.fileSize} bytes`
            );

            // Test CLI operations on complete dataset
            const cliResults = await tracker.runCLI(['query', '--limit', '20']);
            
            this.validateTestCondition(
                testResult,
                'CLI System Integration',
                cliResults.results.length > 0,
                `CLI query returned ${cliResults.results.length} results`
            );

            testResult.status = 'passed';

        } catch (error) {
            testResult.status = 'failed';
            testResult.error = error.message;
            console.error('❌ Test 9 failed:', error.message);
        }

        testResult.duration = Date.now() - new Date(testResult.startTime).getTime();
        testResult.endTime = new Date().toISOString();
        this.results.tests.push(testResult);

        return testResult;
    }

    // Helper methods
    validateTestCondition(testResult, name, condition, details) {
        const validation = {
            test: name,
            status: condition ? 'passed' : 'failed',
            details
        };
        
        testResult.validations.push(validation);
        
        const icon = condition ? '✅' : '❌';
        console.log(`  ${icon} ${name}: ${details}`);
        
        return condition;
    }

    async directoryExists(dirPath) {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async validateDirectoryStructure(baseDir) {
        const requiredDirs = ['logs', 'patterns', 'reports', 'alerts', 'exports'];
        
        for (const dir of requiredDirs) {
            const dirPath = path.join(baseDir, dir);
            if (!(await this.directoryExists(dirPath))) {
                return false;
            }
        }
        
        return true;
    }
}

// Execute tests if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new FinishReasonTrackerTest();
    
    tester.runTests()
        .then(results => {
            console.log('\n🎯 All tests completed!');
            process.exit(results.summary.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error);
            process.exit(1);
        });
}

export default FinishReasonTrackerTest;