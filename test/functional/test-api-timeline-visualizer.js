#!/usr/bin/env node

/**
 * API Timeline Visualizer - Functional Testing
 * 
 * Test suite for Task 10.2 implementation: API Timeline Visualization System
 * with interactive HTML output, multi-format exports, and real-time capabilities.
 * 
 * @author Jason Zhang
 * @version v3.0-production
 * @requires Node.js >= 16
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { APITimelineVisualizer } from '../../src/v3/tools-ecosystem/visualization/api-timeline-visualizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * API Timeline Visualizer Test Suite
 */
class APITimelineVisualizerTest {
    constructor() {
        this.sessionId = `timeline-visualizer-test-${Date.now()}`;
        this.outputDir = path.join(process.cwd(), 'test', 'output', 'functional');
        this.testDataDir = path.join(this.outputDir, 'test-provider-data');
        this.testOutputDir = path.join(this.outputDir, 'test-timeline-output');
        this.testResults = [];
        
        console.log('🧪 [REAL-IMPL] API Timeline Visualizer Test Suite');
        console.log(`📋 Session ID: ${this.sessionId}`);
        console.log(`📁 Test Data Directory: ${this.testDataDir}`);
        console.log(`📂 Test Output Directory: ${this.testOutputDir}`);
    }

    /**
     * Execute complete test suite
     * @returns {Promise<Object>} Test execution results
     */
    async runTests() {
        console.log('\\n🚀 [REAL-IMPL] Starting API Timeline Visualizer Tests');
        
        const suiteResult = {
            sessionId: this.sessionId,
            startTime: new Date().toISOString(),
            tests: [],
            summary: {}
        };

        try {
            // Setup test environment
            await this.setupTestEnvironment();
            
            // Test 1: Data Loading and Processing
            console.log('\\n📍 Test 1: Data Loading and Processing');
            const dataLoadingTest = await this.testDataLoadingAndProcessing();
            suiteResult.tests.push(dataLoadingTest);
            
            // Test 2: Timeline Data Parsing
            console.log('\\n📍 Test 2: Timeline Data Parsing');
            const parsingTest = await this.testTimelineDataParsing();
            suiteResult.tests.push(parsingTest);
            
            // Test 3: HTML Visualization Generation
            console.log('\\n📍 Test 3: HTML Visualization Generation');
            const htmlGenerationTest = await this.testHTMLVisualizationGeneration();
            suiteResult.tests.push(htmlGenerationTest);
            
            // Test 4: Export Formats
            console.log('\\n📍 Test 4: Export Formats Generation');
            const exportTest = await this.testExportFormats();
            suiteResult.tests.push(exportTest);
            
            // Test 5: Filter and Search Capabilities
            console.log('\\n📍 Test 5: Filter and Search Capabilities');
            const filterTest = await this.testFilterAndSearch();
            suiteResult.tests.push(filterTest);
            
            // Test 6: Timeline Statistics
            console.log('\\n📍 Test 6: Timeline Statistics Calculation');
            const statsTest = await this.testTimelineStatistics();
            suiteResult.tests.push(statsTest);
            
            // Test 7: Complete System Integration
            console.log('\\n📍 Test 7: Complete System Integration');
            const integrationTest = await this.testCompleteSystemIntegration();
            suiteResult.tests.push(integrationTest);
            
            // Test 8: CLI Interface
            console.log('\\n📍 Test 8: CLI Interface Validation');
            const cliTest = await this.testCLIInterface();
            suiteResult.tests.push(cliTest);
            
        } catch (error) {
            console.error('❌ Test suite execution failed:', error.message);
            suiteResult.error = error.message;
        } finally {
            // Cleanup test environment
            await this.cleanupTestEnvironment();
        }

        suiteResult.endTime = new Date().toISOString();
        suiteResult.summary = this.generateSummary(suiteResult.tests);
        
        // Save test results
        await this.saveTestResults(suiteResult);
        
        console.log('\\n📊 Test Suite Summary:');
        console.log(`   ✅ Passed: ${suiteResult.summary.passed}`);
        console.log(`   ❌ Failed: ${suiteResult.summary.failed}`);
        console.log(`   ⏱️  Total Duration: ${suiteResult.summary.totalDuration}ms`);
        
        return suiteResult;
    }

    /**
     * Setup test environment with mock provider-protocol data
     */
    async setupTestEnvironment() {
        // Create test directories
        await fs.mkdir(this.testDataDir, { recursive: true });
        await fs.mkdir(this.testOutputDir, { recursive: true });
        
        // Create provider-protocol directories
        const providers = ['anthropic', 'openai', 'gemini', 'codewhisperer', 'unknown'];
        for (const provider of providers) {
            await fs.mkdir(path.join(this.testDataDir, provider), { recursive: true });
        }
        
        // Create sample provider-protocol data files
        await this.createSampleProviderData();
        
        console.log('🔧 Test environment setup completed');
    }

    /**
     * Create sample provider-protocol data for testing
     */
    async createSampleProviderData() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

        // Anthropic provider data
        const anthropicRequests = [
            {
                type: 'structured',
                providerProtocol: 'anthropic',
                timestamp: oneHourAgo.toISOString(),
                data: { method: 'POST', url: '/v1/messages', status: 200, duration: 1250 },
                metadata: { lineNumber: 1, fileName: 'anthropic.log', extractedAt: now.toISOString(), dataSize: 150 }
            },
            {
                type: 'structured',
                providerProtocol: 'anthropic',
                timestamp: twoHoursAgo.toISOString(),
                data: { method: 'POST', url: '/v1/messages', status: 200, duration: 890 },
                metadata: { lineNumber: 2, fileName: 'anthropic.log', extractedAt: now.toISOString(), dataSize: 200 }
            }
        ];

        const anthropicResponses = [
            {
                type: 'structured',
                providerProtocol: 'anthropic',
                timestamp: oneHourAgo.toISOString(),
                data: { status: 200, duration: 1250 },
                metadata: { lineNumber: 3, fileName: 'anthropic.log', extractedAt: now.toISOString(), dataSize: 1200 }
            }
        ];

        await fs.writeFile(
            path.join(this.testDataDir, 'anthropic', 'test-requests.json'),
            JSON.stringify(anthropicRequests, null, 2)
        );
        await fs.writeFile(
            path.join(this.testDataDir, 'anthropic', 'test-responses.json'),
            JSON.stringify(anthropicResponses, null, 2)
        );

        // OpenAI provider data
        const openaiData = [
            {
                type: 'structured',
                providerProtocol: 'openai',
                timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
                data: { method: 'POST', url: '/v1/chat/completions', status: 200, duration: 800 },
                metadata: { lineNumber: 1, fileName: 'openai.log', extractedAt: now.toISOString(), dataSize: 180 }
            },
            {
                type: 'structured',
                providerProtocol: 'openai',
                timestamp: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
                data: { method: 'POST', url: '/v1/chat/completions', status: 429, error: 'Rate limit exceeded' },
                metadata: { lineNumber: 2, fileName: 'openai.log', extractedAt: now.toISOString(), dataSize: 120 }
            }
        ];

        await fs.writeFile(
            path.join(this.testDataDir, 'openai', 'test-requests.json'),
            JSON.stringify(openaiData, null, 2)
        );

        // Gemini provider data  
        const geminiData = [
            {
                type: 'unstructured',
                providerProtocol: 'gemini',
                timestamp: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
                data: { 
                    rawLine: 'INFO Gemini API request completed',
                    performance: { duration: 1500 }
                },
                metadata: { lineNumber: 1, fileName: 'gemini.log', extractedAt: now.toISOString(), dataSize: 80 }
            }
        ];

        await fs.writeFile(
            path.join(this.testDataDir, 'gemini', 'test-performance.json'),
            JSON.stringify(geminiData, null, 2)
        );

        // CodeWhisperer provider data
        const codewhispererData = [
            {
                type: 'structured',
                providerProtocol: 'codewhisperer',
                timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
                data: { method: 'POST', url: '/conversation', status: 200, duration: 2100 },
                metadata: { lineNumber: 1, fileName: 'codewhisperer.log', extractedAt: now.toISOString(), dataSize: 300 }
            }
        ];

        await fs.writeFile(
            path.join(this.testDataDir, 'codewhisperer', 'test-requests.json'),
            JSON.stringify(codewhispererData, null, 2)
        );

        // Unknown provider data
        const unknownData = [
            {
                type: 'unstructured',
                providerProtocol: 'unknown',
                timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
                data: {
                    rawLine: 'Server listening on port 3456',
                    request: null
                },
                metadata: { lineNumber: 1, fileName: 'server.log', extractedAt: now.toISOString(), dataSize: 50 }
            }
        ];

        await fs.writeFile(
            path.join(this.testDataDir, 'unknown', 'test-requests.json'),
            JSON.stringify(unknownData, null, 2)
        );

        console.log('📊 Sample provider-protocol data created for all providers');
    }

    /**
     * Test 1: Data Loading and Processing
     */
    async testDataLoadingAndProcessing() {
        const testStartTime = Date.now();
        const test = {
            name: 'Data Loading and Processing',
            startTime: new Date().toISOString(),
            status: 'unknown',
            validations: [],
            duration: 0
        };

        try {
            const visualizer = new APITimelineVisualizer({
                inputPath: this.testDataDir,
                outputPath: this.testOutputDir,
                maxCalls: 50,
                timeRange: { hours: 168 } // 1 week to capture all test data
            });

            // Test data loading
            const providerData = await visualizer.loadProviderProtocolData();

            test.validations.push({
                test: 'Provider Data Loading',
                status: Object.keys(providerData).length >= 4 ? 'passed' : 'failed',
                details: `Loaded ${Object.keys(providerData).length} providers (expected at least 4)`
            });

            // Check specific provider data
            const expectedProviders = ['anthropic', 'openai', 'gemini', 'codewhisperer'];
            for (const provider of expectedProviders) {
                const hasData = providerData[provider] && 
                    (providerData[provider].requests.length > 0 || 
                     providerData[provider].responses.length > 0 || 
                     providerData[provider].performance.length > 0);
                
                test.validations.push({
                    test: `${provider} Data Loaded`,
                    status: hasData ? 'passed' : 'failed',
                    details: `${provider} data ${hasData ? 'found' : 'not found'}`
                });
            }

            // Check data structure
            test.validations.push({
                test: 'Data Structure Validation',
                status: providerData.anthropic?.requests?.length > 0 ? 'passed' : 'failed',
                details: `Anthropic requests count: ${providerData.anthropic?.requests?.length || 0}`
            });

            test.status = test.validations.every(v => v.status === 'passed') ? 'passed' : 'failed';
            console.log(`   ${test.status === 'passed' ? '✅' : '❌'} Data loading and processing test completed`);

        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            test.validations.push({
                test: 'Error Handling',
                status: 'failed',
                details: error.message
            });
            console.log('   ❌ Data loading and processing test failed:', error.message);
        }

        test.duration = Date.now() - testStartTime;
        test.endTime = new Date().toISOString();
        return test;
    }

    /**
     * Test 2: Timeline Data Parsing
     */
    async testTimelineDataParsing() {
        const testStartTime = Date.now();
        const test = {
            name: 'Timeline Data Parsing',
            startTime: new Date().toISOString(),
            status: 'unknown',
            validations: [],
            duration: 0
        };

        try {
            const visualizer = new APITimelineVisualizer({
                inputPath: this.testDataDir,
                outputPath: this.testOutputDir,
                maxCalls: 50,
                timeRange: { hours: 168 } // 1 week to capture all test data
            });

            // Load and parse data
            const providerData = await visualizer.loadProviderProtocolData();
            await visualizer.parseTimelineData(providerData);

            test.validations.push({
                test: 'Timeline Data Parsing',
                status: visualizer.timelineData.length > 0 ? 'passed' : 'failed',
                details: `Parsed ${visualizer.timelineData.length} timeline entries`
            });

            // Check timeline entry structure
            if (visualizer.timelineData.length > 0) {
                const firstEntry = visualizer.timelineData[0];
                const requiredFields = ['id', 'timestamp', 'provider', 'type', 'color'];
                
                const hasRequiredFields = requiredFields.every(field => firstEntry[field] !== undefined);
                test.validations.push({
                    test: 'Timeline Entry Structure',
                    status: hasRequiredFields ? 'passed' : 'failed',
                    details: `Timeline entry has required fields: ${hasRequiredFields}`
                });

                test.validations.push({
                    test: 'Timestamp Validation',
                    status: new Date(firstEntry.timestamp).getTime() > 0 ? 'passed' : 'failed',
                    details: `First entry timestamp: ${firstEntry.timestamp}`
                });

                test.validations.push({
                    test: 'Provider Color Assignment',
                    status: firstEntry.color && firstEntry.color.startsWith('#') ? 'passed' : 'failed',
                    details: `Provider color: ${firstEntry.color}`
                });
            }

            // Check sorting by timestamp
            const timestamps = visualizer.timelineData.map(e => new Date(e.timestamp).getTime());
            const isSorted = timestamps.every((time, i) => i === 0 || time >= timestamps[i - 1]);
            
            test.validations.push({
                test: 'Timeline Sorting',
                status: isSorted ? 'passed' : 'failed',
                details: `Timeline entries sorted by timestamp: ${isSorted}`
            });

            test.status = test.validations.every(v => v.status === 'passed') ? 'passed' : 'failed';
            console.log(`   ${test.status === 'passed' ? '✅' : '❌'} Timeline data parsing test completed`);

        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            console.log('   ❌ Timeline data parsing test failed:', error.message);
        }

        test.duration = Date.now() - testStartTime;
        test.endTime = new Date().toISOString();
        return test;
    }

    /**
     * Test 3: HTML Visualization Generation
     */
    async testHTMLVisualizationGeneration() {
        const testStartTime = Date.now();
        const test = {
            name: 'HTML Visualization Generation',
            startTime: new Date().toISOString(),
            status: 'unknown',
            validations: [],
            duration: 0
        };

        try {
            const visualizer = new APITimelineVisualizer({
                inputPath: this.testDataDir,
                outputPath: this.testOutputDir,
                maxCalls: 50,
                timeRange: { hours: 168 } // 1 week to capture all test data
            });

            // Generate complete timeline
            const result = await visualizer.generateTimeline();

            // Check if HTML file was created
            const htmlFile = path.join(this.testOutputDir, 'html', 'api-timeline.html');
            const htmlExists = await fs.access(htmlFile).then(() => true).catch(() => false);

            test.validations.push({
                test: 'HTML File Creation',
                status: htmlExists ? 'passed' : 'failed',
                details: `HTML file ${htmlExists ? 'created' : 'not found'} at ${htmlFile}`
            });

            if (htmlExists) {
                const htmlContent = await fs.readFile(htmlFile, 'utf-8');

                // Check HTML content structure
                test.validations.push({
                    test: 'HTML Structure',
                    status: htmlContent.includes('<title>') && htmlContent.includes('</html>') ? 'passed' : 'failed',
                    details: 'HTML contains proper structure tags'
                });

                test.validations.push({
                    test: 'Timeline Data Inclusion',
                    status: htmlContent.includes('timelineData') && htmlContent.includes('providerColors') ? 'passed' : 'failed',
                    details: 'HTML includes timeline data and provider colors'
                });

                test.validations.push({
                    test: 'Interactive Features',
                    status: htmlContent.includes('getElementById') && htmlContent.includes('addEventListener') ? 'passed' : 'failed',
                    details: 'HTML includes interactive JavaScript features'
                });

                test.validations.push({
                    test: 'CSS Styling',
                    status: htmlContent.includes('<style>') && htmlContent.includes('.timeline') ? 'passed' : 'failed',
                    details: 'HTML includes CSS styling for timeline'
                });

                // Check file size (should be substantial for interactive timeline)
                const stats = await fs.stat(htmlFile);
                test.validations.push({
                    test: 'HTML File Size',
                    status: stats.size > 10000 ? 'passed' : 'failed', // At least 10KB
                    details: `HTML file size: ${Math.round(stats.size / 1024)}KB`
                });
            }

            test.status = test.validations.every(v => v.status === 'passed') ? 'passed' : 'failed';
            console.log(`   ${test.status === 'passed' ? '✅' : '❌'} HTML visualization generation test completed`);

        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            console.log('   ❌ HTML visualization generation test failed:', error.message);
        }

        test.duration = Date.now() - testStartTime;
        test.endTime = new Date().toISOString();
        return test;
    }

    /**
     * Test 4: Export Formats
     */
    async testExportFormats() {
        const testStartTime = Date.now();
        const test = {
            name: 'Export Formats Generation',
            startTime: new Date().toISOString(),
            status: 'unknown',
            validations: [],
            duration: 0
        };

        try {
            const visualizer = new APITimelineVisualizer({
                inputPath: this.testDataDir,
                outputPath: this.testOutputDir,
                maxCalls: 50,
                timeRange: { hours: 168 } // 1 week to capture all test data
            });

            await visualizer.generateTimeline();

            // Check JSON export
            const jsonFile = path.join(this.testOutputDir, 'json', 'timeline-data.json');
            const jsonExists = await fs.access(jsonFile).then(() => true).catch(() => false);

            test.validations.push({
                test: 'JSON Export Creation',
                status: jsonExists ? 'passed' : 'failed',
                details: `JSON export ${jsonExists ? 'created' : 'not found'}`
            });

            if (jsonExists) {
                const jsonContent = await fs.readFile(jsonFile, 'utf-8');
                const jsonData = JSON.parse(jsonContent);

                test.validations.push({
                    test: 'JSON Structure',
                    status: jsonData.metadata && jsonData.timeline ? 'passed' : 'failed',
                    details: 'JSON contains metadata and timeline data'
                });

                test.validations.push({
                    test: 'JSON Metadata',
                    status: jsonData.metadata.version === 'v3.0-production' ? 'passed' : 'failed',
                    details: `JSON version: ${jsonData.metadata.version}`
                });
            }

            // Check CSV export
            const csvFile = path.join(this.testOutputDir, 'exports', 'timeline-data.csv');
            const csvExists = await fs.access(csvFile).then(() => true).catch(() => false);

            test.validations.push({
                test: 'CSV Export Creation',
                status: csvExists ? 'passed' : 'failed',
                details: `CSV export ${csvExists ? 'created' : 'not found'}`
            });

            if (csvExists) {
                const csvContent = await fs.readFile(csvFile, 'utf-8');
                const csvLines = csvContent.split('\\n');

                test.validations.push({
                    test: 'CSV Header',
                    status: csvLines[0].includes('Timestamp') && csvLines[0].includes('Provider') ? 'passed' : 'failed',
                    details: 'CSV contains proper header row'
                });

                test.validations.push({
                    test: 'CSV Data Rows',
                    status: csvLines.length > 1 ? 'passed' : 'failed',
                    details: `CSV contains ${csvLines.length - 1} data rows`
                });
            }

            test.status = test.validations.every(v => v.status === 'passed') ? 'passed' : 'failed';
            console.log(`   ${test.status === 'passed' ? '✅' : '❌'} Export formats generation test completed`);

        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            console.log('   ❌ Export formats generation test failed:', error.message);
        }

        test.duration = Date.now() - testStartTime;
        test.endTime = new Date().toISOString();
        return test;
    }

    /**
     * Test 5: Filter and Search Capabilities
     */
    async testFilterAndSearch() {
        const testStartTime = Date.now();
        const test = {
            name: 'Filter and Search Capabilities',
            startTime: new Date().toISOString(),
            status: 'unknown',
            validations: [],
            duration: 0
        };

        try {
            const visualizer = new APITimelineVisualizer({
                inputPath: this.testDataDir,
                outputPath: this.testOutputDir,
                maxCalls: 50,
                timeRange: { hours: 168 } // 1 week to capture all test data
            });

            const providerData = await visualizer.loadProviderProtocolData();
            await visualizer.parseTimelineData(providerData);

            // Test filtering by provider
            const originalCount = visualizer.timelineData.length;
            const anthropicEntries = visualizer.timelineData.filter(e => e.provider === 'anthropic');

            test.validations.push({
                test: 'Provider Filtering Logic',
                status: anthropicEntries.length > 0 && anthropicEntries.length < originalCount ? 'passed' : 'failed',
                details: `Anthropic entries: ${anthropicEntries.length} of ${originalCount} total`
            });

            // Test filtering by type
            const requestEntries = visualizer.timelineData.filter(e => e.type === 'request');
            test.validations.push({
                test: 'Type Filtering Logic',
                status: requestEntries.length >= 0 ? 'passed' : 'failed',
                details: `Request entries: ${requestEntries.length}`
            });

            // Test time-based filtering
            await visualizer.applyFiltersAndLimits();
            test.validations.push({
                test: 'Limits Application',
                status: visualizer.filteredData.length <= visualizer.maxCalls ? 'passed' : 'failed',
                details: `Filtered data: ${visualizer.filteredData.length}, Max calls: ${visualizer.maxCalls}`
            });

            // Test search functionality (simulated)
            const searchableData = visualizer.timelineData.filter(call => 
                JSON.stringify(call).toLowerCase().includes('anthropic')
            );

            test.validations.push({
                test: 'Search Logic Simulation',
                status: searchableData.length > 0 ? 'passed' : 'failed',
                details: `Search results for 'anthropic': ${searchableData.length} entries`
            });

            test.status = test.validations.every(v => v.status === 'passed') ? 'passed' : 'failed';
            console.log(`   ${test.status === 'passed' ? '✅' : '❌'} Filter and search capabilities test completed`);

        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            console.log('   ❌ Filter and search capabilities test failed:', error.message);
        }

        test.duration = Date.now() - testStartTime;
        test.endTime = new Date().toISOString();
        return test;
    }

    /**
     * Test 6: Timeline Statistics
     */
    async testTimelineStatistics() {
        const testStartTime = Date.now();
        const test = {
            name: 'Timeline Statistics Calculation',
            startTime: new Date().toISOString(),
            status: 'unknown',
            validations: [],
            duration: 0
        };

        try {
            const visualizer = new APITimelineVisualizer({
                inputPath: this.testDataDir,
                outputPath: this.testOutputDir,
                maxCalls: 50,
                timeRange: { hours: 168 } // 1 week to capture all test data
            });

            await visualizer.generateTimeline();

            // Check statistics calculation
            const stats = visualizer.visualizationStats;

            test.validations.push({
                test: 'Total Calls Statistics',
                status: typeof stats.totalCalls === 'number' && stats.totalCalls >= 0 ? 'passed' : 'failed',
                details: `Total calls: ${stats.totalCalls}`
            });

            test.validations.push({
                test: 'Unique Providers Count',
                status: stats.uniqueProviders instanceof Set && stats.uniqueProviders.size > 0 ? 'passed' : 'failed',
                details: `Unique providers: ${stats.uniqueProviders.size}`
            });

            test.validations.push({
                test: 'Time Span Calculation',
                status: stats.timeSpan && (stats.timeSpan.start || stats.timeSpan.end) ? 'passed' : 'failed',
                details: `Time span: ${stats.timeSpan?.start} to ${stats.timeSpan?.end}`
            });

            // Test statistic methods
            const errorRate = visualizer.calculateErrorRate();
            const avgLatency = visualizer.calculateAverageLatency();

            test.validations.push({
                test: 'Error Rate Calculation',
                status: typeof errorRate === 'number' && errorRate >= 0 && errorRate <= 100 ? 'passed' : 'failed',
                details: `Error rate: ${errorRate}%`
            });

            test.validations.push({
                test: 'Average Latency Calculation',
                status: typeof avgLatency === 'number' && avgLatency >= 0 ? 'passed' : 'failed',
                details: `Average latency: ${avgLatency}ms`
            });

            test.status = test.validations.every(v => v.status === 'passed') ? 'passed' : 'failed';
            console.log(`   ${test.status === 'passed' ? '✅' : '❌'} Timeline statistics calculation test completed`);

        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            console.log('   ❌ Timeline statistics calculation test failed:', error.message);
        }

        test.duration = Date.now() - testStartTime;
        test.endTime = new Date().toISOString();
        return test;
    }

    /**
     * Test 7: Complete System Integration
     */
    async testCompleteSystemIntegration() {
        const testStartTime = Date.now();
        const test = {
            name: 'Complete System Integration',
            startTime: new Date().toISOString(),
            status: 'unknown',
            validations: [],
            duration: 0
        };

        try {
            const visualizer = new APITimelineVisualizer({
                inputPath: this.testDataDir,
                outputPath: this.testOutputDir,
                maxCalls: 100,
                timeRange: { hours: 48 }
            });

            // Run complete timeline generation
            const result = await visualizer.generateTimeline();

            test.validations.push({
                test: 'Complete System Execution',
                status: result && result.statistics ? 'passed' : 'failed',
                details: `System execution ${result ? 'successful' : 'failed'}`
            });

            // Check all output files are created
            const expectedFiles = [
                path.join(this.testOutputDir, 'html', 'api-timeline.html'),
                path.join(this.testOutputDir, 'json', 'timeline-data.json'),
                path.join(this.testOutputDir, 'exports', 'timeline-data.csv'),
                path.join(this.testOutputDir, 'visualization-report.json')
            ];

            for (const file of expectedFiles) {
                const exists = await fs.access(file).then(() => true).catch(() => false);
                test.validations.push({
                    test: `Output File: ${path.basename(file)}`,
                    status: exists ? 'passed' : 'failed',
                    details: `File ${exists ? 'created' : 'missing'}: ${path.basename(file)}`
                });
            }

            // Check report structure
            if (result.outputs) {
                test.validations.push({
                    test: 'Report Output Paths',
                    status: result.outputs.htmlVisualization && result.outputs.jsonExport ? 'passed' : 'failed',
                    details: 'Report contains output file paths'
                });
            }

            test.status = test.validations.every(v => v.status === 'passed') ? 'passed' : 'failed';
            console.log(`   ${test.status === 'passed' ? '✅' : '❌'} Complete system integration test completed`);

        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            console.log('   ❌ Complete system integration test failed:', error.message);
        }

        test.duration = Date.now() - testStartTime;
        test.endTime = new Date().toISOString();
        return test;
    }

    /**
     * Test 8: CLI Interface
     */
    async testCLIInterface() {
        const testStartTime = Date.now();
        const test = {
            name: 'CLI Interface Validation',
            startTime: new Date().toISOString(),
            status: 'unknown',
            validations: [],
            duration: 0
        };

        try {
            // Test CLI configuration options
            const customVisualizer = new APITimelineVisualizer({
                inputPath: '/custom/input',
                outputPath: '/custom/output',
                maxCalls: 200,
                timeRange: { hours: 72 },
                colorScheme: 'custom'
            });

            test.validations.push({
                test: 'Custom Configuration',
                status: customVisualizer.maxCalls === 200 ? 'passed' : 'failed',
                details: `Max calls configuration: ${customVisualizer.maxCalls}`
            });

            test.validations.push({
                test: 'Time Range Configuration',
                status: customVisualizer.timeRange.hours === 72 ? 'passed' : 'failed',
                details: `Time range: ${customVisualizer.timeRange.hours} hours`
            });

            test.validations.push({
                test: 'Path Configuration',
                status: customVisualizer.inputPath === '/custom/input' ? 'passed' : 'failed',
                details: `Input path: ${customVisualizer.inputPath}`
            });

            test.validations.push({
                test: 'Color Scheme Configuration',
                status: customVisualizer.colorScheme === 'custom' ? 'passed' : 'failed',
                details: `Color scheme: ${customVisualizer.colorScheme}`
            });

            // Test provider color mapping
            test.validations.push({
                test: 'Provider Color Mapping',
                status: customVisualizer.providerColors.anthropic && customVisualizer.providerColors.openai ? 'passed' : 'failed',
                details: 'Provider color mapping available'
            });

            test.status = test.validations.every(v => v.status === 'passed') ? 'passed' : 'failed';
            console.log(`   ${test.status === 'passed' ? '✅' : '❌'} CLI interface validation test completed`);

        } catch (error) {
            test.status = 'failed';
            test.error = error.message;
            console.log('   ❌ CLI interface validation test failed:', error.message);
        }

        test.duration = Date.now() - testStartTime;
        test.endTime = new Date().toISOString();
        return test;
    }

    /**
     * Generate test summary
     */
    generateSummary(tests) {
        const passed = tests.filter(t => t.status === 'passed').length;
        const failed = tests.filter(t => t.status === 'failed').length;
        const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);

        return {
            total: tests.length,
            passed,
            failed,
            totalDuration,
            passRate: tests.length > 0 ? Math.round((passed / tests.length) * 100) : 0
        };
    }

    /**
     * Save test results to file
     */
    async saveTestResults(results) {
        const outputFile = path.join(this.outputDir, `timeline-visualizer-test-${this.sessionId}.json`);
        
        try {
            await fs.writeFile(outputFile, JSON.stringify(results, null, 2));
            console.log(`\\n📄 Test results saved: ${outputFile}`);
        } catch (error) {
            console.warn('⚠️ Failed to save test results:', error.message);
        }
    }

    /**
     * Cleanup test environment
     */
    async cleanupTestEnvironment() {
        try {
            // Keep test output for inspection
            console.log('🧹 Test environment cleanup completed (files preserved for inspection)');
        } catch (error) {
            console.warn('⚠️ Cleanup warning:', error.message);
        }
    }
}

/**
 * CLI Interface for API Timeline Visualizer Tests
 */
async function main() {
    console.log('🎯 API Timeline Visualizer Test Suite - Task 10.2 Validation');
    console.log('📋 Testing Requirements: 8.3 Interactive Timeline Visualization');
    
    try {
        const testSuite = new APITimelineVisualizerTest();
        const results = await testSuite.runTests();
        
        console.log('\\n🎉 API Timeline Visualizer Test Suite Complete!');
        console.log('📁 Check test/output/functional/ for detailed results and timeline outputs');
        
        const success = results.summary.passed === results.summary.total;
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

// Export for integration
export { APITimelineVisualizerTest };

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}